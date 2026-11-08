import { W, H, RULES } from './config.js';
import { drawLifeIcon } from './sprites.js';
import { FONT, panel, mix, pad6 } from './ui.js';
import {
  drawTitle, drawPause, drawLevelEnd, drawGameOver, drawBanner, drawTouchButtons,
} from './screens.js';

// Botão de mudo (área clicável em coordenadas lógicas; usado em main.js)
export const MUTE_BUTTON = { x: W - 62, y: H - 48, w: 46, h: 36 };

function drawMuteButton(ctx, muted) {
  const b = MUTE_BUTTON;
  panel(ctx, b.x, b.y, b.w, b.h, 10);
  const cx = b.x + 16;
  const cy = b.y + b.h / 2;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 4);
  ctx.lineTo(cx - 3, cy - 4);
  ctx.lineTo(cx + 3, cy - 10);
  ctx.lineTo(cx + 3, cy + 10);
  ctx.lineTo(cx - 3, cy + 4);
  ctx.lineTo(cx - 8, cy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (muted) {
    ctx.strokeStyle = '#FF8A7A';
    ctx.moveTo(cx + 8, cy - 5);
    ctx.lineTo(cx + 17, cy + 5);
    ctx.moveTo(cx + 17, cy - 5);
    ctx.lineTo(cx + 8, cy + 5);
  } else {
    ctx.arc(cx + 4, cy, 7, -0.8, 0.8);
    ctx.moveTo(cx + 4 + 12 * Math.cos(-0.8), cy + 12 * Math.sin(-0.8));
    ctx.arc(cx + 4, cy, 12, -0.8, 0.8);
  }
  ctx.stroke();
}

export function drawHud(ctx, game) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Tela inicial: só o título por cima do cenário (+ som e, no toque, nada mais)
  if (game.state === 'title') {
    drawTitle(ctx, game);
    drawMuteButton(ctx, game.sfx.muted);
    ctx.restore();
    return;
  }

  // Pontuação, recorde e vidas
  panel(ctx, 16, 14, 250, 62);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('PONTOS', 30, 34);
  const record = Math.max(game.highScore, game.score);
  ctx.textAlign = 'right';
  ctx.fillStyle = game.score > game.highScore && game.highScore > 0 ? '#FFD36B' : 'rgba(255,255,255,0.55)';
  ctx.fillText(`RECORDE ${pad6(record)}`, 254, 34);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 28px ${FONT}`;
  ctx.fillText(pad6(game.score), 30, 64);
  const lifeShown = Math.min(game.lives, 6);
  for (let i = 0; i < lifeShown; i++) drawLifeIcon(ctx, 178 + i * 22 - (lifeShown > 4 ? (lifeShown - 4) * 11 : 0), 54);
  if (game.lives > 6) {
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(`×${game.lives}`, 236, 58);
  }

  // Fase e blocos
  panel(ctx, W / 2 - 90, 14, 180, 62);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('FASE', W / 2, 34);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText(String(game.level), W / 2 - 34, 64);
  ctx.font = `600 13px ${FONT}`;
  ctx.fillStyle = game.igloo.complete ? '#FFD36B' : 'rgba(255,255,255,0.85)';
  ctx.fillText(`iglu ${game.igloo.count}/${RULES.iglooPieces}`, W / 2 + 34, 60);
  ctx.textAlign = 'left';

  // Termômetro
  const tx = W - 266;
  panel(ctx, tx, 14, 250, 62);
  const f = Math.max(0, game.temp / RULES.tempStart);
  const hot = mix('4FC3F7', 'F2643A', f);
  const danger = game.temp <= 10 && game.state === 'play';
  const flash = danger ? 0.55 + 0.45 * Math.abs(Math.sin(game.time * 6)) : 1;
  const bx = tx + 30;
  const by = 45;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.roundRect(bx, by - 8, 150, 16, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = flash;
  ctx.fillStyle = hot;
  ctx.beginPath();
  ctx.arc(bx, by, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(bx, by - 4.5, 8 + 138 * f, 9, 4.5);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(6, 30, 45, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 9; i++) {
    const x = bx + 8 + (138 * i) / 9;
    ctx.beginPath();
    ctx.moveTo(x, by - 7);
    ctx.lineTo(x, by - 3);
    ctx.stroke();
  }
  ctx.fillStyle = danger ? hot : '#FFFFFF';
  ctx.font = `800 26px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${game.temp}°`, tx + 238, 56);
  ctx.textAlign = 'left';

  // Controles: dica de teclado ou botões de toque
  if (game.input.touchMode) {
    drawTouchButtons(ctx, game);
  } else {
    ctx.font = `500 13px ${FONT}`;
    const hint = '←/→ andar   ↑/↓ pular   Espaço inverter placa (−1 bloco)   ↑ na porta: entrar   P pausa   M som';
    const hw = ctx.measureText(hint).width;
    panel(ctx, 16, H - 38, hw + 24, 26, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(hint, 28, H - 20);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `11px ${FONT}`;
  ctx.fillText(`${Math.round(game.fps)} fps`, W - 74, H - 16);
  ctx.textAlign = 'left';
  drawMuteButton(ctx, game.sfx.muted);

  // Telas por cima do jogo
  if (game.state === 'play' || game.state === 'entering') drawBanner(ctx, game);
  if (game.state === 'levelEnd') drawLevelEnd(ctx, game);
  else if (game.state === 'gameOver') drawGameOver(ctx, game);
  if (game.paused) drawPause(ctx, game);
  ctx.restore();
}
