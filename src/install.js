// Botão "Instalar como app" no rodapé da tela inicial (celular, Chrome/Edge).
//
// O navegador avisa que o site pode ser instalado com o evento
// `beforeinstallprompt`, capturado logo no início pelo index.html (antes do jogo
// carregar) em `window.__installPrompt`. O botão chama `prompt()`, que abre a
// janela oficial de instalação. Não aparece:
// - quando o jogo já está aberto como app (tela cheia/standalone);
// - quando o navegador não oferece instalação (já instalado, iPhone, Firefox...);
// - no computador (mouse) e fora da tela inicial (não cobre os controles).

// Regra de quando o botão aparece (separada para os testes)
export function shouldShowInstall({ prompt, standalone, coarse, state }) {
  return !!prompt && !standalone && coarse && state === 'title';
}

// Aberto como app instalado?
export function runningAsApp(win = globalThis) {
  const mm = (q) => !!win.matchMedia?.(q).matches;
  return mm('(display-mode: fullscreen)') || mm('(display-mode: standalone)') || win.navigator?.standalone === true;
}

export class InstallButton {
  constructor(game, win = window) {
    this.game = game;
    this.win = win;
    this.installed = false;
    const b = win.document.createElement('button');
    b.type = 'button';
    b.className = 'install-app';
    b.hidden = true;
    b.textContent = '📲 Instalar como app';
    b.addEventListener('click', () => this.install());
    win.document.body.append(b);
    this.el = b;
    win.addEventListener('appinstalled', () => {
      this.installed = true;
      win.__installPrompt = null;
      this.refresh();
    });
    win.addEventListener('gelinho-install', () => this.refresh());
    this.timer = win.setInterval(() => this.refresh(), 300);
    this.refresh();
  }

  get visible() {
    return !this.el.hidden;
  }

  refresh() {
    const show = !this.installed && shouldShowInstall({
      prompt: this.win.__installPrompt,
      standalone: runningAsApp(this.win),
      coarse: !!this.win.matchMedia?.('(pointer: coarse)').matches,
      state: this.game.state,
    });
    this.el.hidden = !show;
  }

  async install() {
    const ev = this.win.__installPrompt;
    if (!ev) return;
    // O aviso do navegador só pode ser usado uma vez
    this.win.__installPrompt = null;
    this.refresh();
    try {
      await ev.prompt();
      const choice = await ev.userChoice;
      if (choice?.outcome === 'accepted') this.installed = true;
    } catch (e) {
      console.warn('[gelinho] instalação:', e);
    }
    this.refresh();
  }
}
