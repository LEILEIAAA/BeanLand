const packagesRaw = [
  {
    id: 'opening-trio',
    name: '三人同行一人免单',
    price: 139.8,
    weekendPrice: 139.8,
    weekdayPrice: 99.8,
    targetAudience: '开业期间 7.18-7.24 限时专享 · 无限时',
    durationMinutes: 0,
    overtimeRule: '当日不限时',
    includedItems: ['三人入场', '付两人价', '材料齐全', '合影服务'],
    badge: '开业限定',
    skipOpeningDiscount: true,
    status: 'on_sale',
  },
  {
    id: 'weekend-solo',
    name: '单人无限时',
    price: 69.9,
    weekendPrice: 69.9,
    weekdayPrice: 49.9,
    targetAudience: '单人到店畅拼',
    durationMinutes: 0,
    overtimeRule: '当日不限时',
    includedItems: ['拼豆材料', '图纸任选', '现场指导', '成品熨烫'],
    status: 'on_sale',
  },
  {
    id: 'solo-2h',
    name: '单人2小时',
    price: 39.9,
    weekendPrice: 39.9,
    weekdayPrice: 29.9,
    targetAudience: '轻体验 · 可升级无限时',
    durationMinutes: 120,
    overtimeRule: '到点结束',
    includedItems: ['拼豆材料', '图纸任选', '现场指导'],
    status: 'on_sale',
  },
  {
    id: 'solo-1h',
    name: '单人1小时',
    price: 24.9,
    weekendPrice: 24.9,
    weekdayPrice: 15.9,
    targetAudience: '尝鲜试玩',
    durationMinutes: 60,
    overtimeRule: '到点结束',
    includedItems: ['拼豆材料', '图纸任选', '现场指导'],
    status: 'on_sale',
  },
  {
    id: 'weekend-duo',
    name: '双人无限时',
    price: 119.9,
    weekendPrice: 119.9,
    weekdayPrice: 91.9,
    targetAudience: '闺蜜 / 情侣 / 同学同行',
    durationMinutes: 0,
    overtimeRule: '当日不限时',
    includedItems: ['双人材料', '图纸任选', '合影拍照', '成品包装'],
    status: 'on_sale',
  },
  {
    id: 'duo-2h',
    name: '双人2小时',
    price: 69.9,
    weekendPrice: 69.9,
    weekdayPrice: 55.9,
    targetAudience: '双人轻体验 · 可升级无限时',
    durationMinutes: 120,
    overtimeRule: '到点结束',
    includedItems: ['双人材料', '图纸任选', '现场指导'],
    status: 'on_sale',
  },
  {
    id: 'duo-1h',
    name: '双人1小时',
    price: 49.9,
    weekendPrice: 49.9,
    weekdayPrice: 29.9,
    targetAudience: '双人尝鲜试玩',
    durationMinutes: 60,
    overtimeRule: '到点结束',
    includedItems: ['双人材料', '图纸任选', '现场指导'],
    status: 'on_sale',
  },
  {
    id: 'weekend-family',
    name: '亲子无限时',
    price: 79.9,
    weekendPrice: 79.9,
    weekdayPrice: 59.9,
    targetAudience: '1 大 1 小亲子',
    durationMinutes: 0,
    overtimeRule: '当日不限时',
    includedItems: ['亲子材料', '儿童友好图纸', '安全指导', '合影拍照'],
    status: 'on_sale',
  },
];

const packages = packagesRaw.map((item, index) => ({
  sortOrder: (index + 1) * 10,
  onShelf: true,
  ...item,
}));

/** China local wall time -> epoch ms (Asia/Shanghai, UTC+8). */
function chinaLocalMs(year, month, day, hour, minute) {
  return Date.UTC(year, month - 1, day, hour - 8, minute, 0);
}

