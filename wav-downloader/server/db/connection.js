const mysql = require("mysql2/promise");

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host:             process.env.DB_HOST     || "localhost",
      port:             parseInt(process.env.DB_PORT || "3306"),
      user:             process.env.DB_USER     || "beatpad_user",
      password:         process.env.DB_PASSWORD || "beatpad_password",
      database:         process.env.DB_NAME     || "beatpad",
      waitForConnections: true,
      connectionLimit:    10,
      queueLimit:         0,
      enableKeepAlive:    true,
    });
  }
  return pool;
}

/**
 * Test the database connection.
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    const conn = await getPool().getConnection();
    conn.release();
    return true;
  } catch {
    return false;
  }
}

module.exports = { getPool, testConnection };
