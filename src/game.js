import { STEP, RULES, W, IGLOO, SHORE_Y } from './config.js';
import { Input } from './input.js';
import { createRows } from './floes.js';
import { Player } from './player.js';
import { Particles, PRINTS, FISH_HOP, WAKE_LINE } from './particles.js';
import { Igloo } from './igloo.js';
import { Renderer } from './renderer.js';
import { Critters } from './enemies.js';
import { Bear } from './bear.js';
import { Sleigh } from './christmas.js';
import { SeaTraffic, engineSound } from './beach.js';
import { Sfx } from './audio.js';
import { levelParams, levelIntro } from './levels.js';
import { loadHighScore, saveHighScore, loadTrophies, saveTrophies } from './storage.js';
import { normTrophies } from './specials.js';
import { Celebration } from './trophies.js';
import { DUST } from './space.js';
import { SEA } from './beach.js';
import { HAUNT } from './halloween.js';
import { LAVA } from './dino.js';
import { COVE } from './pirate.js';
import { BONUS } from './bonus.js';
import { POWERS, POWER_NAMES } from './powers.js';
import { HEAT } from './heat.js';

// Espera máxima pelas fotos 3D da próxima fase (s); depois segue com o que houver
export const PRELOAD_MAX = 12;

// Cores das partículas de pouso por cenário: poeira na costa, lascas ao pousar
// numa placa e brilhos da fileira que acende (padrão = neve e gelo)
const LAND_FX = {
  forest: { puff: '#C9B98A', chip: '#C08A50', spark: '#FFE6A8' },
  space: { puff: DUST.regolith, chip: DUST.rock, spark: DUST.spark },
  beach: { puff: SEA.sand, chip: SEA.spray, spark: SEA.spark },
  halloween: { puff: HAUNT.mist, chip: HAUNT.chip, spark: HAUNT.spark },
  // Na lava: cinza na costa, lascas de basalto, e respingos/bolhas cor de lava
  dino: { puff: LAVA.ash, chip: LAVA.chip, spark: LAVA.spark, liquid: LAVA.liquid },
  pirate: { puff: COVE.sand, chip: COVE.chip, spark: COVE.spark },
};

