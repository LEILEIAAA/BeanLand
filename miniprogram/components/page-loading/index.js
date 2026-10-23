const { buildSkeletonRows } = require('../../utils/pageLoading');

Component({
  properties: {
    tip: {
      type: String,
      value: '加载中',
    },
    rows: {
      type: Number,
      value: 4,
    },
    compact: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    rowList: buildSkeletonRows(4),
  },
  observers: {
    rows(count) {
      this.setData({ rowList: buildSkeletonRows(count) });
    },
  },
});
