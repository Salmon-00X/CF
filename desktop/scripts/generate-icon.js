/* =========================================================================
 * generate-icon.js — produces the app icon for the Windows installer/taskbar.
 *
 * Renders a 512×512 PNG (Ford-blue rounded square + bold "CF") with sharp,
 * then embeds sizes 16/32/48/64/128/256 into a multi-size .ico with png-to-ico.
 *
 * Outputs:
 *   desktop/build-resources/icon.png   (512×512)
 *   desktop/build-resources/icon.ico   (16,32,48,64,128,256)
 * ========================================================================= */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIcoMod = require('png-to-ico');
const pngToIco = pngToIcoMod.default || pngToIcoMod;

const OUT_DIR = path.join(__dirname, '..', 'build-resources');
const PNG_PATH = path.join(OUT_DIR, 'icon.png');
const ICO_PATH = path.join(OUT_DIR, 'icon.ico');
const ICO_SIZES = [256, 128, 64, 48, 32, 16];

// Ford-blue gradient (--ford-950 → --ford-700), 48px-radius rounded square,
// a faint white inner glow, and bold white "CF" centered (220px on 512).
const SVG = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0b1f52"/>
      <stop offset="1" stop-color="#1e3a8a"/>
    </linearGradient>
    <radialGradient id="glow" cx="256" cy="256" r="80" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="48" ry="48" fill="url(#bg)"/>
  <rect x="0" y="0" width="512" height="512" rx="48" ry="48" fill="url(#glow)"/>
  <text x="256" y="262" font-family="Arial, Helvetica, sans-serif" font-size="220"
        font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central"
        letter-spacing="-6">CF</text>
</svg>`;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Master 512×512 raster.
  const base = await sharp(Buffer.from(SVG)).png().toBuffer();
  await sharp(base).toFile(PNG_PATH);

  // One PNG per embedded size (png-to-ico does not resize — it embeds as-is).
  const buffers = await Promise.all(
    ICO_SIZES.map((s) => sharp(base).resize(s, s).png().toBuffer())
  );
  const ico = await pngToIco(buffers);
  fs.writeFileSync(ICO_PATH, ico);

  const kb = (fs.statSync(ICO_PATH).size / 1024).toFixed(1);
  console.log(`Wrote ${PNG_PATH}`);
  console.log(`Wrote ${ICO_PATH} (${kb} KB, sizes: ${ICO_SIZES.join(', ')})`);
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
