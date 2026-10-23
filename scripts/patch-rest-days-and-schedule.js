/**
 * Create off-shelf rest-day activities and restore opening-week schedule.
 * Usage: node scripts/patch-rest-days-and-schedule.js
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
const now = Date.now();

const REST_DAYS = [
  {
    _id: 'rest-d3',
    id: 'rest-d3',
    name: '散场日',
    price: 0,
    capacity: 0,
    registeredCount: 0,
    status: 'available',
    category: 'other',
    accentTheme: 'yellow',
    blurb: '无主题局，可预约日常座位',
    scheduleText: '开业首周 D3',
    timeText: '',
    audience: '',
    content: '无主题局，可预约日常座位。',
    includes: [],
    notice: '',
    sortOrder: 99,
    onShelf: false,
    coverImage: '',
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: 'rest-d6',
    id: 'rest-d6',
    name: '散场日',
    price: 0,
    capacity: 0,
    registeredCount: 0,
    status: 'available',
    category: 'other',
    accentTheme: 'yellow',
    blurb: '休整补豆，作品继续打磨',
    scheduleText: '开业首周 D6',
    timeText: '',
    audience: '',
    content: '休整补豆，作品继续打磨。',
    includes: [],
    notice: '',
    sortOrder: 99,
    onShelf: false,
    coverImage: '',
    createdAt: now,
    updatedAt: now,
  },
];

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
      { day: '3', activityId: 'rest-d3' },
      { day: '4-5', activityId: 'squid-game' },
      { day: '6', activityId: 'rest-d6' },
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

function deleteById(id) {
  try {
    run([
      {
        TableName: 'activities',
        CommandType: 'DELETE',
        Command: JSON.stringify({
          delete: 'activities',
          deletes: [{ q: { _id: id }, limit: 1 }, { q: { id }, limit: 1 }],
        }),
      },
    ]);
  } catch (err) {
    // ignore missing
  }
}

function upsertActivity(doc) {
  deleteById(doc.id);
  console.log(
    'insert',
    doc.id,
    run([
      {
        TableName: 'activities',
        CommandType: 'INSERT',
        Command: JSON.stringify({
          insert: 'activities',
          documents: [doc],
        }),
      },
    ]).trim().slice(0, 120),
  );
}

for (const doc of REST_DAYS) {
  upsertActivity(doc);
}

console.log(
  'update schedule',
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
  ]).trim().slice(0, 200),
);

console.log(
  'verify activities',
  run([
    {
      TableName: 'activities',
      CommandType: 'FIND',
      Command: JSON.stringify({
        find: 'activities',
        filter: { id: { $in: ['rest-d3', 'rest-d6'] } },
        limit: 10,
      }),
    },
  ]).trim().slice(0, 800),
);
