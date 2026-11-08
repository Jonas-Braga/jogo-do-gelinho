import { W, SHORE_Y, ROW_Y, PLAYER as P, PLAYER_HEIGHT } from './config.js';
import { SCARE_TIME } from './bear.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const rowY = (r) => (r < 0 ? SHORE_Y : ROW_Y[r]);

const FREEZE_TIME = 1.9;
const RESPAWN_GRACE = 1.5;

// Entrada no iglu (após ↑ em frente à porta): vira de costas, entra pela porta
// (se afastando: sobe um pouco e diminui pela perspectiva) e a cortina fecha.
export const ENTER = {
  turnTime: 0.22,   // vira de costas e se centraliza na porta
  inTime: 0.75,     // caminha porta adentro
  depth: 10,        // quanto "sobe" na tela ao se afastar (px)
  shrink: 0.12,     // redução de tamanho pela distância (perspectiva), sem transparência
  closeTime: 0.4,   // cortina de pele descendo
};

// Afundar: mergulho rápido e depois afunda acelerando até sumir por inteiro
export const SINK = {
  plungeTime: 0.18,
  plunge: 6,
  v0: 60,           // px/s ao começar a afundar
  accel: 220,       // px/s²
  reach: PLAYER_HEIGHT + 8,  // ponto mais alto do corpo (capuz/mãos erguidas) + folga
  linger: 0.3,      // bolhas depois de sumir, antes de perder a vida
};
const FLEE_SPEED = 330;
const FLEE_MAX_TIME = 8; // segurança: nunca fica preso fugindo

// row = -1 significa "na costa"; 0..3 são as fileiras de gelo.
// Estados: stand, jump, flee, drown, freeze, enter, gone.
export class Player {
  constructor(game) {
    this.game = game;
    this.respawn();
  }

  respawn() {
    this.state = 'stand';
    this.row = -1;
    this.x = W / 2 - 80;
    this.y = SHORE_Y;
    this.facing = 1;
    this.moving = false;
    this.t = 0;
    this.cooldown = 0;
    this.squash = 0;
    this.alpha = 1;
    this.scale = 1;
    this.sinkLine = null;
    this.support = null;
    this.invuln = RESPAWN_GRACE;
    this.crouch = 0;
    this.back = false;
    this.phase = null;
    this.submerged = false;
  }

  // Parte mais alta do corpo (incluindo mãos erguidas ao afundar) já está abaixo d'água?
  get fullySubmerged() {
    return this.state === 'drown' && this.y - SINK.reach > this.sinkLine;
  }

  get alive() {
    return this.state === 'stand' || this.state === 'jump';
  }

  get onShore() {
    return this.state === 'stand' && this.row === -1;
  }

  get fleeSpeed() {
    return FLEE_SPEED;
  }

  // Animação atual (usada pelo desenho e pelos testes)
  get anim() {
    switch (this.state) {
      case 'stand': return this.moving ? 'run' : 'idle';
      case 'jump': return 'jump';
      case 'drown': return 'drown';
      case 'freeze': return 'freeze';
      case 'enter': return 'enter';
      case 'flee': return this.moving ? 'flee' : 'scared';
      default: return 'none';
    }
  }

  // Acompanha o deslocamento da peça de gelo embaixo do jogador (inclui o
  // movimento da fileira e a abertura/fechamento das placas fragmentadas).
  carry() {
    if (this.row < 0 || !this.support) return;
    const nx = this.game.rows[this.row].pieceX(this.support);
    const d = nx - this.supportX;
    if (Math.abs(d) < 60) this.x = clamp(this.x + d, P.edge, W - P.edge); // ignora o "pulo" do wrap
    this.supportX = nx;
  }

  setSupport(rect) {
    this.support = rect ? rect.piece : null;
    this.supportX = rect ? rect.x : 0;
  }

