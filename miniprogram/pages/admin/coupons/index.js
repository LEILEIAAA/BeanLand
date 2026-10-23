const api = require('../../../utils/api');
const {
  CATEGORY,
  BENEFIT_TYPE,
  CATEGORY_LABEL,
  formatValidRange,
  formatBenefitText,
  buildIssueCouponPayload,
  buildCouponName,
} = require('../../../utils/coupons');
const {
  ADMIN_MEMBER_SEARCH_DEBOUNCE_MS,
  shouldRemoteSearchMember,
} = require('../../../utils/adminMemberSearch');
const { formatYuan } = require('../../../utils/money');

function decorateSearchMembers(list) {
  return (list || []).map((item) => ({
    ...item,
    totalBalanceText: formatYuan(item.totalBalance),
  }));
}

const CATEGORY_OPTIONS = [
  { value: CATEGORY.CHECKIN, label: CATEGORY_LABEL[CATEGORY.CHECKIN] },
  { value: CATEGORY.TEACHER, label: CATEGORY_LABEL[CATEGORY.TEACHER] },
  { value: CATEGORY.BEST_WORK, label: CATEGORY_LABEL[CATEGORY.BEST_WORK] },
];

const BENEFIT_OPTIONS = [
  { value: BENEFIT_TYPE.HOURS, label: '赠送时长' },
  { value: BENEFIT_TYPE.DISCOUNT, label: '折扣优惠' },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatYmd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function todayYmd() {
  return formatYmd(new Date());
}

function addDaysYmd(ymd, days) {
  const text = String(ymd || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const base = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date();
  base.setDate(base.getDate() + Number(days || 0));
  return formatYmd(base);
}

function buildYearOptions() {
  const year = new Date().getFullYear();
  const years = [];
  for (let y = year - 1; y <= year + 3; y += 1) {
    years.push(String(y));
  }
  return years;
}

function daysInMonth(year, month) {
  return new Date(Number(year), Number(month), 0).getDate();
}

function buildDayOptions(year, month) {
  const total = daysInMonth(year, month);
  const days = [];
  for (let d = 1; d <= total; d += 1) {
    days.push(pad2(d));
  }
  return days;
}

function parseYmdParts(ymd) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  if (!match) {
    const now = new Date();
    return {
      year: String(now.getFullYear()),
      month: pad2(now.getMonth() + 1),
      day: pad2(now.getDate()),
    };
  }
  return { year: match[1], month: match[2], day: match[3] };
}

function buildDateColumns(ymd) {
  const years = buildYearOptions();
  const months = Array.from({ length: 12 }, (_, i) => pad2(i + 1));
  const parts = parseYmdParts(ymd);
  let yearIndex = years.indexOf(parts.year);
  if (yearIndex < 0) yearIndex = years.indexOf(String(new Date().getFullYear()));
  if (yearIndex < 0) yearIndex = 0;
  let monthIndex = months.indexOf(parts.month);
  if (monthIndex < 0) monthIndex = 0;
  const year = years[yearIndex];
  const month = months[monthIndex];
  const days = buildDayOptions(year, month);
  let dayIndex = days.indexOf(parts.day);
  if (dayIndex < 0) dayIndex = Math.min(Number(parts.day) - 1, days.length - 1);
  if (dayIndex < 0) dayIndex = 0;
  return {
    range: [years, months, days],
    index: [yearIndex, monthIndex, dayIndex],
    value: `${year}-${month}-${days[dayIndex]}`,
  };
}

function ymdFromMulti(range, index) {
  const year = range[0][index[0]];
  const month = range[1][index[1]];
  const days = buildDayOptions(year, month);
  const dayIndex = Math.min(index[2], days.length - 1);
  return `${year}-${month}-${days[dayIndex]}`;
}

function withSelected(options, selectedValue) {
  return options.map((item) => ({
    ...item,
    selected: item.value === selectedValue,
  }));
}

function formatCouponMeta(item) {
  const parts = [];
  if (item.available === false && item.unavailableReason) {
    parts.push(item.unavailableReason);
  }
  return parts.filter(Boolean).join(' · ');
}

function mapCoupon(item) {
  const available = item.available === true;
  return {
    id: item._id || item.id,
    name: item.name || '优惠券',
    benefitText: formatBenefitText(item) || '—',
    meta: formatCouponMeta(item),
    validRange: formatValidRange(item),
    available,
    statusText: available ? '可核销' : '不可用',
  };
}

function previewName(data) {
  const category = data.issueCategory;
  const benefitType = data.issueBenefitType;
  const value = Number(data.issueBenefitValue);
  if (!category || !benefitType || !Number.isFinite(value) || value <= 0) return '';
  return buildCouponName(category, benefitType, value);
}

function initialDateState() {
  const today = todayYmd();
  const from = buildDateColumns(today);
  const to = buildDateColumns(today);
  return {
    issueValidFrom: from.value,
    issueExpireAt: to.value,
    validFromRange: from.range,
    validFromIndex: from.index,
    expireAtRange: to.range,
    expireAtIndex: to.index,
  };
}

Page({
  data: {
    phone: '',
    members: [],
    selectedId: '',
    selectedLabel: '',
    coupons: [],
    loadingCoupons: false,
    redeemingId: '',
    categoryOptions: withSelected(CATEGORY_OPTIONS, CATEGORY.CHECKIN),
    benefitOptions: withSelected(BENEFIT_OPTIONS, BENEFIT_TYPE.HOURS),
    issueCategory: CATEGORY.CHECKIN,
    issueBenefitType: BENEFIT_TYPE.HOURS,
    issueBenefitValue: '',
    ...initialDateState(),
    issuePreviewName: '',
    benefitValueLabel: '赠送小时数',
    benefitValuePlaceholder: '如：2',
    issuing: false,
    opTabs: [
      { key: 'redeem', label: '核销' },
      { key: 'issue', label: '发放' },
    ],
    opTab: 'redeem',
  },
  onOpTabChange(event) {
    const { tab } = event.currentTarget.dataset;
    if (!tab || tab === this.data.opTab) return;
    this.hideKeyboard();
    this.setData({ opTab: tab });
  },
  hideKeyboard() {
    if (typeof wx !== 'undefined' && wx.hideKeyboard) {
      wx.hideKeyboard({ complete: () => {} });
    }
  },
  notifyAdmin(content, title) {
    wx.showModal({
      title: title || '操作不合规',
      content: String(content || '请检查后重试'),
      showCancel: false,
      confirmText: '知道了',
    });
  },
  syncDatePickers(validFrom, expireAt) {
    const from = buildDateColumns(validFrom || todayYmd());
    const to = buildDateColumns(expireAt || from.value);
    this.setData({
      issueValidFrom: from.value,
      issueExpireAt: to.value,
      validFromRange: from.range,
      validFromIndex: from.index,
      expireAtRange: to.range,
      expireAtIndex: to.index,
    });
  },
  onPhoneInput(event) {
    const phone = event.detail.value;
    this.setData({ phone });
    if (this._memberSearchTimer) {
      clearTimeout(this._memberSearchTimer);
      this._memberSearchTimer = null;
    }
    const text = String(phone || '').trim();
    if (!text) {
      this._memberSearchSeq = (this._memberSearchSeq || 0) + 1;
      this.setData({ members: [], selectedId: '', selectedLabel: '', coupons: [] });
      return;
    }
    if (!shouldRemoteSearchMember(text)) {
      this._memberSearchSeq = (this._memberSearchSeq || 0) + 1;
      return;
    }
    this._memberSearchTimer = setTimeout(() => {
      this.searchMembers({ silentEmpty: true });
    }, ADMIN_MEMBER_SEARCH_DEBOUNCE_MS);
  },
  onSearch() {
    if (this._memberSearchTimer) {
      clearTimeout(this._memberSearchTimer);
      this._memberSearchTimer = null;
    }
    this.searchMembers({ silentEmpty: false });
  },
  async searchMembers({ silentEmpty }) {
    const phone = String(this.data.phone || '').trim();
    if (!phone) {
      if (!silentEmpty) {
        wx.showToast({ title: '请输入手机号或尾号', icon: 'none' });
      }
      return;
    }
    if (!shouldRemoteSearchMember(phone)) {
      if (!silentEmpty) {
        wx.showToast({ title: '请至少输入4位手机号', icon: 'none' });
      }
      return;
    }
    const seq = (this._memberSearchSeq = (this._memberSearchSeq || 0) + 1);
    try {
      const result = await api.adminFindMember({ phone });
      if (seq !== this._memberSearchSeq) return;
      if (!result || !result.ok) {
        wx.showToast({
          title: (result && result.message) || '查询失败',
          icon: 'none',
        });
        return;
      }
      const list = result.list || [];
      if (!list.length) {
        if (!silentEmpty) {
          wx.showToast({ title: '未找到会员', icon: 'none' });
        }
        this.setData({ members: [], selectedId: '', selectedLabel: '', coupons: [] });
        return;
      }
      const first = list[0];
      this.setData({
        members: decorateSearchMembers(list),
        selectedId: first._id,
        selectedLabel: `${first.nickName || '未命名'} · ${first.phone || phone}`,
        opTab: 'redeem',
      });
      await this.loadCoupons(first._id);
    } catch (error) {
      if (seq !== this._memberSearchSeq) return;
      wx.showToast({ title: '查询失败（需店长权限）', icon: 'none' });
    }
  },
  refreshPreview() {
    this.setData({ issuePreviewName: previewName(this.data) });
  },
  onSelectCategory(event) {
    this.hideKeyboard();
    const { value } = event.currentTarget.dataset;
    if (!value || value === this.data.issueCategory) return;
    this.setData(
      {
        issueCategory: value,
        categoryOptions: withSelected(CATEGORY_OPTIONS, value),
      },
      () => this.refreshPreview(),
    );
  },
  onSelectBenefit(event) {
    this.hideKeyboard();
    const { value } = event.currentTarget.dataset;
    if (!value || value === this.data.issueBenefitType) return;
    const isHours = value === BENEFIT_TYPE.HOURS;
    this.setData(
      {
        issueBenefitType: value,
        benefitOptions: withSelected(BENEFIT_OPTIONS, value),
        benefitValueLabel: isHours ? '赠送小时数' : '折扣（折）',
        benefitValuePlaceholder: isHours ? '如：2' : '如：8',
      },
      () => this.refreshPreview(),
    );
  },
  onBenefitValueInput(event) {
    this.setData({ issueBenefitValue: event.detail.value }, () => this.refreshPreview());
  },
  onBenefitValueBlur(event) {
    const raw = String((event.detail && event.detail.value) || this.data.issueBenefitValue || '').trim();
    if (!raw) return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      this.notifyAdmin(
        this.data.issueBenefitType === BENEFIT_TYPE.DISCOUNT
          ? '折扣必须大于 0，例如填写 8 表示 8 折'
          : '赠送小时数必须大于 0',
        '数值不合规',
      );
      this.setData({ issueBenefitValue: '', issuePreviewName: '' });
    }
  },
  onValidFromColumnChange(event) {
    const { column, value } = event.detail;
    const index = this.data.validFromIndex.slice();
    index[column] = value;
    const years = this.data.validFromRange[0];
    const months = this.data.validFromRange[1];
    const year = years[index[0]];
    const month = months[index[1]];
    const days = buildDayOptions(year, month);
    if (index[2] > days.length - 1) index[2] = days.length - 1;
    this.setData({
      validFromIndex: index,
      validFromRange: [years, months, days],
    });
  },
  onValidFromChange(event) {
    const index = (event.detail && event.detail.value) || this.data.validFromIndex;
    const value = ymdFromMulti(this.data.validFromRange, index);
    const built = buildDateColumns(value);
    const needAdjust =
      !!this.data.issueExpireAt && this.data.issueExpireAt < built.value;
    const expireAt = needAdjust ? built.value : this.data.issueExpireAt || built.value;
    this.syncDatePickers(built.value, expireAt);
    if (needAdjust) {
      this.notifyAdmin(
        `开始日（${built.value}）晚于原结束日，已自动将结束日调整为 ${built.value}`,
        '有效期已自动校正',
      );
    }
  },
  onExpireAtColumnChange(event) {
    const { column, value } = event.detail;
    const index = this.data.expireAtIndex.slice();
    index[column] = value;
    const years = this.data.expireAtRange[0];
    const months = this.data.expireAtRange[1];
    const year = years[index[0]];
    const month = months[index[1]];
    const days = buildDayOptions(year, month);
    if (index[2] > days.length - 1) index[2] = days.length - 1;
    this.setData({
      expireAtIndex: index,
      expireAtRange: [years, months, days],
    });
  },
  onExpireAtChange(event) {
    const index = (event.detail && event.detail.value) || this.data.expireAtIndex;
    const value = ymdFromMulti(this.data.expireAtRange, index);
    const built = buildDateColumns(value);
    if (this.data.issueValidFrom && built.value < this.data.issueValidFrom) {
      this.notifyAdmin(
        `结束日（${built.value}）不能早于开始日（${this.data.issueValidFrom}），请重新选择`,
        '有效期不合规',
      );
      this.syncDatePickers(this.data.issueValidFrom, this.data.issueValidFrom);
      return;
    }
    this.setData({
      issueExpireAt: built.value,
      expireAtRange: built.range,
      expireAtIndex: built.index,
    });
  },
  onQuickExpire(event) {
    this.hideKeyboard();
    const days = Number(event.currentTarget.dataset.days);
    if (!Number.isFinite(days)) return;
    const from = this.data.issueValidFrom || todayYmd();
    this.syncDatePickers(from, addDaysYmd(from, days));
  },
  async onPickMember(event) {
    const { id } = event.currentTarget.dataset;
    const member = this.data.members.find((item) => item._id === id);
    if (!member) return;
    this.setData({
      selectedId: member._id,
      selectedLabel: `${member.nickName || '未命名'} · ${member.phone || ''}`,
    });
    await this.loadCoupons(member._id);
  },
  async loadCoupons(memberId) {
    if (!memberId) return;
    this.setData({ loadingCoupons: true });
    try {
      const result = await api.adminListMemberCoupons({ memberId });
      if (!result || !result.ok) {
        wx.showToast({
          title: (result && result.message) || '券列表失败',
          icon: 'none',
        });
        this.setData({ coupons: [] });
        return;
      }
      this.setData({
        coupons: (result.list || []).map(mapCoupon),
      });
    } catch (error) {
      wx.showToast({ title: '券列表失败', icon: 'none' });
      this.setData({ coupons: [] });
    } finally {
      this.setData({ loadingCoupons: false });
    }
  },
  onIssue() {
    if (this.data.issuing || !this.data.selectedId) return;

    const benefitValue = Number(String(this.data.issueBenefitValue || '').trim());
    const validFromDate = this.data.issueValidFrom;
    const expireAtDate = this.data.issueExpireAt;
    const preview = buildIssueCouponPayload(
      {
        memberId: this.data.selectedId,
        openid: 'preview',
        category: this.data.issueCategory,
        benefitType: this.data.issueBenefitType,
        benefitValue,
        validFromDate,
        expireAtDate,
      },
      Date.now(),
    );
    if (!preview.ok) {
      this.notifyAdmin(preview.message || '请检查发放信息', '无法发放');
      return;
    }

    wx.showModal({
      title: '确认发放',
      content: `${preview.coupon.name} · ${validFromDate} 至 ${expireAtDate}`,
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ issuing: true });
        try {
          const result = await api.adminIssueCoupon({
            memberId: this.data.selectedId,
            category: this.data.issueCategory,
            benefitType: this.data.issueBenefitType,
            benefitValue,
            validFromDate,
            expireAtDate,
          });
          if (!result || !result.ok) {
            this.notifyAdmin(
              (result && result.message) || '发放失败，请稍后重试',
              '无法发放',
            );
            return;
          }
          wx.showToast({ title: '发放成功', icon: 'success' });
          this.setData({
            issueBenefitValue: '',
            issuePreviewName: '',
            ...initialDateState(),
          });
          await this.loadCoupons(this.data.selectedId);
        } catch (error) {
          wx.showToast({ title: '发放失败', icon: 'none' });
        } finally {
          this.setData({ issuing: false });
        }
      },
    });
  },
  onRedeem(event) {
    const { id, available, name, benefit } = event.currentTarget.dataset;
    const canUse = available === true || available === 'true';
    if (!canUse || !id || this.data.redeemingId) return;

    wx.showModal({
      title: '确认核销',
      content: `${name || '优惠券'} ${benefit || ''}`,
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ redeemingId: id });
        try {
          const result = await api.adminRedeemCoupon({ couponId: id });
          if (!result || !result.ok) {
            wx.showToast({
              title: (result && result.message) || '核销失败',
              icon: 'none',
            });
            return;
          }
          wx.showToast({ title: '核销成功', icon: 'success' });
          await this.loadCoupons(this.data.selectedId);
        } catch (error) {
          wx.showToast({ title: '核销失败', icon: 'none' });
        } finally {
          this.setData({ redeemingId: '' });
        }
      },
    });
  },
});
