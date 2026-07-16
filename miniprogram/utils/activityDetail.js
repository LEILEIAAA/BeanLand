function trimText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeIncludes(includes) {
  if (!Array.isArray(includes)) return [];
  return includes.map((item) => trimText(item)).filter(Boolean);
}

/**
 * Build ordered detail rows for activity registration page.
 * Empty / missing fields are omitted.
 */
function buildActivityDetailRows(activity) {
  if (!activity || typeof activity !== 'object') return [];

  const includes = normalizeIncludes(activity.includes);
  const candidates = [
    { key: 'scheduleText', label: '活动档期', value: activity.scheduleText },
    { key: 'timeText', label: '活动时间', value: activity.timeText },
    { key: 'audience', label: '适合人群', value: activity.audience },
    { key: 'content', label: '活动内容', value: activity.content },
    { key: 'includes', label: '包含内容', value: includes.length ? includes.join(' · ') : '' },
    { key: 'notice', label: '注意事项', value: activity.notice },
  ];

  return candidates
    .map((row) => ({
      key: row.key,
      label: row.label,
      value: trimText(row.value),
    }))
    .filter((row) => row.value);
}

/**
 * Structured detail view for richer registration UI.
 */
function buildActivityDetailView(activity) {
  if (!activity || typeof activity !== 'object') {
    return {
      empty: true,
      highlights: [],
      audience: '',
      content: '',
      includes: [],
      notice: '',
    };
  }

  const highlights = [
    { key: 'scheduleText', label: '档期', value: trimText(activity.scheduleText) },
    { key: 'timeText', label: '时间', value: trimText(activity.timeText) },
  ].filter((row) => row.value);

  const audience = trimText(activity.audience);
  const content = trimText(activity.content);
  const includes = normalizeIncludes(activity.includes);
  const notice = trimText(activity.notice);

  return {
    empty: !highlights.length && !audience && !content && !includes.length && !notice,
    highlights,
    audience,
    content,
    includes,
    notice,
  };
}

module.exports = {
  buildActivityDetailRows,
  buildActivityDetailView,
};
