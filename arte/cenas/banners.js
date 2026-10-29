// Gera os sprites dos banners (app/src/renderer/img/pixel/cenas/*.png) no estilo da ampulheta e do martelo da
// Thainá: contorno quase preto puxado para a cor do material, 3 a 5 tons com a luz de cima à esquerda, brilho de
// 1 pixel na borda acesa e textura em xadrez na madeira. A luz de cada cena (lanterna, forja, luar...) é aplicada
// no launcher (cenas-pixel.js), por cima destes sprites.
// Uso: node arte/cenas/banners.js
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const SAIDA = path.join(__dirname, "../../app/src/renderer/img/pixel/cenas");

// ---------- PNG (RGBA, sem dependências)
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function bloco(tipo, dados) {
  const t = Buffer.from(tipo), l = Buffer.alloc(4), c = Buffer.alloc(4);
  l.writeUInt32BE(dados.length); c.writeUInt32BE(crc(Buffer.concat([t, dados]))); return Buffer.concat([l, t, dados, c]);
}
function png(s) {
  const raw = Buffer.alloc((s.w * 4 + 1) * s.h);
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const c = s.get(x, y), i = y * (s.w * 4 + 1) + 1 + x * 4;
    if (c) { raw[i] = parseInt(c.slice(1, 3), 16); raw[i + 1] = parseInt(c.slice(3, 5), 16); raw[i + 2] = parseInt(c.slice(5, 7), 16); raw[i + 3] = 255; }
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(s.w); ih.writeUInt32BE(s.h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco("IHDR", ih), bloco("IDAT", zlib.deflateSync(raw, { level: 9 })), bloco("IEND", Buffer.alloc(0))]);
}

// ---------- sprite: uma grade de cores "#rrggbb" ou null
class Spr {
  constructor(w, h) { this.w = w; this.h = h; this.c = new Array(w * h).fill(null); }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.c[y * this.w + x]; }
  set(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = c; }
  ret(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, typeof c === "function" ? c(x + i, y + j) : c); }
  // desenho por texto: cada letra vira uma cor da legenda; '.' fica como está
  grade(x, y, linhas, leg) { linhas.forEach((l, j) => [...l].forEach((ch, i) => { if (ch !== ".") this.set(x + i, y + j, leg[ch]); })); }
  cola(o, x, y) { for (let j = 0; j < o.h; j++) for (let i = 0; i < o.w; i++) { const c = o.get(i, j); if (c) this.set(x + i, y + j, c); } }
  // contorno por fora (4 vizinhos) só onde está vazio
  contorno(cor) {
    const novos = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++)
      if (!this.get(x, y) && (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1))) novos.push([x, y]);
    novos.forEach(([x, y]) => this.set(x, y, cor));
  }
}
const tira = (quadros) => { const w = quadros[0].w, h = quadros[0].h, s = new Spr(w * quadros.length, h); quadros.forEach((q, i) => s.cola(q, i * w, 0)); return s; };
const sorte = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

// forma por linhas: { y: [x0, x1] } -> pinta cada pixel com tom(x, y, borda) já sabendo de que lado é a borda
function forma(s, spans, tom) {
  const dentro = (x, y) => spans[y] && x >= spans[y][0] && x <= spans[y][1];
  for (const y in spans) for (let x = spans[y][0]; x <= spans[y][1]; x++) {
    const b = { cima: !dentro(x, +y - 1), baixo: !dentro(x, +y + 1), esq: !dentro(x - 1, +y), dir: !dentro(x + 1, +y) };
    s.set(x, +y, tom(x, +y, b));
  }
}
// caixa chanfrada: topo e esquerda acesos, direita e base na sombra (a luz vem de cima à esquerda)
function caixa(s, x, y, w, h, r, miolo) {
  s.ret(x, y, w, h, (i, j) => {
    if (j === y) return r[4]; if (i === x) return r[3]; if (j === y + h - 1) return r[1]; if (i === x + w - 1) return r[1];
    if (j === y + 1 || i === x + 1) return r[3]; if (i === x + w - 2) return r[2]; return miolo ? miolo(i, j) : r[2];
  });
}

