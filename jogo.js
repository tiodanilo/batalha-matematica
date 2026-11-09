/* Arena do Caderno — motor do jogo (parte 1). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const TEMAS = Perguntas.TEMAS;
  const DURS = [2, 3, 4, 5];
  const BOTS = [{ nome: 'Fácil', taxa: 0.30 }, { nome: 'Médio', taxa: 0.42 }, { nome: 'Difícil', taxa: 0.58 }];
  // Ritmo da batalha: quanto a luta anda por segundo de relógio. O tempo da partida continua real.
  const RITMOS = [{ nome: 'Calmo', f: 0.55 }, { nome: 'Normal', f: 0.8 }, { nome: 'Rápido', f: 1 }];
  const ENERGIA_BASE = 0.25;     // por segundo, para o aluno (o resto vem das respostas)
  const ENERGIA_ACERTO = 2, ENERGIA_BONUS = 1;
  const ALF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  /* ---------------- Código da turma ---------------- */
  // Código de 6 letras/números: conteúdos (16 bits), ano, duração, robô e ritmo (2 bits cada) + 6 bits de conferência.
  const conf6 = n => (((n & 255) * 3 + ((n >> 8) & 255) * 5 + ((n >> 16) & 255) * 7) + (n % 61)) % 64;
  function codificar(c) {
    const n = c.mask + (c.ano - 6) * 65536 + c.dur * 262144 + c.bot * 1048576 + (c.ritmo || 0) * 4194304; // < 2^24
    const v = n + conf6(n) * 16777216; // 2^24
    let s = '';
    for (let i = 5; i >= 0; i--) s += ALF[Math.floor(v / 32 ** i) % 32];
    return s;
  }
  function decodificar(s) {
    s = (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s.length !== 5 && s.length !== 6) return null;
    let v = 0;
    for (const ch of s) { const k = ALF.indexOf(ch); if (k < 0) return null; v = v * 32 + k; }
    let c;
    if (s.length === 6) {
      const n = v % 16777216;
      if (conf6(n) !== Math.floor(v / 16777216)) return null;
      c = { mask: n & 65535, ano: ((n >> 16) & 3) + 6, dur: (n >> 18) & 3, bot: (n >> 20) & 3, ritmo: (n >> 22) & 3 };
    } else { // códigos antigos, de 5 letras (sem ritmo): valem como "Calmo"
      const chk = Math.floor(v / 4194304), n = v % 4194304;
      if (((n & 255) + ((n >> 8) & 255) + ((n >> 16) & 255)) % 8 !== chk) return null;
      c = { mask: n & 65535, ano: ((n >> 16) & 3) + 6, dur: (n >> 18) & 3, bot: (n >> 20) & 3, ritmo: 0 };
    }
    if (!c.mask || c.bot > 2 || c.ritmo > 2) return null;
    return c;
  }
  const guardar = {
    ler(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } },
  };
  const temasDe = mask => TEMAS.filter((t, i) => mask & (1 << i)).map(t => t.id);
  const nomeTema = id => (TEMAS.find(t => t.id === id) || {}).nome || id;
  let cfg = guardar.ler('arena-cfg');
  if (!cfg || !cfg.mask || cfg.ano < 6 || cfg.ano > 9) cfg = { mask: 0b11111, ano: 7, dur: 1, bot: 1, ritmo: 0 };
  if (!(cfg.ritmo >= 0 && cfg.ritmo <= 2)) cfg.ritmo = 0;

  /* ---------------- Cartas ---------------- */
  const CARTAS = {
    guerreiro: { nome: 'Guerreiro', icone: '⚔️', custo: 3, n: 1, hp: 750, dmg: 95, hit: 1.1, range: 0.6, speed: 1.0, radius: 0.5, desc: 'Espada e escudo. Luta de perto, resistente e barato.' },
    besteiros: { nome: 'Besteiros', icone: '🏹', custo: 3, n: 2, hp: 260, dmg: 55, hit: 1.0, range: 5, speed: 1.0, radius: 0.42, proj: true, desc: 'Dois atiradores que acertam de longe.' },
    golem: { nome: 'Golem de Pedra', icone: '🗿', custo: 5, n: 1, hp: 2600, dmg: 150, hit: 1.5, range: 0.8, speed: 0.6, radius: 0.75, alvo: 'predios', desc: 'Muito forte e lento. Só ataca torres.' },
    lanceiros: { nome: 'Lanceiros', icone: '🔱', custo: 2, n: 4, hp: 90, dmg: 45, hit: 0.9, range: 0.5, speed: 1.6, radius: 0.32, desc: 'Quatro soldados rápidos e frágeis.' },
    feiticeira: { nome: 'Feiticeira', icone: '🔮', custo: 4, n: 1, hp: 480, dmg: 120, hit: 1.4, range: 5, speed: 1.0, radius: 0.48, proj: true, splash: 1.5, desc: 'Ataca de longe e acerta um grupo.' },
    cavaleiro: { nome: 'Cavaleiro', icone: '🐎', custo: 4, n: 1, hp: 1150, dmg: 130, hit: 1.2, range: 0.7, speed: 1.35, radius: 0.6, desc: 'Montado a cavalo: rápido e resistente.' },
    balista: { nome: 'Balista', icone: '🎯', custo: 3, tipo: 'predio', hp: 900, dmg: 70, hit: 0.8, range: 5.5, vida: 30, radius: 0.8, desc: 'Defesa fixa. Dura 30 segundos.' },
    trovao: { nome: 'Trovão', icone: '⚡', custo: 4, tipo: 'feitico', dmg: 350, raio: 2.5, desc: 'Raio que atinge tudo numa área. Pode ir em qualquer lugar.' },
    bombardeiro: { nome: 'Bombardeiro', icone: '💣', custo: 3, n: 1, hp: 340, dmg: 100, hit: 1.6, range: 3.8, speed: 1.0, radius: 0.45, proj: true, splash: 2.0, desc: 'Joga bombas de perto que acertam um grupo.' },
    curandeira: { nome: 'Curandeira', icone: '💚', custo: 4, n: 1, hp: 520, dmg: 35, hit: 1.2, range: 3, speed: 1.0, radius: 0.48, proj: true, cura: 70, raioCura: 3, ritmoCura: 1.5, desc: 'Cura os guerreiros do seu lado que estão perto dela.' },
    flechas: { nome: 'Chuva de Flechas', icone: '☔', custo: 3, tipo: 'feitico', dmg: 170, raio: 3.5, desc: 'Muitas flechas numa área grande. Ótima contra grupos.' },
    barricada: { nome: 'Barricada', icone: '🪵', custo: 2, tipo: 'predio', hp: 1500, dmg: 0, hit: 1, range: 0, vida: 35, radius: 1.0, desc: 'Muro de madeira que atrai os inimigos. Não ataca.' },
  };
  // A ORDEM desta lista não pode mudar: o duelo manda o número de cada carta.
  const BARALHO = Object.keys(CARTAS);
  BARALHO.forEach(k => (CARTAS[k].key = k));
  const BARALHO_PADRAO = ['guerreiro', 'besteiros', 'golem', 'lanceiros', 'feiticeira', 'cavaleiro', 'balista', 'trovao'];
  const baralhoValido = b => Array.isArray(b) && b.length === 8 && new Set(b).size === 8 && b.every(k => CARTAS[k]);
  Progresso.iniciar(CARTAS, BARALHO, BARALHO_PADRAO); // moedas, baús e níveis de cada aluno
  // Cartas criadas na Oficina: viram cartas de verdade (com o desenho do guerreiro base)
  function registrarCriadas() {
    Progresso.SLOTS.forEach(s => delete CARTAS[s]);
    for (const [slot, spec] of Object.entries(Progresso.criadas())) {
      const b = CARTAS[spec.base], c = Progresso.calcular(spec);
      CARTAS[slot] = Object.assign({}, b, { key: slot, modelo: spec.base, nome: spec.nome, custo: c.custo, hp: c.hp, dmg: c.dmg,
        speed: c.speed, criada: true, desc: `Criada por você (base: ${b.nome}).` });
    }
  }
  registrarCriadas();
  // no duelo valem só as 12 oficiais: as criadas dão lugar a cartas oficiais
  const baralhoOficial = b => {
    const out = b.filter(k => BARALHO.includes(k));
    for (const k of BARALHO_PADRAO.concat(BARALHO)) if (out.length < 8 && !out.includes(k)) out.push(k);
    return out;
  };
  let baralhoAluno = Progresso.baralho();
  if (!baralhoValido(baralhoAluno)) baralhoAluno = BARALHO_PADRAO.slice();
  const baralhoRobo = () => BARALHO.slice().sort(() => Math.random() - 0.5).slice(0, 8);

  /* Desenho 3D, se o aparelho suportar; senão, o desenho 2D abaixo. */
  const R3 = window.Render3D && window.Render3D.iniciar(document.getElementById('arena3d')) ? window.Render3D : null;
  if (!R3) document.getElementById('arena3d').style.display = 'none';
  else document.getElementById('arena').style.display = 'none';
  const VIT = R3 ? R3.vitrine(document.getElementById('vitrine3d')) : null; // batalha de fundo da tela de início
  if (VIT) VIT.ligar();
  const arte = k => {
    const src = R3 && R3.retrato((CARTAS[k] && CARTAS[k].modelo) || k);
    return src ? `<img class="retrato" src="${src}" alt="">` : `<span class="ic">${CARTAS[k].icone}</span>`;
  };

  /* ---------------- Telas ---------------- */
  function mostrar(id) {
    document.querySelectorAll('.tela').forEach(t => t.classList.toggle('ativa', t.id === id));
    if (id === 'telaInicio') { $('btJogarLivre').querySelector('small').textContent = descreverCfg(cfg); if (window.Progresso && $('bausInicio')) try { atualizarInicio(); } catch (e) { /* antes de iniciar */ } }
    if (VIT) { if (id === 'telaInicio') VIT.ligar(); else VIT.desligar(); }
    if (id === 'telaJogo') requestAnimationFrame(ajustarCanvas);
  }
  function montarProfessor() {
    const lista = $('listaTemas'); lista.innerHTML = '';
    TEMAS.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'tema';
      b.innerHTML = `<span class="ic">${t.icone}</span><span>${t.nome}${t.desde ? `<small>a partir do ${t.desde}º ano</small>` : ''}</span>`;
      b.onclick = () => { cfg.mask ^= (1 << i); atualizarProf(); };
      lista.appendChild(b);
    });
    const seg = (el, itens, chave) => {
      $(el).innerHTML = '';
      itens.forEach(([rot, val]) => {
        const b = document.createElement('button'); b.textContent = rot; b.dataset.v = val;
        b.onclick = () => { cfg[chave] = val; atualizarProf(); };
        $(el).appendChild(b);
      });
    };
    seg('segAno', [['6º ano', 6], ['7º ano', 7], ['8º ano', 8], ['9º ano', 9]], 'ano');
    seg('segDur', DURS.map((d, i) => [d + ' min', i]), 'dur');
    seg('segBot', BOTS.map((b, i) => [b.nome, i]), 'bot');
    seg('segRitmo', RITMOS.map((r, i) => [r.nome, i]), 'ritmo');
    atualizarProf();
  }
  function atualizarProf() {
    [...$('listaTemas').children].forEach((b, i) => b.setAttribute('aria-pressed', !!(cfg.mask & (1 << i))));
    [['segAno', 'ano'], ['segDur', 'dur'], ['segBot', 'bot'], ['segRitmo', 'ritmo']].forEach(([el, k]) =>
      [...$(el).children].forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === cfg[k])));
    $('codigoGerado').textContent = cfg.mask ? codificar(cfg) : '—';
    $('avisoProf').textContent = cfg.mask ? '' : 'Marque pelo menos um conteúdo.';
    $('amostra').innerHTML = '';
    if (cfg.mask) guardar.gravar('arena-cfg', cfg);
  }
  function mostrarAmostra() {
    const temas = temasDe(cfg.mask); if (!temas.length) return;
    $('amostra').innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const q = Perguntas.gerar(temas, cfg.ano), li = document.createElement('li');
      li.innerHTML = `${q.texto} <span style="color:var(--tinta-2)">(${q.opcoes.join(' · ')})</span> → <b>${q.resposta}</b>`;
      $('amostra').appendChild(li);
    }
  }
  function descreverCfg(c) {
    return `${temasDe(c.mask).map(nomeTema).join(', ')} · ${c.ano}º ano · ${DURS[c.dur]} min · ritmo ${RITMOS[c.ritmo || 0].nome.toLowerCase()} · robô ${BOTS[c.bot].nome.toLowerCase()}`;
  }
  function montarGuia() {
    $('guiaCartas').innerHTML = BARALHO.map(k => { const c = CARTAS[k];
      return `<div class="cg">${arte(k)}<div><b>${c.nome}</b><span>${c.desc}</span></div><span class="custo">${c.custo}</span></div>`; }).join('');
  }

  /* ---------------- Estado da partida ---------------- */
  const W = 18, H = 30, RIO = 15, PONTES = [3.5, 14.5];
  const COR = ['#2f6fd6', '#d6453d'], COR_ESC = ['#1d4790', '#8f2620'];
  let J = null;

  function torre(team, x, y, rei) {
    return { kind: 'torre', team, x, y, rei, hp: rei ? 3000 : 1800, max: rei ? 3000 : 1800, dmg: rei ? 80 : 60,
      hit: rei ? 1.0 : 0.8, range: 7, radius: rei ? 1.5 : 1.1, cd: 0, ativo: !rei, alvo: null, flash: 0, proj: true };
  }
  function novaMao(lista) {
    const b = (baralhoValido(lista) ? lista : BARALHO_PADRAO).slice().sort(() => Math.random() - 0.5);
    return { mao: b.slice(0, 4), fila: b.slice(4) };
  }
  function novaPartida(c) {
    J = {
      cfg: c, temas: temasDe(c.mask), estado: 'contagem', contagem: 3.2,
      tempo: DURS[c.dur] * 60, en: [5, 5], coroas: [0, 0],
      ents: [torre(0, 3.5, 25.5), torre(0, 14.5, 25.5), torre(0, 9, 28.2, true),
        torre(1, 3.5, 4.5), torre(1, 14.5, 4.5), torre(1, 9, 1.8, true)],
      proj: [], feiticos: [], efeitos: [],
      maos: [novaMao(baralhoAluno), novaMao(baralhoRobo())], sel: null, mouse: null,
      ia: { t: 2 },
      q: null, travado: 0, seq: 0, certas: 0, erradas: 0, porTema: {}, erros: [],
      fimT: 0, vencedor: null, podeColocar,
    };
    // níveis das cartas: os do aluno; o robô joga com o nível médio do baralho do aluno
    const meus = Progresso.niveis();
    const media = Math.max(1, Math.round(baralhoAluno.reduce((t, k) => t + meus[k], 0) / 8));
    const doRobo = {}; BARALHO.forEach(k => (doRobo[k] = media));
    J.niveis = [meus, doRobo];
    if (R3) R3.limpar();
    $('camInicio').classList.add('ativa');
    $('camPausa').classList.remove('ativa');
    mostrar('telaJogo');
    renderMao();
    novaPergunta();
  }

  /* ---------------- Perguntas ---------------- */
  function novaPergunta() {
    const q = Perguntas.gerar(J.temas, J.cfg.ano);
    J.q = q; J.travado = 0;
    $('temaAtual').textContent = nomeTema(q.tema);
    $('txtPergunta').textContent = q.texto;
    $('retorno').textContent = ''; $('retorno').className = 'retorno';
    $('seq').textContent = J.seq >= 2 ? '🔥 ' + J.seq + ' seguidas' : '';
    const box = $('opcoes'); box.innerHTML = '';
    q.opcoes.forEach((o, i) => {
      const b = document.createElement('button'); b.textContent = o;
      b.onclick = () => responder(i, b);
      box.appendChild(b);
    });
  }
  function responder(i, botao) {
    if (!J || J.travado || J.estado === 'fim' || J.estado === 'pausa') return;
    const q = J.q, certa = q.opcoes[i] === q.resposta;
    const pt = J.porTema[q.tema] || (J.porTema[q.tema] = { c: 0, e: 0 });
    const botoes = [...$('opcoes').children];
    botoes.forEach(b => (b.disabled = true));
    if (certa) {
      J.certas++; pt.c++; J.seq++;
      let ganho = ENERGIA_ACERTO;
      if (J.seq % 3 === 0) ganho += ENERGIA_BONUS;
      if (J.online && J.online.aoAcertar) J.online.aoAcertar(ganho);
      else J.en[0] = Math.min(10, J.en[0] + ganho);
      botao.classList.add('certa');
      $('retorno').textContent = `Certo! +${ganho} ⚡`; $('retorno').className = 'retorno ok';
      J.travado = 1; setTimeout(() => J && J.q === q && novaPergunta(), 450);
    } else {
      J.erradas++; pt.e++; J.seq = 0;
      botao.classList.add('errada');
      botoes.forEach(b => { if (b.textContent === q.resposta) b.classList.add('certa'); });
      $('retorno').textContent = 'Ops! Veja a certa.'; $('retorno').className = 'retorno erro';
      J.erros.push({ texto: q.texto, certa: q.resposta, marcou: q.opcoes[i] });
      J.travado = 1; setTimeout(() => J && J.q === q && novaPergunta(), 2000);
    }
  }
  document.addEventListener('keydown', e => {
    if (!J || !$('telaJogo').classList.contains('ativa')) return;
    const k = '1234'.indexOf(e.key);
    if (k >= 0) { const b = $('opcoes').children[k]; if (b && !b.disabled) b.click(); }
    if (e.key === 'Escape') alternarPausa();
  });

  /* ---------------- Cartas na mão ---------------- */
  function renderMao() {
    const m = J.maos[0], box = $('mao'); box.innerHTML = '';
    m.mao.forEach((k, i) => {
      const c = CARTAS[k], b = document.createElement('button');
      b.className = 'carta' + (J.sel === i ? ' sel' : '');
      const nv = J.niveis ? J.niveis[0][k] : 1;
      b.innerHTML = `<span class="custo">${c.custo}</span>${nv > 1 ? `<span class="nv">Nv ${nv}</span>` : ''}${arte(k)}<span class="nm">${esc(c.nome)}</span>`;
      b.onclick = () => { J.sel = J.sel === i ? null : i; renderMao(); };
      box.appendChild(b);
    });
    $('proxima').innerHTML = arte(m.fila[0]);
  }
  function podeColocar(team, def, x, y) {
    if (x < 0.4 || x > W - 0.4 || y < 0.4 || y > H - 0.4) return false;
    if (def.tipo === 'feitico') return true;
    if (team === 0 ? y < 16.2 : y > 13.8) return false;
    for (const t of J.ents) if (t.kind === 'torre' && t.hp > 0 && Math.hypot(t.x - x, t.y - y) < t.radius + 0.5) return false;
    return true;
  }
  function jogar(team, idx, x, y) {
    const m = J.maos[team], k = m.mao[idx], def = CARTAS[k];
    if (J.en[team] < def.custo) return 'energia';
    if (!podeColocar(team, def, x, y)) return 'lugar';
    J.en[team] -= def.custo;
    const mult = Progresso.mult(J.niveis && J.niveis[team] ? J.niveis[team][k] : 1); // cada nível: +8% de vida e dano
    if (def.tipo === 'feitico') J.feiticos.push({ x, y, team, t: 0.7, raio: def.raio, dmg: def.dmg * mult, key: k });
    else if (def.tipo === 'predio') J.ents.push({ kind: 'pred', team, x, y, hp: def.hp * mult, max: def.hp * mult, dmg: def.dmg * mult, hit: def.hit,
      range: def.range, radius: def.radius, vida: def.vida, cd: 0, proj: true, icone: def.icone, spawn: 1, flash: 0, def });
    else {
      const offs = def.n === 1 ? [[0, 0]] : def.n === 2 ? [[-0.55, 0], [0.55, 0]] : [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]];
      offs.forEach(([dx, dy]) => J.ents.push({
        kind: 'unid', team, x: clamp(x + dx, 0.5, W - 0.5), y: y + dy, def, hp: def.hp * mult, max: def.hp * mult, dmg: def.dmg * mult, hit: def.hit,
        range: def.range, speed: def.speed, radius: def.radius, splash: def.splash || 0, proj: !!def.proj,
        soPredios: def.alvo === 'predios', visao: Math.max(5.5, def.range + 1.5), spawn: 1, cd: 0, alvo: null, retarget: 0,
        preso: false, flash: 0, icone: def.icone,
      }));
    }
    m.fila.push(k); m.mao[idx] = m.fila.shift();
    return 'ok';
  }

  /* ---------------- Simulação ---------------- */
  const vivo = e => e && e.hp > 0 && !(e.spawn > 0);
  function adquirir(u) {
    let melhor = null, bd = Infinity;
    for (const e of J.ents) {
      if (e.team === u.team || !vivo(e)) continue;
      if (u.soPredios && e.kind === 'unid') continue;
      const d = dist(u, e) - e.radius;
      if (e.kind === 'unid' && d > u.visao) continue;
      const nota = d <= u.visao ? d : d + 1000;
      if (nota < bd) { bd = nota; melhor = e; }
    }
    return melhor;
  }
  function mover(u, tx, ty, dt) {
    const su = u.y > RIO ? 1 : -1, st = ty > RIO ? 1 : -1;
    let gx = tx, gy = ty;
    if (su !== st) {
      const bx = Math.abs(u.x - PONTES[0]) < Math.abs(u.x - PONTES[1]) ? PONTES[0] : PONTES[1];
      if (Math.abs(u.x - bx) < 0.6 && Math.abs(u.y - RIO) < 1.3) { gx = bx; gy = RIO - su * 1.4; }
      else { gx = bx; gy = RIO + su * 1.2; }
    }
    const dx = gx - u.x, dy = gy - u.y, d = Math.hypot(dx, dy);
    if (d < 0.01) return;
    const passo = Math.min(d, u.speed * dt);
    u.x += dx / d * passo; u.y += dy / d * passo;
  }
  function ferir(e, qtd) {
    if (e.hp <= 0) return;
    e.hp -= qtd; e.flash = 0.12;
    if (e.kind === 'torre' && e.rei && !e.ativo) e.ativo = true;
    if (e.hp <= 0) morreu(e);
  }
  function morreu(e) {
    e.hp = 0;
    J.efeitos.push({ tipo: 'boom', x: e.x, y: e.y, t: 0, max: 0.5, r: e.radius * 2 });
    if (e.kind !== 'torre') return;
    const outro = 1 - e.team;
    if (e.rei) { J.coroas[outro] = 3; terminar(); return; }
    J.coroas[outro]++;
    J.efeitos.push({ tipo: 'txt', x: e.x, y: e.y, t: 0, max: 1.5, txt: '+1 👑', cor: COR[outro] });
    J.ents.forEach(t => { if (t.kind === 'torre' && t.rei && t.team === e.team) t.ativo = true; });
  }
  function atacar(a, alvo) {
    if (a.proj) J.proj.push({ x: a.x, y: a.y, alvo, tx: alvo.x, ty: alvo.y, dmg: a.dmg, splash: a.splash || 0, team: a.team, vel: 11,
      k: a.def ? a.def.key : a.kind }); // k: quem atirou (bomba, magia, flecha...), só para o desenho
    else { ferir(alvo, a.dmg); J.efeitos.push({ tipo: 'hit', x: (a.x + alvo.x) / 2, y: (a.y + alvo.y) / 2, t: 0, max: 0.18 }); }
  }
  function dano(team, x, y, alvo, qtd, splash) {
    if (splash) {
      for (const e of J.ents) if (e.team !== team && e.hp > 0 && Math.hypot(e.x - x, e.y - y) <= splash + e.radius) ferir(e, qtd);
      J.efeitos.push({ tipo: 'anel', x, y, t: 0, max: 0.3, r: splash, cor: '#9b6bff' });
    } else if (alvo && alvo.hp > 0) ferir(alvo, qtd);
  }
  function atualizarUnid(u, dt) {
    if (u.spawn > 0) { u.spawn -= dt; return; }
    if (u.def.cura) { // Curandeira: de tempos em tempos cura quem é do seu lado e está perto
      u.tcura = (u.tcura || 0) - dt;
      if (u.tcura <= 0) {
        u.tcura = u.def.ritmoCura;
        let curou = false;
        for (const e of J.ents) if (e.kind === 'unid' && e.team === u.team && e.hp > 0 && e.hp < e.max && dist(u, e) <= u.def.raioCura) {
          e.hp = Math.min(e.max, e.hp + u.def.cura); curou = true;
        }
        if (curou) J.efeitos.push({ tipo: 'cura', x: u.x, y: u.y, t: 0, max: 0.6, r: u.def.raioCura });
      }
    }
    u.cd = Math.max(0, u.cd - dt);
    u.retarget -= dt;
    if (!vivo(u.alvo) || (!u.preso && u.retarget <= 0)) { u.alvo = adquirir(u); u.retarget = 0.3; }
    const t = u.alvo; if (!t) return;
    const d = dist(u, t) - t.radius - u.radius;
    if (d <= u.range) {
      if (!u.preso) { u.preso = true; u.cd = Math.max(u.cd, u.hit * 0.4); }
      if (u.cd <= 0) { atacar(u, t); u.cd = u.hit; }
    } else { u.preso = false; mover(u, t.x, t.y, dt); }
  }
  function atualizarAtirador(t, dt) { // torres e Torre Ábaco
    if (t.hp <= 0) return;
    if (t.kind === 'pred') {
      if (t.spawn > 0) { t.spawn -= dt; return; }
      t.hp -= t.max / t.vida * dt; if (t.hp <= 0) { t.hp = 0; return; }
    }
    if (t.kind === 'torre' && !t.ativo) return;
    if (!t.dmg) return; // Barricada: só segura os inimigos
    t.cd = Math.max(0, t.cd - dt);
    const noAlcance = e => vivo(e) && e.team !== t.team && e.kind !== 'torre' && dist(t, e) - e.radius <= t.range;
    if (!noAlcance(t.alvo)) {
      t.alvo = null; let bd = Infinity;
      for (const e of J.ents) if (noAlcance(e)) { const d = dist(t, e); if (d < bd) { bd = d; t.alvo = e; } }
    }
    if (t.alvo && t.cd <= 0) { atacar(t, t.alvo); t.cd = t.hit; }
  }
  function separar() {
    const us = J.ents.filter(e => e.kind === 'unid' && e.hp > 0);
    for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
      const a = us[i], b = us[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = (a.radius + b.radius) * 0.9;
      if (d < min && d > 1e-4) {
        const ma = a.radius ** 2, mb = b.radius ** 2, p = (min - d), nx = dx / d, ny = dy / d;
        a.x -= nx * p * mb / (ma + mb); a.y -= ny * p * mb / (ma + mb);
        b.x += nx * p * ma / (ma + mb); b.y += ny * p * ma / (ma + mb);
      } else if (d <= 1e-4) { b.x += 0.05; }
    }
    const fixos = J.ents.filter(e => (e.kind === 'torre' || e.kind === 'pred') && e.hp > 0);
    for (const u of us) {
      for (const f of fixos) {
        const dx = u.x - f.x, dy = u.y - f.y, d = Math.hypot(dx, dy), min = u.radius + f.radius * 0.95;
        if (d < min && d > 1e-4) { u.x = f.x + dx / d * min; u.y = f.y + dy / d * min; }
      }
      u.x = clamp(u.x, 0.3, W - 0.3); u.y = clamp(u.y, 0.3, H - 0.3);
      if (Math.abs(u.y - RIO) < 0.75 && PONTES.every(bx => Math.abs(u.x - bx) > 1.0)) u.y = u.y < RIO ? RIO - 0.75 : RIO + 0.75;
    }
  }
  function ia(dt) {
    const A = J.ia; A.t -= dt; if (A.t > 0) return;
    A.t = rand(0.5, 1.0);
    const en = J.en[1], m = J.maos[1];
    const cartas = m.mao.map((k, i) => ({ k, i, c: CARTAS[k] }));
    const ameacas = J.ents.filter(e => e.team === 0 && e.kind === 'unid' && e.hp > 0 && e.y < 18);
    if (ameacas.length) {
      const bor = cartas.find(o => o.c.tipo === 'feitico');
      if (bor && en >= bor.c.custo) for (const a of ameacas) {
        const viz = ameacas.filter(b => dist(a, b) < 2.5).length;
        if (viz >= 3 || (viz >= 2 && Math.random() < 0.25)) { jogar(1, bor.i, a.x, a.y - 0.5); return; }
      }
      const alvo = ameacas.reduce((m2, e) => (e.y < m2.y ? e : m2));
      const ops = cartas.filter(o => o.c.tipo !== 'feitico' && o.k !== 'golem' && o.c.custo <= en);
      if (ops.length) {
        const o = pick(ops);
        const x = clamp(alvo.x + rand(-1, 1), 1, W - 1);
        const y = o.c.tipo === 'predio' ? clamp(alvo.y - 4, 7, 12) : clamp(alvo.y - 3, 2, 13.5);
        jogar(1, o.i, x, y);
      }
      return;
    }
    if (!(en >= 9.5 || (en >= 6 && Math.random() < 0.25))) return;
    const minhas = J.ents.filter(e => e.kind === 'torre' && e.team === 0 && !e.rei);
    const fraca = minhas.filter(t => t.hp > 0).sort((a, b) => a.hp - b.hp)[0];
    const lane = fraca && Math.random() < 0.7 ? fraca.x : pick(PONTES);
    const ops = cartas.filter(o => o.c.custo <= en);
    if (!ops.length) return;
    const o = pick(ops);
    if (o.c.tipo === 'feitico') {
      const alvoT = J.ents.filter(e => e.kind === 'torre' && e.team === 0 && e.hp > 0).sort((a, b) => a.hp - b.hp)[0];
      if (alvoT && en >= 9) jogar(1, o.i, alvoT.x, alvoT.y);
      return;
    }
    if (o.c.tipo === 'predio') { jogar(1, o.i, clamp(lane + (lane < 9 ? 2 : -2), 1, 17), 10); return; }
    jogar(1, o.i, clamp(lane + rand(-0.6, 0.6), 1, 17), o.k === 'golem' ? 12.5 : 9.5);
  }
  function atualizar(dtReal) {
    J.tempo -= dtReal;                                            // o relógio da partida anda no tempo real
    const dt = dtReal * (RITMOS[J.cfg.ritmo || 0] || RITMOS[0]).f; // a luta anda no ritmo escolhido
    const dobro = J.tempo <= 60 ? 2 : 1;
    J.en[0] = Math.min(10, J.en[0] + ENERGIA_BASE * dobro * dt);
    J.en[1] = Math.min(10, J.en[1] + (J.online && !J.online.robo ? ENERGIA_BASE : BOTS[J.cfg.bot].taxa) * dobro * dt);
    for (const e of J.ents) {
      e.flash = Math.max(0, e.flash - dt);
      if (e.kind === 'unid') { if (e.hp > 0) atualizarUnid(e, dt); }
      else atualizarAtirador(e, dt);
      if (J.estado === 'fim') return;
    }
    for (const p of J.proj) {
      if (p.alvo && p.alvo.hp > 0) { p.tx = p.alvo.x; p.ty = p.alvo.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), passo = p.vel * dt;
      if (d <= passo + 0.05) { p.fim = true; if (p.splash || (p.alvo && p.alvo.hp > 0)) dano(p.team, p.tx, p.ty, p.alvo, p.dmg, p.splash); }
      else { p.x += dx / d * passo; p.y += dy / d * passo; }
      if (J.estado === 'fim') return;
    }
    J.proj = J.proj.filter(p => !p.fim);
    for (const f of J.feiticos) {
      f.t -= dt;
      if (f.t <= 0) {
        f.fim = true;
        for (const e of J.ents) if (e.team !== f.team && e.hp > 0 && Math.hypot(e.x - f.x, e.y - f.y) <= f.raio + e.radius)
          ferir(e, e.kind === 'torre' ? f.dmg * 0.35 : f.dmg);
        J.efeitos.push({ tipo: f.key === 'flechas' ? 'flechas' : 'raio', x: f.x, y: f.y, t: 0, max: f.key === 'flechas' ? 0.6 : 0.45, r: f.raio, cor: '#ffe14d' });
        if (J.estado === 'fim') return;
      }
    }
    J.feiticos = J.feiticos.filter(f => !f.fim);
    separar();
    J.ents = J.ents.filter(e => e.kind === 'torre' || e.hp > 0);
    if (!J.online || J.online.robo) ia(dt);
    if (J.tempo <= 0) { J.tempo = 0; terminar(); }
  }
  function terminar() {
    if (J.estado === 'fim') return;
    J.estado = 'fim'; J.fimT = 1.6;
    J.vencedor = J.coroas[0] > J.coroas[1] ? 0 : J.coroas[1] > J.coroas[0] ? 1 : null;
    J.sel = null;
    if (J.online && J.online.aoTerminar) J.online.aoTerminar();
    const esta = J;
    setTimeout(() => { if (J === esta && J.estado === 'fim') { J.estado = 'acabou'; mostrarFim(); } }, 1600);
  }

  /* ---------------- Desenho ---------------- */
  const cv = $('arena'), ctx = cv.getContext('2d');
  let S = 20, fundo = null;
  const EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  function ajustarCanvas() {
    const area = $('areaArena');
    if (R3) { R3.redimensionar(area.clientWidth, area.clientHeight); return; }
    const aw = area.clientWidth - 8, ah = area.clientHeight - 8;
    if (aw <= 0 || ah <= 0) return;
    let h = ah, w = h * W / H;
    if (w > aw) { w = aw; h = w * H / W; }
    const dpr = window.devicePixelRatio || 1;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    S = cv.width / W;
    fundo = desenharFundo();
  }
  new ResizeObserver(() => { if ($('telaJogo').classList.contains('ativa')) ajustarCanvas(); }).observe($('areaArena'));
  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function desenharFundo() {
    const f = document.createElement('canvas'); f.width = cv.width; f.height = cv.height;
    const c = f.getContext('2d');
    c.fillStyle = '#fbe9e4'; c.fillRect(0, 0, f.width, RIO * S);
    c.fillStyle = '#e6effc'; c.fillRect(0, RIO * S, f.width, f.height);
    c.strokeStyle = 'rgba(80,110,170,.18)'; c.lineWidth = Math.max(1, S * 0.04);
    for (let i = 1; i < W; i++) { c.beginPath(); c.moveTo(i * S, 0); c.lineTo(i * S, f.height); c.stroke(); }
    for (let j = 1; j < H; j++) { c.beginPath(); c.moveTo(0, j * S); c.lineTo(f.width, j * S); c.stroke(); }
    // trilhas a lápis
    c.strokeStyle = 'rgba(60,60,60,.18)'; c.lineWidth = S * 0.9; c.lineCap = 'round';
    for (const bx of PONTES) {
      c.beginPath(); c.moveTo(bx * S, 4.5 * S); c.lineTo(bx * S, 25.5 * S); c.stroke();
    }
    c.beginPath(); c.moveTo(3.5 * S, 27.6 * S); c.lineTo(14.5 * S, 27.6 * S); c.stroke();
    c.beginPath(); c.moveTo(3.5 * S, 2.4 * S); c.lineTo(14.5 * S, 2.4 * S); c.stroke();
    // rio de tinta
    const ry = (RIO - 0.7) * S, rh = 1.4 * S;
    c.fillStyle = '#4a8fe0'; c.fillRect(0, ry, f.width, rh);
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = S * 0.08;
    for (let k = 0; k < 2; k++) {
      c.beginPath();
      for (let x = 0; x <= W; x += 0.25) { const y = ry + rh * (0.35 + 0.3 * k) + Math.sin(x * 1.6 + k * 2) * S * 0.1; x === 0 ? c.moveTo(x * S, y) : c.lineTo(x * S, y); }
      c.stroke();
    }
    // pontes de régua
    for (const bx of PONTES) {
      const x0 = (bx - 1.1) * S, y0 = (RIO - 1.1) * S, w = 2.2 * S, h = 2.2 * S;
      c.fillStyle = '#f2c94c'; rr(c, x0, y0, w, h, S * 0.2); c.fill();
      c.strokeStyle = '#a07c1a'; c.lineWidth = S * 0.08; c.stroke();
      c.strokeStyle = '#6b5410'; c.lineWidth = S * 0.05;
      for (let k = 1; k < 11; k++) { const yy = y0 + k * h / 11, len = k % 5 === 0 ? 0.6 : 0.3;
        c.beginPath(); c.moveTo(x0, yy); c.lineTo(x0 + len * S, yy); c.stroke(); }
    }
    // linha de cada lado (onde pode colocar)
    c.setLineDash([S * 0.3, S * 0.3]); c.strokeStyle = 'rgba(47,111,214,.35)'; c.lineWidth = S * 0.06;
    c.beginPath(); c.moveTo(0, 16.2 * S); c.lineTo(f.width, 16.2 * S); c.stroke(); c.setLineDash([]);
    return f;
  }
  function barra(x, y, w, frac, cor) {
    const h = Math.max(4, S * 0.22);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(ctx, x - w / 2 - 1, y - 1, w + 2, h + 2, h / 2); ctx.fill();
    ctx.fillStyle = cor; rr(ctx, x - w / 2, y, Math.max(h, w * clamp(frac, 0, 1)), h, h / 2); ctx.fill();
  }
  function texto(t, x, y, px, cor, peso, fonte) {
    ctx.font = `${peso || 800} ${px}px ${fonte || "'Baloo 2', system-ui, sans-serif"}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = cor; ctx.fillText(t, x, y);
  }
  function desenharTorre(t) {
    const px = t.x * S, py = t.y * S, r = t.radius * S;
    if (t.hp <= 0) {
      ctx.fillStyle = '#9a9488'; rr(ctx, px - r * 0.8, py - r * 0.6, r * 1.6, r * 1.2, r * 0.3); ctx.fill();
      texto('✖', px, py, r * 0.9, '#5c574d'); return;
    }
    ctx.fillStyle = 'rgba(0,0,0,.18)'; rr(ctx, px - r, py - r + S * 0.2, 2 * r, 2 * r, r * 0.35); ctx.fill();
    ctx.fillStyle = t.flash > 0 ? '#fff' : COR[t.team]; rr(ctx, px - r, py - r, 2 * r, 2 * r, r * 0.35); ctx.fill();
    ctx.lineWidth = S * 0.12; ctx.strokeStyle = COR_ESC[t.team]; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.22)'; rr(ctx, px - r * 0.68, py - r * 0.68, r * 1.36, r * 1.36, r * 0.25); ctx.fill();
    texto(t.rei ? 'π' : 'Σ', px, py + r * 0.05, r * 1.25, '#fff');
    if (t.rei && !t.ativo) texto('zz', px + r * 0.75, py - r * 0.8, r * 0.5, '#fff', 700);
    barra(px, py - r - S * 0.55, 2.4 * S, t.hp / t.max, t.team === 0 ? '#5aa2ff' : '#ff6b5e');
    texto(Math.ceil(t.hp), px, py - r - S * 0.95, S * 0.55, t.team === 0 ? '#1d4790' : '#8f2620', 800);
  }
  function desenharUnid(u) {
    const px = u.x * S, py = u.y * S, r = u.radius * S;
    ctx.globalAlpha = u.spawn > 0 ? 0.45 : 1;
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(px, py + r * 0.75, r, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = u.flash > 0 ? '#ffd6d6' : '#fffdf6'; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = Math.max(2, S * 0.14); ctx.strokeStyle = COR[u.team]; ctx.stroke();
    texto(u.icone, px, py + r * 0.05, r * 1.25, '#000', 400, EMOJI);
    ctx.globalAlpha = 1;
    if (u.spawn > 0) {
      ctx.strokeStyle = COR[u.team]; ctx.lineWidth = S * 0.1; ctx.beginPath();
      ctx.arc(px, py, r + S * 0.25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - u.spawn)); ctx.stroke();
    } else if (u.hp < u.max) barra(px, py - r - S * 0.35, Math.max(r * 2, S * 0.9), u.hp / u.max, u.team === 0 ? '#5aa2ff' : '#ff6b5e');
  }
  function desenharPredio(p) {
    const px = p.x * S, py = p.y * S, r = p.radius * S;
    ctx.globalAlpha = p.spawn > 0 ? 0.45 : 1;
    ctx.fillStyle = p.flash > 0 ? '#ffd6d6' : '#fffdf6'; rr(ctx, px - r, py - r, 2 * r, 2 * r, r * 0.3); ctx.fill();
    ctx.lineWidth = Math.max(2, S * 0.14); ctx.strokeStyle = COR[p.team]; ctx.stroke();
    texto(p.icone, px, py, r * 1.2, '#000', 400, EMOJI);
    ctx.globalAlpha = 1;
    barra(px, py - r - S * 0.35, 2 * r, p.hp / p.max, p.team === 0 ? '#5aa2ff' : '#ff6b5e');
  }
  function desenhar(dt) {
    if (R3) { R3.desenhar(J, dt, J.sel !== null ? CARTAS[J.maos[0].mao[J.sel]] : null, J.mouse); return; }
    if (!fundo) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fundo, 0, 0);
    const def = J.sel !== null ? CARTAS[J.maos[0].mao[J.sel]] : null;
    if (def && def.tipo !== 'feitico') { // mostra onde não pode colocar
      ctx.fillStyle = 'rgba(214,69,61,.16)'; ctx.fillRect(0, 0, cv.width, 16.2 * S);
    }
    const ord = J.ents.slice().sort((a, b) => a.y - b.y);
    ord.filter(e => e.kind === 'torre' && e.hp <= 0).forEach(desenharTorre);
    for (const e of ord) {
      if (e.kind === 'torre') { if (e.hp > 0) desenharTorre(e); }
      else if (e.kind === 'pred') desenharPredio(e);
      else desenharUnid(e);
    }
    for (const p of J.proj) {
      ctx.fillStyle = p.splash ? '#9b6bff' : COR_ESC[p.team];
      ctx.beginPath(); ctx.arc(p.x * S, p.y * S, S * (p.splash ? 0.26 : 0.16), 0, Math.PI * 2); ctx.fill();
    }
    for (const f of J.feiticos) {
      ctx.setLineDash([S * 0.3, S * 0.2]); ctx.strokeStyle = '#e0457b'; ctx.lineWidth = S * 0.1;
      ctx.beginPath(); ctx.arc(f.x * S, f.y * S, f.raio * S, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      texto('⚡', f.x * S, (f.y - f.t * 4) * S, S * 1.2, '#000', 400, EMOJI);
    }
    for (const ef of J.efeitos) {
      ef.t += dt; const k = ef.t / ef.max;
      if (ef.tipo === 'boom' || ef.tipo === 'anel' || ef.tipo === 'raio' || ef.tipo === 'flechas' || ef.tipo === 'cura') {
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = ef.cor || '#ffb347'; ctx.lineWidth = S * 0.2;
        ctx.beginPath(); ctx.arc(ef.x * S, ef.y * S, Math.max(0.1, ef.r * S * (0.4 + 0.6 * k)), 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (ef.tipo === 'hit') {
        ctx.globalAlpha = 1 - k; texto('✦', ef.x * S, ef.y * S, S * 0.8, '#f5a623'); ctx.globalAlpha = 1;
      } else if (ef.tipo === 'txt') {
        ctx.globalAlpha = 1 - k * k; texto(ef.txt, ef.x * S, (ef.y - k * 2) * S, S * 0.9, ef.cor); ctx.globalAlpha = 1;
      }
    }
    J.efeitos = J.efeitos.filter(ef => ef.t < ef.max);
    if (def && J.mouse) { // prévia de onde a carta vai cair
      const ok = podeColocar(0, def, J.mouse.x, J.mouse.y);
      const r = (def.tipo === 'feitico' ? def.raio : (def.radius || 0.6) + 0.2) * S;
      ctx.globalAlpha = 0.55; ctx.fillStyle = ok ? '#ffffff' : '#ff6b5e';
      ctx.beginPath(); ctx.arc(J.mouse.x * S, J.mouse.y * S, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      if (ok) texto(def.icone, J.mouse.x * S, J.mouse.y * S, S * 0.9, '#000', 400, EMOJI);
    }
  }

  /* ---------------- Interface durante a partida ---------------- */
  let toastT = null;
  function aviso(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('v');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('v'), 1100);
  }
  function posCanvas(ev) {
    if (R3) return R3.escolher(ev.clientX, ev.clientY);
    const r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H };
  }
  const alvoToque = R3 ? $('arena3d') : cv;
  alvoToque.addEventListener('pointermove', ev => { if (J) J.mouse = posCanvas(ev); });
  alvoToque.addEventListener('pointerleave', () => { if (J) J.mouse = null; });
  alvoToque.addEventListener('pointerdown', ev => {
    if (!J || J.estado !== 'jogando') return;
    const p = posCanvas(ev);
    if (!p) return;
    if (J.sel === null) { aviso('Primeiro, escolha uma carta lá embaixo.'); return; }
    const r = J.online && J.online.aoJogar ? J.online.aoJogar(J.sel, p.x, p.y) : jogar(0, J.sel, p.x, p.y);
    if (r === 'energia') aviso('Falta energia! ⚡ Resolva as contas.');
    else if (r === 'lugar') aviso('Coloque a carta no seu lado (parte de baixo).');
    else { J.sel = null; J.mouse = ev.pointerType === 'mouse' ? p : null; renderMao(); }
  });
  function atualizarHud() {
    const s = Math.ceil(J.tempo);
    $('tempo').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    $('dobro').textContent = J.tempo <= 60 ? '⚡ energia em dobro' : '';
    $('crMeu').textContent = J.coroas[0]; $('crInim').textContent = J.coroas[1];
    $('enNum').textContent = Math.floor(J.en[0]);
    $('enBarra').style.width = (J.en[0] * 10) + '%';
    [...$('mao').children].forEach((b, i) => b.classList.toggle('cara', CARTAS[J.maos[0].mao[i]].custo > J.en[0]));
  }
  function alternarPausa() {
    if (!J) return;
    if (J.estado === 'jogando') { J.estado = 'pausa'; $('camPausa').classList.add('ativa'); }
    else if (J.estado === 'pausa') { J.estado = 'jogando'; $('camPausa').classList.remove('ativa'); }
  }
  function mostrarRecompensa() {
    if (!J.premio) {
      J.premio = Progresso.recompensar({ venceu: J.vencedor === 0, empate: J.vencedor === null, coroas: J.coroas[0], certas: J.certas, erradas: J.erradas });
      enviarRanking();
    }
    const p = J.premio, box = $('recompensas'), jog = Progresso.jogador;
    let html = `<div class="total">🪙 +${p.total} moedas <span style="font-size:18px;color:#2f6fd6">⭐ +${p.xpGanho} XP</span></div>` +
      (p.subiu ? `<div class="ganhou-bau">🎉 Você subiu para o nível ${p.subiu}!</div>` : '') +
      `<div style="font-size:14px">Nível ${jog.nivel}: ${jog.atual} de ${jog.falta} XP para o próximo</div><ul>` +
      p.det.filter(d => d[1] > 0).map(d => `<li>${d[0]}${d[2] ? ` (${d[2]})` : ''}: <b>+${d[1]}</b></li>`).join('') + '</ul>';
    if (p.bau) {
      html += `<div class="ganhou-bau"><span class="mini-bau t-${p.bau}"></span>Você ganhou um ${Progresso.BAUS[p.bau].nome} ${p.motivo}!` +
        `<button class="bj bj-azul" id="btAbrirBauFim">🎁 Abrir agora</button></div>`;
    } else if (p.cheio) {
      html += `<div class="ganhou-bau">🎁 Você ganharia um baú, mas seus ${Progresso.MAX_BAUS} lugares estão cheios. Abra um baú para liberar espaço.</div>`;
    } else {
      html += `<div style="font-size:14px">Dica: vença ou acerte 15 contas numa partida para ganhar um baú.</div>`;
    }
    box.innerHTML = html;
    const bt = $('btAbrirBauFim');
    if (bt) bt.onclick = () => {
      const i = Progresso.perfil.baus.length - 1;
      if (i >= 0) abrirBau(i, () => { bt.disabled = true; bt.textContent = 'Aberto ✓'; });
    };
  }
  function mostrarFim() {
    const v = J.vencedor;
    mostrarRecompensa();
    $('fimTitulo').textContent = v === 0 ? 'Vitória! 🏆' : v === 1 ? 'Derrota 😅' : 'Empate 🤝';
    $('fimMeu').textContent = J.coroas[0]; $('fimInim').textContent = J.coroas[1];
    $('fimNomeInim').textContent = J.nomeInim || 'Robô';
    $('btDeNovo').hidden = !!J.online; $('btVoltarSala').hidden = !J.online;
    const tot = J.certas + J.erradas;
    $('stCertas').textContent = J.certas; $('stErradas').textContent = J.erradas;
    $('stPct').textContent = tot ? Math.round(J.certas / tot * 100) + '%' : '—';
    $('tabTemas').innerHTML = Object.entries(J.porTema).map(([id, p]) =>
      `<tr><td>${nomeTema(id)}</td><td>${p.c} de ${p.c + p.e}</td></tr>`).join('') || '<tr><td>Nenhuma pergunta respondida.</td><td></td></tr>';
    const er = J.erros.slice(-10).reverse();
    $('tituloErros').style.display = er.length ? '' : 'none';
    $('listaErros').innerHTML = er.map(e =>
      `<li>${e.texto.replace('  →  x = ?', '')} → <span class="certa">${e.certa}</span> <span class="marcou">${e.marcou}</span></li>`).join('');
    mostrar('telaFim');
  }

  /* ---------------- Laço principal ---------------- */
  let ult = performance.now();
  function quadro(agora) {
    const dt = Math.min(0.05, (agora - ult) / 1000); ult = agora;
    if (J && $('telaJogo').classList.contains('ativa')) {
      const convidado = J.online && J.online.papel === 'convidado';
      if (convidado) J.online.quadro(dt); // quem é convidado só mostra o que o outro aparelho calcula
      if (J.estado === 'contagem') {
        if (J.online && J.online.esperando) $('contagem').textContent = '…';
        else {
          J.contagem -= dt;
          $('contagem').textContent = J.contagem > 0.2 ? Math.ceil(J.contagem - 0.2) : 'Já!';
          if (J.contagem <= 0 && !convidado) { J.estado = 'jogando'; $('camInicio').classList.remove('ativa'); }
        }
      } else if (J.estado === 'jogando' && !convidado) atualizar(dt);
      if (J.estado !== 'pausa') desenhar(J.estado === 'acabou' ? 0 : dt);
      atualizarHud();
    }
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);

  /* ---------------- Botões dos menus ---------------- */
  let cfgPartida = null;
  function iniciar(c) { cfgPartida = c; novaPartida(c); }

  /* Velocidade escolhida pelo aluno (contra o robô e no treino). No duelo vale a do professor. */
  let ritmoAluno = guardar.ler('arena-ritmo');
  if (![0, 1, 2].includes(ritmoAluno)) ritmoAluno = cfg.ritmo || 0;
  const ROTULO_RITMO = [['🐢 Calmo', 'mais tempo'], ['🚶 Normal', 'equilibrado'], ['🔥 Rápido', 'desafio']];
  function desenharRitmoAluno() {
    const box = $('segRitmoAluno'); box.innerHTML = '';
    ROTULO_RITMO.forEach(([nome, dica], i) => {
      const b = document.createElement('button');
      b.innerHTML = `${nome}<small>${dica}</small>`;
      b.setAttribute('aria-pressed', i === ritmoAluno);
      b.onclick = () => { ritmoAluno = i; guardar.gravar('arena-ritmo', i); desenharRitmoAluno(); };
      box.appendChild(b);
    });
  }
  desenharRitmoAluno();
  const comRitmoDoAluno = c => Object.assign({}, c, { ritmo: ritmoAluno });

  $('btEntrar').onclick = () => {
    const c = decodificar($('inCodigo').value);
    if (!c) { $('avisoCodigo').textContent = 'Código não encontrado. Confira com o professor.'; return; }
    $('avisoCodigo').textContent = '';
    iniciar(comRitmoDoAluno(c));
  };
  $('inCodigo').addEventListener('input', () => {
    const c = decodificar($('inCodigo').value);
    $('infoTurma').textContent = c ? descreverCfg(c).replace(/ · ritmo [^·]+/, '') : '';
    $('avisoCodigo').textContent = '';
    if (c) {
      ritmoAluno = c.ritmo || 0; desenharRitmoAluno(); // começa com a velocidade que o professor escolheu
      Progresso.turma = $('inCodigo').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); // para o ranking da turma
    }
  });
  $('inCodigo').addEventListener('keydown', e => { if (e.key === 'Enter') $('btEntrar').click(); });
  $('btJogarLivre').onclick = () => iniciar(comRitmoDoAluno(cfg));

  /* ---------- Início: quem está jogando, moedas e baús ---------- */
  function atualizarInicio() {
    $('nomePerfil').textContent = Progresso.nome;
    $('moedasInicio').textContent = Progresso.moedas;
    const jog = Progresso.jogador;
    $('nvJogador').textContent = 'Nv ' + jog.nivel;
    $('xpBarra').style.width = Math.round(jog.atual / jog.falta * 100) + '%';
    $('btPerfil').title = `Nível ${jog.nivel}: ${jog.atual} de ${jog.falta} XP para o próximo`;
    const box = $('bausInicio'); box.innerHTML = '';
    const baus = Progresso.perfil.baus;
    for (let i = 0; i < Progresso.MAX_BAUS; i++) {
      const b = document.createElement('button'), t = baus[i];
      b.className = 'vaga-bau' + (t ? ' cheia' : '');
      if (t) { b.innerHTML = `<span class="mini-bau t-${t}"></span>`; b.title = Progresso.BAUS[t].nome + ': toque para abrir'; b.onclick = () => abrirBau(i); }
      else { b.textContent = 'vazio'; b.disabled = true; }
      box.appendChild(b);
    }
  }

  /* ---------- Abrir baú (animação + prêmios) ---------- */
  function abrirBau(i, depois) {
    const tipo = Progresso.perfil.baus[i];
    if (!tipo) return;
    mostrarAbertura(tipo, () => Progresso.abrirBau(i), depois);
  }
  function mostrarAbertura(tipo, gerar, depois) { // gerar() entrega o prêmio só quando o aluno toca no baú
    const cam = $('camBau'), palco = cam.querySelector('.bau-palco');
    palco.className = 'bau-palco t-' + tipo;
    $('bauTitulo').textContent = Progresso.BAUS[tipo].nome;
    $('bauDica').textContent = 'Toque no baú para abrir!';
    $('bauPremios').innerHTML = ''; $('btBauOk').hidden = true;
    cam.hidden = false;
    let aberto = false;
    $('bauDesenho').onclick = () => {
      if (aberto) return; aberto = true;
      palco.classList.add('tremendo'); $('bauDica').textContent = '…';
      setTimeout(() => {
        palco.classList.remove('tremendo'); palco.classList.add('aberto');
        const r = gerar();
        $('bauDica').textContent = 'Você ganhou:';
        const itens = (r.moedas ? [`<div class="premio moedas"><span class="ic">🪙</span><b>Moedas</b><span class="qtd">+${r.moedas}</span></div>`] : [])
          .concat(r.cartas.map(({ k, q }) => {
            const c = Progresso.perfil.cartas[k], cu = Progresso.custo(c.n);
            const pct = cu ? Math.min(100, Math.round(c.c / cu.copias * 100)) : 100;
            return `<div class="premio">${arte(k)}<b>${CARTAS[k].nome}</b><span class="qtd">+${q}</span>` +
              `<div class="barra-copias"><i style="width:${pct}%"></i></div></div>`;
          }));
        const box = $('bauPremios');
        itens.forEach((h, j) => setTimeout(() => box.insertAdjacentHTML('beforeend', h), 250 + j * 380));
        setTimeout(() => { $('btBauOk').hidden = false; }, 300 + itens.length * 380);
      }, 900);
    };
    $('btBauOk').onclick = () => {
      cam.hidden = true; palco.classList.remove('aberto', 'tremendo');
      atualizarInicio(); if ($('telaCartas').classList.contains('ativa')) desenharBaralho();
      if ($('telaLoja').classList.contains('ativa')) desenharLoja();
      if (depois) depois();
    };
  }

  /* Meu baralho: o aluno escolhe 8 das 12 cartas e evolui as cartas */
  let escolha = [];
  const NOVAS = ['bombardeiro', 'curandeira', 'flechas', 'barricada'];
  const MSG_EVOLUIR = { copias: 'Faltam cartas repetidas: abra baús para conseguir mais.', moedas: 'Faltam moedas: jogue e acerte contas para ganhar mais.', max: 'Essa carta já está no nível máximo!' };
  function desenharBaralho() {
    $('moedasCartas').textContent = Progresso.moedas;
    const grade = $('gradeCartas'); grade.innerHTML = '';
    BARALHO.concat(Object.keys(Progresso.criadas())).forEach(k => {
      const c = CARTAS[k], b = document.createElement('button'), dentro = escolha.includes(k);
      if (!c) return;
      b.className = 'carta-esc'; b.setAttribute('aria-pressed', dentro);
      if (c.criada) { // carta da Oficina: sem níveis
        b.innerHTML = `<span class="custo">${c.custo}</span><span class="criada">CRIADA</span>` +
          `<span class="marca">${dentro ? '✅' : ''}</span>${arte(k)}<b>${esc(c.nome)}</b><span class="d">${esc(c.desc)}</span>`;
      } else {
        const pc = Progresso.perfil.cartas[k], cu = Progresso.custo(pc.n);
        const pct = cu ? Math.min(100, Math.round(pc.c / cu.copias * 100)) : 100;
        b.innerHTML = `<span class="custo">${c.custo}</span>${NOVAS.includes(k) ? '<span class="novo">NOVA</span>' : ''}` +
          `<span class="nivel">Nv ${pc.n}</span>` +
          `<span class="marca">${dentro ? '✅' : ''}</span>${arte(k)}<b>${c.nome}</b><span class="d">${c.desc}</span>` +
          `<span class="copias"><span class="barra-copias"><i style="width:${pct}%"></i></span>${cu ? `${pc.c}/${cu.copias}` : 'máx.'}</span>` +
          (cu ? `<span class="bt-evoluir" role="button" tabindex="0" data-k="${k}" aria-disabled="${!Progresso.podeEvoluir(k)}">⬆ Evoluir · 🪙${cu.moedas}</span>` : '');
      }
      const ev = b.querySelector('.bt-evoluir');
      if (ev) {
        if (!Progresso.podeEvoluir(k)) ev.style.cssText = 'background:#cfc3a3;border-color:#a99b74;color:#6f6448;text-shadow:none';
        ev.onclick = e => {
          e.stopPropagation();
          const r = Progresso.evoluir(k);
          if (r === 'ok') { $('dicaBaralho').innerHTML = `⬆️ <b>${c.nome}</b> subiu para o nível ${Progresso.nivel(k)}! Vida e dano maiores.`; desenharBaralho(true); }
          else $('dicaBaralho').textContent = MSG_EVOLUIR[r] || '';
        };
      }
      b.onclick = () => {
        if (dentro) escolha = escolha.filter(x => x !== k);
        else if (escolha.length < 8) escolha.push(k);
        else { $('dicaBaralho').textContent = 'Seu baralho já tem 8 cartas. Tire uma antes de colocar outra.'; return; }
        desenharBaralho();
      };
      grade.appendChild(b);
    });
    const n = escolha.length, media = n ? escolha.reduce((t, k) => t + CARTAS[k].custo, 0) / n : 0;
    $('contaBaralho').textContent = n + '/8'; $('contaBaralho').classList.toggle('ok', n === 8);
    if (arguments[0] !== true) $('dicaBaralho').innerHTML = n === 8
      ? `Baralho completo! Custo médio: <b>${media.toFixed(1).replace('.', ',')}</b> ⚡`
      : `Escolha mais <b>${8 - n}</b> ${8 - n === 1 ? 'carta' : 'cartas'}. Toque numa carta para colocar ou tirar.`;
    $('btSalvarBaralho').disabled = n !== 8; $('btSalvarBaralho').style.opacity = n === 8 ? 1 : 0.5;
  }
  $('btCartas').onclick = () => { escolha = baralhoAluno.slice(); desenharBaralho(); mostrar('telaCartas'); };
  $('btVoltarCartas').onclick = () => mostrar('telaInicio');
  $('btBaralhoPadrao').onclick = () => { escolha = BARALHO_PADRAO.slice(); desenharBaralho(); };
  $('btSalvarBaralho').onclick = () => {
    if (!baralhoValido(escolha)) return;
    baralhoAluno = escolha.slice(); Progresso.salvarBaralho(baralhoAluno);
    mostrar('telaInicio');
  };

  /* ---------- Quem está jogando (um progresso para cada aluno) ---------- */
  function desenharPerfis() {
    const box = $('listaPerfis'); box.innerHTML = '';
    Progresso.perfis().forEach(p => {
      const b = document.createElement('button');
      b.setAttribute('aria-pressed', p.nome === Progresso.nome);
      b.innerHTML = `<b></b><small>🪙 ${p.moedas} · ${p.stats.vitorias} ${p.stats.vitorias === 1 ? 'vitória' : 'vitórias'}</small>`;
      b.querySelector('b').textContent = p.nome; // nome digitado pelo aluno: sempre como texto
      b.onclick = () => { Progresso.trocar(p.nome); trocouPerfil(); mostrar('telaInicio'); };
      box.appendChild(b);
    });
  }
  function trocouPerfil() {
    registrarCriadas();
    baralhoAluno = Progresso.baralho();
    if (!baralhoValido(baralhoAluno)) baralhoAluno = BARALHO_PADRAO.slice();
    atualizarInicio();
  }
  $('btPerfil').onclick = () => { $('avisoPerfil').textContent = ''; $('avisoArquivo').textContent = ''; desenharPerfis(); mostrar('telaPerfil'); };
  $('btVoltarPerfil').onclick = () => mostrar('telaInicio');
  $('btCriarPerfil').onclick = () => {
    const nome = $('inNovoPerfil').value;
    // o primeiro aluno do computador "assume" o perfil inicial (com o que já ganhou)
    const r = Progresso.nome === 'Jogador' && Progresso.perfis().length === 1 && Progresso.renomearPadrao(nome) ? 'ok' : Progresso.criar(nome);
    if (r === 'vazio') { $('avisoPerfil').textContent = 'Escreva seu nome.'; return; }
    $('inNovoPerfil').value = '';
    trocouPerfil(); mostrar('telaInicio');
  };
  $('inNovoPerfil').addEventListener('keydown', e => { if (e.key === 'Enter') $('btCriarPerfil').click(); });
  $('btSalvarArquivo').onclick = async () => {
    const nome = 'batalha-matematica-' + Progresso.nome.normalize('NFD').replace(/[^\w-]+/g, '-').toLowerCase() + '.json';
    const dados = Progresso.exportar();
    try {
      const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
      if (dl) { await dl.save({ filename: nome, data: dados }); $('avisoArquivo').textContent = 'Arquivo salvo! Guarde-o num pendrive ou no seu e-mail.'; return; }
    } catch (e) { if (e && e.code === 'declined') { $('avisoArquivo').textContent = 'Você cancelou o salvamento.'; return; } }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([dados], { type: 'application/json' })); a.download = nome;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    $('avisoArquivo').textContent = `Arquivo "${nome}" salvo na pasta Downloads. Leve-o para o outro computador.`;
  };
  $('btAbrirArquivo').onclick = () => $('inArquivo').click();
  $('inArquivo').onchange = async () => {
    const f = $('inArquivo').files[0]; if (!f) return;
    const r = Progresso.importar(await f.text());
    $('inArquivo').value = '';
    if (r === 'ok') { trocouPerfil(); desenharPerfis(); $('avisoArquivo').textContent = `Progresso de ${Progresso.nome} carregado!`; }
    else $('avisoArquivo').textContent = r === 'semEspaco' ? 'Carreguei, mas este navegador não deixou guardar.' : 'Esse arquivo não é um progresso da Batalha Matemática.';
  };

  /* ---------- Loja ---------- */
  function desenharLoja() {
    $('moedasLoja').textContent = Progresso.moedas;
    const grade = $('gradeLoja'); grade.innerHTML = '';
    Progresso.LOJA.forEach(item => {
      const d = document.createElement('div'), pode = Progresso.moedas >= item.preco;
      d.className = 'item-loja';
      d.innerHTML = `<div class="vitrine-bau">${item.id === 'pacote' ? '<div class="pacote">🃏</div>' : `<span class="mini-bau t-${item.id}"></span>`}</div>` +
        `<b>${Progresso.BAUS[item.id].nome}</b><span>${item.desc}</span>` +
        `<button class="bj ${pode ? 'bj-azul' : 'bj-verm'}" ${pode ? '' : 'disabled'}>🪙 ${item.preco}</button>`;
      d.querySelector('button').onclick = () => {
        if (Progresso.moedas < item.preco) return;
        mostrarAbertura(item.id, () => Progresso.comprar(item.id), desenharLoja);
      };
      grade.appendChild(d);
    });
    const falta = Math.min(...Progresso.LOJA.map(i => i.preco)) - Progresso.moedas;
    $('dicaLoja').textContent = falta > 0
      ? `Faltam ${falta} moedas para o item mais barato. Cada conta certa vale 2 moedas!`
      : 'Troque suas moedas por cartas. Quanto mais contas certas, mais moedas você ganha!';
  }
  $('btLoja').onclick = () => { desenharLoja(); mostrar('telaLoja'); };
  $('btVoltarLoja').onclick = () => mostrar('telaInicio');

  /* ---------- Ranking (online, pelo Firebase do site) ---------- */
  const noClaude = !!(window.claude && window.claude.use);
  function enviarRanking() {
    if (noClaude || !window.SalaFirebase || !SalaFirebase.ranking || Progresso.nome === 'Jogador') return Promise.resolve();
    const nomes = ['ranking-geral'];
    if (Progresso.turma) nomes.push('ranking-turma-' + Progresso.turma);
    return SalaFirebase.ranking.enviar(nomes, Progresso.perfil.id, Progresso.dadosRanking()).catch(() => {});
  }
  let abaRk = 'turma', ordemRk = 'v';
  const ORDENS = [['v', '🏆 Vitórias'], ['moedas', '🪙 Moedas'], ['partidas', '🎮 Partidas'], ['acertos', '✅ Acertos'], ['nivel', '⭐ Nível']];
  const pctAcerto = j => (j.acertos + j.erradas ? Math.round(j.acertos / (j.acertos + j.erradas) * 100) : 0);
  function desenharControlesRk() {
    const abas = $('abasRanking'); abas.innerHTML = '';
    [['turma', 'Minha turma' + (Progresso.turma ? ` (${Progresso.turma})` : '')], ['geral', 'Geral']].forEach(([id, rot]) => {
      const b = document.createElement('button'); b.textContent = rot; b.setAttribute('aria-pressed', abaRk === id);
      b.onclick = () => { abaRk = id; desenharControlesRk(); carregarRk(); };
      abas.appendChild(b);
    });
    const ord = $('ordemRanking'); ord.innerHTML = '';
    ORDENS.forEach(([id, rot]) => {
      const b = document.createElement('button'); b.textContent = rot; b.setAttribute('aria-pressed', ordemRk === id);
      b.onclick = () => { ordemRk = id; desenharControlesRk(); desenharRk(); };
      ord.appendChild(b);
    });
  }
  let dadosRk = [];
  async function carregarRk() {
    const lista = $('listaRanking'); lista.innerHTML = ''; dadosRk = [];
    if (noClaude || !window.SalaFirebase || !SalaFirebase.ranking) { $('dicaRanking').textContent = 'O ranking funciona no site: tiodanilo.github.io/batalha-matematica'; return; }
    if (abaRk === 'turma' && !Progresso.turma) { $('dicaRanking').textContent = 'Digite o código da turma na tela de início para ver o ranking da sua turma.'; return; }
    $('dicaRanking').textContent = 'Carregando…';
    const aba = abaRk;
    try {
      await enviarRanking();
      const dados = await SalaFirebase.ranking.ler(aba === 'turma' ? 'ranking-turma-' + Progresso.turma : 'ranking-geral');
      if (aba !== abaRk) return;
      dadosRk = dados; desenharRk();
    } catch (e) { $('dicaRanking').textContent = 'Não consegui carregar o ranking agora. Confira a internet e tente de novo.'; }
  }
  function desenharRk() {
    const lista = $('listaRanking'); lista.innerHTML = '';
    if (!dadosRk.length) { $('dicaRanking').textContent = 'Ninguém no ranking ainda. Jogue uma partida para aparecer!'; return; }
    const val = j => (ordemRk === 'v' ? j.v * 1e6 + j.e * 1e3 - j.d : j[ordemRk]);
    const ord = dadosRk.slice().sort((a, b) => val(b) - val(a));
    const euId = Progresso.perfil.id, minhaPos = ord.findIndex(j => j.id === euId);
    $('dicaRanking').textContent = (Progresso.nome === 'Jogador' ? 'Toque em 👤 e escreva seu nome para entrar no ranking. ' : '') +
      (minhaPos >= 0 ? `Você está em ${minhaPos + 1}º lugar de ${ord.length}.` : `${ord.length} ${ord.length === 1 ? 'jogador' : 'jogadores'}.`);
    const mostrarJ = ord.slice(0, 50);
    if (minhaPos >= 50) mostrarJ.push(ord[minhaPos]);
    mostrarJ.forEach(j => {
      const pos = ord.indexOf(j) + 1, li = document.createElement('li');
      if (j.id === euId) li.className = 'eu';
      const principal = ordemRk === 'v' ? [j.v, 'vitórias'] : ordemRk === 'acertos' ? [j.acertos, `${pctAcerto(j)}% de acerto`]
        : ordemRk === 'nivel' ? ['Nv ' + j.nivel, ''] : [j[ordemRk], ordemRk === 'moedas' ? 'moedas' : 'partidas'];
      li.innerHTML = `<span class="pos">${pos}º</span><span class="quem"><b></b><small>V ${j.v} · E ${j.e} · D ${j.d} · ${pctAcerto(j)}% de acerto · Nv ${j.nivel}</small></span>` +
        `<span class="valor">${principal[0]}<small>${principal[1]}</small></span>`;
      li.querySelector('b').textContent = j.nome; // nome digitado pelo aluno: sempre como texto
      lista.appendChild(li);
    });
  }
  $('btRanking').onclick = () => { abaRk = Progresso.turma ? 'turma' : 'geral'; desenharControlesRk(); mostrar('telaRanking'); carregarRk(); };
  $('btVoltarRanking').onclick = () => mostrar('telaInicio');

  /* ---------- Oficina: o aluno cria a própria carta ---------- */
  let slotOf = 'meu1', spec = null;
  const fmtN = n => String(Math.round(n * 100) / 100).replace('.', ',');
  function carregarSlot() {
    const cr = Progresso.criadas()[slotOf];
    spec = cr ? Object.assign({}, cr) : { base: 'guerreiro', nome: '', vida: 5, dano: 5, vel: 5 };
    $('avisoOficina').textContent = '';
    desenharOficina();
  }
  function desenharOficina() {
    const slots = $('slotsOficina'); slots.innerHTML = '';
    Progresso.SLOTS.forEach((s, i) => {
      const cr = Progresso.criadas()[s], b = document.createElement('button');
      b.innerHTML = `Carta ${i + 1}<small></small>`; b.querySelector('small').textContent = cr ? cr.nome : 'vazia';
      b.setAttribute('aria-pressed', s === slotOf);
      b.onclick = () => { slotOf = s; carregarSlot(); };
      slots.appendChild(b);
    });
    const bases = $('basesOficina'); bases.innerHTML = '';
    Progresso.BASES.forEach(k => {
      const b = document.createElement('button');
      b.innerHTML = `${arte(k)}${CARTAS[k].nome.split(' ')[0]}`;
      b.setAttribute('aria-pressed', spec.base === k); b.title = CARTAS[k].nome + ': ' + CARTAS[k].desc;
      b.onclick = () => { spec.base = k; desenharOficina(); };
      bases.appendChild(b);
    });
    $('inNomeCarta').value = spec.nome;
    $('pontosMax').textContent = Progresso.PONTOS_MAX;
    const sl = $('slidersOficina'); sl.innerHTML = '';
    [['vida', '❤️ Vida'], ['dano', '⚔️ Dano'], ['vel', '💨 Velocidade']].forEach(([k, rot]) => {
      const d = document.createElement('label'); d.className = 'slider-linha';
      d.innerHTML = `<span>${rot}</span><input type="range" min="1" max="10" step="1" value="${spec[k]}"><output>${spec[k]}</output>`;
      const inp = d.querySelector('input');
      inp.oninput = () => { spec[k] = +inp.value; d.querySelector('output').textContent = inp.value; atualizarPrevia(); };
      sl.appendChild(d);
    });
    atualizarPrevia();
  }
  function atualizarPrevia() {
    const b = CARTAS[spec.base], c = Progresso.calcular(spec), max = Progresso.PONTOS_MAX;
    const pu = $('pontosUsados');
    pu.textContent = c.soma > max ? `Pontos usados: ${c.soma} de ${max}. Tire ${c.soma - max} para poder salvar.` : `Pontos usados: ${c.soma} de ${max}`;
    pu.classList.toggle('estourou', c.soma > max);
    const nome = $('inNomeCarta').value.trim() || 'Minha carta';
    $('previaCarta').innerHTML = `<span class="custo">${c.custo}</span>${arte(spec.base)}<div><b></b>` +
      `<table><tr><td>❤️ Vida</td><td>${c.hp}</td></tr><tr><td>⚔️ Dano</td><td>${c.dmg}</td></tr>` +
      `<tr><td>💨 Velocidade</td><td>${fmtN(c.speed)}</td></tr><tr><td>⚡ Custo</td><td>${c.custo}</td></tr></table></div>`;
    $('previaCarta').querySelector('b').textContent = nome;
    $('formulaCusto').innerHTML =
      `<div><b>Custo</b> = custo do ${b.nome} × (Vida + Dano + Velocidade) ÷ 15</div>` +
      `<div>= ${b.custo} × (${spec.vida} + ${spec.dano} + ${spec.vel}) ÷ 15 = ${b.custo} × ${c.soma} ÷ 15 = ${fmtN(c.exato)}` +
      ` → arredondando: <b>${c.custo}</b> ⚡${c.custo !== Math.round(c.exato) ? ' (o custo fica entre 1 e 9)' : ''}</div>` +
      `<div style="margin-top:4px">❤️ Vida = ${b.hp} × ${spec.vida} ÷ 5 = ${c.hp} &nbsp;·&nbsp; ⚔️ Dano = ${b.dmg} × ${spec.dano} ÷ 5 = ${c.dmg}</div>`;
  }
  $('inNomeCarta').addEventListener('input', () => { spec.nome = $('inNomeCarta').value; atualizarPrevia(); });
  $('btSalvarCarta').onclick = () => {
    spec.nome = $('inNomeCarta').value.trim();
    if (!spec.nome) { $('avisoOficina').textContent = 'Dê um nome para a sua carta.'; return; }
    if (spec.vida + spec.dano + spec.vel > Progresso.PONTOS_MAX) { $('avisoOficina').textContent = `Use no máximo ${Progresso.PONTOS_MAX} pontos.`; return; }
    Progresso.salvarCriada(slotOf, spec); registrarCriadas();
    $('avisoOficina').textContent = '✅ Carta salva! Coloque-a no seu baralho em 🃏 Baralho (vale contra o robô e no treino).';
    desenharOficina();
  };
  $('btApagarCarta').onclick = () => {
    if (!Progresso.criadas()[slotOf]) { carregarSlot(); return; }
    Progresso.apagarCriada(slotOf); registrarCriadas();
    baralhoAluno = Progresso.baralho(); if (!baralhoValido(baralhoAluno)) baralhoAluno = BARALHO_PADRAO.slice();
    carregarSlot(); $('avisoOficina').textContent = 'Carta apagada.';
  };
  $('btOficina').onclick = () => { slotOf = 'meu1'; carregarSlot(); mostrar('telaOficina'); };
  $('btVoltarOficina').onclick = () => mostrar('telaInicio');
  atualizarInicio();
  $('btProfessor').onclick = () => { montarProfessor(); mostrar('telaProfessor'); };
  $('btComo').onclick = () => mostrar('telaComo');
  $('btVoltarProf').onclick = $('btVoltarComo').onclick = () => mostrar('telaInicio');
  $('btTodos').onclick = () => { cfg.mask = 65535; atualizarProf(); };
  $('btNenhum').onclick = () => { cfg.mask = 0; atualizarProf(); };
  $('btAmostra').onclick = mostrarAmostra;
  $('btTestar').onclick = () => { if (cfg.mask) iniciar(Object.assign({}, cfg)); };
  $('btPausa').onclick = alternarPausa;
  $('btContinuar').onclick = alternarPausa;
  $('btDesistir').onclick = () => {
    if (J && J.online && J.online.sair) { J.online.sair(); return; }
    J = null; mostrar('telaInicio');
  };
  $('btDeNovo').onclick = () => iniciar(cfgPartida);
  $('btMenu').onclick = () => { J = null; mostrar('telaInicio'); };
  montarGuia();
  $('btJogarLivre').querySelector('small').textContent = descreverCfg(cfg);

  // Para testes automáticos
  window.__arena = { codificar, decodificar, get J() { return J; }, jogar, CARTAS,
    passo(n) { for (let i = 0; i < n && J && J.estado === 'jogando'; i++) atualizar(1 / 30); } };
  /* ---------------- Tela cheia (mesmo jeito dos outros jogos do site) ---------------- */
  const ICON_FS_IN = '<svg viewBox="0 0 24 24" fill="none" stroke="#23304B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>';
  const ICON_FS_OUT = '<svg viewBox="0 0 24 24" fill="none" stroke="#23304B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg>';
  const isFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function syncFS() {
    const on = isFS();
    document.querySelectorAll('.fsBtn').forEach(b => {
      b.querySelector('.circle').innerHTML = on ? ICON_FS_OUT : ICON_FS_IN;
      b.setAttribute('aria-label', on ? 'Sair da tela cheia' : 'Tela cheia');
      const l = b.querySelector('.lbl'); if (l) l.textContent = on ? 'Sair' : 'Tela cheia';
    });
    setTimeout(ajustarCanvas, 150);
  }
  function toggleFS() {
    const d = document, e = d.documentElement;
    try {
      if (isFS()) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
      const req = e.requestFullscreen || e.webkitRequestFullscreen; if (!req) return;
      const pr = req.call(e); if (pr && pr.catch) pr.catch(() => aviso('Este navegador não deixou abrir em tela cheia.'));
    } catch (err) { aviso('Este navegador não deixou abrir em tela cheia.'); }
  }
  {
    const temFS = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
    document.querySelectorAll('.fsBtn').forEach(b => { b.hidden = !temFS; b.addEventListener('click', toggleFS); });
    document.addEventListener('fullscreenchange', syncFS); document.addEventListener('webkitfullscreenchange', syncFS);
    syncFS();
  }

  // Para o modo duelo (duelo.js)
  window.Arena = {
    CARTAS, BARALHO, codificar, decodificar, descreverCfg, get cfg() { return cfg; },
    get baralhoAluno() { return baralhoOficial(baralhoAluno); }, novaMao, baralhoValido, mostrar, renderMao, mostrarFim, aviso, podeColocar, jogar, terminar,
    get J() { return J; }, set J(v) { J = v; },
    novaPartida(c, online, nomeInim) {
      novaPartida(c);
      if (online && (online.papel === 'anfitriao' || online.papel === 'convidado')) { // duelo: todos no mesmo nível, para ser justo
        const um = {}; BARALHO.forEach(k => (um[k] = 1)); J.niveis = [um, um];
        J.maos[0] = novaMao(baralhoOficial(baralhoAluno)); // e só cartas oficiais
        renderMao();
      }
      J.online = online || null; J.nomeInim = nomeInim || null; cfgPartida = c; $('btPausa').hidden = !!online; return J; },
  };
})();
