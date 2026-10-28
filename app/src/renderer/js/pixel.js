// Peças em pixel art desenhadas por código: sprites 16x16 (os ícones da bolsa, com 2 quadros) e a fogueira do
// acampamento (fogo no algoritmo clássico dos jogos antigos, faíscas, fumaça e a carne girando no espeto).
// Tudo em resolução baixa, ampliado sem borrar (image-rendering: pixelated).
const Pixel = (() => {
  // ---- sprites: cada letra é uma cor da paleta, "." é vazio
  const PAL = { o: "#050907", T: "#334535", t: "#2c5a43", L: "#cfe3b5", M: "#7f955c", W: "#8a5a34", w: "#6b4426", G: "#e9ba6f",
    g: "#b5843a", S: "#e9ba6f", s: "#c99a4a", R: "#e45f38", r: "#ff8a5c", P: "#c9bd98", B: "#a1502a", b: "#d8cda6", c: "#7a3a1e",
    h: "#18231b", H: "#b4552f", k: "#8f9a86", K: "#d9e2cf" };
  const SPRITES = {
    tela: [[
      "................", ".oooooooooooooo.", ".oTTTTTTTTTTTTo.", ".oTttttttttttTo.", ".oTtLLttttttttTo".slice(0, 16), ".oTtLtttttttLTo.", ".oTttttttttttTo.",
      ".oTTTTTTTTTTTTo.", ".oooooooooooooo.", "......oMMo......", "......oMMo......", "....oooooooo....", "....oMMMMMMo....", "....oooooooo....", "................", "................"],
      ["................", ".oooooooooooooo.", ".oTTTTTTTTTTTTo.", ".oTttttttttttTo.", ".oTttttttttLtTo.", ".oTtLttttttttTo.", ".oTttttttttttTo.",
      ".oTTTTTTTTTTTTo.", ".oooooooooooooo.", "......oMMo......", "......oMMo......", "....oooooooo....", "....oMMMMMMo....", "....oooooooo....", "................", "................"]],
    ampulheta: [[
      "................", "...oooooooooo...", "...oWWWWWWWWo...", "....oSSSSSSo....", "....osSSSSso....", ".....oSSSSo.....", "......oSSo......", ".......oo.......",
      "......o..o......", ".....o.S..o.....", "....o..SS..o....", "....osSSSSso....", "...oWWWWWWWWo...", "...oooooooooo...", "................", "................"],
      ["................", "...oooooooooo...", "...oWWWWWWWWo...", "....o.SSSS.o....", "....osSSSSso....", ".....oSSSSo.....", "......oSSo......", ".......So.......",
      "......oS.o......", ".....o....o.....", "....o..SSS.o....", "....oSSSSSSo....", "...oWWWWWWWWo...", "...oooooooooo...", "................", "................"]],
    bau: [[
      "................", "................", "...oooooooooo...", "..oWWWWWWWWWWo..", "..oWwwwwwwwwWo..", "..oGGGGGGGGGGo..", "..oWWWWggWWWWo..", "..oWwwwggwwwWo..",
      "..oWwwwwwwwwWo..", "..oWwwwwwwwwWo..", "..oGGGGGGGGGGo..", "...oooooooooo...", "................", "................", "................", "................"],
      ["................", "...oooooooooo...", "..oWWWWWWWWWWo..", "..oWwwwwwwwwWo..", "..oGGGGGGGGGGo..", "...o..G..G..o...", "..oGGGGGGGGGGo..", "..oWWWWggWWWWo..",
      "..oWwwwggwwwWo..", "..oWwwwwwwwwWo..", "..oGGGGGGGGGGo..", "...oooooooooo...", "................", "................", "................", "................"]],
    bandeira: [[
      "................", "...o............", "...oooooooo.....", "...oRRRRRRRo....", "...oRrRRRRRRo...", "...oRRRRRRRo....", "...oRRRRRRo.....", "...oooooooo.....",
      "...o............", "...o............", "...o............", "...o............", "..ooo...........", ".ooooo..........", "................", "................"],
      ["................", "...o............", "...ooooooooo....", "...oRRRRRRRRo...", "...oRrRRRRRo....", "...oRRRRRRRRo...", "...oRRRRRRRo....", "...ooooooooo....",
      "...o............", "...o............", "...o............", "...o............", "..ooo...........", ".ooooo..........", "................", "................"]],
  };
  function desenhar(g, m, x0, y0) {
    for (let y = 0; y < m.length; y++) for (let x = 0; x < m[y].length; x++) { const ch = m[y][x]; if (PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(x0 + x, y0 + y, 1, 1); } }
  }
  // um ícone animado: alterna os 2 quadros; com o mouse em cima, pula em degraus
  function icone(nome, lento = 700) {
    const cv = document.createElement("canvas"); cv.width = 16; cv.height = 16; cv.className = "px-icone";
    const g = cv.getContext("2d"), q = SPRITES[nome]; let i = 0;
    const pinta = () => { g.clearRect(0, 0, 16, 16); desenhar(g, q[i % q.length], 0, 0); };
    pinta(); setInterval(() => { if (!document.hidden && cv.offsetParent) { i++; pinta(); } }, lento);
    return cv;
  }

  // ---- fogueira: W x H pixels; o fogo é o algoritmo do Doom de PlayStation (cada pixel herda o calor do de baixo,
  // esfriando e com um sopro para o lado), só no meio, em cima da lenha
  function fogueira(W = 80, H = 56) {
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.className = "px-fogueira";
    const g = cv.getContext("2d");
    const FOGO = ["#090f0b", "#1a0f0a", "#3a1408", "#5e1d0b", "#86280e", "#a8341a", "#c9411f", "#e45f38", "#ee7a3d", "#f39a45", "#f5b856", "#f2cf78", "#f3e2a6", "#f6eed2"];
    const N = FOGO.length - 1, FW = 34, FH = 34, fx0 = Math.round(W / 2 - FW / 2), fy0 = H - 12 - FH;
    const calor = new Uint8Array(FW * FH);
    const fumaca = [], faiscas = [];
    let vira = 0, bemPassada = 0, t = 0;
    function alimentar(forte) { for (let x = 0; x < FW; x++) { const d = Math.abs(x - FW / 2) / (FW / 2); calor[(FH - 1) * FW + x] = d < .62 ? N : d < .8 && Math.random() < .5 ? N - 3 : 0; } if (forte) for (let x = 6; x < FW - 6; x++) calor[(FH - 2) * FW + x] = N; }
    function espalhar() {
      for (let y = 0; y < FH - 1; y++) for (let x = 0; x < FW; x++) {
        const src = calor[(y + 1) * FW + x], r = Math.floor(Math.random() * 3);
        const dx = Math.min(FW - 1, Math.max(0, x - r + 1)), v = src - (r & 1) - (Math.random() < .12 ? 1 : 0);
        calor[y * FW + dx] = v > 0 ? v : 0;
      }
    }
    const ESPETO = [["oPPPPPPPPPPPPPPPPPPPPPo"], ["oPPPPPPPPPPPPPPPPPPPPPo"]];
    const CARNE = [
      ["....cBBBBc....", "..cBBBBBBBBc..", ".cBBbBBBBBBBc.", ".cBBBBBBBbBBc.", "..cBBBBBBBBc..", "....cBBBBc...."],
      ["....cBBBBc....", "..cBBBBBBBBc..", ".cBBBBBBBBBBc.", ".cBbBBBBBBBBc.", "..cBBBBBBbBc..", "....cBBBBc...."],
      ["....cBBBBc....", "..cBBbBBBBBc..", ".cBBBBBBBBBBc.", ".cBBBBBBBBBBc.", "..cBBBBBBBBc..", "....cBBbBc...."],
    ];
    // ao lado do fogo: um caçador sentado no tronco (o lado do fogo iluminado) e a espada grande fincada no chão
    const CACADOR = ["....hhhh....", "...hhhhhH...", "...hhhhhH...", "....hhhH....", "...hhhhhhH..", "..hhhhhhhhH.", "..hhhhhhhhhH",
      "..hhhhhhh.HH", "..hhhhhhh...", "...hhhhhhhH.", "...hhhhhhhhH", "...hh....hhH"];
    const TRONCO = ["..ooooooooo.", "..oWWwWWWWo.", "..ooooooooo."];
    const ESPADA = ["..oo..", ".oWWo.", "..oo..", "ogggggo", "..ok..", "..ok..", "..ok..", "..ok..", "..ok..", "..ok..", "..ok..", "..ok..", "..ok..", "..ok..", "...o.."];
    function quadro() {
      t++;
      alimentar(bemPassada > 0); espalhar();
      g.fillStyle = "#090f0b"; g.fillRect(0, 0, W, H);
      // brilho no chão
      for (let y = H - 14; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot((x - W / 2) / 34, (y - (H - 8)) / 7); if (d < 1 && (x + y) % 2 === 0) { g.fillStyle = d < .5 ? "#3a1a10" : "#1f140d"; g.fillRect(x, y, 1, 1); } }
      // fumaça (pontilhada, subindo e sumindo)
      if (t % 5 === 0) fumaca.push({ x: W / 2 + (Math.random() * 6 - 3), y: fy0 + 6, v: .4 + Math.random() * .3, vida: 1 });
      for (const f of fumaca) { f.y -= f.v; f.x += Math.sin((f.y + t) * .08) * .3; f.vida -= .012; const r = Math.round(2 + (1 - f.vida) * 4);
        g.fillStyle = "rgba(201,189,152," + (f.vida * .12).toFixed(3) + ")"; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r && (x + y + t) % 2 === 0) g.fillRect(Math.round(f.x + x), Math.round(f.y + y), 1, 1); }
      while (fumaca.length && fumaca[0].vida <= 0) fumaca.shift();
      // o fogo
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const v = calor[y * FW + x]; if (v > 1) { g.fillStyle = FOGO[v]; g.fillRect(fx0 + x, fy0 + y, 1, 1); } }
      // faíscas
      if (Math.random() < (bemPassada > 0 ? .9 : .35)) faiscas.push({ x: W / 2 + (Math.random() * 18 - 9), y: fy0 + 10, vy: -(.6 + Math.random() * .8), vx: Math.random() * .6 - .3, vida: 1 });
      for (const s of faiscas) { s.x += s.vx + Math.sin(t * .2 + s.y) * .2; s.y += s.vy; s.vida -= .025; g.fillStyle = s.vida > .5 ? "#f5b856" : "#e45f38"; g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); }
      while (faiscas.length && faiscas[0].vida <= 0) faiscas.shift();
      // lenha cruzada e pedras
      const ly = H - 12;
      g.fillStyle = "#3b2414"; for (let i = 0; i < 26; i++) { g.fillRect(W / 2 - 13 + i, ly + Math.round(i * .25), 1, 3); g.fillRect(W / 2 + 13 - i, ly + Math.round(i * .25), 1, 3); }
      g.fillStyle = "#5a3820"; for (let i = 0; i < 26; i += 3) { g.fillRect(W / 2 - 13 + i, ly + Math.round(i * .25), 1, 1); g.fillRect(W / 2 + 13 - i, ly + Math.round(i * .25), 1, 1); }
      g.fillStyle = "#4b5546"; [-20, -15, -9, 9, 15, 20].forEach((dx, k) => { g.fillRect(W / 2 + dx - 2, H - 7 + (k % 2), 4, 3); });
      g.fillStyle = "#6b7663"; [-20, -15, -9, 9, 15, 20].forEach((dx, k) => { g.fillRect(W / 2 + dx - 2, H - 7 + (k % 2), 3, 1); });
      // o caçador respira (o tronco sobe 1 pixel) e a luz do fogo tremula no lado dele
      const cx = 10, cy = H - 18, resp = (t % 42) < 21 ? 0 : 1;
      desenhar(g, TRONCO, cx, H - 6);
      const lume = PAL.H; PAL.H = Math.random() < .2 ? "#e45f38" : "#b4552f";
      desenhar(g, CACADOR.slice(0, 9), cx, cy - 3 + resp); desenhar(g, CACADOR.slice(9), cx, cy + 6);
      PAL.H = lume;
      // a espada: um brilho desce pela lâmina de vez em quando
      const sx = W - 18, sy = H - 21; desenhar(g, ESPADA, sx, sy);
      const b = t % 60; if (b < 11) { g.fillStyle = "#f6eed2"; g.fillRect(sx + 3, sy + 4 + b, 1, 1); g.globalAlpha = .4; g.fillRect(sx + 2, sy + 4 + b, 1, 1); g.globalAlpha = 1; }
      // espeto com a carne girando (uma das marcas do jogo)
      const ey = fy0 + 2;
      g.fillStyle = "#4a3320"; g.fillRect(W / 2 - 16, ey - 2, 2, 22); g.fillRect(W / 2 + 15, ey - 2, 2, 22);
      desenhar(g, ESPETO[0], W / 2 - 11, ey + 3);
      if (t % 3 === 0) vira++;
      const cor = bemPassada > 40 ? { B: "#7a3418", b: "#b5602e" } : null;
      if (cor) { const ob = PAL.B, ob2 = PAL.b; PAL.B = cor.B; PAL.b = cor.b; desenhar(g, CARNE[vira % 3], W / 2 - 7, ey); PAL.B = ob; PAL.b = ob2; } else desenhar(g, CARNE[vira % 3], W / 2 - 7, ey);
      if (bemPassada > 0) bemPassada--;
    }
    let ult = 0, ativa = true;
    (function loop(a) { requestAnimationFrame(loop); if (!ativa || document.hidden || !cv.offsetParent || a - ult < 1000 / 14) return; ult = a; quadro(); })(0);
    quadro();
    return {
      cv,
      atiçar() { bemPassada = 90; },
      parar(v) { ativa = !v; },
    };
  }

  return { icone, fogueira, desenhar, SPRITES };
})();
