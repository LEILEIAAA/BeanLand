const ADMIN_MEMBER_SEARCH_DEBOUNCE_MS = 300;
const ADMIN_MEMBER_SEARCH_MIN_DIGITS = 4;

/**
 * Whether keyword is ready for a remote member search.
 * Digit-only keywords need at least 4 chars (tail/fuzzy); nicknames any non-empty.
 */
function shouldRemoteSearchMember(keyword) {
  const text = String(keyword || '').trim();
  if (!text) return false;
  if (/^\d+$/.test(text)) {
    return text.length >= ADMIN_MEMBER_SEARCH_MIN_DIGITS;
  }
  return true;
}

module.exports = {
  ADMIN_MEMBER_SEARCH_DEBOUNCE_MS,
  ADMIN_MEMBER_SEARCH_MIN_DIGITS,
  shouldRemoteSearchMember,
};