// ---------- paletas (rampas do escuro ao claro; [0] é o contorno)
const MADEIRA = ["#1c0f0a", "#381b0d", "#583626", "#8a5536", "#b8794a", "#e0b194"];
const FERRO = ["#0b0f16", "#1f2630", "#343e4b", "#4f5b69", "#7a8796", "#b9c4cc", "#eef3f2"];
const PAPEL = ["#2b2018", "#7d6b4c", "#a89a74", "#cfc29a", "#ece2c0", "#fff7e0"];
const TINTA = "#3a2a1e";
const VERMELHO = ["#2a0d0a", "#6e1f16", "#a8321f", "#e45f38", "#ff9a6a"];
const OURO = ["#2a1a06", "#7a4f12", "#c18a2a", "#e9ba6f", "#fff1c4"];
const CONTROLE = ["#0b0a12", "#1d1b2a", "#2c2940", "#433e5c", "#625a85", "#9a92c0"];
const COURO = ["#140b26", "#2b1b4d", "#45297a", "#6b3fa8", "#9561d6", "#c08ef0"];
const ROSA = ["#4a1030", "#a83a78", "#ff8fd1", "#ffd1ec"];

// madeira com veio: xadrez nas fileiras escuras (como nas tampas da ampulheta) e riscos de veio
// (regular, sem ruído: uma fileira em xadrez a cada 4 e riscos de veio de 3 a 5 pixels, sempre na direção da tábua)
function veio(rnd, r) {
  const riscos = new Map();
  return (i, j) => {
    if (j % 4 === 0) return (i + j) % 2 ? r[1] : r[2];
    if (!riscos.has(j)) { const l = []; for (let x = Math.floor(rnd() * 6); x < 200; x += 7 + Math.floor(rnd() * 6)) l.push([x, 3 + Math.floor(rnd() * 3)]); riscos.set(j, l); }
    const em = riscos.get(j).some(([x, w]) => i >= x && i < x + w);
    return em ? (j % 4 === 1 ? r[3] : r[1]) : r[2];
  };
}

// ===================================================================== Caçada: bigorna num toco
function bigorna() {
  const s = new Spr(44, 19), F = FERRO;
  const spans = { 0: [9, 40], 1: [4, 41], 2: [1, 41], 3: [3, 41], 4: [7, 40], 5: [13, 35], 6: [15, 33], 7: [16, 32], 8: [16, 32], 9: [15, 33], 10: [13, 35], 11: [10, 38], 12: [9, 39], 13: [9, 39], 14: [9, 39] };
  forma(s, spans, (x, y, b) => {
    if (y === 14 && x >= 19 && x <= 29) return null; // o arco entre os pés
    if (y === 0) return F[5];
    if (y === 1) return x < 9 ? F[4] : F[4];
    if (y <= 3) return b.esq ? F[4] : b.dir ? F[2] : F[3];
    if (y === 4) return F[2];
    if (y <= 10) return y === 5 ? F[1] : b.esq ? F[3] : x >= spans[y][1] - 1 ? F[1] : F[2];
    if (y === 11) return b.esq ? F[4] : F[4];
    return b.esq ? F[3] : b.dir || b.baixo ? F[1] : F[3];
  });
  for (let x = 19; x <= 29; x++) s.set(x, 14, null);
  s.set(12, 0, F[6]); s.set(13, 0, F[6]); s.set(20, 0, F[6]); s.set(2, 2, F[5]); // brilhos do aço
  s.set(34, 0, F[1]); s.set(35, 0, F[1]); s.set(34, 1, F[0]); // furo quadrado no calcanhar
  for (let x = 14; x < 34; x += 4) s.set(x, 13, F[2]); // marcas de martelada na base
  // o toco de madeira
  const M = MADEIRA, rnd = sorte(11);
  forma(s, { 15: [7, 41], 16: [6, 42], 17: [6, 42], 18: [6, 42] }, (x, y, b) => {
    if (y === 15) return b.esq || b.dir ? M[3] : (x % 5 === 2 ? M[3] : M[4]);
    if (y === 16) return x % 7 === 3 ? M[3] : M[5];
    return b.esq ? M[3] : (x + y) % 2 ? M[2] : rnd() < .3 ? M[1] : M[2];
  });
  s.contorno(F[0]); return s;
}

