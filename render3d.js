/* Arena do Caderno — desenho 3D (Three.js). Só desenha: a simulação continua em jogo.js.
   Coordenadas do jogo: x 0..18 (largura), y 0..30 (profundidade; o aluno fica embaixo, y alto).
   No mundo 3D: X = x − 9, Z = y − 15, Y = altura. */
(function () {
  'use strict';
  window.Render3D = null;
  if (!window.THREE) return;
  try { const c = document.createElement('canvas'); if (!(c.getContext('webgl') || c.getContext('experimental-webgl'))) return; }
  catch (e) { return; }
  const T = THREE;

  const COR = [0x2f6fd6, 0xd6453d], COR_ESC = [0x1d4790, 0x8f2620];
  const lam = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  const MT = {
    pele: lam(0xf1c27d), aco: lam(0xc3ccd6), acoEsc: lam(0x6f7a85), madeira: lam(0x8a5a2b), madeiraClara: lam(0xb98552),
    pedra: lam(0xa7a59c), pedraEsc: lam(0x7c7a72), pedraClara: lam(0xc4c1b6), ouro: lam(0xe8b923), couro: lam(0x5c3a1e),
    cavalo: lam(0x7a4a2a), crina: lam(0x2b1a0e), cabelo: lam(0x4a2e14), folha: lam(0x3f8f3a), folhaEsc: lam(0x2e6e2c),
    orbe: lam(0xb58cff, { emissive: 0x6a3fd0 }), orbeVerde: lam(0x8dffb0, { emissive: 0x1f9e4f }),
    preto: lam(0x2a2a30), fogo: lam(0xffb347, { emissive: 0xff7a00 }), manto: lam(0xf3efe4), cruz: lam(0x2e9e5b, { emissive: 0x0f5a2a }), olho: [lam(0x9fd0ff, { emissive: 0x3f8fff }), lam(0xffb09f, { emissive: 0xff4f2f })],
    time: [lam(COR[0]), lam(COR[1])], timeEsc: [lam(COR_ESC[0]), lam(COR_ESC[1])],
  };

  /* ---------- peças básicas (geometria em cache) ---------- */
  const cacheG = new Map();
  function geo(tipo, ...a) {
    const k = tipo + a.join(',');
    let g = cacheG.get(k);
    if (!g) {
      if (tipo === 'box') g = new T.BoxGeometry(a[0], a[1], a[2]);
      else if (tipo === 'cil') g = new T.CylinderGeometry(a[0], a[1], a[2], a[3] || 10);
      else if (tipo === 'esf') g = new T.SphereGeometry(a[0], a[1] || 12, a[2] || 8);
      else if (tipo === 'cone') g = new T.ConeGeometry(a[0], a[1], a[2] || 10);
      else if (tipo === 'dode') g = new T.DodecahedronGeometry(a[0], 0);
      else if (tipo === 'anel') g = new T.RingGeometry(a[0], a[1], 32);
      else if (tipo === 'disco') g = new T.CircleGeometry(a[0], 40);
      else if (tipo === 'plano') g = new T.PlaneGeometry(a[0], a[1]);
      cacheG.set(k, g);
    }
    return g;
  }
  function m(g, mat, x, y, z, sombra) {
    const o = new T.Mesh(g, mat);
    o.position.set(x || 0, y || 0, z || 0);
    o.castShadow = sombra !== false;
    return o;
  }
  const grupo = (x, y, z) => { const g = new T.Group(); g.position.set(x || 0, y || 0, z || 0); return g; };

  function texto(txt, cor, w, h, px) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const desenhar = t => {
      x.clearRect(0, 0, w, h);
      x.font = `800 ${px}px 'Baloo 2', system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = px / 6; x.strokeStyle = 'rgba(0,0,0,.65)'; x.strokeText(t, w / 2, h / 2 + px * 0.06);
      x.fillStyle = cor; x.fillText(t, w / 2, h / 2 + px * 0.06);
      tex.needsUpdate = true;
    };
    const tex = new T.CanvasTexture(c);
    desenhar(txt);
    return { tex, desenhar };
  }
  function emblema(team, simbolo) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#' + COR[team].toString(16).padStart(6, '0');
    x.strokeStyle = '#f5e9c8'; x.lineWidth = 10;
    x.beginPath(); x.moveTo(64, 8); x.lineTo(118, 26); x.lineTo(110, 84); x.lineTo(64, 122); x.lineTo(18, 84); x.lineTo(10, 26); x.closePath();
    x.fill(); x.stroke();
    x.fillStyle = '#fff'; x.font = "800 70px 'Baloo 2', serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(simbolo, 64, 66);
    return new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true });
  }
  function texturaGrama() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#86c95a'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#7bbd51'; x.fillRect(0, 0, 32, 32); x.fillRect(32, 32, 32, 32);
    let s = 7; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 60; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,60,0,.07)'; x.fillRect(rnd() * 64, rnd() * 64, 2, 3); }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.NearestFilter;
    return t;
  }
  function texturaAgua() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 32;
    const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, '#2f86cf'); gr.addColorStop(0.5, '#4aa8e8'); gr.addColorStop(1, '#2f86cf');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 32);
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2;
    for (let k = 0; k < 2; k++) { x.beginPath(); for (let i = 0; i <= 128; i += 4) { const y = 10 + k * 12 + Math.sin(i / 128 * Math.PI * 4 + k) * 3; i ? x.lineTo(i, y) : x.moveTo(i, y); } x.stroke(); }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }

  /* ---------- guerreiros ---------- */
  function humano(team, o) {
    o = o || {};
    const g = grupo(), corpo = grupo(); g.add(corpo);
    const pernas = [-0.11, 0.11].map(dx => { const p = grupo(dx, 0.36, 0); p.add(m(geo('box', 0.15, 0.36, 0.16), MT.couro, 0, -0.18, 0)); corpo.add(p); return p; });
    corpo.add(m(geo('box', 0.44, 0.46, 0.28), o.armadura ? MT.aco : MT.time[team], 0, 0.6, 0));
    corpo.add(m(geo('box', 0.46, 0.1, 0.3), MT.couro, 0, 0.42, 0));
    if (o.armadura) corpo.add(m(geo('box', 0.3, 0.3, 0.02), MT.time[team], 0, 0.62, 0.15));
    const cab = m(geo('esf', 0.18), MT.pele, 0, 1.0, 0); corpo.add(cab);
    corpo.add(m(geo('box', 0.05, 0.04, 0.02), MT.crina, -0.07, 1.03, 0.17), m(geo('box', 0.05, 0.04, 0.02), MT.crina, 0.07, 1.03, 0.17));
    const braco = lado => {
      const b = grupo(lado * 0.29, 0.8, 0);
      b.add(m(geo('box', 0.13, 0.4, 0.13), o.armadura ? MT.aco : MT.time[team], 0, -0.18, 0));
      b.add(m(geo('esf', 0.08), MT.pele, 0, -0.4, 0));
      corpo.add(b); return b;
    };
    return { g, corpo, pernas, bracoE: braco(-1), bracoD: braco(1), cab };
  }
  const MODELOS = {
    guerreiro(team) {
      const h = humano(team, { armadura: true });
      h.corpo.add(m(geo('esf', 0.21, 12, 8), MT.aco, 0, 1.06, 0));
      h.corpo.add(m(geo('box', 0.06, 0.22, 0.3), MT.time[team], 0, 1.3, -0.02));
      h.corpo.add(m(geo('box', 0.3, 0.05, 0.05), MT.acoEsc, 0, 1.0, 0.17));
      const esp = grupo(0, -0.4, 0.05); esp.add(m(geo('box', 0.06, 0.05, 0.75), MT.aco, 0, 0, 0.42), m(geo('box', 0.26, 0.06, 0.06), MT.ouro, 0, 0, 0.06));
      h.bracoD.add(esp);
      const esc = m(geo('cil', 0.27, 0.27, 0.06, 14), MT.time[team], 0, -0.22, 0.14); esc.rotation.x = Math.PI / 2;
      h.bracoE.add(esc, m(geo('esf', 0.07), MT.ouro, 0, -0.22, 0.18));
      h.bracoE.rotation.x = -0.5;
      const capa = grupo(0, 0.82, -0.16); capa.add(m(geo('box', 0.44, 0.66, 0.04), MT.timeEsc[team], 0, -0.33, 0)); h.corpo.add(capa);
      return Object.assign(h, { atk: 'golpe', escala: 1.25, alt: 1.4, capa });
    },
    besteiros(team) {
      const h = humano(team);
      h.corpo.add(m(geo('cone', 0.23, 0.4, 10), MT.timeEsc[team], 0, 1.17, -0.02));
      h.corpo.add(m(geo('box', 0.3, 0.42, 0.06), MT.couro, 0, 0.6, -0.18));
      const besta = grupo(-0.15, -0.38, 0.12);
      besta.add(m(geo('box', 0.08, 0.08, 0.6), MT.madeira, 0, 0, 0.15), m(geo('box', 0.62, 0.05, 0.06), MT.acoEsc, 0, 0.02, 0.36));
      h.bracoD.add(besta);
      h.bracoD.rotation.x = -1.25; h.bracoE.rotation.x = -1.25; h.bracoE.rotation.z = -0.35;
      return Object.assign(h, { atk: 'tiro', escala: 1.1, alt: 1.35, base: { d: -1.25, e: -1.25 } });
    },
    golem(team) {
      const g = grupo(), corpo = grupo(); g.add(corpo);
      const pernas = [-0.32, 0.32].map(dx => { const p = grupo(dx, 0.55, 0); p.add(m(geo('box', 0.42, 0.55, 0.42), MT.pedraEsc, 0, -0.27, 0)); corpo.add(p); return p; });
      corpo.add(m(geo('dode', 0.78), MT.pedra, 0, 1.25, 0));
      corpo.add(m(geo('box', 1.25, 0.18, 0.95), MT.time[team], 0, 0.85, 0));
      corpo.add(m(geo('dode', 0.36), MT.pedraClara, 0, 2.05, 0.1));
      corpo.add(m(geo('esf', 0.07), MT.olho[team], -0.13, 2.1, 0.4, false), m(geo('esf', 0.07), MT.olho[team], 0.13, 2.1, 0.4, false));
      const braco = lado => {
        const b = grupo(lado * 0.88, 1.65, 0);
        b.add(m(geo('box', 0.36, 0.85, 0.36), MT.pedraEsc, 0, -0.38, 0), m(geo('dode', 0.3), MT.pedra, 0, -0.9, 0.05));
        corpo.add(b); return b;
      };
      return { g, corpo, pernas, bracoE: braco(-1), bracoD: braco(1), atk: 'pancada', escala: 1.0, alt: 2.5 };
    },
    lanceiros(team) {
      const h = humano(team);
      h.corpo.add(m(geo('cone', 0.2, 0.3, 8), MT.aco, 0, 1.2, 0));
      const lanca = grupo(0, -0.4, 0); const haste = m(geo('cil', 0.03, 0.03, 1.5, 6), MT.madeira, 0, 0, 0.35); haste.rotation.x = Math.PI / 2;
      const ponta = m(geo('cone', 0.07, 0.22, 6), MT.aco, 0, 0, 1.18); ponta.rotation.x = Math.PI / 2;
      lanca.add(haste, ponta); h.bracoD.add(lanca);
      h.bracoD.rotation.x = -0.6;
      return Object.assign(h, { atk: 'estocada', escala: 0.85, alt: 1.15, base: { d: -0.6 } });
    },
    feiticeira(team) {
      const g = grupo(), corpo = grupo(); g.add(corpo);
      corpo.add(m(geo('cone', 0.42, 1.0, 12), MT.time[team], 0, 0.5, 0));
      corpo.add(m(geo('esf', 0.18), MT.pele, 0, 1.08, 0));
      corpo.add(m(geo('box', 0.36, 0.3, 0.12), MT.cabelo, 0, 1.0, -0.12));
      corpo.add(m(geo('cil', 0.36, 0.36, 0.04, 16), MT.timeEsc[team], 0, 1.2, 0), m(geo('cone', 0.2, 0.55, 10), MT.timeEsc[team], 0, 1.47, 0));
      corpo.add(m(geo('box', 0.05, 0.04, 0.02), MT.crina, -0.07, 1.1, 0.17), m(geo('box', 0.05, 0.04, 0.02), MT.crina, 0.07, 1.1, 0.17));
      const braco = lado => { const b = grupo(lado * 0.24, 0.85, 0); b.add(m(geo('box', 0.12, 0.38, 0.12), MT.time[team], 0, -0.17, 0)); corpo.add(b); return b; };
      const bracoD = braco(1), bracoE = braco(-1);
      const cajado = grupo(0, -0.36, 0.05); cajado.add(m(geo('cil', 0.035, 0.035, 1.3, 6), MT.madeira, 0, 0.3, 0), m(geo('esf', 0.12), MT.orbe, 0, 1.0, 0, false));
      bracoD.add(cajado);
      return { g, corpo, pernas: [], bracoD, bracoE, atk: 'magia', escala: 1.15, alt: 1.75 };
    },
    cavaleiro(team) {
      const g = grupo(), corpo = grupo(); g.add(corpo);
      corpo.add(m(geo('box', 0.46, 0.46, 1.1), MT.cavalo, 0, 0.82, 0));
      corpo.add(m(geo('box', 0.5, 0.2, 0.7), MT.time[team], 0, 1.02, -0.05));
      const pesc = m(geo('box', 0.26, 0.55, 0.3), MT.cavalo, 0, 1.18, 0.55); pesc.rotation.x = 0.5; corpo.add(pesc);
      corpo.add(m(geo('box', 0.24, 0.24, 0.48), MT.cavalo, 0, 1.38, 0.82), m(geo('box', 0.08, 0.36, 0.5), MT.crina, 0, 1.32, 0.45));
      corpo.add(m(geo('box', 0.1, 0.12, 0.4), MT.crina, 0, 0.9, -0.66));
      const pernas = [[-0.15, 0.4], [0.15, 0.4], [-0.15, -0.4], [0.15, -0.4]].map(([dx, dz]) => {
        const p = grupo(dx, 0.62, dz); p.add(m(geo('box', 0.12, 0.62, 0.12), MT.cavalo, 0, -0.31, 0)); corpo.add(p); return p;
      });
      const cav = humano(team, { armadura: true }); cav.g.position.set(0, 0.72, -0.1); cav.g.scale.setScalar(0.85);
      cav.pernas.forEach(p => { p.rotation.z = (p.position.x < 0 ? 1 : -1) * 0.9; });
      cav.corpo.add(m(geo('esf', 0.21, 12, 8), MT.aco, 0, 1.06, 0), m(geo('cone', 0.06, 0.3, 6), MT.time[team], 0, 1.33, 0));
      const lanca = grupo(0, -0.4, 0); const haste = m(geo('cone', 0.07, 1.6, 8), MT.madeiraClara, 0, 0, 0.75); haste.rotation.x = Math.PI / 2; lanca.add(haste);
      cav.bracoD.add(lanca); cav.bracoD.rotation.x = -0.9;
      const capa = grupo(0, 0.82, -0.16); capa.add(m(geo('box', 0.44, 0.6, 0.04), MT.timeEsc[team], 0, -0.3, 0)); cav.corpo.add(capa);
      corpo.add(cav.g);
      return { g, corpo, pernas, bracoD: cav.bracoD, bracoE: cav.bracoE, atk: 'estocada', escala: 1.15, alt: 2.1, base: { d: -0.9 }, quadrupede: true, capa };
    },
    balista(team) {
      const g = grupo(), corpo = grupo(); g.add(corpo);
      corpo.add(m(geo('box', 1.2, 0.3, 1.2), MT.madeira, 0, 0.15, 0));
      corpo.add(m(geo('box', 1.3, 0.08, 1.3), MT.time[team], 0, 0.32, 0));
      corpo.add(m(geo('cil', 0.12, 0.16, 0.5, 8), MT.madeiraClara, 0, 0.55, 0));
      const topo = grupo(0, 0.85, 0);
      topo.add(m(geo('box', 0.22, 0.16, 1.3), MT.madeira, 0, 0, 0.1));
      const arcoE = m(geo('box', 0.7, 0.08, 0.1), MT.madeiraClara, -0.33, 0, 0.6); arcoE.rotation.y = 0.35;
      const arcoD = m(geo('box', 0.7, 0.08, 0.1), MT.madeiraClara, 0.33, 0, 0.6); arcoD.rotation.y = -0.35;
      const flecha = m(geo('cil', 0.03, 0.03, 1.1, 6), MT.acoEsc, 0, 0.1, 0.25); flecha.rotation.x = Math.PI / 2;
      topo.add(arcoE, arcoD, flecha);
      corpo.add(topo);
      corpo.add(m(geo('cil', 0.02, 0.02, 1.0, 5), MT.madeira, 0.5, 0.8, -0.5), m(geo('box', 0.02, 0.25, 0.35), MT.time[team], 0.5, 1.15, -0.33));
      return { g, corpo, pernas: [], giro: topo, atk: 'tiro', escala: 1.0, alt: 1.5 };
    },
    bombardeiro(team) {
      const h = humano(team);
      h.corpo.add(m(geo('cil', 0.2, 0.2, 0.09, 12), MT.time[team], 0, 1.1, 0)); // faixa na cabeça
      h.corpo.add(m(geo('box', 0.08, 0.06, 0.2), MT.time[team], 0, 1.1, -0.2));
      h.corpo.add(m(geo('esf', 0.12), MT.preto, -0.22, 0.45, 0.1), m(geo('esf', 0.12), MT.preto, 0.22, 0.45, 0.1)); // bombas no cinto
      const bomba = grupo(0, -0.42, 0.08);
      bomba.add(m(geo('esf', 0.16), MT.preto), m(geo('cil', 0.025, 0.025, 0.14, 5), MT.couro, 0, 0.18, 0), m(geo('esf', 0.05), MT.fogo, 0, 0.27, 0, false));
      h.bracoD.add(bomba);
      return Object.assign(h, { atk: 'magia', escala: 1.15, alt: 1.35 });
    },
    curandeira(team) {
      const g = grupo(), corpo = grupo(); g.add(corpo);
      corpo.add(m(geo('cone', 0.42, 1.0, 12), MT.manto, 0, 0.5, 0));
      corpo.add(m(geo('cil', 0.3, 0.33, 0.1, 12), MT.time[team], 0, 0.55, 0));
      corpo.add(m(geo('esf', 0.18), MT.pele, 0, 1.08, 0));
      corpo.add(m(geo('box', 0.05, 0.04, 0.02), MT.crina, -0.07, 1.1, 0.17), m(geo('box', 0.05, 0.04, 0.02), MT.crina, 0.07, 1.1, 0.17));
      const capuz = m(geo('esf', 0.23, 12, 8), MT.time[team], 0, 1.13, -0.04); capuz.scale.set(1, 1.05, 1.05); corpo.add(capuz);
      corpo.add(m(geo('box', 0.2, 0.06, 0.02), MT.cruz, 0, 0.72, 0.3), m(geo('box', 0.06, 0.2, 0.02), MT.cruz, 0, 0.72, 0.3));
      const braco = lado => { const b = grupo(lado * 0.24, 0.85, 0); b.add(m(geo('box', 0.12, 0.38, 0.12), MT.manto, 0, -0.17, 0)); corpo.add(b); return b; };
      const bracoD = braco(1), bracoE = braco(-1);
      const cajado = grupo(0, -0.36, 0.05);
      cajado.add(m(geo('cil', 0.035, 0.035, 1.3, 6), MT.madeiraClara, 0, 0.3, 0), m(geo('esf', 0.13), MT.orbeVerde, 0, 1.0, 0, false));
      bracoD.add(cajado);
      return { g, corpo, pernas: [], bracoD, bracoE, atk: 'magia', escala: 1.15, alt: 1.7 };
    },
    barricada(team) {
      const g = grupo(), corpo = grupo(); g.add(corpo);
      [[-0.5, 0.25], [0.5, 0.25], [0, 0.6]].forEach(([y0, yy], i) => {
        const tora = m(geo('cil', 0.17, 0.17, 2.0, 8), i % 2 ? MT.madeira : MT.madeiraClara, 0, yy, i === 2 ? 0 : (i ? 0.18 : -0.18));
        tora.rotation.z = Math.PI / 2; corpo.add(tora);
      });
      [-0.75, -0.25, 0.25, 0.75].forEach(x => {
        const estaca = m(geo('cone', 0.09, 0.9, 6), MT.madeiraClara, x, 0.75, 0.35); estaca.rotation.x = 0.7; corpo.add(estaca);
      });
      corpo.add(m(geo('cil', 0.03, 0.03, 1.1, 5), MT.madeira, 0.9, 0.9, -0.1));
      const band = m(geo('box', 0.03, 0.3, 0.45), MT.time[team], 0.9, 1.3, 0.1); corpo.add(band);
      return { g, corpo, pernas: [], atk: '', escala: 1, alt: 1.4, bandeiras: [band] };
    },
    flechas() { // só para o retrato da carta: um feixe de flechas caindo
      const g = grupo();
      for (let i = 0; i < 7; i++) {
        const a = grupo((i % 4 - 1.5) * 0.35, 0.6 + (i % 3) * 0.45, (i % 2) * 0.2);
        const haste = m(geo('cil', 0.035, 0.035, 0.9, 5), MT.madeira); a.add(haste);
        a.add(m(geo('cone', 0.08, 0.2, 5), MT.aco, 0, -0.52, 0));
        const pena = m(geo('box', 0.14, 0.18, 0.02), MT.time[0], 0, 0.42, 0); a.add(pena);
        a.rotation.z = 0.35; g.add(a);
      }
      return { g, corpo: g, pernas: [], atk: '', escala: 1, alt: 2.2 };
    },
    trovao() {
      const g = grupo();
      const pts = [[0, 2.2], [0.35, 1.3], [-0.05, 1.25], [0.25, 0.2], [-0.4, 1.45], [0, 1.5], [-0.25, 2.2]];
      const forma = new T.Shape(); pts.forEach(([x, y], i) => (i ? forma.lineTo(x, y) : forma.moveTo(x, y)));
      const raio = new T.Mesh(new T.ExtrudeGeometry(forma, { depth: 0.18, bevelEnabled: false }), lam(0xffe14d, { emissive: 0xc79a00 }));
      raio.position.z = -0.09; g.add(raio);
      g.add(m(geo('esf', 0.45, 12, 8), lam(0xe6ecf5), -0.2, 2.25, 0), m(geo('esf', 0.38, 12, 8), lam(0xd8dfea), 0.3, 2.2, 0.05));
      return { g, corpo: g, pernas: [], atk: '', escala: 1, alt: 2.6 };
    },
  };

  /* ---------- torres ---------- */
  function torreLateral(team) {
    const g = grupo();
    g.add(m(geo('cil', 1.0, 1.15, 2.5, 10), MT.pedra, 0, 1.25, 0));
    g.add(m(geo('cil', 1.17, 1.17, 0.3, 10), MT.time[team], 0, 1.75, 0));
    g.add(m(geo('cil', 1.22, 1.08, 0.3, 10), MT.pedraEsc, 0, 2.62, 0));
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(m(geo('box', 0.32, 0.38, 0.32), MT.pedraClara, Math.cos(a) * 1.02, 2.95, Math.sin(a) * 1.02)); }
    const fl = m(geo('box', 0.04, 0.38, 0.62), MT.time[team], 0, 3.85, 0); fl.userData.bandeira = true;
    g.add(m(geo('cil', 0.04, 0.04, 1.4, 5), MT.madeira, 0, 3.4, -0.3), fl);
    const e = new T.Mesh(geo('plano', 0.95, 0.95), emblema(team, 'Σ')); e.position.set(0, 1.0, 1.17); g.add(e);
    return g;
  }
  function torreRei(team) {
    const g = grupo();
    g.add(m(geo('box', 3.0, 2.6, 3.0), MT.pedra, 0, 1.3, 0));
    g.add(m(geo('box', 3.08, 0.32, 3.08), MT.time[team], 0, 1.9, 0));
    g.add(m(geo('box', 3.15, 0.28, 3.15), MT.pedraEsc, 0, 2.72, 0));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      g.add(m(geo('cil', 0.5, 0.55, 3.4, 10), MT.pedraClara, sx * 1.35, 1.7, sz * 1.35));
      g.add(m(geo('cone', 0.66, 1.0, 10), MT.time[team], sx * 1.35, 3.9, sz * 1.35));
    });
    const fl = m(geo('box', 0.05, 0.55, 0.95), MT.time[team], 0, 4.6, 0.45); fl.userData.bandeira = true;
    g.add(m(geo('cil', 0.05, 0.05, 2.2, 5), MT.madeira, 0, 3.9, 0), fl);
    g.add(m(geo('box', 0.9, 1.1, 0.1), MT.madeira, 0, 0.55, 1.52));
    const e = new T.Mesh(geo('plano', 1.2, 1.2), emblema(team, 'π')); e.position.set(0, 1.55, 1.56); g.add(e);
    return g;
  }
  function ruina() {
    const g = grupo();
    [[0, 0.3, 0, 0.6], [0.6, 0.2, 0.3, 0.4], [-0.5, 0.2, -0.3, 0.45], [0.2, 0.15, -0.6, 0.35], [-0.3, 0.15, 0.55, 0.3]]
      .forEach(([x, y, z, r]) => g.add(m(geo('dode', r), MT.pedraEsc, x, y, z)));
    return g;
  }
  // Barra de vida: contorno claro, fundo escuro e a parte colorida por cima.
  // Todas as peças são "transparentes" para o desenho respeitar a ordem (antes o fundo cobria a cor).
  function barra(larg, cor) {
    const g = grupo();
    const mb = (c, op) => new T.MeshBasicMaterial({ color: c, depthTest: false, depthWrite: false, transparent: true, opacity: op });
    const borda = new T.Mesh(geo('plano', larg + 0.16, 0.34), mb(0xffffff, 0.9));
    const fundo = new T.Mesh(geo('plano', larg + 0.06, 0.24), mb(0x1b1b24, 1));
    const gf = new T.PlaneGeometry(larg, 0.18); gf.translate(larg / 2, 0, 0);
    const enc = new T.Mesh(gf, mb(cor, 1));
    enc.position.set(-larg / 2, 0, 0);
    borda.renderOrder = 20; fundo.renderOrder = 21; enc.renderOrder = 22;
    g.add(borda, fundo, enc);
    return { g, enc };
  }

  /* ---------- cena ---------- */
  let renderer, cena, cam, cv, agua, zonaProibida, fantasma, anelFantasma, ray, plano, relogio = 0;
  const ativos = new Map(); // entidade/projétil/efeito -> objeto 3D
  let tremor = 0, camBase = null, tochas = [];

  /* ---------- partículas: faíscas no golpe, poeira ao andar, lascas ao cair, brilho ao surgir ---------- */
  const particulas = [];
  const COR_PART = { faisca: 0xffd34d, poeira: 0xd9cfb8, lasca: 0x8a8478, brilho: 0xffffff };
  function emitir(tipo, x, y, z, n, cor) {
    if (!cena) return;
    for (let i = 0; i < n; i++) {
      if (particulas.length > 160) { const v = particulas.shift(); cena.remove(v.m); v.m.material.dispose(); }
      const g = tipo === 'poeira' ? geo('esf', 0.16, 6, 5) : tipo === 'lasca' ? geo('box', 0.16, 0.12, 0.14) : geo('box', 0.09, 0.09, 0.09);
      const mesh = new T.Mesh(g, new T.MeshBasicMaterial({ color: cor !== undefined ? cor : COR_PART[tipo], transparent: true, depthWrite: false }));
      mesh.position.set(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4);
      const ang = Math.random() * Math.PI * 2;
      const v = tipo === 'poeira' ? 0.4 : tipo === 'brilho' ? 0.7 : 2 + Math.random() * 2.5;
      particulas.push({
        m: mesh, tipo, vida: 0, vx: Math.cos(ang) * v, vz: Math.sin(ang) * v,
        vy: tipo === 'poeira' ? 0.5 : tipo === 'brilho' ? 2 + Math.random() * 1.5 : 2 + Math.random() * 3,
        g: tipo === 'poeira' || tipo === 'brilho' ? 0 : 9, max: tipo === 'poeira' ? 0.7 : tipo === 'brilho' ? 0.8 : 0.65,
      });
      cena.add(mesh);
    }
  }
  function animarParticulas(dt) {
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i]; p.vida += dt; const k = p.vida / p.max;
      if (k >= 1) { cena.remove(p.m); p.m.material.dispose(); particulas.splice(i, 1); continue; }
      p.vy -= p.g * dt;
      p.m.position.x += p.vx * dt; p.m.position.z += p.vz * dt; p.m.position.y = Math.max(0.05, p.m.position.y + p.vy * dt);
      if (p.tipo === 'poeira') p.m.scale.setScalar(0.6 + k * 1.5);
      if (p.tipo === 'lasca') { p.m.rotation.x += dt * 7; p.m.rotation.z += dt * 5; }
      p.m.material.opacity = 1 - k * k;
    }
  }
  function rnd(seed) { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }

  function montarCenario() {
    // luz: céu suave + sol quente (sombras) + luz fria por trás, que destaca o contorno dos personagens
    cena.add(new T.HemisphereLight(0xeaf4ff, 0x5f7f3f, 0.62));
    const sol = new T.DirectionalLight(0xffe9c4, 0.95);
    sol.position.set(-9, 22, 12); sol.castShadow = true;
    const grande = Math.min(window.innerWidth, window.innerHeight) > 600;
    sol.shadow.mapSize.set(grande ? 2048 : 1024, grande ? 2048 : 1024);
    sol.shadow.bias = -0.0005;
    Object.assign(sol.shadow.camera, { left: -16, right: 16, top: 20, bottom: -20, near: 1, far: 60 });
    cena.add(sol);
    const contraluz = new T.DirectionalLight(0x9cc7ff, 0.38); contraluz.position.set(6, 9, -18); cena.add(contraluz);
    cena.fog = new T.Fog(0x3f6f2c, 55, 110);
    const fora = new T.Mesh(geo('plano', 90, 90), lam(0x4e8a37)); fora.rotation.x = -Math.PI / 2; fora.position.y = -0.3; fora.receiveShadow = true; cena.add(fora);
    const grama = texturaGrama(); grama.repeat.set(9, 7.15);
    [-1, 1].forEach(s => {
      const metade = new T.Mesh(geo('plano', 18, 14.3), lam(0xffffff, { map: grama }));
      metade.rotation.x = -Math.PI / 2; metade.position.set(0, 0, s * 7.85); metade.receiveShadow = true; cena.add(metade);
      const lado = m(geo('box', 18, 0.32, 14.3), lam(0x6b4a2b), 0, -0.17, s * 7.85, false); cena.add(lado);
    });
    // trilhas de terra
    const terra = lam(0xd8bf8a);
    [-5.5, 5.5].forEach(x => [-1, 1].forEach(s => {
      const t = new T.Mesh(geo('plano', 1.3, 9.6), terra); t.rotation.x = -Math.PI / 2; t.position.set(x, 0.01, s * 5.6); t.receiveShadow = true; cena.add(t);
    }));
    [-12.6, 12.6].forEach(z => { const t = new T.Mesh(geo('plano', 12.3, 1.2), terra); t.rotation.x = -Math.PI / 2; t.position.set(0, 0.01, z); t.receiveShadow = true; cena.add(t); });
    // rio
    const ta = texturaAgua(); ta.repeat.set(6, 1);
    agua = ta;
    const rio = new T.Mesh(geo('plano', 40, 1.4), lam(0xffffff, { map: ta })); rio.rotation.x = -Math.PI / 2; rio.position.y = -0.22; cena.add(rio);
    // pontes de madeira
    [-5.5, 5.5].forEach(x => {
      for (let i = 0; i < 6; i++) cena.add(m(geo('box', 2.1, 0.12, 0.42), i % 2 ? MT.madeira : MT.madeiraClara, x, 0.04, -1.1 + i * 0.44));
      [-1, 1].forEach(s => {
        cena.add(m(geo('box', 0.12, 0.12, 2.9), MT.madeira, x + s * 1.1, 0.4, 0));
        [-1.3, 0, 1.3].forEach(z => cena.add(m(geo('box', 0.14, 0.45, 0.14), MT.couro, x + s * 1.1, 0.2, z)));
      });
    });
    // mureta de pedra em volta
    const mur = MT.pedraClara;
    [-1, 1].forEach(s => {
      cena.add(m(geo('box', 0.35, 0.4, 30.7), mur, s * 9.2, 0.2, 0));
      cena.add(m(geo('box', 18.75, 0.4, 0.35), mur, 0, 0.2, s * 15.2));
    });
    // árvores e pedras em volta da arena
    const r = rnd(11);
    const arvore = (x, z, k) => {
      const g = grupo(x, 0, z);
      g.add(m(geo('cil', 0.18, 0.24, 0.9, 6), MT.madeira, 0, 0.45, 0));
      g.add(m(geo('dode', 0.85), r() < 0.5 ? MT.folha : MT.folhaEsc, 0, 1.45, 0), m(geo('dode', 0.6), MT.folha, 0.25, 2.0, 0.1));
      g.scale.setScalar(k); cena.add(g);
    };
    for (let z = -19; z <= 19; z += 1.9) [-1, 1].forEach(s => {
      arvore(s * (10.6 + r() * 0.8), z + r() * 0.8, 0.9 + r() * 0.5);
      arvore(s * (12.8 + r() * 1.5), z + r() * 1.2, 1.0 + r() * 0.5);
      if (r() < 0.35) cena.add(m(geo('dode', 0.35 + r() * 0.3), MT.pedraEsc, s * (9.8 + r() * 0.4), 0.1, z + r()));
    });
    for (let x = -9; x <= 9; x += 1.8) [-1, 1].forEach(s => arvore(x + r() * 0.8, s * (16.6 + r() * 1.2), 0.9 + r() * 0.5));
    // tufos de grama e florzinhas espalhados (longe das trilhas, do rio e das torres)
    const livre = (x, z) => Math.abs(z) > 1.6 && Math.abs(Math.abs(x) - 5.5) > 1.1 && !(Math.abs(Math.abs(z) - 12.6) < 0.9 && Math.abs(x) < 6.3)
      && Math.hypot(Math.abs(x) - 5.5, Math.abs(z) - 10.5) > 1.6 && Math.hypot(x, Math.abs(z) - 12.8) > 2.3;
    const tufos = new T.InstancedMesh(geo('cone', 0.09, 0.32, 4), lam(0x5fae3e), 260);
    const tufos2 = new T.InstancedMesh(geo('cone', 0.07, 0.26, 4), lam(0x8fd05e), 200);
    const flores = new T.InstancedMesh(geo('esf', 0.07, 6, 4), lam(0xffffff, { emissive: 0x222222 }), 90);
    const mtx = new T.Matrix4(), cores = [0xffffff, 0xffe066, 0xff9ec7, 0xb8a6ff];
    [[tufos, 260, 0.12], [tufos2, 200, 0.1], [flores, 90, 0.1]].forEach(([inst, n, yy], qual) => {
      let i = 0, tent = 0;
      while (i < n && tent++ < n * 10) {
        const x = (r() - 0.5) * 17.4, z = (r() - 0.5) * 29.6;
        if (!livre(x, z)) continue;
        mtx.makeRotationY(r() * 6).setPosition(x, yy, z);
        inst.setMatrixAt(i, mtx);
        if (qual === 2) inst.setColorAt(i, new T.Color(cores[i % cores.length]));
        i++;
      }
      inst.count = i; inst.receiveShadow = true; cena.add(inst);
    });
    // tochas nas pontas das pontes (o fogo tremula)
    tochas = [];
    [-5.5, 5.5].forEach(x => [-1, 1].forEach(s => {
      const t = grupo(x + 1.35, 0, s * 1.75);
      t.add(m(geo('cil', 0.07, 0.09, 1.2, 6), MT.madeira, 0, 0.6, 0), m(geo('cil', 0.14, 0.1, 0.16, 6), MT.acoEsc, 0, 1.25, 0));
      const chama = m(geo('cone', 0.13, 0.36, 6), MT.fogo, 0, 1.48, 0, false); t.add(chama); tochas.push(chama);
      cena.add(t);
    }));
    // camada de "onde não pode colocar" e prévia da carta
    zonaProibida = new T.Mesh(geo('plano', 18, 16.2), new T.MeshBasicMaterial({ color: 0xd6453d, transparent: true, opacity: 0.22, depthWrite: false }));
    zonaProibida.rotation.x = -Math.PI / 2; zonaProibida.position.set(0, 0.06, -15 + 8.1); zonaProibida.visible = false; cena.add(zonaProibida);
    fantasma = new T.Mesh(geo('disco', 1), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
    fantasma.rotation.x = -Math.PI / 2; fantasma.visible = false; cena.add(fantasma);
    anelFantasma = new T.Mesh(geo('anel', 0.92, 1), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
    anelFantasma.rotation.x = -Math.PI / 2; anelFantasma.visible = false; cena.add(anelFantasma);
  }

  function enquadrar(w, h) {
    cam.aspect = w / h;
    const dir = new T.Vector3(0, 1.75, 1).normalize(), alvo = new T.Vector3(0, 0, 0.9);
    const pts = [];
    [-9.4, 9.4].forEach(x => { pts.push(new T.Vector3(x, 0, 15.4), new T.Vector3(x, 0, -15.4), new T.Vector3(x * 0.4, 4.6, -15.4)); });
    let lo = 5, hi = 200;
    for (let i = 0; i < 30; i++) {
      const d = (lo + hi) / 2;
      cam.position.copy(alvo).addScaledVector(dir, d); cam.lookAt(alvo); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      const cabe = pts.every(p => { const q = p.clone().project(cam); return Math.abs(q.x) <= 0.985 && Math.abs(q.y) <= 0.985; });
      if (cabe) hi = d; else lo = d;
    }
    cam.position.copy(alvo).addScaledVector(dir, hi); cam.lookAt(alvo); cam.updateProjectionMatrix();
    camBase = cam.position.clone();
  }

  /* ---------- objetos de cada entidade ---------- */
  function criarObjeto(e) {
    const o = { g: grupo() };
    if (e.kind === 'torre') {
      o.modelo = e.rei ? torreRei(e.team) : torreLateral(e.team);
      o.g.add(o.modelo);
      o.barra = barra(e.rei ? 2.6 : 2.0, e.team === 0 ? 0x5aa2ff : 0xff6b5e); cena.add(o.barra.g);
      o.txt = texto(String(Math.ceil(e.hp)), e.team === 0 ? '#d6e7ff' : '#ffe0dc', 160, 56, 40);
      o.sprite = new T.Sprite(new T.SpriteMaterial({ map: o.txt.tex, depthTest: false, transparent: true })); o.sprite.scale.set(1.5, 0.52, 1); o.sprite.renderOrder = 23;
      cena.add(o.sprite); o.hpTxt = Math.ceil(e.hp);
      o.topo = e.rei ? 4.2 : 3.4;
      o.bandeiras = []; o.modelo.traverse(c => { if (c.userData.bandeira) o.bandeiras.push(c); });
    } else {
      const k = e.def && MODELOS[e.def.key] ? e.def.key : 'balista';
      const mod = MODELOS[k](e.team);
      const { g: modelo, ...partes } = mod; // o grupo do modelo fica dentro do grupo da entidade (não no lugar dele)
      Object.assign(o, partes);
      const TAM = e.kind === 'pred' ? 1.25 : 1.5; // desenho maior que a "bolinha" da simulação, para ler bem no celular
      modelo.scale.setScalar(mod.escala * TAM);
      o.g.add(modelo);
      const anel = new T.Mesh(geo('anel', 0.42, 0.55), new T.MeshBasicMaterial({ color: COR[e.team], transparent: true, opacity: 0.75, depthWrite: false }));
      anel.rotation.x = -Math.PI / 2; anel.position.y = 0.03; anel.scale.setScalar(e.radius / 0.5); o.g.add(anel);
      o.barra = barra(e.kind === 'pred' ? 1.4 : Math.max(0.9, e.radius * 2), e.team === 0 ? 0x5aa2ff : 0xff6b5e); cena.add(o.barra.g);
      o.topo = mod.alt * mod.escala * TAM;
      o.rumo = e.team === 0 ? Math.PI : 0; o.g.rotation.y = o.rumo;
      o.fase = Math.random() * 6; o.ataque = 0; o.cdAnt = 0;
      if (e.spawn > 0) emitir('brilho', e.x - 9, 0.2, e.y - 15, 12, e.team === 0 ? 0x8fc2ff : 0xff9a8f); // brilho ao surgir
    }
    o.g.traverse(c => { if (c.isMesh) c.receiveShadow = true; });
    cena.add(o.g);
    return o;
  }
  function remover(o) {
    cena.remove(o.g);
    if (o.barra) cena.remove(o.barra.g);
    if (o.sprite) { cena.remove(o.sprite); o.sprite.material.map.dispose(); o.sprite.material.dispose(); }
  }
  const angLerp = (a, b, t) => { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };
  function naPonte(x, z) { return Math.abs(z) < 1.3 && (Math.abs(x + 5.5) < 1.1 || Math.abs(x - 5.5) < 1.1); }

  function atualizarObjeto(e, o, dt) {
    const X = e.x - 9, Z = e.y - 15;
    if (e.kind === 'torre') {
      o.g.position.set(X, 0, Z);
      if (e.hp <= 0) {
        if (!o.ruina) {
          o.g.remove(o.modelo); o.ruina = ruina(); o.g.add(o.ruina); o.barra.g.visible = false; o.sprite.visible = false;
          emitir('lasca', X, 1.6, Z, 26); emitir('poeira', X, 0.6, Z, 12); tremor = 0.5; // a torre desmorona e a tela treme
        }
        return;
      }
      if (e.flash > 0 && !(o.flashAnt > 0)) emitir('faisca', X, 2.4, Z, 4);
      o.flashAnt = e.flash;
      o.modelo.position.x = e.flash > 0 ? (Math.random() - 0.5) * 0.08 : 0;
      o.bandeiras.forEach((b, i) => { b.rotation.y = Math.sin(relogio * 3 + i + X) * 0.3; });
      o.barra.enc.scale.x = Math.max(0.001, e.hp / e.max);
      o.barra.g.position.set(X, o.topo + 0.5, Z); o.barra.g.quaternion.copy(cam.quaternion);
      const v = Math.ceil(e.hp); if (v !== o.hpTxt) { o.hpTxt = v; o.txt.desenhar(String(v)); }
      o.sprite.position.set(X, o.topo + 1.0, Z);
      return;
    }
    const y = naPonte(X, Z) ? 0.1 : 0;
    const dx = X - o.g.position.x, dz = Z - o.g.position.z, mov = Math.hypot(dx, dz);
    const primeira = o.g.position.lengthSq() === 0 && !o.iniciado; o.iniciado = true;
    o.g.position.set(X, y, Z);
    const andando = !primeira && mov > 0.002 && !(e.spawn > 0);
    if (e.alvo && e.alvo.hp > 0 && (e.preso || e.kind === 'pred')) o.rumo = Math.atan2(e.alvo.x - e.x, e.alvo.y - e.y);
    else if (andando) o.rumo = Math.atan2(dx, dz);
    if (o.giro) { // balista: só a parte de cima gira
      o.g.rotation.y = 0;
      o.giroAng = angLerp(o.giroAng === undefined ? o.rumo : o.giroAng, o.rumo, Math.min(1, dt * 8));
      o.giro.rotation.y = o.giroAng;
    } else o.g.rotation.y = angLerp(o.g.rotation.y, o.rumo, Math.min(1, dt * 10));
    // surgir
    const s = e.spawn > 0 ? 0.35 + 0.65 * (1 - e.spawn) : 1;
    o.g.scale.setScalar(s * (e.flash > 0 ? 1.07 : 1));
    // andar
    o.fase += andando ? dt * (e.speed || 1) * 9 : 0;
    const amp = andando ? 0.65 : 0;
    o.pernas && o.pernas.forEach((p, i) => { p.rotation.x = Math.sin(o.fase + (i % 2 ? Math.PI : 0) + (o.quadrupede && i > 1 ? Math.PI : 0)) * amp; });
    if (o.corpo && o.corpo !== o.g) o.corpo.position.y = andando ? Math.abs(Math.sin(o.fase)) * 0.06 : 0;
    if (o.capa) o.capa.rotation.x = andando ? 0.45 + Math.sin(o.fase * 2) * 0.12 : 0.08 + Math.sin(relogio * 2 + o.fase) * 0.05;
    if (o.bandeiras) o.bandeiras.forEach(bd => { bd.rotation.y = Math.sin(relogio * 3 + o.fase) * 0.3; });
    if (andando && Math.random() < dt * 3) emitir('poeira', X, 0.1, Z, 1);
    if (e.flash > 0 && !(o.flashAnt > 0)) emitir('faisca', X, y + o.topo * 0.55, Z, 5);
    o.flashAnt = e.flash;
    // atacar: quando a recarga reinicia, toca a animação
    if (e.cd > o.cdAnt + 0.01) o.ataque = 0.3;
    o.cdAnt = e.cd || 0;
    o.ataque = Math.max(0, o.ataque - dt);
    const k = o.ataque > 0 ? Math.sin((1 - o.ataque / 0.3) * Math.PI) : 0;
    const b = o.base || {};
    if (o.bracoD) {
      if (o.atk === 'golpe') o.bracoD.rotation.x = -0.3 - 1.9 * k;
      else if (o.atk === 'pancada') { o.bracoD.rotation.x = -1.7 * k; o.bracoE.rotation.x = -1.7 * k; }
      else if (o.atk === 'estocada') o.bracoD.rotation.x = (b.d || 0) - 0.9 * k;
      else if (o.atk === 'magia') o.bracoD.rotation.x = -0.4 - 1.3 * k;
      else if (o.atk === 'tiro') o.bracoD.rotation.x = (b.d || 0) + 0.25 * k;
      if (o.atk !== 'pancada' && andando && o.bracoE && o.atk !== 'tiro') o.bracoE.rotation.x = (b.e || -0.5) + Math.sin(o.fase) * 0.3;
    }
    const vis = e.hp < e.max && !(e.spawn > 0);
    o.barra.g.visible = vis || e.kind === 'pred';
    if (o.barra.g.visible) {
      o.barra.enc.scale.x = Math.max(0.001, e.hp / e.max);
      o.barra.g.position.set(X, y + o.topo + 0.35, Z); o.barra.g.quaternion.copy(cam.quaternion);
    }
  }

  function criarProjetil(p) {
    const o = { g: grupo(), d0: Math.max(0.5, Math.hypot(p.tx - p.x, p.ty - p.y)) };
    if (p.k === 'bombardeiro') { // bomba com pavio aceso, voa em arco
      o.arco = true;
      o.g.add(m(geo('esf', 0.2, 10, 8), MT.preto, 0, 0, 0, false), m(geo('esf', 0.07), MT.fogo, 0, 0.22, 0, false));
    } else if (p.k === 'curandeira') o.g.add(m(geo('esf', 0.18, 10, 8), MT.orbeVerde, 0, 0, 0, false));
    else if (p.splash) o.g.add(m(geo('esf', 0.22, 10, 8), MT.orbe, 0, 0, 0, false));
    else { const f = m(geo('cil', 0.035, 0.035, 0.7, 5), MT.madeira, 0, 0, 0, false); f.rotation.x = Math.PI / 2; const pt = m(geo('cone', 0.07, 0.16, 5), MT.aco, 0, 0, 0.4, false); pt.rotation.x = Math.PI / 2; o.g.add(f, pt); }
    cena.add(o.g); return o;
  }
  function criarEfeito(ef) {
    const o = { g: grupo(ef.x - 9, 0.08, ef.y - 15) };
    if (ef.tipo === 'boom') { emitir('lasca', ef.x - 9, 0.6, ef.y - 15, 8); emitir('poeira', ef.x - 9, 0.3, ef.y - 15, 4); }
    if (ef.tipo === 'flechas') { // flechas fincadas no chão
      o.fincadas = [];
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * (ef.r || 3) * 0.9;
        const fl = grupo(Math.cos(a) * rr, 0.25, Math.sin(a) * rr);
        fl.add(m(geo('cil', 0.03, 0.03, 0.6, 5), MT.madeira, 0, 0, 0, false), m(geo('box', 0.12, 0.14, 0.02), MT.manto, 0, 0.28, 0, false));
        fl.rotation.set(0.3 * (Math.random() - 0.5), 0, 0.35); o.g.add(fl); o.fincadas.push(fl);
      }
      emitir('poeira', ef.x - 9, 0.3, ef.y - 15, 6);
    }
    if (ef.tipo === 'cura') { // cruzes verdes subindo
      o.cruzes = [0, 1, 2, 3].map(i => {
        const a = i / 4 * Math.PI * 2, c = grupo(Math.cos(a) * 0.8, 1, Math.sin(a) * 0.8);
        c.add(m(geo('box', 0.26, 0.08, 0.08), MT.cruz, 0, 0, 0, false), m(geo('box', 0.08, 0.26, 0.08), MT.cruz, 0, 0, 0, false));
        o.g.add(c); return c;
      });
    }
    if (ef.tipo === 'raio') {
      o.raio = m(geo('cil', 0.12, 0.35, 14, 6), new T.MeshBasicMaterial({ color: 0xfff6a8, transparent: true }), 0, 7, 0, false);
      o.g.add(o.raio);
    }
    if (ef.tipo !== 'hit' && ef.tipo !== 'txt') {
      const cor = ef.tipo === 'anel' ? 0xb58cff : ef.tipo === 'raio' ? 0xfff36b : ef.tipo === 'cura' ? 0x6dff9a : ef.tipo === 'flechas' ? 0xf3e2b8 : 0xffb347;
      o.anel = new T.Mesh(geo('anel', 0.82, 1), new T.MeshBasicMaterial({ color: cor, transparent: true, depthWrite: false, side: T.DoubleSide }));
      o.anel.rotation.x = -Math.PI / 2; o.g.add(o.anel);
      o.r = ef.r || 1;
    }
    if (ef.tipo === 'boom') {
      o.fumaca = [0, 1, 2, 3, 4].map(i => { const a = i / 5 * Math.PI * 2; const s = m(geo('esf', 0.3, 8, 6), new T.MeshLambertMaterial({ color: 0xcfcfcf, transparent: true }), Math.cos(a) * 0.3, 0.4, Math.sin(a) * 0.3, false); o.g.add(s); return s; });
    }
    if (ef.tipo === 'hit') { o.faisca = m(geo('esf', 0.16, 8, 6), new T.MeshBasicMaterial({ color: 0xffd34d, transparent: true }), 0, 0.7, 0, false); o.g.add(o.faisca); }
    if (ef.tipo === 'txt') {
      const t = texto(ef.txt, '#ffffff', 256, 80, 56);
      o.sprite = new T.Sprite(new T.SpriteMaterial({ map: t.tex, depthTest: false, transparent: true })); o.sprite.scale.set(2.6, 0.8, 1); o.sprite.renderOrder = 30;
      o.sprite.position.y = 4; o.g.add(o.sprite);
    }
    cena.add(o.g); return o;
  }
  function animarEfeito(ef, o) {
    const k = Math.min(1, ef.t / ef.max);
    if (o.anel) { const r = o.r * (0.3 + 0.7 * k); o.anel.scale.setScalar(r); o.anel.material.opacity = 1 - k; }
    if (o.raio) { o.raio.material.opacity = 1 - k; o.raio.scale.x = o.raio.scale.z = 1 + Math.random(); }
    if (o.fumaca) o.fumaca.forEach((s, i) => { s.scale.setScalar(0.6 + k * 1.6); s.position.y = 0.4 + k * 1.2; s.material.opacity = 0.85 * (1 - k); });
    if (o.faisca) { o.faisca.scale.setScalar(1 + k * 1.5); o.faisca.material.opacity = 1 - k; }
    if (o.sprite) { o.sprite.position.y = 4 + k * 2; o.sprite.material.opacity = 1 - k * k; }
    if (o.cruzes) o.cruzes.forEach((c, i) => { c.position.y = 0.8 + k * 1.6; c.rotation.y = relogio * 3 + i; c.scale.setScalar(1 - k * 0.6); });
    if (o.fincadas) o.fincadas.forEach(f => { f.scale.setScalar(1 - Math.max(0, k - 0.6) * 2.4); });
  }

  function desenhar(J, dt, def, mouse) {
    relogio += dt;
    agua.offset.x = (agua.offset.x + dt * 0.06) % 1;
    const vistos = new Set();
    const sync = (chave, cria) => { let o = ativos.get(chave); if (!o) { o = cria(); ativos.set(chave, o); } vistos.add(chave); return o; };
    for (const e of J.ents) atualizarObjeto(e, sync(e, () => criarObjeto(e)), dt);
    for (const p of J.proj) {
      const o = sync(p, () => criarProjetil(p));
      let ny = p.splash ? 1.1 : 1.4;
      if (o.arco) { const falta = Math.hypot(p.tx - p.x, p.ty - p.y), fr = 1 - Math.min(1, falta / o.d0); ny = 0.9 + Math.sin(fr * Math.PI) * 1.8; o.g.rotation.x += dt * 8; }
      o.g.position.set(p.x - 9, ny, p.y - 15);
      if (!o.arco) o.g.lookAt(p.tx - 9, ny, p.ty - 15);
    }
    for (const f of J.feiticos) {
      const chuva = f.key === 'flechas';
      const o = sync(f, () => {
        const g = grupo(f.x - 9, 0.07, f.y - 15);
        const d = new T.Mesh(geo('disco', f.raio), new T.MeshBasicMaterial({ color: chuva ? 0xfff3d6 : 0xfff36b, transparent: true, opacity: 0.25, depthWrite: false }));
        d.rotation.x = -Math.PI / 2; g.add(d);
        let nuvem;
        if (chuva) { // saraivada de flechas descendo
          nuvem = grupo();
          for (let i = 0; i < 18; i++) {
            const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * f.raio * 0.9;
            const fl = grupo(Math.cos(a) * rr, Math.random() * 1.2, Math.sin(a) * rr);
            fl.add(m(geo('cil', 0.03, 0.03, 0.7, 5), MT.madeira, 0, 0, 0, false), m(geo('cone', 0.06, 0.16, 5), MT.aco, 0, -0.42, 0, false));
            fl.rotation.z = 0.3; nuvem.add(fl);
          }
        } else { nuvem = MODELOS.trovao().g; nuvem.scale.setScalar(0.9); }
        g.add(nuvem); cena.add(g); return { g, d, nuvem };
      });
      o.d.material.opacity = 0.2 + 0.15 * Math.sin(relogio * 20);
      o.nuvem.position.y = chuva ? 0.4 + f.t * 11 : 2.2 + f.t * 2;
    }
    for (const ef of J.efeitos) {
      const o = sync(ef, () => criarEfeito(ef));
      ef.t += dt; animarEfeito(ef, o);
    }
    J.efeitos = J.efeitos.filter(ef => ef.t < ef.max);
    for (const [chave, o] of ativos) if (!vistos.has(chave)) { remover(o); ativos.delete(chave); }
    // prévia de onde a carta vai cair
    zonaProibida.visible = !!(def && def.tipo !== 'feitico');
    fantasma.visible = anelFantasma.visible = !!(def && mouse);
    if (def && mouse) {
      const ok = J.podeColocar(0, def, mouse.x, mouse.y);
      const r = def.tipo === 'feitico' ? def.raio : (def.radius || 0.6) + 0.25;
      fantasma.position.set(mouse.x - 9, 0.08, mouse.y - 15); fantasma.scale.setScalar(r);
      anelFantasma.position.copy(fantasma.position); anelFantasma.scale.setScalar(r);
      fantasma.material.color.setHex(ok ? 0xffffff : 0xff4f4f); anelFantasma.material.color.setHex(ok ? 0xffffff : 0xff4f4f);
    }
    animarParticulas(dt);
    tochas.forEach((c, i) => { const s = 1 + Math.sin(relogio * 14 + i * 2) * 0.15 + Math.random() * 0.08; c.scale.set(s, s * 1.1, s); });
    if (camBase) { // tremor da tela quando uma torre cai
      tremor = Math.max(0, tremor - dt);
      cam.position.copy(camBase);
      if (tremor > 0) cam.position.add(new T.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.5, Math.random() - 0.5).multiplyScalar(tremor * 0.9));
    }
    renderer.render(cena, cam);
  }
  function limpar() {
    for (const [, o] of ativos) remover(o); ativos.clear();
    particulas.forEach(p => { cena.remove(p.m); p.m.material.dispose(); }); particulas.length = 0; tremor = 0;
  }

  /* ---------- retratos das cartas ---------- */
  const retratos = {};
  function retrato(chave) {
    if (retratos[chave]) return retratos[chave];
    try {
      const rr = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      rr.setSize(160, 160, false);
      const sc = new T.Scene();
      sc.add(new T.HemisphereLight(0xffffff, 0x777777, 0.9));
      const l = new T.DirectionalLight(0xffffff, 0.7); l.position.set(2, 4, 5); sc.add(l);
      const mod = MODELOS[chave](0);
      mod.g.rotation.y = 0.55;
      sc.add(mod.g);
      const h = mod.alt;
      const c = new T.PerspectiveCamera(30, 1, 0.1, 50);
      c.position.set(0, h * 0.75, h * 2.25); c.lookAt(0, h * 0.47, 0);
      rr.render(sc, c);
      retratos[chave] = rr.domElement.toDataURL('image/png');
      rr.dispose(); if (rr.forceContextLoss) rr.forceContextLoss();
    } catch (e) { retratos[chave] = null; }
    return retratos[chave];
  }

  /* ---------- vitrine: batalha de fundo da tela de início ---------- */
  function criarVitrine(canvas) {
    if (!cena) return null;
    let rr;
    try {
      rr = new T.WebGLRenderer({ canvas, antialias: true });
      rr.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      rr.shadowMap.enabled = true; rr.shadowMap.type = T.PCFSoftShadowMap;
    } catch (e) { return null; }
    const camV = new T.PerspectiveCamera(45, 1, 0.5, 300);
    const g = grupo(); g.visible = false; cena.add(g);
    const pos = (o, x, z, ry) => { o.position.set(x, 0, z); o.rotation.y = ry || 0; g.add(o); return o; };
    pos(torreRei(0), 0, 12.8); pos(torreRei(1), 0, -12.8);
    [-5.5, 5.5].forEach(x => { pos(torreLateral(0), x, 10.5); pos(torreLateral(1), x, -10.5); });
    const lutadores = [];
    const add = (k, team, x, z, ry) => {
      const mod = MODELOS[k](team);
      mod.g.scale.setScalar(mod.escala * 1.5); pos(mod.g, x, z, ry);
      mod.fase = Math.random() * 6; lutadores.push(mod); return mod;
    };
    // azuis (vindo de baixo, olhando para cima) contra vermelhos
    add('guerreiro', 0, -5.3, 1.9, Math.PI); add('cavaleiro', 0, 5.6, 2.6, Math.PI);
    add('feiticeira', 0, -2.6, 4.6, Math.PI + 0.3); add('besteiros', 0, 2.6, 5.0, Math.PI - 0.2);
    add('lanceiros', 0, -6.8, 3.6, Math.PI + 0.2);
    add('golem', 1, -5.6, -2.3, 0); add('guerreiro', 1, 5.4, -1.9, 0);
    add('lanceiros', 1, -3.4, -3.8, -0.3); add('lanceiros', 1, -2.4, -4.4, -0.2);
    add('feiticeira', 1, 3.2, -4.8, 0.2);
    // trovão que cai de tempos em tempos no lado vermelho
    const raio = m(geo('cil', 0.14, 0.4, 14, 6), new T.MeshBasicMaterial({ color: 0xfff6a8, transparent: true }), 0, 7, 0, false);
    const anel = new T.Mesh(geo('anel', 0.82, 1), new T.MeshBasicMaterial({ color: 0xfff36b, transparent: true, depthWrite: false, side: T.DoubleSide }));
    anel.rotation.x = -Math.PI / 2;
    const golpe = grupo(); golpe.add(raio, anel); g.add(golpe);
    const faiscas = [-5.4, 5.5].map(x => { const s = m(geo('esf', 0.18, 8, 6), new T.MeshBasicMaterial({ color: 0xffd34d, transparent: true }), x, 1.4, 0, false); g.add(s); return s; });
    g.traverse(c => { if (c.isMesh) { c.receiveShadow = true; } });

    let rodando = false;
    function quadro() {
      if (!rodando) return;
      requestAnimationFrame(quadro);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      const pr = rr.getPixelRatio();
      if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) rr.setSize(w, h, false);
      const t = performance.now() / 1000, retrato = h > w;
      camV.aspect = w / h; camV.fov = retrato ? 62 : 42; camV.updateProjectionMatrix();
      const a = Math.sin(t * 0.13) * 0.55, R = retrato ? 17 : 19;
      camV.position.set(Math.sin(a) * R, retrato ? 9 : 7.5, Math.cos(a) * R);
      camV.lookAt(0, retrato ? -1.5 : 0.8, 0);
      agua.offset.x = (agua.offset.x + 0.001) % 1;
      for (const L of lutadores) {
        const k = Math.max(0, Math.sin(t * 3 + L.fase)) ** 3;
        if (L.corpo && L.corpo !== L.g) L.corpo.position.y = Math.abs(Math.sin(t * 6 + L.fase)) * 0.05;
        const b = L.base || {};
        if (!L.bracoD) continue;
        if (L.atk === 'golpe') L.bracoD.rotation.x = -0.3 - 1.9 * k;
        else if (L.atk === 'pancada') { L.bracoD.rotation.x = -1.7 * k; L.bracoE.rotation.x = -1.7 * k; }
        else if (L.atk === 'estocada') L.bracoD.rotation.x = (b.d || 0) - 0.9 * k;
        else if (L.atk === 'magia') L.bracoD.rotation.x = -0.4 - 1.3 * k;
        else if (L.atk === 'tiro') L.bracoD.rotation.x = (b.d || 0) + 0.25 * k;
      }
      faiscas.forEach((s, i) => { const k = Math.max(0, Math.sin(t * 6 + i * 2)); s.scale.setScalar(0.3 + k * 1.8); s.material.opacity = k; });
      const ciclo = (t % 4.5) / 0.6; // 0..1 durante o raio
      golpe.visible = ciclo < 1;
      if (golpe.visible) {
        golpe.position.set(((Math.floor(t / 4.5) % 2) ? 3.5 : -3.8), 0.08, -4.2);
        raio.material.opacity = 1 - ciclo; raio.scale.x = raio.scale.z = 1 + Math.random();
        anel.scale.setScalar(0.5 + 2.2 * ciclo); anel.material.opacity = 1 - ciclo;
      }
      g.visible = true;
      rr.render(cena, camV);
      g.visible = false;
    }
    return {
      ligar() { if (rodando) return; limpar(); rodando = true; requestAnimationFrame(quadro); },
      desligar() { rodando = false; },
    };
  }

  window.Render3D = {
    vitrine: criarVitrine,
    iniciar(canvas) {
      try {
        cv = canvas;
        renderer = new T.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
        cena = new T.Scene(); cena.background = new T.Color(0x3f6f2c);
        cam = new T.PerspectiveCamera(40, 1, 0.5, 300);
        ray = new T.Raycaster(); plano = new T.Plane(new T.Vector3(0, 1, 0), 0);
        montarCenario();
        return true;
      } catch (e) { console.warn('3D indisponível', e); return false; }
    },
    redimensionar(w, h) { if (!renderer || w <= 0 || h <= 0) return; renderer.setSize(w, h, false); enquadrar(w, h); },
    desenhar, limpar, retrato,
    escolher(cx, cy) {
      const r = cv.getBoundingClientRect();
      const ndc = new T.Vector2((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const p = new T.Vector3();
      if (!ray.ray.intersectPlane(plano, p)) return null;
      return { x: p.x + 9, y: p.z + 15 };
    },
  };
})();
