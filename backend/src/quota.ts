import pool from "./db.js";

// A hard cap on calls to RapidAPI, so the free tier (250 a month, then paid
// per request) can't be exceeded. Counted over the last 30 days rather than a
// calendar month. Every attempt counts, failed ones included, since RapidAPI
// may bill those too. Kept in Postgres so restarts and redeploys don't reset it.
export const MONTHLY_API_LIMIT = Number(process.env.MONTHLY_API_LIMIT ?? 250);
const WINDOW = "30 days";

// Takes one call from the budget, or returns false if none is left.
export async function reserveCall(): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serializes reservations, so two requests can't both take the last one.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('txtify_api_calls'))");
    const { rows } = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM api_calls WHERE at > now() - interval '${WINDOW}'`,
    );
    if (rows[0].n >= MONTHLY_API_LIMIT) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query("INSERT INTO api_calls DEFAULT VALUES");
    await client.query(`DELETE FROM api_calls WHERE at < now() - interval '62 days'`);
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// When the oldest counted call ages out, freeing a slot.
export async function nextFreeSlot(): Promise<Date | undefined> {
  const { rows } = await pool.query<{ at: Date }>(
    `SELECT min(at) + interval '${WINDOW}' AS at FROM api_calls WHERE at > now() - interval '${WINDOW}'`,
  );
  return rows[0]?.at ?? undefined;
}
