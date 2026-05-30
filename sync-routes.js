const DEFAULT_SOURCE = "tenup";

function toInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

module.exports = function registerSyncRoutes(app, helpers) {
  const {
    requireAdmin,
    validateTournoiPayload,
    insertTournoiIfMissing,
    ensureTournoisSchema,
    getDb,
    cleanText
  } = helpers;

  async function ensureSyncRunsTable() {
    await getDb().query(`
      CREATE TABLE IF NOT EXISTS sync_runs (
        id SERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        received INTEGER NOT NULL DEFAULT 0,
        imported INTEGER NOT NULL DEFAULT 0,
        skipped INTEGER NOT NULL DEFAULT 0,
        message TEXT,
        details JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async function recordSyncRun(run) {
    await ensureSyncRunsTable();
    await getDb().query(
      `INSERT INTO sync_runs (source, status, received, imported, skipped, message, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        run.source || DEFAULT_SOURCE,
        run.status,
        toInteger(run.received),
        toInteger(run.imported),
        toInteger(run.skipped),
        cleanText(run.message || "", 500),
        JSON.stringify(run.details || {})
      ]
    );
  }

  app.get("/sync/status", async (req, res) => {
    try {
      await ensureSyncRunsTable();
      const result = await getDb().query(`
        SELECT source, status, received, imported, skipped, message, details, created_at
        FROM sync_runs
        ORDER BY created_at DESC
        LIMIT 1
      `);

      res.json({ lastRun: result.rows[0] || null });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/tournois/import", requireAdmin, async (req, res) => {
    const body = req.body || {};
    const rows = Array.isArray(body) ? body : body.tournois;
    const source = cleanText(body.source || DEFAULT_SOURCE, 60) || DEFAULT_SOURCE;
    const replace = req.query.replace === "true" || body.replace === true;

    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: "tournois must be an array" });
    }

    const values = [];
    const errors = [];

    rows.forEach((row, index) => {
      const validation = validateTournoiPayload({ ...row, manuel: false });
      if (validation.error) {
        errors.push({ index, error: validation.error });
        return;
      }

      values.push(validation.value);
    });

    if (errors.length) {
      await recordSyncRun({
        source,
        status: "failed",
        received: rows.length,
        imported: 0,
        skipped: rows.length,
        message: "Import rejected: invalid tournament rows",
        details: { errors: errors.slice(0, 20) }
      });

      return res.status(400).json({ error: "Invalid tournament rows", errors });
    }

    try {
      await ensureTournoisSchema();

      if (replace) {
        await getDb().query("TRUNCATE TABLE tournois RESTART IDENTITY");
      }

      let imported = 0;
      let updated = 0;
      for (const tournoi of values) {
        const result = await insertTournoiIfMissing(tournoi, { imported: true });
        if (result === "inserted") {
          imported += 1;
        } else if (result === "updated") {
          updated += 1;
        }
      }

      const skipped = values.length - imported - updated;
      await recordSyncRun({
        source,
        status: "success",
        received: values.length,
        imported,
        skipped,
        message: replace ? "Import completed with replacement" : "Import completed",
        details: { replace, updated }
      });

      res.json({
        message: "Import reussi",
        received: values.length,
        imported,
        updated,
        skipped,
        replaced: replace
      });
    } catch (err) {
      console.error(err);
      await recordSyncRun({
        source,
        status: "failed",
        received: values.length,
        imported: 0,
        skipped: values.length,
        message: err.message
      });
      res.status(500).json({ error: err.message });
    }
  });
};
