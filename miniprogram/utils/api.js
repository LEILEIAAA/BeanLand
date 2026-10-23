const seed = require('../data/seed');
const { db, callFunction } = require('./cloud');
const { buildOccupancyId } = require('./cloudbaseIds');
const { resolveStorePayload } = require('./storeResolve');
const { parseTimeSlotDocs } = require('./storePublic');

/** 生产关闭 seed 回退，避免审核/线上落到假数据 */
const ALLOW_SEED_FALLBACK = false;

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

async function getPackages() {
  try {
    const result = await callFunction('listPackages', {});
    const body = (result && result.result) || result;
    if (body && body.ok && Array.isArray(body.list) && body.list.length) {
      return body.list;
    }
  } catch (error) {
    console.warn('[api] listPackages failed', error);
  }
  return withSeedFallback(
    () => readCollection('packages').then((rows) => rows.filter((row) => row && row.onShelf !== false)),
    (seed.packages || []).filter((row) => row && row.onShelf !== false),
    'packages',
  );
}

/** 会员套餐页：一次拿套餐列表 + 开业折扣（走云函数，不读客户端 store，避免 seed 假 8 折）。 */
async function listPackagesWithPromo() {
  try {
    const result = await callFunction('listPackages', {});
    const body = (result && result.result) || result;
    if (body && body.ok && Array.isArray(body.list)) {
      return {
        ok: true,
        list: body.list,
        packagePromo: body.packagePromo || null,
      };
    }
  } catch (error) {
    console.warn('[api] listPackagesWithPromo failed', error);
  }
  const list = await getPackages();
  return { ok: true, list, packagePromo: null };
}

async function getActivities() {
  try {
    const result = await callFunction('listActivities', {});
    const body = (result && result.result) || result;
    if (body && body.ok && Array.isArray(body.list) && body.list.length) {
      return body.list;
    }
  } catch (error) {
    console.warn('[api] listActivities failed', error);
  }
  return withSeedFallback(() => readCollection('activities'), seed.activities, 'activities');
}

async function getStore() {
  try {
    const result = await callFunction('getStore', {});
    const body = (result && result.result) || result;
    if (body && body.ok && body.store) {
      return body.store;
    }
  } catch (error) {
    console.warn('[api] getStore cloud function failed', error);
  }

  let docData = null;
  let rows = [];

  try {
    const result = await db().collection('store').doc('main').get();
    if (result && result.data) {
      docData = result.data;
    }
  } catch (error) {
    console.warn('[api] store doc read failed', error);
  }

  if (!docData) {
    try {
      rows = await readCollection('store');
    } catch (error) {
      if (!ALLOW_SEED_FALLBACK) {
        throw error;
      }
      console.warn('[api] store collection failed, fallback to seed', error);
    }
  }

  const store = resolveStorePayload(docData, rows, {
    allowSeedFallback: ALLOW_SEED_FALLBACK,
    seedStore: seed.store,
  });
  if (!store) {
    throw new Error('store not found');
  }
  return store;
}

function getTables() {
  return withSeedFallback(() => readCollection('tables'), seed.tables, 'tables');
}

function getSeats() {
  return withSeedFallback(() => readCollection('seats'), seed.seats, 'seats');
}