  update(dt, input) {
    const rows = this.game.rows;
    const h = this.alive ? input.axisX() : 0;
    if (h) this.facing = h;
    this.squash = Math.max(0, this.squash - dt * 6);
    this.invuln = Math.max(0, this.invuln - dt);

    switch (this.state) {
      case 'stand': {
        this.moving = h !== 0;
        // Passos (som a cada passada)
        if (this.moving) {
          this.stepAcc = (this.stepAcc || 0) + dt;
          if (this.stepAcc >= 0.26) {
            this.stepAcc -= 0.26;
            this.game.sfx.play('step');
          }
        } else {
          this.stepAcc = 0.2; // o primeiro passo soa logo ao começar a andar
        }
        this.carry();
        this.x = clamp(this.x + h * P.walkSpeed * dt, P.edge, W - P.edge);
        if (this.row >= 0) {
          // A placa saiu de baixo (levada pela borda da tela, abriu, ou o jogador andou para fora).
          const r = rows[this.row].pieceAt(this.x);
          if (!r) {
            this.fall();
            return;
          }
          if (r.piece !== this.support) this.setSupport(r);
        }

        this.cooldown -= dt;
        const v = input.axisY();
        if (this.cooldown <= 0) {
          if (v < 0 && this.row >= 0) this.jump(this.row - 1);
          else if (v > 0 && this.row < ROW_Y.length - 1) this.jump(this.row + 1);
        }
        break;
      }
      case 'jump': {
        this.t += dt / P.jumpTime;
        this.moving = h !== 0;
        this.x = clamp(this.x + h * P.walkSpeed * P.airControl * dt, P.edge, W - P.edge);
        const k = Math.min(this.t, 1);
        const arc = this.to < this.from ? P.arcUp : P.arcDown;
        this.y = this.y0 + (this.y1 - this.y0) * k - arc * 4 * k * (1 - k);
        if (this.t >= 1) this.land();
        break;
      }
      case 'flee': {
        // Susto (pulinho com os braços para cima) e depois correria para fora da tela
        this.t += dt;
        if (this.t < SCARE_TIME) {
          this.moving = false;
          this.y = SHORE_Y - Math.sin((this.t / SCARE_TIME) * Math.PI) * 16;
        } else {
          this.y = SHORE_Y - Math.abs(Math.sin(this.t * 22)) * 3;
          this.moving = true;
          this.x += this.vx * dt;
        }
        const gone = this.x < -40 || this.x > W + 40;
        const bear = this.game.bear;
        if ((gone && (!bear.active || bear.offscreen)) || this.t > FLEE_MAX_TIME) this.die();
        break;
      }
      case 'drown': {
        // Sem transparência: mergulha e afunda acelerando até sumir por inteiro
        // abaixo da linha d'água (o desenho corta tudo que está abaixo dela).
        this.t += dt;
        if (this.t < SINK.plungeTime) {
          this.y = this.y0 + Math.sin((this.t / SINK.plungeTime) * Math.PI / 2) * SINK.plunge;
        } else {
          const s = this.t - SINK.plungeTime;
          this.y = this.y0 + SINK.plunge + SINK.v0 * s + 0.5 * SINK.accel * s * s;
        }
        // Bolhas subindo enquanto afunda
        this.bubbleT = (this.bubbleT || 0) - dt;
        if (this.t > 0.15 && this.bubbleT <= 0) {
          this.bubbleT = 0.11;
          // nascem abaixo da linha d'água e sobem até estourar na superfície
          this.game.particles.bubble(this.x, this.sinkLine + 6 + Math.random() * 12, this.sinkLine - 2);
        }
        if (!this.submerged && this.fullySubmerged) {
          // Sumiu de vez: último "glub" de bolhas e um anel na superfície
          this.submerged = true;
          this.submergedAt = this.t;
          for (let i = 0; i < 5; i++) {
            this.game.particles.bubble(this.x + (i - 2) * 5, this.sinkLine + 4 + i * 3, this.sinkLine - 2);
          }
          this.game.particles.ripples.push({ x: this.x, y: this.sinkLine + 2, t: 0 });
          this.game.sfx.play('glub');
        }
        if ((this.submerged && this.t - this.submergedAt >= SINK.linger) || this.t >= P.drownTime) this.die();
        break;
      }
      case 'freeze':
        this.t += dt;
        this.carry(); // congelado em cima de uma placa, continua sendo levado por ela
        if (this.t >= FREEZE_TIME) this.die();
        break;
      case 'enter': {
        // Sem transparência: vira de costas, entra pela porta e a cortina fecha.
        const igloo = this.game.igloo;
        this.t += dt;
        if (this.phase === 'turn') {
          const k = Math.min(1, this.t / ENTER.turnTime);
          this.x += (this.targetX - this.x) * Math.min(1, dt * 18); // centraliza na porta
          this.back = k > 0.45;   // no meio do giro passa a mostrar as costas
          this.squash = k < 0.5 ? 0.35 : 0;
          if (k >= 1) {
            this.x = this.targetX;
            this.phase = 'in';
            this.t = 0;
          }
        } else if (this.phase === 'in') {
          const k = Math.min(1, this.t / ENTER.inTime);
          this.moving = true;
          this.y = SHORE_Y - ENTER.depth * k;
          this.scale = 1 - ENTER.shrink * k;
          igloo.shade = k;
          if (k >= 1) {
            this.phase = 'close';
            this.t = 0;
            this.moving = false;
            this.game.sfx.play('curtain');
          }
        } else if (this.phase === 'close') {
          const k = Math.min(1, this.t / ENTER.closeTime);
          igloo.curtain = k;
          if (k >= 1) {
            this.state = 'gone';
            this.game.onEntered();
          }
        }
        break;
      }
      default:
        break;
    }
  }

