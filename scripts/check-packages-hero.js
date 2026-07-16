const fs = require('fs');

const wxml = fs.readFileSync('miniprogram/pages/packages/index.wxml', 'utf8');
const wxss = fs.readFileSync('miniprogram/pages/packages/index.wxss', 'utf8');
const js = fs.readFileSync('miniprogram/pages/packages/index.js', 'utf8');

const checks = [
  [wxml.includes('menu-hero'), 'wxml menu-hero'],
  [wxml.includes('Atelier Menu'), 'wxml kicker'],
  [wxml.includes('今天拼哪一档'), 'wxml title'],
  [wxml.includes('{{packageCount}}'), 'wxml count'],
  [!wxml.includes('选择适合你的拼豆体验'), 'old title removed'],
  [wxss.includes('.menu-hero'), 'wxss hero'],
  [!wxml.includes('hero-bands') && !wxss.includes('hero-bands'), 'no activity bands'],
  [js.includes('packageCount'), 'js count'],
];

let ok = true;
for (const [pass, name] of checks) {
  console.log(pass ? 'PASS' : 'FAIL', name);
  if (!pass) ok = false;
}
process.exit(ok ? 0 : 1);
