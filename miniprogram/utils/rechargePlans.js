function normalizeRechargePlan(row) {
  if (!row || typeof row !== 'object') return null;
  const id = String(row.id || row._id || '').trim();
  if (!id) return null;
  const rechargeAmount = Number(row.rechargeAmount || 0);
  if (!(rechargeAmount > 0)) return null;
  const bonusAmount = Number(row.bonusAmount || 0);
  const arrivalRaw = row.arrivalAmount;
  const arrivalAmount =
    arrivalRaw != null && arrivalRaw !== ''
      ? Number(arrivalRaw)
      : rechargeAmount + bonusAmount;
  return {
    ...row,
    id,
    rechargeAmount,
    bonusAmount,
    arrivalAmount: Number.isFinite(arrivalAmount) ? arrivalAmount : rechargeAmount + bonusAmount,
    audience: row.audience == null ? '' : String(row.audience),
  };
}

function mapRechargePlans(rows) {
  return (rows || [])
    .map(normalizeRechargePlan)
    .filter(Boolean)
    .sort((a, b) => a.rechargeAmount - b.rechargeAmount);
}

module.exports = {
  normalizeRechargePlan,
  mapRechargePlans,
};
