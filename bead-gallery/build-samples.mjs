import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const rawDir = path.join(root, 'raw');
const imgDir = path.join(root, 'images');
fs.mkdirSync(imgDir, { recursive: true });

const WHY = {
  '69e6d8b3000000001a030116': '一套花纹铺在桌上，颜色能数清。',
  '6ac47a86000000001c00e8b5': '灯罩本身是拼豆，菱格花是一套重复纹样。',
  '6aaff099000000001001cbb8': '暗墙上单独一块发光的框。豆面还糙，先占住这一格。',
  '69fc9711000000003502531e': '复刻的圆孔框。框是物件，画面只有一只小动物。',
  '6a9a9a67000000002502c034': '两朵花，颜色少，装在一块亚克力上。',
  '6abf5d51000000001500c644': '黑框里一件几何台灯，边框是重复纹样。',
};

function parseLikes(value) {
  const text = String(value || '0').replace(/,/g, '').trim();
  if (text.includes('万')) return Math.round(parseFloat(text) * 10000);
  return Number.parseInt(text, 10) || 0;
}

const notes = new Map();
const files = fs.readdirSync(rawDir).filter((name) => name.startsWith('samples-') && name.endsWith('.json'));
for (const file of files) {
  const dump = JSON.parse(fs.readFileSync(path.join(rawDir, file), 'utf8'));
  for (const item of dump.items || []) {
    if (!item.id || !item.images?.length) continue;
    const prev = notes.get(item.id);
    if (!prev) {
      notes.set(item.id, {
        id: item.id,
        title: item.title || '',
        author: item.author || '',
        likes: parseLikes(item.likes),
        token: item.token || '',
        uses: [dump.use],
        why: WHY[item.id] || '',
        images: item.images.slice(0, 2),
      });
      continue;
    }
    if (!prev.uses.includes(dump.use)) prev.uses.push(dump.use);
    if (!prev.token && item.token) prev.token = item.token;
    if (item.images.length > prev.images.length) prev.images = item.images.slice(0, 2);
  }
}

const jobs = [];
for (const note of notes.values()) {
  note.images.forEach((image, index) => {
    if (!image.url) return;
    jobs.push({ url: image.url, file: `${note.id}-${index}.webp`, w: image.w, h: image.h, note, index });
  });
}

let ok = 0;
let fail = 0;
let skip = 0;
async function one(job) {
  const dest = path.join(imgDir, job.file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    job.note.images[job.index] = { file: `images/${job.file}`, w: job.w, h: job.h };
    skip++;
    return;
  }
  try {
    const res = await fetch(job.url, {
      headers: { Referer: 'https://www.xiaohongshu.com/' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) throw new Error('tiny');
    fs.writeFileSync(dest, buf);
    job.note.images[job.index] = { file: `images/${job.file}`, w: job.w, h: job.h };
    ok++;
  } catch (error) {
    fail++;
    job.note.images[job.index] = null;
  }
}

const queue = jobs.slice();
let done = 0;
async function worker() {
  while (queue.length) {
    const job = queue.shift();
    await one(job);
    done++;
    if (done % 200 === 0) console.log('progress', done, '/', jobs.length, 'ok', ok, 'skip', skip, 'fail', fail);
  }
}
await Promise.all(Array.from({ length: 16 }, worker));

const catalog = [...notes.values()]
  .map((note) => ({
    ...note,
    images: note.images.filter((image) => image && image.file),
  }))
  .filter((note) => note.images.length);
if (!catalog.some((note) => note.id === '6aaff099000000001001cbb8')) {
  const wall = path.join(imgDir, '6aaff099000000001001cbb8-0.webp');
  if (fs.existsSync(wall)) {
    catalog.push({
      id: '6aaff099000000001001cbb8',
      title: 'DIY拼豆壁灯',
      author: '喝一杯抹茶就醉',
      likes: 437,
      token: 'ABS7sj2_QhjyaM0CXZRBJzkKScdZZ_0TNstTMhHl9WJNc=',
      uses: ['壁灯'],
      why: WHY['6aaff099000000001001cbb8'],
      images: [{ file: 'images/6aaff099000000001001cbb8-0.webp', w: 1920, h: 2560 }],
    });
  }
}

fs.writeFileSync(path.join(root, 'catalog.js'), `window.BEADS = ${JSON.stringify(catalog)};\n`);
const tally = {};
for (const note of catalog) {
  for (const use of note.uses) tally[use] = (tally[use] || 0) + 1;
}
console.log('notes', catalog.length, 'ok', ok, 'skip', skip, 'fail', fail);
console.log(JSON.stringify(tally));