async function getTimeSlots() {
  try {
    const result = await callFunction('getTimeSlots', {});
    const body = (result && result.result) || result;
    if (body && body.ok && Array.isArray(body.timeSlots)) {
      return body.timeSlots;
    }
  } catch (error) {
    console.warn('[api] getTimeSlots cloud function failed', error);
  }

  try {
    const rows = await readCollection('time_slots');
    const slots = parseTimeSlotDocs(rows);
    if (slots.length) return slots;
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

async function getRechargePlans() {
  try {
    const result = await callFunction('listRechargePlans', {});
    const body = (result && result.result) || result;
    if (body && body.ok && Array.isArray(body.list) && body.list.length) {
      return body.list;
    }
  } catch (error) {
    console.warn('[api] listRechargePlans failed', error);
  }
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
  const { mergeOccupancyDocs, isLiveFloorOccupancy } = require('./seats');
  try {
    const database = db();
    const _ = database.command;
    const [slotResult, liveResult] = await Promise.all([
      database
        .collection('seat_occupancies')
        .where({
          date,
          timeSlot,
        })
        .limit(200)
        .get(),
      database
        .collection('seat_occupancies')
        .where(_.or([{ type: 'in_use' }, { type: 'maintenance' }]))
        .limit(200)
        .get(),
    ]);
    return mergeOccupancyDocs(unwrapDocs(slotResult), unwrapDocs(liveResult));
  } catch (error) {
    if (!ALLOW_SEED_FALLBACK) {
      throw error;
    }
    console.warn('[api] seat_occupancies failed, fallback to seed', error);
    return (seed.seatOccupancies || []).filter(
      (row) =>
        (row.date === date && row.timeSlot === timeSlot) || isLiveFloorOccupancy(row),
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

async function adminListMembers(payload) {
  const result = await callFunction('adminListMembers', payload || {});
  return (result && result.result) || result;
}

async function adminListMemberTransactions(payload) {
  const result = await callFunction('adminListMemberTransactions', payload || {});
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

async function listMyPackageOrders(payload) {
  const result = await callFunction('listMyPackageOrders', payload || {});
  return (result && result.result) || result;
}

async function adminListMemberPackages(payload) {
  const result = await callFunction('adminListMemberPackages', payload || {});
  return (result && result.result) || result;
}

async function adminRedeemPackage(payload) {
  const result = await callFunction('adminRedeemPackage', payload || {});
  return (result && result.result) || result;
}

async function refundPackageOrder(payload) {
  const result = await callFunction('refundPackageOrder', payload || {});
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

async function createActivityRegistration(payload) {
  const result = await callFunction('createActivityRegistration', payload || {});
  return (result && result.result) || result;
}

async function cancelActivityRegistration(payload) {
  const result = await callFunction('cancelActivityRegistration', payload || {});
  return (result && result.result) || result;
}

async function listMyActivityRegistrations() {
  const result = await callFunction('listMyActivityRegistrations', {});
  return (result && result.result) || result;
}

async function adminListActivityRegistrations(payload) {
  const result = await callFunction('adminListActivityRegistrations', payload || {});
  return (result && result.result) || result;
}

async function adminConfirmActivityRefund(payload) {
  const result = await callFunction('adminConfirmActivityRefund', payload || {});
  return (result && result.result) || result;
}

async function adminListSeatBoard(payload) {
  try {
    const result = await callFunction('adminListSeatBoard', payload || {});
    return (result && result.result) || result;
  } catch (error) {
    const errMsg = (error && (error.errMsg || error.message)) || '';
    return {
      ok: false,
      code: 'CALL_FAILED',
      message: /not found|FUNCTION_NOT_FOUND|不存在/i.test(errMsg)
        ? '云函数未部署：adminListSeatBoard'
        : errMsg || '座位板接口失败',
    };
  }
}

async function adminStartSeatSession(payload) {
  try {
    const result = await callFunction('adminStartSeatSession', payload || {});
    return (result && result.result) || result;
  } catch (error) {
    return {
      ok: false,
      code: 'CALL_FAILED',
      message: (error && (error.errMsg || error.message)) || '开台接口失败',
    };
  }
}

async function adminEndSeatSession(payload) {
  try {
    const result = await callFunction('adminEndSeatSession', payload || {});
    return (result && result.result) || result;
  } catch (error) {
    return {
      ok: false,
      code: 'CALL_FAILED',
      message: (error && (error.errMsg || error.message)) || '结束接口失败',
    };
  }
}

async function adminExtendSeatSession(payload) {
  try {
    const result = await callFunction('adminExtendSeatSession', payload || {});
    return (result && result.result) || result;
  } catch (error) {
    return {
      ok: false,
      code: 'CALL_FAILED',
      message: (error && (error.errMsg || error.message)) || '延长接口失败',
    };
  }
}

async function adminListSeatSessions(payload) {
  try {
    const result = await callFunction('adminListSeatSessions', payload || {});
    return (result && result.result) || result;
  } catch (error) {
    return {
      ok: false,
      code: 'CALL_FAILED',
      message: (error && (error.errMsg || error.message)) || '计时记录接口失败',
      list: [],
    };
  }
}

async function listMySeatSessions(payload) {
  try {
    const result = await callFunction('listMySeatSessions', payload || {});
    return (result && result.result) || result;
  } catch (error) {
    return {
      ok: false,
      code: 'CALL_FAILED',
      message: (error && (error.errMsg || error.message)) || '到店记录接口失败',
      list: [],
    };
  }
}

async function adminSetSeatMaintenance(payload) {
  try {
    const result = await callFunction('adminSetSeatMaintenance', payload || {});
    return (result && result.result) || result;
  } catch (error) {
    return {
      ok: false,
      code: 'CALL_FAILED',
      message: (error && (error.errMsg || error.message)) || '维护接口失败',
    };
  }
}

async function adminListPackages(payload) {
  const result = await callFunction('adminListPackages', payload || {});
  return (result && result.result) || result;
}

async function adminSavePackage(payload) {
  const result = await callFunction('adminSavePackage', payload || {});
  return (result && result.result) || result;
}

async function adminListActivities(payload) {
  const result = await callFunction('adminListActivities', payload || {});
  return (result && result.result) || result;
}

async function adminSaveActivity(payload) {
  const result = await callFunction('adminSaveActivity', payload || {});
  return (result && result.result) || result;
}

async function adminSavePackagePromo(payload) {
  const result = await callFunction('adminSavePackagePromo', payload || {});
  return (result && result.result) || result;
}

async function adminGetPackagePromo() {
  return adminSavePackagePromo({ action: 'get' });
}

async function adminSaveHomeBanners(payload) {
  const result = await callFunction('adminSaveHomeBanners', payload || {});
  return (result && result.result) || result;
}

async function getHomeBanners() {
  const result = await callFunction('getHomeBanners', {});
  const body = (result && result.result) || result;
  return (body && Array.isArray(body.heroPhotos)) ? body.heroPhotos : [];
}

async function adminSaveActivityPageConfig(payload) {
  const result = await callFunction('adminSaveActivityPageConfig', payload || {});
  return (result && result.result) || result;
}

async function getActivityPageConfig() {
  const result = await callFunction('getActivityPageConfig', {});
  const body = (result && result.result) || result;
  if (!body || !body.ok) {
    return { activitiesPage: null, scheduleRows: [] };
  }
  return {
    activitiesPage: body.activitiesPage || null,
    scheduleRows: Array.isArray(body.scheduleRows) ? body.scheduleRows : [],
  };
}

module.exports = {
  ALLOW_SEED_FALLBACK,
  buildOccupancyId,
  getPackages,
  listPackagesWithPromo,
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
  adminListMembers,
  adminListMemberTransactions,
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
  listMyPackageOrders,
  adminListMemberPackages,
  adminRedeemPackage,
  refundPackageOrder,
  listMyWorks,
  createWork,
  deleteWork,
  createActivityRegistration,
  cancelActivityRegistration,
  listMyActivityRegistrations,
  adminListActivityRegistrations,
  adminConfirmActivityRefund,
  adminListSeatBoard,
  adminStartSeatSession,
  adminEndSeatSession,
  adminExtendSeatSession,
  adminSetSeatMaintenance,
  adminListSeatSessions,
  listMySeatSessions,
  adminListPackages,
  adminSavePackage,
  adminListActivities,
  adminSaveActivity,
  adminSavePackagePromo,
  adminGetPackagePromo,
  adminSaveHomeBanners,
  getHomeBanners,
  adminSaveActivityPageConfig,
  getActivityPageConfig,
};
