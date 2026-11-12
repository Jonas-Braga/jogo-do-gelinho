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
//   scenery  cenário inteiro trocado: 'forest' = mata, rio, troncos e folhas caindo;
//            'space' = lua, céu estrelado, rio de poeira estelar, asteroides e
//            estrelinhas douradas no lugar dos peixes; 'beach' = praia, mar
//            turquesa, pranchas de surfe e peixinhos tropicais; 'halloween' =
//            noite de lua cheia, cemitério, rio escuro, abóboras e balas
//   house    o que se constrói na costa: 'igloo' (padrão), 'cabin' (cabana de madeira)
//            'base' (base lunar), 'hut' (cabana de palha) ou 'haunted' (casa assombrada)
//   enemies  inimigos sorteados a cada grupo (no lugar do ciclo ganso/caranguejo/molusco)
//   aurora   false desliga a aurora boreal nesta fase
//   breath   false desliga o vapor da respiração no frio
//   weather  'none' = nada caindo do céu (sem neve, folhas ou poeira);
//            'leaves' = folhas secas caindo no lugar da neve
//   pace     ritmo próprio da fase (ex.: 0.8 = placas, bichos e urso a 80% da velocidade)
//   trophy   troféu ganho ao concluir a fase pela primeira vez: { name, ribbon }
//            (o emblema desenhado na taça fica em src/trophies.js, pelo `id`).
//            Ao criar uma fase especial nova, inclua o nível dela na lista de
//            troféus válidos de firestore.rules (validTrophies) e publique as regras.
export const SPECIAL_EVERY = 5;

export const SPECIALS = {
  5: {
    id: 'natal',
    trophy: { name: 'Troféu do Natal', ribbon: '#C8323A' },
    title: 'FASE 5 · ESPECIAL DE NATAL',
    intro: 'Noite de Natal sob a aurora boreal. Feliz Natal!',
    music: 'natal',
    outfits: { player: 'sweater', bear: 'santaHat' },
    sleigh: true,
    decor: 'natal',
    pace: 0.8, // fases especiais mais lentas, para apreciar o cenário (pedido do usuário)
  },
  10: {
    id: 'floresta',
    trophy: { name: 'Troféu da Floresta', ribbon: '#2F7D3A' },
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
    pace: 0.8,
  },
  15: {
    id: 'espaco',
    trophy: { name: 'Troféu do Espaço', ribbon: '#5B3FA8' },
    title: 'FASE 15 · ESPECIAL DO ESPAÇO',
    intro: 'Pule nos asteroides do rio de poeira estelar e monte a base lunar!',
    music: 'espaco',
    outfits: { player: 'astronaut', bear: 'alien' },
    sleigh: false,
    decor: 'espaco',
    scenery: 'space',
    house: 'base',
    enemies: ['ufo', 'crawler', 'comet'],
    aurora: false,
    breath: false, // respira dentro do capacete
    pace: 0.8,
  },
  20: {
    id: 'praia',
    trophy: { name: 'Troféu da Praia', ribbon: '#14A0A8' },
    title: 'FASE 20 · ESPECIAL DA PRAIA',
    intro: 'Pule nas pranchas de surfe e construa a cabana de palha!',
    music: 'praia',
    outfits: { player: 'surfer', bear: 'giantCrab' },
    sleigh: false,
    decor: 'praia',
    scenery: 'beach',
    house: 'hut',
    enemies: ['gull', 'siri', 'jellyfish'],
    aurora: false,
    breath: false, // calor: sem vapor da respiração
    weather: 'none', // nada caindo do céu
    pace: 0.8,
  },
  25: {
    id: 'halloween',
    trophy: { name: 'Troféu do Halloween', ribbon: '#F07A1A' },
    title: 'FASE 25 · ESPECIAL DE HALLOWEEN',
    intro: 'Pule nas abóboras do rio escuro e monte a casa assombrada!',
    music: 'halloween',
    outfits: { player: 'wizard', bear: 'werewolf' },
    sleigh: false,
    decor: 'halloween',
    scenery: 'halloween',
    house: 'haunted',
    enemies: ['ghost', 'spider', 'eyeball'],
    aurora: false,
    weather: 'leaves', // folhas secas caindo
    pace: 0.8,
  },
};

export function specialFor(level) {
  if (level % SPECIAL_EVERY !== 0) return null;
  return SPECIALS[level] || null;
}

// ---------------------------------------------------------------- Troféus
// Níveis que dão troféu (um por fase especial), em ordem
export const TROPHY_LEVELS = Object.keys(SPECIALS).map(Number).filter((l) => SPECIALS[l].trophy).sort((a, b) => a - b);

// Troféu da fase (com o id e o nível) ou null
export function trophyFor(level) {
  const sp = SPECIALS[level];
  return sp?.trophy ? { ...sp.trophy, id: sp.id, level: Number(level) } : null;
}

// Lista de troféus limpa: só níveis válidos, sem repetição, em ordem
export function normTrophies(...lists) {
  const all = lists.flatMap((l) => (Array.isArray(l) ? l : [])).map(Number);
  return [...new Set(all)].filter((l) => TROPHY_LEVELS.includes(l)).sort((a, b) => a - b);
}
