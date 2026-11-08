// Utilidades de desenho compartilhadas pelo HUD e pelas telas.
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function panel(ctx, x, y, w, h, r = 12, alpha = 0.55) {
  ctx.fillStyle = `rgba(6, 30, 45, ${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function mix(a, b, k) {
  const pa = a.match(/\w\w/g).map((v) => parseInt(v, 16));
  const pb = b.match(/\w\w/g).map((v) => parseInt(v, 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(',')})`;
}

export const pad6 = (n) => String(Math.max(0, Math.floor(n))).padStart(6, '0');
