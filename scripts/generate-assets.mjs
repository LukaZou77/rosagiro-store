import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = "assets/products";
mkdirSync(outDir, { recursive: true });

const products = [
  ["aura-serum", "#d8b2a7", "#48605a", "SERUM"],
  ["nativa-cleanser", "#c8d8cf", "#263f3a", "GEL"],
  ["velvet-balm", "#c45d69", "#4d202a", "BALM"],
  ["solar-mist", "#e6c46e", "#65532a", "FPS"],
  ["flora-blush", "#e8a4a0", "#693a3f", "BLUSH"],
  ["noite-lip", "#7b2638", "#f4d7d1", "LIP"],
  ["bruma-figo", "#b8c5d1", "#2d4656", "MIST"],
  ["madeira-eau", "#c7ab83", "#443428", "EAU"],
  ["corpo-amendoa", "#d9c7a3", "#5f5039", "BODY"],
  ["cachos-oleo", "#a6c3a9", "#314b35", "HAIR"],
  ["pincel-precisao", "#d7d9dd", "#34363c", "TOOL"],
  ["necessaire", "#6f7887", "#f1eee8", "KIT"]
];

function productSvg(slug, main, dark, label) {
  return `
  <svg width="900" height="1100" viewBox="0 0 900 1100" xmlns="http://www.w3.org/2000/svg">
    <rect width="900" height="1100" fill="#f7f3ee"/>
    <rect x="76" y="76" width="748" height="948" rx="38" fill="#fbfaf7"/>
    <path d="M146 826 C246 724 390 786 490 662 C590 538 676 558 756 462 L756 1024 L146 1024 Z" fill="${main}" opacity=".32"/>
    <ellipse cx="456" cy="842" rx="210" ry="36" fill="#1c2522" opacity=".12"/>
    <rect x="374" y="236" width="170" height="510" rx="70" fill="${main}"/>
    <rect x="394" y="176" width="130" height="90" rx="28" fill="${dark}"/>
    <rect x="420" y="122" width="78" height="72" rx="16" fill="${dark}"/>
    <rect x="410" y="388" width="98" height="178" rx="12" fill="#fbfaf7" opacity=".82"/>
    <text x="459" y="460" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="4" fill="${dark}">${label}</text>
    <text x="459" y="512" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="${dark}">BELA VIVA</text>
    <path d="M274 224 C214 250 190 318 212 374 C278 348 304 284 274 224 Z" fill="#789480" opacity=".55"/>
    <path d="M636 268 C696 292 728 354 714 416 C646 402 604 334 636 268 Z" fill="#b97974" opacity=".42"/>
  </svg>`;
}

products.forEach(([slug, main, dark, label]) => {
  writeFileSync(join(outDir, `${slug}.svg`), productSvg(slug, main, dark, label), "utf8");
});

console.log(`Generated ${products.length} product assets.`);
