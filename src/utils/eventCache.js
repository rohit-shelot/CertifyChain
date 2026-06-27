/**
 * eventCache.js
 *
 * Caches blockchain event logs in sessionStorage so that subsequent page
 * loads only need to fetch the delta (new blocks since last scan).
 *
 * Cache structure per key:
 *   { lastBlock: number, events: SerializedEvent[] }
 *
 * Events are stored as plain objects (no BigInt, no non-serialisable fields).
 */

const STORAGE_PREFIX = "certchain_events_";

/**
 * Serialise a single ethers log/event into a plain JSON-safe object.
 */
const serialiseEvent = (log) => ({
  // Event identification
  transactionHash: log.transactionHash,
  blockNumber: log.blockNumber,
  logIndex: log.index ?? log.logIndex ?? 0,
  // Decoded args — convert BigInt values to strings
  args: log.args
    ? Array.from(log.args).map((a) =>
        typeof a === "bigint" ? a.toString() : a
      )
    : [],
  // Keep the raw topics & data so we can reconstruct if needed
  topics: [...(log.topics || [])],
  data: log.data || "0x",
});

/**
 * Deserialise a cached event back to an object that mirrors ethers log shape.
 * Note: args values that were BigInt are stored as strings.
 */
const deserialiseEvent = (obj) => ({
  transactionHash: obj.transactionHash,
  blockNumber: obj.blockNumber,
  index: obj.logIndex,
  logIndex: obj.logIndex,
  args: obj.args,
  topics: obj.topics,
  data: obj.data,
});

/**
 * Load cached events from sessionStorage.
 *
 * @param {string} cacheKey - Unique key for this query (e.g. "issued", "issued_0xABC")
 * @returns {{ lastBlock: number, events: object[] } | null}
 */
export const loadCachedEvents = (cacheKey) => {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.lastBlock !== "number") return null;
    return {
      lastBlock: parsed.lastBlock,
      events: (parsed.events || []).map(deserialiseEvent),
    };
  } catch {
    return null;
  }
};

/**
 * Save events to sessionStorage.
 *
 * @param {string} cacheKey
 * @param {number} lastBlock - The highest block number that was scanned
 * @param {object[]} events - Array of ethers log objects
 */
export const saveCachedEvents = (cacheKey, lastBlock, events) => {
  try {
    const payload = {
      lastBlock,
      events: events.map(serialiseEvent),
    };
    sessionStorage.setItem(STORAGE_PREFIX + cacheKey, JSON.stringify(payload));
  } catch (err) {
    // sessionStorage might be full — silently ignore
    console.warn("[eventCache] Failed to save:", err.message);
  }
};

/**
 * Clear all event caches (useful after issuing/revoking a certificate).
 */
export const clearEventCache = () => {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
};
