const { Pool } = require("pg");

const SOURCE_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;
const TARGET_URL = process.env.SUPABASE_DATABASE_URL;

const TABLES = ["users", "tournois", "sync_runs"];

function createPool(connectionString) {
  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
}

async function tableExists(pool, table) {
  const result = await pool.query(
    `select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = $1
    ) as exists`,
    [table],
  );
  return result.rows[0]?.exists === true;
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function copyTable(source, target, table) {
  if (!(await tableExists(source, table))) {
    return { table, copied: 0, skipped: true };
  }

  const sourceRows = await source.query(`select * from ${quoteIdentifier(table)}`);
  if (!sourceRows.rows.length) return { table, copied: 0, skipped: false };

  await target.query("begin");
  try {
    await target.query(`truncate table ${quoteIdentifier(table)} restart identity cascade`);

    const columns = sourceRows.fields.map((field) => field.name);
    const quotedColumns = columns.map(quoteIdentifier).join(", ");
    let copied = 0;

    for (const row of sourceRows.rows) {
      const values = columns.map((column) => row[column]);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
      await target.query(
        `insert into ${quoteIdentifier(table)} (${quotedColumns}) values (${placeholders})`,
        values,
      );
      copied += 1;
    }

    const idResult = await target.query(
      `select max(id)::integer as max_id from ${quoteIdentifier(table)}`,
    );
    const maxId = idResult.rows[0]?.max_id;
    if (Number.isInteger(maxId) && maxId > 0) {
      await target.query(
        `select setval(pg_get_serial_sequence($1, 'id'), $2, true)`,
        [`public.${table}`, maxId],
      );
    }

    await target.query("commit");
    return { table, copied, skipped: false };
  } catch (err) {
    await target.query("rollback");
    throw err;
  }
}

async function main() {
  if (!SOURCE_URL) {
    throw new Error("RAILWAY_DATABASE_URL ou DATABASE_URL manquant pour la source Railway");
  }
  if (!TARGET_URL) {
    throw new Error("SUPABASE_DATABASE_URL manquant pour la cible Supabase");
  }

  const source = createPool(SOURCE_URL);
  const target = createPool(TARGET_URL);

  try {
    const results = [];
    for (const table of TABLES) {
      results.push(await copyTable(source, target, table));
    }
    console.log(JSON.stringify({ ok: true, results }, null, 2));
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
