/**
 * Import seed JSON into CloudBase document DB via tcb CLI.
 * Usage: node scripts/import-seed-to-cloudbase.js
 */
const fs = require('fs');
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
const ENV_ID = 'cloudbase-d8gzrj9d3f09c5171';
const seedDir = path.join(__dirname, 'cloudbase-seed-export');

const COLLECTIONS = [
  { file: 'store.json', collection: 'store' },
  { file: 'packages.json', collection: 'packages', idField: 'id' },
  { file: 'activities.json', collection: 'activities', idField: 'id' },
  { file: 'tables.json', collection: 'tables', idField: 'code' },
  { file: 'seats.json', collection: 'seats', idField: 'id' },
  { file: 'time_slots.json', collection: 'time_slots' },
  { file: 'recharge_plans.json', collection: 'recharge_plans', idField: 'id' },
  { file: 'stamp_rules.json', collection: 'stamp_rules' },
  { file: 'seat_occupancies.json', collection: 'seat_occupancies', occupancyId: true },
  { file: 'member_tier_rules.json', collection: 'member_tier_rules' },
  { file: 'pay_config.json', collection: 'pay_config' },
];

const EMPTY_COLLECTIONS = [
  'members',
  'member_transactions',
  'admins',
  'appointments',
  'recharge_orders',
  'package_orders',
  'activity_registrations',
  'works',
  'user_coupons',
];

function normalizeDocs(docs, options = {}) {
  return docs.map((doc) => {
    const next = { ...doc };
    if (!next._id && options.idField && next[options.idField] != null) {
      next._id = String(next[options.idField]);
    }
    if (!next._id && options.occupancyId) {
      next._id = `${next.date}_${next.timeSlot}_${next.seatId}`;
    }
    return next;
  });
}

function runInsert(collection, documents) {
  if (!documents.length) {
    console.log(`skip empty: ${collection}`);
    return;
  }

  const command = [
    {
      TableName: collection,
      CommandType: 'INSERT',
      Command: JSON.stringify({
        insert: collection,
        documents,
      }),
    },
  ];

  const commandJson = JSON.stringify(command);
  console.log(`import ${collection}: ${documents.length} docs`);
  try {
    const out = execFileSync(
      process.execPath,
      [TCB_JS, 'db', 'nosql', 'execute', '-e', ENV_ID, '--command', commandJson, '--json'],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 },
    );
    console.log(out.trim() || 'ok');
  } catch (err) {
    const stderr = (err.stderr && String(err.stderr)) || '';
    const stdout = (err.stdout && String(err.stdout)) || '';
    console.error(`FAIL ${collection}:`, stderr || stdout || err.message);
    throw err;
  }
}

function ensureEmptyCollection(collection) {
  // Insert then delete a bootstrap doc so the collection exists.
  const bootstrapId = `__bootstrap_${Date.now()}`;
  runInsert(collection, [{ _id: bootstrapId, __bootstrap: true }]);
  const command = [
    {
      TableName: collection,
      CommandType: 'DELETE',
      Command: JSON.stringify({
        delete: collection,
        deletes: [{ q: { _id: bootstrapId }, limit: 1 }],
      }),
    },
  ];
  execFileSync(
    process.execPath,
    [TCB_JS, 'db', 'nosql', 'execute', '-e', ENV_ID, '--command', JSON.stringify(command), '--json'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
  console.log(`ensured empty collection: ${collection}`);
}

function main() {
  for (const item of COLLECTIONS) {
    const filePath = path.join(seedDir, item.file);
    const docs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    runInsert(item.collection, normalizeDocs(docs, item));
  }

  for (const name of EMPTY_COLLECTIONS) {
    ensureEmptyCollection(name);
  }

  console.log('seed import done');
}

main();
