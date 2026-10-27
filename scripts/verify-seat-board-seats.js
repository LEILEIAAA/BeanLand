/** Verify adminListSeatBoard seat-loading path against cloud DB. */
const path = require('path');
const { execFileSync } = require('child_process');
const { buildSeatsFromTables } = require('../cloudfunctions/adminListSeatBoard/seats');

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

function run(command) {
  return execFileSync(
    process.execPath,
    [TCB_JS, 'db', 'nosql', 'execute', '-e', ENV, '--command', JSON.stringify(command), '--json'],
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
}

function find(table, limit = 200) {
  const raw = run([
    {
      TableName: table,
      CommandType: 'FIND',
      Command: JSON.stringify({ find: table, filter: {}, limit }),
    },
  ]);
  return (((JSON.parse(raw).data || {}).results || [])[0]) || [];
}

function unwrapNumber(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object') {
    if (value.$numberInt != null) return Number(value.$numberInt);
    if (value.$numberLong != null) return Number(value.$numberLong);
    if (value.$numberDouble != null) return Number(value.$numberDouble);
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeSeatRow(row) {
  if (!row) return null;
  const id = row.id || row._id || '';
  if (!id) return null;
  return {
    id,
    tableCode: row.tableCode || '',
    area: row.area || '',
    index: unwrapNumber(row.index),
    capacity: unwrapNumber(row.capacity),
    maintenance: !!row.maintenance,
  };
}

function loadSeatList() {
  const fromSeats = find('seats', 200).map(normalizeSeatRow).filter(Boolean);
  if (fromSeats.length) return fromSeats;
  const tables = find('tables', 50).map((t) => ({
    ...t,
    capacity: unwrapNumber(t.capacity),
  }));
  if (!tables.length) return [];
  return buildSeatsFromTables(tables, { seatIdSeparator: '' })
    .map(normalizeSeatRow)
    .filter(Boolean);
}

const seats = loadSeatList();
console.log('seats', seats.length);
console.log(
  'sample',
  seats.slice(0, 3).map((s) => `${s.id}/${s.tableCode}/idx=${s.index}`),
);
if (seats.length !== 35) {
  process.exitCode = 1;
  console.error('EXPECTED 35 seats');
}
