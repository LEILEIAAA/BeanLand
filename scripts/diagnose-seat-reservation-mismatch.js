const path = require('path');
const { execFileSync } = require('child_process');

const TCB_JS = path.join(
  process.env.APPDATA || '',
  'npm',
  'node_modules',
  '@cloudbase',
  'cli',
  'bin',
  'tcb',
);
const ENV = 'cloudbase-d8gzrj9d3f09c5171';

function chinaToday() {
  const china = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const y = china.getUTCFullYear();
  const m = String(china.getUTCMonth() + 1).padStart(2, '0');
  const d = String(china.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function run(command) {
  return execFileSync(
    process.execPath,
    [TCB_JS, 'db', 'nosql', 'execute', '-e', ENV, '--command', JSON.stringify(command), '--json'],
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
}

function find(table, filter, limit = 200) {
  const raw = run([
    {
      TableName: table,
      CommandType: 'FIND',
      Command: JSON.stringify({ find: table, filter: filter || {}, limit }),
    },
  ]);
  return (((JSON.parse(raw).data || {}).results || [])[0]) || [];
}

const RELEASED = /^(no_show|cancelled|rejected|completed)$/;

function main() {
  const today = chinaToday();
  console.log('=== 中国时区今日:', today, '===\n');

  // appointments 两种日期字段都查
  const apptByAppointmentDate = find('appointments', { appointmentDate: today });
  const apptByDate = find('appointments', { date: today });
  const apptMap = new Map();
  [...apptByAppointmentDate, ...apptByDate].forEach((r) => apptMap.set(r._id, r));
  const appts = [...apptMap.values()];

  console.log('--- 今日 appointments 预约单 (' + appts.length + ' 条) ---');
  appts.forEach((a) => {
    console.log(
      [
        a._id,
        'status=' + (a.status || '?'),
        'seats=[' + ((a.seatIds || []).join(',')) + ']',
        'slots=[' + ((a.timeSlots || (a.timeSlot ? [a.timeSlot] : [])).join(',')) + ']',
        'member=' + (a.memberId || '-'),
        'name=' + (a.name || '-'),
      ].join(' | '),
    );
  });

  // seat_occupancies reserved / arrived today
  const reserved = find('seat_occupancies', { type: 'reserved', date: today });
  const arrived = find('seat_occupancies', { type: 'arrived', date: today });
  const occ = [...reserved, ...arrived];

  console.log('\n--- 今日 seat_occupancies reserved/arrived (' + occ.length + ' 条) ---');
  occ.forEach((o) => {
    console.log(
      [
        o._id,
        'type=' + o.type,
        'seat=' + (o.seatId || '?'),
        'slot=' + (o.timeSlot || '-'),
        'apptId=' + (o.appointmentId || '(空)'),
        'member=' + (o.memberId || '-'),
      ].join(' | '),
    );
  });

  // 复刻云函数 releasedIds 过滤逻辑
  const releasedIds = new Set(
    appts
      .filter((r) => RELEASED.test(String(r.status || '')))
      .map((r) => r._id)
      .filter(Boolean),
  );
  const activeOcc = occ.filter(
    (o) => !o.appointmentId || !releasedIds.has(o.appointmentId),
  );

  // 座位板"预约"计数 = reservationsBySeatId 的座位数(排除 in_use)
  // 这里先算 reservationsBySeatId 的候选座位集合
  const reservedSeatSet = new Set();
  // 来自 confirmed/arrived 预约单
  appts.forEach((a) => {
    const s = String(a.status || '');
    if (RELEASED.test(s)) return;
    if (!/confirmed|已确认|arrived|已到店/i.test(s)) return;
    (a.seatIds || []).forEach((seatId) => reservedSeatSet.add(seatId));
  });
  // 来自占用记录
  activeOcc.forEach((o) => {
    if (o.seatId) reservedSeatSet.add(o.seatId);
  });

  // in_use 座位(会覆盖 reserved,不计入预约数)
  const activeSessions = find('seat_sessions', { status: 'active' });
  const inUseSeats = new Set();
  activeSessions.forEach((sess) => {
    (sess.seatIds || []).forEach((seatId) => inUseSeats.add(seatId));
  });
  const reservedSeatsFinal = [...reservedSeatSet].filter((seatId) => !inUseSeats.has(seatId));

  console.log('\n=== 座位板"预约"计数推演 ===');
  console.log('候选预约座位(去 in_use 前):', [...reservedSeatSet].join(', ') || '(无)');
  console.log('in_use 座位:', [...inUseSeats].join(', ') || '(无)');
  console.log('>>> 座位板应显示"预约 N" =', reservedSeatsFinal.length, '座:', reservedSeatsFinal.join(', ') || '(无)');

  console.log('\n=== 预约管理各标签计数(全部日期口径见下) ===');
  console.log('注:预约管理不限日期,这里只统计今日单;完整对比需看全部日期');
  const byStatus = {};
  appts.forEach((a) => {
    const s = a.status || 'pending';
    byStatus[s] = (byStatus[s] || 0) + 1;
  });
  console.log('今日按状态:', JSON.stringify(byStatus));

  // 孤儿占用检测:occ 记录有 appointmentId 但对应单不在今日 appts,或 appointmentId 为空
  console.log('\n=== 孤儿占用检测(潜在 bug) ===');
  const orphans = activeOcc.filter((o) => {
    if (!o.appointmentId) return true; // 无 appointmentId
    return !apptMap.has(o.appointmentId); // appointmentId 找不到对应今日预约单
  });
  if (!orphans.length) {
    console.log('无孤儿占用记录。');
  } else {
    orphans.forEach((o) => {
      console.log(
        '孤儿:',
        o._id,
        'seat=' + o.seatId,
        'apptId=' + (o.appointmentId || '(空)'),
        o.appointmentId ? '(对应预约单今日不存在)' : '(无 appointmentId)',
      );
    });
  }
}

main();
