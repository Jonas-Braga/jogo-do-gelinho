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

// Profundidade 2.5D (src/depth.js). Só muda o desenho, nunca a simulação.
export const DEPTH = {
  vanishX: W / 2,      // ponto de fuga horizontal
  farScale: 0.82,      // escala na costa (a fileira da frente fica em 1)
  tilt: [0.84, 1.14],  // altura das placas na fileira do fundo e na da frente
  volume: true,        // luz, sombra própria e luz de borda nos personagens
  bokeh: true,         // flocos desfocados na frente da câmera
  shadowSkew: 0.6,     // quanto a sombra de quem está no ar escorrega para longe do sol
  // Direção em que a luz viaja (do alto à esquerda para baixo à direita) e cores
  light: {
    x: 0.72, y: 0.69,
    warm: 'rgba(255, 236, 205, 0.26)',
    shade: 'rgba(8, 22, 52, 0.40)',
    rim: 'rgba(255, 246, 226, 1)',
    core: 'rgba(6, 16, 40, 1)',
  },
  // Relevo "renderizado": a silhueta desfocada vira um mapa de altura e cada pixel
  // é aceso (difusa + brilho especular) ou sombreado pela inclinação em relação à luz
  relief: {
    blur: [4, 12, 28], // raios do arredondamento: detalhes e corpo (unidades do mundo)
    shift: 5,          // distância usada para medir a inclinação (unidades do mundo)
    gain: 3,           // contraste do relevo
    light: 0.55,       // força da luz difusa no lado virado para a luz
    spec: 0.45,        // força do brilho especular
    shade: 0.6,        // força da sombra no lado oposto
    res: 1 / 3,        // resolução dos mapas de luz (são suaves: 1/3 basta)
    every: 3,          // refaz os mapas de cada personagem a cada N quadros
    minFps: 50,        // abaixo disso por 2 s, só o relevo é desligado (aparelho fraco)
  },
  // Câmera que acompanha o jogador de leve: o fundo anda menos que a frente (parallax)
  sway: { amount: 0.03, far: 0.25, shore: 0.45, fore: 1.6, ease: 3 },
  foreground: true,    // faixa desfocada de primeiro plano na beira de baixo
  minFps: 40,          // abaixo disso (por alguns segundos) o volume é desligado sozinho
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
