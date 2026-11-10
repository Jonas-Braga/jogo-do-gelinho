// Contas, aprovação e ranking.
//
// O jogo só conversa com esta interface (todas as funções são assíncronas):
//   onChange(cb)                      cb(sessão | null) sempre que a conta muda
//   signUp({ email, nickname, password })
//   signIn(email, password) · signOut() · resetPassword(email)
//   completeProfile(nickname)         conta criada sem perfil (cadastro interrompido)
//   submitScore(score, level)         grava o recorde se for maior → recorde atual
//   ranking(n)                        { top: [{ uid, nickname, best, level, rank }], me }
//   admin: listUsers() · setStatus(uid, status) · resetScore(uid) · pendingCount()
//
// Sessão: { uid, email, nickname, status: 'pending'|'approved'|'rejected'|'incomplete',
//           best, isAdmin }
//
// Duas implementações: FirebaseBackend (src/firebase-backend.js, o jogo de verdade) e
// MemoryBackend (abaixo: testes e `?backend=memoria` para testar a interface sem rede).
// As duas seguem as mesmas regras de firestore.rules.

export const NICK_MIN = 3;
export const NICK_MAX = 16;
export const PASSWORD_MIN = 6; // mínimo do Firebase Auth
export const STATUSES = ['pending', 'approved', 'rejected'];

const NICK_RE = /^[\p{L}\p{N}_.-]+$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AccountError extends Error {
  constructor(code, message) {
    super(message || MESSAGES[code] || 'Algo deu errado. Tente de novo.');
    this.code = code;
  }
}

// Mensagens em português para os erros (os do Firebase têm o mesmo código)
const MESSAGES = {
  'nick/short': `O apelido precisa ter pelo menos ${NICK_MIN} caracteres.`,
  'nick/long': `O apelido pode ter no máximo ${NICK_MAX} caracteres.`,
  'nick/chars': 'Use só letras, números, ponto, hífen ou sublinhado no apelido (sem espaços).',
  'nick/taken': 'Esse apelido já está em uso. Escolha outro.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/missing-email': 'Informe o e-mail.',
  'auth/weak-password': `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`,
  'auth/missing-password': 'Informe a senha.',
  'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Use "Entrar" ou "Esqueci a senha".',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
  'auth/too-many-requests': 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  'auth/network-request-failed': 'Sem conexão com o servidor. Verifique a internet.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'score/not-approved': 'Sua conta ainda não foi aprovada.',
  'admin/forbidden': 'Só o administrador pode fazer isso.',
  'permission-denied': 'Sem permissão para essa operação.',
  'unavailable': 'Servidor indisponível no momento. Tente de novo.',
};

export function errorMessage(err) {
  const code = err?.code;
  return MESSAGES[code] || (err instanceof AccountError ? err.message : 'Algo deu errado. Tente de novo.');
}

// Chave única do apelido (sem diferença entre maiúsculas e minúsculas)
export const nickKey = (nick) => String(nick).trim().toLowerCase();

// Retorna o código do erro ou null se o apelido é válido
export function nicknameProblem(nick) {
  const n = String(nick ?? '').trim();
  if (n.length < NICK_MIN) return 'nick/short';
  if (n.length > NICK_MAX) return 'nick/long';
  if (!NICK_RE.test(n)) return 'nick/chars';
  return null;
}

export function checkSignUp({ email, nickname, password }) {
  if (!email) throw new AccountError('auth/missing-email');
  if (!EMAIL_RE.test(String(email).trim())) throw new AccountError('auth/invalid-email');
  const p = nicknameProblem(nickname);
  if (p) throw new AccountError(p);
  if (!password) throw new AccountError('auth/missing-password');
  if (String(password).length < PASSWORD_MIN) throw new AccountError('auth/weak-password');
}

// Posição no ranking: empates dividem a mesma posição (1º, 2º, 2º, 4º…)
export function withRanks(entries) {
  let prev = null;
  let rank = 0;
  return entries.map((e, i) => {
    if (e.best !== prev) rank = i + 1;
    prev = e.best;
    return { ...e, rank };
  });
}

// ------------------------------------------------------------------ Em memória
export class MemoryBackend {
  constructor({ admins = [] } = {}) {
    this.accounts = new Map(); // email → { uid, password }
    this.users = new Map();    // uid → { nickname, email, status, createdAt }
    this.nicknames = new Map(); // chave → uid
    this.scores = new Map();   // uid → { nickname, best, level }
    this.admins = new Set(admins);
    this.uid = null;
    this.listeners = [];
    this.resets = [];          // e-mails que pediram nova senha
    this.seq = 0;
  }

  // Cria uma conta já num status (atalho para testes e para a demonstração)
  seed({ email, nickname, password = 'senha123', status = 'approved', best = 0, admin = false }) {
    const uid = `u${++this.seq}`;
    this.accounts.set(email, { uid, password });
    this.users.set(uid, { nickname, email, status, createdAt: this.seq });
    this.nicknames.set(nickKey(nickname), uid);
    if (best > 0) this.scores.set(uid, { nickname, best, level: 1 });
    if (admin) this.admins.add(uid);
    return uid;
  }

