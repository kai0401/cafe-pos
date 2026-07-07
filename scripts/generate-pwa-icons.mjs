import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const ICONS = path.join(ROOT, "public", "icons");

const SETS = [
  { name: "waiter-icon", src: "waiter-icon.svg", sizes: [180, 192, 512] },
  { name: "kitchen-icon", src: "kitchen-icon.svg", sizes: [180, 192, 512] },
  { name: "icon", src: "icon.svg", sizes: [180, 192, 512] },
];

async function generate() {
  for (const set of SETS) {
    const svgPath = path.join(ICONS, set.src);
    if (!fs.existsSync(svgPath)) {
      console.warn(`skip: ${set.src} not found`);
      continue;
    }
    for (const size of set.sizes) {
      const out = path.join(ICONS, `${set.name}-${size}.png`);
      await sharp(svgPath).resize(size, size).png().toFile(out);
      console.log(`wrote ${path.relative(ROOT, out)}`);
    }
  }
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
