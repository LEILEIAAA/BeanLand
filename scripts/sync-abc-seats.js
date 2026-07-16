const { spawnSync } = require('child_process');
const path = require('path');
const { buildSeatsFromTables } = require('../miniprogram/utils/seats');

const tcbBin =
  'C:/Users/ry/AppData/Roaming/npm/node_modules/@cloudbase/cli/bin/tcb';

function runNosql(command) {
  const result = spawnSync(
    process.execPath,
    [tcbBin, 'db', 'nosql', 'execute', '--command', JSON.stringify(command), '--json'],
    { encoding: 'utf8', cwd: path.resolve(__dirname, '..') },
  );
  const text = `${result.stdout || ''}\n${result.stderr || ''}`;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) {
    console.error(text);
    throw new Error(`nosql execute failed (status=${result.status})`);
  }
  const parsed = JSON.parse(text.slice(start, end + 1));
  if (parsed.error) {
    throw new Error(JSON.stringify(parsed.error));
  }
  return parsed;
}

function queryIds(tableName) {
  const parsed = runNosql([
    {
      TableName: tableName,
      CommandType: 'QUERY',
      Command: JSON.stringify({
        find: tableName,
        filter: {},
        projection: { _id: 1 },
        limit: 200,
      }),
    },
  ]);
  const rows =
    (parsed.data && parsed.data.results && parsed.data.results[0]) || [];
  return rows.map((row) => row._id).filter(Boolean);
}

function deleteByIds(tableName, ids) {
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    runNosql([
      {
        TableName: tableName,
        CommandType: 'DELETE',
        Command: JSON.stringify({
          delete: tableName,
          deletes: chunk.map((id) => ({ q: { _id: id }, limit: 1 })),
        }),
      },
    ]);
  }
}

const tables = [
  { code: 'F1-A', area: 'F1一楼·左墙', capacity: 6, bookable: true },
  { code: 'F1-B', area: 'F1一楼·窗边', capacity: 2, bookable: true },
  { code: 'F1-C', area: 'F1一楼·长桌', capacity: 6, bookable: true },
  { code: 'F2-A', area: 'F2二楼·左墙', capacity: 6, bookable: true },
  { code: 'F2-B', area: 'F2二楼·右墙', capacity: 6, bookable: true },
  { code: 'F2-C', area: 'F2二楼·长桌', capacity: 6, bookable: true },
];
const seats = buildSeatsFromTables(tables, { seatIdSeparator: '' });

const oldTableIds = queryIds('tables');
const oldSeatIds = queryIds('seats');
console.log('delete tables', oldTableIds.length, 'seats', oldSeatIds.length);
deleteByIds('tables', oldTableIds);
deleteByIds('seats', oldSeatIds);

runNosql([
  {
    TableName: 'tables',
    CommandType: 'INSERT',
    Command: JSON.stringify({
      insert: 'tables',
      documents: tables.map((t) => ({ _id: t.code, ...t })),
    }),
  },
]);

runNosql([
  {
    TableName: 'seats',
    CommandType: 'INSERT',
    Command: JSON.stringify({
      insert: 'seats',
      documents: seats.map((s) => ({ _id: s.id, ...s })),
    }),
  },
]);

const check = runNosql([
  {
    TableName: 'seats',
    CommandType: 'QUERY',
    Command: JSON.stringify({ find: 'seats', filter: { id: 'F1-A1' }, limit: 1 }),
  },
]);
const found =
  (check.data && check.data.results && check.data.results[0]) || [];
console.log('inserted tables', tables.length, 'seats', seats.length);
console.log('check F1-A1', found[0] && found[0].id);
