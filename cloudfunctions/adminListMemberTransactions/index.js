const cloud = require('wx-server-sdk');
const {
  filterTransactionsByType,
  filterTransactionsByOpenid,
  filterTransactionsByTime,
  summarizeTransactions,
} = require('./transactionStats');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const TYPE_WHITELIST = new Set(['recharge', 'consume', 'refund']);

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return !!(result.data && result.data.length);
}

async function loadMemberMap(openids) {
  const ids = Array.from(new Set((openids || []).filter(Boolean)));
  const map = {};
  if (!ids.length) return map;

  const chunkSize = 20;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const found = await db
      .collection('members')
      .where({ _openid: _.in(chunk) })
      .limit(100)
      .get();
    for (const row of found.data || []) {
      if (row && row._openid) map[row._openid] = row;
    }
  }
  return map;
}

async function resolveOpenidByMemberId(memberId) {
  const id = String(memberId || '').trim();
  if (!id) return '';
  try {
    const doc = await db.collection('members').doc(id).get();
    const row = doc && doc.data ? doc.data : null;
    return (row && row._openid && String(row._openid).trim()) || '';
  } catch (error) {
    return '';
  }
}

function buildWhere(type, startAt, endAt, openid) {
  const where = {};
  if (type) where.type = type;
  if (openid) where._openid = openid;
  const start = startAt == null ? null : Number(startAt);
  const end = endAt == null ? null : Number(endAt);
  const hasStart = start != null && Number.isFinite(start);
  const hasEnd = end != null && Number.isFinite(end);
  if (hasStart && hasEnd) {
    where.createdAt = _.and(_.gte(start), _.lt(end));
  } else if (hasStart) {
    where.createdAt = _.gte(start);
  } else if (hasEnd) {
    where.createdAt = _.lt(end);
  }
  return where;
}

exports.main = async (event) => {
  const emptyStats = { count: 0, income: 0, expense: 0, net: 0 };
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return {
      ok: false,
      code: 'NO_OPENID',
      message: 'missing openid',
      list: [],
      stats: emptyStats,
    };
  }

  const isAdmin = await assertAdmin(OPENID).catch(() => false);
  if (!isAdmin) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'admin only',
      list: [],
      stats: emptyStats,
    };
  }

  const rawType = String((event && event.type) || '').trim();
  const type = TYPE_WHITELIST.has(rawType) ? rawType : '';
  const limit = Math.min(Math.max(Number((event && event.limit) || 200), 1), 500);
  const memberId = String((event && event.memberId) || '').trim();
  const startAt =
    event && event.startAt != null && event.startAt !== ''
      ? Number(event.startAt)
      : null;
  const endAt =
    event && event.endAt != null && event.endAt !== ''
      ? Number(event.endAt)
      : null;

  try {
    let memberOpenid = '';
    if (memberId) {
      memberOpenid = await resolveOpenidByMemberId(memberId);
      if (!memberOpenid) {
        return { ok: true, list: [], stats: emptyStats };
      }
    }

    const where = buildWhere(type, startAt, endAt, memberOpenid);
    let query = db.collection('member_transactions');
    if (Object.keys(where).length) {
      query = query.where(where);
    }

    let rawList = [];
    try {
      const result = await query.orderBy('createdAt', 'desc').limit(limit).get();
      rawList = result.data || [];
    } catch (queryError) {
      console.warn('[adminListMemberTransactions] where+order fallback', queryError);
      const loose = await db
        .collection('member_transactions')
        .orderBy('createdAt', 'desc')
        .limit(Math.min(limit * 3, 500))
        .get();
      let looseList = loose.data || [];
      if (memberOpenid) {
        looseList = filterTransactionsByOpenid(looseList, memberOpenid);
      }
      rawList = filterTransactionsByTime(
        filterTransactionsByType(looseList, type),
        startAt,
        endAt,
      ).slice(0, limit);
    }

    if (memberOpenid) {
      rawList = filterTransactionsByOpenid(rawList, memberOpenid);
    }
    rawList = filterTransactionsByTime(
      filterTransactionsByType(rawList, type),
      startAt,
      endAt,
    );

    const memberMap = await loadMemberMap(rawList.map((row) => row && row._openid));

    const list = rawList.map((row) => {
      const member = memberMap[row._openid] || {};
      const nickname =
        (member.nickName && String(member.nickName).trim()) ||
        (member.nickname && String(member.nickname).trim()) ||
        '';
      return {
        ...row,
        memberNickname: nickname || '未命名',
        memberPhone: (member.phone && String(member.phone).trim()) || '',
        memberTier: member.tier || 'member',
      };
    });

    const stats = summarizeTransactions(list);
    return { ok: true, list, stats };
  } catch (error) {
    console.error('[adminListMemberTransactions]', error);
    return {
      ok: false,
      code: 'QUERY_FAILED',
      message: (error && error.message) || 'query failed',
      list: [],
      stats: emptyStats,
    };
  }
};
