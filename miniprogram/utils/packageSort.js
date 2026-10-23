const PACKAGE_ORDER = [
  'opening-trio',
  'weekend-solo',
  'solo-2h',
  'solo-1h',
  'weekend-duo',
  'duo-2h',
  'duo-1h',
  'weekend-family',
];

function sortPackages(list) {
  const rank = new Map(PACKAGE_ORDER.map((id, index) => [id, index]));
  return (list || []).slice().sort((a, b) => {
    const ao = Number(a && a.sortOrder) || 0;
    const bo = Number(b && b.sortOrder) || 0;
    if (ao !== bo) return ao - bo;
    const ai = rank.has(a.id) ? rank.get(a.id) : 999;
    const bi = rank.has(b.id) ? rank.get(b.id) : 999;
    if (ai !== bi) return ai - bi;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

module.exports = {
  PACKAGE_ORDER,
  sortPackages,
};
