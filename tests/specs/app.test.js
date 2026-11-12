// App instalável (PWA): o jogo pode ser instalado na tela inicial do celular
// (Chrome e Edge do Android). Confere o manifesto, os ícones, o service worker e
// as ligações no index.html.
import { suite, test, expect } from '../harness.js';
import { isNode } from '../env.js';
import { InstallButton, shouldShowInstall, runningAsApp } from '../../src/install.js';

// Janela falsa do navegador: tipo de tela, modo de exibição e o aviso de instalação
function fakeWindow({ coarse = true, display = 'browser', prompt = null } = {}) {
  const listeners = {};
  const body = { children: [], append(el) { this.children.push(el); } };
  const win = {
    __installPrompt: prompt,
    navigator: {},
    document: {
      body,
      createElement: () => {
        const el = { hidden: false, handlers: {} };
        el.addEventListener = (t, fn) => { el.handlers[t] = fn; };
        el.click = () => el.handlers.click?.();
        return el;
      },
    },
    matchMedia: (q) => ({
      matches: (q === '(pointer: coarse)' && coarse) || q === `(display-mode: ${display})`,
    }),
    addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
    emit: (t) => (listeners[t] || []).forEach((fn) => fn()),
    setInterval: () => 0,
  };
  return win;
}

function fakePrompt(outcome = 'accepted') {
  const ev = { prompted: 0 };
  ev.prompt = async () => { ev.prompted++; };
  ev.userChoice = Promise.resolve({ outcome });
  return ev;
}

// Lê um arquivo do projeto (Node: disco; navegador: servidor)
async function readText(path) {
  if (isNode) {
    const fs = await import('node:fs');
    return fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  }
  return (await fetch(`../${path}`, { cache: 'no-store' })).text();
}

async function readBytes(path) {
  if (isNode) {
    const fs = await import('node:fs');
    return new Uint8Array(fs.readFileSync(new URL(`../../${path}`, import.meta.url)));
  }
  return new Uint8Array(await (await fetch(`../${path}`, { cache: 'no-store' })).arrayBuffer());
}

// Largura e altura de um PNG (cabeçalho IHDR)
function pngSize(b) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((v, i) => b[i] === v)) return null;
  const u32 = (o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  return { w: u32(16), h: u32(20) };
}

