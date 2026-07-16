const fs = require('fs');
const path = require('path');
const assert = require('assert');

const pageDir = path.join('miniprogram', 'pages', 'activities');
const wxml = fs.readFileSync(path.join(pageDir, 'index.wxml'), 'utf8');
const wxss = fs.readFileSync(path.join(pageDir, 'index.wxss'), 'utf8');
const js = fs.readFileSync(path.join(pageDir, 'index.js'), 'utf8');
const homeJs = fs.readFileSync(path.join('miniprogram', 'pages', 'home', 'index.js'), 'utf8');
const homeWxss = fs.readFileSync(path.join('miniprogram', 'pages', 'home', 'index.wxss'), 'utf8');
const appJson = fs.readFileSync(path.join('miniprogram', 'app.json'), 'utf8');
const registerJs = fs.readFileSync(path.join(pageDir, 'register', 'index.js'), 'utf8');
const registerWxml = fs.readFileSync(path.join(pageDir, 'register', 'index.wxml'), 'utf8');
const registerWxss = fs.readFileSync(path.join(pageDir, 'register', 'index.wxss'), 'utf8');
const apiJs = fs.readFileSync(path.join('miniprogram', 'utils', 'api.js'), 'utf8');
const seedJs = fs.readFileSync(path.join('miniprogram', 'data', 'seed.js'), 'utf8');
const { activities } = require(path.join(__dirname, '..', 'miniprogram', 'data', 'seed.js'));
const listActivitiesExists = fs.existsSync(path.join('cloudfunctions', 'listActivities', 'index.js'));


const EXPECTED_IDS = ['mayday', 'squid-game', 'craft-meetup', 'birthday'];
const REMOVED_IDS = ['summer-partner', 'four-table', 'summer-class', 'family-craft', 'trial-officer'];

assert.deepStrictEqual(
  activities.map((row) => row.id),
  EXPECTED_IDS,
  'seed activities order must match opening lineup'
);
assert.equal(activities[activities.length - 1].id, 'birthday', 'birthday must be last');
assert.equal(activities[activities.length - 1].status, 'consulting', 'birthday stays consulting');

const checks = [
  [wxml.includes('poster-stack'), 'wxml has poster-stack'],
  [wxml.includes('act-hero'), 'wxml has hero'],
  [wxml.includes('act-week'), 'wxml has opening week schedule'],
  [wxml.includes('开业首周'), 'wxml mentions opening week'],
  [wxml.includes('act-filters'), 'wxml has filters'],
  [wxml.includes('seatLabel'), 'wxml shows seatLabel'],
  [!wxml.includes('class="card"'), 'wxml dropped generic cards'],
  [!wxml.includes('去预约咨询'), 'wxml no appointment CTA'],
  [wxss.includes('.poster-stack'), 'wxss has poster-stack'],
  [wxss.includes('.act-week'), 'wxss has week schedule'],
  [wxss.includes('@keyframes actRise'), 'wxss has entrance motion'],
  [js.includes('ACTIVITY_LOOKS'), 'js has looks'],
  [js.includes("'squid-game'"), 'js looks include squid-game'],
  [js.includes("'craft-meetup'"), 'js looks include craft-meetup'],
  [js.includes('OPENING_WEEK'), 'js has opening week data'],
  [js.includes('onFilterTap'), 'js has filter'],
  [js.includes('/pages/activities/register/index'), 'js goes to register page'],
  [!js.includes('/pages/appointment/index'), 'js no longer jumps appointment'],
  [!js.includes('summer-partner'), 'js dropped summer-partner'],
  [homeJs.includes("'squid-game'"), 'home features squid-game'],
  [homeJs.includes("'craft-meetup'"), 'home features craft-meetup'],
  [!homeJs.includes('summer-partner'), 'home dropped summer-partner'],
  [homeWxss.includes('.poster-stack'), 'home poster-stack fixed'],
  [!homeWxss.includes('\nr-stack'), 'home r-stack typo gone'],
  [!homeWxss.includes('.pack-\n'), 'home pack- typo gone'],
  [appJson.includes('pages/activities/register/index'), 'app.json registers register page'],
  [appJson.includes('pages/member/activity-registrations/index'), 'app.json my registrations'],
  [appJson.includes('pages/admin/activity-registrations/index'), 'app.json admin registrations'],
  [registerJs.includes('createActivityRegistration'), 'register calls create API'],
  [registerJs.includes('applySeatSnapshot'), 'register applies seat snapshot'],
  [registerJs.includes('buildActivityDetailView'), 'register builds detail view'],
  [registerJs.includes('ACTIVITY_LOOK'), 'register has activity look map'],
  [registerJs.includes('payChannel'), 'register has pay channel'],
  [registerJs.includes('listMyCoupons'), 'register loads coupons'],
  [registerJs.includes('couponId'), 'register passes couponId'],
  [apiJs.includes("callFunction('listActivities'"), 'api getActivities uses listActivities'],
  [listActivitiesExists, 'listActivities cloud function exists'],
  [registerWxml.includes('优惠券'), 'register wxml shows coupons'],
  [registerWxml.includes('reg-hero'), 'register wxml has styled hero'],
  [registerWxml.includes('reg-highlights'), 'register wxml has highlight cards'],
  [registerWxml.includes('detail.highlights'), 'register wxml binds detail view'],
  [registerWxml.includes('reg-chips'), 'register wxml has include chips'],
  [registerWxss.includes('.reg-hero'), 'register wxss has hero styles'],
  [registerWxss.includes('.reg-hl'), 'register wxss has highlight styles'],
  [EXPECTED_IDS.every((id) => seedJs.includes(`id: '${id}'`)), 'seed declares new activity ids'],
  [REMOVED_IDS.every((id) => !seedJs.includes(`id: '${id}'`)), 'seed removed retired activity ids'],
  [seedJs.includes('scheduleText') && seedJs.includes('timeText') && seedJs.includes('content'), 'seed has detail fields'],
];

let failed = 0;
for (const [ok, label] of checks) {
  if (!ok) {
    console.error('FAIL', label);
    failed += 1;
  } else {
    console.log('OK', label);
  }
}

if (failed) process.exit(1);
console.log('OK activities registration checks passed');
