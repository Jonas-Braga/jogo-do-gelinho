// Telas de conta em HTML, por cima do canvas: entrar, criar conta, esqueci a senha,
// aguardando aprovação e acesso recusado. Formulários de verdade (não desenhados no
// canvas) para funcionar com gerenciador de senhas, teclado do celular e colar.
//
// Com a conta aprovada, o painel some e fica só a barra da conta na tela inicial
// (apelido · Admin · Sair).
import { errorMessage, NICK_MIN, NICK_MAX, PASSWORD_MIN } from './backend.js';

const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
};

const field = (label, attrs) =>
  h('label', { class: 'field' }, h('span', {}, label), h('input', attrs));

export class AuthUI {
  constructor(game, backend, root = document.body) {
    this.game = game;
    this.backend = backend;
    this.session = undefined;
    this.view = 'loading';
    this.busy = false;
    this.notice = null; // { kind: 'error'|'ok', text }
    this.email = '';

    this.overlay = h('div', { class: 'auth', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Conta' });
    this.card = h('div', { class: 'auth-card' });
    this.overlay.append(this.card);
    this.bar = h('div', { class: 'account-bar', hidden: true });
    root.append(this.overlay, this.bar);

    this.render();
    backend.onChange((s) => this.onSession(s));

    // A barra da conta só aparece na tela inicial
    const tick = () => {
      this.bar.hidden = !(this.session?.status === 'approved' && this.game.state === 'title');
      if (this.overlay.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  onSession(s) {
    this.session = s;
    this.game.setAccount(s);
    if (this.busy) return; // a ação em andamento decide a próxima tela
    if (!s) {
      if (!['login', 'signup', 'reset'].includes(this.view)) this.view = 'login';
    } else {
      this.view = s.status; // pending | approved | rejected | incomplete | error
    }
    this.render();
    this.renderBar();
  }

  go(view, notice = null) {
    this.view = view;
    this.notice = notice;
    this.render();
  }

  // Executa uma ação do formulário mostrando "aguarde" e o erro em português
  async run(action, after) {
    if (this.busy) return;
    this.busy = true;
    this.notice = null;
    this.render();
    try {
      await action();
      this.busy = false;
      if (after) after();
      else this.onSession(this.session);
    } catch (e) {
      this.busy = false;
      if (!['auth/invalid-credential', 'auth/wrong-password'].includes(e?.code)) console.warn('[gelinho]', e);
      this.notice = { kind: 'error', text: errorMessage(e) };
      // Cadastro criou a conta mas o apelido falhou: segue para "escolher apelido"
      if (this.session?.status === 'incomplete') this.view = 'incomplete';
      this.render();
    }
  }

  render() {
    const visible = this.view !== 'approved';
    this.overlay.hidden = !visible;
    if (!visible) return;
    const card = this.card;
    // Redesenhar a mesma tela (erro, "aguarde") não apaga o que já foi digitado
    const typed = this.rendered === this.view
      ? Object.fromEntries([...card.querySelectorAll('input[name]')].map((i) => [i.name, i.value]))
      : {};
    this.rendered = this.view;
    card.replaceChildren(...this.body());
    for (const i of card.querySelectorAll('input[name]')) if (typed[i.name] != null) i.value = typed[i.name];
    if (this.notice) {
      card.append(h('p', { class: `auth-notice ${this.notice.kind}`, role: 'alert' }, this.notice.text));
    }
    if (this.busy) card.classList.add('busy');
    else card.classList.remove('busy');
    // No computador já deixa o cursor no primeiro campo; no celular não abre o teclado sozinho
    if (globalThis.matchMedia?.('(pointer: fine)').matches) {
      card.querySelector('input:not([type=hidden])')?.focus({ preventScroll: true });
    }
  }

  form(submitLabel, fields, onSubmit) {
    const f = h('form', {
      class: 'auth-form',
      novalidate: true,
      on: {
        submit: (e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(f));
          if (data.email) this.email = data.email;
          onSubmit(data);
        },
      },
    }, ...fields, h('button', { type: 'submit', class: 'btn primary', disabled: this.busy }, this.busy ? 'Aguarde…' : submitLabel));
    return f;
  }

  link(text, fn) {
    return h('button', { type: 'button', class: 'link', on: { click: fn } }, text);
  }

  signOutButton() {
    return h('button', {
      type: 'button',
      class: 'btn',
      on: { click: () => this.run(() => this.backend.signOut(), () => this.go('login')) },
    }, 'Sair');
  }

  body() {
    const b = this.backend;
    const email = { type: 'email', name: 'email', autocomplete: 'email', required: true, value: this.email, inputmode: 'email' };
    switch (this.view) {
      case 'loading':
        return [h('p', { class: 'auth-text' }, 'Carregando…')];

      case 'login':
        return [
          h('h2', {}, 'Entrar'),
          this.form('Entrar', [
            field('E-mail', email),
            field('Senha', { type: 'password', name: 'password', autocomplete: 'current-password', required: true }),
          ], (d) => this.run(() => b.signIn(d.email, d.password))),
          h('div', { class: 'auth-links' },
            this.link('Criar conta', () => this.go('signup')),
            this.link('Esqueci a senha', () => this.go('reset'))),
        ];

      case 'signup':
        return [
          h('h2', {}, 'Criar conta'),
          h('p', { class: 'auth-text small' }, 'O jogo é só para convidados: depois do cadastro, o administrador precisa liberar o seu acesso.'),
          this.form('Criar conta', [
            field('E-mail (para recuperar a senha; ninguém mais vê)', email),
            field(`Apelido (aparece no ranking; ${NICK_MIN} a ${NICK_MAX} caracteres)`, {
              type: 'text', name: 'nickname', autocomplete: 'nickname', required: true,
              minlength: NICK_MIN, maxlength: NICK_MAX, autocapitalize: 'off', spellcheck: 'false',
            }),
            field(`Senha (mínimo ${PASSWORD_MIN} caracteres)`, {
              type: 'password', name: 'password', autocomplete: 'new-password', required: true, minlength: PASSWORD_MIN,
            }),
            field('Confirme a senha', { type: 'password', name: 'confirm', autocomplete: 'new-password', required: true }),
          ], (d) => {
            if (d.password !== d.confirm) {
              this.notice = { kind: 'error', text: 'As senhas não são iguais.' };
              this.render();
              return;
            }
            this.run(() => b.signUp(d));
          }),
          h('div', { class: 'auth-links' }, this.link('Já tenho conta', () => this.go('login'))),
        ];

      case 'reset':
        return [
          h('h2', {}, 'Esqueci a senha'),
          h('p', { class: 'auth-text small' }, 'Vamos mandar um link para você criar uma senha nova.'),
          this.form('Enviar e-mail', [field('E-mail', email)], (d) =>
            this.run(() => b.resetPassword(d.email), () => this.go('login', {
              kind: 'ok',
              text: 'Se houver uma conta com esse e-mail, o link chega em alguns minutos. Veja também a caixa de spam.',
            }))),
          h('div', { class: 'auth-links' }, this.link('Voltar', () => this.go('login'))),
        ];

      case 'incomplete':
        return [
          h('h2', {}, 'Escolha seu apelido'),
          h('p', { class: 'auth-text small' }, 'Falta só o apelido que vai aparecer no ranking.'),
          this.form('Concluir cadastro', [
            field(`Apelido (${NICK_MIN} a ${NICK_MAX} caracteres)`, {
              type: 'text', name: 'nickname', autocomplete: 'nickname', required: true,
              minlength: NICK_MIN, maxlength: NICK_MAX, autocapitalize: 'off', spellcheck: 'false',
            }),
          ], (d) => this.run(() => b.completeProfile(d.nickname))),
          h('div', { class: 'auth-links' }, this.signOutButton()),
        ];

      case 'pending':
        return [
          h('h2', {}, 'Aguardando aprovação'),
          h('p', { class: 'auth-text' }, `Olá, ${this.session.nickname}! Seu cadastro foi recebido.`),
          h('p', { class: 'auth-text small' }, 'Assim que o administrador liberar o seu acesso, o jogo abre sozinho nesta tela.'),
          h('div', { class: 'auth-links' }, this.signOutButton()),
        ];

      case 'rejected':
        return [
          h('h2', {}, 'Acesso não autorizado'),
          h('p', { class: 'auth-text' }, 'Esta conta não tem permissão para jogar. Fale com quem te convidou.'),
          h('div', { class: 'auth-links' }, this.signOutButton()),
        ];

      default: // 'error'
        return [
          h('h2', {}, 'Sem conexão'),
          h('p', { class: 'auth-text' }, 'Não foi possível carregar sua conta. Verifique a internet e recarregue a página.'),
          h('div', { class: 'auth-links' }, this.signOutButton()),
        ];
    }
  }

  async renderBar() {
    const s = this.session;
    this.bar.replaceChildren();
    if (s?.status !== 'approved') return;
    this.bar.append(h('span', { class: 'who' }, s.nickname));
    if (s.isAdmin) {
      const admin = h('a', { href: 'admin.html', class: 'btn small' }, 'Admin');
      this.bar.append(admin);
      try {
        const n = await this.backend.pendingCount();
        if (n > 0) admin.append(h('span', { class: 'badge', title: `${n} aguardando aprovação` }, String(n)));
      } catch {
        /* sem contagem */
      }
    }
    this.bar.append(h('button', {
      type: 'button',
      class: 'btn small',
      on: { click: () => this.run(() => this.backend.signOut(), () => this.go('login')) },
    }, 'Sair'));
  }
}
