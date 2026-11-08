// Constantes globais do jogo. Resolução lógica fixa; o canvas é escalado em main.js.
export const W = 1280;
export const H = 720;

// Passo fixo da simulação (s). O loop acumula delta time e roda N passos.
export const STEP = 1 / 120;

// Layout vertical (coordenadas dos pés do personagem).
export const SHORE_Y = 250;        // linha onde o jogador fica na costa
export const SHORE_TOP = 190;      // início da faixa de neve
export const WATER_TOP = 272;      // superfície da água
export const ROW_Y = [360, 450, 540, 630];

// Placas de gelo
export const BLOCK_W = 82;
export const BLOCK_GAP = 6;
export const TRACK = 1600;         // comprimento do "trilho" circular de cada fileira
export const MARGIN = 160;         // quanto o trilho se estende além de cada borda da tela
export const LANDING_TOLERANCE = 8;

export const PLAYER = {
  walkSpeed: 250,
  airControl: 0.75,
  jumpTime: 0.42,
  arcUp: 55,
  arcDown: 38,
  edge: 26,
  landDelay: 0.06,
  drownTime: 1.4,
};

export const RULES = {
  startLives: 3,
  tempStart: 45,
  tempTick: 1.0,          // segundos por grau perdido
  extraLifeEvery: 5000,
  iglooPieces: 16,        // 15 blocos + porta
  bonusTick: 0.045,       // velocidade da contagem do bônus
  breathBelow: 20,        // abaixo desta temperatura aparece o vapor da respiração
  auroraFrom: 5,          // aurora boreal a partir desta fase
};

// Iglu na costa (centro da base da cúpula). A porta fica na frente, no centro:
// um pórtico de neve em arco com a abertura voltada para o jogador.
export const IGLOO = {
  x: 1080, baseY: SHORE_Y - 6, rx: 100, ry: 92,
  porchRx: 44, porchRy: 82,  // arco externo do pórtico
  doorRx: 25, doorH: 68,     // abertura: comporta o personagem entrando (de costas, se afastando)
  doorZone: 28,              // distância da porta em que ↑ faz entrar
};

// Altura do personagem em pé (pés até o topo do capuz)
export const PLAYER_HEIGHT = 74;
export const CROUCH_SCALE = 0.78; // altura relativa quando agachado

export const PALETTE = {
  skyTop: '#2A9CC0',
  skyHorizon: '#9ED6E6',
  mountain: '#D6ECF2',
  mountainShade: '#A9CFDB',
  snow: '#F2F4EE',
  snowShade: '#DDE6E4',
  snowEdge: '#A9C3C6',
  waterTop: '#1A7894',
  waterMid: '#0E5670',
  waterDeep: '#06324A',
  ice: '#F2F4EE',
  iceSide: '#BFD6DB',
  iceShadow: 'rgba(2, 30, 48, 0.35)',
  iceActive: '#8FDCF5',
  iceGlow: '#4FC3F7',
  parka: '#D9A441',
  parkaShade: '#A87828',
  fur: '#F4EFE2',
  furShade: '#CFC6B0',
  skin: '#E3AA80',
  boots: '#5E4129',
  pants: '#3B2B1E',
  ink: '#1D2A33',
  splash: '#CFEFFA',
};
