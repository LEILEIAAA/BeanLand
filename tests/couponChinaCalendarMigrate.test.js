const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseYmdStartMs,
  parseYmdEndMs,
  CN_OFFSET_MS,
} = require('../miniprogram/utils/coupons');

function utcYmd(ts) {
  const d = new Date(Number(ts));
  const pad2 = (n) => String(n).padStart(2, '0');
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

test('migrateValidFrom shifts UTC midnight July 15 to China midnight', () => {
  const old = Date.UTC(2026, 6, 15);
  const migrated = migrateValidFrom(old);
  assert.equal(migrated.changed, true);
  assert.equal(migrated.next, Date.UTC(2026, 6, 15) - CN_OFFSET_MS);
  assert.equal(migrateValidFrom(migrated.next).changed, false);
});

test('migrateExpireAt shifts UTC end-of-day to China end-of-day', () => {
  const old = Date.UTC(2026, 6, 20, 23, 59, 59, 999);
  const migrated = migrateExpireAt(old);
  assert.equal(migrated.changed, true);
  assert.equal(migrated.next, Date.UTC(2026, 6, 20, 15, 59, 59, 999));
  assert.equal(migrateExpireAt(migrated.next).changed, false);
});
