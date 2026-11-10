import { RULES, PLAYER } from './config.js';
import { specialFor } from './specials.js';

// Parâmetros por fase: velocidade, tipo de placa, inimigos, urso e pontuação.
//
// Curva de dificuldade (ajustada na etapa 5):
// - as placas aceleram ~9 px/s por fase até um teto que ainda dá para acompanhar;
// - inimigos e urso nunca ficam mais rápidos que o jogador andando (dá para fugir);
// - na fase 1 os grupos têm 1 bicho e surgem com folga; depois apertam aos poucos;
// - peixes aparecem um pouco mais no começo, para recompensar quem explora.
const ENEMY_CYCLE = ['goose', 'crab', 'clam'];
const ESCAPE_MARGIN = 0.8; // inimigos/urso no máximo a 80% da velocidade de caminhada

export function levelParams(level) {
  const L = level - 1;
  const maxChaser = PLAYER.walkSpeed * ESCAPE_MARGIN;
  // Ritmo próprio de uma fase especial (ex.: espaço a 80%): multiplica a velocidade
  // das placas, dos bichos e do urso. Sem `pace`, ritmo normal.
  const pace = specialFor(level)?.pace ?? 1;
  return {
    // Placas
    speed: Math.min(62 + L * 9, 170) * pace,
    fragmented: level % 2 === 0,          // fases pares: placas em pedaços que abrem e fecham
    breathSpeed: Math.min(1.1 + L * 0.06, 1.9),

    // Inimigos e peixes (fase especial pode trocar os bichos, sem mudar velocidade nem quantidade)
    enemy: ENEMY_CYCLE[L % ENEMY_CYCLE.length],
    enemies: specialFor(level)?.enemies || null,
    enemySpeed: Math.min(80 + L * 10, maxChaser) * pace,
    spawnMin: Math.max(1.8, 4.5 - L * 0.3),  // intervalo entre grupos, por fileira (s)
    spawnMax: Math.max(3.8, 9 - L * 0.5),
    maxGroup: Math.min(3, 1 + Math.floor(level / 2)),
    fishChance: level <= 2 ? 0.35 : 0.28,

    // Urso
    bear: level >= 4,
    bearSpeed: Math.min(85 + (level - 4) * 12, maxChaser) * pace,

    // Pontuação
    floePoints: 10 * level,
    degreePoints: 10 * level,
    fishPoints: 200,

    // Fase especial (a cada 5 fases, quando já há um tema criado), ou null
    special: specialFor(level),
  };
}

// Aviso mostrado no início de cada fase: o que há de novo.
export function levelIntro(level) {
  const special = specialFor(level);
  if (special) return { title: special.title, sub: special.intro, special: special.id };
  const title = `FASE ${level}`;
  let sub;
  if (level === 1) sub = 'Pule nas placas brancas para construir o iglu';
  else if (level === 4) sub = 'Cuidado: um urso apareceu na costa!';
  else if (level === RULES.auroraFrom) sub = 'Uma aurora boreal ilumina o céu';
  else if (level === 2) sub = 'Placas fragmentadas: cuidado com os vãos!';
  else if (levelParams(level).fragmented) sub = 'Placas fragmentadas e mais rápidas';
  else sub = 'As placas estão mais rápidas';
  return { title, sub };
}
