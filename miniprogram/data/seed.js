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

const timeSlots = ['10:00-12:00', '13:00-15:00', '15:30-17:30', '18:30-20:30', '20:30-22:00'];

const tables = [
  { code: 'W1', area: '窗边区', capacity: 4 },
  { code: 'W2', area: '窗边区', capacity: 4 },
  { code: 'A1', area: '日常体验区', capacity: 4 },
  { code: 'A2', area: '日常体验区', capacity: 4 },
  { code: 'A3', area: '日常体验区', capacity: 4 },
  { code: 'A4', area: '日常体验区', capacity: 4 },
  { code: 'L1', area: '长桌区', capacity: 8 },
  { code: 'E1', area: '活动区', capacity: 12 },
  { code: 'E2', area: '活动区', capacity: 12 },
];

const rechargePlans = [
  { id: 'r100', rechargeAmount: 100, bonusAmount: 10, arrivalAmount: 110, audience: '学生 / 轻度用户' },
  { id: 'r300', rechargeAmount: 300, bonusAmount: 40, arrivalAmount: 340, audience: '闺蜜 / 亲子 / 复购用户' },
  { id: 'r500', rechargeAmount: 500, bonusAmount: 80, arrivalAmount: 580, audience: '亲子课包 / 粉丝 / 高频用户' },
];

const memberTags = ['学生', '亲子', '五月天粉丝', '美团用户', '小红书用户', '楼内用户', '老客', '高意向包场', '体验官', '暑期课包用户'];

const coupons = [
  { name: '美团转会员 10 元券', amount: 10, scope: '美团用户到店后注册会员' },
  { name: '双人同行 20 元券', amount: 20, scope: '双人主题套餐' },
  { name: '学生暑期 10 元券', amount: 10, scope: '学生轻体验 / 暑期复购' },
  { name: '生日月小礼券', amount: 15, scope: '生日月会员' },
  { name: '主题局优先券', amount: 0, scope: '粉丝主题局优先报名' },
];

const stampRules = [
  { action: '到店完成一次体验', stampDelta: 1 },
  { action: '带新朋友到店', stampDelta: 1 },
  { action: '参加主题局', stampDelta: 1 },
  { action: '美团用户转会员', stampDelta: 1 },
];

const store = {
  name: 'Bean 拼豆手作',
  slogan: '在顶楼落地窗边，把喜欢拼成可以带走的作品',
  address: '杭州市拱墅区上塘路 259 号（假山路口）新青年广场 A 座顶楼',
  routeTip: '第一次来如果找不到，可以直接联系店主或询问前台 / 保安。',
  phone: '待填写',
  wechat: '待填写',
  markerName: 'Bean 拼豆手作',
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
  rechargePlans,
  memberTags,
  coupons,
  stampRules,
  fiveBallPatterns,
};