// ===================================================================== Online: quadro de missões com telhadinho
function quadro() {
  const s = new Spr(74, 40), M = MADEIRA, rnd = sorte(5);
  // postes
  caixa(s, 6, 26, 4, 14, M); caixa(s, 64, 26, 4, 14, M);
  // painel: moldura e tábuas
  caixa(s, 2, 6, 70, 24, M);
  s.ret(4, 8, 66, 20, veio(rnd, M));
  for (let y = 13; y < 28; y += 5) s.ret(4, y, 66, 1, M[1]);
  // telhado de telhas
  forma(s, { 0: [6, 67], 1: [4, 69], 2: [2, 71], 3: [1, 72], 4: [0, 73], 5: [0, 73] }, (x, y, b) =>
    y === 0 ? VERMELHO[4] : y === 5 ? VERMELHO[1] : b.esq ? VERMELHO[3] : ((x + (y % 2) * 2) % 4 === 0 ? VERMELHO[1] : y <= 2 ? VERMELHO[3] : VERMELHO[2]));
  // três papéis com sombra, dobra e alfinete
  [[7, 10, 16, 15, 0], [27, 9, 18, 17, 1], [49, 11, 16, 14, 2]].forEach(([x, y, w, h, n]) => {
    s.ret(x + 1, y + 1, w, h, M[0]); // sombra no quadro
    s.ret(x, y, w, h, (i, j) => j === y ? PAPEL[4] : i === x ? PAPEL[4] : i === x + w - 1 || j === y + h - 1 ? PAPEL[2] : PAPEL[3]);
    s.set(x + w - 1, y + h - 1, null); s.set(x + w - 2, y + h - 2, PAPEL[2]); s.set(x + w - 2, y + h - 1, PAPEL[1]); s.set(x + w - 1, y + h - 2, PAPEL[1]); // canto dobrado
    for (let k = 4; k < h - 2; k += 3) s.ret(x + 2, y + k, w - 5 - (k % 2) * 3, 1, PAPEL[1]);
    if (n === 1) { s.ret(x + 3, y + 3, 7, 1, VERMELHO[2]); s.ret(x + w - 7, y + h - 6, 4, 4, VERMELHO[2]); s.ret(x + w - 6, y + h - 5, 2, 2, PAPEL[3]); } // urgente: título e selo
    const px = x + Math.floor(w / 2) - 1; s.ret(px, y - 1, 2, 2, n === 1 ? VERMELHO[3] : FERRO[4]); s.set(px, y - 1, n === 1 ? VERMELHO[4] : FERRO[5]);
  });
  s.contorno(M[0]); return s;
}
// lanterna pendurada num braço de ferro preso ao quadro; 3 quadros de chama
function lanterna(q) {
  const s = new Spr(14, 18), F = FERRO, O = OURO;
  s.ret(5, 0, 9, 1, F[3]); s.set(5, 1, F[3]); s.set(5, 2, F[2]); // braço e gancho
  s.grade(3, 3, [
    "..aa..",
    ".abba.",
    "abbbbc",
    "a....c",
    "a....c",
    "a....c",
    "a....c",
    "a....c",
    "abbbbc",
    ".cccc.",
  ], { a: F[4], b: F[3], c: F[2] });
  // vidro aceso e a chama (cada quadro uma forma)
  s.ret(4, 6, 4, 5, O[3]); s.ret(4, 10, 4, 1, O[2]);
  // gota de fogo: ponta em cima, miolo branco embaixo, balançando de um lado para o outro
  const chamas = [["..k.", ".kk.", ".yk.", "kwyk", ".kk."], [".k..", ".kk.", ".ky.", "kywk", ".kk."], ["..k.", "..kk", ".ky.", "kwyk", ".kk."]];
  s.grade(4, 6, chamas[q], { k: VERMELHO[3], y: O[4], w: "#ffffff" });
  s.set(4, 6, O[4]); // brilho no vidro
  s.contorno(F[0]); return s;
}

