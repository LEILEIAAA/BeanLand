const { formatSlotSpan } = require('./timeSlots');

const STATUS = {
  pending: 'pending',
  confirmed: 'confirmed',
  rejected: 'rejected',
  cancelled: 'cancelled',
  arrived: 'arrived',
  no_show: 'no_show',
  completed: 'completed',
};

const STATUS_LABEL = {
  pending: '待商家确认',
  confirmed: '已确认',
  rejected: '已拒绝',
  cancelled: '已取消',
  arrived: '已到店',
  no_show: '未到店',
  completed: '已完成',
};

/** 预约开始后座位保留分钟数，超时未到标未到店 */
const HOLD_MINUTES = 15;

/** 店主拒绝预约快捷原因（可再手改） */
const REJECT_REASON_PRESETS = ['时段已满', '人数超限', '临时闭店', '其他'];
const REJECT_REASON_MAX_LEN = 80;

const TRANSITIONS = {
  confirm: [STATUS.pending],
  reject: [STATUS.pending],
  cancel: [STATUS.pending],
  adminCancel: [STATUS.confirmed],
  // arrived 仅由开台触发（resolveArriveOnStart），不提供手动 arrive 转换
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function addDaysIso(isoDate, days) {
  const [y, m, d] = String(isoDate || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const utc = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000;
  const dt = new Date(utc);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function allowedRegisterDates(today) {
  return [today, addDaysIso(today, 1)].filter(Boolean);
}

function normalizePhone(phone) {
  let digits = String(phone || '')
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/\D/g, '');
  if (digits.length >= 13 && digits.startsWith('86')) {
    const local = digits.slice(2);
    if (/^1[3-9]\d{9}$/.test(local)) digits = local;
  }
  return digits;
}

function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(normalizePhone(phone));
}

function assertCanRegister({
  appointmentDate,
  today,
  timeSlots,
  peopleCount,
  name,
  phone,
  source,
}) {
  const allowed = allowedRegisterDates(today);
  if (!appointmentDate || !allowed.includes(appointmentDate)) {
    return { ok: false, reason: '只能预约今天或明天' };
  }
  if (!Array.isArray(timeSlots) || !timeSlots.length) {
    return { ok: false, reason: '请选择时段' };
  }
  const people = Number(peopleCount);
  if (!Number.isInteger(people) || people < 1 || people > 6) {
    return { ok: false, reason: '人数需在 1-6 之间' };
  }
  if (!String(name || '').trim()) {
    return { ok: false, reason: '请填写姓名' };
  }
  if (!isValidPhone(phone)) {
    return { ok: false, reason: '手机号格式不正确' };
  }
  if (!String(source || '').trim()) {
    return { ok: false, reason: '请选择来源' };
  }
  return { ok: true };
}

function assertCanTransition(status, action) {
  const allowed = TRANSITIONS[action] || [];
  if (!allowed.includes(status)) {
    return { ok: false, reason: '当前状态不可执行该操作' };
  }
  return { ok: true };
}

function deriveTableCode(seatIds) {
  if (!Array.isArray(seatIds) || !seatIds.length) return '';
  const tables = [];
  for (const id of seatIds) {
    const match = String(id || '').match(/^(.*?)(\d+)$/);
    const table = match ? match[1] : String(id || '');
    if (table && !tables.includes(table)) tables.push(table);
  }
  return tables.join('/');
}

function buildRegistrationDoc({
  openid,
  memberId,
  appointmentDate,
  timeSlots,
  peopleCount,
  name,
  phone,
  source,
  now,
}) {
  const slots = Array.isArray(timeSlots) ? timeSlots.slice() : [];
  return {
    _openid: openid,
    memberId: memberId || '',
    name: String(name || '').trim(),
    phone: normalizePhone(phone),
    appointmentDate,
    timeSlots: slots,
    timeSlot: formatSlotSpan(slots),
    peopleCount: Number(peopleCount),
    source: String(source || '').trim(),
    status: STATUS.pending,
    seatIds: [],
    tableCode: '',
    createdAt: now,
    updatedAt: now,
  };
}

function buildConfirmFields({ seatIds, peopleCount, now }) {
  const ids = Array.isArray(seatIds) ? seatIds.filter(Boolean) : [];
  const people = Number(peopleCount);
  if (ids.length !== people) {
    return {
      ok: false,
      reason: `需选择 ${people} 个座位（当前 ${ids.length} 个）`,
    };
  }
  if (new Set(ids).size !== ids.length) {
    return { ok: false, reason: '座位不能重复' };
  }
  return {
    ok: true,
    fields: {
      status: STATUS.confirmed,
      seatIds: ids,
      tableCode: deriveTableCode(ids),
      confirmedAt: now,
      updatedAt: now,
    },
  };
}

function normalizeRejectReason(reason) {
  return String(reason || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function assertRejectReason(reason) {
  const text = normalizeRejectReason(reason);
  if (!text) {
    return { ok: false, reason: '请填写拒绝原因' };
  }
  if (text.length > REJECT_REASON_MAX_LEN) {
    return { ok: false, reason: `拒绝原因不超过 ${REJECT_REASON_MAX_LEN} 字` };
  }
  return { ok: true, rejectReason: text };
}

function buildRejectFields({ rejectReason, now }) {
  const gate = assertRejectReason(rejectReason);
  if (!gate.ok) return gate;
  const ts = Number(now) || 0;
  return {
    ok: true,
    fields: {
      status: STATUS.rejected,
      rejectReason: gate.rejectReason,
      rejectedAt: ts,
      updatedAt: ts,
    },
  };
}

function occupancyDocId(date, timeSlot, seatId) {
  return `${date}_${timeSlot}_${seatId}`;
}

function buildOccupancyDocs({
  appointmentId,
  appointmentDate,
  timeSlots,
  seatIds,
  type,
  now,
}) {
  const slots = Array.isArray(timeSlots) ? timeSlots : [];
  const seats = Array.isArray(seatIds) ? seatIds : [];
  const docs = [];
  for (const seatId of seats) {
    for (const timeSlot of slots) {
      docs.push({
        _id: occupancyDocId(appointmentDate, timeSlot, seatId),
        date: appointmentDate,
        timeSlot,
        seatId,
        type,
        appointmentId: appointmentId || '',
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return docs;
}

/** 开台成功时把预约打成已到店：confirmed→更新，arrived→跳过 */
function resolveArriveOnStart(status, now) {
  if (status === STATUS.arrived) {
    return { ok: true, shouldUpdate: false };
  }
  if (status === STATUS.confirmed) {
    return {
      ok: true,
      shouldUpdate: true,
      fields: {
        status: STATUS.arrived,
        arrivedAt: now,
        updatedAt: now,
      },
    };
  }
  return { ok: false, reason: '仅已确认预约可在开台时转为已到店' };
}

function normalizeApptTimeSlots(appt) {
  if (!appt) return [];
  if (Array.isArray(appt.timeSlots) && appt.timeSlots.length) {
    return appt.timeSlots;
  }
  if (appt.timeSlot) return [appt.timeSlot];
  return [];
}

/** 首段开始时间 + HOLD_MINUTES → 截止毫秒；无效则 0 */
function resolveNoShowDeadline(appointmentDate, timeSlots) {
  const slots = Array.isArray(timeSlots) ? timeSlots : [];
  if (!appointmentDate || !slots.length) return 0;
  const startLabel = String(slots[0] || '').split('-')[0];
  if (!startLabel) return 0;
  const [hour, minute] = startLabel.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return 0;
  const startMs = new Date(
    `${appointmentDate}T${pad(hour)}:${pad(minute)}:00+08:00`,
  ).getTime();
  if (!Number.isFinite(startMs)) return 0;
  return startMs + HOLD_MINUTES * 60 * 1000;
}

/** 末段结束时间 → 毫秒；无效则 0 */
function resolveSlotEndMs(appointmentDate, timeSlots) {
  const slots = Array.isArray(timeSlots) ? timeSlots : [];
  if (!appointmentDate || !slots.length) return 0;
  const endLabel = String(slots[slots.length - 1] || '').split('-')[1];
  if (!endLabel) return 0;
  const [hour, minute] = endLabel.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return 0;
  const endMs = new Date(
    `${appointmentDate}T${pad(hour)}:${pad(minute)}:00+08:00`,
  ).getTime();
  if (!Number.isFinite(endMs)) return 0;
  return endMs;
}

/** 已到店但时段已结束、仍占座 → 应释放 */
function shouldReleaseArrivedHold(appt, now) {
  if (!appt || appt.status !== STATUS.arrived) return false;
  const date = appt.appointmentDate || appt.date;
  const endMs = resolveSlotEndMs(date, normalizeApptTimeSlots(appt));
  if (!endMs) return false;
  return Number(now) >= endMs;
}

function buildCompletedFields(now) {
  const ts = Number(now) || 0;
  return {
    status: STATUS.completed,
    seatIds: [],
    tableCode: '',
    completedAt: ts,
    updatedAt: ts,
  };
}

function shouldMarkNoShow(appt, now) {
  if (!appt || appt.status !== STATUS.confirmed) return false;
  const date = appt.appointmentDate || appt.date;
  const deadline = resolveNoShowDeadline(date, normalizeApptTimeSlots(appt));
  if (!deadline) return false;
  return Number(now) >= deadline;
}

function buildNoShowFields(now) {
  const ts = Number(now) || 0;
  return {
    status: STATUS.no_show,
    noShowAt: ts,
    cancelReason: 'timeout',
    seatIds: [],
    tableCode: '',
    updatedAt: ts,
  };
}

/** 店主代为取消已确认预约 */
function buildAdminCancelFields(now) {
  const ts = Number(now) || 0;
  return {
    status: STATUS.cancelled,
    cancelledAt: ts,
    cancelReason: 'merchant',
    seatIds: [],
    tableCode: '',
    updatedAt: ts,
  };
}

module.exports = {
  STATUS,
  STATUS_LABEL,
  HOLD_MINUTES,
  REJECT_REASON_PRESETS,
  REJECT_REASON_MAX_LEN,
  allowedRegisterDates,
  addDaysIso,
  normalizePhone,
  isValidPhone,
  assertCanRegister,
  assertCanTransition,
  buildRegistrationDoc,
  buildConfirmFields,
  assertRejectReason,
  buildRejectFields,
  buildOccupancyDocs,
  occupancyDocId,
  deriveTableCode,
  resolveArriveOnStart,
  resolveNoShowDeadline,
  resolveSlotEndMs,
  shouldMarkNoShow,
  shouldReleaseArrivedHold,
  buildNoShowFields,
  buildCompletedFields,
  buildAdminCancelFields,
};
