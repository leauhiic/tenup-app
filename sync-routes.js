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
    cleanText,
    findUserByTenupId,
    findUserByLicence,
    getDefaultAdminUser,
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
        JSON.stringify(run.details || {}),
      ],
    );
  }

  async function validateImportRows(rows, source) {
    if (!Array.isArray(rows)) {
      return {
        response: { status: 400, body: { error: "tournois must be an array" } },
      };
    }

    const values = [];
    const errors = [];

    rows.forEach((row, index) => {
      const validation = validateTournoiPayload(row);
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
        details: { errors: errors.slice(0, 20) },
      });

      return {
        response: {
          status: 400,
          body: { error: "Invalid tournament rows", errors },
        },
      };
    }

    return { values };
  }

  async function resolveImportOwner({ tenupId, licence, source, received }) {
    const owner =
      (tenupId ? await findUserByTenupId(tenupId) : null) ||
      (licence ? await findUserByLicence(licence) : null) ||
      (tenupId || licence ? null : await getDefaultAdminUser());

    if (!owner?.id) {
      await recordSyncRun({
        source,
        status: "failed",
        received,
        imported: 0,
        skipped: received,
        message: tenupId || licence
          ? "Import rejected: unknown TenUp id or licence"
          : "Import rejected: admin account unavailable",
        details: { tenupId, licence },
      });

      return {
        response: {
          status: tenupId || licence ? 404 : 500,
          body: {
            error: tenupId || licence ? "ID TenUp ou licence inconnu" : "Compte admin indisponible",
          },
        },
      };
    }

    if (owner.approved !== true) {
      await recordSyncRun({
        source,
        status: "failed",
        received,
        imported: 0,
        skipped: received,
        message: "Import rejected: account pending approval",
        details: { tenupId, licence, userId: owner.id },
      });

      return {
        response: {
          status: 403,
          body: { error: "Compte en attente de validation admin" },
        },
      };
    }

    return { owner };
  }

  async function importRowsForOwner({ source, values, owner, replace }) {
    if (replace) {
      await getDb().query("DELETE FROM tournois WHERE user_id = $1", [
        owner.id,
      ]);
    }

    let imported = 0;
    let updated = 0;
    for (const tournoi of values) {
      const result = await insertTournoiIfMissing(tournoi, {
        imported: true,
        userId: owner.id,
      });
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
      message: replace
        ? "Import completed with replacement"
        : "Import completed",
      details: {
        replace,
        updated,
        tenupId: owner.tenupId,
        licence: owner.licence,
        userId: owner.id,
      },
    });

    return {
      message: "Import reussi",
      received: values.length,
      imported,
      updated,
      skipped,
      replaced: replace,
    };
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

  app.get("/sync/tenup-ids", async (req, res) => {
    try {
      await ensureTournoisSchema();
      const result = await getDb().query(`
        SELECT tenup_id
        FROM users
        WHERE approved = true
          AND tenup_id IS NOT NULL
          AND tenup_id <> ''
        ORDER BY role = 'admin' DESC, created_at ASC, id ASC
      `);
      const seen = new Set();
      const tenupIds = result.rows
        .map((row) => cleanText(row.tenup_id || "", 32).replace(/\s+/g, ""))
        .filter((tenupId) => /^\d{6,20}$/.test(tenupId))
        .filter((tenupId) => {
          if (seen.has(tenupId)) return false;
          seen.add(tenupId);
          return true;
        });

      res.json({ tenupIds, count: tenupIds.length });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/tournois/import", requireAdmin, async (req, res) => {
    const body = req.body || {};
    const rows = Array.isArray(body) ? body : body.tournois;
    const source =
      cleanText(body.source || DEFAULT_SOURCE, 60) || DEFAULT_SOURCE;
    const replace = req.query.replace === "true" || body.replace === true;
    const tenupId = cleanText(
      body.tenupId ||
        body.tenup_id ||
        req.query.tenupId ||
        req.query.tenup_id ||
        "",
      32,
    ).replace(/\s+/g, "");
    const licence = cleanText(
      body.licence ||
        body.license ||
        req.query.licence ||
        req.query.license ||
        "",
      40,
    ).replace(/\s*\(\d{4}\)\s*$/g, "").replace(/\s+/g, "").toUpperCase();

    try {
      await ensureTournoisSchema();
      const validation = await validateImportRows(rows, source);
      if (validation.response)
        return res
          .status(validation.response.status)
          .json(validation.response.body);

      const ownership = await resolveImportOwner({
        tenupId,
        licence,
        source,
        received: validation.values.length,
      });
      if (ownership.response)
        return res
          .status(ownership.response.status)
          .json(ownership.response.body);

      res.json(
        await importRowsForOwner({
          source,
          values: validation.values,
          owner: ownership.owner,
          replace,
        }),
      );
    } catch (err) {
      console.error(err);
      await recordSyncRun({
        source,
        status: "failed",
        received: Array.isArray(rows) ? rows.length : 0,
        imported: 0,
        skipped: Array.isArray(rows) ? rows.length : 0,
        message: err.message,
        details: { tenupId, licence },
      });
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/tournois/import/tenup", async (req, res) => {
    const body = req.body || {};
    const rows = Array.isArray(body) ? body : body.tournois;
    const source =
      cleanText(body.source || "tenup-extension", 60) || "tenup-extension";
    const tenupId = cleanText(body.tenupId || body.tenup_id || "", 32).replace(
      /\s+/g,
      "",
    );
    const licence = cleanText(body.licence || body.license || "", 40)
      .replace(/\s*\(\d{4}\)\s*$/g, "")
      .replace(/\s+/g, "")
      .toUpperCase();

    if (!tenupId && !licence) {
      return res.status(400).json({ error: "ID TenUp ou licence requis" });
    }

    try {
      await ensureTournoisSchema();
      const validation = await validateImportRows(rows, source);
      if (validation.response)
        return res
          .status(validation.response.status)
          .json(validation.response.body);

      const ownership = await resolveImportOwner({
        tenupId,
        licence,
        source,
        received: validation.values.length,
      });
      if (ownership.response)
        return res
          .status(ownership.response.status)
          .json(ownership.response.body);

      res.json(
        await importRowsForOwner({
          source,
          values: validation.values,
          owner: ownership.owner,
          replace: false,
        }),
      );
    } catch (err) {
      console.error(err);
      await recordSyncRun({
        source,
        status: "failed",
        received: Array.isArray(rows) ? rows.length : 0,
        imported: 0,
        skipped: Array.isArray(rows) ? rows.length : 0,
        message: err.message,
        details: { tenupId, licence },
      });
      res.status(500).json({ error: err.message });
    }
  });
};