// ===================================================================== Gráficos: três pergaminhos e o carimbo
function pergaminho(n) {
  const s = new Spr(26, 38), M = MADEIRA, P = PAPEL;
  // papel: luz à esquerda, sombra à direita e a ponta de baixo enrolando
  s.ret(2, 3, 22, 31, (i, j) => i === 2 ? P[4] : i >= 22 ? P[1] : i === 21 ? P[2] : j >= 31 ? P[2] : P[3]);
  for (let x = 3; x < 21; x++) if (x % 3 === 0) s.set(x, 30, P[2]);
  // título e as barras (quanto mais alta a qualidade, mais barras vermelhas)
  s.ret(5, 6, 12, 1, TINTA); s.ret(5, 8, 8, 1, P[1]);
  for (let k = 0; k < 3 + n; k++) { const w = 15 - (k % 2) * 4 - (k === 4 ? 3 : 0), y = 11 + k * 4, c = k <= n ? VERMELHO : null;
    s.ret(5, y, w, 2, c ? c[3] : P[2]); s.ret(5, y + 1, w, 1, c ? c[2] : P[1]); if (c) s.set(5, y, c[4]); }
  s.ret(5, 28, 14, 1, P[2]);
  // varetas de madeira com as pontas de ouro
  for (const y of [0, 34]) { s.ret(1, y, 24, 3, (i, j) => j === y ? M[5] : j === y + 2 ? M[2] : M[3]); caixa(s, 0, y, 2, 3, OURO); caixa(s, 24, y, 2, 3, OURO); }
  s.contorno(P[0]); return s;
}
function carimbo() {
  const s = new Spr(16, 16), M = MADEIRA;
  s.grade(4, 0, ["..bb..", ".cdbb.", ".cddb.", "..cc.."], { b: M[5], c: M[2], d: M[4] }); // pegador redondo
  s.ret(7, 4, 2, 4, M[3]); s.set(7, 4, M[4]);
  caixa(s, 1, 8, 14, 5, M); s.ret(1, 10, 14, 1, OURO[2]); s.set(1, 10, OURO[3]);
  s.ret(2, 13, 12, 2, (i, j) => j === 13 ? VERMELHO[2] : VERMELHO[1]);
  s.contorno(M[0]); return s;
}
function selo() {
  const s = new Spr(16, 9), V = VERMELHO, rnd = sorte(3);
  const tinta = (x, y) => s.set(x, y, rnd() < .15 ? V[2] : V[3]); // tinta com falhas, como carimbo de verdade
  for (let x = 0; x < 16; x++) { tinta(x, 0); tinta(x, 8); } for (let y = 0; y < 9; y++) { tinta(0, y); tinta(15, y); }
  [[3, 4], [4, 5], [5, 6], [6, 5], [7, 4], [8, 3], [9, 2]].forEach(([x, y]) => { tinta(x, y); tinta(x + 1, y); }); // o visto
  s.ret(11, 3, 3, 1, V[2]); s.ret(11, 5, 3, 1, V[2]);
  return s;
}

// ===================================================================== Controles: o controle (botões e alavanca acendem no launcher)
function controle() {
  const s = new Spr(68, 30), C = CONTROLE;
  // gatilhos
  for (const x of [8, 47]) forma(s, { 0: [x + 2, x + 10], 1: [x, x + 12], 2: [x, x + 12] }, (i, j, b) => j === 0 ? C[5] : b.esq ? C[4] : b.dir ? C[2] : C[3]);
  // corpo e as duas pegadas
  const sp = {};
  for (let y = 3; y < 30; y++) {
    const corpo = y <= 18 ? [y === 3 ? 8 : y === 4 ? 5 : 4, y === 3 ? 59 : y === 4 ? 62 : 63] : null;
    const pe = y > 18 ? y - 18 : 0, esq = [2 + Math.floor(pe * .5), 21 - Math.floor(pe * .2)], dir = [46 + Math.floor(pe * .2), 65 - Math.floor(pe * .5)];
    if (corpo && y >= 12) sp[y] = [Math.min(corpo[0], 2 + (y > 14 ? 0 : 1)), Math.max(corpo[1], 65 - (y > 14 ? 0 : 1))];
    else if (corpo) sp[y] = corpo;
    else if (y < 29) { sp[y] = esq; sp["d" + y] = dir; }
  }
  const dentro = (x, y) => (sp[y] && x >= sp[y][0] && x <= sp[y][1]) || (sp["d" + y] && x >= sp["d" + y][0] && x <= sp["d" + y][1]);
  for (let y = 3; y < 30; y++) for (let x = 0; x < 68; x++) if (dentro(x, y)) {
    const cima = !dentro(x, y - 1), esq = !dentro(x - 1, y), dir = !dentro(x + 1, y), baixo = !dentro(x, y + 1);
    s.set(x, y, cima ? C[5] : y === 4 || esq ? C[4] : baixo || dir ? C[1] : y >= 22 && (x + y) % 2 ? C[1] : y <= 6 ? C[3] : C[2]);
  }
  // cruz direcional
  s.grade(7, 7, ["...ooo...", "...dbo...", "...dbo...", "ooodbooo.", "ddddbbbbo", "obbbbbbbo", "ooobboooo", "...bbo...", "...ooo..."], { o: C[0], b: C[3], d: C[5] });
  // encaixes dos 4 botões (os botões acendem no launcher)
  for (const [x, y] of [[52, 6], [57, 11], [52, 16], [47, 11]]) s.grade(x - 1, y - 1, [".aaaa.", "aaaaaa", "aaaaab", "aaaaab", ".abbb."], { a: C[0], b: C[3] });
  // encaixe da alavanca, botões do meio e a faixa de LED
  s.grade(23, 13, ["..aaaaa..", ".abbbbba.", "abbbbbbbc", "abbbbbbbc", "abbbbbbbc", "abbbbbbbc", "abbbbbbbc", ".cbbbbbc.", "..ccccc.."], { a: C[0], b: C[1], c: C[3] });
  s.ret(28, 9, 4, 2, C[1]); s.ret(36, 9, 4, 2, C[1]); s.set(28, 9, C[0]); s.set(36, 9, C[0]);
  s.ret(26, 5, 16, 2, C[1]);
  s.contorno(C[0]); return s;
}
function alavanca() { const s = new Spr(7, 7), C = CONTROLE; s.grade(0, 0, [".abba.", "abccba", "bcddcb", "bcccbb", "abbbba", ".aaaa."], { a: C[1], b: C[3], c: C[4], d: C[5] }); return s; }
// botão: apagado (0) e aceso (1) em 4 cores
const LUZES = { verde: ["#1b4a2a", "#3f9a4f", "#8fe07a", "#e6ffd0"], vermelho: ["#5a1420", "#c23a3a", "#ff8a7a", "#ffe0d6"], azul: ["#1a2f6a", "#3f6fd6", "#8fb8ff", "#e6f0ff"], roxo: ["#3a1752", "#8a4fc8", "#d39bff", "#f6e6ff"] };
function botoes() {
  const qs = [];
  for (const nome of ["verde", "vermelho", "azul", "roxo"]) for (const aceso of [0, 1]) {
    const s = new Spr(4, 4), L = LUZES[nome];
    s.grade(0, 0, [".ab.", "abbc", "bbcc", ".cc."], aceso ? { a: L[3], b: L[2], c: L[1] } : { a: L[2], b: L[1], c: L[0] }); qs.push(s);
  }
  return tira(qs);
}

