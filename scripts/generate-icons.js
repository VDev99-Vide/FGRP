import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve(process.cwd(), 'public');

// High-res SVG for Dashdark V
const standardSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0e1726"/>
      <stop offset="100%" stop-color="#081028"/>
    </linearGradient>
    <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="16" flood-color="#CB3CFF" flood-opacity="0.6"/>
      <feDropShadow dx="0" dy="0" stdDeviation="28" flood-color="#00C2FF" flood-opacity="0.4"/>
    </filter>
  </defs>
  <!-- Background Rounded Rect -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)"/>
  <rect x="12" y="12" width="488" height="488" rx="100" stroke="rgba(255,255,255,0.14)" stroke-width="8" fill="none"/>
  
  <!-- Dashdark V Shield/V Isometric Icon Scaled -->
  <g filter="url(#neonGlow)" transform="translate(40, 40) scale(9)">
    <path d="M12 12C12 9.79086 13.7909 8 16 8H24V22H12V12Z" fill="#00C2FF"/>
    <path d="M24 22H36V32C36 34.2091 34.2091 36 32 36H24V22Z" fill="#00C2FF"/>
    <path d="M24 8H32C34.2091 8 36 9.79086 36 12V22H24V8Z" fill="#CB3CFF"/>
    <path d="M12 22H24V36H16C13.7909 36 12 34.2091 12 32V22Z" fill="#CB3CFF"/>
    <circle cx="24" cy="22" r="3" fill="#FFFFFF"/>
  </g>
</svg>
`;

// Maskable version has extra safe zone padding
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0e1726"/>
      <stop offset="100%" stop-color="#081028"/>
    </linearGradient>
    <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="14" flood-color="#CB3CFF" flood-opacity="0.6"/>
      <feDropShadow dx="0" dy="0" stdDeviation="24" flood-color="#00C2FF" flood-opacity="0.4"/>
    </filter>
  </defs>
  <!-- Full Bleed Background for Maskable Icon -->
  <rect width="512" height="512" fill="url(#bgGrad)"/>
  
  <!-- Centered Inner Emblem within 80% safe area zone -->
  <g filter="url(#neonGlow)" transform="translate(80, 80) scale(7.33)">
    <path d="M12 12C12 9.79086 13.7909 8 16 8H24V22H12V12Z" fill="#00C2FF"/>
    <path d="M24 22H36V32C36 34.2091 34.2091 36 32 36H24V22Z" fill="#00C2FF"/>
    <path d="M24 8H32C34.2091 8 36 9.79086 36 12V22H24V8Z" fill="#CB3CFF"/>
    <path d="M12 22H24V36H16C13.7909 36 12 34.2091 12 32V22Z" fill="#CB3CFF"/>
    <circle cx="24" cy="22" r="3" fill="#FFFFFF"/>
  </g>
</svg>
`;

async function generate() {
  const stdBuffer = Buffer.from(standardSvg);
  const maskBuffer = Buffer.from(maskableSvg);

  // 512x512 standard
  await sharp(stdBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));

  // 192x192 standard
  await sharp(stdBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));

  // 512x512 maskable
  await sharp(maskBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));

  // 192x192 maskable
  await sharp(maskBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-192x192.png'));

  // 180x180 Apple Touch Icon
  await sharp(stdBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // 32x32 Favicon
  await sharp(stdBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));

  // 16x16 Favicon
  await sharp(stdBuffer)
    .resize(16, 16)
    .png()
    .toFile(path.join(publicDir, 'favicon-16x16.png'));

  console.log('✅ All PWA and Favicon images successfully generated!');
}

generate().catch(console.error);
