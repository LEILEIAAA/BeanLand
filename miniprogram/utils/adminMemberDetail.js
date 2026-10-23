function pickMemberFromList(list, memberId) {
  const id = String(memberId || '').trim();
  if (!id) return null;
  const rows = Array.isArray(list) ? list : [];
  for (const row of rows) {
    if (!row) continue;
    const rowId = row._id != null ? row._id : row.id;
    if (rowId != null && String(rowId) === id) return row;
  }
  return null;
}

function buildMemberDetailReset(memberId) {
  const id = String(memberId || '').trim();
  const hasId = !!id;
  return {
    memberId: id,
    member: null,
    transactions: [],
    filterType: '',
    loading: hasId,
    txLoading: hasId,
  };
}

module.exports = {
  pickMemberFromList,
  buildMemberDetailReset,
};