// Estados: title (tela inicial), play (jogando, incluindo animações de morte),
// entering (entrando no iglu), levelEnd (contagem do bônus), trophy (comemoração de
// um troféu novo, ao concluir uma fase especial pela primeira vez), gameOver.
export class Game {
  // `title: true` começa na tela inicial (o jogo de verdade); sem a opção, começa
  // direto numa partida (usado pelos testes).
  // `backend` (src/backend.js): com ele, só contas aprovadas jogam, o recorde fica
  // na conta e o fim de jogo mostra o ranking. Sem ele, recorde no localStorage.
  constructor(canvas, { title = false, backend = null } = {}) {
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.input = new Input();
    this.sfx = new Sfx();
    this.particles = new Particles();
    this.igloo = new Igloo(this.particles, this.sfx);
    this.critters = new Critters(this);
    this.bear = new Bear(this);
    this.sleigh = new Sleigh();
    this.boats = new SeaTraffic();
    this.special = null; // tema da fase especial atual (specials.js) ou null
    this.renderer = new Renderer(this.ctx);
    // Fotos 3D da fase seguinte (src/main.js liga { request(nível), ready(nível) }):
    // pedidas ao entrar no iglu; a fase só começa com elas prontas (no máximo
    // PRELOAD_MAX s de espera), para o desenho 2D não aparecer antes do 3D
    this.preload = null;
    this.loadingNext = false;
    this.waitNext = 0;
    this.advancePending = false;
    this.time = 0;
    this.paused = false;
    this.fps = 60;
    this.shake = 0;
    this.backend = backend;
    this.account = null;   // sessão da conta (backend.js) ou null
    this.ranking = null;   // ranking do fim de jogo: { loading } | { top, me } | { error }
    this.pendingSave = null;
    this.highScore = backend ? 0 : loadHighScore();
    // Troféus das fases especiais (níveis): na conta (com backend) ou no localStorage
    this.trophies = backend ? [] : normTrophies(loadTrophies());
    this.celebration = null;
    this.newRecord = false;
    this.banner = null;

    this.input.on('pause', () => {
      if (this.state === 'gameOver' || this.state === 'title') return;
      this.paused = !this.paused;
      this.sfx.play('pause');
    });
    this.input.on('mute', () => this.sfx.toggleMute());
    this.input.on('blur', () => { if (this.state !== 'title') this.paused = true; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state !== 'title') this.paused = true;
        this.saveRecord();
      }
    });
    this.input.on('action', () => {
      if (this.state === 'gameOver' || this.state === 'title') this.newGame();
      else if (this.state === 'trophy') this.endCelebration();
      else this.reverseRow();
    });
    this.input.on('start', () => {
      if (this.state === 'gameOver' || this.state === 'title') this.newGame();
      else if (this.state === 'trophy') this.endCelebration();
    });
    // Start do joystick: começa/continua nas telas e pausa durante a partida
    this.input.on('menu', () => {
      this.sfx.unlock?.();
      if (['gameOver', 'title', 'trophy'].includes(this.state)) this.input.emit('start');
      else this.input.emit('pause');
    });

    if (title || this.locked) this.showTitle();
    else this.newGame();
  }

  // Tela inicial: cenário vivo ao fundo (placas, neve, iglu aceso soltando fumaça)
  showTitle() {
    this.state = 'title';
    this.paused = false;
    this.level = 1;
    this.score = 0;
    this.lives = RULES.startLives;
    this.params = levelParams(1);
    this.rows = createRows(1);
    this.igloo.reset();
    this.igloo.style = 'igloo';
    this.particles.leaves = false;
    this.particles.stardust = false;
    this.particles.calm = false;
    this.particles.embers = false;
    this.particles.liquid = null;
    while (!this.igloo.complete) this.igloo.add();
    this.igloo.anim.fill(1);
    this.igloo.landed.fill(true);
    this.igloo.lit = true;
    this.igloo.curtain = 1;
    this.player = new Player(this);
    this.player.x = 300; // à esquerda da prateleira de troféus
    this.player.invuln = 0;
    this.critters.reset(this.params);
    this.critters.timers = this.critters.timers.map(() => Infinity);
    this.bear.reset(this.params);
    this.resetTemperature();
    this.rowsResetTimer = 0;
    this.smokeT = 0;
    this.banner = null;
    this.ranking = null;
    this.celebration = null;
    this.special = null;
    this.sleigh.reset();
    this.boats.reset();
    this.sfx.setMusic(null);
  }

  // Com backend, só quem tem conta aprovada pode jogar
  get locked() {
    return !!this.backend && this.account?.status !== 'approved';
  }

  // Chamado pela tela de conta (auth-ui.js) sempre que a sessão muda
  setAccount(session) {
    const before = this.account;
    this.account = session ? { ...session } : null;
    if (this.locked) {
      this.highScore = 0;
      this.trophies = [];
      // Saiu da conta (ou perdeu o acesso) no meio de uma partida: volta ao início
      if (this.state !== 'title') this.showTitle();
      return;
    }
    if (before?.uid !== session.uid) this.newRecord = false;
    this.highScore = Math.max(session.best || 0, before?.uid === session.uid ? this.highScore : 0);
    this.trophies = normTrophies(session.trophies, before?.uid === session.uid ? this.trophies : []);
  }

  // Gráficos 3D do jogo de verdade (modo só 3D): 'ok', 'loading' (fotos da fase 1
  // sendo tiradas) ou 'unavailable' (aparelho sem 3D). Fora desse modo, sempre 'ok'.
  graphicsStatus() {
    if (!this.renderer.only3d || !this.preload) return 'ok';
    if (this.preload.available?.() === false) return 'unavailable';
    return this.preload.ready(1) ? 'ok' : 'loading';
  }

  newGame() {
    if (this.locked) return;
    // Modo só 3D: a partida espera as fotos da fase 1 (começa sozinha quando ficam
    // prontas) e num aparelho sem 3D não começa
    const gfx = this.state === 'title' ? this.graphicsStatus() : 'ok';
    if (gfx !== 'ok') {
      this.startPending = gfx === 'loading';
      return;
    }
    this.startPending = false;
    this.ranking = null;
    this.score = 0;
    this.lives = RULES.startLives;
    this.level = 1;
    this.nextLife = RULES.extraLifeEvery;
    this.paused = false;
    this.newRecord = false;
    // A fumaça do iglu aceso da tela inicial não pode sobrar sobre o iglu vazio
    this.particles.fx = this.particles.fx.filter((f) => f.kind !== 'smoke');
    this.startLevel();
  }

  // Salva o recorde se a pontuação atual o superou: na conta (com backend) ou no
  // localStorage. Retorna a gravação em andamento (ou null).
  saveRecord() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.newRecord = true;
      if (!this.backend) saveHighScore(this.highScore);
    }
    const acc = this.account;
    if (this.backend && !this.locked && this.score > (acc.best || 0)) {
      acc.best = this.score;
      this.pendingSave = this.backend.submitScore(this.score, this.level).catch((e) => {
        console.warn('[gelinho] recorde não foi salvo:', e);
      });
    }
    return this.pendingSave;
  }

  // Troféu da fase especial concluída: só na primeira vez. Grava na conta (depois
  // do recorde, na mesma fila) ou no localStorage e prepara a comemoração.
  awardTrophy() {
    const lv = this.level;
    if (!this.special?.trophy || this.trophies.includes(lv)) return false;
    this.trophies = normTrophies(this.trophies, [lv]);
    if (!this.backend) saveTrophies(this.trophies);
    else if (!this.locked) {
      this.account.trophies = [...this.trophies];
      this.pendingSave = Promise.resolve(this.pendingSave)
        .then(() => this.backend.awardTrophy(lv))
        .catch((e) => console.warn('[gelinho] troféu não foi salvo:', e));
    }
    this.celebration = new Celebration(lv);
    return true;
  }

  // Fim da comemoração (tecla ou toque, depois de um instante): próxima fase
  endCelebration() {
    if (this.state !== 'trophy' || !this.celebration?.ready) return;
    if (!this.nextReady()) {
      this.advancePending = true; // continua sozinho quando as fotos ficarem prontas
      return;
    }
    this.celebration = null;
    this.level++;
    this.startLevel();
  }

  // Fotos 3D da próxima fase prontas (ou esperou demais, ou não há 3D)?
  nextReady() {
    const ok = !this.preload || this.waitNext >= PRELOAD_MAX || this.preload.ready(this.level + 1);
    this.loadingNext = !ok;
    return ok;
  }

  // Ranking do fim de jogo: espera o recorde ser gravado e busca os melhores
  async loadRanking(n = 10) {
    if (!this.backend || this.locked) return;
    const view = { loading: true };
    this.ranking = view;
    try {
      await this.pendingSave;
      const r = await this.backend.ranking(n);
      if (this.ranking === view) this.ranking = r;
    } catch (e) {
      console.warn('[gelinho] ranking indisponível:', e);
      if (this.ranking === view) this.ranking = { error: true };
    }
  }

  startLevel() {
    // Comemoração de um troféu que ficou aberta (ex.: partida nova no meio dela)
    // não pode reaparecer no fim da próxima fase
    this.celebration = null;
    this.params = levelParams(this.level);
    this.rows = createRows(this.level);
    this.igloo.reset();
    // Fases com cenário próprio: cabana/base no lugar do iglu; folhas ou poeira
    // estelar no lugar da neve
    const sp = this.params.special;
    this.igloo.style = sp?.house || 'igloo';
    this.particles.leaves = sp?.scenery === 'forest' || sp?.weather === 'leaves';
    this.particles.stardust = sp?.scenery === 'space';
    this.particles.calm = sp?.weather === 'none';
    this.particles.embers = sp?.weather === 'embers';
    this.particles.liquid = LAND_FX[sp?.scenery]?.liquid || null;
    this.player = new Player(this);
    this.critters.reset(this.params);
    this.bear.reset(this.params);
    this.resetTemperature();
    this.rowsResetTimer = 0;
    this.state = 'play';
    // Fase especial: tema, trilha de fundo e trenó
    this.special = this.params.special;
    this.sleigh.reset();
    this.boats.reset();
    this.sfx.setMusic(this.special?.music || null);
    // Aviso no início da fase (não bloqueia o jogo)
    this.banner = { ...levelIntro(this.level), t: 0, life: this.special ? 3.6 : 2.6 };
  }

  resetTemperature() {
    this.temp = RULES.tempStart;
    this.tempAcc = 0;
  }

  setScale(s) {
    this.scale = s;
  }

  start() {
    this.last = performance.now();
    this.acc = 0;
    requestAnimationFrame(this.frame);
  }

  frame = (now) => {
    const raw = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(raw, 0.25); // evita "saltos" após a aba ficar inativa
    if (raw > 0) this.fps += (1 / raw - this.fps) * 0.05;
    this.input.pollGamepads(); // também na pausa: o Start do joystick continua o jogo

    if (this.paused) this.sfx.setEngine(null);
    else {
      this.acc += dt;
      while (this.acc >= STEP) {
        this.update(STEP);
        this.acc -= STEP;
      }
    }

    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.renderer.draw(this);
    requestAnimationFrame(this.frame);
  };

  // Pegadas: andando na costa (de pé, no chão), uma marca a cada PRINTS.step px
  trackSteps() {
    const p = this.player;
    const walking = p.state === 'stand' && p.row === -1 && p.moving && p.y === SHORE_Y;
    if (!walking) {
      this.stepX = null;
      return;
    }
    if (this.stepX == null) {
      this.stepX = p.x;
      return;
    }
    if (Math.abs(p.x - this.stepX) >= PRINTS.step) {
      this.stepFoot = this.stepFoot ? 0 : 1;
      const dir = Math.sign(p.x - this.stepX) || p.facing || 1;
      this.particles.footprint(p.x - dir * 4, SHORE_Y, dir, this.stepFoot);
      this.stepX = p.x;
    }
  }

  // Peixes saltando: espirram água ao sair e ao voltar (mesmo salto do desenho)
  fishSplashes() {
    const sc = this.special?.scenery || 'ice';
    for (const c of this.critters.list) {
      if (c.dead || c.kicked || c.power || c.bonus) continue;
      const kind = c.kind === 'fish' ? (sc === 'beach' ? 'tfish' : sc === 'ice' || sc === 'forest' ? 'fish' : null) : c.kind;
      const w = FISH_HOP[kind];
      if (!w) continue;
      const up = Math.sin(this.time * w + c.ph) > 0;
      if (c.hopUp != null && up !== c.hopUp && c.x > -20 && c.x < W + 20) {
        this.particles.fishSplash(c.x, this.rows[c.row].y + 9, !up);
      }
      c.hopUp = up;
    }
  }

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 1.6);
    for (const row of this.rows) row.update(dt);
    this.particles.update(dt);
    this.igloo.update(dt);

    if (this.rowsResetTimer > 0) {
      this.rowsResetTimer -= dt;
      if (this.rowsResetTimer <= 0) for (const r of this.rows) r.active = false;
    }
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.life) this.banner = null;
    }

    // Motor do jet ski passando ao fundo da Praia (silêncio fora da partida)
    const playing = this.state !== 'title' && this.state !== 'gameOver' && this.state !== 'trophy';
    this.sfx.setEngine(playing && this.special?.boats ? engineSound(this.boats) : null);

    if (this.state === 'title' && this.startPending && this.graphicsStatus() === 'ok') {
      this.newGame();
      return;
    }
    if (this.state === 'title') {
      // Só o cenário vive: personagem respirando na costa e fumaça do iglu
      this.player.moving = false;
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.32;
        const v = this.igloo.ventPos;
        this.particles.smoke(v.x, v.y);
      }
      return;
    }
    if (this.state === 'gameOver') return;
    this.sfx.updateMusic(dt);
    if (this.state === 'trophy') {
      // Comemoração: o jogo espera a tecla; a fumaça do iglu continua saindo
      this.celebration.update(dt);
      if (this.advancePending) {
        this.waitNext += dt;
        if (this.nextReady()) {
          this.advancePending = false;
          this.endCelebration();
          return;
        }
      }
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.28;
        const v = this.igloo.ventPos;
        this.particles.smoke(v.x, v.y);
      }
      return;
    }
    if (this.special?.sleigh && this.sleigh.update(dt)) this.sfx.play('sleigh');
    if (this.special?.boats) this.boats.update(dt);
    this.player.update(dt, this.input);
    this.trackSteps();
    this.fishSplashes();
    if (this.state === 'play' || this.state === 'entering') {
      this.critters.update(dt);
      this.bear.update(dt);
    }

    if (this.state === 'play') {
      if (this.player.alive) {
        // Vapor da respiração quando está frio (o tema pode desligar: capacete, calor)
        this.breathT = (this.breathT || 0) - dt;
        const breathOn = this.special?.breath !== false;
        if (this.temp <= RULES.breathBelow && breathOn && this.player.state === 'stand' && this.breathT <= 0) {
          this.breathT = 1.3;
          const p = this.player;
          this.particles.breath(p.x + p.facing * 12, p.y - 52, p.facing);
        }
        this.tempAcc += dt;
        while (this.tempAcc >= RULES.tempTick && this.temp > 0) {
          this.tempAcc -= RULES.tempTick;
          this.temp--;
          if (this.temp > 0 && this.temp <= 10) this.sfx.play('cold');
        }
        if (this.temp <= 0) this.player.freeze();
      }
      const p = this.player;
      // Em frente à porta do iglu pronto, ↑ faz o personagem entrar
      if (this.atDoor && this.input.axisY() < 0) {
        p.enter(this.igloo.doorX);
        this.state = 'entering';
        this.sfx.play('door');
      }
    } else if (this.state === 'levelEnd') {
      // Fumaça saindo pelo topo do iglu: tem alguém aquecido lá dentro
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.28;
        const v = this.igloo.ventPos;
        this.particles.smoke(v.x, v.y);
      }
      this.bonusTimer -= dt;
      if (this.bonusTimer <= 0) {
        // Fase especial não tem bônus de temperatura (os prêmios já dão pontos e vidas)
        if (this.temp > 0 && this.scoresRows) {
          this.temp--;
          this.bonusTotal += this.params.degreePoints;
          this.addScore(this.params.degreePoints);
          this.bonusTimer = RULES.bonusTick;
          this.sfx.play('tick');
        } else if (!this.bonusDone) {
          this.bonusDone = true;
          this.bonusTimer = 1.6;
          this.sfx.play('fanfare');
          this.saveRecord();
          this.awardTrophy();
        } else if (this.celebration) {
          this.state = 'trophy';
          this.banner = null;
          this.sfx.play('trophy');
        } else if (!this.nextReady()) {
          // Ainda tirando as fotos 3D da próxima fase: segura o fim da fase
          this.bonusTimer = 0.1;
          this.waitNext += 0.1;
        } else {
          this.level++;
          this.startLevel();
        }
      }
    }
  }

  // Fase com o cenário da floresta (troncos, cabana, folhas)
  get forest() {
    return this.special?.scenery === 'forest';
  }

  // Fase com o cenário do espaço (asteroides, base lunar, poeira estelar)
  get space() {
    return this.special?.scenery === 'space';
  }

  // Fileiras acesas e bônus de temperatura dão pontos? Nas fases especiais, não:
  // lá só peixes (ou o que os substitui) e sacos de dinheiro valem pontos, porque
  // os prêmios já dão muitos pontos e vidas (pedido do usuário).
  get scoresRows() {
    return !this.special;
  }

  get landFx() {
    return LAND_FX[this.special?.scenery] || {};
  }

  // Jogador parado/andando na costa, em frente à porta do iglu completo
  get atDoor() {
    const p = this.player;
    return this.state === 'play' && this.igloo.complete && p.state === 'stand' && p.row === -1 &&
      Math.abs(p.x - this.igloo.doorX) <= IGLOO.doorZone;
  }

  addScore(n) {
    this.score += n;
    while (this.score >= this.nextLife) {
      this.lives++;
      this.nextLife += RULES.extraLifeEvery;
      this.particles.text(this.player.x, this.player.y - 100, '+1 VIDA', '#FFD36B');
      this.sfx.play('life');
    }
  }

  onJump() {
    this.sfx.play('jump');
  }

  // ------------------------------------------------------------ Eventos do jogador
  onLand(row) {
    this.sfx.play('land');
    const p = this.player;
    if (row < 0) {
      this.particles.puff(p.x, p.y, 6, this.landFx.puff || '#FFFFFF');
      return;
    }
    // A placa afunda um pouco e balança; lascas de gelo voam
    if (p.support) {
      p.support.dip = 1;
      // A placa afunda e empurra a água: onda em volta dela e gotinhas nas pontas
      const rr = this.rows[row];
      this.particles.landWave(rr.pieceX(p.support, p.x) + p.support.w / 2, rr.y + WAKE_LINE, p.support.w);
    }
    // Lascas de gelo (ou de casca de árvore nos troncos, de rocha nos asteroides)
    this.particles.chips(p.x, p.y, 7, this.landFx.chip);
    const r = this.rows[row];
    if (r.active) return;
    r.active = true;
    this.sfx.play('floe');
    // Brilhos subindo das placas visíveis da fileira que acendeu
    for (const q of r.rects()) {
      if (q.x > -q.w && q.x < W) this.particles.sparkle(q.x + q.w / 2, r.y - 4, 2, this.landFx.spark);
    }
    if (this.scoresRows) {
      this.addScore(this.params.floePoints);
      this.particles.text(this.player.x, this.player.y - 80, `+${this.params.floePoints}`);
    }
    this.igloo.add();
    if (this.rows.every((x) => x.active)) this.rowsResetTimer = 0.35;
  }

  reverseRow() {
    const p = this.player;
    if (this.paused || this.state !== 'play' || p.state !== 'stand' || p.row < 0) return;
    if (!this.igloo.remove()) return;
    this.rows[p.row].reverse();
    this.particles.text(p.x, p.y - 80, '⇄', '#BDEBFA');
    this.sfx.play('reverse');
  }

  onFish(c) {
    const pts = this.params.fishPoints;
    this.addScore(pts);
    const y = this.rows[c.row].y;
    this.particles.text(c.x, y - 60, `+${pts}`, '#FFC56B');
    this.particles.puff(c.x, y, 12, '#FFD58A');
    this.sfx.play('fish');
  }

  // Prêmio da fase especial: saco de dinheiro (pontos) ou coração (+1 vida)
  onBonus(c) {
    const y = this.rows[c.row].y;
    if (c.kind === 'heart') {
      this.lives++;
      this.particles.text(c.x, y - 70, '+1 VIDA', '#FF6B7E');
      this.particles.puff(c.x, y - 16, 14, '#FF8A98');
      this.sfx.play('life');
    } else {
      this.addScore(BONUS.bagPoints);
      this.particles.text(c.x, y - 70, `+${BONUS.bagPoints}`, '#FFD36B');
      this.particles.puff(c.x, y - 12, 16, '#FFE08A');
      this.sfx.play('coins');
    }
  }

  // Pegou a boia de patinho ou a chuteira dourada: poder por alguns segundos
  onPower(c) {
    const y = this.rows[c.row].y;
    this.player.givePower(c.kind);
    this.particles.text(c.x, y - 70, `${POWER_NAMES[c.kind]}! ${POWERS.duration} s`, '#FFE066');
    this.particles.puff(c.x, y - 12, 16, '#FFE98A');
    this.sfx.play('power');
  }

  // Bicho chutado (chuteira dourada): voa longe e vale pontos
  onKick(c) {
    const pts = Math.round(this.params.fishPoints * POWERS.kickShare);
    this.addScore(pts);
    const y = this.rows[c.row].y;
    this.particles.text(c.x, y - 60, `+${pts}`, '#FFE066');
    this.particles.puff(c.x, y - 14, 10, '#FFE98A');
    this.sfx.play('kick');
    this.shake = Math.max(this.shake, 0.15);
  }

  // Pegou o chocolate quente: esquenta 10° (sem passar da temperatura inicial)
  onHeat(c) {
    const y = this.rows[c.row].y;
    const before = this.temp;
    this.temp = Math.min(HEAT.max, this.temp + HEAT.degrees);
    this.particles.text(c.x, y - 70, `+${this.temp - before}°`, '#FFA25A');
    this.particles.puff(c.x, y - 14, 14, '#FFC9A0');
    this.sfx.play('heat');
  }

  // Urso chutado: é jogado para longe e fica tonto (não vale pontos)
  onBearKick() {
    this.particles.puff(this.bear.x, this.bear.y - 30, 12, '#FFE98A');
    this.sfx.play('kick');
    this.shake = Math.max(this.shake, 0.2);
  }

  onHit() {
    this.shake = 0.5;
  }

  onPlayerLost() {
    this.lives--;
    if (this.lives <= 0) {
      this.lives = 0;
      this.state = 'gameOver';
      this.banner = null;
      this.sfx.setMusic(null);
      this.saveRecord();
      this.loadRanking();
      this.sfx.play('gameover');
      return;
    }
    this.resetTemperature();
    this.player.respawn();
    if (this.bear.active) this.bear.avoid(this.player.x);
  }

  onEntered() {
    this.igloo.lit = true;
    this.igloo.shade = 0;
    this.particles.puff(this.igloo.doorX, this.player.y + 2, 8);
    this.smokeT = 0.3;
    this.state = 'levelEnd';
    this.preload?.request(this.level + 1);
    this.waitNext = 0;
    this.advancePending = false;
    this.bonusTotal = 0;
    this.bonusDone = false;
    this.bonusTimer = 0.6;
  }
}
