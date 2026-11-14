import { W, ROW_Y } from './config.js';
import { BONUS, BONUS_KINDS } from './bonus.js';
import { POWERS, POWER_KINDS } from './powers.js';

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
  bag: BONUS.size, heart: BONUS.size,
  duck: POWERS.size, boot: POWERS.size,
};
const SPACING = 52;
const PLAYER_HALF = 12;

const rand = (a, b) => a + Math.random() * (b - a);

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

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
    // Fase especial: prêmios (sacos de dinheiro e corações), sempre todos, um de
    // cada vez, em ordem sorteada
    this.bonusQueue = params.special ? shuffle([
      ...Array(BONUS.bags).fill('bag'), ...Array(BONUS.hearts).fill('heart'),
    ]) : [];
    this.bonusTimer = BONUS.first;
    // Poderes (fases normais a partir da 6): cada item passa uma única vez na
    // fase, em hora sorteada; com dois, em ordem sorteada e nunca juntos
    this.powerQueue = shuffle([...(params.powers || [])]);
    this.powerTimer = rand(POWERS.firstMin, POWERS.firstMax);
  }

  // A entrada da fileira está livre? (nenhum bicho perto da borda por onde o prêmio
  // entra, nem esperando fora da tela para entrar). Os bichos da fileira podem
  // estar mais adiante: o prêmio vai na mesma velocidade deles e não os alcança.
  entryClear(row) {
    const dir = -this.game.rows[row].dir;
    return this.list.every((c) => c.row !== row || (dir > 0 ? c.x > BONUS.clearance : c.x < W - BONUS.clearance));
  }

  // Solta o próximo prêmio numa fileira com a entrada livre, contra o fluxo das placas
  spawnBonus() {
    return this.spawnItem(this.bonusQueue, { bonus: true });
  }

  // Solta o próximo item de poder (boia ou chuteira), do mesmo jeito dos prêmios
  spawnPower() {
    return this.spawnItem(this.powerQueue, { power: true });
  }

  spawnItem(queue, flags) {
    const free = ROW_Y.map((_, i) => i).filter((r) => this.entryClear(r));
    if (!free.length) return false;
    const row = free[Math.floor(Math.random() * free.length)];
    const kind = queue.shift();
    const dir = -this.game.rows[row].dir;
    const speed = this.params.enemySpeed * BONUS.speed;
    this.list.push({ kind, row, dir, vx: dir * speed, x: dir > 0 ? -40 : W + 40, w: SIZE[kind], ph: Math.random() * 6, ...flags });
    return true;
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
    if (this.bonusQueue.length) {
      this.bonusTimer -= dt;
      if (this.bonusTimer <= 0) {
        this.bonusTimer = this.spawnBonus() ? rand(BONUS.gapMin, BONUS.gapMax) : 0.5;
      }
    }
    if (this.powerQueue?.length) {
      this.powerTimer -= dt;
      if (this.powerTimer <= 0) {
        this.powerTimer = this.spawnPower() ? rand(POWERS.gapMin, POWERS.gapMax) : 0.5;
      }
    }
    for (const c of this.list) {
      if (c.kicked) {
        // Chutado: voa girando para longe e cai na água lá adiante
        c.x += c.vx * dt;
        c.fly += c.vy * dt;
        c.vy += POWERS.kickGravity * dt;
        c.spin += dt * 16 * Math.sign(c.vx);
        c.ph += dt;
        if (c.fly >= 0) {
          c.dead = true;
          if (c.x > 0 && c.x < W) game.particles.splash(c.x, game.rows[c.row].y + 6);
        }
        continue;
      }
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
      if (c.row !== pl.row || c.dead || c.kicked) continue;
      const half = c.w / 2 + PLAYER_HALF;
      const dx = pl.x - c.x;
      if (Math.abs(dx) >= half) continue;
      if (c.kind === 'fish') {
        c.dead = true;
        game.onFish(c);
      } else if (BONUS_KINDS.includes(c.kind)) {
        c.dead = true;
        game.onBonus(c);
      } else if (POWER_KINDS.includes(c.kind)) {
        c.dead = true;
        game.onPower(c);
      } else if (pl.power === 'boot') {
        // Com a chuteira: imune, e quem encosta leva um chute e voa longe
        const away = Math.sign(-dx) || pl.facing;
        c.kicked = true;
        c.vx = away * POWERS.kickVx;
        c.vy = POWERS.kickVy;
        c.fly = -0.01;
        c.spin = 0;
        pl.kick(away);
        game.onKick(c);
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
