function buildSkeletonRows(count) {
  let n = Number(count);
  if (!Number.isFinite(n)) n = 4;
  n = Math.max(1, Math.min(8, Math.floor(n)));
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    rows.push({
      key: i,
      wide: i % 3 !== 2,
    });
  }
  return rows;
}

module.exports = {
  buildSkeletonRows,
};
