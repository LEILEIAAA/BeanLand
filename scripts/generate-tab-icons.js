/**
 * Mono refined tab icons — chubby soft-cute set (粗圆软萌).
 * Soft-filled both states, thick rounded geometry, no color tiles.
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
const IDLE = '#A8A29E';
const ACTIVE = '#1C1917';

/** MONO_ICONS: chubby sprout / calendar / coupon / heart */
function icons(cut) {
  return {
    sprout: `
      <ellipse cx="12" cy="20.2" rx="6.8" ry="2.2" fill="currentColor" opacity="0.35"/>
      <path d="M12 19.4V10.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="7.6" cy="9.4" rx="4.2" ry="3.1" transform="rotate(-28 7.6 9.4)" fill="currentColor"/>
      <ellipse cx="16.4" cy="8.6" rx="4.2" ry="3.1" transform="rotate(28 16.4 8.6)" fill="currentColor"/>
      <ellipse cx="7.2" cy="9.1" rx="1.5" ry="1.05" transform="rotate(-28 7.2 9.1)" fill="${cut}" opacity="0.45"/>
      <ellipse cx="16.8" cy="8.3" rx="1.5" ry="1.05" transform="rotate(28 16.8 8.3)" fill="${cut}" opacity="0.45"/>
    `,
    calendar: `
      <rect x="3.2" y="5.6" width="17.6" height="15.2" rx="3.4" fill="currentColor"/>
      <rect x="4.6" y="10.8" width="14.8" height="8.6" rx="2.2" fill="${cut}"/>
      <path d="M8 3.6v3.8M16 3.6v3.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="8.4" cy="14.2" r="1.25" fill="currentColor"/>
      <circle cx="12" cy="14.2" r="1.25" fill="currentColor"/>
      <circle cx="15.6" cy="14.2" r="1.25" fill="currentColor"/>
      <circle cx="8.4" cy="17.6" r="1.25" fill="currentColor"/>
      <circle cx="12" cy="17.6" r="1.25" fill="currentColor"/>
    `,
    coupon: `
      <path d="M3.4 7.2h17.2a1.8 1.8 0 0 1 1.8 1.8v2.1a2 2 0 1 0 0 3.8v2.1a1.8 1.8 0 0 1-1.8 1.8H3.4a1.8 1.8 0 0 1-1.8-1.8v-2.1a2 2 0 1 0 0-3.8V9a1.8 1.8 0 0 1 1.8-1.8z" fill="currentColor"/>
      <path d="M9 7.4v11.6" fill="none" stroke="${cut}" stroke-width="1.7" stroke-dasharray="1.8 1.8" stroke-linecap="round"/>
      <path d="M13.2 10.2h4.6M13.2 13.2h3.2" fill="none" stroke="${cut}" stroke-width="1.9" stroke-linecap="round"/>
    `,
    heart: `
      <path d="M12 20.8c-.45 0-.85-.16-1.25-.5C6.9 16.9 3.2 13.85 3.2 10A4.7 4.7 0 0 1 8.05 5.2c1.4 0 2.65.55 3.55 1.6A4.85 4.85 0 0 1 15.15 5.2 4.7 4.7 0 0 1 20 10c0 3.85-3.7 6.9-7.55 10.3-.4.34-.8.5-1.25.5z" fill="currentColor"/>
      <ellipse cx="9.1" cy="9.5" rx="1.7" ry="1.15" transform="rotate(-28 9.1 9.5)" fill="${cut}" opacity="0.55"/>
    `,
  };
}

function svgFor(body, color) {
  if (!body) throw new Error('icon body missing');
  const scaled = body.replace(/currentColor/g, color);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" fill="none">
  <g transform="translate(12 12) scale(0.8) translate(-12 -12)">${scaled}</g>
</svg>`;
}

async function writePng(file, svg) {
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, file));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const map = [
    ['home', 'heart'],
    ['activities', 'calendar'],
    ['packages', 'coupon'],
    ['member', 'sprout'],
  ];
  for (const [file, key] of map) {
    const body = icons('#FFFFFF')[key];
    if (!body) throw new Error(`missing icon key: ${key}`);
    await writePng(`${file}.png`, svgFor(body, IDLE));
    await writePng(`${file}-active.png`, svgFor(body, ACTIVE));
  }
  console.log('OK mono refined icons (outline/fill)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
