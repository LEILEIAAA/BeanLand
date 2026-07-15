const seed = require('../data/seed');
const { db, callFunction } = require('./cloud');
const { buildOccupancyId } = require('./cloudbaseIds');

/** 开发期无云数据时可回退 seed；上线前改为 false */
const ALLOW_SEED_FALLBACK = true;

function unwrapDocs(result) {
  const data = (result && result.data) || [];
  return Array.isArray(data) ? data : [];
}

async function readCollection(name) {
  const result = await db().collection(name).limit(100).get();
  return unwrapDocs(result);
}

async function withSeedFallback(loader, fallbackValue, label) {
  try {
    const rows = await loader();
    if (Array.isArray(rows) && rows.length === 0 && ALLOW_SEED_FALLBACK) {
      console.warn(`[api] ${label} empty, fallback to seed`);
      return fallbackValue;
    }
    return rows;
  } catch (error) {
    if (!ALLOW_SEED_FALLBACK) {
      throw error;
    }
    console.warn(`[api] ${label} failed, fallback to seed`, error);
    return fallbackValue;
  }
}

function getPackages() {
  return withSeedFallback(() => readCollection('packages'), seed.packages, 'packages');
}

function getActivities() {
  return withSeedFallback(() => readCollection('activities'), seed.activities, 'activities');
}

async function getStore() {
  try {
    const result = await db().collection('store').doc('main').get();
    if (result && result.data) {
      return result.data;
    }
  } catch (error) {
    if (!ALLOW_SEED_FALLBACK) {
      throw error;
    }
    console.warn('[api] store failed, fallback to seed', error);
  }

  try {
    const rows = await readCollection('store');
    if (rows.length) {
      return rows[0];
    }
  } catch (error) {
    if (!ALLOW_SEED_FALLBACK) {
      throw error;
    }
  }

  return seed.store;
}

function getTables() {
  return withSeedFallback(() => readCollection('tables'), seed.tables, 'tables');
}

function getSeats() {
  return withSeedFallback(() => readCollection('seats'), seed.seats, 'seats');
}

async function getTimeSlots() {
  try {
    const rows = await readCollection('time_slots');
    if (rows.length === 1 && Array.isArray(rows[0].slots)) {
      return rows[0].slots;
    }
    if (rows.length) {
      return rows.map((row) => row.label || row.slot || row).filter(Boolean);
    }
    if (ALLOW_SEED_FALLBACK) {
      return seed.timeSlots;
    }
    return [];
  } catch (error) {
    if (!ALLOW_SEED_FALLBACK) {
      throw error;
    }
    console.warn('[api] time_slots failed, fallback to seed', error);
    return seed.timeSlots;
  }
}

function getRechargePlans() {
  return withSeedFallback(
    () => readCollection('recharge_plans'),
    seed.rechargePlans,
    'recharge_plans',
  );
}

function getStampRules() {
  return withSeedFallback(() => readCollection('stamp_rules'), seed.stampRules, 'stamp_rules');
}

async function getOccupancies(date, timeSlot) {
  try {
    const result = await db()
      .collection('seat_occupancies')
      .where({
        date,
        timeSlot,
      })
      .limit(200)
      .get();
    return unwrapDocs(result);
  } catch (error) {
    if (!ALLOW_SEED_FALLBACK) {
      throw error;
    }
    console.warn('[api] seat_occupancies failed, fallback to seed', error);
    return (seed.seatOccupancies || []).filter(
      (row) => row.date === date && row.timeSlot === timeSlot,
    );
  }
}

async function createAppointment(payload) {
  const result = await callFunction('createAppointment', payload);
  return (result && result.result) || result;
}

async function cancelAppointment(payload) {
  const result = await callFunction('cancelAppointment', payload);
  return (result && result.result) || result;
}

async function listMyAppointments() {
  const result = await callFunction('listMyAppointments', {});
  return (result && result.result && result.result.list) || [];
}

async function adminListAppointments(payload) {
  const result = await callFunction('adminListAppointments', payload || {});
  return (result && result.result && result.result.list) || [];
}

async function adminUpdateAppointment(payload) {
  const result = await callFunction('adminUpdateAppointment', payload);
  return (result && result.result) || result;
}

async function ensureMember(payload) {
  const result = await callFunction('ensureMember', payload || {});
  return (result && result.result) || result;
}

async function getMyMember() {
  const result = await callFunction('getMyMember', {});
  return (result && result.result) || result;
}

async function listMyTransactions(payload) {
  const result = await callFunction('listMyTransactions', payload || {});
  return (result && result.result) || result;
}

async function adminFindMember(payload) {
  const result = await callFunction('adminFindMember', payload || {});
  return (result && result.result) || result;
}

async function adminRecharge(payload) {
  const result = await callFunction('adminRecharge', payload || {});
  return (result && result.result) || result;
}

async function fetchWechatPhone(code) {
  const result = await callFunction('getPhoneNumber', { code });
  return (result && result.result) || result;
}

async function createRechargeOrder(payload) {
  const result = await callFunction('createRechargeOrder', payload || {});
  return (result && result.result) || result;
}

async function getRechargeOrder(payload) {
  const result = await callFunction('getRechargeOrder', payload || {});
  return (result && result.result) || result;
}

async function purchasePackage(payload) {
  const result = await callFunction('purchasePackage', payload || {});
  return (result && result.result) || result;
}

async function createPackageOrder(payload) {
  const result = await callFunction('createPackageOrder', payload || {});
  return (result && result.result) || result;
}

async function getPackageOrder(payload) {
  const result = await callFunction('getPackageOrder', payload || {});
  return (result && result.result) || result;
}

async function listMyWorks(payload) {
  const result = await callFunction('listMyWorks', payload || {});
  return (result && result.result) || result;
}

async function createWork(payload) {
  const result = await callFunction('createWork', payload || {});
  return (result && result.result) || result;
}

async function deleteWork(payload) {
  const result = await callFunction('deleteWork', payload || {});
  return (result && result.result) || result;
}

async function listMyCoupons(payload) {
  const result = await callFunction('listMyCoupons', payload || {});
  return (result && result.result) || result;
}

async function adminListMemberCoupons(payload) {
  const result = await callFunction('adminListMemberCoupons', payload || {});
  return (result && result.result) || result;
}

async function adminRedeemCoupon(payload) {
  const result = await callFunction('adminRedeemCoupon', payload || {});
  return (result && result.result) || result;
}

async function adminIssueCoupon(payload) {
  const result = await callFunction('adminIssueCoupon', payload || {});
  return (result && result.result) || result;
}

module.exports = {
  ALLOW_SEED_FALLBACK,
  buildOccupancyId,
  getPackages,
  getActivities,
  getStore,
  getTables,
  getSeats,
  getTimeSlots,
  getRechargePlans,
  getStampRules,
  getOccupancies,
  createAppointment,
  cancelAppointment,
  listMyAppointments,
  adminListAppointments,
  adminUpdateAppointment,
  ensureMember,
  getMyMember,
  listMyTransactions,
  listMyCoupons,
  adminFindMember,
  adminListMemberCoupons,
  adminRedeemCoupon,
  adminIssueCoupon,
  adminRecharge,
  fetchWechatPhone,
  createRechargeOrder,
  getRechargeOrder,
  purchasePackage,
  createPackageOrder,
  getPackageOrder,
  listMyWorks,
  createWork,
  deleteWork,
};
