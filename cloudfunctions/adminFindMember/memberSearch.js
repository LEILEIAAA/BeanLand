function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cloud DB RegExp pattern for phone fuzzy search (contains, no ^/$ anchors).
 */
function buildPhoneSearchPattern(keyword) {
  return escapeRegExp(String(keyword || '').trim());
}

function phoneMatchesKeyword(phone, keyword) {
  const text = String(keyword || '').trim();
  if (!text) return false;
  const value = String(phone || '');
  if (!value) return false;
  try {
    return new RegExp(buildPhoneSearchPattern(text), 'i').test(value);
  } catch (error) {
    return false;
  }
}

module.exports = {
  escapeRegExp,
  buildPhoneSearchPattern,
  phoneMatchesKeyword,
};
