const { Pool } = require("pg");

const config = {};
let connectionString =
  process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const useSslNoVerify =
  process.env.PGSSL === "true" ||
  /supabase\.(co|com)/i.test(connectionString || "");

if (connectionString && useSslNoVerify) {
  try {
    const url = new URL(connectionString);
    url.searchParams.set("sslmode", "no-verify");
    connectionString = url.toString();
  } catch (err) {
    // Keep the original string if it is not URL-parseable.
  }
}

if (connectionString) {
  config.connectionString = connectionString;
}

if (useSslNoVerify) {
  process.env.PGSSLMODE = "no-verify";
  config.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(config);

module.exports = pool;
