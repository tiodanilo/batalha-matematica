/* Arena do Caderno — duelo entre alunos (sala da turma + sorteio de duplas).
   Usa a capacidade "room" da página publicada: só funciona para quem entra com conta e foi convidado.
   Quem é o 1º da dupla ("anfitrião") roda a batalha; o 2º ("convidado") manda pedidos e mostra o que recebe.
   O convidado vê tudo espelhado: o castelo dele embaixo, em azul. */
(function () {
  'use strict';
  const A = window.Arena;
  const $ = id => document.getElementById(id);
  const r1 = v => Math.round(v * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const COR_AZUL = '#2f6fd6', COR_VERM = '#d6453d';
  const EFEITOS = ['boom', 'hit', 'anel', 'raio', 'txt'], DURACAO = [0.5, 0.18, 0.3, 0.45, 1.5];
  // posição das torres do anfitrião (0..5) na visão espelhada do convidado
  const TORRE_ESPELHO = [4, 3, 5, 1, 0, 2];

  let room = null, ehProf = false;
  let sala = null, codigo = null, cfgSala = null, meuNome = '';
  let estado = 'fora', rodadaVista = 0, duelo = null;
  const guardar = {
    ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    gravar(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } },
  };

  /* ---------- liga a sala, se a página permitir ---------- */
  (async () => {
    if (window.claude && window.claude.use) {
      // dentro do Claude: sala do próprio Claude (precisa de conta); só quem edita a página abre a sala
      try { room = await window.claude.use('room'); } catch (e) { room = null; }
      try {
        const user = await window.claude.use('user');
        ehProf = !!(user && (await Promise.resolve(user.canEdit())));
      } catch (e) { ehProf = false; }
    } else if (window.SalaFirebase) {
      // no site: sala pelo Firebase (sem conta), como no jogo das áreas; o professor abre pela Área do professor
      room = await window.SalaFirebase.abrir();
      ehProf = !!room;
    }
    $('btAbrirSala').hidden = !(room && ehProf);
    $('btDuelo').hidden = !room; // fora do Claude (ex.: no site), o duelo não funciona: some o botão
  })();
  $('btAbrirSala').hidden = true;
  $('btDuelo').hidden = true;

  const meuPeer = r => { const p = r.peers().find(x => x.sameTab); return p ? p.peer : null; };
  const nomeDe = (r, peer) => { const p = r.peers().find(x => x.peer === peer); return (p && typeof p.presence.nome === 'string' && p.presence.nome.slice(0, 16)) || 'Colega'; };
  function presencaSala(extra) { if (sala) sala.presence(Object.assign({ papel: 'aluno', nome: meuNome, est: estado }, extra || {})).catch(() => {}); }

  /* ================= ALUNO ================= */
  $('btDuelo').onclick = () => {
    const c = A.decodificar($('inCodigo').value);
    if (!c) { $('avisoCodigo').textContent = 'Digite primeiro o código da turma que o professor passou.'; return; }
    if (!room) {
      $('avisoCodigo').textContent = 'Não consegui conectar à sala online. Confira a internet e tente de novo, ou jogue contra o robô.';
      return;
    }
    cfgSala = c; codigo = $('inCodigo').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    $('salaCodigo').textContent = codigo;
    $('inNome').value = guardar.ler('arena-nome') || '';
    $('caixaNome').hidden = false; $('caixaEspera').hidden = true; $('avisoSala').textContent = '';
    A.mostrar('telaSala');
  };
  $('inNome').addEventListener('keydown', e => { if (e.key === 'Enter') $('btEntrarSala').click(); });
  $('btEntrarSala').onclick = async () => {
    meuNome = $('inNome').value.trim().replace(/\s+/g, ' ').slice(0, 16);
    if (!meuNome) { $('avisoSala').textContent = 'Escreva seu nome para os colegas saberem quem é você.'; return; }
    guardar.gravar('arena-nome', meuNome);
    try { sala = await room.join('sala-' + codigo.toLowerCase()); }
    catch (e) { $('avisoSala').textContent = 'Não deu para entrar na sala agora. Tente de novo em instantes.'; return; }
    estado = 'esperando';
    presencaSala();
    $('caixaNome').hidden = true; $('caixaEspera').hidden = false;
    $('salaStatus').textContent = 'Esperando o professor sortear as duplas…';
    sala.onPeers(desenharSalaAluno);
    sala.on('duplas', recebeuDuplas);
  };
  function desenharSalaAluno() {
    if (!sala) return;
    const ps = sala.peers();
    const alunos = ps.filter(p => p.presence.papel === 'aluno');
    const prof = ps.some(p => p.presence.papel === 'professor' && !p.isMe);
    $('salaQtd').textContent = `${alunos.length} ${alunos.length === 1 ? 'aluno' : 'alunos'} na sala` + (prof ? ' · professor conectado ✓' : ' · professor ainda não abriu a sala');
    const ul = $('salaLista'); ul.innerHTML = '';
    alunos.forEach(p => {
      const li = document.createElement('li');
      li.textContent = (typeof p.presence.nome === 'string' ? p.presence.nome.slice(0, 16) : '?') + (p.sameTab ? ' (você)' : '');
      ul.appendChild(li);
    });
  }
  async function sairDaSala() {
    if (duelo) await encerrarDuelo();
    if (sala) { try { await sala.leave(); } catch (e) { /* já saiu */ } }
    sala = null; estado = 'fora';
    A.mostrar('telaInicio');
  }
  $('btSairSala').onclick = sairDaSala;

  function recebeuDuplas(msg) {
    const d = msg.data;
    if (!d || typeof d.r !== 'number' || d.r <= rodadaVista || estado !== 'esperando' || !sala) return;
    const eu = meuPeer(sala); if (!eu) return;
    // só vale o sorteio feito por quem está na sala como professor
    const remetente = sala.peers().find(p => p.peer === msg.peer);
    if (!remetente || remetente.presence.papel !== 'professor') return;
    const pares = Array.isArray(d.p) ? d.p : [], sos = Array.isArray(d.s) ? d.s : [];
    const i = pares.findIndex(par => Array.isArray(par) && par.includes(eu));
    if (i >= 0) {
      rodadaVista = d.r;
      const par = pares[i], outro = par[0] === eu ? par[1] : par[0];
      iniciarDuelo(`d-${codigo.toLowerCase()}-${d.r}-${i}`, par[0] === eu, outro, nomeDe(sala, outro));
    } else if (sos.includes(eu)) {
      rodadaVista = d.r;
      estado = 'jogando'; presencaSala({ vs: 'Robô' });
      const on = { papel: 'solo', aoTerminar: aoTerminarSolo, sair: sairNoMeio };
      A.novaPartida(cfgSala, on, 'Robô');
      on.robo = true;
      A.aviso('Nesta rodada sobrou você: jogue contra o robô!');
    }
  }
  function aoTerminarSolo() {
    const J = A.J; estado = 'fim';
    presencaSala({ vs: 'Robô', cr: J.coroas.slice(), ac: J.certas, er: J.erradas });
  }
  $('btVoltarSala').onclick = async () => {
    if (duelo) await encerrarDuelo();
    A.J = null;
    estado = 'esperando'; presencaSala({ vs: null, cr: null });
    $('salaStatus').textContent = 'Esperando a próxima rodada…';
    A.mostrar('telaSala'); desenharSalaAluno();
  };

  /* ---------- partida em rede ---------- */
  async function iniciarDuelo(nomeSala, souAnfitriao, outro, nomeOutro) {
    estado = 'jogando'; presencaSala({ vs: nomeOutro, cr: [0, 0] });
    let dr;
    try { dr = await room.join(nomeSala); }
    catch (e) { A.aviso('Não deu para conectar com o colega.'); estado = 'esperando'; presencaSala(); return; }
    duelo = { dr, outro, nomeOutro, timers: [], off: [] };
    if (souAnfitriao) anfitriao(duelo); else convidado(duelo);
  }
  async function encerrarDuelo() {
    const d = duelo; duelo = null;
    if (!d) return;
    d.timers.forEach(t => clearInterval(t)); d.off.forEach(f => { try { f(); } catch (e) { /* já desligado */ } });
    try { await d.dr.leave(); } catch (e) { /* já saiu */ }
  }
  function resultadoParaSala() {
    const J = A.J; if (!J) return;
    estado = 'fim';
    presencaSala({ vs: duelo ? duelo.nomeOutro : null, cr: J.coroas.slice(), ac: J.certas, er: J.erradas });
  }
  function sairNoMeio() {
    encerrarDuelo().then(() => {
      A.J = null; estado = 'esperando'; presencaSala({ vs: null, cr: null });
      $('salaStatus').textContent = 'Você saiu da partida. Esperando a próxima rodada…';
      A.mostrar('telaSala');
    });
  }

  /* ----- quem roda a batalha ----- */
  function anfitriao(d) {
    const on = { papel: 'anfitriao', esperando: true, ganhoVisto: 0, rqVisto: 0, sair: sairNoMeio };
    const J = A.novaPartida(cfgSala, on, d.nomeOutro);
    const ids = new WeakMap(); let seq = 0;
    const idDe = o => { let i = ids.get(o); if (!i) { i = ++seq; ids.set(o, i); } return i; };
    const golpes = new WeakMap();
    const inicio = Date.now();
    let fimEnviado = 0;

    on.aoTerminar = () => { resultadoParaSala(); fimEnviado = Date.now(); };

    function lerConvidado(pres) {
      if (!pres || on.robo) return;
      if (typeof pres.g === 'number' && pres.g > on.ganhoVisto) {
        const ganho = Math.min(pres.g - on.ganhoVisto, 6); // no máximo o de duas respostas por vez
        on.ganhoVisto = pres.g;
        J.en[1] = Math.min(10, J.en[1] + ganho);
      }
      if (Array.isArray(pres.rq)) for (const q of pres.rq) {
        if (!Array.isArray(q) || typeof q[0] !== 'number' || q[0] <= on.rqVisto) continue;
        on.rqVisto = q[0];
        const [, k, x, y] = q;
        if (J.estado !== 'jogando' || !A.CARTAS[k] || !Number.isFinite(x) || !Number.isFinite(y)) continue;
        const idx = J.maos[1].mao.indexOf(k);
        if (idx >= 0) A.jogar(1, idx, 18 - x, 30 - y); // o convidado manda na visão dele (espelhada)
      }
    }
    d.off.push(d.dr.onPeers(ch => {
      const p = ch.peers.find(x => x.peer === d.outro);
      if (p && on.esperando) { on.esperando = false; J.contagem = 3.2; }
      if (p) lerConvidado(p.presence);
      else if (!on.esperando && !on.robo && J.estado !== 'fim' && J.estado !== 'acabou') {
        on.robo = true; A.aviso('Seu colega saiu. Agora você joga contra o robô.');
      }
    }));
    d.dr.presence({ papel: 'jogador', nome: meuNome }).catch(() => {});

    function foto() {
      const u = [], tw = [];
      for (const e of J.ents) {
        if (e.kind === 'torre') { tw.push([idDe(e), Math.max(0, Math.round(e.hp)), e.ativo ? 1 : 0]); continue; }
        const g = golpes.get(e) || [e.cd || 0, 0];
        if ((e.cd || 0) > g[0] + 0.01) g[1]++;
        g[0] = e.cd || 0; golpes.set(e, g);
        const chave = e.kind === 'pred' ? 'balista' : e.def.key;
        u.push([idDe(e), A.BARALHO.indexOf(chave), e.team, r1(e.x), r1(e.y), Math.max(0, Math.round(e.hp)),
          e.spawn > 0 ? 1 : 0, g[1], e.alvo && e.alvo.hp > 0 ? idDe(e.alvo) : 0, e.preso ? 1 : 0]);
      }
      const s = {
        t: r1(J.tempo), c: J.coroas.slice(), est: J.estado, ct: r1(J.contagem), v: J.vencedor,
        e1: r1(J.en[1]), m1: J.maos[1].mao.slice(), f1: J.maos[1].fila[0], g1: on.ganhoVisto, rqv: on.rqVisto,
        tw, u,
        p: J.proj.slice(0, 24).map(p => [idDe(p), r1(p.x), r1(p.y), r1(p.tx), r1(p.ty), p.splash ? 1 : 0]),
        f: J.feiticos.map(f => [idDe(f), r1(f.x), r1(f.y), r1(f.t), f.raio]),
        x: J.efeitos.slice(-12).map(ef => [idDe(ef), EFEITOS.indexOf(ef.tipo), r1(ef.x), r1(ef.y), r1(ef.r || 0), ef.cor === COR_AZUL ? 0 : 1]),
      };
      // presença tem limite de 4 KB: corta o que é menos importante primeiro
      while (JSON.stringify(s).length > 3800) {
        if (s.x.length) s.x.pop(); else if (s.p.length) s.p.pop(); else if (s.u.length) s.u.pop(); else break;
      }
      return s;
    }
    d.timers.push(setInterval(() => {
      if (!duelo || duelo !== d || A.J !== J) return;
      if (on.esperando && Date.now() - inicio > 25000) { // o colega não apareceu
        on.esperando = false; on.robo = true; J.contagem = 3.2;
        A.aviso('Seu colega não conectou. Você joga contra o robô.');
      }
      if (fimEnviado && Date.now() - fimEnviado > 5000) return;
      d.dr.presence({ papel: 'jogador', nome: meuNome, s: foto() }).catch(() => {});
    }, 125)); // 8 vezes por segundo: suave e leve para o banco
    on.enviarFoto = () => d.dr.presence({ papel: 'jogador', nome: meuNome, s: foto() }); // usado nos testes
  }

  /* ----- quem só mostra (vê espelhado) ----- */
  function convidado(d) {
    const on = { papel: 'convidado', esperando: true, ganho: 0, rqSeq: 0, rqs: [], ultimo: Date.now(), inicio: Date.now(), sair: sairNoMeio };
    const J = A.novaPartida(cfgSala, on, d.nomeOutro);
    const mapa = new Map(), projMapa = new Map(), feitMapa = new Map();
    let efVistos = new Set(), maoChave = '', torresMapeadas = false, acabou = false;

    const enviar = () => d.dr.presence({ papel: 'jogador', nome: meuNome, g: on.ganho, rq: on.rqs }).catch(() => {});
    on.aoAcertar = ganho => { on.ganho += ganho; J.en[0] = Math.min(10, J.en[0] + ganho); enviar(); };
    on.aoJogar = (idx, x, y) => {
      if (J.estado !== 'jogando') return 'lugar';
      const k = J.maos[0].mao[idx], def = A.CARTAS[k];
      if (!def) return 'lugar';
      if (J.en[0] < def.custo) return 'energia';
      if (!A.podeColocar(0, def, x, y)) return 'lugar';
      on.rqs.push([++on.rqSeq, k, r1(x), r1(y)]);
      if (on.rqs.length > 4) on.rqs.shift();
      J.en[0] -= def.custo;
      enviar();
      return 'ok';
    };
    on.aoTerminar = () => resultadoParaSala();
    on.quadro = dt => {
      const k = Math.min(1, dt * 12);
      for (const e of J.ents) {
        if (e.kind === 'torre') { e.flash = Math.max(0, (e.flash || 0) - dt); continue; }
        e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; e.flash = Math.max(0, (e.flash || 0) - dt);
      }
      for (const p of J.proj) { p.x += (p.ax - p.x) * k; p.y += (p.ay - p.y) * k; }
      const parado = Date.now() - on.ultimo;
      if (!acabou && ((on.esperando && Date.now() - on.inicio > 25000) || (!on.esperando && parado > 8000))) {
        acabou = true; A.aviso('A conexão com o colega caiu.');
        setTimeout(sairNoMeio, 1800);
      }
    };
    enviar();

    function aplicar(s) {
      if (!s || typeof s !== 'object' || A.J !== J || acabou) return;
      on.ultimo = Date.now();
      if (on.esperando) on.esperando = false;
      J.tempo = +s.t || 0;
      if (Array.isArray(s.c)) J.coroas = [s.c[1] | 0, s.c[0] | 0];
      if (s.est === 'contagem') { J.estado = 'contagem'; J.contagem = +s.ct || 0; }
      else if (s.est === 'jogando' && J.estado === 'contagem') { J.estado = 'jogando'; $('camInicio').classList.remove('ativa'); }
      // energia: o que o anfitrião sabe + acertos e cartas que ele ainda não processou
      const pend = on.rqs.filter(q => q[0] > (s.rqv | 0)).reduce((t, q) => t + (A.CARTAS[q[1]] ? A.CARTAS[q[1]].custo : 0), 0);
      J.en[0] = clamp((+s.e1 || 0) + (on.ganho - (s.g1 | 0)) - pend, 0, 10);
      if (Array.isArray(s.m1) && s.m1.length === 4 && s.m1.every(k => A.CARTAS[k]) && A.CARTAS[s.f1]) {
        const ch = s.m1.join() + '|' + s.f1;
        if (ch !== maoChave) { maoChave = ch; J.maos[0] = { mao: s.m1.slice(), fila: [s.f1] }; J.sel = null; A.renderMao(); }
      }
      // torres
      const torres = J.ents.filter(e => e.kind === 'torre');
      if (Array.isArray(s.tw) && s.tw.length === 6) s.tw.forEach(([id, hp, ativo], i) => {
        const t = torres[TORRE_ESPELHO[i]]; if (!t) return;
        if (!torresMapeadas) mapa.set(id, t);
        if (hp < t.hp) t.flash = 0.12;
        t.hp = hp; t.ativo = !!ativo;
      });
      torresMapeadas = true;
      // tropas e balistas
      const vistos = new Set();
      if (Array.isArray(s.u)) for (const q of s.u) {
        const [id, ki, team, x, y, hp, sp, na, alvo, preso] = q;
        const chave = A.BARALHO[ki], def = A.CARTAS[chave];
        if (!def || !Number.isFinite(x) || !Number.isFinite(y)) continue;
        let e = mapa.get(id);
        if (!e) {
          e = def.tipo === 'predio'
            ? { kind: 'pred', def, team: 1 - team, hp, max: def.hp, radius: def.radius, x: 18 - x, y: 30 - y, cd: 0, flash: 0 }
            : { kind: 'unid', def, team: 1 - team, hp, max: def.hp, radius: def.radius, speed: def.speed, x: 18 - x, y: 30 - y, cd: 0, flash: 0 };
          e.na = na; mapa.set(id, e); J.ents.push(e);
        }
        e.tx = 18 - x; e.ty = 30 - y;
        if (hp < e.hp) e.flash = 0.12;
        e.hp = hp; e.spawn = sp ? 0.5 : 0; e.preso = !!preso; e.alvoId = alvo;
        if (na > e.na) { e.cd = (e.cd || 0) + 1; e.na = na; }
        vistos.add(e);
      }
      for (const e of J.ents) if (e.kind !== 'torre') { const a = e.alvoId && mapa.get(e.alvoId); e.alvo = a && a.hp > 0 ? a : null; }
      J.ents = J.ents.filter(e => e.kind === 'torre' || vistos.has(e));
      for (const [id, e] of mapa) if (e.kind !== 'torre' && !vistos.has(e)) mapa.delete(id);
      // flechas, magias e feitiços
      const np = new Map();
      J.proj = (Array.isArray(s.p) ? s.p : []).map(([id, x, y, tx, ty, sp]) => {
        const p = projMapa.get(id) || { x: 18 - x, y: 30 - y };
        p.ax = 18 - x; p.ay = 30 - y; p.tx = 18 - tx; p.ty = 30 - ty; p.splash = sp ? 1.5 : 0;
        np.set(id, p); return p;
      });
      projMapa.clear(); np.forEach((v, k) => projMapa.set(k, v));
      const nf = new Map();
      J.feiticos = (Array.isArray(s.f) ? s.f : []).map(([id, x, y, t, raio]) => {
        const f = feitMapa.get(id) || {}; Object.assign(f, { x: 18 - x, y: 30 - y, t, raio }); nf.set(id, f); return f;
      });
      feitMapa.clear(); nf.forEach((v, k) => feitMapa.set(k, v));
      if (Array.isArray(s.x)) {
        const agora = new Set();
        for (const [id, tc, x, y, r, azul] of s.x) {
          agora.add(id);
          if (efVistos.has(id) || !EFEITOS[tc]) continue;
          J.efeitos.push({ tipo: EFEITOS[tc], x: 18 - x, y: 30 - y, t: 0, max: DURACAO[tc], r, txt: '+1 👑', cor: azul ? COR_VERM : COR_AZUL }); // cores trocam de lado no espelho
        }
        efVistos = agora;
      }
      if ((s.est === 'fim' || s.est === 'acabou') && J.estado !== 'fim' && J.estado !== 'acabou') {
        $('camInicio').classList.remove('ativa');
        J.estado = 'jogando'; A.terminar();
      }
    }
    d.off.push(d.dr.onPeers(ch => {
      const p = ch.peers.find(x => x.peer === d.outro);
      if (p) { if (p.presence && p.presence.s) aplicar(p.presence.s); }
      else if (!on.esperando && !acabou && J.estado !== 'fim' && J.estado !== 'acabou') {
        acabou = true; A.aviso('Seu colega saiu da partida.');
        setTimeout(sairNoMeio, 1800);
      }
    }));
  }

  /* ================= PROFESSOR ================= */
  let salaProf = null, reenvio = null;
  $('btAbrirSala').onclick = async () => {
    const c = A.cfg;
    if (!c.mask) { $('avisoProf').textContent = 'Marque pelo menos um conteúdo antes de abrir a sala.'; return; }
    codigo = A.codificar(c);
    try { salaProf = await room.join('sala-' + codigo.toLowerCase()); }
    catch (e) { $('avisoProf').textContent = 'Não deu para abrir a sala agora. Tente de novo em instantes.'; return; }
    salaProf.presence({ papel: 'professor' }).catch(() => {});
    $('profCodigo').textContent = codigo;
    $('profConfig').textContent = A.descreverCfg(c);
    $('avisoProfSala').textContent = '';
    salaProf.onPeers(desenharSalaProf);
    A.mostrar('telaSalaProf');
    desenharSalaProf();
  };
  $('btFecharSala').onclick = async () => {
    clearInterval(reenvio);
    if (salaProf) { try { await salaProf.leave(); } catch (e) { /* já saiu */ } }
    salaProf = null; A.mostrar('telaProfessor');
  };
  function alunosNaSala() {
    return salaProf ? salaProf.peers().filter(p => p.presence.papel === 'aluno' && !p.isMe) : [];
  }
  function desenharSalaProf() {
    if (!salaProf) return;
    const alunos = alunosNaSala();
    const esperando = alunos.filter(p => p.presence.est === 'esperando');
    $('profEsperando').textContent = esperando.length
      ? `${esperando.length} ${esperando.length === 1 ? 'aluno esperando' : 'alunos esperando'}`
      : 'Ninguém esperando ainda';
    const tab = $('tabSala'); tab.innerHTML = '';
    if (!alunos.length) { const tr = tab.insertRow(); tr.insertCell().textContent = 'Nenhum aluno entrou ainda.'; return; }
    alunos.sort((a, b) => String(a.presence.nome).localeCompare(String(b.presence.nome)));
    for (const p of alunos) {
      const pr = p.presence, tr = tab.insertRow();
      tr.insertCell().textContent = typeof pr.nome === 'string' ? pr.nome.slice(0, 16) : '?';
      const st = tr.insertCell(), pill = document.createElement('span');
      pill.className = 'pill ' + (pr.est === 'jogando' ? 'jogando' : pr.est === 'fim' ? 'fim' : '');
      const vs = typeof pr.vs === 'string' ? pr.vs.slice(0, 16) : '';
      const cr = Array.isArray(pr.cr) ? `${pr.cr[0] | 0}×${pr.cr[1] | 0}` : '';
      if (pr.est === 'jogando') pill.textContent = `jogando contra ${vs}`;
      else if (pr.est === 'fim') {
        const v = pr.cr && pr.cr[0] > pr.cr[1], d = pr.cr && pr.cr[0] < pr.cr[1];
        pill.textContent = `${v ? 'venceu de' : d ? 'perdeu de' : 'empatou com'} ${vs} ${cr}`;
      }
      else pill.textContent = 'esperando';
      st.appendChild(pill);
      const ac = tr.insertCell();
      ac.textContent = typeof pr.ac === 'number' ? `${pr.ac | 0} ${(pr.ac | 0) === 1 ? 'certa' : 'certas'}` : '';
    }
  }
  $('btSortear').onclick = () => {
    if (!salaProf) return;
    const esp = alunosNaSala().filter(p => p.presence.est === 'esperando').map(p => p.peer);
    if (esp.length < 1) { $('avisoProfSala').textContent = 'Ainda não há alunos esperando.'; return; }
    for (let i = esp.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [esp[i], esp[j]] = [esp[j], esp[i]]; }
    const pares = []; for (let i = 0; i + 1 < esp.length; i += 2) pares.push([esp[i], esp[i + 1]]);
    const sos = esp.length % 2 ? [esp[esp.length - 1]] : [];
    const r = Math.floor(Date.now() / 1000) % 10000000;
    const msg = { r, p: pares, s: sos };
    $('avisoProfSala').textContent = '';
    let n = 0;
    const mandar = () => salaProf && salaProf.emit('duplas', msg).catch(e => {
      if (e && e.code === 'not_permitted') $('avisoProfSala').textContent = 'Só quem pode editar a página consegue sortear.';
    });
    mandar();
    clearInterval(reenvio);
    reenvio = setInterval(() => { if (++n > 6) clearInterval(reenvio); else mandar(); }, 2500); // mensagens podem se perder: repete por 15 s
  };
})();
