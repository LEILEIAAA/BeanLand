/**
 * Patch opening-trio prices: weekend 149.8 / weekday 109.8
 * Usage: node scripts/patch-opening-trio-price.js
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

const pricePatch = {
  price: 149.8,
  weekendPrice: 149.8,
  weekdayPrice: 109.8,
};

function updateByQuery(q) {
  return run([
    {
      TableName: 'packages',
      CommandType: 'UPDATE',
      Command: JSON.stringify({
        update: 'packages',
        updates: [{ q, u: { $set: pricePatch } }],
      }),
    },
  ]);
}

function findTrio() {
  return run([
    {
      TableName: 'packages',
      CommandType: 'FIND',
      Command: JSON.stringify({
        find: 'packages',
        filter: { id: 'opening-trio' },
        limit: 5,
      }),
    },
  ]);
}

try {
  console.log('before:', findTrio());
} catch (error) {
  console.warn('find warn', error.message);
}

try {
  console.log(updateByQuery({ id: 'opening-trio' }));
} catch (error) {
  console.warn('update by id failed, try _id', error.message);
  console.log(updateByQuery({ _id: 'opening-trio' }));
}

try {
  console.log('after:', findTrio());
} catch (error) {
  console.warn('verify warn', error.message);
}

console.log('opening-trio ->', pricePatch);
