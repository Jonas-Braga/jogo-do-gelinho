// Página de administração (admin.html): aprovar, recusar, revogar e zerar pontuação.
// Só funciona para a conta marcada como admin (documento admins/{uid} no Firestore);
// as regras do Firestore garantem isso no servidor, esta página só mostra.
import { createBackend, errorMessage } from './backend.js';
import { pad6 } from './ui.js';

const root = document.getElementById('admin-body');

const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'onclick') el.addEventListener('click', v);
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
};

const SECTIONS = [
  ['pending', 'Aguardando aprovação'],
  ['approved', 'Aprovados'],
  ['rejected', 'Recusados / sem acesso'],
];

let backend;
let error = null;

function message(text) {
  root.replaceChildren(h('p', { class: 'muted' }, text));
}

async function act(fn) {
  error = null;
  try {
    await fn();
  } catch (e) {
    console.warn('[gelinho admin]', e);
    error = errorMessage(e);
  }
  await refresh();
}

function actions(u) {
  const btn = (label, cls, fn) => h('button', { type: 'button', class: `btn small ${cls}`, onclick: () => act(fn) }, label);
  const approve = btn('Aprovar', 'ok', () => backend.setStatus(u.uid, 'approved'));
  if (u.status === 'pending') {
    return [approve, btn('Recusar', 'danger', () => backend.setStatus(u.uid, 'rejected'))];
  }
  if (u.status === 'approved') {
    const out = [btn('Revogar acesso', 'danger', () => backend.setStatus(u.uid, 'rejected'))];
    if (u.best > 0) out.unshift(btn('Zerar pontuação', '', () => backend.resetScore(u.uid)));
    return out;
  }
  return [approve];
}

function row(u) {
  const when = u.createdAt ? new Date(u.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
  return h('div', { class: 'admin-row' },
    h('div', { class: 'admin-who' },
      h('strong', {}, u.nickname),
      h('span', {}, `${u.email}${when ? ` · cadastro ${when}` : ''}`)),
    u.status === 'approved' && u.trophies?.length
      ? h('span', { class: 'admin-trophies', title: 'Troféus das fases especiais' }, `🏆 ${u.trophies.join(' · ')}`)
      : null,
    u.status === 'approved' ? h('span', { class: 'admin-score' }, pad6(u.best)) : null,
    h('div', { class: 'admin-actions' }, ...actions(u)));
}

async function refresh() {
  let users;
  try {
    users = await backend.listUsers();
  } catch (e) {
    message(`Não foi possível carregar os jogadores: ${errorMessage(e)}`);
    return;
  }
  const blocks = SECTIONS.map(([status, title]) => {
    const list = users.filter((u) => u.status === status);
    if (status === 'approved') list.sort((a, b) => b.best - a.best);
    if (status === 'rejected' && !list.length) return null;
    const badge = status === 'pending' && list.length ? h('span', { class: 'badge' }, String(list.length)) : null;
    return h('section', { class: 'admin-section' },
      h('h2', {}, title, badge),
      list.length ? list.map(row) : h('p', { class: 'muted' }, status === 'pending' ? 'Ninguém esperando.' : 'Nenhum jogador.'));
  });
  root.replaceChildren(...(error ? [h('p', { class: 'admin-msg error', role: 'alert' }, error)] : []), ...blocks.filter(Boolean));
}

try {
  backend = await createBackend();
  let loaded = false;
  backend.onChange((s) => {
    if (!s) return message('Entre no jogo com a conta de administrador e volte para esta página.');
    if (!s.isAdmin) return message('Acesso restrito ao administrador.');
    if (!loaded) {
      loaded = true;
      refresh();
    }
  });
} catch (e) {
  console.error(e);
  message('Não foi possível conectar ao servidor. Verifique a internet e recarregue a página.');
}
