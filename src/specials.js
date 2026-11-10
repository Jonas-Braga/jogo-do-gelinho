// Fases especiais: a cada SPECIAL_EVERY fases, uma fase temática.
// Cada tema é criado um de cada vez; múltiplos de 5 ainda sem tema são fases normais.
//
// Campos de um tema:
//   id       identificador (usado pelo desenho e pelos testes)
//   title    título do aviso de início de fase
//   intro    subtítulo do aviso de início de fase
//   music    trilha de fundo (chave de MUSIC em audio.js)
//   outfits  roupas: { player, bear }
//   sleigh   trenó voando ao fundo de vez em quando
//   decor    enfeites do cenário (árvores, luzes no iglu)
//   scenery  cenário inteiro trocado: 'forest' = mata, rio, troncos e folhas caindo
//   house    o que se constrói na costa: 'igloo' (padrão) ou 'cabin' (cabana de madeira)
//   enemies  inimigos sorteados a cada grupo (no lugar do ciclo ganso/caranguejo/molusco)
//   aurora   false desliga a aurora boreal nesta fase
export const SPECIAL_EVERY = 5;

export const SPECIALS = {
  5: {
    id: 'natal',
    title: 'FASE 5 · ESPECIAL DE NATAL',
    intro: 'Noite de Natal sob a aurora boreal. Feliz Natal!',
    music: 'natal',
    outfits: { player: 'sweater', bear: 'santaHat' },
    sleigh: true,
    decor: 'natal',
  },
  10: {
    id: 'floresta',
    title: 'FASE 10 · ESPECIAL DA FLORESTA',
    intro: 'Pule nos troncos do rio e construa a cabana de madeira!',
    music: 'floresta',
    outfits: { player: 'lumberjack', bear: 'brown' },
    sleigh: false,
    decor: 'floresta',
    scenery: 'forest',
    house: 'cabin',
    enemies: ['snake', 'bat', 'piranha'],
    aurora: false,
  },
};

export function specialFor(level) {
  if (level % SPECIAL_EVERY !== 0) return null;
  return SPECIALS[level] || null;
}
