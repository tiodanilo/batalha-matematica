/* Gerador de perguntas da Arena do Caderno.
   Cada pergunta: { tema, texto, resposta, opcoes[4] } — as opções são textos prontos para a tela.
   nivel = ano - 6 (6º ano = 0 ... 9º ano = 3). Temas com "desde" sobem o nível até esse ano. */
(function (root) {
  'use strict';
  const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const M = '−'; // sinal de menos tipográfico
  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = n => String(n).split('').map(c => SUP[c]).join('');
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  const lcm = (a, b) => a / gcd(a, b) * b;

  function num(n) {
    if (Object.is(n, -0)) n = 0;
    let s;
    if (Number.isInteger(n)) {
      s = String(Math.abs(n));
      if (Math.abs(n) >= 10000) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // 100.000
    } else s = String(Math.round(Math.abs(n) * 10000) / 10000).replace('.', ',');
    return (n < 0 ? M : '') + s;
  }
  const sinal = n => (n < 0 ? '(' + num(n) + ')' : '(+' + n + ')');
  const fr = (n, d) => ({ t: n + '/' + d, v: n / d });
  // fração já na forma irredutível (inteiro aparece sem barra)
  const frS = (n, d) => { const g = gcd(n, d); n /= g; d /= g; return Object.assign(d === 1 ? { t: String(n), v: n } : fr(n, d), { nu: n, de: d }); };
  const xs = c => (c === 1 ? 'x' : c + 'x');

  function item(x, suf) {
    return typeof x === 'number' ? { t: num(x) + (suf || ''), v: x, n: true } : { t: x.t + (suf || ''), v: x.v };
  }
  function embaralhar(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  // Monta as 4 opções: a certa + erros típicos (sorteados) + (se faltar) números vizinhos.
  // Regra anti-chute: a certa nunca pode ser a média de duas outras opções.
  function montar(texto, correta, erradas, cfg) {
    cfg = cfg || {};
    const c = item(correta, cfg.suf);
    const lista = [c];
    const tenta = x => {
      if (lista.length >= 4) return;
      const it = item(x, cfg.suf);
      if (!Number.isFinite(it.v)) return;
      if (!cfg.neg && c.v >= 0 && it.v < 0) return;
      if (!cfg.passo && it.n && c.n && Number.isInteger(c.v) && !Number.isInteger(it.v)) return;
      if (cfg.positivo && it.v <= 0) return;
      if (lista.some(o => Math.abs(o.v - it.v) < 1e-9 || o.t === it.t)) return;
      if (lista.some(o => o !== c && Math.abs(2 * c.v - o.v - it.v) < 1e-9)) return;
      lista.push(it);
    };
    embaralhar(erradas.slice()).forEach(tenta);
    if (typeof correta === 'number') {
      const p = cfg.passo || 1;
      embaralhar([1, -1, 2, -2, 10, -10, 3, -3, 5, -5, 4, -4, 20, -20, 6, -6])
        .forEach(k => tenta(Math.round((correta + k * p) * 10000) / 10000));
    } else if (correta.nu) { // fração: numeradores vizinhos com o mesmo denominador
      embaralhar([1, -1, 2, -2, 3, -3, 4]).forEach(k => { if (correta.nu + k > 0) tenta(frS(correta.nu + k, correta.de)); });
    }
    return { texto, resposta: c.t, opcoes: embaralhar(lista.map(o => o.t)) };
  }

  const digitos = n => String(n).split('').reverse().map(Number);
  function semVaiUm(a, b) {
    const da = digitos(a), db = digitos(b); let r = 0;
    for (let i = 0; i < Math.max(da.length, db.length); i++) r += (((da[i] || 0) + (db[i] || 0)) % 10) * 10 ** i;
    return r;
  }
  function menorDoMaior(a, b) {
    const da = digitos(a), db = digitos(b); let r = 0;
    for (let i = 0; i < da.length; i++) r += Math.abs((da[i] || 0) - (db[i] || 0)) * 10 ** i;
    return r;
  }

  const G = {};

  G.tabuada = n => {
    const max = n >= 2 ? 12 : 10, a = R(2, max), b = R(2, max);
    return montar(`${a} × ${b} = ?`, a * b, [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, a + b]);
  };

  G.adicao = n => {
    let a, b;
    if (n === 0) { a = R(15, 99); b = R(15, 99); }
    else if (n === 1) { a = R(100, 999); b = R(15, 99); }
    else { a = R(100, 999); b = R(100, 999); }
    const s = a + b;
    return montar(`${a} + ${b} = ?`, s, [semVaiUm(a, b), s + 10, s - 10, s + 1, s - 1, s + 100, s - 100]);
  };

  G.subtracao = n => {
    let a, b;
    if (n === 0) { a = R(30, 99); b = R(11, 89); }
    else if (n === 1) { a = R(100, 999); b = R(15, 99); }
    else { a = R(300, 999); b = R(100, 899); }
    if (a < b) [a, b] = [b, a];
    if (a === b) a += R(1, 9);
    const d = a - b;
    return montar(`${a} ${M} ${b} = ?`, d, [menorDoMaior(a, b), d + 10, d - 10, d + 1, d - 1]);
  };

  G.multiplicacao = n => {
    let a, b;
    if (n === 0) { a = R(11, 30); b = R(2, 9); }
    else if (n === 1) { a = R(12, 99); b = R(2, 9); }
    else { a = R(11, 30); b = pick([11, 12, 15, 20, 21, 25]); }
    const p = a * b;
    const e = [p + 10, p - 10, p + a, p - a, p + b, p - b];
    if (b >= 10) e.push(a * (b % 10) + a * Math.floor(b / 10)); // esqueceu de deslocar a 2ª linha
    return montar(`${a} × ${b} = ?`, p, e);
  };

  G.divisao = n => {
    const b = R(2, n >= 2 ? 12 : 9), q = R(2, n === 0 ? 12 : 25), a = b * q;
    return montar(`${a} ÷ ${b} = ?`, q, [q + 1, q - 1, q + 10, q - 10, q + 2, q - 2]);
  };

  G.inteiros = n => {
    const lim = n <= 1 ? 12 : 20;
    const nz = (a, b) => { let v = 0; while (v === 0) v = R(a, b); return v; };
    const op = pick(n <= 1 ? ['+', '−', '+', '−', '×', '÷'] : ['+', '−', '×', '÷']);
    let x, y, r, err;
    if (op === '+') { x = nz(-lim, lim); y = nz(-lim, lim); r = x + y; err = [-(x + y), x - y, y - x, Math.abs(x) + Math.abs(y), -(Math.abs(x) + Math.abs(y))]; }
    else if (op === '−') { x = nz(-lim, lim); y = nz(-lim, lim); r = x - y; err = [x + y, -(x - y), -(x + y)]; }
    else if (op === '×') { x = R(2, 10) * pick([1, -1]); y = R(2, 10) * pick([1, -1]); r = x * y; err = [-r, x + y, -(x + y)]; }
    else { y = R(2, 9) * pick([1, -1]); const q = R(1, 10) * pick([1, -1]); x = y * q; r = q; err = [-q, q + 1, q - 1, -q + 1, -q - 1]; }
    return montar(`${sinal(x)} ${op} ${sinal(y)} = ?`, r, err, { neg: true });
  };

  G.decimais = n => {
    const tipos = n === 0 ? ['soma', 'sub'] : n === 1 ? ['soma', 'sub', 'mista', 'pot10'] : ['soma', 'mista', 'pot10', 'vezes'];
    const t = pick(tipos);
    const D = (a, b) => { let v; do { v = R(a, b); } while (v % 10 === 0); return v; }; // sempre com vírgula
    if (t === 'soma') {
      const A = D(1, 99), B = D(1, 99), r = (A + B) / 10;
      const e = [(A + B) / 100, (A + B + 10) / 10, (A + B - 10) / 10, (A + B + 1) / 10];
      const dd = A % 10 + B % 10; // erro do "vai-um na vírgula": 2,7 + 1,5 → 3,12
      if (dd >= 10) e.push(Math.floor(A / 10) + Math.floor(B / 10) + dd / 100);
      return montar(`${num(A / 10)} + ${num(B / 10)} = ?`, r, e, { passo: 0.1 });
    }
    if (t === 'sub') {
      let A = D(20, 99), B = D(1, 99); if (A < B) [A, B] = [B, A]; if (A === B) A = A % 10 === 9 ? A + 2 : A + 1;
      return montar(`${num(A / 10)} ${M} ${num(B / 10)} = ?`, (A - B) / 10, [(A - B) / 100, (A - B + 10) / 10, (A - B - 10) / 10, (A + B) / 10], { passo: 0.1 });
    }
    if (t === 'mista') { // décimos + centésimos: erro clássico é "alinhar pela direita"
      const A = R(1, 9), B = D(11, 99);
      return montar(`${num(A / 10)} + ${num(B / 100)} = ?`, (10 * A + B) / 100, [(A + B) / 100, (10 * A + B) / 10, (10 * A + B) / 1000], { passo: 0.01 });
    }
    if (t === 'pot10') {
      const A = D(11, 999), k = pick([10, 100]), r = A * k / 100;
      return montar(`${num(A / 100)} × ${k} = ?`, r, [r * 10, r / 10, A / 100 + k, r / 100], { passo: 0.1 });
    }
    const A = D(11, 49), m = R(2, 9), r = A * m / 10;
    const partes = Math.floor(A / 10) * m + ((A % 10) * m) / 100; // 2,3 × 4 → 8,12
    return montar(`${num(A / 10)} × ${m} = ?`, r, [partes, A * m / 100, r + 1, r - 1], { passo: 0.1 });
  };

  G.fracoes = n => {
    const tipos = n === 0 ? ['de', 'soma', 'sub', 'equiv', 'somaDif'] : n === 1 ? ['de', 'soma', 'sub', 'equiv', 'simp', 'somaDif']
      : ['de', 'sub', 'simp', 'somaDif', 'somaDif'];
    const t = pick(tipos);
    if (t === 'de') {
      const den = pick([2, 3, 4, 5, 6, 8, 10]); let nu; do { nu = R(1, den - 1); } while (gcd(nu, den) !== 1);
      const k = R(2, 10), base = den * k, r = nu * k;
      return montar(`${nu}/${den} de ${base} = ?`, r, [k, base - r, r + k, base / nu, nu * base]);
    }
    if (t === 'soma') {
      const den = R(3, 12); let a, b; do { a = R(1, den - 1); b = R(1, den - 1); } while (a + b === den);
      return montar(`${a}/${den} + ${b}/${den} = ?`, frS(a + b, den),
        [frS(a + b, 2 * den), frS(a + b, den * den), frS(a * b, den), frS(a + b + 1, den), frS(a + b - 1, den)]);
    }
    if (t === 'sub') {
      let den, a, b; do { den = R(4, 12); a = R(2, den - 1); b = R(1, a - 1); } while (a - b <= 0);
      const e = [frS(a + b, den), frS(a - b + 1, den), frS(a - b, 2 * den), frS(a - b, den * den)];
      if (a - b - 1 > 0) e.push(frS(a - b - 1, den));
      return montar(`${a}/${den} ${M} ${b}/${den} = ?`, frS(a - b, den), e);
    }
    if (t === 'equiv') {
      const b = R(2, 9), a = R(1, b - 1), k = R(2, 6);
      return montar(`${a}/${b} = ?/${b * k}`, a * k, [a + (b * k - b), a + k, a * k + 1, a * k - 1]);
    }
    if (t === 'simp') {
      let a, b; do { b = R(3, 9); a = R(1, b - 1); } while (gcd(a, b) !== 1);
      const k = R(2, 5);
      return montar(`Simplifique ${a * k}/${b * k}`, fr(a, b), [fr(a * k, b), fr(a, b * k), fr(b, a), fr(a + 1, b), fr(a, b + 1)]);
    }
    let d1, d2, a, b;
    if (n === 0) { // 6º ano: um denominador é múltiplo do outro (1/2 + 1/4)
      do { d1 = pick([2, 3, 4]); d2 = d1 * pick([2, 3]); a = R(1, d1 - 1); b = R(1, d2 - 1); } while (gcd(a, d1) !== 1 || gcd(b, d2) !== 1);
      if (Math.random() < 0.5) [d1, d2, a, b] = [d2, d1, b, a];
    } else {
      do { d1 = R(2, 6); d2 = R(2, 6); a = R(1, d1 - 1); b = R(1, d2 - 1); } while (d1 === d2 || gcd(a, d1) !== 1 || gcd(b, d2) !== 1);
    }
    const nu = a * d2 + b * d1, de = d1 * d2;
    const r = frS(nu, de);
    return montar(`${a}/${d1} + ${b}/${d2} = ?`, r,
      [frS(a + b, d1 + d2), frS(a + b, de), frS(a + b, Math.max(d1, d2)), frS(a * b, de), frS(nu + 1, de)]);
  };

  G.porcentagem = n => {
    const ps = n === 0 ? [10, 50, 25, 20] : n === 1 ? [5, 10, 15, 20, 25, 30, 40, 50, 60, 75] : [5, 10, 15, 20, 25, 30, 40, 60, 75, 120];
    const p = pick(ps), un = 100 / gcd(p, 100);
    const base = un * R(1, Math.max(1, Math.floor(400 / un))), r = p * base / 100;
    const t = n === 0 ? 'de' : pick(n === 1 ? ['de', 'de', 'desc'] : ['de', 'desc', 'aum']);
    if (t === 'desc' && p < 100) return montar(`R$ ${base} com ${p}% de desconto. Quanto fica, em R$?`, base - r, [r, base + r, base - p, base - r + 10]);
    if (t === 'aum' && p < 100) return montar(`R$ ${base} com aumento de ${p}%. Quanto fica, em R$?`, base + r, [r, base - r, base + p, base + r + 10]);
    return montar(`${p}% de ${base} = ?`, r, [base - r, r * 2, r * 10, r / 2, r / 10, r - 10, base / p]);
  };

  G.proporcao = n => {
    const t = n >= 1 ? pick(['preco', 'preco', 'inversa']) : 'preco';
    if (t === 'preco') {
      const [it, pmin, pmax] = pick([['cadernos', 8, 20], ['canetas', 2, 6], ['bombons', 1, 4], ['sucos', 3, 8], ['lápis', 1, 3], ['pães', 1, 3]]);
      const u = R(pmin, pmax), a = R(2, 6); let b; do { b = R(2, 12); } while (b === a);
      return montar(`${a} ${it} custam R$ ${a * u}. Quanto custam ${b} ${it}, em R$?`, b * u, [a * u + (b - a), a * u * b, b * u + u, b * u - u]);
    }
    let w1, d1, w2;
    do { w1 = R(2, 8); d1 = R(2, 12); w2 = R(2, 12); } while (w2 === w1 || (w1 * d1) % w2 !== 0);
    const r = w1 * d1 / w2;
    return montar(`${w1} pedreiros fazem um muro em ${d1} dias. Em quantos dias ${w2} pedreiros fazem esse muro?`, r,
      [Math.round(d1 * w2 / w1 * 100) / 100, r + 1, r - 1, d1 + (w2 - w1)], { positivo: true });
  };

  G.potencias = n => {
    const tipos = n === 0 ? ['quad', 'cubo', 'raiz', 'dez'] : n === 1 ? ['quad', 'cubo', 'raiz', 'dois', 'zero', 'negq'] : ['dois', 'raiz', 'zero', 'negq', 'negc', 'cubo'];
    const t = pick(tipos);
    if (t === 'quad') { const a = R(2, 12); return montar(`${a}${sup(2)} = ?`, a * a, [2 * a, a + 2, a * a + 1, a * a - 1]); }
    if (t === 'cubo') { const a = R(2, 5); return montar(`${a}${sup(3)} = ?`, a ** 3, [3 * a, a * a, a + 3, a * a * 2]); }
    if (t === 'raiz') { const a = R(2, n === 0 ? 10 : 15); return montar(`√${a * a} = ?`, a, [a * a / 2, a + 1, a - 1, 2 * a]); }
    if (t === 'dez') { const k = R(2, 5); return montar(`10${sup(k)} = ?`, 10 ** k, [10 * k, 10 ** (k + 1), 10 ** (k - 1), k * 100]); }
    if (t === 'dois') { const k = R(3, n === 1 ? 7 : 10); return montar(`2${sup(k)} = ?`, 2 ** k, [2 * k, 2 ** (k + 1), 2 ** (k - 1), k * k]); }
    if (t === 'zero') { const a = R(2, 99); return montar(`${a}${sup(0)} = ?`, 1, [0, a, 10]); }
    if (t === 'negq') { const a = R(2, 9); return montar(`(${M}${a})${sup(2)} = ?`, a * a, [-a * a, -2 * a, 2 * a], { neg: true }); }
    const a = R(2, 5); return montar(`(${M}${a})${sup(3)} = ?`, -(a ** 3), [a ** 3, -3 * a, 3 * a], { neg: true });
  };

  G.expressoes = n => {
    const tipos = n === 0 ? [1, 2, 3, 4] : n === 1 ? [1, 2, 3, 4, 5] : [1, 3, 4, 5, 6, 7];
    const t = pick(tipos), a = R(2, 9), b = R(2, 9), c = R(2, 9), d = R(2, 9);
    if (t === 1) return montar(`${a} + ${b} × ${c} = ?`, a + b * c, [(a + b) * c, a * b + c, a + b + c]);
    if (t === 2) { const cc = R(1, a * b - 1); return montar(`${a} × ${b} ${M} ${cc} = ?`, a * b - cc, [a * (b - cc), a * b + cc, a + b - cc]); }
    if (t === 3) return montar(`(${a} + ${b}) × ${c} = ?`, (a + b) * c, [a + b * c, a * b + c, a + b + c]);
    if (t === 4) { // aa − bb ÷ c, montado para o erro "da esquerda para a direita" dar inteiro
      const q = R(2, 9), bb = c * q, aa = bb + c * R(1, 5);
      return montar(`${aa} ${M} ${bb} ÷ ${c} = ?`, aa - q, [(aa - bb) / c, aa - bb, aa + q]);
    }
    if (t === 5) { const r = a + b * c - d; return montar(`${a} + ${b} × ${c} ${M} ${d} = ?`, r, [(a + b) * c - d, a + b * (c - d), r + d]); }
    if (t === 6) return montar(`${a}${sup(2)} + ${b} × ${c} = ?`, a * a + b * c, [(a * a + b) * c, 2 * a + b * c, a * a + b + c]);
    let bb = R(5, 12), cc = R(1, bb - 1);
    return montar(`[${a} + (${bb} ${M} ${cc})] × ${d} = ?`, (a + bb - cc) * d, [a + (bb - cc) * d, (a + bb + cc) * d, a + bb - cc * d]);
  };

  G.equacoes = n => {
    const tipos = n === 0 ? ['soma', 'mult'] : n === 1 ? ['soma', 'mult', 'completa', 'menos'] : n === 2 ? ['completa', 'menos', 'ambos'] : ['completa', 'menos', 'ambos', 'ambos'];
    const t = pick(tipos);
    let x = R(1, 12);
    if (n === 3 && Math.random() < 0.4) x = -R(1, 9);
    const neg = { neg: true }, fim = '  →  x = ?';
    if (t === 'soma') { const b = R(2, 30), c = x + b; return montar(`x + ${b} = ${num(c)}${fim}`, x, [c + b, x + 1, x - 1, -x, b], neg); }
    if (t === 'mult') {
      const a = R(2, 9), c = a * x;
      const lado = n === 0 ? `${a} × x` : `${a}x`; // no 6º ano, sem a notação 4x
      return montar(`${lado} = ${num(c)}${fim}`, x, [c - a, c * a, x + 1, x - 1], neg);
    }
    const a = R(2, 9), b = R(1, 20);
    if (t === 'completa') { const c = a * x + b; return montar(`${a}x + ${b} = ${num(c)}${fim}`, x, [(c + b) / a, c - b, x + 1, x - 1, -x], neg); }
    if (t === 'menos') { const c = a * x - b; return montar(`${a}x ${M} ${b} = ${num(c)}${fim}`, x, [(c - b) / a, c + b, x + 1, x - 1, -x], neg); }
    let cc; do { cc = R(1, 8); } while (cc === a);
    const d = a * x + b - cc * x;
    const ds = d < 0 ? `${M} ${-d}` : `+ ${d}`;
    const lado = d === 0 ? xs(cc) : `${xs(cc)} ${ds}`;
    return montar(`${a}x + ${b} = ${lado}${fim}`, x, [(d - b) / (a + cc), (b - d) / (a - cc), x + 1, x - 1, -x], neg);
  };

  G.mmcmdc = n => {
    const lim = n === 0 ? 12 : 15;
    if (Math.random() < 0.5) {
      let a, b; do { a = R(2, lim); b = R(2, lim); } while (a === b);
      const m = lcm(a, b); return montar(`MMC(${a}, ${b}) = ?`, m, [a * b, gcd(a, b), a + b, m * 2]);
    }
    let a, b; const g = R(2, 6); do { a = g * R(1, 6); b = g * R(1, 6); } while (a === b);
    const m = gcd(a, b); return montar(`MDC(${a}, ${b}) = ?`, m, [lcm(a, b), 1, Math.min(a, b), m / 2, Math.min(a, b) / 2]);
  };

  G.areas = n => {
    const tipos = n === 0 ? ['ret', 'quad', 'perRet', 'perQuad'] : n === 1 ? ['ret', 'quad', 'perRet', 'tri', 'para'] : ['ret', 'tri', 'para', 'trap', 'los'];
    const t = pick(tipos), A = { suf: ' cm²', positivo: true }, P = { suf: ' cm', positivo: true };
    if (t === 'ret') { const b = R(3, 15), h = R(2, 12); return montar(`Área do retângulo de base ${b} cm e altura ${h} cm`, b * h, [2 * (b + h), b + h, b * h * 2, b * h / 2], A); }
    if (t === 'quad') { const l = R(2, 15); return montar(`Área do quadrado de lado ${l} cm`, l * l, [4 * l, 2 * l, l + l + l], A); }
    if (t === 'perRet') { const b = R(3, 15), h = R(2, 12); return montar(`Perímetro do retângulo de base ${b} cm e altura ${h} cm`, 2 * (b + h), [b * h, b + h, 2 * b + h], P); }
    if (t === 'perQuad') { const l = R(2, 15); return montar(`Perímetro do quadrado de lado ${l} cm`, 4 * l, [l * l, 2 * l, 3 * l], P); }
    if (t === 'tri') { let b, h; do { b = R(3, 16); h = R(2, 12); } while ((b * h) % 2); return montar(`Área do triângulo de base ${b} cm e altura ${h} cm`, b * h / 2, [b * h, b + h, 2 * b * h], A); }
    if (t === 'para') { const b = R(3, 15), h = R(2, 12); return montar(`Área do paralelogramo de base ${b} cm e altura ${h} cm`, b * h, [b * h / 2, 2 * (b + h), b + h], A); }
    if (t === 'trap') {
      let B, b, h; do { B = R(6, 16); b = R(2, B - 2); h = R(2, 10); } while (((B + b) * h) % 2);
      return montar(`Área do trapézio de bases ${B} cm e ${b} cm, e altura ${h} cm`, (B + b) * h / 2, [(B + b) * h, B * h, B * b * h / 2], A);
    }
    let D, d; do { D = R(4, 16); d = R(2, D - 1); } while ((D * d) % 2);
    return montar(`Área do losango de diagonais ${D} cm e ${d} cm`, D * d / 2, [D * d, D + d, 2 * (D + d)], A);
  };

  G.angulos = n => {
    const tipos = n <= 1 ? ['comp', 'sup', 'tri'] : ['comp', 'sup', 'tri', 'poli'];
    const t = pick(tipos), S = { suf: '°', positivo: true };
    // ±10° imita o erro de "emprestar" na subtração (90 − 37 → 63 ou 43)
    if (t === 'comp') { const a = R(5, 85), r = 90 - a; return montar(`Complemento de um ângulo de ${a}°`, r, [180 - a, a, 360 - a, r + 10, r - 10], S); }
    if (t === 'sup') { const a = R(5, 175), r = 180 - a; return montar(`Suplemento de um ângulo de ${a}°`, r, [90 - a, 360 - a, a, r + 10, r - 10], S); }
    if (t === 'tri') { let a, b; do { a = R(20, 100); b = R(20, 100); } while (a + b > 160); return montar(`Um triângulo tem ângulos de ${a}° e ${b}°. Quanto mede o terceiro?`, 180 - a - b, [90 - a - b, 360 - a - b, a + b, 180 - a, 170 - a - b, 190 - a - b], S); }
    const L = R(5, 10);
    return montar(`Soma dos ângulos internos de um polígono de ${L} lados`, (L - 2) * 180, [L * 180, (L - 1) * 180, 360, (L - 3) * 180, L * 90], S);
  };

  // A ORDEM desta lista não pode mudar: ela forma o código da turma.
  // "desde": ano da BNCC em que o conteúdo começa; em turmas anteriores, usa as perguntas desse ano.
  const TEMAS = [
    { id: 'tabuada', nome: 'Tabuada', icone: '✖️' },
    { id: 'adicao', nome: 'Adição', icone: '➕' },
    { id: 'subtracao', nome: 'Subtração', icone: '➖' },
    { id: 'multiplicacao', nome: 'Multiplicação', icone: '🔢' },
    { id: 'divisao', nome: 'Divisão', icone: '➗' },
    { id: 'inteiros', nome: 'Números inteiros', icone: '🌡️', desde: 7 },
    { id: 'decimais', nome: 'Números decimais', icone: '🪙' },
    { id: 'fracoes', nome: 'Frações', icone: '🍕' },
    { id: 'porcentagem', nome: 'Porcentagem', icone: '💯' },
    { id: 'proporcao', nome: 'Razão e proporção', icone: '⚖️' },
    { id: 'potencias', nome: 'Potências e raízes', icone: '🚀' },
    { id: 'expressoes', nome: 'Expressões numéricas', icone: '🧩' },
    { id: 'equacoes', nome: 'Equações do 1º grau', icone: '🔍' },
    { id: 'mmcmdc', nome: 'MMC e MDC', icone: '🔗' },
    { id: 'areas', nome: 'Áreas e perímetros', icone: '📐' },
    { id: 'angulos', nome: 'Ângulos', icone: '📏', desde: 7 },
  ];

  function nivelDe(id, ano) {
    const t = TEMAS.find(x => x.id === id);
    const a = Math.max(ano || 7, (t && t.desde) || 6);
    return Math.max(0, Math.min(3, a - 6));
  }
  function gerarTema(id, ano) { const q = G[id](nivelDe(id, ano)); q.tema = id; return q; }
  function gerar(temas, ano) { return gerarTema(pick(temas), ano); }

  const api = { TEMAS, gerar, gerarTema };
  root.Perguntas = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