const activitiesRaw = [
  {
    id: 'mayday',
    name: '五月天主题拼豆',
    price: 99,
    capacity: 28,
    registeredCount: 0,
    status: 'recruiting',
    keyword: '五月天',
    startAt: chinaLocalMs(2026, 7, 18, 14, 0),
    scheduleText: '开业首周 D1–D2',
    timeText: '下午场 / 晚场（以社群通知为准）',
    audience: '五月天粉丝、年轻女性、喜欢主题手作的朋友',
    content: '主题色卡与歌单氛围下完成一件小作品，可上粉丝作品墙；不使用受版权保护的官方图案，以情绪色与自选灵感为主。',
    includes: ['主题图纸/色卡灵感', '基础材料', '歌单氛围', '作品合影'],
    notice: '一人一报；具体开场时间以本页日程与社群通知为准。开始前 24 小时外可全额取消，24 小时内取消扣实付 30%。',
  },
  {
    id: 'squid-game',
    name: '大学生鱿鱼游戏',
    price: 39,
    capacity: 24,
    registeredCount: 0,
    status: 'recruiting',
    keyword: '鱿鱼局',
    startAt: chinaLocalMs(2026, 7, 21, 14, 0),
    scheduleText: '开业首周 D4–D5',
    timeText: '约 90 分钟 / 场',
    audience: '大学生、朋友组队',
    content: '三关迷你季：123 木头人热身 → 豆糖饼主秀 → 色路决赛。紧张好看、适合出片。',
    includes: ['指定小图纸', '公共豆盘', '关卡主持', '前三名无限时权益'],
    notice: '报名费可抵扣当日拼豆消费；前三名获无限时体验。犯规惩罚为暂停/旁观，不拆作品。开始前 24 小时外可全额取消，24 小时内取消扣实付 30%。',
  },
  {
    id: 'craft-meetup',
    name: '拼豆交流会',
    price: 39,
    capacity: 30,
    registeredCount: 0,
    status: 'recruiting',
    keyword: '交流会',
    startAt: chinaLocalMs(2026, 7, 24, 19, 0),
    scheduleText: '开业首周 D7',
    timeText: '晚间场（以社群通知为准）',
    audience: '拼豆爱好者、开业首周到店用户',
    content: '带上最得意的作品参加展示与评选，互相交流图纸与技巧，认识同好。',
    includes: ['作品展示位', '评选环节', '同好交流', '合影'],
    notice: '欢迎携带五月天 / 鱿鱼局作品参赛；现场也可轻度补豆打磨。开始前 24 小时外可全额取消，24 小时内取消扣实付 30%。',
  },
  {
    id: 'birthday',
    name: '生日会 / 团建 / 包场',
    price: 1999,
    capacity: 40,
    registeredCount: 0,
    status: 'consulting',
    keyword: '包场',
    scheduleText: '档期协商',
    timeText: '按包场场次协商',
    audience: '生日聚会、团建、朋友包场',
    content: '整场空间定制：流程、人数、主题与材料方案与店主确认后执行。',
    includes: ['整场空间', '材料方案协商', '流程定制'],
    notice: '本页不开放在线报名，请联系店主确认档期与报价。',
  },
];

const activities = activitiesRaw.map((item, index) => ({
  sortOrder: (index + 1) * 10,
  onShelf: true,
  ...item,
}));

const timeSlots = require('../utils/storePublic').DEFAULT_TIME_SLOTS.slice();

const { buildSeatsFromTables } = require('../utils/seats');

const tables = [
  { code: 'F1-A', area: 'F1一楼·左墙', capacity: 6, bookable: true },
  { code: 'F1-B', area: 'F1一楼·窗边', capacity: 2, bookable: true },
  { code: 'F1-C', area: 'F1一楼·长桌', capacity: 6, bookable: true },
  { code: 'F2-A', area: 'F2二楼·左墙', capacity: 6, bookable: true },
  { code: 'F2-B', area: 'F2二楼·右墙', capacity: 6, bookable: true },
  { code: 'F2-C', area: 'F2二楼·长桌', capacity: 6, bookable: true },
];

const seats = buildSeatsFromTables(tables, { seatIdSeparator: '' });

