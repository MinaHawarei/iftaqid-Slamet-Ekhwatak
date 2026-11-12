import { Verse } from '../data/verses';
import { getVerseReference } from './whatsapp';

function roundRect(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(px + r, py);
  ctx.arcTo(px + w, py, px + w, py + h, r);
  ctx.arcTo(px + w, py + h, px, py + h, r);
  ctx.arcTo(px, py + h, px, py, r);
  ctx.arcTo(px, py, px + w, py, r);
  ctx.closePath();
}

function drawCross(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
): void {
  const k = size / 100;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(k, k);
  ctx.fillStyle = color;
  const rects = [
    [44, 10, 12, 80, 3],
    [10, 44, 80, 12, 3],
    [32, 8, 36, 10, 4],
    [32, 82, 36, 10, 4],
    [8, 32, 10, 36, 4],
    [82, 32, 10, 36, 4]
  ];
  rects.forEach(([a, b, w, h, r]) => {
    roundRect(ctx, a, b, w, h, r);
    ctx.fill();
  });
  ctx.restore();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number
): string[] {
  const lines: string[] = [];
  text.split('\n').forEach((par) => {
    const words = par.split(/\s+/).filter(Boolean);
    let line = '';
    if (!words.length) {
      lines.push('');
      return;
    }
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = t;
      }
    }
    lines.push(line);
  });
  return lines;
}

// Cached logo image to avoid re-fetching
let cachedLogo: HTMLImageElement | null = null;

export async function preloadLogo(src: string): Promise<HTMLImageElement | null> {
  if (cachedLogo && cachedLogo.complete) return cachedLogo;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedLogo = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Pure canvas card image renderer matching the original pixel-level styling.
 */
export async function renderCardImage(
  v: Verse,
  name?: string,
  greeting?: string,
  logoImg?: HTMLImageElement | null
): Promise<Blob | null> {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await Promise.all([
        document.fonts.load('700 60px Amiri'),
        document.fonts.load('800 40px Cairo'),
        document.fonts.load('600 30px Cairo'),
        document.fonts.load('700 60px "Reem Kufi"')
      ]);
    } catch {
      // Ignore font loading errors
    }
  }

  const cleanName = (name || '').trim();
  const cleanGreeting = (greeting || '').trim();

  const dy = cleanName && cleanGreeting ? 115 : cleanName ? 60 : cleanGreeting ? 0 : -90;
  const W = 1080;
  const H = 1400 + dy;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background gradient
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#241a45');
  g.addColorStop(1, '#15122e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Radial gradients
  g = ctx.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, 720);
  g.addColorStop(0, 'rgba(255,122,107,.28)');
  g.addColorStop(1, 'rgba(255,122,107,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  g = ctx.createRadialGradient(0, H * 0.3, 0, 0, H * 0.3, 640);
  g.addColorStop(0, 'rgba(240,192,90,.16)');
  g.addColorStop(1, 'rgba(240,192,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Recipient Name
  if (cleanName) {
    let nf = 100;
    const nfont = (s: number) => `700 ${s}px "Reem Kufi", Cairo, Tahoma, sans-serif`;
    for (; nf > 44; nf -= 4) {
      ctx.font = nfont(nf);
      if (ctx.measureText(cleanName).width <= 860) break;
    }
    ctx.save();
    ctx.shadowColor = 'rgba(240,192,90,.45)';
    ctx.shadowBlur = 30;
    g = ctx.createLinearGradient(0, 60, 0, 170);
    g.addColorStop(0, '#ffe6a3');
    g.addColorStop(1, '#c9962e');
    ctx.fillStyle = g;
    ctx.fillText(cleanName, W / 2, cleanGreeting ? 105 : 120);
    ctx.restore();
  }

  // Greeting
  if (cleanGreeting) {
    let gf = cleanName ? 44 : 54;
    const gfont = (s: number) => `${cleanName ? 700 : 800} ${s}px Cairo, Tahoma, sans-serif`;
    for (; gf > 26; gf -= 2) {
      ctx.font = gfont(gf);
      if (ctx.measureText(cleanGreeting).width <= 860) break;
    }
    const gy = cleanName ? 210 : 115;
    ctx.fillStyle = cleanName ? '#e9dcc0' : '#f0c05a';
    ctx.fillText(cleanGreeting, W / 2, gy);
    if (cleanName) {
      const tw = ctx.measureText(cleanGreeting).width / 2 + 30;
      if (tw + 130 < W / 2 - 30) {
        ctx.fillStyle = 'rgba(240,192,90,.6)';
        ctx.fillRect(W / 2 - tw - 110, gy, 90, 2);
        ctx.fillRect(W / 2 + tw + 20, gy, 90, 2);
      }
    }
  }

  // Card Inner Box
  const cx = 70;
  const cy = 190 + dy;
  const cw = 940;
  const ch = 790;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.5)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;
  g = ctx.createLinearGradient(0, cy, 0, cy + ch);
  g.addColorStop(0, '#fffaf0');
  g.addColorStop(1, '#fbf2dc');
  roundRect(ctx, cx, cy, cw, ch, 46);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  roundRect(ctx, cx, cy, cw, ch, 46);
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#c9962e';
  ctx.stroke();

  roundRect(ctx, cx + 22, cy + 22, cw - 44, ch - 44, 30);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(201,150,46,.6)';
  ctx.stroke();

  drawCross(ctx, W / 2, cy + 105, 66, '#c9962e');

  // Verse text
  const ref = getVerseReference(v);
  const text = '«' + v.t + '»';
  const maxW = cw - 170;
  const maxH = ref ? ch - 400 : ch - 290;

  let fs = 74;
  let lines: string[] = [];
  for (; fs >= 30; fs -= 2) {
    ctx.font = `700 ${fs}px Amiri, 'Times New Roman', serif`;
    lines = wrapLines(ctx, text, maxW);
    if (lines.length * fs * 1.75 <= maxH) break;
  }
  const lh = fs * 1.75;
  const top = cy + 185 + (maxH - lines.length * lh) / 2;
  ctx.fillStyle = '#3a1a24';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, top + lh * (i + 0.5)));

  // Reference pill
  if (ref) {
    ctx.font = '800 40px Cairo, Tahoma, sans-serif';
    const pw = ctx.measureText(ref).width + 90;
    const py = cy + ch - 108;
    g = ctx.createLinearGradient(0, py - 36, 0, py + 36);
    g.addColorStop(0, '#a02a45');
    g.addColorStop(1, '#7a1f33');
    roundRect(ctx, (W - pw) / 2, py - 37, pw, 74, 37);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(ref, W / 2, py + 2);
  }

  // Footer Logo
  const logo = logoImg || cachedLogo || (document.querySelector('.brand img') as HTMLImageElement | null);
  if (logo && logo.naturalWidth) {
    const lw = 600;
    const lhh = (lw * logo.naturalHeight) / logo.naturalWidth;
    ctx.drawImage(logo, (W - lw) / 2, 1030 + dy, lw, lhh);
  }

  return new Promise((res) => canvas.toBlob(res, 'image/png'));
}

