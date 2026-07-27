/**
 * eventCache.js
 *
 * localStorage-based cache for on-chain event logs.
 * Strategy: cache all events + the last scanned block. On next visit,
 * only fetch blocks from lastBlock+1 to latest, then merge + re-save.
 *
 * This reduces subsequent page loads from ~20–30 s → < 1 s when few
 * new blocks have been mined since the last visit.
 *
 * Cache keys are namespaced, e.g. "cc_events_certissued".
 * Max cache age is 10 minutes — stale data is re-fetched in full.
 */

const PREFIX    = "cc_events_";
const MAX_AGE_MS = 60 * 60 * 1000; // 60 minutes — blockchain events don't change retroactively

/**
 * Load cached events for a given key.
 *
 * @param {string} key  e.g. "certissued", "certrevoked", "myissued_0xabc"
 * @returns {{ lastBlock: number, events: object[] } | null}
 *   Returns null if nothing cached or cache is stale.
 */
export const loadCachedEvents = (key) => {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.lastBlock !== "number" || !Array.isArray(parsed.events)) {
      return null;
    }

    // Treat cache as stale after MAX_AGE_MS
    if (Date.now() - (parsed.savedAt || 0) > MAX_AGE_MS) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }

    return { lastBlock: parsed.lastBlock, events: parsed.events };
  } catch (_) {
    return null;
  }
};

/**
 * Save events to cache.
 *
 * @param {string}   key
 * @param {number}   lastBlock  — the highest block number included in `events`
 * @param {object[]} events     — serialisable event objects (NOT raw ethers Log objects)
 */
export const saveCachedEvents = (key, lastBlock, events) => {
  try {
    localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ lastBlock, events, savedAt: Date.now() })
    );
  } catch (err) {
    // localStorage full or unavailable — fail silently
    console.warn("[eventCache] Could not save cache:", err.message);
  }
};

/**
 * Clear a specific cache entry (e.g. after a manual refresh).
 * @param {string} key
 */
export const clearCachedEvents = (key) => {
  localStorage.removeItem(PREFIX + key);
};

/**
 * Clear ALL certchain event caches.
 */
export const clearAllCaches = () => {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k));
};
