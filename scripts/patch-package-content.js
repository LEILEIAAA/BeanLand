/**
 * Patch CloudBase packages/activities to match package content口径.
 * - Remove packages/mayday-theme
 * - Upsert packages/birthday-party (name + price 1999)
 * - Upsert activities/birthday (name + price 1999)
 *
 * Usage: node scripts/patch-package-content.js
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
if (!require('fs').existsSync(TCB_JS)) {
  console.error('tcb cli not found at', TCB_JS);
  process.exit(1);
}
const ENV = 'cloudbase-d8gzrj9d3f09c5171';

function run(command) {
  return execFileSync(
    process.execPath,
    [TCB_JS, 'db', 'nosql', 'execute', '-e', ENV, '--command', JSON.stringify(command), '--json'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 },
  );
}

function deleteById(collection, id) {
  console.log(`delete ${collection}/${id}`);
  try {
    console.log(
      run([
        {
          TableName: collection,
          CommandType: 'DELETE',
          Command: JSON.stringify({
            delete: collection,
            deletes: [{ q: { _id: id }, limit: 1 }],
          }),
        },
      ]).trim() || 'ok',
    );
  } catch (err) {
    const msg = (err.stderr && String(err.stderr)) || (err.stdout && String(err.stdout)) || err.message;
    console.warn(`delete warn ${collection}/${id}:`, msg);
  }
}

function upsert(collection, doc) {
  const id = doc._id;
  deleteById(collection, id);
  console.log(`insert ${collection}/${id}`);
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

const birthdayParty = {
  _id: 'birthday-party',
  id: 'birthday-party',
  name: '生日会 / 团建 / 包场',
  price: 1999,
  targetAudience: '高客单活动',
  durationMinutes: 180,
  overtimeRule: '200-300 元 / 小时',
  includedItems: ['包场布置', '主题材料', '活动主持建议', '合影服务'],
  isRecommended: false,
  status: 'on_sale',
};

const birthdayActivity = {
  _id: 'birthday',
  id: 'birthday',
  name: '生日会 / 团建 / 包场',
  price: 1999,
  capacity: 40,
  status: 'consulting',
};

deleteById('packages', 'mayday-theme');
upsert('packages', birthdayParty);
upsert('activities', birthdayActivity);

console.log(
  'verify packages:',
  run([
    {
      TableName: 'packages',
      CommandType: 'FIND',
      Command: JSON.stringify({ find: 'packages', limit: 20 }),
    },
  ]).trim(),
);

console.log(
  'verify activities birthday:',
  run([
    {
      TableName: 'activities',
      CommandType: 'FIND',
      Command: JSON.stringify({
        find: 'activities',
        filter: { _id: 'birthday' },
        limit: 1,
      }),
    },
  ]).trim(),
);
