import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const rawDir = path.join(root, 'raw');
const imgDir = path.join(root, 'images');
fs.mkdirSync(imgDir, { recursive: true });

const files = fs.readdirSync(rawDir).filter((name) => name.endsWith('.json')).sort();

function parseLikes(value) {
  const text = String(value || '0').replace(/,/g, '').trim();
  if (text.includes('万')) return Math.round(parseFloat(text) * 10000);
  return Number.parseInt(text, 10) || 0;
}

function tag(item, query) {
  const title = item.title || '';
  const styles = new Set();
  const uses = new Set();

  if (/五月天|卜卜|wmls|阿信/.test(title)) styles.add('五月天');
  if (/多巴胺/.test(title)) styles.add('多巴胺');
  if (/淡人|莫兰迪|低饱和|i人/.test(title) || /ins/i.test(title)) styles.add('淡人');
  if (/小鼻嘎|丑萌|鼻嘎/.test(title)) styles.add('小鼻嘎');
  if (/海岸|圣托里尼|白崖|风景|小屋|红房子|旅行牌|建筑/.test(title)) styles.add('风景');
  if (/复古|古早|marimekko|原田治|米奇|米妮|迪士尼|史努比|snoopy|kitty|郁金香|缪缪|罗意威/i.test(title)) {
    styles.add('复古');
  }

  if (query.includes('五月天')) styles.add('五月天');
  if (!styles.size && /ins/i.test(query)) styles.add('淡人');
  if (!styles.size && query.includes('小鼻')) styles.add('小鼻嘎');
  if (!styles.size) styles.add('综合');
  if (styles.size > 1) styles.delete('综合');

  if (/杯垫/.test(title) || query.includes('杯垫')) uses.add('杯垫');
  if (/挂件|钥匙|包挂|书包/.test(title) || query.includes('挂件') || query.includes('小鼻')) uses.add('挂件');
  if (/冰箱|磁吸/.test(title)) uses.add('冰箱贴');
  if (/标语|门牌|指示|旅行牌|标识|【推】/.test(title)) uses.add('标语牌');
  if (/相框|装饰|日历|时钟|纸巾|收纳/.test(title)) uses.add('装饰');
  if (!uses.size) uses.add('图纸');

  return { styles, uses };
}

const notes = new Map();
for (const file of files) {
  const dump = JSON.parse(fs.readFileSync(path.join(rawDir, file), 'utf8'));
  for (const item of dump.items || []) {
    if (!item.id || !item.images?.length) continue;
    const tagged = tag(item, dump.query || '');
    const prev = notes.get(item.id);
    if (!prev) {
      notes.set(item.id, {
        id: item.id,
        title: item.title,
        author: item.author,
        likes: parseLikes(item.likes),
        token: item.token || '',
        styles: tagged.styles,
        uses: tagged.uses,
        images: item.images.slice(0, 8),
      });
      continue;
    }
    tagged.styles.forEach((style) => prev.styles.add(style));
    tagged.uses.forEach((use) => prev.uses.add(use));
    if (prev.styles.size > 1) prev.styles.delete('综合');
    if (item.images.length > prev.images.length) prev.images = item.images.slice(0, 8);
    if (!prev.token && item.token) prev.token = item.token;
  }
}

const jobs = [];
for (const note of notes.values()) {
  note.images.forEach((image, index) => {
    const file = `${note.id}-${index}.webp`;
    jobs.push({ url: image.url, file, w: image.w, h: image.h, note, index });
  });
}

async function download(job) {
  const dest = path.join(imgDir, job.file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) return true;
  const response = await fetch(job.url, {
    headers: {
      Referer: 'https://www.xiaohongshu.com/',
      'User-Agent': 'Mozilla/5.0',
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(String(response.status));
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1000) throw new Error('tiny');
  fs.writeFileSync(dest, buffer);
  return true;
}

let cursor = 0;
let done = 0;
let failed = 0;
const failedNotes = new Map();

async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    try {
      await download(job);
      job.note.saved = job.note.saved || [];
      job.note.saved[job.index] = { file: `images/${job.file}`, w: job.w, h: job.h };
    } catch (error) {
      failed += 1;
      failedNotes.set(job.file, error.message);
    }
    done += 1;
    if (done % 80 === 0 || done === jobs.length) {
      console.log(`${done}/${jobs.length}  failed ${failed}`);
    }
  }
}

console.log(`notes ${notes.size}  images ${jobs.length}`);
await Promise.all(Array.from({ length: 12 }, () => worker()));

const catalog = [...notes.values()]
  .map((note) => ({
    id: note.id,
    title: note.title,
    author: note.author,
    likes: note.likes,
    token: note.token,
    styles: [...note.styles],
    uses: [...note.uses],
    images: (note.saved || []).filter(Boolean),
  }))
  .filter((note) => note.images.length);

const payload = `window.BEADS = ${JSON.stringify(catalog).replace(/</g, '\\u003c')};\n`;
fs.writeFileSync(path.join(root, 'catalog.js'), payload);
console.log(`kept ${catalog.length} notes, ${catalog.reduce((sum, note) => sum + note.images.length, 0)} images, failed ${failed}`);
if (failedNotes.size) {
  console.log([...failedNotes.entries()].slice(0, 8).map(([file, reason]) => `${file} ${reason}`).join('\n'));
}
