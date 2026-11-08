import { STEP, RULES, W, IGLOO } from './config.js';
import { Input } from './input.js';
import { createRows } from './floes.js';
import { Player } from './player.js';
import { Particles } from './particles.js';
import { Igloo } from './igloo.js';
import { Renderer } from './renderer.js';
import { Critters } from './enemies.js';
import { Bear } from './bear.js';
import { Sfx } from './audio.js';
import { levelParams, levelIntro } from './levels.js';
import { loadHighScore, saveHighScore } from './storage.js';

// Estados: title (tela inicial), play (jogando, incluindo animações de morte),
// entering (entrando no iglu), levelEnd (contagem do bônus), gameOver.
export class Game {
  // `title: true` começa na tela inicial (o jogo de verdade); sem a opção, começa
  // direto numa partida (usado pelos testes).
  constructor(canvas, { title = false } = {}) {
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.input = new Input();
    this.sfx = new Sfx();
    this.particles = new Particles();
    this.igloo = new Igloo(this.particles, this.sfx);
    this.critters = new Critters(this);
    this.bear = new Bear(this);
    this.renderer = new Renderer(this.ctx);
    this.time = 0;
    this.paused = false;
    this.fps = 60;
    this.shake = 0;
    this.highScore = loadHighScore();
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
      else this.reverseRow();
    });
    this.input.on('start', () => {
      if (this.state === 'gameOver' || this.state === 'title') this.newGame();
    });

    if (title) this.showTitle();
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
    while (!this.igloo.complete) this.igloo.add();
    this.igloo.anim.fill(1);
    this.igloo.landed.fill(true);
    this.igloo.lit = true;
    this.igloo.curtain = 1;
    this.player = new Player(this);
    this.player.x = 420;
    this.player.invuln = 0;
    this.critters.reset(this.params);
    this.critters.timers = this.critters.timers.map(() => Infinity);
    this.bear.reset(this.params);
    this.resetTemperature();
    this.rowsResetTimer = 0;
    this.smokeT = 0;
    this.banner = null;
  }

  newGame() {
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

  // Salva o recorde se a pontuação atual o superou
  saveRecord() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.newRecord = true;
      saveHighScore(this.highScore);
    }
  }

  startLevel() {
    this.params = levelParams(this.level);
    this.rows = createRows(this.level);
    this.igloo.reset();
    this.player = new Player(this);
    this.critters.reset(this.params);
    this.bear.reset(this.params);
    this.resetTemperature();
    this.rowsResetTimer = 0;
    this.state = 'play';
    // Aviso no início da fase (não bloqueia o jogo)
    this.banner = { ...levelIntro(this.level), t: 0, life: 2.6 };
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

    if (!this.paused) {
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
    this.player.update(dt, this.input);
    if (this.state === 'play' || this.state === 'entering') {
      this.critters.update(dt);
      this.bear.update(dt);
    }

    if (this.state === 'play') {
      if (this.player.alive) {
        // Vapor da respiração quando está frio
        this.breathT = (this.breathT || 0) - dt;
        if (this.temp <= RULES.breathBelow && this.player.state === 'stand' && this.breathT <= 0) {
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
        if (this.temp > 0) {
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
        } else {
          this.level++;
          this.startLevel();
        }
      }
    }
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
      this.particles.puff(p.x, p.y, 6);
      return;
    }
    // A placa afunda um pouco e balança; lascas de gelo voam
    if (p.support) p.support.dip = 1;
    this.particles.chips(p.x, p.y);
    const r = this.rows[row];
    if (r.active) return;
    r.active = true;
    this.sfx.play('floe');
    // Brilhos subindo das placas visíveis da fileira que acendeu
    for (const q of r.rects()) {
      if (q.x > -q.w && q.x < W) this.particles.sparkle(q.x + q.w / 2, r.y - 4, 2);
    }
    this.addScore(this.params.floePoints);
    this.particles.text(this.player.x, this.player.y - 80, `+${this.params.floePoints}`);
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

  onHit() {
    this.shake = 0.5;
  }

  onPlayerLost() {
    this.lives--;
    if (this.lives <= 0) {
      this.lives = 0;
      this.state = 'gameOver';
      this.banner = null;
      this.saveRecord();
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
    this.bonusTotal = 0;
    this.bonusDone = false;
    this.bonusTimer = 0.6;
  }
}
