import { logger } from "firebase-functions";

export const FEED_URL = "https://recalls-rappels.canada.ca/sites/default/files/opendata-donneesouvertes/HCRSAMOpenData.json";

/**
 * The feed is about 34,000 notices in one file, and on 2026-11-21 the download was cut off four
 * seconds in ("Error: terminated"), so that morning's check never ran. A dropped download is
 * retried here, and the scheduler retries the whole run if all attempts fail.
 */
export async function fetchFeed(get = fetch, attempts = 3, waitMs = 15000) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await get(FEED_URL);
      if (!res.ok) throw new Error(`recall feed returned ${res.status}`);
      return await res.json();
    } catch (e) {
      last = e;
      logger.warn("recall feed download failed", { attempt: i, of: attempts, error: String(e) });
      if (i < attempts) await new Promise((r) => setTimeout(r, waitMs * i));
    }
  }
  throw new Error(`recall feed failed ${attempts} times: ${last}`);
}
