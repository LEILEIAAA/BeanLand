const api = require('../../utils/api');
const { syncTabBar } = require('../../utils/tabBar');
const { DEFAULT_AVATAR } = require('../../utils/wxProfile');
const {
  needsMemberRegister,
  openMemberRegister,
} = require('../../utils/memberRegisterGate');
const {
  normalizeActivityPageConfig,
  buildScheduleRows,
} = require('../../utils/activityPageConfig');
const {
  normalizeKeyword,
  buildActivityFilters,
  filterActivities,
} = require('../../utils/activityFilters');
const {
  resolveActivityCover,
  fallbackActivityCover,
} = require('../../utils/activityCover');
const { formatYuan } = require('../../utils/money');

// 角标配色预设，与云函数 ACCENT_THEMES 对齐；后台可切换。
const ACCENT_THEMES = {
  yellow: { accent: '#FFB80A', orbInk: '#18181b' },
  orange: { accent: '#FF3D02', orbInk: '#ffffff' },
  green: { accent: '#69D868', orbInk: '#18181b' },
};

const ACTIVITY_STATUS_LABEL = {
  recruiting: '招募中',
  consulting: '咨询中',
  full: '已满员',
  ended: '已结束',
  cancelled: '已取消',
  draft: '未发布',
};

const ACTIVITY_LOOKS = {
  mayday: {
    accent: '#FFB80A',
    enLabel: 'LIVE',
    orbInk: '#18181b',
    blurb: '开业第一场。歌单、色卡、作品墙——先把夏天拼出来',
  },
  'squid-game': {
    accent: '#FF3D02',
    enLabel: 'GAME',
    orbInk: '#ffffff',
    blurb: '大学生专场三关局。报名费可抵扣消费，前三送无限时',
  },
  'craft-meetup': {
    accent: '#69D868',
    enLabel: 'MEET',
    orbInk: '#18181b',
    blurb: '带上最得意的作品，评选、交流、认识同好',
  },
  birthday: {
    accent: '#FF3D02',
    enLabel: 'VIP',
    orbInk: '#ffffff',
    blurb: '生日会 / 团建 / 包场，整场都是你的',
  },
};

function decorateActivities(list) {
  return (list || []).map((item, index) => {
    const id = item.id || item._id;
    const look = ACTIVITY_LOOKS[id] || {
      accent: '#FFB80A',
      enLabel: 'DROP',
      orbInk: '#18181b',
      blurb: '开业主题局，欢迎来玩',
    };
    const registeredCount = Number(item.registeredCount || 0);
    const capacity = Number(item.capacity || 0);
    // 角标配色优先后台 accentTheme，缺省回退内置 look；海报文案同样以后台为准。
    const theme = ACCENT_THEMES[item.accentTheme] || null;
    return {
      ...item,
      accent: (theme && theme.accent) || look.accent,
      enLabel: look.enLabel,
      orbInk: (theme && theme.orbInk) || look.orbInk,
      keyword: normalizeKeyword(item.keyword),
      blurb: item.blurb || look.blurb || '开业主题局，欢迎来玩',
      id,
      cover: resolveActivityCover(item.coverImage, index),
      statusLabel: ACTIVITY_STATUS_LABEL[item.status] || item.status,
      dropNo: String(index + 1).padStart(2, '0'),
      shift: index % 2 === 1 ? 'shift-right' : 'shift-left',
      registeredCount,
      capacity,
      seatLabel: `${registeredCount}/${capacity}`,
      priceText: formatYuan(item.price),
    };
  });
}

const { shareBehavior } = require('../../utils/share');
Page({
  behaviors: [shareBehavior],
  data: {
    filters: buildActivityFilters([]),
    hero: normalizeActivityPageConfig(null).hero,
    scheduleTitle: normalizeActivityPageConfig(null).schedule.title,
    openingWeek: [],
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
    let rows = [];
    try {
      const cloudRows = await api.getActivities();
      if (Array.isArray(cloudRows)) rows = cloudRows;
    } catch (error) {
      console.warn('[activities] load failed', error);
    }
    let config = normalizeActivityPageConfig(null);
    let scheduleRows = null;
    try {
      const pageConfig = await api.getActivityPageConfig();
      if (pageConfig && pageConfig.activitiesPage) {
        config = normalizeActivityPageConfig(pageConfig.activitiesPage);
      }
      if (pageConfig && Array.isArray(pageConfig.scheduleRows) && pageConfig.scheduleRows.length) {
        scheduleRows = pageConfig.scheduleRows;
      }
    } catch (error) {
      console.warn('[activities] config load failed', error);
    }
    const sortedRows = (rows || [])
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const diff = (Number(a.row.sortOrder) || 0) - (Number(b.row.sortOrder) || 0);
        return diff !== 0 ? diff : a.index - b.index;
      })
      .map((item) => item.row);
    const allActivities = decorateActivities(sortedRows);
    const filters = buildActivityFilters(allActivities);
    let activeFilter = this.data.activeFilter;
    if (!filters.some((item) => item.id === activeFilter)) {
      activeFilter = 'all';
    }
    // 优先用云函数已 join 的日程（含未上架散场日）；否则本地用上架活动拼
    const openingWeek = scheduleRows || buildScheduleRows(config.schedule.items, allActivities);
    this.setData({
      hero: config.hero,
      scheduleTitle: config.schedule.title,
      openingWeek,
      filters,
      activeFilter,
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
  onActivityCoverError(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isFinite(index) || index < 0) return;
    const list = this.data.activities || [];
    const row = list[index];
    if (!row) return;
    const nextCover = fallbackActivityCover(index, row.cover);
    if (!nextCover || nextCover === row.cover) return;
    const patch = { [`activities[${index}].cover`]: nextCover };
    const allIndex = (this.data.allActivities || []).findIndex((item) => item.id === row.id);
    if (allIndex >= 0) {
      patch[`allActivities[${allIndex}].cover`] = nextCover;
    }
    this.setData(patch);
  },
  async join(event) {
    const id = event.currentTarget.dataset.id || '';
    if (!id) {
      wx.showToast({ title: '请选择活动', icon: 'none' });
      return;
    }
    try {
      const res = await api.getMyMember();
      const member = res && res.member;
      if (needsMemberRegister(member, DEFAULT_AVATAR)) {
        if (!openMemberRegister()) {
          wx.showToast({ title: '请先完成会员注册', icon: 'none' });
        }
        return;
      }
    } catch (error) {
      console.warn('[activities] join gate', error);
      if (!openMemberRegister()) {
        wx.showToast({ title: '请先完成会员注册', icon: 'none' });
      }
      return;
    }
    wx.navigateTo({ url: `/pages/activities/register/index?activityId=${id}` });
  },
});
