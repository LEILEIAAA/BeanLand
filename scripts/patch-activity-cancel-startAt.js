/**
 * Patch activities startAt + notice without wiping registeredCount.
 * Usage: node scripts/patch-activity-cancel-startAt.js
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
const seedPath = path.join(__dirname, 'cloudbase-seed-export', 'activities.json');

function run(command) {
  return execFileSync(
    process.execPath,
    [TCB_JS, 'db', 'nosql', 'execute', '-e', ENV, '--command', JSON.stringify(command), '--json'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 },
  );
}

function updateActivity(id, patch) {
  const updates = [{ q: { id }, u: { $set: patch } }];
  try {
    return run([
      {
        TableName: 'activities',
        CommandType: 'UPDATE',
        Command: JSON.stringify({ update: 'activities', updates }),
      },
    ]);
  } catch (error) {
    return run([
      {
        TableName: 'activities',
        CommandType: 'UPDATE',
        Command: JSON.stringify({
          update: 'activities',
          updates: [{ q: { _id: id }, u: { $set: patch } }],
        }),
      },
    ]);
  }
}

const activities = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
for (const row of activities) {
  const id = String(row.id);
  const patch = {
    notice: row.notice || '',
  };
  if (row.startAt != null) {
    patch.startAt = Number(row.startAt);
  }
  console.log('patch', id, patch);
  console.log(updateActivity(id, patch).trim() || 'ok');
}

const verify = run([
  {
    TableName: 'activities',
    CommandType: 'FIND',
    Command: JSON.stringify({ find: 'activities', limit: 20 }),
  },
]);
console.log('verify:', verify.trim());
console.log('patch-activity-cancel-startAt done');
