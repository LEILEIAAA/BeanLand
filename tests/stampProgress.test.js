const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStampProgress } = require('../miniprogram/utils/stampProgress');

test('buildStampProgress uses cloud member fields', () => {
  assert.deepEqual(buildStampProgress({ stampCount: 0, stampTarget: 5 }), {
    stampCount: 0,
    stampTarget: 5,
    progressPercent: 0,
  });
  assert.deepEqual(buildStampProgress({ stampCount: 2, stampTarget: 5 }), {
    stampCount: 2,
    stampTarget: 5,
    progressPercent: 40,
  });
});

test('buildStampProgress defaults and clamps', () => {
  assert.deepEqual(buildStampProgress(null), {
    stampCount: 0,
    stampTarget: 5,
    progressPercent: 0,
  });
  assert.deepEqual(buildStampProgress({ stampCount: 9, stampTarget: 5 }), {
    stampCount: 9,
    stampTarget: 5,
    progressPercent: 100,
  });
  assert.equal(buildStampProgress({ stampCount: 1, stampTarget: 0 }).stampTarget, 5);
});
