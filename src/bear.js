import { W, SHORE_Y } from './config.js';
import { POWERS } from './powers.js';

const EDGE = 70;
const HIT = 44;
const CHASE_RANGE = 300;
export const BEAR_OFFSCREEN = 120; // o urso some quando o centro passa disto além da borda
export const SCARE_TIME = 0.4;      // susto antes da correria
const CHASE_FACTOR = 0.88;          // urso um pouco mais lento que o jogador fugindo

// Urso que patrulha a costa a partir da fase 4. Se alcançar o jogador, ele foge
// assustado e o urso corre atrás até os dois saírem da tela.
export class Bear {
  constructor(game) {
    this.game = game;
    this.active = false;
  }

  reset(params) {
    this.active = params.bear;
    this.speed = params.bearSpeed;
    this.x = 90;
    this.y = SHORE_Y - 2;
    this.dir = 1;
    this.walk = 0;
    this.chasing = false;
    this.chaseT = 0;
    this.stun = 0;
    this.kvx = 0;
  }

  get offscreen() {
    return this.x < -BEAR_OFFSCREEN || this.x > W + BEAR_OFFSCREEN;
  }

  // Ao renascer, o urso volta para o lado oposto ao jogador.
  avoid(px) {
    this.chasing = false;
    this.stun = 0;
    this.x = px < W / 2 ? W - 90 : 90;
    this.dir = px < W / 2 ? -1 : 1;
  }

  update(dt) {
    if (!this.active) return;
    const pl = this.game.player;

    if (this.chasing) {
      this.chaseT += dt;
      if (this.chaseT < SCARE_TIME) return; // ruge parado enquanto o jogador se assusta
      const v = pl.fleeSpeed * CHASE_FACTOR;
      this.x += this.dir * v * dt;
      this.walk += dt * v * 0.06;
      return;
    }

    if (this.stun > 0) {
      // Levou um chute: escorrega para longe e fica tonto, sem perseguir ninguém
      this.stun -= dt;
      this.x = Math.max(EDGE, Math.min(W - EDGE, this.x + this.kvx * dt));
      this.kvx *= Math.max(0, 1 - dt * 3);
      return;
    }

    let speed = this.speed;
    if (pl.alive && pl.row === -1 && Math.abs(pl.x - this.x) < CHASE_RANGE) {
      // Persegue o jogador na costa
      this.dir = Math.sign(pl.x - this.x) || this.dir;
      speed *= 1.25;
    }
    this.x += this.dir * speed * dt;
    this.walk += dt * speed * 0.06;
    if (this.x < EDGE) { this.x = EDGE; this.dir = 1; }
    if (this.x > W - EDGE) { this.x = W - EDGE; this.dir = -1; }

    if (pl.onShore && pl.invuln <= 0 && Math.abs(pl.x - this.x) < HIT) {
      const dir = Math.sign(pl.x - this.x) || this.dir; // jogador foge para longe do urso
      if (pl.power === 'boot') {
        // Com a chuteira o jogador é imune: o urso é jogado para longe e fica tonto
        this.stun = POWERS.bearStun;
        this.kvx = -dir * POWERS.bearKnock;
        pl.kick(-dir);
        this.game.onBearKick();
        return;
      }
      this.dir = dir;
      this.chasing = true;
      this.chaseT = 0;
      pl.flee(dir);
    }
  }
}
