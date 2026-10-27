// 选座预约·场次/时段纯逻辑
// 场次：全天畅玩不限时 | 自选时段（1 小时起、连续）。营业 10:00-22:00。
const { toggleContiguousSelection } = require('./timeSlots');

const BUSINESS_HOURS = { open: '10:00', close: '22:00' };

const SESSION_TYPES = {
  ALL_DAY: 'all_day',
  CUSTOM: 'custom',
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function hourToMin(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (!Number.isFinite(h)) return NaN;
  return h * 60 + (Number(m) || 0);
}

function minToHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad(h)}:${pad(m)}`;
}

// 生成整点小时时段：['10:00-11:00', ... '21:00-22:00']
function buildHourSlots(open = BUSINESS_HOURS.open, close = BUSINESS_HOURS.close) {
  const slots = [];
  let start = hourToMin(open);
  const end = hourToMin(close);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return slots;
  while (start + 60 <= end) {
    slots.push(`${minToHHMM(start)}-${minToHHMM(start + 60)}`);
    start += 60;
  }
  return slots;
}

// 全天场次实际锁定的时段：从现在到打烊之间所有还没结束的整点（非当日 nowMin = -1 → 整天）
function allDaySlots(open = BUSINESS_HOURS.open, close = BUSINESS_HOURS.close, nowMin = -1) {
  return buildHourSlots(open, close).filter((slot) => {
    if (!(nowMin >= 0)) return true;
    return hourToMin(String(slot).split('-')[1]) > nowMin;
  });
}

// 自选时段：复用连续选择算法（按整点）
function toggleHour(hourSlots, selectedIndexes, tapIndex) {
  return toggleContiguousSelection(hourSlots, selectedIndexes, tapIndex);
}

function slotsFromIndexes(hourSlots, indexes) {
  return [...(indexes || [])]
    .map(Number)
    .sort((a, b) => a - b)
    .map((i) => hourSlots[i])
    .filter(Boolean);
}

function spanLabel(slots) {
  const list = Array.isArray(slots) ? slots.filter(Boolean) : [];
  if (!list.length) return '';
  const first = String(list[0]).split('-')[0];
  const last = String(list[list.length - 1]).split('-')[1];
  return `${first}-${last}`;
}

function durationHours(slots) {
  const list = Array.isArray(slots) ? slots.filter(Boolean) : [];
  return list.length;
}

// 解析所选场次 → 具体时段 + 文案
function resolveSession(sessionType, { open = BUSINESS_HOURS.open, close = BUSINESS_HOURS.close, customSlots, nowMin = -1 } = {}) {
  if (sessionType === SESSION_TYPES.ALL_DAY) {
    const slots = allDaySlots(open, close, nowMin);
    if (!slots.length) return { ok: false, reason: '今日已打烊' };
    const start = String(slots[0]).split('-')[0];
    return { ok: true, sessionType, slots, label: '全天畅玩', span: `${start}-${close}` };
  }
  if (sessionType === SESSION_TYPES.CUSTOM) {
    const slots = Array.isArray(customSlots) ? customSlots.filter(Boolean) : [];
    if (!slots.length) return { ok: false, reason: '请选择时段' };
    return { ok: true, sessionType, slots, label: spanLabel(slots), span: spanLabel(slots) };
  }
  return { ok: false, reason: '请选择场次' };
}

// 今日概况时间轴：每个整点格的状态（空闲/已占用/已结束）
function hourTimelineStates(hourSlots, { bookedSlotSet = new Set(), nowMin = -1 } = {}) {
  const booked = bookedSlotSet instanceof Set ? bookedSlotSet : new Set(bookedSlotSet || []);
  return (hourSlots || []).map((slot) => {
    const [startLabel, endLabel] = String(slot).split('-');
    const startMin = hourToMin(startLabel);
    const endMin = hourToMin(endLabel);
    let state = 'free';
    if (booked.has(slot)) {
      state = 'booked';
    } else if (nowMin >= 0 && nowMin >= endMin) {
      state = 'ended';
    }
    return { slot, startLabel, endLabel, startMin, endMin, state };
  });
}

// 单个整点是否可选（未占用且未结束）
function isHourSelectable(slot, { bookedSlotSet = new Set(), nowMin = -1 } = {}) {
  const booked = bookedSlotSet instanceof Set ? bookedSlotSet : new Set(bookedSlotSet || []);
  if (booked.has(slot)) return false;
  const endMin = hourToMin(String(slot).split('-')[1]);
  if (nowMin >= 0 && nowMin >= endMin) return false;
  return true;
}

// 全天场次是否还可预约：打烊前还没结束的整点至少有一个，且全部未被占用（已过去的整点不影响）
function isAllDayAvailable(hourSlots, bookedSlotSet = new Set(), nowMin = -1) {
  const booked = bookedSlotSet instanceof Set ? bookedSlotSet : new Set(bookedSlotSet || []);
  const remaining = (hourSlots || []).filter((slot) => {
    if (!(nowMin >= 0)) return true;
    return hourToMin(String(slot).split('-')[1]) > nowMin;
  });
  return remaining.length > 0 && remaining.every((slot) => !booked.has(slot));
}

function nowMinutesInChina(now = Date.now()) {
  const china = new Date(now + 8 * 60 * 60 * 1000);
  return china.getUTCHours() * 60 + china.getUTCMinutes();
}

// 核销码：BEAN-1234（seed 可稳定复现，缺省随机）
function buildRedemptionCode(prefix = 'BEAN', seed) {
  let n = Number(seed);
  if (!Number.isFinite(n)) {
    n = Math.floor(Math.random() * 10000);
  }
  const digits = pad4(Math.abs(Math.floor(n)) % 10000);
  return `${prefix}-${digits}`;
}

function pad4(value) {
  return String(value).padStart(4, '0');
}

// 订单编号：BK + 日期 + 4 位序号
function buildOrderNo(dateIso, seq = 1) {
  const d = String(dateIso || '').replace(/-/g, '');
  return `BK${d}${pad4(seq)}`;
}

function isValidSessionType(sessionType) {
  return sessionType === SESSION_TYPES.ALL_DAY || sessionType === SESSION_TYPES.CUSTOM;
}

module.exports = {
  BUSINESS_HOURS,
  SESSION_TYPES,
  hourToMin,
  minToHHMM,
  buildHourSlots,
  allDaySlots,
  toggleHour,
  slotsFromIndexes,
  spanLabel,
  durationHours,
  resolveSession,
  hourTimelineStates,
  isHourSelectable,
  isAllDayAvailable,
  nowMinutesInChina,
  buildRedemptionCode,
  buildOrderNo,
  isValidSessionType,
};
