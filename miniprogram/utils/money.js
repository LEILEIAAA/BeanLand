/** Format money for display — always 2 decimal places. */
function formatYuan2(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2);
}

module.exports = { formatYuan2 };
