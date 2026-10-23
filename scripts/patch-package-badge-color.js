/**
 * Backfill packages.badgeColor for rows that have a badge but no color.
 * Usage: node scripts/patch-package-badge-color.js
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

function run(command) {
  return execFileSync(
    process.execPath,
    [TCB_JS, 'db', 'nosql', 'execute', '-e', ENV, '--command', JSON.stringify(command), '--json'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 },
  );
}

const findOut = run([
  {
    TableName: 'packages',
    CommandType: 'FIND',
    Command: JSON.stringify({ find: 'packages', limit: 50 }),
  },
]);
const parsed = JSON.parse(findOut);
const rows = (((parsed.data || {}).results || [])[0]) || [];

rows.forEach((row) => {
  const id = row._id;
  const badge = String(row.badge || '').trim();
  const color = row.badgeColor;
  if (!id) return;
  if (!badge) return;
  if (color === 'orange' || color === 'yellow') return;
  const next = row.id === 'opening-trio' ? 'orange' : 'orange';
  console.log(`patch ${id} badge=${badge} -> badgeColor=${next}`);
  console.log(
    run([
      {
        TableName: 'packages',
        CommandType: 'UPDATE',
        Command: JSON.stringify({
          update: 'packages',
          updates: [
            {
              q: { _id: id },
              u: { $set: { badgeColor: next } },
              multi: false,
            },
          ],
        }),
      },
    ]).trim(),
  );
});

console.log(
  'verify',
  run([
    {
      TableName: 'packages',
      CommandType: 'FIND',
      Command: JSON.stringify({ find: 'packages', limit: 50 }),
    },
  ]).trim(),
);
