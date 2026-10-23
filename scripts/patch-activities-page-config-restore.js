/**
 * Restore pre-change activities page config into store/main.activitiesPage.
 * Schedule keeps the original opening-week layout, mapped to real activities
 * (rest days D3/D6 cannot be represented since schedule now selects activities).
 * Usage: node scripts/patch-activities-page-config-restore.js
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

const activitiesPage = {
  hero: {
    title: '开业首周有局',
    subtitle: 'Opening Week',
    content:
      '五月天破圈开场，接着大学生鱿鱼局，周末收个作品交流会。中间两天散场；包场咨询见海报墙末位。',
  },
  schedule: {
    title: '开业首周日程',
    items: [
      { day: '1-2', activityId: 'mayday' },
      { day: '4-5', activityId: 'squid-game' },
      { day: '7', activityId: 'craft-meetup' },
    ],
  },
};

function run(command) {
  return execFileSync(
    process.execPath,
    [TCB_JS, 'db', 'nosql', 'execute', '-e', ENV, '--command', JSON.stringify(command), '--json'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 },
  );
}

console.log(
  'update',
  run([
    {
      TableName: 'store',
      CommandType: 'UPDATE',
      Command: JSON.stringify({
        update: 'store',
        updates: [
          {
            q: { _id: 'main' },
            u: { $set: { activitiesPage, updatedAt: Date.now() } },
            multi: false,
            upsert: true,
          },
        ],
      }),
    },
  ]).trim(),
);

console.log(
  'verify',
  run([
    {
      TableName: 'store',
      CommandType: 'FIND',
      Command: JSON.stringify({ find: 'store', filter: { _id: 'main' }, limit: 1 }),
    },
  ]).trim(),
);
