// Ganchos do visual 3D usados por mais de um desenho 2D (sem importar o 3D aqui).
// doorArt.draw(ctx, estilo, parte, igloo, t): portas e cortinas 3D (src/model3d.js).
// parte = 'inside' (interior escuro/aceso), 'leaf' (a folha com igloo.curtain) ou
// 'frame' (batente). Devolve true se desenhou (o 2D é pulado).
export const doorArt = { draw: null };

// Luzes e efeitos de luz do modo só 3D (brilhos, lâmpadas, luz vazando pelas frestas,
// fios do pisca-pisca, anéis na água, facho, cauda de cometa, neblina): em vez de pintar
// em 2D, o desenho registra o efeito aqui com a posição já levada para a tela (o
// contexto pode estar transladado, girado e em perspectiva) e o renderizador desenha
// todos numa passada das partículas 3D (src/m3d/particles3d.js, `lightItems`).
// Desligado (on = false), cada função devolve false e o desenho 2D segue como sempre.
export const lightArt = { on: false, items: [], base: null };

// Ponto do contexto atual → tela lógica (s = escala, rot = giro do contexto)
function toScreen(ctx, x, y) {
  const m = typeof ctx?.getTransform === 'function' ? ctx.getTransform() : null;
  const b = lightArt.base;
  if (!m || typeof m.a !== 'number' || !b || !b.a) return { x, y, s: 1, rot: 0 };
  const X = m.a * x + m.c * y + m.e;
  const Y = m.b * x + m.d * y + m.f;
  return { x: (X - b.e) / b.a, y: (Y - b.f) / b.d, s: Math.hypot(m.a, m.b) / b.a, rot: Math.atan2(m.b, m.a) };
}

// Registra um efeito (kind: glow, bulb, beam, cord, ring, fog, cone). Pontos: (x, y) ou
// (x0, y0)/(x1, y1); medidas (r, rx, ry, w, w0, w1) em unidades do contexto.
export function addLight(ctx, kind, o) {
  if (!lightArt.on) return false;
  const it = { kind, color: o.color, a: o.a ?? 1, on: o.on, taper: o.taper || 0 };
  if (o.x0 != null) {
    const p0 = toScreen(ctx, o.x0, o.y0);
    const p1 = toScreen(ctx, o.x1, o.y1);
    Object.assign(it, { x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y, w: (o.w || 1) * p0.s, w0: (o.w0 || 0) * p0.s, w1: (o.w1 || 0) * p0.s });
  } else {
    const p = toScreen(ctx, o.x, o.y);
    Object.assign(it, { x: p.x, y: p.y, r: (o.r || 0) * p.s, rx: (o.rx || 0) * p.s, ry: (o.ry || 0) * p.s, rot: p.rot });
  }
  lightArt.items.push(it);
  return true;
}
