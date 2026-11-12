// Telas: inicial, pausa, fim de fase, fim de jogo, aviso de fase e botões de toque.
import { W, H } from './config.js';
import { TOUCH_BUTTONS, JOYSTICK } from './input.js';
import { FONT, panel, pad6 } from './ui.js';
import { drawTrophyShelf, drawTrophyIcons } from './trophies.js';

// Palavras de cada construção: o que se pula e o que se constrói
const WORDS = {
  igloo: { floes: 'as placas', floe: 'a placa', house: 'no iglu pronto' },
  cabin: { floes: 'os troncos', floe: 'o tronco', house: 'na cabana pronta' },
  base: { floes: 'os asteroides', floe: 'o asteroide', house: 'na base lunar pronta' },
  hut: { floes: 'as pranchas', floe: 'a prancha', house: 'na cabana de palha pronta' },
};

export function controlsFor(style = 'igloo') {
  const w = WORDS[style] || WORDS.igloo;
  return [
    ['← →', 'andar'],
    ['↑ ↓', `pular entre a costa e ${w.floes}`],
    ['Espaço', `inverter ${w.floe} (custa 1 bloco)`],
    ['↑ na porta', `entrar ${w.house}`],
    ['P / M', 'pausar / som'],
  ];
}
const CONTROLS = controlsFor();

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

  // Sem conta aprovada, o painel de login (auth-ui.js, em HTML) fica por cima
  if (game.locked) {
    ctx.restore();
    return;
  }

  // Prateleira com a coleção de troféus das fases especiais
  drawTrophyShelf(ctx, game.trophies, t);

  // Painel de instruções
  const px = W / 2 - 330;
  const py = 346;
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
  if (game.account?.nickname) {
    ctx.font = `700 18px ${FONT}`;
    ctx.fillStyle = '#FFFFFF';
    const rec = game.highScore > 0 ? `   ·   RECORDE  ${pad6(game.highScore)}` : '';
    ctx.fillText(`Olá, ${game.account.nickname}!${rec}`, W / 2, 333);
  } else if (game.highScore > 0) {
    ctx.font = `700 18px ${FONT}`;
    ctx.fillStyle = '#FFD36B';
    ctx.fillText(`RECORDE  ${pad6(game.highScore)}`, W / 2, 333);
  }
  ctx.globalAlpha = blink(t);
  ctx.font = `800 24px ${FONT}`;
  ctx.fillStyle = '#FFFFFF';
  const start = game.input.touchMode ? 'Toque para começar' : 'Pressione Enter ou Espaço para começar';
  ctx.fillText(start, W / 2, 638);
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
  controlsFor(game.igloo.style).forEach(([key, what], i) => {
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
  // Com ranking, o resultado vai para a esquerda e o ranking para a direita
  const cx = game.ranking ? W / 2 - 270 : W / 2;
  panel(ctx, cx - 260, H / 2 - 150, 520, 300, 20, 0.78);
  ctx.textAlign = 'center';
  iceTitle(ctx, 'FIM DE JOGO', cx, H / 2 - 82, 50);
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`Você chegou à fase ${game.level}`, cx, H / 2 - 44);

  // Pontuação e recorde lado a lado
  const col = (x, label, value, color) => {
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(label, x, H / 2 - 4);
    ctx.font = `900 36px ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(pad6(value), x, H / 2 + 36);
  };
  col(cx - 115, 'PONTUAÇÃO', game.score, '#FFFFFF');
  col(cx + 115, 'RECORDE', game.highScore, '#FFD36B');

  if (game.newRecord) {
    const s = 1 + Math.sin(t * 6) * 0.05;
    ctx.save();
    ctx.translate(cx, H / 2 + 74);
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
    cx, H / 2 + 126);
  ctx.restore();
  if (game.ranking) drawRanking(ctx, game, W / 2 + 10, RANKING_W);
}

const ordinal = (n) => `${n}º`;

// Ranking: os melhores com posição e apelido; a linha do jogador fica destacada.
// Se ele estiver fora da lista, aparece embaixo, depois de "…", com a posição real.
export const RANKING_ROW = 34;
export const RANKING_W = 530;
// Coluna dos troféus: termina antes da pontuação
const TROPHY_COL = 124;

export function drawRanking(ctx, game, x, w) {
  const r = game.ranking;
  const myUid = game.account?.uid;
  const list = r.top || [];
  const outside = !!r.me && !list.some((e) => e.uid === myUid);
  // A altura acompanha o número de linhas; o painel fica centralizado na vertical
  const lines = list.length ? list.length + (outside ? 1.7 : 0) : 3;
  const h = Math.max(300, 92 + lines * RANKING_ROW + 12);
  const y = (H - h) / 2;
  ctx.save();
  panel(ctx, x, y, w, h, 20, 0.8);
  ctx.textAlign = 'center';
  ctx.font = `900 26px ${FONT}`;
  ctx.fillStyle = '#FFD36B';
  ctx.fillText('RANKING', x + w / 2, y + 44);

  const msg = (text) => {
    ctx.font = `600 16px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(text, x + w / 2, y + h / 2);
  };
  if (r.loading) msg('Carregando ranking…');
  else if (r.error) msg('Não foi possível carregar o ranking.');
  else if (!list.length) msg('Ninguém pontuou ainda. Seja o primeiro!');
  else {
    const rows = list.map((e) => ({ ...e, mine: e.uid === myUid }));
    let ry = y + 92;
    const row = (e) => {
      if (e.mine) {
        ctx.fillStyle = 'rgba(255, 211, 107, 0.2)';
        ctx.beginPath();
        ctx.roundRect(x + 16, ry - 23, w - 32, RANKING_ROW - 2, 8);
        ctx.fill();
      }
      const medal = ['#FFD36B', '#D8E2E8', '#E0A060'][e.rank - 1];
      ctx.textAlign = 'right';
      ctx.font = `900 18px ${FONT}`;
      ctx.fillStyle = medal || 'rgba(255,255,255,0.6)';
      ctx.fillText(ordinal(e.rank), x + 74, ry);
      // Troféus das fases especiais ao lado do apelido (o apelido encolhe se faltar espaço)
      const tw = drawTrophyIcons(ctx, e.trophies, x + w - TROPHY_COL, ry + 6);
      ctx.textAlign = 'left';
      ctx.font = `${e.mine ? 800 : 600} 18px ${FONT}`;
      ctx.fillStyle = e.mine ? '#FFD36B' : '#FFFFFF';
      const room = w - TROPHY_COL - 92 - (tw ? tw + 14 : 0);
      ctx.fillText(e.mine ? `${e.nickname} (você)` : e.nickname, x + 92, ry, room);
      ctx.textAlign = 'right';
      ctx.font = `800 18px ${FONT}`;
      ctx.fillStyle = e.mine ? '#FFD36B' : '#BDEBFA';
      ctx.fillText(pad6(e.best), x + w - 32, ry);
      ry += RANKING_ROW;
    };
    rows.forEach(row);
    if (outside) {
      ctx.textAlign = 'center';
      ctx.font = `800 18px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('…', x + w / 2, ry - 8);
      ry += RANKING_ROW - 10;
      row({ ...r.me, mine: true });
    }
  }
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
  let w = Math.max(320, ctx.measureText(b.sub).width + 60);
  ctx.font = `900 28px ${FONT}`;
  w = Math.max(w, ctx.measureText(b.title).width + 60);
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

// Direcional analógico: base com marcas das 8 direções, fatia acesa na direção
// ativa e o pino seguindo o dedo.
function drawJoystick(ctx, game) {
  const { cx, cy, r, knob } = JOYSTICK;
  const s = game.input.stick;
  const active = s.pointerId !== null;
  ctx.save();
  // Base
  ctx.fillStyle = 'rgba(6, 30, 45, 0.38)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r + knob * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Fatia da direção ativa (45°)
  if (s.dirs.length) {
    const a = Math.atan2(s.dy, s.dx);
    const snapped = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
    ctx.fillStyle = 'rgba(189, 235, 250, 0.28)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r + knob * 0.6, snapped - Math.PI / 8, snapped + Math.PI / 8);
    ctx.closePath();
    ctx.fill();
  }
  // Marcas das 8 direções (setas nas 4 principais)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const big = i % 2 === 0;
    const d = r + knob * 0.6 - (big ? 13 : 10);
    ctx.save();
    ctx.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
    ctx.rotate(a);
    ctx.beginPath();
    if (big) {
      ctx.moveTo(6, 0);
      ctx.lineTo(-4, -6);
      ctx.lineTo(-4, 6);
    } else {
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }
  // Pino
  const kx = cx + s.dx;
  const ky = cy + s.dy;
  const g = ctx.createRadialGradient(kx - 8, ky - 10, 4, kx, ky, knob);
  g.addColorStop(0, active ? 'rgba(235, 250, 255, 0.95)' : 'rgba(235, 250, 255, 0.75)');
  g.addColorStop(1, active ? 'rgba(140, 205, 230, 0.9)' : 'rgba(120, 170, 195, 0.6)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(kx, ky, knob, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.stroke();
  ctx.restore();
}

export function drawTouchButtons(ctx, game) {
  drawJoystick(ctx, game);
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
