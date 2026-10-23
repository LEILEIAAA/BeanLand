/**
 * 数据修复：把「已标记 arrived 但实际未开台」的预约单回退为 confirmed。
 * 判定：status=arrived 且其 seatIds 未出现在任何 active seat_session 的 seatIds 中。
 * 用法：node scripts/patch-arrived-not-opened-to-confirmed.js [--apply]
 * 默认 dry-run，仅打印；加 --apply 才真正写库。
 */
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
const APPLY = process.argv.includes('--apply');

function run(command) {
  return execFileSync(
    process.execPath,
    [TCB_JS, 'db', 'nosql', 'execute', '-e', ENV, '--command', JSON.stringify(command), '--json'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 },
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

function main() {
  const arrivedAppts = find('appointments', { status: 'arrived' });
  const activeSessions = find('seat_sessions', { status: 'active' });
  const inUseSeats = new Set();
  activeSessions.forEach((s) => (s.seatIds || []).forEach((id) => inUseSeats.add(id)));

  console.log('arrived 单:', arrivedAppts.length, '| active session 座位:', [...inUseSeats].join(',') || '(无)');

  const toRevert = arrivedAppts.filter((a) => {
    const seats = a.seatIds || [];
    // 任一座位在 active session → 视为已开台，不回退
    const opened = seats.some((id) => inUseSeats.has(id));
    return !opened;
  });

  if (!toRevert.length) {
    console.log('无需回退的 arrived 单。');
    return;
  }

  toRevert.forEach((a) => {
    console.log(
      '待回退:',
      a._id,
      'seats=[' + (a.seatIds || []).join(',') + ']',
      'date=' + (a.appointmentDate || a.date || '-'),
      'name=' + (a.name || '-'),
    );
  });

  if (!APPLY) {
    console.log('\n[dry-run] 未写库。确认无误后加 --apply 执行。');
    return;
  }

  toRevert.forEach((a) => {
    const out = run([
      {
        TableName: 'appointments',
        CommandType: 'UPDATE',
        Command: JSON.stringify({
          update: 'appointments',
          updates: [
            {
              q: { _id: a._id },
              u: {
                $set: { status: 'confirmed', updatedAt: Date.now() },
                $unset: { arrivedAt: '' },
              },
              multi: false,
            },
          ],
        }),
      },
    ]);
    console.log('已回退', a._id, out.trim());
  });
}

main();
