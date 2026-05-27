/**
 * Path helpers.
 *
 * Values come from the in-memory settingsService cache which is seeded from
 * environment variables and overridden by any rows in the `settings` table.
 * These functions stay synchronous so existing call sites don't change.
 */

const settingsService = require("../services/settingsService");

function getDownloadsPath() { return settingsService.getDownloadsPath(); }

module.exports = { getDownloadsPath };
