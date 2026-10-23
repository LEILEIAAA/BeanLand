import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const rawDir = path.join(root, 'raw');
const imgDir = path.join(root, 'images');

const JUNK = /小鼻嘎|鼻嘎|迪士尼|史努比|snoopy|米奇|米妮|星黛露|玲娜贝儿|库洛米|美乐蒂|玉桂狗|三丽鸥|kitty|jellycat|labubu|全家福|大合集|拼豆合集|合集|汇总/i;

function usesFromTitle(title) {
  const text = title || '';
  if (JUNK.test(text)) return [];
  const uses = [];
  const add = (use) => {
    if (!uses.includes(use)) uses.push(use);
  };
  if (/壁灯/.test(text)) add('壁灯');
  if (/落地灯/.test(text)) add('落地灯');
  if (/吸顶灯/.test(text)) add('吸顶灯');
  if (/灯箱/.test(text)) add('灯箱');
  if (/灯牌/.test(text)) add('灯牌');
  if (/氛围灯/.test(text)) add('氛围灯');
  if ((/吊灯|挂灯/.test(text)) && !/杯垫/.test(text)) add('挂灯');
  if (/灯罩/.test(text)) add(/吊灯|挂灯/.test(text) ? '挂灯' : '台灯');
  if (/台灯|小夜灯|床头灯/.test(text) && !/壁灯|落地灯/.test(text)) add('台灯');
  if (/杯垫|隔热垫/.test(text)) add('杯垫');
  if (/餐垫|桌垫/.test(text)) add('餐垫');
  if (/壶垫/.test(text)) add('壶垫');
  if (/锅垫/.test(text)) add('锅垫');
  if (/餐盘/.test(text)) add('餐盘');
  if (/果盘/.test(text)) add('果盘');
  if (/茶托|杯托/.test(text)) add('茶托');
  if (/杯套/.test(text)) add('杯套');
  if (/相框|画框/.test(text)) add('相框');
  if (/装饰画|挂画/.test(text)) add('墙饰');
  if (/门牌/.test(text)) add('门牌');
  if (/纸巾盒|抽纸盒/.test(text)) add('纸巾盒');
  if (/座钟/.test(text)) add('座钟');
  if (/挂钟|闹钟|时钟|钟表/.test(text)) add('时钟');
  if (/托盘/.test(text)) add('托盘');
  if (/花盆/.test(text)) add('花盆');
  if (/花瓶|花器/.test(text) && !/项链|耳钉|耳饰|胸针/.test(text)) add('花瓶');
  if (/化妆镜|手持镜|镜子/.test(text) && !/镜像/.test(text)) add('镜子');
  if (/日历|年历|月历/.test(text)) add('日历');
  if (/笔筒/.test(text)) add('笔筒');
  if (/首饰盒/.test(text)) add('首饰盒');
  else if (/收纳盒/.test(text)) add('收纳');
  if (/书立/.test(text)) add('书立');
  if (/眼镜盒/.test(text)) add('眼镜盒');
  if (/卡套/.test(text)) add('卡套');
  if (/烛台/.test(text)) add('烛台');
  if (/香薰|扩香/.test(text)) add('香薰');
  if (/风铃/.test(text)) add('风铃');
  if (/挂毯|壁毯/.test(text)) add('挂毯');
  if (/门帘/.test(text)) add('门帘');
  if (/桌旗/.test(text)) add('桌旗');
  if (/地垫|脚垫/.test(text)) add('地垫');
  if (/挂钩|衣帽钩/.test(text)) add('挂钩');
  if (/立牌/.test(text)) add('立牌');
  if (/胸针/.test(text)) add('胸针');
  if (/发夹|发箍/.test(text)) add('发夹');
  if (/手机壳/.test(text)) add('手机壳');
  if (/开关贴|开关套|开关框/.test(text)) add('开关');
  if (/摆件/.test(text)) add('摆件');
  return uses;
}

function parseLikes(value) {
  const text = String(value || '0').replace(/,/g, '').trim();
  if (text.includes('万')) return Math.round(parseFloat(text) * 10000);
  return Number.parseInt(text, 10) || 0;
}

const catalogSrc = fs.readFileSync(path.join(root, 'catalog.js'), 'utf8');
const current = JSON.parse(catalogSrc.slice(catalogSrc.indexOf('['), catalogSrc.lastIndexOf(']') + 1));
const notes = new Map();
let dropped = 0;
for (const note of current) {
  const uses = usesFromTitle(note.title);
  if (!uses.length) {
    dropped++;
    continue;
  }
  notes.set(note.id, { ...note, uses, likes: parseLikes(note.likes) });
}

const files = fs.readdirSync(rawDir).filter((name) => name.startsWith('v2-') && name.endsWith('.json'));
let added = 0;
for (const file of files) {
  const dump = JSON.parse(fs.readFileSync(path.join(rawDir, file), 'utf8'));
  for (const item of dump.items || []) {
    if (!item.id || !item.images?.length) continue;
    const uses = usesFromTitle(item.title);
    if (!uses.length) continue;
    const prev = notes.get(item.id);
    if (!prev) {
      notes.set(item.id, {
        id: item.id,
        title: item.title || '',
        author: item.author || '',
        likes: parseLikes(item.likes),
        token: item.token || '',
        uses,
        why: '',
        images: item.images.slice(0, 2),
      });
      added++;
      continue;
    }
    prev.uses = uses;
    if (!prev.token && item.token) prev.token = item.token;
    if (parseLikes(item.likes) > prev.likes) prev.likes = parseLikes(item.likes);
  }
}

const jobs = [];
for (const note of notes.values()) {
  note.images.forEach((image, index) => {
    if (!image || !image.url) return;
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
  } catch {
    fail++;
    job.note.images[job.index] = null;
  }
}
const queue = jobs.slice();
let done = 0;
async function worker() {
  while (queue.length) {
    await one(queue.shift());
    done++;
    if (done % 200 === 0) console.log('progress', done, '/', jobs.length, 'ok', ok, 'skip', skip, 'fail', fail);
  }
}
await Promise.all(Array.from({ length: 16 }, worker));

const catalog = [...notes.values()]
  .map((note) => ({ ...note, images: note.images.filter((image) => image && image.file) }))
  .filter((note) => note.images.length);

fs.writeFileSync(path.join(root, 'catalog.js'), `window.BEADS = ${JSON.stringify(catalog)};\n`);
const tally = {};
for (const note of catalog) for (const use of note.uses) tally[use] = (tally[use] || 0) + 1;
const ordered = Object.entries(tally).sort((a, b) => b[1] - a[1]);
console.log('kept', catalog.length, 'droppedOld', dropped, 'added', added, 'ok', ok, 'skip', skip, 'fail', fail);
console.log(ordered.map(([name, count]) => `${name} ${count}`).join('\n'));
