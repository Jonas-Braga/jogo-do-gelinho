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
};

export function specialFor(level) {
  if (level % SPECIAL_EVERY !== 0) return null;
  return SPECIALS[level] || null;
}
