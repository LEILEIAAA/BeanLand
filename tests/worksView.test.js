const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeCaption,
  buildWorksCardPreview,
  formatWorkDate,
} = require('../miniprogram/utils/worksView');

test('normalizeCaption trims and caps at 40', () => {
  assert.equal(normalizeCaption('  hi  '), 'hi');
  assert.equal(normalizeCaption(null), '');
  assert.equal(normalizeCaption('a'.repeat(45)).length, 40);
});

test('buildWorksCardPreview empty', () => {
  assert.deepEqual(buildWorksCardPreview([]), {
    workCount: 0,
    previewThumbs: [],
    worksEmpty: true,
    worksHint: '还没有作品，去拍一张',
  });
});

test('buildWorksCardPreview takes newest 3', () => {
  const list = [
    { _id: '1', imageFileID: 'cloud://a', createdAt: 300 },
    { _id: '2', imageFileID: 'cloud://b', createdAt: 200 },
    { _id: '3', imageFileID: 'cloud://c', createdAt: 100 },
    { _id: '4', imageFileID: 'cloud://d', createdAt: 50 },
  ];
  const preview = buildWorksCardPreview(list);
  assert.equal(preview.workCount, 4);
  assert.equal(preview.worksEmpty, false);
  assert.deepEqual(
    preview.previewThumbs.map((t) => t.imageFileID),
    ['cloud://a', 'cloud://b', 'cloud://c'],
  );
});

test('formatWorkDate formats ms timestamp as UTC date', () => {
  assert.equal(formatWorkDate(Date.UTC(2026, 6, 3)), '2026-07-03');
  assert.equal(formatWorkDate(0), '');
});
