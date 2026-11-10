/* Batalha Matemática — progresso do aluno: moedas, baús, níveis das cartas, nível do jogador (XP),
   loja, cartas criadas na oficina e perfis.
   Tudo fica guardado no navegador deste computador (localStorage), separado por aluno ("Quem está jogando?").
   Também dá para salvar o progresso num arquivo e abrir esse arquivo em outro computador. */
(function () {
  'use strict';
  const CHAVE = 'arena-progresso';
  const NIVEL_MAX = 6;
  // para subir a carta do nível n para n+1: cópias da carta e moedas
  const CUSTO = { 1: [2, 20], 2: [4, 50], 3: [10, 150], 4: [20, 400], 5: [50, 1000] };
  const MAX_BAUS = 4;
  const BAUS = {
    madeira: { nome: 'Baú de Madeira', moedas: [30, 50], cartas: 2, copias: [3, 6] },
    prata: { nome: 'Baú de Prata', moedas: [80, 120], cartas: 3, copias: [4, 8] },
    ouro: { nome: 'Baú de Ouro', moedas: [200, 300], cartas: 4, copias: [6, 12] },
    pacote: { nome: 'Pacote de Cartas', moedas: [0, 0], cartas: 3, copias: [3, 5] },
  };
  const LOJA = [
    { id: 'pacote', preco: 80, desc: '3 cartas sorteadas' },
    { id: 'prata', preco: 150, desc: 'Moedas e 3 cartas' },
    { id: 'ouro', preco: 350, desc: 'Muitas moedas e 4 cartas' },
  ];
  // Oficina: bases que o aluno pode usar e o limite de pontos
  const BASES = ['guerreiro', 'besteiros', 'golem', 'lanceiros', 'feiticeira', 'cavaleiro', 'bombardeiro', 'curandeira'];
  const SLOTS = ['meu1', 'meu2'];
  const PONTOS_MAX = 24;
  const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const novoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5);

  let CARTAS = {}, BARALHO = [], PADRAO = [];
  let dados = { atual: 'Jogador', perfis: {} };

  // Nível do jogador: para passar do nível L para L+1 precisa de 30 + 20 × L pontos de experiência
  const xpPara = L => 30 + 20 * L;
  function nivelDeXp(xp) {
    let L = 1, resto = xp;
    while (resto >= xpPara(L)) { resto -= xpPara(L); L++; }
    return { nivel: L, atual: resto, falta: xpPara(L) };
  }

  function perfilNovo(nome) {
    const cartas = {}; BARALHO.forEach(k => (cartas[k] = { n: 1, c: 0 }));
    return {
      id: novoId(), nome, moedas: 0, xp: 0, turma: '', cartas, baus: [], baralho: PADRAO.slice(), criadas: {},
      stats: { partidas: 0, vitorias: 0, empates: 0, derrotas: 0, acertos: 0, erradas: 0 }, criado: Date.now(),
    };
  }
  const specValida = s => s && BASES.includes(s.base) && typeof s.nome === 'string' && s.nome.trim()
    && ['vida', 'dano', 'vel'].every(k => Number.isInteger(s[k]) && s[k] >= 1 && s[k] <= 10) && s.vida + s.dano + s.vel <= PONTOS_MAX;
  function arrumar(p, nome) { // completa perfis antigos ou vindos de arquivo
    const novo = perfilNovo(nome || (p && p.nome) || 'Jogador');
    if (!p || typeof p !== 'object') return novo;
    if (typeof p.id === 'string' && /^[a-z0-9]{6,20}$/.test(p.id)) novo.id = p.id;
    novo.moedas = Math.max(0, Math.floor(+p.moedas || 0));
    novo.xp = Math.max(0, Math.floor(+p.xp || 0));
    novo.turma = typeof p.turma === 'string' ? p.turma.slice(0, 6) : '';
    BARALHO.forEach(k => {
      const c = p.cartas && p.cartas[k];
      if (c) novo.cartas[k] = { n: Math.min(NIVEL_MAX, Math.max(1, Math.floor(+c.n || 1))), c: Math.max(0, Math.floor(+c.c || 0)) };
    });
    if (Array.isArray(p.baus)) novo.baus = p.baus.filter(t => BAUS[t] && t !== 'pacote').slice(0, MAX_BAUS);
    if (p.criadas) SLOTS.forEach(s => { if (specValida(p.criadas[s])) novo.criadas[s] = Object.assign({}, p.criadas[s], { nome: p.criadas[s].nome.slice(0, 16) }); });
    const valida = k => CARTAS[k] || novo.criadas[k];
    if (Array.isArray(p.baralho) && p.baralho.length === 8 && new Set(p.baralho).size === 8 && p.baralho.every(valida)) novo.baralho = p.baralho.slice();
    if (p.stats) Object.keys(novo.stats).forEach(s => (novo.stats[s] = Math.max(0, Math.floor(+p.stats[s] || 0))));
    // perfis antigos não tinham derrotas: deduz
    if (p.stats && p.stats.derrotas === undefined) novo.stats.derrotas = Math.max(0, novo.stats.partidas - novo.stats.vitorias - novo.stats.empates);
    novo.criado = +p.criado || Date.now();
    return novo;
  }
  function gravar() { try { localStorage.setItem(CHAVE, JSON.stringify(dados)); return true; } catch (e) { return false; } }
  function ler() {
    try {
      const d = JSON.parse(localStorage.getItem(CHAVE));
      if (d && d.perfis && typeof d.perfis === 'object') {
        dados = { atual: String(d.atual || 'Jogador'), perfis: {} };
        for (const [nome, p] of Object.entries(d.perfis)) dados.perfis[nome] = arrumar(p, nome);
      }
    } catch (e) { /* sem armazenamento: o progresso vale só até fechar a página */ }
    if (!dados.perfis[dados.atual]) {
      const p = perfilNovo(dados.atual);
      try { const b = JSON.parse(localStorage.getItem('arena-baralho')); if (Array.isArray(b) && b.length === 8 && b.every(k => CARTAS[k])) p.baralho = b; } catch (e) { /* nada */ }
      dados.perfis[dados.atual] = p;
    }
    gravar();
  }
  const P = () => dados.perfis[dados.atual];

  /* Filtro de nomes: barra palavrão, xingamento e termo pejorativo em nome de aluno e de carta.
     Desfaz truques comuns: acento, maiúscula, número no lugar de letra (p0rr4), letra repetida (poooorra)
     e espaço/ponto no meio (p.o.r.r.a). Nenhum filtro é perfeito: o professor continua de olho. */
  const tirarRep = s => s.replace(/(.)\1+/g, '$1');
  const LEET = { 0: 'o', 1: 'i', 2: 'z', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b', 9: 'g', '@': 'a', '$': 's', '!': 'i', '|': 'i' };
  function normalizar(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[0-9@$!|]/g, c => LEET[c]).replace(/ç/g, 'c').replace(/[^a-z]+/g, ' ').trim();
  }
  // pedaços que não aparecem em nomes comuns: barrados em qualquer lugar, mesmo grudados ou espaçados
  const RAIZES = ['caralh', 'porra', 'merda', 'bucet', 'boceta', 'piroc', 'punhet', 'xoxot', 'xerec', 'viado', 'viadinh',
    'foder', 'fuder', 'fodid', 'fudid', 'fodas', 'arrombad', 'babaca', 'otario', 'imbecil', 'idiota', 'retardad', 'mongoloid',
    'vagabund', 'vadia', 'piranh', 'safad', 'desgrac', 'cuzao', 'cusao', 'bosta', 'corno', 'chifrud', 'macaco', 'macaca',
    'crioul', 'neguinh', 'sapatao', 'traveco', 'boiola', 'baitola', 'nazi', 'hitler', 'estupr', 'pedofil', 'porno', 'penis',
    'vagina', 'siriric', 'brocha', 'escrot', 'fdp', 'pqp', 'vsf', 'vtnc', 'krl', 'kct', 'fuck', 'shit', 'bitch', 'nigg', 'puta']
    .map(tirarRep);
  // "puta" grudado aparece em "computador"/"disputa": ali só vale como palavra inteira
  const EXCECOES = ['computa', 'disputa', 'reputa', 'imputa', 'deputa', 'amputa', 'caputa'];
  // palavras curtas ou comuns em nomes (Pinto, Rolando): barradas só sozinhas
  const PALAVRAS = new Set(['cu', 'cus', 'puto', 'putos', 'pau', 'rola', 'bicha', 'burro', 'burra', 'feio', 'feia', 'gordo',
    'gorda', 'lixo', 'anta', 'besta', 'otaria', 'tnc', 'pnc', 'crl', 'krai', 'gay', 'sexo', 'sex', 'dick', 'xota', 'teta', 'tetas',
    'bunda', 'coco', 'mijo', 'peido', 'nojento', 'nojenta', 'chato', 'chata', 'mane', 'trouxa', 'lesado', 'lesada', 'baleia']
    .map(p => tirarRep(normalizar(p))));
  function nomeProibido(s) {
    const n = normalizar(s);
    if (!n) return false;
    if (n.split(' ').some(p => PALAVRAS.has(tirarRep(p)))) return true;
    let junto = tirarRep(n.replace(/ /g, ''));
    EXCECOES.forEach(e => { junto = junto.split(tirarRep(e)).join('#'); });
    return RAIZES.some(r => junto.includes(r));
  }

  function sortearBau() {
    const x = Math.random();
    return x < 0.07 ? 'ouro' : x < 0.35 ? 'prata' : 'madeira';
  }
  function gerarPremio(tipo) { // moedas e cartas de um baú ou pacote
    const p = P(), b = BAUS[tipo];
    const moedas = R(b.moedas[0], b.moedas[1]);
    p.moedas += moedas;
    const sorteadas = BARALHO.slice().sort(() => Math.random() - 0.5).slice(0, b.cartas);
    const cartas = sorteadas.map(k => { const q = R(b.copias[0], b.copias[1]); p.cartas[k].c += q; return { k, q }; });
    return { tipo, nome: b.nome, moedas, cartas };
  }

  const api = {
    NIVEL_MAX, BAUS, MAX_BAUS, LOJA, BASES, SLOTS, PONTOS_MAX, nivelDeXp, nomeProibido,
    iniciar(cartas, baralho, padrao) { CARTAS = cartas; BARALHO = baralho; PADRAO = padrao; ler(); },
    get perfil() { return P(); },
    get nome() { return P().nome; },
    get moedas() { return P().moedas; },
    get jogador() { return nivelDeXp(P().xp); },
    nivel: k => (P().cartas[k] ? P().cartas[k].n : 1),
    niveis() { const o = {}; BARALHO.forEach(k => (o[k] = api.nivel(k))); return o; },
    mult: n => 1 + 0.08 * ((n || 1) - 1), // cada nível de carta: +8% de vida e de dano
    custo: n => (CUSTO[n] ? { copias: CUSTO[n][0], moedas: CUSTO[n][1] } : null),
    baralho: () => P().baralho.slice(),
    salvarBaralho(b) { P().baralho = b.slice(); gravar(); },
    set turma(c) { if (c && P().turma !== c) { P().turma = String(c).slice(0, 6); gravar(); } },
    get turma() { return P().turma; },

    // fim de partida: moedas, experiência e, às vezes, um baú
    recompensar({ venceu, empate, coroas, certas, erradas }) {
      const p = P();
      const det = [
        ['Contas certas', certas * 2, `${certas} × 2`],
        ['Coroas', coroas * 5, `${coroas} × 5`],
        [venceu ? 'Vitória' : empate ? 'Empate' : 'Participação', venceu ? 20 : empate ? 8 : 3, ''],
      ];
      let total = det.reduce((t, d) => t + d[1], 0);
      p.stats.partidas++; p.stats.acertos += certas; p.stats.erradas += erradas || 0;
      if (venceu) p.stats.vitorias++; else if (empate) p.stats.empates++; else p.stats.derrotas++;
      // experiência: 1 por conta certa + bônus pelo resultado
      const xpGanho = certas + (venceu ? 15 : empate ? 6 : 3);
      const antes = nivelDeXp(p.xp).nivel;
      p.xp += xpGanho;
      const depois = nivelDeXp(p.xp).nivel;
      let bonusNivel = 0;
      for (let L = antes + 1; L <= depois; L++) bonusNivel += 50 * L; // prêmio ao subir de nível
      if (bonusNivel) det.push([`Subiu para o nível ${depois}`, bonusNivel, '']);
      total += bonusNivel;
      p.moedas += total;
      let bau = null, cheio = false, motivo = '';
      if (venceu || certas >= 15) {
        motivo = venceu ? 'pela vitória' : 'por acertar 15 contas ou mais';
        if (p.baus.length < MAX_BAUS) { bau = sortearBau(); p.baus.push(bau); } else cheio = true;
      }
      gravar();
      return { total, det, bau, cheio, motivo, xpGanho, subiu: depois > antes ? depois : 0 };
    },

    abrirBau(i) {
      const p = P(), tipo = p.baus[i];
      if (!tipo) return null;
      p.baus.splice(i, 1);
      const r = gerarPremio(tipo);
      gravar(); return r;
    },
    comprar(id) { // loja: paga e já abre
      const item = LOJA.find(x => x.id === id);
      if (!item) return null;
      if (P().moedas < item.preco) return 'moedas';
      P().moedas -= item.preco;
      const r = gerarPremio(id);
      gravar(); return r;
    },

    podeEvoluir(k) {
      const c = P().cartas[k]; if (!c) return false;
      const cu = api.custo(c.n);
      return !!cu && c.c >= cu.copias && P().moedas >= cu.moedas;
    },
    evoluir(k) {
      const p = P(), c = p.cartas[k], cu = api.custo(c.n);
      if (!cu) return 'max';
      if (c.c < cu.copias) return 'copias';
      if (p.moedas < cu.moedas) return 'moedas';
      c.c -= cu.copias; p.moedas -= cu.moedas; c.n++;
      gravar();
      return 'ok';
    },

    // Oficina: cartas criadas pelo aluno
    criadas: () => Object.assign({}, P().criadas),
    // custo = custo da base × (Vida + Dano + Velocidade) ÷ 15, arredondado (entre 1 e 9)
    calcular(spec) {
      const b = CARTAS[spec.base], soma = spec.vida + spec.dano + spec.vel;
      const exato = b.custo * soma / 15;
      return {
        soma, exato, custo: Math.min(9, Math.max(1, Math.round(exato))),
        hp: Math.round(b.hp * spec.vida / 5), dmg: Math.round(b.dmg * spec.dano / 5),
        speed: Math.round(b.speed * (0.5 + spec.vel / 10) * 100) / 100,
      };
    },
    salvarCriada(slot, spec) {
      if (!SLOTS.includes(slot) || !specValida(spec)) return false;
      if (nomeProibido(spec.nome)) return 'proibido';
      P().criadas[slot] = { base: spec.base, nome: spec.nome.trim().slice(0, 16), vida: spec.vida, dano: spec.dano, vel: spec.vel };
      gravar(); return true;
    },
    apagarCriada(slot) {
      const p = P(); delete p.criadas[slot];
      if (p.baralho.includes(slot)) p.baralho = PADRAO.slice();
      gravar();
    },

    // perfis (alunos que usam este computador)
    perfis: () => Object.values(dados.perfis).sort((a, b) => a.nome.localeCompare(b.nome)),
    trocar(nome) { if (dados.perfis[nome]) { dados.atual = nome; gravar(); return true; } return false; },
    criar(nome) {
      nome = String(nome || '').trim().replace(/\s+/g, ' ').slice(0, 16);
      if (!nome) return 'vazio';
      if (nomeProibido(nome)) return 'proibido';
      if (dados.perfis[nome]) { dados.atual = nome; gravar(); return 'existe'; }
      dados.perfis[nome] = perfilNovo(nome); dados.atual = nome; gravar();
      return 'ok';
    },
    renomearPadrao(nome) { // o perfil "Jogador" ganha o nome do aluno
      nome = String(nome || '').trim().slice(0, 16);
      const p = P();
      if (!nome || nomeProibido(nome) || p.nome !== 'Jogador' || dados.perfis[nome]) return false;
      delete dados.perfis.Jogador; p.nome = nome; dados.perfis[nome] = p; dados.atual = nome; gravar();
      return true;
    },

    // arquivo de progresso (só o aluno atual)
    exportar() {
      return JSON.stringify({ jogo: 'batalha-matematica', versao: 2, salvoEm: new Date().toISOString(), perfil: P() }, null, 1);
    },
    importar(texto) {
      let d;
      try { d = JSON.parse(texto); } catch (e) { return 'invalido'; }
      if (!d || d.jogo !== 'batalha-matematica' || !d.perfil) return 'invalido';
      const nome = String(d.perfil.nome || 'Jogador').slice(0, 16);
      if (nomeProibido(nome)) return 'proibido';
      dados.perfis[nome] = arrumar(d.perfil, nome); dados.atual = nome;
      return gravar() ? 'ok' : 'semEspaco';
    },
    salvou: () => gravar(),
  };
  window.Progresso = api;
})();
