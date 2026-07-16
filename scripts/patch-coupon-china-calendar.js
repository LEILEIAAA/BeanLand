/**
 * 将历史优惠券 validFrom/expireAt 从「云函数 UTC 本地日」纠偏为「中国自然日」。
 * 幂等：已是中国自然日边界的记录会跳过。
 *
 * Usage: node scripts/patch-coupon-china-calendar.js
 */
const path = require('path');
const { execFileSync } = require('child_process');
const {
  parseYmdStartMs,
  parseYmdEndMs,
} = require('../miniprogram/utils/coupons');

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

function pad2(n) {
  return String(n).padStart(2, '0');
}

function run(command) {
  return execFileSync(
    process.execPath,
    [TCB_JS, 'db', 'nosql', 'execute', '-e', ENV, '--command', JSON.stringify(command), '--json'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 },
  );
}

function utcYmd(ts) {
  const d = new Date(Number(ts));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function migrateValidFrom(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return { next: n, changed: false };
  const asUtcMidnight = Date.UTC(
    new Date(n).getUTCFullYear(),
    new Date(n).getUTCMonth(),
    new Date(n).getUTCDate(),
  );
  if (n !== asUtcMidnight) return { next: n, changed: false };
  const next = parseYmdStartMs(utcYmd(n));
  return { next, changed: next !== n };
}

function migrateExpireAt(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return { next: n, changed: false };
  const d = new Date(n);
  if (!(d.getUTCHours() === 23 && d.getUTCMinutes() === 59)) {
    return { next: n, changed: false };
  }
  const next = parseYmdEndMs(utcYmd(n));
  return { next, changed: next !== n };
}

function listCoupons() {
  const raw = run([
    {
      TableName: 'user_coupons',
      CommandType: 'FIND',
      Command: JSON.stringify({ find: 'user_coupons', limit: 500 }),
    },
  ]);
  const parsed = JSON.parse(raw);
  const rows = ((((parsed || {}).data || {}).results || [])[0]) || [];
  return rows;
}

function updateCoupon(id, patch) {
  return run([
    {
      TableName: 'user_coupons',
      CommandType: 'UPDATE',
      Command: JSON.stringify({
        update: 'user_coupons',
        updates: [{ q: { _id: id }, u: { $set: patch } }],
      }),
    },
  ]);
}

const rows = listCoupons();
let changed = 0;
let skipped = 0;

for (const row of rows) {
  const id = row._id;
  const from = migrateValidFrom(row.validFrom && row.validFrom.$numberDouble
    ? Number(row.validFrom.$numberDouble)
    : row.validFrom && row.validFrom.$numberLong
      ? Number(row.validFrom.$numberLong)
      : row.validFrom);
  const to = migrateExpireAt(row.expireAt && row.expireAt.$numberDouble
    ? Number(row.expireAt.$numberDouble)
    : row.expireAt && row.expireAt.$numberLong
      ? Number(row.expireAt.$numberLong)
      : row.expireAt);

  if (!from.changed && !to.changed) {
    skipped += 1;
    continue;
  }

  const patch = { updatedAt: Date.now() };
  if (from.changed) patch.validFrom = from.next;
  if (to.changed) patch.expireAt = to.next;

  console.log(`patch ${id}`, {
    validFrom: from.changed ? `${row.validFrom} -> ${from.next}` : 'keep',
    expireAt: to.changed ? `${row.expireAt} -> ${to.next}` : 'keep',
  });
  updateCoupon(id, patch);
  changed += 1;
}

console.log(JSON.stringify({ total: rows.length, changed, skipped }, null, 2));
