/* Batalha Matemática — progresso do aluno: moedas, baús, níveis das cartas e perfis.
   Tudo fica guardado no navegador deste computador (localStorage), separado por aluno ("Quem está jogando?").
   Também dá para salvar o progresso num arquivo e abrir esse arquivo em outro computador. */
(function () {
  'use strict';
  const CHAVE = 'arena-progresso';
  const NIVEL_MAX = 6;
  // para subir do nível n para n+1: cópias da carta e moedas
  const CUSTO = { 1: [2, 20], 2: [4, 50], 3: [10, 150], 4: [20, 400], 5: [50, 1000] };
  const MAX_BAUS = 4;
  const BAUS = {
    madeira: { nome: 'Baú de Madeira', moedas: [30, 50], cartas: 2, copias: [3, 6] },
    prata: { nome: 'Baú de Prata', moedas: [80, 120], cartas: 3, copias: [4, 8] },
    ouro: { nome: 'Baú de Ouro', moedas: [200, 300], cartas: 4, copias: [6, 12] },
  };
  const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

  let CARTAS = {}, BARALHO = [], PADRAO = [];
  let dados = { atual: 'Jogador', perfis: {} };

  function perfilNovo(nome) {
    const cartas = {}; BARALHO.forEach(k => (cartas[k] = { n: 1, c: 0 }));
    return { nome, moedas: 0, cartas, baus: [], baralho: PADRAO.slice(), stats: { partidas: 0, vitorias: 0, acertos: 0 }, criado: Date.now() };
  }
  function arrumar(p, nome) { // completa perfis antigos ou vindos de arquivo
    const novo = perfilNovo(nome || (p && p.nome) || 'Jogador');
    if (!p || typeof p !== 'object') return novo;
    novo.moedas = Math.max(0, Math.floor(+p.moedas || 0));
    BARALHO.forEach(k => {
      const c = p.cartas && p.cartas[k];
      if (c) novo.cartas[k] = { n: Math.min(NIVEL_MAX, Math.max(1, Math.floor(+c.n || 1))), c: Math.max(0, Math.floor(+c.c || 0)) };
    });
    if (Array.isArray(p.baus)) novo.baus = p.baus.filter(t => BAUS[t]).slice(0, MAX_BAUS);
    if (Array.isArray(p.baralho) && p.baralho.length === 8 && new Set(p.baralho).size === 8 && p.baralho.every(k => CARTAS[k])) novo.baralho = p.baralho.slice();
    if (p.stats) ['partidas', 'vitorias', 'acertos'].forEach(s => (novo.stats[s] = Math.max(0, Math.floor(+p.stats[s] || 0))));
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
      // primeira vez: aproveita o baralho que o aluno já tinha montado
      const p = perfilNovo(dados.atual);
      try { const b = JSON.parse(localStorage.getItem('arena-baralho')); if (Array.isArray(b) && b.length === 8 && b.every(k => CARTAS[k])) p.baralho = b; } catch (e) { /* nada */ }
      dados.perfis[dados.atual] = p;
    }
    gravar();
  }
  const P = () => dados.perfis[dados.atual];

  function sortearBau() {
    const x = Math.random();
    return x < 0.07 ? 'ouro' : x < 0.35 ? 'prata' : 'madeira';
  }

  const api = {
    NIVEL_MAX, BAUS, MAX_BAUS,
    iniciar(cartas, baralho, padrao) { CARTAS = cartas; BARALHO = baralho; PADRAO = padrao; ler(); },
    get perfil() { return P(); },
    get nome() { return P().nome; },
    get moedas() { return P().moedas; },
    nivel: k => (P().cartas[k] ? P().cartas[k].n : 1),
    niveis() { const o = {}; BARALHO.forEach(k => (o[k] = api.nivel(k))); return o; },
    mult: n => 1 + 0.08 * ((n || 1) - 1), // cada nível: +8% de vida e de dano
    custo: n => (CUSTO[n] ? { copias: CUSTO[n][0], moedas: CUSTO[n][1] } : null),
    baralho: () => P().baralho.slice(),
    salvarBaralho(b) { P().baralho = b.slice(); gravar(); },

    // fim de partida: moedas (a maior parte vem das contas certas) e, às vezes, um baú
    recompensar({ venceu, empate, coroas, certas }) {
      const p = P();
      const det = [
        ['Contas certas', certas * 2, `${certas} × 2`],
        ['Coroas', coroas * 5, `${coroas} × 5`],
        [venceu ? 'Vitória' : empate ? 'Empate' : 'Participação', venceu ? 20 : empate ? 8 : 3, ''],
      ];
      const total = det.reduce((t, d) => t + d[1], 0);
      p.moedas += total;
      p.stats.partidas++; if (venceu) p.stats.vitorias++; p.stats.acertos += certas;
      let bau = null, cheio = false, motivo = '';
      if (venceu || certas >= 15) {
        motivo = venceu ? 'pela vitória' : 'por acertar 15 contas ou mais';
        if (p.baus.length < MAX_BAUS) { bau = sortearBau(); p.baus.push(bau); } else cheio = true;
      }
      gravar();
      return { total, det, bau, cheio, motivo };
    },

    abrirBau(i) {
      const p = P(), tipo = p.baus[i];
      if (!tipo) return null;
      const b = BAUS[tipo];
      p.baus.splice(i, 1);
      const moedas = R(b.moedas[0], b.moedas[1]);
      p.moedas += moedas;
      const sorteadas = BARALHO.slice().sort(() => Math.random() - 0.5).slice(0, b.cartas);
      const cartas = sorteadas.map(k => { const q = R(b.copias[0], b.copias[1]); p.cartas[k].c += q; return { k, q }; });
      gravar();
      return { tipo, nome: b.nome, moedas, cartas };
    },

    podeEvoluir(k) {
      const c = P().cartas[k], cu = api.custo(c.n);
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

    // perfis (alunos que usam este computador)
    perfis: () => Object.values(dados.perfis).sort((a, b) => a.nome.localeCompare(b.nome)),
    trocar(nome) { if (dados.perfis[nome]) { dados.atual = nome; gravar(); return true; } return false; },
    criar(nome) {
      nome = String(nome || '').trim().replace(/\s+/g, ' ').slice(0, 16);
      if (!nome) return 'vazio';
      if (dados.perfis[nome]) { dados.atual = nome; gravar(); return 'existe'; }
      dados.perfis[nome] = perfilNovo(nome); dados.atual = nome; gravar();
      return 'ok';
    },
    renomearPadrao(nome) { // o perfil "Jogador" vazio ganha o nome do aluno
      nome = String(nome || '').trim().slice(0, 16);
      const p = P();
      if (!nome || p.nome !== 'Jogador' || dados.perfis[nome]) return false;
      delete dados.perfis.Jogador; p.nome = nome; dados.perfis[nome] = p; dados.atual = nome; gravar();
      return true;
    },

    // arquivo de progresso (só o aluno atual)
    exportar() {
      return JSON.stringify({ jogo: 'batalha-matematica', versao: 1, salvoEm: new Date().toISOString(), perfil: P() }, null, 1);
    },
    importar(texto) {
      let d;
      try { d = JSON.parse(texto); } catch (e) { return 'invalido'; }
      if (!d || d.jogo !== 'batalha-matematica' || !d.perfil) return 'invalido';
      const nome = String(d.perfil.nome || 'Jogador').slice(0, 16);
      dados.perfis[nome] = arrumar(d.perfil, nome); dados.atual = nome;
      return gravar() ? 'ok' : 'semEspaco';
    },
    salvou: () => gravar(),
  };
  window.Progresso = api;
})();