  jump(to) {
    this.state = 'jump';
    this.from = this.row;
    this.to = to;
    this.t = 0;
    this.y0 = rowY(this.from);
    this.y1 = rowY(to);
    this.support = null;
    this.game.onJump?.();
  }

  land() {
    this.row = this.to;
    this.y = this.y1;
    if (this.row >= 0) {
      const r = this.game.rows[this.row].pieceAt(this.x);
      if (!r) {
        this.fall();
        return;
      }
      this.setSupport(r);
    }
    this.state = 'stand';
    this.squash = 1;
    this.cooldown = P.landDelay;
    this.game.onLand(this.row);
  }

  // Empurrado por um inimigo: desloca na direção dele.
  push(nx) {
    this.x = clamp(nx, P.edge, W - P.edge);
  }

  // Alcançado pelo urso: levanta os braços e foge assustado (dir = para longe do urso).
  flee(dir) {
    if (!this.alive || this.invuln > 0) return;
    this.state = 'flee';
    this.t = 0;
    this.vx = dir * FLEE_SPEED;
    this.facing = dir;
    this.squash = 0;
    this.game.sfx.play('growl');
    this.game.sfx.play('scared');
    this.game.onHit();
  }

  fall() {
    this.state = 'drown';
    this.t = 0;
    this.support = null;
    this.y0 = this.y;
    this.sinkLine = this.y + 4;
    this.submerged = false;
    this.bubbleT = 0;
    this.game.particles.splash(this.x, this.y + 6);
    this.game.sfx.play('splash');
    this.game.onHit();
  }

  freeze() {
    if (!this.alive) return;
    if (this.state === 'jump') {
      // Congela no meio do pulo: termina onde estava indo.
      this.row = this.to;
      this.y = this.y1;
      if (this.row >= 0) {
        const r = this.game.rows[this.row].pieceAt(this.x);
        if (!r) {
          this.fall();
          return;
        }
        this.setSupport(r);
      }
    }
    this.state = 'freeze';
    this.moving = false;
    this.t = 0;
    this.game.sfx.play('freeze');
    this.game.onHit();
  }

  enter(doorX) {
    this.state = 'enter';
    this.phase = 'turn';
    this.targetX = doorX;
    this.t = 0;
    this.moving = false;
  }

  // Passando pela porta: a moldura do arco e a cortina são desenhadas por cima
  get inDoorway() {
    return this.state === 'enter' && (this.phase === 'in' || this.phase === 'close');
  }

  die() {
    this.state = 'gone';
    this.game.onPlayerLost();
  }
}
