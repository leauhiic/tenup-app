const { Pool } = require("pg");

const config = {};
const connectionString =
  process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (connectionString) {
  config.connectionString = connectionString;
}

if (process.env.PGSSL === "true" || /supabase\.(co|com)/i.test(connectionString || "")) {
  config.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(config);

module.exports = pool;
