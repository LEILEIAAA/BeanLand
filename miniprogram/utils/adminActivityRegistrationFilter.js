const {

  STATUS,

  ADMIN_CANCELLED_STATUSES,

  isActivityRegistrationEffective,

} = require('./activityRegistration');



const ADMIN_ACTIVITY_REG_FILTER_TABS = [

  { key: '', label: '全部' },

  { key: 'paid', label: '已报名' },

  { key: 'effective', label: '已生效' },

  { key: 'cancelled', label: '已取消' },

];



const DEFAULT_ADMIN_ACTIVITY_REG_FILTER = '';



const CANCELLED_SET = new Set(ADMIN_CANCELLED_STATUSES);



function filterAdminActivityRegistrations(list, filterKey, now = Date.now()) {

  const rows = Array.isArray(list) ? list : [];

  const key = filterKey == null ? DEFAULT_ADMIN_ACTIVITY_REG_FILTER : String(filterKey);

  if (!key) return rows.slice();

  if (key === STATUS.PAID || key === 'paid') {

    return rows.filter((item) => (item && item.status) === STATUS.PAID);

  }

  if (key === 'effective') {

    return rows.filter((item) =>

      isActivityRegistrationEffective(item, item && item.activityStartAt, now),

    );

  }

  if (key === 'cancelled') {

    return rows.filter((item) => CANCELLED_SET.has(item && item.status));

  }

  return rows.filter((item) => (item && item.status) === key);

}



module.exports = {

  ADMIN_ACTIVITY_REG_FILTER_TABS,

  DEFAULT_ADMIN_ACTIVITY_REG_FILTER,

  filterAdminActivityRegistrations,

};


