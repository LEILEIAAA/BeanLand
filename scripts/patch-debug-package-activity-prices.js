/**
 * Set all packages / activities prices to 0.01 for payment debugging.
 * Preserves other fields by FIND → merge price → DELETE+INSERT.
 * Usage: node scripts/patch-debug-package-activity-prices.js
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
const DEBUG_PRICE = 0.01;

if (!require('fs').existsSync(TCB_JS)) {
  console.error('tcb cli not found at', TCB_JS);
  process.exit(1);
}

function run(command) {
  return execFileSync(
    process.execPath,
    [TCB_JS, 'db', 'nosql', 'execute', '-e', ENV, '--command', JSON.stringify(command), '--json'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 },
  );
}

function extractJson(raw) {
  const text = String(raw || '');
  const start = text.indexOf('{');
  if (start < 0) throw new Error(`no json in output: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start));
}

function unwrapBson(value) {
  if (Array.isArray(value)) return value.map(unwrapBson);
  if (!value || typeof value !== 'object') return value;
  if (Object.prototype.hasOwnProperty.call(value, '$numberDouble')) {
    return Number(value.$numberDouble);
  }
  if (Object.prototype.hasOwnProperty.call(value, '$numberInt')) {
    return Number(value.$numberInt);
  }
  if (Object.prototype.hasOwnProperty.call(value, '$numberLong')) {
    return Number(value.$numberLong);
  }
  if (Object.prototype.hasOwnProperty.call(value, '$date')) {
    return value.$date;
  }
  const next = {};
  Object.keys(value).forEach((key) => {
    next[key] = unwrapBson(value[key]);
  });
  return next;
}

function findAll(collection) {
  const parsed = extractJson(
    run([
      {
        TableName: collection,
        CommandType: 'FIND',
        Command: JSON.stringify({ find: collection, limit: 100 }),
      },
    ]),
  );
  const results = parsed && parsed.data && parsed.data.results;
  const list = Array.isArray(results) ? results[0] : null;
  if (!Array.isArray(list)) {
    throw new Error(`unexpected FIND shape for ${collection}`);
  }
  return list.map(unwrapBson);
}

function deleteById(collection, id) {
  try {
    run([
      {
        TableName: collection,
        CommandType: 'DELETE',
        Command: JSON.stringify({
          delete: collection,
          deletes: [{ q: { _id: id }, limit: 1 }],
        }),
      },
    ]);
  } catch (error) {
    console.warn(`delete warn ${collection}/${id}`);
  }
}

function insert(collection, doc) {
  run([
    {
      TableName: collection,
      CommandType: 'INSERT',
      Command: JSON.stringify({
        insert: collection,
        documents: [doc],
      }),
    },
  ]);
}

function upsert(collection, doc) {
  const id = doc._id;
  deleteById(collection, id);
  insert(collection, doc);
  console.log(`upsert ${collection}/${id} price=${doc.price}`);
}

function patchPackages() {
  const rows = findAll('packages');
  if (!rows.length) throw new Error('no packages found in cloud');
  rows.forEach((row) => {
    const id = row._id || row.id;
    upsert('packages', {
      ...row,
      _id: String(id),
      id: row.id || String(id),
      price: DEBUG_PRICE,
      weekendPrice: DEBUG_PRICE,
      weekdayPrice: DEBUG_PRICE,
    });
  });
  return rows.length;
}

function patchActivities() {
  const rows = findAll('activities');
  if (!rows.length) throw new Error('no activities found in cloud');
  rows.forEach((row) => {
    const id = row._id || row.id;
    upsert('activities', {
      ...row,
      _id: String(id),
      id: row.id || String(id),
      price: DEBUG_PRICE,
    });
  });
  return rows.length;
}

const pkgCount = patchPackages();
const actCount = patchActivities();

const verifyPackages = extractJson(
  run([
    {
      TableName: 'packages',
      CommandType: 'FIND',
      Command: JSON.stringify({ find: 'packages', limit: 20 }),
    },
  ]),
);
const verifyActivities = extractJson(
  run([
    {
      TableName: 'activities',
      CommandType: 'FIND',
      Command: JSON.stringify({ find: 'activities', limit: 20 }),
    },
  ]),
);

const pkgPrices = (verifyPackages.data.results[0] || []).map((row) => ({
  id: row.id || row._id,
  price: unwrapBson(row.price),
  weekendPrice: unwrapBson(row.weekendPrice),
  weekdayPrice: unwrapBson(row.weekdayPrice),
}));
const actPrices = (verifyActivities.data.results[0] || []).map((row) => ({
  id: row.id || row._id,
  price: unwrapBson(row.price),
}));

console.log('verify packages', JSON.stringify(pkgPrices, null, 2));
console.log('verify activities', JSON.stringify(actPrices, null, 2));
console.log(`done: packages=${pkgCount}, activities=${actCount}, debugPrice=${DEBUG_PRICE}`);

const badPkg = pkgPrices.find(
  (row) => row.price !== DEBUG_PRICE || row.weekendPrice !== DEBUG_PRICE || row.weekdayPrice !== DEBUG_PRICE,
);
const badAct = actPrices.find((row) => row.price !== DEBUG_PRICE);
if (badPkg || badAct) {
  console.error('verify failed', { badPkg, badAct });
  process.exit(1);
}
