const api = require('../../../utils/api');
const { formatYuan } = require('../../../utils/money');
const { resolveTransactionTitle } = require('../../../utils/transactionTitle');
const { tierLabel } = require('../../../utils/memberTier');
const {
  toMerchantAmount,
  resolveTimeRangeMs,
} = require('../../../utils/adminTransactionStats');

const FILTERS = [
  { key: '', label: '全部' },
  { key: 'recharge', label: '充值' },
  { key: 'consume', label: '消费' },
  { key: 'refund', label: '退款' },
];

function formatRangeLabel(startDate, endDate) {
  const start = String(startDate || '');
  const end = String(endDate || '');
  if (!start || !end) return '选择时间';
  const startShort = start.slice(5);
  const endShort = end.slice(5);
  if (start === end) return startShort;
  return `${startShort}~${endShort}`;
}

function formatMeta(tx) {
  const when = tx.createdAt
    ? new Date(tx.createdAt).toLocaleString('zh-CN', { hour12: false })
    : '';
  let channel = '';
  if (tx.channel === 'transfer_manual') channel = '转账代充';
  else if (tx.channel === 'wechat_jsapi') channel = '在线支付';
  else if (tx.channel === 'balance') channel = '余额';
  const tier = tx.memberTier ? tierLabel(tx.memberTier) : '';
  return [when, channel, tier].filter(Boolean).join(' · ');
}

function mapRow(item) {
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
    memberNickname: item.memberNickname || '未命名',
    memberPhone: item.memberPhone || '',
    balanceAfterText: formatYuan(balanceAfter),
  };
}

function mapStats(stats) {
  const raw = stats || {};
  return {
    count: Number(raw.count) || 0,
    incomeText: formatYuan(raw.income),
    expenseText: formatYuan(raw.expense),
    netText: formatYuan(raw.net),
  };
}

function buildInitialTime() {
  const range = resolveTimeRangeMs({ preset: 'today' });
  return {
    startDate: range.startDate,
    endDate: range.endDate,
    rangeLabel: formatRangeLabel(range.startDate, range.endDate),
    draftStartDate: range.startDate,
    draftEndDate: range.endDate,
  };
}

Page({
  data: {
    filters: FILTERS,
    filterType: '',
    ...buildInitialTime(),
    timeSheetOpen: false,
    list: [],
    stats: mapStats({}),
    loading: true,
  },
  noop() {},
  onShow() {
    this.loadList();
  },
  setTypeFilter(event) {
    const type = event.currentTarget.dataset.type || '';
    this.setData({ filterType: type }, () => this.loadList());
  },
  openTimeSheet() {
    this.setData({
      timeSheetOpen: true,
      draftStartDate: this.data.startDate,
      draftEndDate: this.data.endDate,
    });
  },
  closeTimeSheet() {
    this.setData({ timeSheetOpen: false });
  },
  onDraftStartChange(event) {
    const draftStartDate =
      (event.detail && event.detail.value) || this.data.draftStartDate;
    let draftEndDate = this.data.draftEndDate;
    if (draftEndDate && draftStartDate > draftEndDate) {
      draftEndDate = draftStartDate;
    }
    this.setData({ draftStartDate, draftEndDate });
  },
  onDraftEndChange(event) {
    const draftEndDate =
      (event.detail && event.detail.value) || this.data.draftEndDate;
    let draftStartDate = this.data.draftStartDate;
    if (draftStartDate && draftEndDate < draftStartDate) {
      draftStartDate = draftEndDate;
    }
    this.setData({ draftStartDate, draftEndDate });
  },
  confirmTimeSheet() {
    const startDate = this.data.draftStartDate;
    const endDate = this.data.draftEndDate;
    this.setData(
      {
        timeSheetOpen: false,
        startDate,
        endDate,
        rangeLabel: formatRangeLabel(startDate, endDate),
      },
      () => this.loadList(),
    );
  },
  async loadList() {
    this.setData({ loading: true });
    try {
      const range = resolveTimeRangeMs({
        preset: 'custom',
        startDate: this.data.startDate,
        endDate: this.data.endDate,
      });
      const payload = {
        type: this.data.filterType || undefined,
        limit: 200,
        startAt: range.startAt,
        endAt: range.endAt,
      };

      const res = await api.adminListMemberTransactions(payload);
      if (!res || !res.ok) {
        wx.showToast({ title: (res && res.message) || '加载失败', icon: 'none' });
        this.setData({ list: [], stats: mapStats({}) });
        return;
      }
      const startDate = range.startDate || this.data.startDate;
      const endDate = range.endDate || this.data.endDate;
      this.setData({
        list: (res.list || []).map(mapRow),
        stats: mapStats(res.stats),
        startDate,
        endDate,
        rangeLabel: formatRangeLabel(startDate, endDate),
      });
    } catch (error) {
      console.warn('[admin-transactions]', error);
      this.setData({ list: [], stats: mapStats({}) });
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
