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

const CATEGORY_OPTIONS = [
  { value: CATEGORY.CHECKIN, label: CATEGORY_LABEL[CATEGORY.CHECKIN] },
  { value: CATEGORY.TEACHER, label: CATEGORY_LABEL[CATEGORY.TEACHER] },
  { value: CATEGORY.BEST_WORK, label: CATEGORY_LABEL[CATEGORY.BEST_WORK] },
];

const BENEFIT_OPTIONS = [
  { value: BENEFIT_TYPE.HOURS, label: '赠送时长' },
  { value: BENEFIT_TYPE.DISCOUNT, label: '折扣优惠' },
];

function todayYmd() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

Page({
  data: {
    phone: '',
    members: [],
    selectedId: '',
    selectedLabel: '',
    coupons: [],
    loadingCoupons: false,
    redeemingId: '',
    categoryOptions: CATEGORY_OPTIONS,
    benefitOptions: BENEFIT_OPTIONS,
    categoryIndex: 0,
    benefitIndex: 0,
    issueCategory: CATEGORY.CHECKIN,
    issueBenefitType: BENEFIT_TYPE.HOURS,
    issueBenefitValue: '',
    issueValidFrom: todayYmd(),
    issueExpireAt: todayYmd(),
    issuePreviewName: '',
    benefitValueLabel: '赠送小时数',
    benefitValuePlaceholder: '如：2',
    issuing: false,
  },
  onPhoneInput(event) {
    this.setData({ phone: event.detail.value });
  },
  refreshPreview() {
    this.setData({ issuePreviewName: previewName(this.data) });
  },
  onCategoryChange(event) {
    const index = Number(event.detail.value);
    const option = CATEGORY_OPTIONS[index];
    if (!option) return;
    this.setData(
      {
        categoryIndex: index,
        issueCategory: option.value,
      },
      () => this.refreshPreview(),
    );
  },
  onBenefitChange(event) {
    const index = Number(event.detail.value);
    const option = BENEFIT_OPTIONS[index];
    if (!option) return;
    const isHours = option.value === BENEFIT_TYPE.HOURS;
    this.setData(
      {
        benefitIndex: index,
        issueBenefitType: option.value,
        benefitValueLabel: isHours ? '赠送小时数' : '折扣（折）',
        benefitValuePlaceholder: isHours ? '如：2' : '如：8',
      },
      () => this.refreshPreview(),
    );
  },
  onBenefitValueInput(event) {
    this.setData({ issueBenefitValue: event.detail.value }, () => this.refreshPreview());
  },
  onValidFromChange(event) {
    this.setData({ issueValidFrom: event.detail.value });
  },
  onExpireAtChange(event) {
    this.setData({ issueExpireAt: event.detail.value });
  },
  async onSearch() {
    const phone = String(this.data.phone || '').trim();
    if (!phone) {
      wx.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    try {
      const result = await api.adminFindMember({ phone });
      if (!result || !result.ok) {
        wx.showToast({
          title: (result && result.message) || '查询失败',
          icon: 'none',
        });
        return;
      }
      const list = result.list || [];
      if (!list.length) {
        wx.showToast({ title: '未找到会员', icon: 'none' });
        this.setData({ members: [], selectedId: '', selectedLabel: '', coupons: [] });
        return;
      }
      const first = list[0];
      this.setData({
        members: list,
        selectedId: first._id,
        selectedLabel: `${first.nickName || '未命名'} · ${first.phone || phone}`,
      });
      await this.loadCoupons(first._id);
    } catch (error) {
      wx.showToast({ title: '查询失败（需店长权限）', icon: 'none' });
    }
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
    const preview = buildIssueCouponPayload(
      {
        memberId: this.data.selectedId,
        openid: 'preview',
        category: this.data.issueCategory,
        benefitType: this.data.issueBenefitType,
        benefitValue,
        validFromDate: this.data.issueValidFrom,
        expireAtDate: this.data.issueExpireAt,
      },
      Date.now(),
    );
    if (!preview.ok) {
      wx.showToast({ title: preview.message || '请检查发放信息', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认发放',
      content: `${preview.coupon.name} · ${this.data.issueValidFrom} 至 ${this.data.issueExpireAt}`,
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ issuing: true });
        try {
          const result = await api.adminIssueCoupon({
            memberId: this.data.selectedId,
            category: this.data.issueCategory,
            benefitType: this.data.issueBenefitType,
            benefitValue,
            validFromDate: this.data.issueValidFrom,
            expireAtDate: this.data.issueExpireAt,
          });
          if (!result || !result.ok) {
            wx.showToast({
              title: (result && result.message) || '发放失败',
              icon: 'none',
            });
            return;
          }
          wx.showToast({ title: '发放成功', icon: 'success' });
          this.setData({
            issueBenefitValue: '',
            issuePreviewName: '',
            issueValidFrom: todayYmd(),
            issueExpireAt: todayYmd(),
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
