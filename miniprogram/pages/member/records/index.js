const api = require('../../../utils/api');
const seed = require('../../../data/seed');
const { formatYuan2 } = require('../../../utils/money');
const { resolveTransactionTitle } = require('../../../utils/transactionTitle');

function formatMeta(tx) {
  if (tx.meta) return tx.meta;
  const when = tx.createdAt
    ? new Date(tx.createdAt).toLocaleString('zh-CN', { hour12: false })
    : '';
  let channel = tx.type || '';
  if (tx.channel === 'transfer_manual') channel = '转账代充';
  else if (tx.channel === 'wechat_jsapi') channel = '微信支付';
  return [when, channel].filter(Boolean).join(' · ');
}

function mapTransactions(list) {
  return (list || []).map((item) => {
    const balanceAfter =
      item.totalBalanceAfter != null ? item.totalBalanceAfter : item.balanceAfter;
    const resolved = resolveTransactionTitle(item);
    return {
      id: item._id || item.id,
      typeLabel: resolved.typeLabel,
      typeKey: resolved.typeKey,
      body: resolved.body,
      title: [resolved.typeLabel, resolved.body].filter(Boolean).join(' '),
      amount: Number(item.amount),
      amountText: formatYuan2(item.amount),
      meta: formatMeta(item),
      balanceAfter,
      balanceAfterText: formatYuan2(balanceAfter),
    };
  });
}

Page({
  data: {
    totalBalance: '0.00',
    principalBalance: '0.00',
    bonusBalance: '0.00',
    transactions: [],
    loading: true,
    emptyTip: '',
  },
  onShow() {
    this.load();
  },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },
  async load() {
    this.setData({ loading: true, emptyTip: '' });
    try {
      const [memberRes, txRes] = await Promise.all([
        api.ensureMember({}),
        api.listMyTransactions({ limit: 50 }),
      ]);

      const member =
        memberRes && memberRes.ok && memberRes.member
          ? memberRes.member
          : null;

      // 云端成功（含空列表）必须以云为准，禁止用 seed 冒充流水
      const cloudOk = !!(txRes && txRes.ok && Array.isArray(txRes.list));
      let transactions = [];
      if (cloudOk) {
        transactions = mapTransactions(txRes.list);
      } else if (api.ALLOW_SEED_FALLBACK) {
        transactions = mapTransactions(seed.memberProfile.transactions);
      }

      this.setData({
        totalBalance: member
          ? formatYuan2(member.totalBalance)
          : api.ALLOW_SEED_FALLBACK
            ? formatYuan2(seed.memberProfile.totalBalance)
            : '0.00',
        principalBalance: member
          ? formatYuan2(member.principalBalance)
          : api.ALLOW_SEED_FALLBACK
            ? formatYuan2(seed.memberProfile.principalBalance)
            : '0.00',
        bonusBalance: member
          ? formatYuan2(member.bonusBalance)
          : api.ALLOW_SEED_FALLBACK
            ? formatYuan2(seed.memberProfile.bonusBalance)
            : '0.00',
        transactions,
        emptyTip: cloudOk && !transactions.length ? '暂无流水，充值或消费后会出现在这里' : '',
      });

      if (!cloudOk && !api.ALLOW_SEED_FALLBACK) {
        wx.showToast({ title: '流水加载失败', icon: 'none' });
      }
    } catch (error) {
      console.warn('[records] load failed', error);
      if (api.ALLOW_SEED_FALLBACK) {
        this.setData({
          totalBalance: formatYuan2(seed.memberProfile.totalBalance),
          principalBalance: formatYuan2(seed.memberProfile.principalBalance),
          bonusBalance: formatYuan2(seed.memberProfile.bonusBalance),
          transactions: mapTransactions(seed.memberProfile.transactions),
          emptyTip: '',
        });
      } else {
        wx.showToast({ title: '流水加载失败', icon: 'none' });
      }
    } finally {
      this.setData({ loading: false });
    }
  },
});
