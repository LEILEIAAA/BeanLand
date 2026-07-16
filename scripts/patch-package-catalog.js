/**
 * Replace CloudBase packages catalog + store.packagePromo for dual-price opening offer.
 * Usage: node scripts/patch-package-catalog.js
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
const ENV = 'cloudbase-d8gzrj9d3f09c5171';
const packages = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'cloudbase-seed-export', 'packages.json'), 'utf8'),
);
const storeDoc = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'cloudbase-seed-export', 'store.json'), 'utf8'),
)[0];

const OLD_IDS = [
  'student-light',
  'standard',
  'double-theme',
  'four-friends',
  'family',
  'birthday-party',
  'mayday-theme',
  'weekend-solo',
  'weekend-duo',
  'weekend-family',
  'opening-trio',
  'solo-1h',
  'solo-2h',
  'duo-1h',
  'duo-2h',
];

function run(command) {
  return execFileSync(
    process.execPath,
    [TCB_JS, 'db', 'nosql', 'execute', '-e', ENV, '--command', JSON.stringify(command), '--json'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 },
  );
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
    console.log(`deleted ${collection}/${id}`);
  } catch (error) {
    console.warn(`delete warn ${collection}/${id}`);
  }
}

function insert(collection, doc) {
  console.log(`insert ${collection}/${doc._id}`);
  console.log(
    run([
      {
        TableName: collection,
        CommandType: 'INSERT',
        Command: JSON.stringify({
          insert: collection,
          documents: [doc],
        }),
      },
    ]).trim() || 'ok',
  );
}

OLD_IDS.forEach((id) => deleteById('packages', id));
packages.forEach((pkg) => {
  insert('packages', { _id: pkg.id, ...pkg });
});

deleteById('store', 'main');
insert('store', storeDoc);

console.log(
  'verify packages',
  run([
    {
      TableName: 'packages',
      CommandType: 'FIND',
      Command: JSON.stringify({ find: 'packages', limit: 20 }),
    },
  ]).trim(),
);
