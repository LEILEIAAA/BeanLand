/**
 * 从会员文档构建集章进度展示字段（与「我的」页同源）。
 * @param {object|null|undefined} member
 */
function buildStampProgress(member) {
  const stampCount = Math.max(0, Number((member && member.stampCount) || 0));
  const rawTarget = Number((member && member.stampTarget) || 5);
  const stampTarget = rawTarget > 0 ? rawTarget : 5;
  const progressPercent = Math.min(100, Math.round((stampCount / stampTarget) * 100));
  return { stampCount, stampTarget, progressPercent };
}

module.exports = {
  buildStampProgress,
};
