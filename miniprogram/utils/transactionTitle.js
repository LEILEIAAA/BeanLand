/**
 * Format member transaction title for display with typed prefixes:
 * 充值 … / 套餐 … / 活动 … / 套餐退款 … / 活动取消 …
 */

function rawTitle(tx) {
  if (!tx || typeof tx !== 'object') return '';
  const title = tx.title != null ? String(tx.title).trim() : '';
  if (title) return title;
  const reason = tx.reason != null ? String(tx.reason).trim() : '';
  return reason || '流水';
}

function isActivityText(text) {
  return /活动/.test(String(text || ''));
}

function stripPrefixes(text) {
  let s = String(text || '').trim();
  s = s.replace(/^活动报名取消\s*[·•\-—–]?\s*/u, '');
  s = s.replace(/^活动取消\s*/u, '');
  s = s.replace(/^活动报名\s*[·•\-—–]?\s*/u, '');
  s = s.replace(/^活动\s*/u, '');
  s = s.replace(/^套餐退款\s*/u, '');
  s = s.replace(/^套餐\s*/u, '');
  s = s.replace(/^充值\s*/u, '');
  s = s.replace(/^充\s*/u, '');
  return s.trim() || '流水';
}

function resolveTransactionTitle(tx) {
  const raw = rawTitle(tx);
  const type = tx && tx.type != null ? String(tx.type) : '';
  const detail = stripPrefixes(raw);
  const activity = isActivityText(raw) || !!(tx && tx.activityId);

  if (type === 'recharge') {
    return { typeLabel: '充值', typeKey: 'recharge', body: detail };
  }

  if (activity) {
    if (type === 'refund' || /取消/.test(raw)) {
      const body = detail === '流水' ? '' : detail;
      return { typeLabel: '活动取消', typeKey: 'activity_cancel', body };
    }
    return { typeLabel: '活动', typeKey: 'activity', body: detail };
  }

  if (type === 'refund' || /退款|退回/.test(raw)) {
    return { typeLabel: '套餐退款', typeKey: 'package_refund', body: detail };
  }

  return { typeLabel: '套餐', typeKey: 'package', body: detail };
}

function formatTransactionTitle(tx) {
  const { typeLabel, body } = resolveTransactionTitle(tx);
  return [typeLabel, body].filter(Boolean).join(' ');
}

module.exports = { formatTransactionTitle, resolveTransactionTitle };
