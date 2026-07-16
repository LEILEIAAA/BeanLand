/**
 * Sync opening activity lineup + detail fields into CloudBase activities.
 * - Upsert current activities from cloudbase-seed-export/activities.json
 * - Delete retired activity ids
 *
 * Usage: node scripts/patch-activities-opening-lineup.js
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
if (!fs.existsSync(TCB_JS)) {
  console.error('tcb cli not found at', TCB_JS);
  process.exit(1);
}

const ENV = 'cloudbase-d8gzrj9d3f09c5171';
const seedPath = path.join(__dirname, 'cloudbase-seed-export', 'activities.json');
const RETIRED_IDS = [
  'summer-partner',
  'four-table',
  'summer-class',
  'family-craft',
  'trial-officer',
];

function run(command) {
  return execFileSync(
    process.execPath,
    [TCB_JS, 'db', 'nosql', 'execute', '-e', ENV, '--command', JSON.stringify(command), '--json'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 },
  );
}

function deleteById(id) {
  console.log(`delete activities/${id}`);
  try {
    console.log(
      run([
        {
          TableName: 'activities',
          CommandType: 'DELETE',
          Command: JSON.stringify({
            delete: 'activities',
            deletes: [{ q: { _id: id }, limit: 1 }, { q: { id }, limit: 1 }],
          }),
        },
      ]).trim() || 'ok',
    );
  } catch (err) {
    const msg = (err.stderr && String(err.stderr)) || (err.stdout && String(err.stdout)) || err.message;
    console.warn(`delete warn activities/${id}:`, msg);
  }
}

function upsert(doc) {
  const id = String(doc.id);
  const payload = { ...doc, _id: id, id };
  deleteById(id);
  console.log(`insert activities/${id}`);
  console.log(
    run([
      {
        TableName: 'activities',
        CommandType: 'INSERT',
        Command: JSON.stringify({
          insert: 'activities',
          documents: [payload],
        }),
      },
    ]).trim() || 'ok',
  );
}

const activities = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
if (!Array.isArray(activities) || !activities.length) {
  console.error('activities.json empty');
  process.exit(1);
}

for (const id of RETIRED_IDS) {
  deleteById(id);
}

for (const row of activities) {
  upsert({
    ...row,
    registeredCount: Number(row.registeredCount || 0),
  });
}

const verify = run([
  {
    TableName: 'activities',
    CommandType: 'FIND',
    Command: JSON.stringify({ find: 'activities', limit: 20 }),
  },
]);
console.log('verify activities:', verify.trim());
console.log('patch-activities-opening-lineup done');