  session() {
    if (!this.uid) return null;
    const u = this.users.get(this.uid);
    const email = [...this.accounts].find(([, a]) => a.uid === this.uid)?.[0];
    if (!u) return { uid: this.uid, email, nickname: null, status: 'incomplete', best: 0, isAdmin: this.admins.has(this.uid) };
    return {
      uid: this.uid,
      email: u.email,
      nickname: u.nickname,
      status: u.status,
      best: this.scores.get(this.uid)?.best || 0,
      isAdmin: this.admins.has(this.uid),
    };
  }

  emit() {
    const s = this.session();
    for (const cb of this.listeners) cb(s);
  }

  onChange(cb) {
    this.listeners.push(cb);
    cb(this.session());
    return () => (this.listeners = this.listeners.filter((f) => f !== cb));
  }

  async signUp({ email, nickname, password }) {
    checkSignUp({ email, nickname, password });
    email = String(email).trim().toLowerCase();
    if (this.nicknames.has(nickKey(nickname))) throw new AccountError('nick/taken');
    if (this.accounts.has(email)) throw new AccountError('auth/email-already-in-use');
    const uid = `u${++this.seq}`;
    this.accounts.set(email, { uid, password });
    this.uid = uid;
    await this.completeProfile(nickname);
  }

  async completeProfile(nickname) {
    if (!this.uid) throw new AccountError('permission-denied');
    const p = nicknameProblem(nickname);
    if (p) throw new AccountError(p);
    const key = nickKey(nickname);
    if (this.nicknames.has(key)) throw new AccountError('nick/taken');
    const email = [...this.accounts].find(([, a]) => a.uid === this.uid)[0];
    this.nicknames.set(key, this.uid);
    this.users.set(this.uid, { nickname: String(nickname).trim(), email, status: 'pending', createdAt: ++this.seq });
    this.emit();
  }

  async signIn(email, password) {
    const a = this.accounts.get(String(email ?? '').trim().toLowerCase());
    if (!a || a.password !== password) throw new AccountError('auth/invalid-credential');
    this.uid = a.uid;
    this.emit();
  }

  async signOut() {
    this.uid = null;
    this.emit();
  }

  async resetPassword(email) {
    if (!EMAIL_RE.test(String(email ?? '').trim())) throw new AccountError('auth/invalid-email');
    // Como o Firebase, não revela se o e-mail existe
    this.resets.push(String(email).trim().toLowerCase());
  }

  approved() {
    return this.uid && this.users.get(this.uid)?.status === 'approved';
  }

  async submitScore(score, level) {
    if (!this.approved()) throw new AccountError('score/not-approved');
    const cur = this.scores.get(this.uid);
    if (cur && cur.best >= score) return cur.best;
    const nickname = this.users.get(this.uid).nickname;
    this.scores.set(this.uid, { nickname, best: Math.floor(score), level });
    return Math.floor(score);
  }

  async ranking(n = 10) {
    if (!this.approved() && !this.admins.has(this.uid)) throw new AccountError('score/not-approved');
    const all = withRanks(
      [...this.scores]
        .filter(([, s]) => s.best > 0)
        .map(([uid, s]) => ({ uid, nickname: s.nickname, best: s.best, level: s.level }))
        .sort((a, b) => b.best - a.best),
    );
    const mine = all.find((e) => e.uid === this.uid) || null;
    return { top: all.slice(0, n), me: mine };
  }

  // ---- administração
  requireAdmin() {
    if (!this.admins.has(this.uid)) throw new AccountError('admin/forbidden');
  }

  async listUsers() {
    this.requireAdmin();
    return [...this.users]
      .map(([uid, u]) => ({ uid, ...u, best: this.scores.get(uid)?.best || 0 }))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async setStatus(uid, status) {
    this.requireAdmin();
    if (!STATUSES.includes(status)) throw new AccountError('permission-denied');
    const u = this.users.get(uid);
    if (!u) throw new AccountError('permission-denied');
    u.status = status;
    // Quem perde o acesso sai do ranking
    if (status !== 'approved') this.scores.delete(uid);
    if (uid === this.uid) this.emit();
  }

  async resetScore(uid) {
    this.requireAdmin();
    const s = this.scores.get(uid);
    if (s) s.best = 0;
  }

  async pendingCount() {
    this.requireAdmin();
    return [...this.users.values()].filter((u) => u.status === 'pending').length;
  }
}

// Escolhe o backend do jogo: Firebase, ou memória com `?backend=memoria` na URL
// (para testar as telas de conta sem rede; nada é salvo).
export async function createBackend(search = globalThis.location?.search || '') {
  if (new URLSearchParams(search).get('backend') === 'memoria') {
    const b = new MemoryBackend();
    // Contas de demonstração (senha de todas: senha123)
    b.seed({ email: 'admin@teste.com', nickname: 'Admin', admin: true, best: 4200 });
    b.seed({ email: 'pinguim@teste.com', nickname: 'Pinguim', best: 3100 });
    b.seed({ email: 'foca@teste.com', nickname: 'Foca', best: 1800 });
    b.seed({ email: 'novo@teste.com', nickname: 'Novato', status: 'pending' });
    return b;
  }
  const { FirebaseBackend } = await import('./firebase-backend.js');
  return FirebaseBackend.create();
}
