#!/usr/bin/env node
// Generate PNG icons from icon.svg using sharp
// Usage: node generate.js

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const svgPath = path.join(__dirname, 'icon.svg');
const svg     = fs.readFileSync(svgPath);

const sizes = [16, 32, 48, 128];

(async () => {
  for (const size of sizes) {
    const out = path.join(__dirname, `icon${size}.png`);
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(out);
    console.log(`✓ icon${size}.png`);
  }
  console.log('Done.');
})();
