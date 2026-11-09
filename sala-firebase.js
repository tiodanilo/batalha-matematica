/* Batalha Matemática — sala online pelo Firebase (o mesmo banco do jogo "Conquista das Áreas").
   Imita a "sala" da página do Claude (join / presence / onPeers / emit / on / leave), para o duelo.js
   funcionar igual no site (tiodanilo.github.io), sem conta.
   As regras do banco só aceitam gravar em salas/<4 letras/números> e não deixam apagar uma sala inteira.
   Por isso cada sala da Batalha vira salas/<código de 4> e usa campos próprios:
     tipo: "batalha"   (marca fixa: impede que a sala fique vazia)
     bp/<pessoa>       (presença de cada pessoa; some quando ela sai ou fecha a página)
     be/<assunto>      (último aviso de cada assunto, ex.: "duplas")
   Os campos do jogo das áreas (estado, mundo) nunca são tocados. */
(function () {
  'use strict';
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBfNgbSV1SXhXq4YEuhZaEU-gHd_MgA9ck',
    authDomain: 'conquista-areas.firebaseapp.com',
    databaseURL: 'https://conquista-areas-default-rtdb.firebaseio.com',
    projectId: 'conquista-areas',
    storageBucket: 'conquista-areas.firebasestorage.app',
    messagingSenderId: '471402325823',
    appId: '1:471402325823:web:7adb1bb61680ad489f158a',
  };
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const ALF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const eu = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  // nome da sala (ex.: "sala-7blaab") -> código de 4 caracteres que as regras aceitam
  function codigo4(nome) {
    let h = 2166136261;
    for (const ch of 'batalha:' + nome) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    let s = '';
    for (let i = 0; i < 4; i++) { s += ALF[h % 32]; h = Math.floor(h / 32); }
    return s;
  }
  function carregar(src) {
    return new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = erro; document.head.appendChild(s); });
  }

  let db = null, conectado = false;
  async function iniciar() {
    if (db) return true;
    if (!window.firebase) { await carregar(SDK + 'firebase-app-compat.js'); await carregar(SDK + 'firebase-database-compat.js'); }
    const app = firebase.apps.find(a => a.name === 'batalha') || firebase.initializeApp(FIREBASE_CONFIG, 'batalha');
    db = app.database();
    db.ref('.info/connected').on('value', x => { conectado = !!x.val(); });
    return true;
  }

  function criarSala(nome) {
    const cod = codigo4(nome), base = db.ref('salas/' + cod);
    const minha = base.child('bp/' + eu);
    let pres = {}, lista = [], antes = new Map(), saiu = false;
    const ouvintes = [], desligar = [];
    const quem = peer => ({ peer, by: null, isMe: peer === eu, sameTab: peer === eu, kind: 'viewer', guest: false });

    function montar(val) {
      const ps = [];
      const v = val || {};
      if (!v[eu]) v[eu] = { p: pres, t: Date.now() };
      for (const [peer, o] of Object.entries(v)) {
        if (!o || typeof o !== 'object') continue;
        ps.push(Object.assign(quem(peer), { presence: peer === eu ? pres : (o.p || {}), updatedAt: Date.now() }));
      }
      return ps;
    }
    function avisar(val) {
      if (saiu) return;
      const ps = montar(val), agora = new Map(ps.map(p => [p.peer, JSON.stringify(p.presence)]));
      const joined = ps.filter(p => !antes.has(p.peer));
      const left = [...antes.keys()].filter(k => !agora.has(k)).map(peer => quem(peer));
      const updated = ps.filter(p => antes.has(p.peer) && antes.get(p.peer) !== agora.get(p.peer));
      antes = agora; lista = ps;
      ouvintes.slice().forEach(h => { try { h({ peers: ps, joined, left, updated }); } catch (e) { console.error(e); } });
    }
    const refPessoas = base.child('bp');
    const cbPessoas = refPessoas.on('value', x => avisar(x.val()));
    desligar.push(() => refPessoas.off('value', cbPessoas));

    // marca fixa da sala e presença que some sozinha quando a página fecha
    base.child('tipo').set('batalha').catch(() => {});
    minha.onDisconnect().remove();

    const sala = {
      name: nome,
      presence(patch) {
        pres = Object.assign({}, pres, patch);
        for (const k in patch) if (patch[k] === null) delete pres[k];
        return minha.set({ p: pres, t: firebase.database.ServerValue.TIMESTAMP });
      },
      peers: () => (lista.length ? lista : montar(null)),
      onPeers(h) {
        ouvintes.push(h);
        setTimeout(() => { if (!saiu) h({ peers: sala.peers(), joined: sala.peers(), left: [], updated: [] }); }, 0);
        return () => { const i = ouvintes.indexOf(h); if (i >= 0) ouvintes.splice(i, 1); };
      },
      emit(topic, data) {
        return base.child('be/' + topic).set({ d: data === undefined ? null : data, peer: eu, n: Math.random() });
      },
      on(topic, h) {
        const r = base.child('be/' + topic);
        const cb = r.on('value', x => {
          const v = x.val();
          if (!v || saiu) return;
          h(Object.assign(quem(v.peer), { topic, data: v.d }));
        });
        const off = () => r.off('value', cb);
        desligar.push(off);
        return off;
      },
      connected: () => conectado,
      onConnection(h) { setTimeout(() => h(conectado)); return () => {}; },
      async leave() {
        if (saiu) return; saiu = true;
        desligar.forEach(f => { try { f(); } catch (e) { /* já desligado */ } });
        ouvintes.length = 0;
        try { await minha.onDisconnect().cancel(); await minha.remove(); } catch (e) { /* sem conexão */ }
        delete salas[nome];
      },
    };
    return sala;
  }

  const salas = {};
  // Ranking: cada ranking é uma "sala" de 4 caracteres com o campo r/<aluno> (as regras do banco já permitem)
  const comPrazo = (p, ms) => Promise.race([p, new Promise((_, erro) => setTimeout(() => erro(new Error('tempo')), ms))]);
  async function refRanking(nome) {
    await comPrazo(iniciar(), 10000);
    const base = db.ref('salas/' + codigo4(nome));
    base.child('tipo').set('ranking').catch(() => {});
    return base.child('r');
  }
  const num = v => Math.max(0, Math.min(1e7, Math.floor(+v || 0)));
  const ranking = {
    async enviar(nomes, id, d) {
      if (!/^[a-z0-9]{6,20}$/.test(id)) return;
      const limpo = { nome: String(d.nome || '').slice(0, 16), v: num(d.v), e: num(d.e), d: num(d.d), partidas: num(d.partidas),
        acertos: num(d.acertos), erradas: num(d.erradas), moedas: num(d.moedas), nivel: num(d.nivel), t: firebase.database.ServerValue.TIMESTAMP };
      for (const n of nomes) { const r = await refRanking(n); await comPrazo(r.child(id).set(limpo), 10000); }
    },
    async ler(nome) {
      const r = await refRanking(nome);
      const s = await comPrazo(r.once('value'), 10000);
      return Object.entries(s.val() || {}).filter(([, v]) => v && typeof v === 'object').map(([id, v]) => ({
        id, nome: String(v.nome || '?').slice(0, 16), v: num(v.v), e: num(v.e), d: num(v.d), partidas: num(v.partidas),
        acertos: num(v.acertos), erradas: num(v.erradas), moedas: num(v.moedas), nivel: num(v.nivel) || 1,
      }));
    },
  };
  window.SalaFirebase = {
    ranking,
    codigo4,
    // devolve um objeto parecido com a "sala" do Claude, ou null se não der para conectar
    async abrir() {
      try {
        const ok = await Promise.race([iniciar(), new Promise(r => setTimeout(() => r(false), 10000))]);
        if (!ok) return null;
        return { join: async nome => salas[nome] || (salas[nome] = criarSala(nome)) };
      } catch (e) { console.warn('Firebase indisponível', e); return null; }
    },
  };
})();
