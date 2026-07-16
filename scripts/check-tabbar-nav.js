const fs = require('fs');
const path = require('path');

const root = 'miniprogram';
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const tabs = app.tabBar.list.map((i) => `${i.text}:${i.pagePath}`);
const expected = [
  '首页:pages/home/index',
  '活动:pages/activities/index',
  '套餐:pages/packages/index',
  '会员:pages/member/index',
];

if (JSON.stringify(tabs) !== JSON.stringify(expected)) {
  console.error('TAB_MISMATCH', tabs);
  process.exit(1);
}

const iconMissing = [];
for (const item of app.tabBar.list) {
  for (const key of ['iconPath', 'selectedIconPath']) {
    if (!item[key]) {
      iconMissing.push(`${item.text}: missing ${key}`);
      continue;
    }
    const abs = path.join(root, item[key]);
    if (!fs.existsSync(abs)) {
      iconMissing.push(`${item.text}: ${key} file missing (${item[key]})`);
    }
  }
}
if (iconMissing.length) {
  console.error('TAB_ICON_MISSING', iconMissing);
  process.exit(1);
}

if (app.tabBar.borderStyle !== 'white') {
  console.error('TAB_BORDER_NOT_HIDDEN', app.tabBar.borderStyle);
  process.exit(1);
}

if (app.tabBar.custom !== true) {
  console.error('TAB_CUSTOM_REQUIRED');
  process.exit(1);
}

const customTabBarFiles = [
  'custom-tab-bar/index.js',
  'custom-tab-bar/index.json',
  'custom-tab-bar/index.wxml',
  'custom-tab-bar/index.wxss',
];
for (const f of customTabBarFiles) {
  if (!fs.existsSync(path.join(root, f))) {
    console.error('CUSTOM_TAB_BAR_MISSING', f);
    process.exit(1);
  }
}

if (!app.pages.includes('pages/appointment/index')) {
  console.error('APPOINTMENT_PAGE_MISSING');
  process.exit(1);
}

const files = [];
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.js$/.test(f)) files.push(p);
  }
}
walk(path.join(root, 'pages'));

const bad = [];
const switchAppt = /switchTab\(\s*\{\s*url:\s*['"]\/pages\/appointment\//;
const switchPkg = /switchTab\(\s*\{\s*url:\s*['"]\/pages\/packages\//;
const switchAct = /switchTab\(\s*\{\s*url:\s*['"]\/pages\/activities\//;
const navAppt = /navigateTo\(\s*\{\s*url:\s*['"]\/pages\/appointment\//;

for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const norm = f.replace(/\\/g, '/');
  if (switchAppt.test(s)) bad.push(`${norm}: switchTab->appointment`);
  if (norm.endsWith('home/index.js')) {
    if (!switchPkg.test(s)) bad.push(`${norm}: missing switchTab packages`);
    if (!switchAct.test(s)) bad.push(`${norm}: missing switchTab activities`);
    if (!navAppt.test(s)) bad.push(`${norm}: missing navigateTo appointment`);
    if (!/syncTabBar\(\s*this\s*,\s*0\s*\)/.test(s)) bad.push(`${norm}: missing syncTabBar 0`);
  }
  if (norm.endsWith('pages/activities/index.js') && !/syncTabBar\(\s*this\s*,\s*1\s*\)/.test(s)) {
    bad.push(`${norm}: missing syncTabBar 1`);
  }
  if (norm.endsWith('pages/packages/index.js') && !/syncTabBar\(\s*this\s*,\s*2\s*\)/.test(s)) {
    bad.push(`${norm}: missing syncTabBar 2`);
  }
  if (norm.endsWith('pages/member/index.js') && !/syncTabBar\(\s*this\s*,\s*3\s*\)/.test(s)) {
    bad.push(`${norm}: missing syncTabBar 3`);
  }
}

if (bad.length) {
  console.error('FAIL', bad);
  process.exit(1);
}

console.log('OK tabBar=', tabs.join(' | '));
console.log('OK appointment page kept; no switchTab to appointment');

const tabBarUtil = fs.readFileSync(path.join(root, 'utils/tabBar.js'), 'utf8');
if (!/function setTabBarHidden/.test(tabBarUtil)) {
  console.error('TAB_BAR_HIDDEN_HELPER_MISSING');
  process.exit(1);
}
const packagesJs = fs.readFileSync(path.join(root, 'pages/packages/index.js'), 'utf8');
if (!/setTabBarHidden\(\s*this\s*,\s*true\s*\)/.test(packagesJs)
  || !/setTabBarHidden\(\s*this\s*,\s*false\s*\)/.test(packagesJs)) {
  console.error('PACKAGES_SHEET_TABBAR_HIDE_MISSING');
  process.exit(1);
}
const customTabWxml = fs.readFileSync(path.join(root, 'custom-tab-bar/index.wxml'), 'utf8');
if (!/wx:if="\{\{!hidden\}\}"/.test(customTabWxml)) {
  console.error('CUSTOM_TAB_BAR_HIDDEN_FLAG_MISSING');
  process.exit(1);
}
console.log('OK tabBar hides while package sheet open');

const appWxss = fs.readFileSync(path.join(root, 'app.wxss'), 'utf8');
if (!/\.tab-page\s*\{/.test(appWxss) || !/140rpx/.test(appWxss)) {
  console.error('TAB_PAGE_INSET_MISSING');
  process.exit(1);
}
const tabPageRoots = [
  'pages/home/index.wxml',
  'pages/activities/index.wxml',
  'pages/packages/index.wxml',
  'pages/member/index.wxml',
];
for (const f of tabPageRoots) {
  const html = fs.readFileSync(path.join(root, f), 'utf8');
  if (!/\btab-page\b/.test(html)) {
    console.error('TAB_PAGE_CLASS_MISSING', f);
    process.exit(1);
  }
}
console.log('OK tab pages reserve bottom inset for custom-tab-bar');
