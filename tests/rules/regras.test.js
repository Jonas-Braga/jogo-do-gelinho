// Testes das regras do Firestore (firestore.rules) no emulador, com as regras de
// verdade. Rodar com `npm run test:regras` (sobe o emulador, roda e desliga).
// Usa o projeto "demo-gelinho": nada toca o projeto real.
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, arrayUnion, serverTimestamp,
} from 'firebase/firestore';
import { TROPHY_LEVELS } from '../../src/specials.js';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gelinho',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

// Ana: aprovada, com recorde e o troféu do Natal · Carla: aprovada, sem ranking
// Beto: aguardando aprovação · Adm: administrador
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const user = (nickname, status) => ({ nickname, email: `${nickname.toLowerCase()}@b.com`, status, createdAt: new Date() });
    await setDoc(doc(db, 'users/ana'), user('Ana', 'approved'));
    await setDoc(doc(db, 'users/carla'), user('Carla', 'approved'));
    await setDoc(doc(db, 'users/beto'), user('Beto', 'pending'));
    await setDoc(doc(db, 'users/adm'), user('Adm', 'approved'));
    await setDoc(doc(db, 'admins/adm'), {});
    await setDoc(doc(db, 'ranking/ana'), { nickname: 'Ana', best: 1000, level: 3, trophies: [5], updatedAt: new Date() });
  });
});

const as = (uid) => env.authenticatedContext(uid, { email: `${uid}@b.com` }).firestore();
const stored = async (path) => {
  let data;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path))).data();
  });
  return data;
};
const score = (extra = {}) => ({ nickname: 'Ana', best: 2000, level: 4, updatedAt: serverTimestamp(), ...extra });

// ---- Recorde
test('aprovado grava recorde maior, e o merge preserva os troféus', async () => {
  await assertSucceeds(setDoc(doc(as('ana'), 'ranking/ana'), score(), { merge: true }));
  const d = await stored('ranking/ana');
  if (d.best !== 2000 || d.trophies.join() !== '5') throw new Error(JSON.stringify(d));
});

test('recorde nunca diminui', async () => {
  await assertFails(setDoc(doc(as('ana'), 'ranking/ana'), score({ best: 10 }), { merge: true }));
});

test('ninguém grava no ranking de outro jogador', async () => {
  await assertFails(setDoc(doc(as('carla'), 'ranking/ana'), score(), { merge: true }));
});

test('quem aguarda aprovação não grava recorde nem lê o ranking', async () => {
  await assertFails(setDoc(doc(as('beto'), 'ranking/beto'), score({ nickname: 'Beto' })));
  await assertFails(getDocs(collection(as('beto'), 'ranking')));
  await assertSucceeds(getDocs(collection(as('carla'), 'ranking')));
});

test('campos estranhos no ranking são recusados', async () => {
  await assertFails(setDoc(doc(as('ana'), 'ranking/ana'), score({ hack: true }), { merge: true }));
});

// ---- Troféus
test('ganhar troféu com arrayUnion funciona', async () => {
  await assertSucceeds(updateDoc(doc(as('ana'), 'ranking/ana'), { trophies: arrayUnion(10), updatedAt: serverTimestamp() }));
  const d = await stored('ranking/ana');
  if (d.trophies.join() !== '5,10') throw new Error(JSON.stringify(d.trophies));
});

test('primeiro troféu de quem ainda não tem ranking cria o documento com recorde 0', async () => {
  await assertSucceeds(setDoc(doc(as('carla'), 'ranking/carla'),
    { nickname: 'Carla', best: 0, level: 1, trophies: [5], updatedAt: serverTimestamp() }));
});

test('todas as fases especiais do jogo são aceitas como troféu', async () => {
  await assertSucceeds(setDoc(doc(as('carla'), 'ranking/carla'),
    { nickname: 'Carla', best: 0, level: 1, trophies: TROPHY_LEVELS, updatedAt: serverTimestamp() }));
});

test('troféu de fase que não é especial é recusado', async () => {
  await assertFails(updateDoc(doc(as('ana'), 'ranking/ana'), { trophies: arrayUnion(7), updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as('ana'), 'ranking/ana'), { trophies: arrayUnion('10'), updatedAt: serverTimestamp() }));
});

test('a lista de troféus nunca diminui', async () => {
  await assertFails(updateDoc(doc(as('ana'), 'ranking/ana'), { trophies: [], updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as('ana'), 'ranking/ana'), score({ trophies: [10] })));
});

test('troféu repetido na lista é recusado', async () => {
  await assertFails(setDoc(doc(as('carla'), 'ranking/carla'),
    { nickname: 'Carla', best: 0, level: 1, trophies: [5, 5], updatedAt: serverTimestamp() }));
});

test('quem aguarda aprovação não ganha troféu', async () => {
  await assertFails(setDoc(doc(as('beto'), 'ranking/beto'),
    { nickname: 'Beto', best: 0, level: 1, trophies: [5], updatedAt: serverTimestamp() }));
});

// ---- Administrador
test('admin zera a pontuação e os troféus ficam', async () => {
  await assertSucceeds(updateDoc(doc(as('adm'), 'ranking/ana'), { best: 0, updatedAt: serverTimestamp() }));
  const d = await stored('ranking/ana');
  if (d.best !== 0 || d.trophies.join() !== '5') throw new Error(JSON.stringify(d));
});

test('admin não mexe nos troféus nem dá pontos', async () => {
  await assertFails(updateDoc(doc(as('adm'), 'ranking/ana'), { trophies: [], updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as('adm'), 'ranking/ana'), { best: 5000, updatedAt: serverTimestamp() }));
});

test('só o admin aprova contas e apaga do ranking', async () => {
  await assertFails(updateDoc(doc(as('ana'), 'users/beto'), { status: 'approved' }));
  await assertFails(updateDoc(doc(as('beto'), 'users/beto'), { status: 'approved' }));
  await assertSucceeds(updateDoc(doc(as('adm'), 'users/beto'), { status: 'approved' }));
  await assertFails(deleteDoc(doc(as('ana'), 'ranking/ana')));
  await assertSucceeds(deleteDoc(doc(as('adm'), 'ranking/ana')));
});

// ---- Contas
test('cadastro só nasce "pending", com apelido reservado junto', async () => {
  const db = as('novo');
  const profile = { nickname: 'Novo', email: 'novo@b.com', createdAt: serverTimestamp() };
  await assertFails(setDoc(doc(db, 'users/novo'), { ...profile, status: 'approved' }));
  // Sem o documento do apelido no mesmo lote, também falha
  await assertFails(setDoc(doc(db, 'users/novo'), { ...profile, status: 'pending' }));
});

test('ninguém lê o perfil (e o e-mail) de outro jogador', async () => {
  await assertFails(getDoc(doc(as('ana'), 'users/carla')));
  await assertSucceeds(getDoc(doc(as('ana'), 'users/ana')));
  await assertSucceeds(getDoc(doc(as('adm'), 'users/carla')));
});
