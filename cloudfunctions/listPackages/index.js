const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const DEFAULT_PROMO = {
  active: true,
  discountRate: 8,
  label: '开业七天',
  tip: '全场8折',
};

function normalizeRow(row) {
  const id = String((row && (row.id || row._id)) || '').trim();
  return {
    ...row,
    id,
    price: Number((row && row.price) || 0),
    sortOrder: Number((row && row.sortOrder) || 0),
  };
}

async function loadPackagePromo() {
  try {
    const doc = await db.collection('store').doc('main').get();
    if (doc && doc.data && doc.data.packagePromo) {
      return doc.data.packagePromo;
    }
  } catch (error) {
    // missing
  }
  return { ...DEFAULT_PROMO };
}

exports.main = async () => {
  try {
    let rows = [];
    try {
      const result = await db.collection('packages').limit(100).get();
      rows = result.data || [];
    } catch (error) {
      const msg = String((error && error.message) || error || '');
      if (/DATABASE_COLLECTION_NOT_EXIST|not exist|不存在/i.test(msg)) {
        return { ok: true, list: [], packagePromo: await loadPackagePromo() };
      }
      throw error;
    }

    const list = rows
      .filter((row) => row && row.onShelf !== false)
      .map(normalizeRow)
      .filter((row) => row.id)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const packagePromo = await loadPackagePromo();
    return { ok: true, list, packagePromo };
  } catch (error) {
    console.error('[listPackages]', error);
    return {
      ok: false,
      code: 'QUERY_FAILED',
      message: (error && (error.errMsg || error.message)) || 'query failed',
      list: [],
      packagePromo: { ...DEFAULT_PROMO },
    };
  }
};