// ===================================================================== Mods: o baú (tampa fechada, entreaberta e aberta) e as poções
function bau() {
  const s = new Spr(42, 19), M = MADEIRA, rnd = sorte(9);
  caixa(s, 0, 0, 42, 19, M, veio(rnd, M));
  for (let x = 6; x < 40; x += 7) s.ret(x, 2, 1, 16, M[1]); // tábuas
  for (const x of [4, 35]) { s.ret(x, 0, 3, 19, (i) => i === x ? FERRO[4] : i === x + 1 ? FERRO[3] : FERRO[2]); s.set(x + 1, 3, FERRO[5]); s.set(x + 1, 14, FERRO[5]); } // cintas e rebites
  caixa(s, 17, 3, 8, 9, OURO); s.ret(20, 6, 2, 3, OURO[0]); s.set(20, 9, OURO[0]); s.set(18, 4, OURO[4]); // fechadura
  s.contorno(M[0]); return s;
}
function tampa(q) { // 0 fechada, 1 entreaberta (luz escapa), 2 aberta para trás
  const s = new Spr(44, 14), M = MADEIRA, rnd = sorte(4);
  if (q < 2) {
    const y = q === 1 ? 0 : 3;
    forma(s, { [y]: [4, 39], [y + 1]: [2, 41], [y + 2]: [1, 42], [y + 3]: [1, 42], [y + 4]: [1, 42], [y + 5]: [1, 42], [y + 6]: [1, 42], [y + 7]: [1, 42], [y + 8]: [1, 42] }, (x, j, b) =>
      j === y ? M[5] : j === y + 8 ? M[1] : b.esq ? M[4] : b.dir ? M[1] : j === y + 1 ? M[4] : j === y + 7 ? OURO[2] : veio(rnd, M)(x, j));
    for (const x of [5, 36]) s.ret(x, y + 1, 3, 8, (i, j) => j === y + 1 ? FERRO[5] : i === x ? FERRO[4] : FERRO[2]);
    s.ret(19, y + 6, 6, 3, (i, j) => j === y + 6 ? OURO[4] : OURO[3]);
  } else {
    // aberta: vemos o forro de dentro, inclinado para trás
    forma(s, { 0: [6, 37], 1: [5, 38], 2: [4, 39], 3: [3, 40], 4: [3, 40], 5: [2, 41] }, (x, j, b) => j === 0 ? M[4] : j === 5 ? M[1] : b.esq ? M[3] : (x + j) % 2 ? VERMELHO[1] : VERMELHO[2]);
    for (const x of [6, 36]) s.ret(x, 0, 2, 6, FERRO[3]);
  }
  s.contorno(M[0]); return s;
}
function pocoes() {
  const qs = [];
  for (const nome of ["verde", "vermelho", "azul"]) {
    const s = new Spr(7, 10), L = LUZES[nome];
    s.grade(0, 0, ["..aa...", "..ab...", "..cc...", ".cddc..", "cbbbbc.", "cwbbbc.", "cbbbdc.", "cbbddc.", ".cddc.."], { a: MADEIRA[4], b: L[2], c: L[0], d: L[1], w: "#ffffff" });
    s.set(2, 3, L[3]); qs.push(s);
  }
  return tira(qs);
}
function moedas() { // o brilho de ouro lá dentro quando abre
  const s = new Spr(38, 4), O = OURO;
  s.ret(0, 1, 38, 3, (x, y) => y === 1 ? ((x % 3) ? O[3] : O[4]) : (x + y) % 2 ? O[2] : O[3]);
  for (const x of [5, 14, 23, 31]) s.set(x, 0, O[3]);
  return s;
}