suite('App instalável (PWA)', () => {
  test('manifesto com nome, tela cheia deitada, cores e endereço relativo (funciona no GitHub Pages)', async () => {
    const m = JSON.parse(await readText('manifest.json'));
    expect(m.name).toBe('Jogo do Gelinho');
    expect(m.short_name.length).toBeLessThanOrEqual(12);
    expect(m.start_url).toBe('./');
    expect(m.scope).toBe('./');
    expect(['fullscreen', 'standalone']).toContain(m.display);
    expect(m.orientation).toBe('landscape');
    expect(/^#[0-9A-Fa-f]{6}$/.test(m.background_color)).toBe(true);
    expect(/^#[0-9A-Fa-f]{6}$/.test(m.theme_color)).toBe(true);
    expect(m.prefer_related_applications ?? false).toBe(false);
  });

  test('ícones de 192 e 512 px (e um "maskable" para o recorte do Android) existem e têm o tamanho certo', async () => {
    const m = JSON.parse(await readText('manifest.json'));
    const sizes = new Set();
    let maskable = false;
    for (const ic of m.icons) {
      const [w, h] = ic.sizes.split('x').map(Number);
      const real = pngSize(await readBytes(ic.src));
      expect(real, ic.src).toEqual({ w, h });
      expect(ic.type).toBe('image/png');
      sizes.add(ic.sizes);
      if (ic.purpose === 'maskable') maskable = true;
    }
    expect(sizes.has('192x192')).toBe(true);
    expect(sizes.has('512x512')).toBe(true);
    expect(maskable).toBe(true);
    expect(pngSize(await readBytes('icons/apple-touch-icon.png'))).toEqual({ w: 180, h: 180 });
  });

  test('index.html liga o manifesto, os ícones e a cor da barra', async () => {
    const html = await readText('index.html');
    expect(html).toContain('<link rel="manifest" href="manifest.json">');
    expect(html).toContain('name="theme-color"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('href="icons/icon-192.png"');
  });

  test('o jogo registra o service worker', async () => {
    const main = await readText('src/main.js');
    expect(main).toContain("navigator.serviceWorker.register('sw.js')");
  });

  test('regra do botão "Instalar como app": só no celular, na tela inicial, fora do app e quando o navegador oferece', () => {
    const ok = { prompt: {}, standalone: false, coarse: true, state: 'title' };
    expect(shouldShowInstall(ok)).toBe(true);
    expect(shouldShowInstall({ ...ok, prompt: null }), 'navegador não oferece').toBe(false);
    expect(shouldShowInstall({ ...ok, standalone: true }), 'já aberto como app').toBe(false);
    expect(shouldShowInstall({ ...ok, coarse: false }), 'computador').toBe(false);
    for (const state of ['play', 'entering', 'levelEnd', 'trophy', 'gameOver']) {
      expect(shouldShowInstall({ ...ok, state }), state).toBe(false);
    }
  });

  test('aberto como app (tela cheia ou standalone) é detectado', () => {
    expect(runningAsApp(fakeWindow({ display: 'fullscreen' }))).toBe(true);
    expect(runningAsApp(fakeWindow({ display: 'standalone' }))).toBe(true);
    expect(runningAsApp(fakeWindow({ display: 'browser' }))).toBe(false);
    const ios = fakeWindow();
    ios.navigator.standalone = true;
    expect(runningAsApp(ios)).toBe(true);
  });

  test('botão aparece no rodapé da tela inicial do celular e some ao começar a partida', () => {
    const game = { state: 'title' };
    const win = fakeWindow({ prompt: fakePrompt() });
    const b = new InstallButton(game, win);
    expect(win.document.body.children).toContain(b.el);
    expect(b.el.className).toBe('install-app');
    expect(b.el.textContent).toBe('📲 Instalar como app');
    expect(b.visible).toBe(true);
    game.state = 'play';
    b.refresh();
    expect(b.visible).toBe(false);
  });

  test('botão não aparece no app instalado, no computador nem sem o aviso do navegador', () => {
    for (const opts of [{ display: 'fullscreen' }, { display: 'standalone' }, { coarse: false }, { prompt: null }]) {
      const win = fakeWindow({ prompt: fakePrompt(), ...opts });
      const b = new InstallButton({ state: 'title' }, win);
      expect(b.visible, JSON.stringify(opts)).toBe(false);
    }
  });

  test('o aviso do navegador chegando depois faz o botão aparecer', () => {
    const win = fakeWindow();
    const b = new InstallButton({ state: 'title' }, win);
    expect(b.visible).toBe(false);
    win.__installPrompt = fakePrompt();
    win.emit('gelinho-install');
    expect(b.visible).toBe(true);
  });

  test('tocar no botão abre a instalação; instalado, o botão não volta', async () => {
    const ev = fakePrompt('accepted');
    const win = fakeWindow({ prompt: ev });
    const b = new InstallButton({ state: 'title' }, win);
    b.el.click();
    await ev.userChoice;
    await Promise.resolve();
    expect(ev.prompted).toBe(1);
    expect(b.visible).toBe(false);
    win.__installPrompt = fakePrompt();
    b.refresh();
    expect(b.visible, 'já instalou').toBe(false);
  });

  test('se o usuário cancelar, o botão some até o navegador oferecer de novo', async () => {
    const ev = fakePrompt('dismissed');
    const win = fakeWindow({ prompt: ev });
    const b = new InstallButton({ state: 'title' }, win);
    await b.install();
    expect(b.visible).toBe(false);
    win.__installPrompt = fakePrompt();
    win.emit('gelinho-install');
    expect(b.visible).toBe(true);
  });

  test('instalado por outro caminho (menu do navegador), o botão some', () => {
    const win = fakeWindow({ prompt: fakePrompt() });
    const b = new InstallButton({ state: 'title' }, win);
    win.emit('appinstalled');
    expect(b.visible).toBe(false);
  });

  test('index.html guarda o aviso de instalação logo no início; o jogo cria o botão', async () => {
    const html = await readText('index.html');
    expect(html).toContain("addEventListener('beforeinstallprompt'");
    expect(html).toContain('e.preventDefault()');
    expect(html.indexOf('beforeinstallprompt')).toBeLessThan(html.indexOf('src/main.js'));
    const main = await readText('src/main.js');
    expect(main).toContain('new InstallButton(game)');
  });

  test('o service worker não guarda cache (tudo vem da rede) e só cuida do próprio site', async () => {
    const sw = await readText('sw.js');
    expect(sw).toContain("addEventListener('fetch'");
    expect(sw).toContain('fetch(req)');
    expect(sw.includes('caches.'), 'sem Cache Storage').toBe(false);
    expect(sw).toContain('self.location.origin');
    expect(sw).toContain('Sem conexão');
  });
});
