/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // One row per call to RapidAPI, for the monthly cap (quota.ts).
  pgm.createTable("api_calls", {
    id: "id",
    at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("api_calls", "at");

  // Articles already fetched, so reading one again costs nothing (cache.ts).
  pgm.createTable("article_cache", {
    url: { type: "text", primaryKey: true },
    article: { type: "jsonb", notNull: true },
    fetched_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable("article_cache");
  pgm.dropTable("api_calls");
};