// ===================================================================== Sobre: o livro da guilda (couro roxo) num atril
function livro() {
  const s = new Spr(58, 33), M = MADEIRA, P = PAPEL, C = COURO, rnd = sorte(21);
  // atril de madeira
  caixa(s, 2, 23, 54, 3, M); caixa(s, 25, 26, 8, 5, M); caixa(s, 19, 31, 20, 2, M);
  // capa de couro por baixo das páginas
  forma(s, { 18: [1, 56], 19: [1, 56], 20: [2, 55], 21: [3, 54], 22: [4, 53] }, (x, y, b) => y === 18 ? C[4] : b.esq ? C[3] : y === 22 ? C[1] : (x % 6 === 0 && y === 20) ? OURO[3] : C[2]);
  // páginas (bloco esquerdo e direito), mais claras perto da luz e com a dobra no meio na sombra
  for (const [x0, x1] of [[3, 27], [30, 54]]) {
    const curva = x => x0 === 3 ? Math.round(2 - (x - x0) / 12) : Math.round((x - x0) / 12);
    for (let x = x0; x <= x1; x++) {
      const topo = 2 + curva(x);
      for (let y = topo; y <= 17; y++) {
        const borda = y >= 15, dobra = x0 === 3 ? x >= x1 - 1 : x <= x0 + 1;
        s.set(x, y, y === topo ? P[5] : borda ? ((y + x) % 2 ? P[2] : P[3]) : dobra ? P[2] : x0 === 3 && x <= x0 + 1 ? P[5] : P[4]);
      }
    }
  }
  s.ret(28, 3, 2, 15, P[1]); // a dobra no meio
  // texto, letra capitular e o selo da guilda na página direita
  for (let k = 0; k < 4; k++) { s.ret(11, 6 + k * 2, 14 - (k % 2) * 3, 1, TINTA); s.ret(33, 6 + k * 2, 17 - ((k + 1) % 2) * 4, 1, TINTA); }
  caixa(s, 5, 5, 5, 5, OURO); s.set(7, 7, VERMELHO[2]);
  s.grade(41, 11, [".a.", "aba", ".a."], { a: C[3], b: C[5] }); s.ret(34, 13, 5, 1, TINTA); s.ret(45, 13, 6, 1, TINTA);
  // marcador de fita rosa saindo por baixo
  s.ret(39, 17, 3, 6, (x, y) => x === 39 ? ROSA[3] : x === 41 ? ROSA[1] : ROSA[2]); s.set(39, 23, ROSA[2]); s.set(41, 23, ROSA[1]);
  s.contorno(C[0]);
  for (let i = 0; i < 6; i++) rnd();
  return s;
}

// ===================================================================== grava tudo
const SPRITES = {
  "bigorna": bigorna(), "quadro": quadro(), "lanterna": tira([0, 1, 2].map(lanterna)),
  "pergaminhos": tira([0, 1, 2].map(pergaminho)), "carimbo": carimbo(), "selo": selo(),
  "controle": controle(), "alavanca": alavanca(), "botoes": botoes(),
  "bau": bau(), "bau-tampa": tira([0, 1, 2].map(tampa)), "pocoes": pocoes(), "moedas": moedas(),
  "livro": livro(),
};
for (const [nome, s] of Object.entries(SPRITES)) {
  fs.writeFileSync(path.join(SAIDA, nome + ".png"), png(s));
  console.log(nome.padEnd(12), s.w + "x" + s.h, new Set(s.c.filter(Boolean)).size + " cores");
}
