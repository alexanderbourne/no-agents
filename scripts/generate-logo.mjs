import sharp from 'sharp';

const BG = '#FAF9F6';
const DARK = '#1A1A1A';
const TAN = '#E8D5B0';
const GRAY = '#8A8078';

function buildSvg(w, h) {
  const s = w / 600; // scale factor relative to base design
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 600 210">
<rect width="600" height="210" fill="${BG}"/>
<rect x="40" y="35" width="140" height="140" rx="32" fill="${DARK}"/>
<text x="110" y="128" font-family="Century Gothic" font-weight="700" font-size="56" fill="${TAN}" text-anchor="middle">na</text>
<text x="205" y="112" font-family="Century Gothic" font-weight="700" font-size="54" fill="${DARK}">no-agents</text>
<text x="207" y="150" font-family="Arial" font-size="17" letter-spacing="1" fill="${GRAY}">flat fee real estate</text>
</svg>`;
}

const targets = [
  ['no-agents-logo-agency.png', 600, 210],
  ['no-agents-logo-search.png', 120, 42],
  ['no-agents-logo-stripe.png', 3500, 1225],
];

for (const [file, w, h] of targets) {
  const svg = buildSvg(w, h);
  await sharp(Buffer.from(svg)).png().toFile(file);
  console.log('wrote', file);
}
