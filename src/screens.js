// Telas: inicial, pausa, fim de fase, fim de jogo, aviso de fase e botões de toque.
import { W, H } from './config.js';
import { TOUCH_BUTTONS } from './input.js';
import { FONT, panel, pad6 } from './ui.js';

const CONTROLS = [
  ['← →', 'andar'],
  ['↑ ↓', 'pular entre a costa e as placas'],
  ['Espaço', 'inverter a placa (custa 1 bloco)'],
  ['↑ na porta', 'entrar no iglu pronto'],
  ['P / M', 'pausar / som'],
];

const RULES_TEXT = [
  'Pule nas placas brancas: cada fileira acesa vira um bloco do iglu.',
  'Complete os 15 blocos + a porta e entre antes de congelar.',
  'Fuja dos bichos e do urso. Peixes valem pontos!',
];

function blink(t, speed = 2.2) {
  return 0.55 + 0.45 * Math.abs(Math.sin(t * speed));
}

// Título com aparência de gelo
function iceTitle(ctx, text, x, y, size) {
  ctx.save();
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0, 20, 40, 0.5)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.strokeStyle = '#0B3A52';
  ctx.lineWidth = 12;
  ctx.strokeText(text, x, y);
  ctx.shadowColor = 'transparent';
  const g = ctx.createLinearGradient(0, y - size, 0, y + 6);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.55, '#D9F3FC');
  g.addColorStop(1, '#7FCCEA');
  ctx.fillStyle = g;
  ctx.fillText(text, x, y);
  // Contorno fino claro por dentro, como a borda de um bloco de gelo
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.strokeText(text, x, y);
  ctx.restore();
}

export function drawTitle(ctx, game) {
  const t = game.time;
  ctx.save();
  // Escurece o alto para o título se destacar
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(4, 22, 36, 0.55)');
  g.addColorStop(0.5, 'rgba(4, 22, 36, 0.25)');
  g.addColorStop(1, 'rgba(4, 22, 36, 0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  iceTitle(ctx, 'Jogo do Gelinho', W / 2, 130 + Math.sin(t * 1.5) * 3, 86);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText('Construa o iglu antes de congelar!', W / 2, 172);

  // Painel de instruções
  const px = W / 2 - 330;
  const py = 300;
  panel(ctx, px, py, 660, 250, 18, 0.72);
  ctx.textAlign = 'left';
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = '#FFD36B';
  ctx.fillText('COMO JOGAR', px + 28, py + 34);
  ctx.font = `500 15px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  RULES_TEXT.forEach((line, i) => ctx.fillText(line, px + 28, py + 62 + i * 24));
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = '#FFD36B';
  ctx.fillText('CONTROLES', px + 28, py + 152);
  CONTROLS.forEach(([key, what], i) => {
    const col = i < 3 ? 0 : 1;
    const row = i < 3 ? i : i - 3;
    const x = px + 28 + col * 330;
    const y = py + 180 + row * 24;
    ctx.font = `800 14px ${FONT}`;
    ctx.fillStyle = '#BDEBFA';
    ctx.fillText(key, x, y);
    ctx.font = `500 14px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(what, x + 92, y);
  });

  // Recorde e chamada para começar
  ctx.textAlign = 'center';
  if (game.highScore > 0) {
    ctx.font = `700 18px ${FONT}`;
    ctx.fillStyle = '#FFD36B';
    ctx.fillText(`RECORDE  ${pad6(game.highScore)}`, W / 2, 280);
  }
  ctx.globalAlpha = blink(t);
  ctx.font = `800 24px ${FONT}`;
  ctx.fillStyle = '#FFFFFF';
  const start = game.input.touchMode ? 'Toque para começar' : 'Pressione Enter ou Espaço para começar';
  ctx.fillText(start, W / 2, 600);
  ctx.restore();
}

export function drawPause(ctx, game) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 20, 34, 0.6)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, W / 2 - 230, H / 2 - 130, 460, 250, 18, 0.75);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 52px ${FONT}`;
  ctx.fillText('PAUSA', W / 2, H / 2 - 62);
  ctx.textAlign = 'left';
  CONTROLS.forEach(([key, what], i) => {
    const y = H / 2 - 18 + i * 24;
    ctx.font = `800 14px ${FONT}`;
    ctx.fillStyle = '#BDEBFA';
    ctx.fillText(key, W / 2 - 180, y);
    ctx.font = `500 14px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(what, W / 2 - 80, y);
  });
  ctx.textAlign = 'center';
  // game.time fica parado na pausa: o piscar usa o relógio real
  ctx.globalAlpha = blink(performance.now() / 1000);
  ctx.font = `700 16px ${FONT}`;
  ctx.fillStyle = '#FFD36B';
  ctx.fillText(game.input.touchMode ? 'Toque em II para continuar' : 'Pressione P para continuar', W / 2, H / 2 + 108);
  ctx.restore();
}

