const CAPTION_MAX = 40;

function normalizeCaption(caption) {
  const text = String(caption == null ? '' : caption).trim();
  return text.length > CAPTION_MAX ? text.slice(0, CAPTION_MAX) : text;
}

function buildWorksCardPreview(list) {
  const rows = Array.isArray(list) ? list : [];
  const sorted = rows
    .slice()
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const previewThumbs = sorted.slice(0, 3).map((row) => ({
    id: row._id,
    imageFileID: row.imageFileID,
  }));
  const workCount = rows.length;
  const worksEmpty = workCount === 0;
  return {
    workCount,
    previewThumbs,
    worksEmpty,
    worksHint: worksEmpty ? '还没有作品，去拍一张' : '把成品照留下来',
  };
}

function formatWorkDate(ms) {
  const n = Number(ms);
  if (!n) return '';
  const d = new Date(n);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = {
  CAPTION_MAX,
  normalizeCaption,
  buildWorksCardPreview,
  formatWorkDate,
};
