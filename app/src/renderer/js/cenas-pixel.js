// Cenas em pixel art animadas, uma por aba, no cabeçalho (comum.js cabecalho): a floresta à noite ao fundo e, à
// direita, o objeto da aba. Online: o quadro de avisos com a lanterna e a bandeira. Caçada: a bigorna com o martelo e
// as faíscas. Gráficos: três pergaminhos e o carimbo. FPS: a ampulheta (a areia cai na velocidade do FPS escolhido).
// Controles: o controle com os botões acendendo. Mods: o baú abrindo. Sobre: o livro da guilda virando páginas.
// 280x60 pixels, ampliados sem borrar; 12 quadros por segundo, só com a aba na tela.
const CenasPixel = (() => {
  const W = 280, H = 60;
  const C = { ceu: ["#0a1510", "#0e1c15", "#13251b", "#1a3124"], estrela: "#c9bd98", pinho: "#132819", pinho2: "#0b170f", chao: "#0a140c", capim: "#2f4a29",
    madeira: "#6b4426", madeira2: "#8a5a34", madeira3: "#3b2414", papel: "#c9bd98", papel2: "#a89f7d", tinta: "#261d14", brasa: "#e45f38", brasa2: "#ff8a5c",
    ouro: "#e9ba6f", ouro2: "#f5d48c", ferro: "#4b5546", ferro2: "#6b7663", ferro3: "#2a3029", escuro: "#050907", musgo: "#7f955c", verde: "#8fbf6a",
    azul: "#7fa9e0", roxo: "#b06aa8", areia: "#e9ba6f", vidro: "#2c5a43", vidro2: "#3f6b4f" };
  let fpsEscolhido = 60;

  const sorte = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
  function fundo(g, t) {
    const fh = Math.ceil(H * .7 / C.ceu.length);
    C.ceu.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * fh, W, fh + 1); if (i) { g.fillStyle = c; for (let x = i % 2; x < W; x += 2) g.fillRect(x, i * fh - 1, 1, 1); } });
    const r = sorte(3);
    for (let i = 0; i < 26; i++) { const x = Math.floor(r() * W), y = Math.floor(r() * H * .45), f = r() * 6; if (Math.sin(t * 1.4 + f) > .3) { g.fillStyle = C.estrela; g.globalAlpha = .7; g.fillRect(x, y, 1, 1); g.globalAlpha = 1; } }
    for (let i = 0; i < 22; i++) { const x = Math.floor(r() * W), h = 10 + r() * 16, y = H - 8; pinho(g, x, y, h, i % 3 ? C.pinho : C.pinho2); }
    g.fillStyle = C.chao; g.fillRect(0, H - 8, W, 8);
    for (let x = 0; x < W; x += 3) { g.fillStyle = C.capim; g.fillRect(x + Math.round(Math.sin(t * 2 + x * .2)), H - 9 - (x % 2), 1, 2); }
  }
  function pinho(g, x, y, h, cor) {
    g.fillStyle = cor;
    for (let yy = 0; yy < h; yy++) { const w = Math.round(yy / h * h * .35) + ((yy % 4) === 3 ? -1 : 0); g.fillRect(x - w, y - h + yy, w * 2 + 1, 1); }
  }
  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };

  const DESENHO = {
    // quadro de avisos com três papéis, a lanterna acesa e a bandeira tremulando
    online(g, t) {
      const bx = 176, by = 18;
      R(g, bx + 4, by + 22, 3, 20, C.madeira3); R(g, bx + 58, by + 22, 3, 20, C.madeira3);
      R(g, bx, by, 66, 26, C.madeira3); R(g, bx + 2, by + 2, 62, 22, C.madeira); for (let y = by + 7; y < by + 24; y += 6) R(g, bx + 2, y, 62, 1, C.madeira3);
      [[bx + 6, by + 5, 14, 12], [bx + 24, by + 4, 16, 14], [bx + 45, by + 6, 13, 11]].forEach(([x, y, w, h], i) => {
        R(g, x + 1, y + 1, w, h, C.escuro); R(g, x, y, w, h, C.papel); for (let k = 3; k < h - 1; k += 3) R(g, x + 2, y + k, w - 4 - (k % 2) * 3, 1, C.papel2);
        R(g, x + Math.floor(w / 2), y - 1, 2, 2, i === 1 ? C.brasa : C.ferro2);
      });
      // a lanterna: pendurada num gancho, a chama pisca em 3 quadros
      const lx = 160, ly = 20, f = Math.floor(t * 6) % 3;
      R(g, lx + 2, ly - 6, 1, 6, C.ferro); R(g, lx, ly, 6, 9, C.ferro3); R(g, lx + 1, ly + 1, 4, 7, f === 1 ? C.ouro2 : C.ouro);
      R(g, lx + 2, ly + 3 + (f === 2 ? 1 : 0), 2, 3, C.brasa2);
      g.globalAlpha = .12 + (f === 1 ? .05 : 0); R(g, lx - 8, ly - 6, 22, 22, C.ouro); g.globalAlpha = 1;
      // a bandeira do Hub
      const px = 254, py = 6; R(g, px, py, 2, 46, C.madeira3);
      for (let x = 0; x < 18; x++) { const o = Math.round(Math.sin(t * 5 - x * .45) * 1.6 * x / 18); R(g, px + 2 + x, py + 2 + o, 1, 10, x < 2 ? C.brasa : C.brasa); if (x % 5 === 2) R(g, px + 2 + x, py + 5 + o, 1, 3, C.brasa2); }
    },
    // bigorna e martelo: sobe, desce, faíscas no golpe; o lingote brilha
    cacada(g, t) {
      const ax = 196, ay = 34;
      R(g, ax + 8, ay + 8, 18, 10, C.ferro3); R(g, ax + 4, ay + 16, 26, 3, C.ferro3);
      R(g, ax, ay, 34, 8, C.ferro); R(g, ax - 6, ay + 1, 8, 4, C.ferro); R(g, ax, ay, 34, 2, C.ferro2);
      const ciclo = (t * 1.6) % 1, bate = ciclo > .82;
      R(g, ax + 12, ay - 3, 10, 3, bate ? C.ouro2 : C.brasa2); R(g, ax + 13, ay - 2, 8, 1, C.ouro);
      // martelo girando em volta do cabo (3 posições)
      const pos = ciclo < .5 ? 0 : ciclo < .82 ? 1 : 2;
      const cabos = [[ax + 30, ay - 22, ax + 40, ay - 6], [ax + 24, ay - 18, ax + 38, ay - 8], [ax + 18, ay - 10, ax + 36, ay - 8]];
      const [x1, y1, x2, y2] = cabos[pos];
      for (let i = 0; i <= 14; i++) R(g, x1 + (x2 - x1) * i / 14, y1 + (y2 - y1) * i / 14, 2, 2, C.madeira2);
      R(g, x1 - 4, y1 - 3, 9, 6, C.ferro); R(g, x1 - 4, y1 - 3, 9, 2, C.ferro2);
      if (bate) { const r = sorte(Math.floor(t * 12)); for (let i = 0; i < 10; i++) R(g, ax + 17 + (r() - .5) * 26, ay - 4 - r() * 14, 1, 1, r() < .5 ? C.ouro2 : C.brasa2); }
      g.globalAlpha = .1; R(g, ax - 10, ay - 12, 54, 34, C.brasa); g.globalAlpha = 1;
    },
    // três pergaminhos pendurados; o carimbo "recomendado" desce de tempos em tempos no do meio
    graficos(g, t) {
      const xs = [168, 204, 240];
      xs.forEach((x, i) => { const y = 10 + (i === 1 ? -2 : 0); R(g, x - 2, y, 26, 3, C.madeira2); R(g, x, y + 3, 22, 30, C.papel); R(g, x - 2, y + 33, 26, 3, C.madeira2);
        for (let k = 0; k < 3 + i; k++) R(g, x + 3, y + 8 + k * 4, 16 - (k % 2) * 4, 2, k <= i ? C.brasa : C.papel2);
        R(g, x + 4, y + 26, 14, 1, C.papel2); });
      const ciclo = (t * .5) % 1, cx = 206, cy = 18;
      const desce = ciclo < .25 ? -24 + ciclo / .25 * 24 : 0;
      if (ciclo < .25) { R(g, cx + 6, cy + desce - 12, 6, 10, C.madeira2); R(g, cx + 2, cy + desce - 2, 14, 4, C.madeira3); }
      if (ciclo >= .25) { g.globalAlpha = Math.min(1, (ciclo - .25) * 8); R(g, cx + 1, cy + 8, 16, 9, C.brasa); R(g, cx + 2, cy + 9, 14, 7, C.papel); R(g, cx + 3, cy + 10, 12, 5, C.brasa); R(g, cx + 5, cy + 12, 8, 1, C.papel); g.globalAlpha = 1; }
    },
    // ampulheta: a areia cai na velocidade do FPS escolhido
    fps(g, t) {
      const x = 210, y = 6, vel = Math.max(.25, fpsEscolhido / 60);
      R(g, x - 4, y, 34, 4, C.madeira2); R(g, x - 4, y + 46, 34, 4, C.madeira2); R(g, x - 2, y + 4, 2, 42, C.madeira3); R(g, x + 26, y + 4, 2, 42, C.madeira3);
      for (let k = 0; k < 21; k++) { const w = Math.max(1, Math.round(12 - Math.abs(k - 10.5) * 1.1)); R(g, x + 13 - w, y + 4 + k * 2, w * 2, 2, C.vidro); }
      const nivel = (t * vel * .08) % 1, topo = Math.round(16 * (1 - nivel)), baixo = Math.round(16 * nivel);
      for (let k = 0; k < topo; k++) { const w = Math.max(1, Math.round((16 - k) * .6)); R(g, x + 13 - w, y + 22 - k, w * 2, 1, C.areia); }
      for (let k = 0; k < baixo; k++) { const w = Math.max(1, Math.round((k + 2) * .55)); R(g, x + 13 - w, y + 45 - k, w * 2, 1, C.areia); }
      for (let k = 0; k < 20; k += 2) if ((Math.floor(t * vel * 30) + k) % 4 < 2) R(g, x + 13, y + 23 + k, 1, 1, C.ouro2);
      g.globalAlpha = .5; R(g, x + 6, y + 6, 1, 10, C.vidro2); g.globalAlpha = 1;
    },
    // o controle: os botões acendem um por vez, a alavanca gira
    controles(g, t) {
      const x = 182, y = 16, c = C.ferro3;
      R(g, x + 6, y, 64, 22, c); R(g, x, y + 6, 76, 16, c); R(g, x, y + 22, 18, 10, c); R(g, x + 58, y + 22, 18, 10, c);
      R(g, x + 8, y + 2, 60, 2, C.ferro); R(g, x + 6, y - 3, 14, 3, C.ferro); R(g, x + 56, y - 3, 14, 3, C.ferro);
      R(g, x + 11, y + 10, 3, 9, C.escuro); R(g, x + 8, y + 13, 9, 3, C.escuro);
      const a = t * 3; R(g, x + 24, y + 12, 9, 9, C.escuro); R(g, x + 26 + Math.round(Math.cos(a) * 1.5), y + 14 + Math.round(Math.sin(a) * 1.5), 5, 5, C.ferro2);
      const bt = [[x + 60, y + 7, C.verde], [x + 65, y + 12, C.brasa], [x + 60, y + 17, C.azul], [x + 55, y + 12, C.roxo]], on = Math.floor(t * 3) % 4;
      bt.forEach(([bx, by, cor], i) => { R(g, bx, by, 4, 4, i === on ? cor : C.ferro); if (i === on) { g.globalAlpha = .3; R(g, bx - 2, by - 2, 8, 8, cor); g.globalAlpha = 1; } });
    },
    // o baú: abre, os itens sobem brilhando, fecha
    mods(g, t) {
      const x = 196, y = 26, ciclo = (t * .35) % 1, aberto = ciclo > .2 && ciclo < .8;
      R(g, x, y + 8, 40, 18, C.madeira); R(g, x, y + 14, 40, 2, C.ouro); R(g, x + 18, y + 12, 4, 6, C.ouro2); R(g, x, y + 24, 40, 2, C.madeira3);
      if (!aberto) { R(g, x - 1, y, 42, 9, C.madeira2); R(g, x - 1, y + 4, 42, 2, C.ouro); }
      else {
        R(g, x - 1, y - 6, 42, 5, C.madeira2); R(g, x - 1, y - 4, 42, 1, C.ouro); R(g, x + 1, y + 6, 38, 3, C.escuro);
        g.globalAlpha = .25; R(g, x + 4, y - 16, 32, 22, C.ouro2); g.globalAlpha = 1;
        const sobe = (ciclo - .2) / .6;
        [[x + 8, C.verde], [x + 18, C.brasa], [x + 28, C.azul]].forEach(([ix, cor], i) => { const iy = y + 4 - sobe * 22 - i * 2; R(g, ix, iy, 4, 5, cor); R(g, ix + 1, iy - 2, 2, 2, C.papel); if (Math.floor(t * 8 + i) % 3 === 0) R(g, ix + 5, iy - 1, 1, 1, C.ouro2); });
      }
    },
    // o livro da guilda: as páginas viram
    sobre(g, t) {
      const x = 194, y = 22;
      R(g, x - 2, y + 22, 52, 4, C.madeira3); R(g, x, y, 24, 24, C.papel); R(g, x + 24, y, 24, 24, C.papel); R(g, x + 23, y, 2, 24, C.papel2);
      for (let k = 0; k < 5; k++) { R(g, x + 3, y + 4 + k * 4, 17 - (k % 2) * 5, 1, C.tinta); R(g, x + 28, y + 4 + k * 4, 16 - ((k + 1) % 2) * 4, 1, C.tinta); }
      R(g, x + 30, y + 16, 8, 6, C.brasa);
      const ciclo = (t * .45) % 1;
      if (ciclo < .5) { const k = ciclo / .5, w = Math.round(24 * Math.cos(k * Math.PI)), px = w >= 0 ? x + 24 : x + 24 + w; R(g, px, y - Math.round(Math.sin(k * Math.PI) * 4), Math.abs(w) || 1, 24, k < .5 ? C.papel : C.papel2); }
      R(g, x + 22, y - 6, 4, 8, C.brasa);
    },
  };

  return {
    fps(v) { fpsEscolhido = +v || 60; },
    // o canvas animado de uma aba (ou null se a aba não tem cena)
    criar(pagina) {
      const d = DESENHO[pagina]; if (!d) return null;
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.className = "cena-px";
      const g = cv.getContext("2d"); let t = Math.random() * 10, ult = 0;
      const quadro = () => { fundo(g, t); d(g, t); };
      quadro();
      (function loop(a) { requestAnimationFrame(loop); if (document.hidden || !cv.offsetParent || a - ult < 1000 / 12) return; ult = a; t += 1 / 12; quadro(); })(0);
      return cv;
    },
  };
})();
