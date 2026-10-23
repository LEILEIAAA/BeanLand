const { isRegistrationComplete } = require('./memberProfile');

const REGISTER_ROUTE = 'pages/member/register/index';
const REGISTER_URL = `/${REGISTER_ROUTE}`;

let pendingOpen = false;

function needsMemberRegister(member, defaultAvatar) {
  return !isRegistrationComplete(member, defaultAvatar);
}

function normalizeRoute(route) {
  if (!route) return '';
  return String(route).replace(/^\//, '');
}

function isRegisterPageOpen(pages) {
  const list = Array.isArray(pages) ? pages : [];
  return list.some((page) => {
    if (!page) return false;
    return (
      normalizeRoute(page.route) === REGISTER_ROUTE ||
      normalizeRoute(page.__route__) === REGISTER_ROUTE
    );
  });
}

function resolvePages(getPagesFn) {
  if (typeof getPagesFn === 'function') {
    return getPagesFn();
  }
  if (typeof getCurrentPages === 'function') {
    return getCurrentPages();
  }
  return [];
}

function resolveWxApi(wxApi) {
  if (wxApi) return wxApi;
  if (typeof wx !== 'undefined') return wx;
  return null;
}

/**
 * Open member register page at most once while a jump is in flight
 * or the register page is already on the stack.
 * Navigate fail clears the lock immediately so callers can retry.
 * @param {{ replace?: boolean, wxApi?: object, getCurrentPages?: Function, lockMs?: number }} [options]
 * @returns {boolean}
 */
function openMemberRegister(options) {
  const opts = options || {};
  const pages = resolvePages(opts.getCurrentPages);
  if (isRegisterPageOpen(pages) || pendingOpen) {
    return false;
  }

  const wxApi = resolveWxApi(opts.wxApi);
  const method = opts.replace ? 'redirectTo' : 'navigateTo';
  const navigate =
    wxApi && typeof wxApi[method] === 'function' ? wxApi[method].bind(wxApi) : null;
  if (!navigate) {
    return false;
  }

  const lockMs = typeof opts.lockMs === 'number' ? opts.lockMs : 400;
  pendingOpen = true;
  let opened = false;

  navigate({
    url: REGISTER_URL,
    success() {
      opened = true;
    },
    fail() {
      pendingOpen = false;
    },
    complete() {
      if (!opened) {
        pendingOpen = false;
        return;
      }
      if (lockMs <= 0) {
        pendingOpen = false;
        return;
      }
      setTimeout(() => {
        pendingOpen = false;
      }, lockMs);
    },
  });
  return true;
}

function resetMemberRegisterOpenState() {
  pendingOpen = false;
}

module.exports = {
  REGISTER_URL,
  REGISTER_ROUTE,
  needsMemberRegister,
  openMemberRegister,
  resetMemberRegisterOpenState,
  isRegisterPageOpen,
};
