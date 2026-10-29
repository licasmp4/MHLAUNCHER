// Cenas em pixel art animadas, uma por aba, no cabeçalho (comum.js cabecalho): a floresta à noite ao fundo e, à
// direita, o objeto da aba, cada um com a sua luz. Online: o quadro de missões e a lanterna (luz âmbar). Caçada: a
// bigorna e o martelo (brasa da forja). Gráficos: os pergaminhos e o carimbo (feixe de luar). FPS: a ampulheta (brilho
// azul; a areia cai na velocidade do FPS escolhido). Controles: o controle (o LED do botão aceso pinta o controle).
// Mods: o baú (luz de ouro lá de dentro). Sobre: o livro da guilda (brilho violeta e faíscas subindo).
// 280x60 pixels, ampliados sem borrar; 12 quadros por segundo, só com a aba na tela. Os sprites (img/pixel/cenas) são
// da Thainá ou gerados por arte/cenas/banners.js no mesmo estilo; a luz de cada cena é aplicada aqui, em degraus.
const CenasPixel = (() => {
  const W = 280, H = 60;
  const C = { ceu: ["#0a1510", "#0e1c15", "#13251b", "#1a3124"], estrela: "#c9bd98", pinho: "#132819", pinho2: "#0b170f", chao: "#0a140c", capim: "#2f4a29",
    madeira3: "#3b2414", brasa: "#e45f38", brasa2: "#ff8a5c", ouro: "#e9ba6f", ouro2: "#f5d48c", escuro: "#050907", areia: "#e9ba6f" };
  let fpsEscolhido = 60;
  // sprites desenhados em 1x, só copiados (sem escala) no canvas
  const img = n => Object.assign(new Image(), { src: "img/pixel/cenas/" + n + ".png" });
  const IMG = Object.fromEntries(["martelo", "ampulheta-base", "ampulheta-cima", "ampulheta-baixo", "ampulheta-giro", "bigorna", "quadro", "lanterna",
    "pergaminhos", "carimbo", "selo", "controle", "alavanca", "botoes", "bau", "bau-tampa", "pocoes", "moedas", "livro"].map(n => [n, img(n)]));
  const pronta = (...ns) => ns.every(n => IMG[n].complete && IMG[n].naturalWidth > 0);

  // ---- luz. Cada sprite é recolorido uma vez pelas luzes da sua cena: a força cai em 3 degraus com a distância
  // (faixas de cor nítidas, sem borrar), a borda virada para a luz acende mais e os pixels escuros quase não mudam.
  // luzes: [{ x, y (em pixels do quadro), cor: [r, g, b], raio, forca }]; fw = largura de cada quadro da tira
  const cache = new Map();
  function aceso(nome, luzes, fw, chave = "") {
    const k = nome + chave; if (cache.has(k)) return cache.get(k);
    const im = IMG[nome], w = im.naturalWidth, h = im.naturalHeight; fw = fw || w;
    const cv = Object.assign(document.createElement("canvas"), { width: w, height: h }), c = cv.getContext("2d");
    c.drawImage(im, 0, 0); const d = c.getImageData(0, 0, w, h), p = d.data, s = new Uint8ClampedArray(p);
    const vazio = (x, y, q) => x < q * fw || x >= (q + 1) * fw || y < 0 || y >= h || p[(y * w + x) * 4 + 3] === 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (!p[i + 3]) continue;
      const q = Math.floor(x / fw), lx = x - q * fw; let r = 0, gg = 0, b = 0;
      for (const L of luzes) {
        const dx = L.x - lx - .5, dy = L.y - y - .5, dist = Math.hypot(dx, dy) || 1;
        let f = Math.ceil(Math.max(0, 1 - dist / L.raio) * 3) / 3 * L.forca;
        if (f && vazio(x + Math.round(dx / dist), y + Math.round(dy / dist), q)) f *= 1.9; // borda acesa
        r += L.cor[0] * f; gg += L.cor[1] * f; b += L.cor[2] * f;
      }
      const k2 = (.2 + .8 * (p[i] + p[i + 1] + p[i + 2]) / 765) * .55;
      s[i] = p[i] + r * k2; s[i + 1] = p[i + 1] + gg * k2; s[i + 2] = p[i + 2] + b * k2;
    }
    c.putImageData(new ImageData(s, w, h), 0, 0); cache.set(k, cv); return cv;
  }
  // brilho redondo em degraus (anéis de pixel somando luz, sem borrar); r = raio na horizontal, a altura é .6 dele
  function brilho(g, cx, cy, r, cor, alfa) {
    g.globalCompositeOperation = "lighter"; g.fillStyle = cor; g.globalAlpha = alfa; const ry = Math.round(r * .6);
    for (let dy = -ry; dy <= ry; dy++) { const m = Math.round(r * Math.sqrt(1 - (dy / (ry + .5)) ** 2)); g.fillRect(cx - m, cy + dy, m * 2 + 1, 1); }
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  }
  const aneis = (g, cx, cy, cor, r, a) => [[r, a], [r * .65, a * 1.25], [r * .35, a * 1.6]].forEach(([rr, aa]) => brilho(g, cx, cy, Math.round(rr), cor, aa));
  // sombra de contato no chão, para os objetos não flutuarem
  function sombra(g, cx, y, w) { g.fillStyle = C.escuro; g.globalAlpha = .45; g.fillRect(cx - w / 2, y, w, 1); g.fillRect(cx - w / 2 + 2, y + 1, w - 4, 1); g.globalAlpha = 1; }
  const desenha = (g, fonte, q, fw, x, y) => g.drawImage(fonte, q * fw, 0, fw, fonte.height, x, y, fw, fonte.height);

  // o martelo da Thainá aceso pela forja: um pouco mais claro, borda de baixo em brasa e a de cima no luar
  let marteloAceso = null;
  function acendeMartelo(im) {
    const cv = Object.assign(document.createElement("canvas"), { width: im.naturalWidth, height: im.naturalHeight }), c = cv.getContext("2d");
    c.drawImage(im, 0, 0); const d = c.getImageData(0, 0, cv.width, cv.height), p = d.data, w = cv.width, h = cv.height;
    const vazio = (x, y) => x < 0 || y < 0 || x >= w || y >= h || p[(y * w + x) * 4 + 3] === 0, cor = (x, y) => { const i = (y * w + x) * 4; return [p[i], p[i + 1], p[i + 2]]; };
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t)), brasa = [255, 138, 92], luar = [201, 189, 152], saida = new Uint8ClampedArray(p);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (vazio(x, y)) continue;
      // cada pose ocupa 32 colunas: a vizinha de outra pose conta como vazio
      const v = (dx, dy) => Math.floor((x + dx) / 32) !== Math.floor(x / 32) || vazio(x + dx, y + dy);
      let c2 = cor(x, y).map(v => Math.min(255, v * 1.3 + 12));
      if (v(0, 1) || v(1, 0)) c2 = mix(c2, brasa, .5); else if (v(0, -1) || v(-1, 0)) c2 = mix(c2, luar, .35);
      const i = (y * w + x) * 4; saida[i] = c2[0]; saida[i + 1] = c2[1]; saida[i + 2] = c2[2]; }
    c.putImageData(new ImageData(saida, w, h), 0, 0); return cv;
  }
  // poses do martelo a cada quadro (12 por segundo): 0 levantado, 1 descendo, 2 batendo, 3 recuo, 4 subindo
  const GOLPE = [0, 0, 0, 0, 0, 1, 2, 2, 3, 4, 4];
  const AREIA_MONTE = 7.6; // altura do monte cheio de ampulheta-baixo.png (mesmos grãos da parte de cima)
  const AMBAR = [255, 184, 96], FORJA = [255, 130, 70], LUAR = [170, 200, 255], OURO = [255, 205, 110], VIOLETA = [196, 140, 255];
  const LED = { verde: [[143, 224, 122], "#8fe07a"], vermelho: [[255, 138, 122], "#ff8a7a"], azul: [[143, 184, 255], "#8fb8ff"], roxo: [[211, 155, 255], "#d39bff"] };

  const sorte = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
  function fundo(g, t) {
    g.clearRect(0, 0, W, H); // o céu e o chão não cobrem a faixa entre eles: sem isto o que se mexe ali deixa rastro
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
    // o quadro de missões com telhadinho; a lanterna pendurada no braço de ferro pisca em 3 quadros e acende o quadro
    // de âmbar (mais forte no quadro em que a chama sobe); a bandeira da guilda tremula com luz e sombra nas dobras
    online(g, t) {
      if (!pronta("quadro", "lanterna")) return;
      const bx = 158, by = 12, lx = 145, ly = 19, f = Math.floor(t * 6) % 3, forte = f === 1;
      const luz = [{ x: lx - bx + 5.5, y: ly - by + 9, cor: AMBAR, raio: 62, forca: forte ? 1 : .8 }];
      sombra(g, bx + 37, 52, 70);
      g.drawImage(aceso("quadro", luz, 0, forte ? "+" : ""), bx, by);
      aneis(g, lx + 5, ly + 9, "#ffb860", forte ? 17 : 15, .05);
      desenha(g, IMG.lanterna, f, 14, lx, ly);
      // a bandeira: haste com ponta de ouro e o pano em 3 tons conforme a dobra
      const px = 240, py = 6; R(g, px, py, 2, 46, C.madeira3); R(g, px, py, 1, 46, "#583626"); R(g, px - 1, py - 2, 4, 2, C.ouro); R(g, px - 1, py - 2, 2, 1, "#fff1c4");
      const onda = x => Math.round(Math.sin(Math.floor(t * 6) / 6 * 5 * Math.PI / 2.5 - x * .45) * 1.6 * x / 16);
      for (let x = 0; x < 16; x++) { const o = onda(x), luzDobra = onda(x + 1) - o <= 0, cx = px + 2 + x, cy = py + 2 + o;
        R(g, cx, cy, 1, 10, luzDobra ? "#e45f38" : "#a8321f"); R(g, cx, cy, 1, 1, "#ff9a6a"); R(g, cx, cy + 9, 1, 1, "#6e1f16");
        if (x > 1 && x < 14) R(g, cx, cy + 4, 1, 2, luzDobra ? "#ece2c0" : "#a89a74"); }
    },
    // a bigorna num toco e o martelo da Thainá (img/pixel/cenas/martelo.png, 5 poses de 32x32 girando em volta da mão):
    // levanta e segura (antecipação), desce num quadro só com rastro, bate (faíscas, o lingote clareia), recua e sobe de novo.
    // A brasa do lingote acende o topo da bigorna; no golpe, mais forte.
    cacada(g, t) {
      const ax = 196, ay = 34, tique = Math.floor(t * 12), passo = tique % GOLPE.length, pose = GOLPE[passo], bate = pose === 2;
      if (pronta("bigorna")) g.drawImage(aceso("bigorna", [{ x: 25, y: -3, cor: FORJA, raio: 34, forca: bate ? .8 : .55 }], 0, bate ? "+" : ""), ax - 8, ay);
      // o lingote em brasa
      R(g, ax + 12, ay - 3, 10, 3, bate ? C.ouro2 : C.brasa); R(g, ax + 12, ay - 3, 10, 1, bate ? "#fff3d7" : C.brasa2); R(g, ax + 13, ay - 2, 8, 1, bate ? "#fff3d7" : C.ouro);
      // o calor da forja em três anéis; no golpe cresce um degrau
      [[26, .05], [18, .06], [10, .08]].forEach(([r, a]) => brilho(g, ax + 17, ay - 2, r + (bate ? 3 : 0), C.brasa, a + (bate ? .03 : 0)));
      if (pronta("martelo")) { marteloAceso = marteloAceso || acendeMartelo(IMG.martelo); g.drawImage(marteloAceso, pose * 32, 0, 32, 32, ax + 4 - 8, ay - 7 - 24, 32, 32); }
      // faíscas: estouram no primeiro quadro do golpe e se espalham e somem no segundo
      if (bate) { const r = sorte(Math.floor(tique / GOLPE.length) + 7), longe = passo === GOLPE.indexOf(2) ? 1 : 1.8;
        for (let i = 0; i < 12; i++) { const a = Math.PI * (1.05 + r() * .9), d = (3 + r() * 9) * longe;
          if (longe > 1 && i % 2) continue; R(g, ax + 17 + Math.cos(a) * d, ay - 3 + Math.sin(a) * d * .8, 1, 1, r() < .5 ? C.ouro2 : C.brasa2); } }
    },
    // três pergaminhos pendurados num feixe de luar com poeira; o carimbo desce em degraus no do meio, deixa o selo e sobe
    graficos(g, t) {
      if (!pronta("pergaminhos", "carimbo", "selo")) return;
      // o feixe de luar: duas faixas inclinadas somando luz, de 2 em 2 linhas
      g.globalCompositeOperation = "lighter"; g.fillStyle = "#aac8ff";
      for (let y = 0; y < 52; y += 2) { const x0 = 144 + Math.floor(y * .9); g.globalAlpha = .045; g.fillRect(x0, y, 64, 2); g.globalAlpha = .055; g.fillRect(x0 + 16, y, 30, 2); }
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      const xs = [158, 192, 226], luz = [{ x: -40, y: -30, cor: LUAR, raio: 150, forca: .35 }], fonte = aceso("pergaminhos", luz, 26);
      xs.forEach((x, i) => { const y = 9 + (i === 1 ? -2 : 0); R(g, x + 12, 0, 1, y, "#2a1c12"); R(g, x + 13, 0, 1, y, C.madeira3); desenha(g, fonte, i, 26, x, y); });
      // a poeira no luar: sobe devagar, um pixel por vez
      const r = sorte(17);
      for (let i = 0; i < 9; i++) { const y = Math.floor(52 - ((t * 3 + r() * 52) % 52)), x = 144 + Math.floor(y * .9) + Math.floor(r() * 60);
        g.fillStyle = r() < .5 ? "#dfe9ff" : "#9fb3d9"; g.globalAlpha = .7; g.fillRect(x, y, 1, 1); g.globalAlpha = 1; }
      // o carimbo: desce em 4 degraus (.0-.2), bate (.2-.28), sobe em 2 (.28-.36); o selo fica até o fim do ciclo
      const ciclo = (t * .5) % 1, sx = 197, sy = 26, alvo = sy - 13;
      if (ciclo >= .2) g.drawImage(IMG.selo, sx, sy);
      let cy = null;
      if (ciclo < .2) cy = alvo - 24 + Math.floor(ciclo / .2 * 4) * 6; else if (ciclo < .28) cy = alvo + 1; else if (ciclo < .36) cy = alvo - 8 - Math.floor((ciclo - .28) / .08 * 2) * 10;
      if (cy !== null) g.drawImage(aceso("carimbo", luz), sx, cy);
    },
    // a ampulheta da Thainá (img/pixel/cenas/ampulheta-*.png, 32x38): a areia de cima escoa com um funil no meio, cai num
    // fio pelo gargalo e vira um monte embaixo, na velocidade do FPS escolhido; quando acaba, ela gira 180° em 3 quadros.
    // Um brilho azul atrás do vidro pulsa em 2 degraus.
    fps(g, t) {
      const x = 196, y = 13, vel = Math.max(.25, fpsEscolhido / 60), dur = 12.5 / vel, ciclo = t % (dur + .5);
      sombra(g, x + 16, 51, 30);
      aneis(g, x + 16, y + 19, "#6f8cff", Math.floor(t * 2) % 2 ? 24 : 22, .045);
      if (ciclo >= dur) { const q = Math.min(2, Math.floor((ciclo - dur) / .5 * 3)); if (pronta("ampulheta-giro")) g.drawImage(IMG["ampulheta-giro"], q * 50, 0, 50, 50, x + 16 - 25, y + 19 - 25, 50, 50); return; }
      if (!pronta("ampulheta-base", "ampulheta-cima", "ampulheta-baixo")) return;
      const f = ciclo / dur, T = 7.5 + 10.2 * Math.pow(f, .6), U = -.5 + AREIA_MONTE * f;
      g.drawImage(IMG["ampulheta-base"], x, y);
      // cada coluna: a areia de cima some de cima para baixo (mais rápido no meio) e a de baixo sobe em monte
      for (let c = 6; c < 26; c++) { const d = Math.abs(c - 15.5);
        const ini = Math.max(10, Math.ceil(T - .3 * d)); if (ini <= 17) g.drawImage(IMG["ampulheta-cima"], c, ini, 1, 18 - ini, x + c, y + ini, 1, 18 - ini);
        const topo = Math.max(21, Math.ceil(30 - (U - .55 * d))); if (topo <= 30) g.drawImage(IMG["ampulheta-baixo"], c, topo, 1, 31 - topo, x + c, y + topo, 1, 31 - topo); }
      // o fio de areia: do gargalo até o monte, piscando em degraus
      const chao = Math.max(21, Math.ceil(30 - U)), fio = Math.floor(t * 12 * Math.min(2, vel));
      for (let k = 17; k < chao; k++) R(g, x + 15 + ((k + fio) % 3 === 0 ? 1 : 0), y + k, 1, 1, (k + fio) % 2 ? C.areia : "#e0b194");
    },
    // o controle: os botões acendem um por vez e o LED de cada um pinta o controle e a faixa de luz; a alavanca gira em 4 degraus
    controles(g, t) {
      if (!pronta("controle", "alavanca", "botoes")) return;
      const x = 186, y = 20, on = Math.floor(t * 3) % 4, nomes = ["verde", "vermelho", "azul", "roxo"], pos = [[52, 6], [57, 11], [52, 16], [47, 11]];
      const [cor, hex] = LED[nomes[on]], [bx, by] = pos[on];
      sombra(g, x + 34, 51, 60);
      g.drawImage(aceso("controle", [{ x: bx + 2, y: by + 2, cor, raio: 44, forca: .85 }], 0, nomes[on]), x, y);
      pos.forEach(([px, py], i) => desenha(g, IMG.botoes, i * 2 + (i === on ? 1 : 0), 4, x + px, y + py));
      R(g, x + 26, y + 5, 16, 2, hex); R(g, x + 26, y + 5, 16, 1, "#ffffff"); g.globalAlpha = .5; R(g, x + 26, y + 5, 16, 1, hex); g.globalAlpha = 1;
      aneis(g, x + bx + 2, y + by + 2, hex, 12, .06); brilho(g, x + 34, y + 6, 12, hex, .05);
      const a = Math.floor(t * 4) % 4; g.drawImage(IMG.alavanca, x + 24 + [1, 0, -1, 0][a], y + 14 + [0, 1, 0, -1][a]);
    },
    // o baú: entreabre (a luz escapa pela fresta), abre, as poções sobem em degraus num feixe de ouro, fecha
    mods(g, t) {
      if (!pronta("bau", "bau-tampa", "pocoes", "moedas")) return;
      const x = 196, y = 33, ciclo = (t * .35) % 1, fresta = (ciclo > .15 && ciclo < .2) || (ciclo > .8 && ciclo < .85), aberto = ciclo >= .2 && ciclo <= .8;
      const luz = [{ x: 21, y: -2, cor: OURO, raio: 40, forca: aberto ? 1 : fresta ? .55 : 0 }];
      sombra(g, x + 21, 52, 46);
      if (aberto) { // os raios de ouro subindo, piscando a largura em 2 degraus
        g.globalCompositeOperation = "lighter"; g.fillStyle = C.ouro2; const pisca = Math.floor(t * 4) % 2;
        for (let yy = 4; yy < y; yy += 2) { const w = 18 + Math.floor((y - yy) * .5) + pisca * 2; g.globalAlpha = .03 + (yy - 4) / (y - 4) * .05; g.fillRect(x + 21 - w / 2, yy, w, 2); }
        g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
        desenha(g, aceso("bau-tampa", luz, 44, "a"), 2, 44, x - 1, y - 7);
        R(g, x + 1, y, 40, 3, "#2a1a06"); g.drawImage(IMG.moedas, x + 2, y - 1);
        // as poções saem de dentro (desenhadas antes da frente do baú) e sobem de 2 em 2 pixels
        const sobe = Math.floor((ciclo - .2) / .6 * 11) * 2;
        [[x + 7, 0], [x + 18, 1], [x + 29, 2]].forEach(([ix, i]) => { const iy = y + 2 - sobe - i * 2;
          desenha(g, IMG.pocoes, i, 7, ix, iy); if (Math.floor(t * 8 + i) % 3 === 0) R(g, ix + 6, iy, 1, 1, "#fff1c4"); });
      }
      g.drawImage(aceso("bau", luz, 0, aberto ? "a" : fresta ? "f" : ""), x, y);
      if (!aberto) {
        desenha(g, IMG["bau-tampa"], fresta ? 1 : 0, 44, x - 1, y - 12);
        if (fresta) { R(g, x + 2, y - 3, 38, 1, C.ouro2); aneis(g, x + 21, y - 3, C.ouro, 18, .04); }
      } else aneis(g, x + 21, y, C.ouro, 24, .05);
    },
    // o livro da guilda num atril, em couro roxo: brilho violeta pulsando em 2 degraus, faíscas subindo e as páginas virando
    sobre(g, t) {
      if (!pronta("livro")) return;
      const x = 190, y = 19, pulso = Math.floor(t * 2) % 2, luz = [{ x: 29, y: 6, cor: VIOLETA, raio: 44, forca: pulso ? .7 : .55 }];
      aneis(g, x + 29, y + 8, "#9561d6", pulso ? 30 : 27, .05);
      g.drawImage(aceso("livro", luz, 0, pulso ? "+" : ""), x, y);
      // a página virando, em 7 degraus: a frente clara, o verso mais escuro e a borda acesa
      const ciclo = (t * .45) % 1;
      if (ciclo < .5) { const k = Math.floor(ciclo / .5 * 7) / 6, w = Math.round(24 * Math.cos(k * Math.PI)), lev = Math.round(Math.sin(k * Math.PI) * 4), px = w >= 0 ? x + 30 : x + 30 + w;
        const larg = Math.abs(w) || 1, py = y + 3 - lev;
        R(g, px, py, larg, 14, w >= 0 ? "#ece2c0" : "#cfc29a"); R(g, px, py, larg, 1, "#fff7e0"); R(g, w >= 0 ? px + larg - 1 : px, py, 1, 14, w >= 0 ? "#a89a74" : "#fff7e0"); }
      // faíscas de magia subindo em degraus, lilás e rosa
      const r = sorte(29);
      for (let i = 0; i < 7; i++) { const fase = r(), sx = x + 10 + Math.floor(r() * 38), alt = Math.floor((t * 6 + fase * 24) % 24), sy = y + 4 - alt;
        g.fillStyle = alt > 16 ? "#6b3fa8" : i % 2 ? "#ff8fd1" : "#e8c6ff"; g.fillRect(sx + (Math.floor(alt / 4) % 2), sy, 1, 1); }
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
