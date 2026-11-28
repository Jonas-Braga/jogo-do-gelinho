import { W, H } from './config.js';
import { Game } from './game.js';
import { MUTE_BUTTON } from './hud.js';
import { checkpointAt } from './screens.js';
import { shelfAt } from './trophies.js';
import { createBackend } from './backend.js';
import { AuthUI } from './auth-ui.js';
import { InstallButton } from './install.js';
import { prefetchLevel, levelReady, model3dAvailable } from './model3d.js';

const canvas = document.getElementById('game');

// Contas no Firebase (ou em memória com ?backend=memoria). Se o servidor não
// carregar, o painel de conta mostra o erro e o jogo fica bloqueado.
let backend;
try {
  backend = await createBackend();
} catch (e) {
  console.error('[gelinho] não foi possível carregar o servidor de contas:', e);
  backend = {
    onChange: (cb) => cb({ status: 'error' }),
    signOut: async () => location.reload(),
  };
}
const game = new Game(canvas, { title: true, backend });
// Piloto da etapa 2: personagem da fase normal em 3D (fotografado ao abrir o jogo)
game.renderer.use3d = true;
// Fotos 3D tiradas antes de cada fase começar (sem o 2D aparecendo antes do 3D)
game.preload = { request: prefetchLevel, ready: levelReady };
// Só 3D: o desenho 2D antigo nunca aparece no jogo de verdade (fica só para os testes)
game.preload.available = model3dAvailable;
game.renderer.only3d = true;
prefetchLevel(1);
new AuthUI(game, backend);
new InstallButton(game);

// Escala responsiva com proporção mantida; backing store em alta densidade.
function resize() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = `${Math.floor(W * s)}px`;
  canvas.style.height = `${Math.floor(H * s)}px`;
  canvas.width = Math.round(W * s * dpr);
  canvas.height = Math.round(H * s * dpr);
  game.setScale(canvas.width / W);
}

window.addEventListener('resize', resize);
resize();
game.start();

// O navegador só libera o áudio depois de um gesto do usuário.
const unlockAudio = () => game.sfx.unlock();
window.addEventListener('keydown', unlockAudio);
window.addEventListener('pointerdown', unlockAudio);

// Coordenadas do ponteiro → resolução lógica 1280x720
function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}

const inMute = ({ x, y }) => {
  const b = MUTE_BUTTON;
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
};

// Clique/toque: botão de mudo, botões de toque e "toque para começar/continuar"
canvas.addEventListener('pointerdown', (e) => {
  const p = toLogical(e);
  game.sfx.unlock();
  if (inMute(p)) {
    game.sfx.toggleMute();
    return;
  }
  // Escolha do checkpoint: tocar/clicar num cartão começa dali
  if (game.state === 'checkpoint') {
    if (e.pointerType !== 'mouse') {
      e.preventDefault();
      game.input.touchMode = true;
      game.input.padActive = false;
    }
    const card = checkpointAt(game, p.x, p.y);
    if (card) game.confirmCheckpoint(card.level);
    return;
  }
  // Tela inicial: clicar/tocar num troféu ganho da prateleira começa da fase dele;
  // num troféu ainda não ganho, nada
  if (game.state === 'title' && !game.locked) {
    const slot = shelfAt(p.x, p.y);
    if (slot) {
      if (e.pointerType !== 'mouse') {
        e.preventDefault();
        game.input.touchMode = true;
        game.input.padActive = false;
      }
      game.startFromTitle(slot.level);
      return;
    }
  }
  if (e.pointerType === 'mouse') {
    // Mouse: clicar na tela inicial / fim de jogo também começa (e encerra a
    // comemoração do troféu)
    if (['title', 'gameOver', 'trophy'].includes(game.state)) game.input.emit('start');
    return;
  }
  e.preventDefault();
  canvas.setPointerCapture?.(e.pointerId);
  const hitId = game.input.pointerDown(e.pointerId, p.x, p.y);
  // Nessas telas os botões de andar e pular não mandam nada: tocar ali também começa
  const free = !hitId || ['walk', 'up', 'down'].includes(hitId);
  if (free && ['title', 'gameOver', 'trophy'].includes(game.state)) game.input.emit('start');
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') return;
  const p = toLogical(e);
  game.input.pointerMove(e.pointerId, p.x, p.y);
});
const release = (e) => game.input.pointerUp(e.pointerId);
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

// App instalável (PWA): o service worker permite "Instalar app" / "Adicionar à
// tela inicial" no Chrome e no Edge do Android. Ele não guarda cache (sw.js).
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('[gelinho] service worker:', e));
}

// Exposto para depuração no console.
window.__game = game;
