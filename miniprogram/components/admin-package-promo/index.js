const api = require('../../utils/api');
const { formatYuan } = require('../../utils/money');

function formatPromoTip(rate) {
  const text = formatYuan(rate);
  if (!(Number(rate) > 0 && Number(rate) < 10)) return '';
  return `全场${text}折`;
}

function shouldAutoSyncTip(tip) {
  const text = String(tip || '').trim();
  return !text || /^全场[\d.]+折$/.test(text);
}

function blankDraft() {
  return {
    active: true,
    discountRate: '8',
    label: '开业七天',
    tip: '全场8折',
  };
}

Component({
  options: {
    styleIsolation: 'apply-shared',
  },
  data: {
    formEpoch: 0,
    active: true,
    rate: '8',
    label: '开业七天',
    tip: '全场8折',
    saving: false,
  },
  lifetimes: {
    attached() {
      this._draft = blankDraft();
      this._dirty = false;
      this._loadId = 0;
      this.loadPromo();
    },
  },
  methods: {
    applyDraftToView(draft, remount) {
      const next = {
        active: !!draft.active,
        rate: draft.discountRate === undefined || draft.discountRate === null
          ? ''
          : String(draft.discountRate),
        label: draft.label || '',
        tip: draft.tip || '',
      };
      if (remount) {
        next.formEpoch = this.data.formEpoch + 1;
      }
      this.setData(next);
    },
    async loadPromo() {
      const loadId = ++this._loadId;
      try {
        const res = await api.adminGetPackagePromo();
        if (loadId !== this._loadId || this._dirty) return;
        if (!res || !res.ok || !res.packagePromo) {
          wx.showToast({ title: (res && res.message) || '折扣加载失败', icon: 'none' });
          return;
        }
        const promo = res.packagePromo;
        const rate = promo.discountRate;
        const tip = shouldAutoSyncTip(promo.tip)
          ? (formatPromoTip(rate) || promo.tip || '')
          : (promo.tip || '');
        this._draft = {
          active: !(promo.active === false),
          discountRate: rate === undefined || rate === null ? '' : String(rate),
          label: promo.label || '',
          tip,
        };
        this.applyDraftToView(this._draft, true);
      } catch (error) {
        console.warn('[admin-package-promo] load', error);
        wx.showToast({ title: '折扣加载失败', icon: 'none' });
      }
    },
    onToggle() {
      try {
        wx.hideKeyboard();
      } catch (error) {
        // ignore
      }
      this._dirty = true;
      this._draft.active = !this._draft.active;
      // 只改开关，不动 input 的 value，避免整表受控回写抖动。
      this.setData({ active: this._draft.active });
    },
    onInput(event) {
      const field = event.currentTarget.dataset.field;
      const value = event.detail.value;
      this._dirty = true;
      if (field === 'discountRate') {
        this._draft.discountRate = value;
        // 输入过程不 setData rate，避免光标跳动；tip 延后到 blur 同步。
        return;
      }
      if (field === 'label') {
        this._draft.label = value;
        return;
      }
      if (field === 'tip') {
        this._draft.tip = value;
      }
    },
    onBlur(event) {
      const field = event.currentTarget.dataset.field;
      if (field === 'discountRate') {
        const rate = Number(this._draft.discountRate);
        if (shouldAutoSyncTip(this._draft.tip)) {
          const tip = formatPromoTip(rate);
          if (tip) this._draft.tip = tip;
        }
        // blur 时一次性回写展示，不动开关。
        this.setData({
          rate: this._draft.discountRate,
          tip: this._draft.tip,
        });
        return;
      }
      if (field === 'label') {
        this.setData({ label: this._draft.label });
        return;
      }
      if (field === 'tip') {
        this.setData({ tip: this._draft.tip });
      }
    },
    async onSave() {
      if (this.data.saving) return;
      const draft = this._draft;
      const rate = Number(draft.discountRate);
      if (draft.active && !(rate > 0 && rate < 10)) {
        wx.showToast({ title: '折扣需在0-10之间(如8=8折)', icon: 'none' });
        return;
      }
      const tip = shouldAutoSyncTip(draft.tip)
        ? (formatPromoTip(rate) || draft.tip)
        : draft.tip;
      this.setData({ saving: true });
      wx.showLoading({ title: '保存中', mask: true });
      try {
        const res = await api.adminSavePackagePromo({
          action: 'save',
          promo: {
            active: !!draft.active,
            discountRate: draft.discountRate,
            label: draft.label,
            tip,
          },
        });
        wx.hideLoading();
        if (!res || !res.ok) {
          wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' });
          return;
        }
        const saved = res.packagePromo || {
          active: draft.active,
          discountRate: rate,
          label: draft.label,
          tip,
        };
        this._dirty = false;
        this._draft = {
          active: !(saved.active === false),
          discountRate: saved.discountRate === undefined ? '' : String(saved.discountRate),
          label: saved.label || '',
          tip: saved.tip || '',
        };
        this.applyDraftToView(this._draft, true);
        wx.showToast({ title: '折扣已更新', icon: 'success' });
      } catch (error) {
        wx.hideLoading();
        wx.showToast({ title: '保存失败', icon: 'none' });
      } finally {
        this.setData({ saving: false });
      }
    },
  },
});
