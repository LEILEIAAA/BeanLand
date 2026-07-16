const api = require('../../utils/api');
const { activities: seedActivities } = require('../../data/seed');
const { syncTabBar } = require('../../utils/tabBar');

const COVER_POOL = [
  '/assets/background/images1.jpg',
  '/assets/background/image3.jpg',
  '/assets/background/images2.jpg',
];

const ACTIVITY_STATUS_LABEL = {
  recruiting: '招募中',
  consulting: '咨询中',
  full: '已满员',
  ended: '已结束',
  cancelled: '已取消',
  draft: '未发布',
};

/** 开业首周日程（改期只改这里） */
const OPENING_WEEK = [
  { day: '1-2', title: '五月天主题拼豆', note: '开业第一场，歌单与作品墙', status: '报名中', kind: 'event' },
  { day: '3', title: '散场日', note: '无主题局，可预约日常座位', status: '可预约', kind: 'rest' },
  { day: '4-5', title: '大学生鱿鱼游戏', note: '三关迷你季，紧张好看又能出片', status: '报名中', kind: 'event' },
  { day: '6', title: '散场日', note: '休整补豆，作品继续打磨', status: '可预约', kind: 'rest' },
  { day: '7', title: '拼豆交流会', note: '带上最得意的作品来评选', status: '报名中', kind: 'event' },
];

const ACTIVITY_LOOKS = {
  mayday: {
    accent: '#FFB80A',
    enLabel: 'LIVE',
    orbInk: '#18181b',
    category: 'theme',
    blurb: '开业第一场。歌单、色卡、作品墙——先把夏天拼出来',
  },
  'squid-game': {
    accent: '#FF3D02',
    enLabel: 'GAME',
    orbInk: '#ffffff',
    category: 'game',
    blurb: '大学生专场三关局。报名费可抵扣消费，前三送无限时',
  },
  'craft-meetup': {
    accent: '#69D868',
    enLabel: 'MEET',
    orbInk: '#18181b',
    category: 'meetup',
    blurb: '带上最得意的作品，评选、交流、认识同好',
  },
  birthday: {
    accent: '#FF3D02',
    enLabel: 'VIP',
    orbInk: '#ffffff',
    category: 'private',
    blurb: '生日会 / 团建 / 包场，整场都是你的',
  },
};

const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'recruiting', label: '招募中' },
  { id: 'theme', label: '五月天' },
  { id: 'game', label: '鱿鱼局' },
  { id: 'meetup', label: '交流会' },
  { id: 'private', label: '包场' },
];

function decorateActivities(list) {
  return (list || []).map((item, index) => {
    const id = item.id || item._id;
    const look = ACTIVITY_LOOKS[id] || {
      accent: '#FFB80A',
      enLabel: 'DROP',
      orbInk: '#18181b',
      category: 'all',
      blurb: '开业主题局，欢迎来玩',
    };
    const registeredCount = Number(item.registeredCount || 0);
    const capacity = Number(item.capacity || 0);
    return {
      ...item,
      ...look,
      id,
      cover: COVER_POOL[index % COVER_POOL.length],
      statusLabel: ACTIVITY_STATUS_LABEL[item.status] || item.status,
      dropNo: String(index + 1).padStart(2, '0'),
      shift: index % 2 === 1 ? 'shift-right' : 'shift-left',
      registeredCount,
      capacity,
      seatLabel: `${registeredCount}/${capacity}`,
    };
  });
}

function filterActivities(list, filterId) {
  if (filterId === 'all') return list;
  if (filterId === 'recruiting') {
    return list.filter((item) => item.status === 'recruiting');
  }
  return list.filter((item) => item.category === filterId);
}

Page({
  data: {
    filters: FILTERS,
    openingWeek: OPENING_WEEK,
    activeFilter: 'all',
    allActivities: [],
    activities: [],
    featuredCount: 0,
  },
  onShow() {
    syncTabBar(this, 1);
    this.loadActivities();
  },
  async loadActivities() {
    let rows = seedActivities;
    try {
      const cloudRows = await api.getActivities();
      if (cloudRows && cloudRows.length) rows = cloudRows;
    } catch (error) {
      console.warn('[activities] load failed', error);
    }
    const allActivities = decorateActivities(rows);
    const activeFilter = this.data.activeFilter;
    this.setData({
      allActivities,
      activities: filterActivities(allActivities, activeFilter),
      featuredCount: allActivities.filter((item) => item.status === 'recruiting').length,
    });
  },
  onFilterTap(event) {
    const filterId = event.currentTarget.dataset.id;
    if (!filterId || filterId === this.data.activeFilter) return;
    this.setData({
      activeFilter: filterId,
      activities: filterActivities(this.data.allActivities, filterId),
    });
  },
  join(event) {
    const id = event.currentTarget.dataset.id || '';
    if (!id) {
      wx.showToast({ title: '请选择活动', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/activities/register/index?activityId=${id}` });
  },
});
