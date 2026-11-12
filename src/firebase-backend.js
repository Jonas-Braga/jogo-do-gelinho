// Backend real: Firebase Auth (e-mail/senha) + Cloud Firestore.
// O SDK vem do CDN do Google (ES modules), sem build. Só é carregado no navegador.
//
// Coleções (as regras de acesso estão em firestore.rules):
//   users/{uid}       { nickname, email, status, createdAt }   próprio jogador e admin
//   nicknames/{chave} { uid }                                  garante apelido único
//   ranking/{uid}     { nickname, best, level, trophies, updatedAt }  lido por aprovados
//   admins/{uid}      {}                                        criado à mão no console
import { FIREBASE_CONFIG } from './firebase-config.js';
import { AccountError, checkSignUp, nickKey, nicknameProblem, withRanks, STATUSES, normTrophies } from './backend.js';
import { TROPHY_LEVELS } from './specials.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

export class FirebaseBackend {
  static async create() {
    const [app, auth, fs] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);
    return new FirebaseBackend(app, auth, fs);
  }

  constructor(app, A, F) {
    this.A = A;
    this.F = F;
    const fb = app.initializeApp(FIREBASE_CONFIG);
    this.auth = A.getAuth(fb);
    this.auth.languageCode = 'pt-BR';
    this.db = F.getFirestore(fb);
    this.user = null;
    this.current = undefined; // última sessão emitida (undefined = ainda carregando)
    this.listeners = [];
    this.unsubUser = null;
    this.version = 0;

    A.onAuthStateChanged(this.auth, (user) => this.watch(user));
  }

  ref(...path) {
    return this.F.doc(this.db, ...path);
  }

  // Acompanha o documento do jogador em tempo real: a aprovação libera o jogo na hora
  watch(user) {
    this.unsubUser?.();
    this.unsubUser = null;
    this.user = user;
    const v = ++this.version;
    if (!user) {
      this.publish(null);
      return;
    }
    let isAdmin = null;
    this.unsubUser = this.F.onSnapshot(
      this.ref('users', user.uid),
      async (snap) => {
        if (isAdmin === null) {
          isAdmin = await this.F.getDoc(this.ref('admins', user.uid)).then((d) => d.exists(), () => false);
        }
        const d = snap.exists() ? snap.data() : null;
        let best = 0;
        let trophies = [];
        if (d?.status === 'approved') {
          const r = await this.F.getDoc(this.ref('ranking', user.uid)).then((x) => x.data() || {}, () => ({}));
          best = r.best || 0;
          trophies = normTrophies(r.trophies);
        }
        if (v !== this.version) return; // trocou de conta enquanto carregava
        this.publish({
          uid: user.uid,
          email: user.email,
          nickname: d?.nickname || null,
          status: d ? d.status : 'incomplete',
          best,
          trophies,
          isAdmin,
        });
      },
      () => {
        if (v === this.version) this.publish({ uid: user.uid, email: user.email, status: 'error', best: 0, trophies: [], isAdmin: false });
      },
    );
  }

  publish(session) {
    this.current = session;
    for (const cb of this.listeners) cb(session);
  }

  onChange(cb) {
    this.listeners.push(cb);
    if (this.current !== undefined) cb(this.current);
    return () => (this.listeners = this.listeners.filter((f) => f !== cb));
  }

  async nicknameTaken(nickname) {
    const d = await this.F.getDoc(this.ref('nicknames', nickKey(nickname)));
    return d.exists();
  }

  async signUp({ email, nickname, password }) {
    checkSignUp({ email, nickname, password });
    if (await this.nicknameTaken(nickname)) throw new AccountError('nick/taken');
    await this.A.createUserWithEmailAndPassword(this.auth, String(email).trim(), password);
    // Se o apelido for tomado neste meio-tempo, a conta fica "incompleta" e a
    // tela pede outro apelido (completeProfile)
    await this.completeProfile(nickname);
  }

  async completeProfile(nickname) {
    const user = this.auth.currentUser;
    if (!user) throw new AccountError('permission-denied');
    const p = nicknameProblem(nickname);
    if (p) throw new AccountError(p);
    const nick = String(nickname).trim();
    const F = this.F;
    const batch = F.writeBatch(this.db);
    batch.set(this.ref('nicknames', nickKey(nick)), { uid: user.uid });
    batch.set(this.ref('users', user.uid), {
      nickname: nick,
      email: user.email,
      status: 'pending',
      createdAt: F.serverTimestamp(),
    });
    try {
      await batch.commit();
    } catch (e) {
      if (e.code === 'permission-denied' && (await this.nicknameTaken(nick))) throw new AccountError('nick/taken');
      throw e;
    }
  }

  async signIn(email, password) {
    if (!email) throw new AccountError('auth/missing-email');
    if (!password) throw new AccountError('auth/missing-password');
    await this.A.signInWithEmailAndPassword(this.auth, String(email).trim(), password);
  }

  async signOut() {
    await this.A.signOut(this.auth);
  }

  async resetPassword(email) {
    if (!email) throw new AccountError('auth/missing-email');
    await this.A.sendPasswordResetEmail(this.auth, String(email).trim());
  }

  async submitScore(score, level) {
    const s = this.current;
    if (!s || s.status !== 'approved') throw new AccountError('score/not-approved');
    const ref = this.ref('ranking', s.uid);
    const cur = (await this.F.getDoc(ref)).data();
    if (cur && cur.best >= score) return cur.best;
    await this.F.setDoc(ref, {
      nickname: s.nickname,
      best: Math.floor(score),
      level: Math.max(1, Math.floor(level)),
      updatedAt: this.F.serverTimestamp(),
    }, { merge: true }); // merge: preserva os troféus
    s.best = Math.floor(score);
    return s.best;
  }

  // Troféu da fase especial: entra na lista (arrayUnion) sem mexer na pontuação
  async awardTrophy(level) {
    const s = this.current;
    if (!s || s.status !== 'approved') throw new AccountError('score/not-approved');
    level = Number(level);
    if (!TROPHY_LEVELS.includes(level)) throw new AccountError('permission-denied');
    const F = this.F;
    const ref = this.ref('ranking', s.uid);
    const cur = (await F.getDoc(ref)).data();
    if (cur) {
      await F.updateDoc(ref, { trophies: F.arrayUnion(level), updatedAt: F.serverTimestamp() });
    } else {
      await F.setDoc(ref, { nickname: s.nickname, best: 0, level: 1, trophies: [level], updatedAt: F.serverTimestamp() });
    }
    s.trophies = normTrophies(s.trophies, cur?.trophies, [level]);
    return s.trophies;
  }

  async ranking(n = 10) {
    const F = this.F;
    const col = F.collection(this.db, 'ranking');
    const snap = await F.getDocs(F.query(col, F.where('best', '>', 0), F.orderBy('best', 'desc'), F.limit(n)));
    const top = withRanks(snap.docs.map((d) => ({ uid: d.id, ...pick(d.data()) })));
    let me = null;
    const uid = this.current?.uid;
    if (uid) {
      const mine = top.find((e) => e.uid === uid);
      if (mine) me = mine;
      else {
        const d = (await F.getDoc(this.ref('ranking', uid))).data();
        if (d?.best > 0) {
          const above = await F.getCountFromServer(F.query(col, F.where('best', '>', d.best)));
          me = { uid, ...pick(d), rank: above.data().count + 1 };
        }
      }
    }
    return { top, me };
  }

  // ---- administração (as regras só deixam o admin fazer isto)
  async listUsers() {
    const F = this.F;
    const [users, scores] = await Promise.all([
      F.getDocs(F.collection(this.db, 'users')),
      F.getDocs(F.collection(this.db, 'ranking')),
    ]);
    const score = new Map(scores.docs.map((d) => [d.id, d.data()]));
    return users.docs
      .map((d) => {
        const u = d.data();
        const r = score.get(d.id) || {};
        return { uid: d.id, ...u, createdAt: u.createdAt?.toMillis?.() || 0, best: r.best || 0, trophies: normTrophies(r.trophies) };
      })
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async setStatus(uid, status) {
    if (!STATUSES.includes(status)) throw new AccountError('permission-denied');
    await this.F.updateDoc(this.ref('users', uid), { status });
    if (status !== 'approved') await this.F.deleteDoc(this.ref('ranking', uid));
  }

  async resetScore(uid) {
    const ref = this.ref('ranking', uid);
    if ((await this.F.getDoc(ref)).exists()) {
      await this.F.updateDoc(ref, { best: 0, updatedAt: this.F.serverTimestamp() });
    }
  }

  async pendingCount() {
    const F = this.F;
    const q = F.query(F.collection(this.db, 'users'), F.where('status', '==', 'pending'));
    return (await F.getCountFromServer(q)).data().count;
  }
}

const pick = (d) => ({ nickname: d.nickname, best: d.best || 0, level: d.level || 1, trophies: normTrophies(d.trophies) });
