const api = require('../../../utils/api');
const { mapAdminMemberRow } = require('../../../utils/adminMemberDisplay');
const {
  pickMemberFromList,
  buildMemberDetailReset,
} = require('../../../utils/adminMemberDetail');
const { formatYuan } = require('../../../utils/money');
const { resolveTransactionTitle } = require('../../../utils/transactionTitle');
const { toMerchantAmount } = require('../../../utils/adminTransactionStats');

const FILTERS = [
  { key: '', label: '全部' },
  { key: 'recharge', label: '充值' },
  { key: 'consume', label: '消费' },
  { key: 'refund', label: '退款' },
];

function formatMeta(tx) {
  const when = tx.createdAt
    ? new Date(tx.createdAt).toLocaleString('zh-CN', { hour12: false })
    : '';
  let channel = '';
  if (tx.channel === 'transfer_manual') channel = '转账代充';
  else if (tx.channel === 'wechat_jsapi') channel = '在线支付';
  else if (tx.channel === 'balance') channel = '余额';
  return [when, channel].filter(Boolean).join(' · ');
}

function mapTxRow(item) {
  const balanceAfter =
    item.totalBalanceAfter != null ? item.totalBalanceAfter : item.balanceAfter;
  const resolved = resolveTransactionTitle(item);
  const amount = toMerchantAmount(item);
  return {
    id: item._id || item.id,
    typeLabel: resolved.typeLabel,
    body: resolved.body,
    amount,
    amountText: `${amount > 0 ? '+' : ''}${formatYuan(amount)}`,
    meta: formatMeta(item),
    balanceAfterText: formatYuan(balanceAfter),
  };
}

Page({
  data: {
    memberId: '',
    member: null,
    filters: FILTERS,
    filterType: '',
    transactions: [],
    loading: true,
    txLoading: false,
  },
  onLoad(query) {
    const memberId = String((query && query.id) || '').trim();
    this._memberId = memberId;
    this._detailSeq = 0;
    this.setData(buildMemberDetailReset(memberId));
  },
  onShow() {
    this.loadDetail(this._memberId || this.data.memberId);
  },
  setTypeFilter(event) {
    const type = event.currentTarget.dataset.type || '';
    this.setData({ filterType: type }, () => this.loadTransactions());
  },
  async loadDetail(memberIdOverride) {
    const memberId = String(
      memberIdOverride != null ? memberIdOverride : this._memberId || this.data.memberId || '',
    ).trim();
    const seq = (this._detailSeq = (this._detailSeq || 0) + 1);
    this._memberId = memberId;

    if (!memberId) {
      this.setData({
        ...buildMemberDetailReset(''),
        filters: FILTERS,
      });
      return;
    }

    this.setData({
      memberId,
      member: null,
      transactions: [],
      loading: true,
      txLoading: true,
    });

    try {
      const [memberRes, txRes] = await Promise.all([
        api.adminListMembers({ memberId }),
        api.adminListMemberTransactions({
          memberId,
          type: this.data.filterType || undefined,
          limit: 200,
        }),
      ]);
      if (seq !== this._detailSeq) return;

      const found = pickMemberFromList((memberRes && memberRes.list) || [], memberId);
      if (!memberRes || !memberRes.ok || !found) {
        this.setData({ member: null, transactions: [] });
        wx.showToast({ title: (memberRes && memberRes.message) || '会员不存在', icon: 'none' });
        return;
      }

      const mapped = mapAdminMemberRow(found);
      const transactions =
        txRes && txRes.ok ? (txRes.list || []).map(mapTxRow) : [];
      if (txRes && !txRes.ok) {
        wx.showToast({ title: (txRes && txRes.message) || '流水加载失败', icon: 'none' });
      }

      this.setData({
        member: {
          ...mapped,
          principalText: formatYuan(mapped.principalBalance),
          bonusText: formatYuan(mapped.bonusBalance),
          rechargeText: formatYuan(mapped.totalRecharge),
          spentText: formatYuan(mapped.totalSpent),
        },
        transactions,
      });
    } catch (error) {
      if (seq !== this._detailSeq) return;
      console.warn('[admin-member-detail]', error);
      this.setData({ member: null, transactions: [] });
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      if (seq === this._detailSeq) {
        this.setData({ loading: false, txLoading: false });
      }
    }
  },
  async loadTransactions() {
    const memberId = String(this._memberId || this.data.memberId || '').trim();
    if (!memberId || !this.data.member) return;
    const seq = (this._detailSeq = (this._detailSeq || 0) + 1);
    this.setData({ txLoading: true, transactions: [] });
    try {
      const txRes = await api.adminListMemberTransactions({
        memberId,
        type: this.data.filterType || undefined,
        limit: 200,
      });
      if (seq !== this._detailSeq) return;
      if (!txRes || !txRes.ok) {
        wx.showToast({ title: (txRes && txRes.message) || '流水加载失败', icon: 'none' });
        this.setData({ transactions: [] });
        return;
      }
      this.setData({ transactions: (txRes.list || []).map(mapTxRow) });
    } catch (error) {
      if (seq !== this._detailSeq) return;
      console.warn('[admin-member-detail-tx]', error);
      this.setData({ transactions: [] });
      wx.showToast({ title: '流水加载失败', icon: 'none' });
    } finally {
      if (seq === this._detailSeq) {
        this.setData({ txLoading: false });
      }
    }
  },
});
