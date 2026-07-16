/**
 * 从本地 seed 导出云数据库导入清单。
 * 用法：node scripts/export-seed-for-cloudbase.js
 * 产出：scripts/cloudbase-seed-export/*.json
 */
const fs = require('fs');
const path = require('path');

const seed = require('../miniprogram/data/seed');

const outDir = path.join(__dirname, 'cloudbase-seed-export');

function writeJson(name, data) {
  const file = path.join(outDir, name);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return file;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const storeDoc = { _id: 'main', ...seed.store };
  const timeSlotsDoc = { _id: 'default', slots: seed.timeSlots };

  const files = [
    writeJson('store.json', [storeDoc]),
    writeJson('packages.json', seed.packages),
    writeJson('activities.json', seed.activities),
    writeJson('tables.json', seed.tables),
    writeJson('seats.json', seed.seats),
    writeJson('time_slots.json', [timeSlotsDoc]),
    writeJson('recharge_plans.json', seed.rechargePlans),
    writeJson('stamp_rules.json', seed.stampRules),
    writeJson('seat_occupancies.json', seed.seatOccupancies || []),
    writeJson('member_tier_rules.json', [
      {
        _id: 'main',
        spendRatio: 0.6,
        vip: { minRecharge: 500, minSpent: 300 },
        svip: { minRecharge: 1000, minSpent: 600 },
      },
    ]),
    writeJson('admins.example.json', [{ openid: 'REPLACE_WITH_YOUR_OPENID', role: 'owner' }]),
  ];

  const readme = path.join(outDir, 'README.md');
  fs.writeFileSync(
    readme,
    [
      '# 云数据库导入说明',
      '',
      '环境：`cloudbase-d8gzrj9d3f09c5171`',
      '',
      '1. 微信开发者工具 → 云开发 → 数据库，确认集合已创建。',
      '2. 对各集合使用「导入」或逐条添加，对应本目录 JSON。',
      '3. `store` 使用 `_id: main` 的单文档。',
      '4. `time_slots` 使用 `_id: default`，字段 `slots` 为字符串数组。',
      '5. `admins.example.json` 改名/复制为实际 openid 后导入 `admins`。',
      '6. 导入 `member_tier_rules.json`（VIP 充500/消费300，SVIP 充1000/消费600）。',
      '7. `seat_occupancies` 可先空着，或导入示例占用做联调。',
      '8. 部署云函数：ensureMember / getMyMember / listMyTransactions / adminFindMember / adminRecharge',
      '',
      '生成命令：`node scripts/export-seed-for-cloudbase.js`',
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Exported ${files.length} files -> ${outDir}`);
  files.forEach((file) => console.log(` - ${path.basename(file)}`));
}

main();
