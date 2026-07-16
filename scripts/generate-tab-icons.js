/**
 * Monochrome tab icons — refined line glyphs, no color tiles.
 * Prerequisite: npm install sharp --prefix scripts/.tab-icon-tmp
 */
const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('./.tab-icon-tmp/node_modules/sharp');
} catch (e) {
  console.error('Install sharp first: npm install sharp --prefix scripts/.tab-icon-tmp');
  process.exit(1);
}

const OUT = path.join(__dirname, '../miniprogram/assets/tab');
const SIZE = 96;
const NORMAL = '#A8A29E';
const SELECTED = '#1C1917';
const SCALE = 0.58;
const STROKE = 2.2;

/** Compact Lucide-ish paths in 24 viewBox — brand-leaning, not generic house/user. */
const ICONS = {
  bean: `<ellipse cx="12" cy="12" rx="7" ry="5" transform="rotate(-30 12 12)" fill="none"/><path d="M9.4 9.8c1.3 1 2.4 3.2 2.6 5.2"/>`,
  sparkles: `<path d="M12 3l1.2 4.2L17.4 8.4l-4.2 1.2L12 13.8l-1.2-4.2L6.6 8.4l4.2-1.2Z"/><path d="M18.5 14.5l.6 2.1 2.1.6-2.1.6-.6 2.1-.6-2.1-2.1-.6 2.1-.6Z"/><path d="M5.2 15.2l.45 1.55 1.55.45-1.55.45-.45 1.55-.45-1.55-1.55-.45 1.55-.45Z"/>`,
  gift: `<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M12 9v11"/><path d="M3.5 9h17v3.2H3.5z"/><path d="M8.2 6.2c0-1.8 1.7-2.6 2.6-1.2.3.5.6 1.2 1.2 1.2s.9-.7 1.2-1.2c.9-1.4 2.6-.6 2.6 1.2 0 1.6-2.2 2.8-3.8 2.8S8.2 7.8 8.2 6.2z"/>`,
  heart: `<path d="M19.5 12.5c1.2-1.2 2.5-2.7 2.5-4.6A4.4 4.4 0 0 0 17.6 3.5c-1.4 0-2.5.5-3.6 1.7C12.9 4 11.8 3.5 10.4 3.5A4.4 4.4 0 0 0 6 7.9c0 1.9 1.3 3.4 2.5 4.6L14 20z"/>`,
};

function svgFor(body, color) {
  const t = `translate(12 12) scale(${SCALE}) translate(-12 -12)`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" fill="none">
  <g transform="${t}" stroke="${color}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round" fill="none">${body}</g>
</svg>`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const names = [
    ['home', 'bean'],
    ['activities', 'sparkles'],
    ['packages', 'gift'],
    ['member', 'heart'],
  ];
  for (const [file, key] of names) {
    await sharp(Buffer.from(svgFor(ICONS[key], NORMAL)))
      .png()
      .toFile(path.join(OUT, `${file}.png`));
    await sharp(Buffer.from(svgFor(ICONS[key], SELECTED)))
      .png()
      .toFile(path.join(OUT, `${file}-active.png`));
  }
  console.log('OK mono line icons scale=', SCALE);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