function chinaToday() {
  const china = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const year = china.getUTCFullYear();
  const month = String(china.getUTCMonth() + 1).padStart(2, '0');
  const day = String(china.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const today = chinaToday();

const seatOccupancies = [
  { date: today, timeSlot: '12:00-14:00', seatId: 'F1-B1', type: 'reserved' },
  { date: today, timeSlot: '12:00-14:00', seatId: 'F1-B2', type: 'reserved' },
  { date: today, timeSlot: '12:00-14:00', seatId: 'F1-A1', type: 'in_use', remainingMinutes: 58 },
  { date: today, timeSlot: '12:00-14:00', seatId: 'F2-B3', type: 'maintenance' },
];

const rechargePlans = [
  { id: 'r100', rechargeAmount: 100, bonusAmount: 10, arrivalAmount: 110, audience: '尝鲜入门 / 学生' },
  { id: 'r300', rechargeAmount: 300, bonusAmount: 40, arrivalAmount: 340, audience: '闺蜜 / 亲子 / 复购用户' },
  { id: 'r500', rechargeAmount: 500, bonusAmount: 80, arrivalAmount: 580, audience: '累计满 500 可升 VIP' },
  { id: 'r1000', rechargeAmount: 1000, bonusAmount: 180, arrivalAmount: 1180, audience: '累计满 1000 可升 SVIP' },
];

const memberTags = ['学生', '亲子', '五月天粉丝', '美团用户', '小红书用户', '楼内用户', '老客', '高意向包场', '体验官', '暑期课包用户'];

const coupons = [
  { name: '打卡奖励 · 赠送 2 小时', category: 'checkin', benefitType: 'hours', benefitValue: 2 },
  { name: '老师专属 · 8 折', category: 'teacher', benefitType: 'discount', benefitValue: 8 },
  { name: '活动优惠 · 赠送 3 小时', category: 'best_work', benefitType: 'hours', benefitValue: 3 },
  { name: '打卡奖励 · 8 折', category: 'checkin', benefitType: 'discount', benefitValue: 8 },
  { name: '老师专属 · 赠送 1 小时', category: 'teacher', benefitType: 'hours', benefitValue: 1 },
];

const stampRules = [
  { action: '到店完成一次体验', stampDelta: 1 },
  { action: '带新朋友到店', stampDelta: 1 },
  { action: '参加主题局', stampDelta: 1 },
  { action: '美团用户转会员', stampDelta: 1 },
];

const memberProfile = {
  nickname: '小豆',
  tags: ['学生', '体验官'],
  totalBalance: 168,
  principalBalance: 140,
  bonusBalance: 28,
  totalSpent: 89,
  visitCount: 1,
  stampCount: 2,
  stampTarget: 5,
  lastVisitAt: '2026-07-03',
  communityTip: '到店后扫码加入 Bean 拼豆社群',
  coupons: [
    {
      id: 'c1',
      name: '打卡奖励 · 赠送 2 小时',
      category: 'checkin',
      benefitType: 'hours',
      benefitValue: 2,
      status: 'unused',
      available: true,
      unavailableReason: '',
      validFrom: Date.now() - 7 * 24 * 3600 * 1000,
      expireAt: Date.now() + 30 * 24 * 3600 * 1000,
    },
    {
      id: 'c2',
      name: '老师专属 · 8 折',
      category: 'teacher',
      benefitType: 'discount',
      benefitValue: 8,
      status: 'unused',
      available: true,
      unavailableReason: '',
      validFrom: Date.now() - 7 * 24 * 3600 * 1000,
      expireAt: Date.now() + 30 * 24 * 3600 * 1000,
    },
    {
      id: 'c5',
      name: '活动优惠 · 赠送 3 小时',
      category: 'best_work',
      benefitType: 'hours',
      benefitValue: 3,
      status: 'unused',
      available: true,
      unavailableReason: '',
      validFrom: Date.now() + 3 * 24 * 3600 * 1000,
      expireAt: Date.now() + 40 * 24 * 3600 * 1000,
    },
    {
      id: 'c3',
      name: '打卡奖励 · 8 折',
      category: 'checkin',
      benefitType: 'discount',
      benefitValue: 8,
      status: 'used',
      available: false,
      usedAt: Date.now() - 7 * 24 * 3600 * 1000,
      validFrom: Date.now() - 20 * 24 * 3600 * 1000,
      expireAt: Date.now() + 10 * 24 * 3600 * 1000,
    },
    {
      id: 'c4',
      name: '老师专属 · 赠送 1 小时',
      category: 'teacher',
      benefitType: 'hours',
      benefitValue: 1,
      status: 'expired',
      available: false,
      validFrom: Date.now() - 40 * 24 * 3600 * 1000,
      expireAt: Date.now() - 2 * 24 * 3600 * 1000,
    },
  ],
  transactions: [
    { id: 't1', title: '标准拼豆体验', type: 'consume', packageId: 'standard', amount: -89, meta: '2026-07-03 · 余额支付', balanceAfter: 168 },
    { id: 't2', title: '充 100 送 10', type: 'recharge', amount: 110, meta: '2026-06-28 · 到账', balanceAfter: 257 },
    { id: 't3', title: '活动报名 · 开业手作场', type: 'consume', amount: -39, meta: '2026-07-10 · 余额支付', balanceAfter: 129 },
  ],
  appointments: [
    { id: 'a1', packageName: '双人主题套餐', date: '2026-07-12', timeSlot: '12:00-14:00', status: '已确认', peopleCount: 2 },
    { id: 'a2', packageName: '标准拼豆体验', date: '2026-07-03', timeSlot: '14:00-16:00', status: '已完成', peopleCount: 1 },
  ],
  stampLogs: [
    { id: 's1', action: '到店完成一次体验', stampDelta: 1, at: '2026-07-03' },
    { id: 's2', action: '美团用户转会员', stampDelta: 1, at: '2026-06-28' },
  ],
};

const store = {
  ...require('../utils/storePublic').DEFAULT_STORE,
  heroPhotos: require('../utils/homeBanners').DEFAULT_HERO_PHOTOS,
  packagePromo: {
    active: true,
    discountRate: 8,
    label: '开业七天',
    tip: '全场8折',
  },
};

const fiveBallPatterns = [
  {
    key: 'yellow',
    color: '#facc15',
    mouth: 'smirk',
    eyes: 'droopy',
    eyeColor: '#ec4899',
  },
  {
    key: 'orange',
    color: '#f97316',
    mouth: 'flat',
    eyes: 'round',
    eyeColor: '#22c55e',
  },
  {
    key: 'pink',
    color: '#ec4899',
    mouth: 'wave',
    eyes: 'oval',
    eyeColor: '#38bdf8',
  },
  {
    key: 'blue',
    color: '#0ea5e9',
    mouth: 'heart',
    eyes: 'glasses',
    eyeColor: '#facc15',
  },
  {
    key: 'green',
    color: '#22c55e',
    mouth: 'cat',
    eyes: 'tiny',
    eyeColor: '#f97316',
  },
];

module.exports = {
  store,
  packages,
  activities,
  timeSlots,
  tables,
  seats,
  seatOccupancies,
  today,
  rechargePlans,
  memberTags,
  coupons,
  stampRules,
  memberProfile,
  fiveBallPatterns,
};
