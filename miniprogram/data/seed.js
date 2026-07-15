const packages = [
  {
    id: 'student-light',
    name: '学生轻体验',
    price: 49,
    targetAudience: '暑期学生 / 新客私域引流',
    durationMinutes: 90,
    overtimeRule: '超过 105 分钟建议升级标准体验',
    includedItems: ['基础拼豆材料', '新手图纸', '现场指导'],
    isRecommended: true,
    status: 'on_sale',
  },
  {
    id: 'standard',
    name: '标准拼豆体验',
    price: 89,
    targetAudience: '主力利润产品',
    durationMinutes: 120,
    overtimeRule: '15 元 / 30 分钟',
    includedItems: ['标准拼豆材料', '热门图纸', '成品熨烫', '拍照区使用'],
    isRecommended: true,
    status: 'on_sale',
  },
  {
    id: 'double-theme',
    name: '双人主题套餐',
    price: 149,
    targetAudience: '闺蜜 / 情侣 / 同学同行',
    durationMinutes: 120,
    overtimeRule: '20 元 / 30 分钟 / 桌',
    includedItems: ['双人材料', '主题图纸', '合影拍照', '成品包装'],
    isRecommended: true,
    status: 'on_sale',
  },
  {
    id: 'four-friends',
    name: '四人同行套餐',
    price: 268,
    targetAudience: '宿舍 / 学生小组',
    durationMinutes: 150,
    overtimeRule: '30 元 / 30 分钟 / 桌',
    includedItems: ['四人材料', '多人图纸', '长桌优先', '成品包装'],
    isRecommended: true,
    status: 'on_sale',
  },
  {
    id: 'family',
    name: '亲子 1 大 1 小',
    price: 129,
    targetAudience: '暑期亲子',
    durationMinutes: 120,
    overtimeRule: '15 元 / 30 分钟',
    includedItems: ['亲子材料', '儿童友好图纸', '安全指导', '合影拍照'],
    isRecommended: false,
    status: 'on_sale',
  },
  {
    id: 'mayday-theme',
    name: '五月天主题拼豆局',
    price: 99,
    targetAudience: '粉丝差异化活动',
    durationMinutes: 150,
    overtimeRule: '活动制，原则不自由续时',
    includedItems: ['主题图纸', '粉丝交流', '限定拍照位', '社群入口'],
    isRecommended: true,
    status: 'on_sale',
  },
  {
    id: 'birthday-party',
    name: '生日会 / 包场',
    price: 1299,
    targetAudience: '高客单活动',
    durationMinutes: 180,
    overtimeRule: '200-300 元 / 小时',
    includedItems: ['包场布置', '主题材料', '活动主持建议', '合影服务'],
    isRecommended: false,
    status: 'on_sale',
  },
];

const activities = [
  { id: 'summer-partner', name: '暑期拼豆搭子计划', price: 49, capacity: 24, status: 'recruiting' },
  { id: 'four-table', name: '四人一桌拼豆局', price: 68, capacity: 32, status: 'recruiting' },
  { id: 'mayday', name: '五月天主题拼豆局', price: 99, capacity: 28, status: 'recruiting' },
  { id: 'family-craft', name: '亲子手作场', price: 129, capacity: 20, status: 'recruiting' },
  { id: 'summer-class', name: '儿童暑期课', price: 199, capacity: 16, status: 'recruiting' },
  { id: 'birthday', name: '生日会 / 包场', price: 1299, capacity: 40, status: 'consulting' },
  { id: 'trial-officer', name: '试营业体验官招募', price: 29.9, capacity: 30, status: 'recruiting' },
];

const timeSlots = [
  '10:00-12:00',
  '12:00-14:00',
  '14:00-16:00',
  '16:00-18:00',
  '18:00-20:00',
  '20:00-22:00',
];

const { buildSeatsFromTables } = require('../utils/seats');

const tables = [
  { code: 'F1-LW1', area: 'F1一楼·左墙', capacity: 3, bookable: true },
  { code: 'F1-LW2', area: 'F1一楼·左墙', capacity: 3, bookable: true },
  { code: 'F1-W1', area: 'F1一楼·窗边', capacity: 2, bookable: true },
  { code: 'F1-L', area: 'F1一楼·长桌', capacity: 6, bookable: true },
  { code: 'F2-LW1', area: 'F2二楼·左墙', capacity: 3, bookable: true },
  { code: 'F2-LW2', area: 'F2二楼·左墙', capacity: 3, bookable: true },
  { code: 'F2-RW1', area: 'F2二楼·右墙', capacity: 3, bookable: true },
  { code: 'F2-RW2', area: 'F2二楼·右墙', capacity: 3, bookable: true },
  { code: 'F2-L', area: 'F2二楼·长桌', capacity: 8, bookable: true },
];

const seats = buildSeatsFromTables(tables);

function chinaToday() {
  const china = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const year = china.getUTCFullYear();
  const month = String(china.getUTCMonth() + 1).padStart(2, '0');
  const day = String(china.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const today = chinaToday();

const seatOccupancies = [
  { date: today, timeSlot: '12:00-14:00', seatId: 'F1-W1-1', type: 'reserved' },
  { date: today, timeSlot: '12:00-14:00', seatId: 'F1-W1-2', type: 'reserved' },
  { date: today, timeSlot: '12:00-14:00', seatId: 'F1-LW1-1', type: 'in_use', remainingMinutes: 58 },
  { date: today, timeSlot: '12:00-14:00', seatId: 'F2-RW1-3', type: 'maintenance' },
];

const rechargePlans = [
  { id: 'r100', rechargeAmount: 0.02, bonusAmount: 0.01, arrivalAmount: 0.03, audience: '调试档：本金+赠金（上线前改回）' },
  { id: 'r300', rechargeAmount: 300, bonusAmount: 40, arrivalAmount: 340, audience: '闺蜜 / 亲子 / 复购用户' },
  { id: 'r500', rechargeAmount: 500, bonusAmount: 80, arrivalAmount: 580, audience: '亲子课包 / 粉丝 / 高频用户' },
];

const memberTags = ['学生', '亲子', '五月天粉丝', '美团用户', '小红书用户', '楼内用户', '老客', '高意向包场', '体验官', '暑期课包用户'];

const coupons = [
  { name: '打卡奖励 · 赠送 2 小时', category: 'checkin', benefitType: 'hours', benefitValue: 2 },
  { name: '老师专属 · 8 折', category: 'teacher', benefitType: 'discount', benefitValue: 8 },
  { name: '最佳作品 · 赠送 3 小时', category: 'best_work', benefitType: 'hours', benefitValue: 3 },
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
      name: '最佳作品 · 赠送 3 小时',
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
    { id: 't1', title: '标准拼豆体验', type: 'consume', amount: -89, meta: '2026-07-03 · 余额支付', balanceAfter: 168 },
    { id: 't2', title: '充 100 送 10', type: 'recharge', amount: 110, meta: '2026-06-28 · 到账', balanceAfter: 257 },
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
  name: 'Bean Land',
  slogan: '拼一局，带走一块自己的光',
  address: '杭州市拱墅区上塘路 259 号（假山路口）新青年广场 A幢2617',
  shortAddress: '杭州市拱墅区上塘路 259 号 · 新青年广场 A幢2617',
  routeTip: '第一次来如果找不到，可以直接联系店主或询问前台 / 保安。',
  phone: '待填写',
  wechat: '待填写',
  markerName: 'Bean Land',
  latitude: 30.2868,
  longitude: 120.1453,
  scale: 17,
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
