// Ganchos do visual 3D usados por mais de um desenho 2D (sem importar o 3D aqui).
// doorArt.draw(ctx, estilo, parte, igloo, t): portas e cortinas 3D (src/model3d.js).
// parte = 'inside' (interior escuro/aceso), 'leaf' (a folha com igloo.curtain) ou
// 'frame' (batente). Devolve true se desenhou (o 2D é pulado).
export const doorArt = { draw: null };
