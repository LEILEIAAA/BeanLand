const fs = require('fs');
const path = require('path');

const seedPath = path.join(__dirname, '../miniprogram/data/seed.js');
const jsonPath = path.join(__dirname, 'cloudbase-seed-export/packages.json');

let seed = fs.readFileSync(seedPath, 'utf8');
const seedRe = /id: 'opening-trio',\r?\n\s*name: '三人同行一人免单',\r?\n(?:\s*\/\/[^\n]*\r?\n)?\s*price: [0-9.]+,\r?\n\s*weekendPrice: [0-9.]+,\r?\n\s*weekdayPrice: [0-9.]+,/;
if (!seedRe.test(seed)) {
  console.error('seed opening-trio price block not found');
  process.exit(1);
}
seed = seed.replace(
  seedRe,
  `id: 'opening-trio',\n    name: '三人同行一人免单',\n    price: 149.8,\n    weekendPrice: 149.8,\n    weekdayPrice: 109.8,`,
);
fs.writeFileSync(seedPath, seed);
console.log('seed updated');

const packages = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const trio = packages.find((p) => p.id === 'opening-trio');
if (!trio) {
  console.error('packages.json opening-trio missing');
  process.exit(1);
}
trio.price = 149.8;
trio.weekendPrice = 149.8;
trio.weekdayPrice = 109.8;
fs.writeFileSync(jsonPath, `${JSON.stringify(packages, null, 2)}\n`);
console.log('packages.json updated', trio.price, trio.weekendPrice, trio.weekdayPrice);
