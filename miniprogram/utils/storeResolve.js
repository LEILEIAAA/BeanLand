/**
 * Resolve store document from cloud reads without silent seed leakage.
 * @param {object|null|undefined} docData
 * @param {Array|null|undefined} rows
 * @param {{ allowSeedFallback?: boolean, seedStore?: object|null }} options
 * @returns {object|null}
 */
function resolveStorePayload(docData, rows, options = {}) {
  if (docData) return docData;
  if (Array.isArray(rows) && rows.length) return rows[0];
  if (options.allowSeedFallback && options.seedStore) return options.seedStore;
  return null;
}

module.exports = {
  resolveStorePayload,
};
