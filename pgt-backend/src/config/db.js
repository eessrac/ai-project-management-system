const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;

pool.query("SELECT 1")
  .then(() => console.log("DB OK"))
  .catch(e => console.error("DB FAIL:", e.message));