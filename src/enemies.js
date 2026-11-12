import { W, ROW_Y } from './config.js';

// Largura de colisão de cada tipo. Os bichos das fases especiais têm o tamanho dos
// que substituem (morcego, disco voador e gaivota = ganso; cobra, bichinho lunar e
// siri = caranguejo; piranha, cometa e água-viva = molusco; fantasma = ganso,
// aranha = caranguejo, olho = molusco).
export const SIZE = {
  goose: 44, crab: 40, clam: 34, fish: 30,
  bat: 44, snake: 40, piranha: 34,
  ufo: 44, crawler: 40, comet: 34,
  gull: 44, siri: 40, jellyfish: 34,
  ghost: 44, spider: 40, eyeball: 34,
};
const SPACING = 52;
const PLAYER_HALF = 12;

const rand = (a, b) => a + Math.random() * (b - a);

// Bichos que atravessam as fileiras: inimigos empurram o jogador, peixes dão pontos.
export class Critters {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.timers = [];
  }

  reset(params) {
    this.params = params;
    this.list = [];
    // Atraso inicial escalonado para as fileiras não começarem todas juntas
    this.timers = ROW_Y.map((_, i) => rand(1.5, 3.5) + i * 1.2);
  }

  rowBusy(row) {
    return this.list.some((c) => c.row === row);
  }

  spawn(row) {
    const p = this.params;
    const fish = Math.random() < p.fishChance;
    const kind = fish ? 'fish' : p.enemies ? p.enemies[Math.floor(Math.random() * p.enemies.length)] : p.enemy;
    const n = fish ? 1 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * p.maxGroup);
    // Todos os bichos (inimigos e peixes) vêm contra o fluxo das placas.
    const dir = -this.game.rows[row].dir;
    const speed = p.enemySpeed * rand(0.85, 1.15) * (fish ? 0.8 : 1);
    for (let i = 0; i < n; i++) {
      this.list.push({
        kind,
        row,
        dir,
        vx: dir * speed,
        x: dir > 0 ? -40 - i * SPACING : W + 40 + i * SPACING,
        w: SIZE[kind],
        ph: Math.random() * Math.PI * 2,
      });
    }
  }

  update(dt) {
    const game = this.game;
    for (let r = 0; r < this.timers.length; r++) {
      this.timers[r] -= dt;
      if (this.timers[r] <= 0) {
        if (!this.rowBusy(r)) this.spawn(r);
        this.timers[r] = rand(this.params.spawnMin, this.params.spawnMax);
      }
    }
    for (const c of this.list) {
      // Se a fileira foi invertida, os bichos dela também viram.
      const want = -game.rows[c.row].dir;
      if (c.dir !== want) {
        c.dir = want;
        c.vx = want * Math.abs(c.vx);
      }
      c.x += c.vx * dt;
      c.ph += dt;
    }
    // Remove quem já saiu da tela (dos dois lados, pois inimigos podem virar)
    this.list = this.list.filter((c) => !c.dead && c.x < W + 220 + SPACING * 3 && c.x > -220 - SPACING * 3);

    // Interação com o jogador (só quando está de pé numa placa)
    const pl = game.player;
    if (pl.state !== 'stand' || pl.row < 0) return;
    for (const c of this.list) {
      if (c.row !== pl.row || c.dead) continue;
      const half = c.w / 2 + PLAYER_HALF;
      const dx = pl.x - c.x;
      if (Math.abs(dx) >= half) continue;
      if (c.kind === 'fish') {
        c.dead = true;
        game.onFish(c);
      } else if (Math.sign(dx || c.dir) === c.dir) {
        // Jogador está à frente do bicho: é empurrado junto com ele.
        pl.push(c.x + c.dir * half);
        if (!c.bumped) {
          c.bumped = true;
          game.sfx.play('bump', { kind: c.kind });
        }
      }
    }
  }

  inRow(row) {
    return this.list.filter((c) => c.row === row);
  }
}