export function drawLevelEnd(ctx, game) {
  ctx.save();
  ctx.textAlign = 'center';
  panel(ctx, W / 2 - 250, H / 2 - 110, 500, 210, 18, 0.7);
  ctx.fillStyle = '#FFD36B';
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText(`FASE ${game.level} CONCLUÍDA`, W / 2, H / 2 - 52);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText(`Bônus de temperatura · ${game.params.degreePoints} pts por grau`, W / 2, H / 2 - 14);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(`${game.temp}°   +${game.bonusTotal}`, W / 2, H / 2 + 38);
  if (game.bonusDone) {
    ctx.font = `600 15px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Preparando a próxima fase…', W / 2, H / 2 + 76);
  }
  ctx.restore();
}

export function drawGameOver(ctx, game) {
  const t = game.time;
  ctx.save();
  ctx.fillStyle = 'rgba(4, 20, 34, 0.6)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, W / 2 - 260, H / 2 - 150, 520, 300, 20, 0.78);
  ctx.textAlign = 'center';
  iceTitle(ctx, 'FIM DE JOGO', W / 2, H / 2 - 82, 50);
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`Você chegou à fase ${game.level}`, W / 2, H / 2 - 44);

  // Pontuação e recorde lado a lado
  const col = (x, label, value, color) => {
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(label, x, H / 2 - 4);
    ctx.font = `900 36px ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(pad6(value), x, H / 2 + 36);
  };
  col(W / 2 - 115, 'PONTUAÇÃO', game.score, '#FFFFFF');
  col(W / 2 + 115, 'RECORDE', game.highScore, '#FFD36B');

  if (game.newRecord) {
    const s = 1 + Math.sin(t * 6) * 0.05;
    ctx.save();
    ctx.translate(W / 2, H / 2 + 74);
    ctx.scale(s, s);
    ctx.fillStyle = '#FFD36B';
    ctx.beginPath();
    ctx.roundRect(-98, -17, 196, 30, 15);
    ctx.fill();
    ctx.fillStyle = '#3A2A00';
    ctx.font = `900 16px ${FONT}`;
    ctx.fillText('★ NOVO RECORDE! ★', 0, 4);
    ctx.restore();
  }
  ctx.globalAlpha = blink(t);
  ctx.font = `600 16px ${FONT}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(game.input.touchMode ? 'Toque para jogar de novo' : 'Enter ou Espaço para jogar de novo',
    W / 2, H / 2 + 126);
  ctx.restore();
}

// Aviso de início de fase: entra deslizando, fica e some deslizando (sem bloquear)
export function drawBanner(ctx, game) {
  const b = game.banner;
  if (!b) return;
  const k = b.t / b.life;
  const inK = Math.min(1, b.t / 0.35);
  const outK = Math.min(1, (b.life - b.t) / 0.35);
  const y = 140 - (1 - Math.min(inK, outK)) * 40;
  ctx.save();
  ctx.globalAlpha = Math.min(inK, outK);
  ctx.font = `700 17px ${FONT}`;
  const w = Math.max(320, ctx.measureText(b.sub).width + 60);
  panel(ctx, W / 2 - w / 2, y - 34, w, 74, 16, 0.7);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD36B';
  ctx.font = `900 28px ${FONT}`;
  ctx.fillText(b.title, W / 2, y);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText(b.sub, W / 2, y + 26);
  ctx.restore();
  return k;
}

export function drawTouchButtons(ctx, game) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const b of TOUCH_BUTTONS) {
    const pressed = b.hold && game.input.isDown(b.id);
    ctx.fillStyle = pressed ? 'rgba(189, 235, 250, 0.45)' : 'rgba(6, 30, 45, 0.38)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (b.round) ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, Math.PI * 2);
    else ctx.roundRect(b.x, b.y, b.w, b.h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `800 ${b.round ? 40 : b.w > 60 ? 28 : 16}px ${FONT}`;
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  }
  ctx.restore();
}
