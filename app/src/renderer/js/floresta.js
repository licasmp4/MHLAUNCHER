// Floresta em pixel art, animada, no fundo do launcher (tema pixel): céu com lua, montanhas, três fileiras de pinheiros,
// capim que balança, neblina, vaga-lumes e, de tempos em tempos, um wyvern cruzando o céu, um monstro grande andando
// no morro do fundo e uma manada de herbívoros passando pelo chão. Desenhada em resolução baixa
// (cada pixel vira 4x4 na tela, sem borrar), a 12 quadros por segundo; as camadas andam um pouco com o mouse. Para
// quando a janela está escondida. Provisória até chegar a arte da Tainá (que entra no lugar, em camadas).
const Floresta = (() => {
  const ESC = 4, FPS = 12;
  const COR = { ceu: ["#0a1510", "#0e1c15", "#13251b", "#1a3124", "#223d2c"], lua: "#d8cda6", lua2: "#a89f7d", halo: "#2b4533", estrela: "#c9bd98",
    serra: "#18301f", serra2: "#1d3826", longe: "#1a3322", longe2: "#203d29", meio: "#132819", meio2: "#1b3422", perto: "#0b170f", perto2: "#112016",
    chao: "#0a140c", capim: "#2f4a29", capim2: "#5a7a40",
    vaga: ["#e9ba6f", "#f07a52", "#cfe3b5"], neblina: "rgba(201, 189, 152, .06)", wyvern: "#040a06", olho: "#ff6a3d", ave: "#06100a",
    bruto: "#0c1d12", manada: "#07100a", olho2: "#e9ba6f" };
  let cv, g, W = 0, H = 0, t = 0, ultimo = 0, rodando = false, mx = 0, mxAlvo = 0;
  let camadas = [], vagas = [], estrelas = [], wyv = null, aves = [], proxWyv = 4, proxAves = 0;
  let bruto = null, manada = [], proxBruto = 12, proxManada = 25;

  // número aleatório repetível (a mesma floresta toda vez)
  const sorte = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

  function gerar() {
    const r = sorte(7);
    const fileira = (n, ymin, ymax, hmin, hmax, cor, cor2, par) => ({ par, cor, cor2,
      arvores: Array.from({ length: n }, () => ({ x: r() * (W + 80), y: ymin + r() * (ymax - ymin), h: hmin + r() * (hmax - hmin) })).sort((a, b) => a.y - b.y) });
    camadas = [
      fileira(Math.ceil(W / 9), H * .52, H * .6, 14, 26, COR.longe, COR.longe2, .15),
      fileira(Math.ceil(W / 14), H * .6, H * .72, 26, 44, COR.meio, COR.meio2, .35),
      fileira(Math.ceil(W / 26), H * .74, H * .9, 46, 76, COR.perto, COR.perto2, .7),
    ];
    estrelas = Array.from({ length: Math.ceil(W / 7) }, () => ({ x: Math.floor(r() * W), y: Math.floor(r() * H * .42), f: r() * 6.28 }));
    vagas = Array.from({ length: Math.ceil(W / 22) }, () => ({ x: r() * W, y: H * (.55 + r() * .4), f: r() * 6.28, v: .2 + r() * .4, c: COR.vaga[Math.floor(r() * 3)] }));
  }

  // um pinheiro: andares de triângulo, um lado mais claro
  function pinheiro(x, y, h, cor, cor2) {
    x = Math.round(x); y = Math.round(y); const andares = Math.max(3, Math.round(h / 9));
    g.fillStyle = cor; g.fillRect(x, y - Math.round(h * .15), 1, Math.round(h * .15) + 2);
    for (let a = 0; a < andares; a++) {
      const topo = y - h + Math.round(a * h / andares * .8), base = topo + Math.round(h / andares * 1.5), larg = Math.round((a + 1.6) * h / andares * .55);
      for (let yy = topo; yy < base; yy++) {
        const w = Math.round(((yy - topo) / (base - topo)) * larg);
        g.fillStyle = cor; g.fillRect(x - w, yy, w * 2 + 1, 1);
        if (cor2 !== cor && w > 1) { g.fillStyle = cor2; g.fillRect(x - w, yy, Math.max(1, Math.round(w * .6)), 1); }
      }
    }
  }
  // serra ao fundo (duas camadas de morros)
  function serra(base, alt, freq, fase, cor) {
    g.fillStyle = cor;
    for (let x = 0; x < W; x++) {
      const y = Math.round(base - alt * (.55 + .3 * Math.sin((x + fase) * freq) + .15 * Math.sin((x + fase) * freq * 2.7 + 1)));
      g.fillRect(x, y, 1, H - y);
    }
  }
  // wyvern: dois quadros (asas para cima / para baixo), 26x11
  const WYV = [
    ["......xx..................", "......xxx.................", ".......xxx........xx......", "........xxxx....xxxx......", ".x.......xxxxxxxxxx.......", "xxxxxxxxxxxxxxxxxxxxxx....", ".xxxxxxxxxxxxxxxxxxxxxxxo.", "......xx..xx.....xxxxxxxxx", ".....xx....xx.........xx..", "..........................", ".........................."],
    ["..........................", "..........................", "..........................", "..........................", ".x........................", "xxxxxxxxxxxxxxxxxxxxxx....", ".xxxxxxxxxxxxxxxxxxxxxxxo.", "......xxxxxxxxxx.xxxxxxxxx", "....xxxxx...xxxxxx....xx..", "...xxx..........xxx.......", "..xx..............xx......"],
  ];
  // monstro grande (wyvern bruto, de pé): o corpo e as pernas em dois passos, 31x14
  const BRUTO_CORPO = ["..........................xx...", ".........................xxxx..", "..........xxxxxxx.......xxxxxxo",
    ".......xxxxxxxxxxxxx...xxxxxxxx", "....xxxxxxxxxxxxxxxxxxxxxxxx...", "..xxxxxxxxxxxxxxxxxxxxxxxxx....", ".xxxxxxxxxxxxxxxxxxxxxxxxx.....",
    "xxx..xxxxxxxxxxxxxxxxxxxx......", "xx....xxxxxxxxxxxxxxxxxxx......"];
  const BRUTO = [BRUTO_CORPO.concat(["x......xxxx.......xxxx.........", ".......xxx.........xxx........", "......xxx...........xxx.......", "......xx.............xx.......", ".....xxx.............xxx......"]),
    BRUTO_CORPO.concat([".......xxxx.......xxxx.........", "........xxx.......xxx.........", "........xxx......xxx..........", ".........xx......xx...........", "........xxx.....xxx..........."])];
  // herbívoro de pescoço comprido, 12x8, dois passos
  const PASTOR = [["........xx..", ".......xxxo.", ".......xx...", "......xx....", ".xxxxxxx....", "xxxxxxxx....", "x.xx..xx....", "..x....x...."],
    ["........xx..", ".......xxxo.", ".......xx...", "......xx....", ".xxxxxxx....", "xxxxxxxx....", "..xx..xx....", ".x....x....."]];
  function sprite(m, x, y, cor, olho) {
    x = Math.round(x); y = Math.round(y);
    for (let i = 0; i < m.length; i++) for (let j = 0; j < m[i].length; j++) {
      const ch = m[i][j]; if (ch === ".") continue;
      g.fillStyle = ch === "o" ? olho : cor; g.fillRect(x + j, y + i, 1, 1);
    }
  }

  function quadro() {
    const ox = Math.round(mx);  // deslocamento do mouse (pixels da floresta)
    // céu em faixas (mais claro perto do horizonte), com a borda entre elas pontilhada (dither), como jogo antigo
    const fh = Math.ceil(H * .6 / COR.ceu.length);
    COR.ceu.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * fh, W, fh + 1); });
    for (let i = 1; i < COR.ceu.length; i++) { g.fillStyle = COR.ceu[i]; for (let x = 0; x < W; x += 2) g.fillRect(x + (i % 2), i * fh - 1, 1, 1); g.fillStyle = COR.ceu[i - 1]; for (let x = 1; x < W; x += 4) g.fillRect(x, i * fh, 1, 1); }
    // estrelas piscando
    g.fillStyle = COR.estrela;
    for (const e of estrelas) { const b = Math.sin(t * 1.5 + e.f); if (b > .3) { g.globalAlpha = b > .85 ? 1 : .5; g.fillRect(e.x, e.y, 1, 1); } }
    g.globalAlpha = 1;
    // lua com halo pontilhado e duas crateras
    const lx = Math.round(W * .78 - ox * .05), ly = Math.round(H * .17), lr = Math.max(6, Math.round(H * .055));
    for (let y = -lr * 2; y <= lr * 2; y++) for (let x = -lr * 2; x <= lr * 2; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= lr) { g.fillStyle = d > lr - 1.2 ? COR.lua2 : COR.lua; g.fillRect(lx + x, ly + y, 1, 1); }
      else if (d <= lr * 1.7 && (x + y) % 2 === 0 && (d < lr * 1.35 || (x * 3 + y) % 4 === 0)) { g.fillStyle = COR.halo; g.fillRect(lx + x, ly + y, 1, 1); }
    }
    g.fillStyle = COR.lua2; [[-.35, -.2, .22], [.3, .25, .16]].forEach(([cx, cy, cr]) => { const rr = Math.max(1, Math.round(lr * cr)); for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) if (x * x + y * y <= rr * rr) g.fillRect(lx + Math.round(cx * lr) + x, ly + Math.round(cy * lr) + y, 1, 1); });
    // aves e wyvern no céu (atrás das montanhas próximas)
    for (const a of aves) { a.x += a.v; const asa = (Math.floor(t * 4 + a.f) % 2) ? 0 : 1; g.fillStyle = COR.ave; g.fillRect(Math.round(a.x), Math.round(a.y + asa), 1, 1); g.fillRect(Math.round(a.x) - 1, Math.round(a.y) - asa, 1, 1); g.fillRect(Math.round(a.x) + 1, Math.round(a.y) - asa, 1, 1); }
    aves = aves.filter(a => a.x < W + 4);
    if (wyv) { wyv.x += wyv.v; wyv.y += Math.sin(t * 1.3) * .25; sprite(WYV[Math.floor(t * 3) % 2], wyv.x, wyv.y, COR.wyvern, COR.olho); if (wyv.x > W + 30) wyv = null; }
    serra(H * .5, H * .16, .013, ox * .1, COR.serra);
    serra(H * .56, H * .12, .021, 300 + ox * .14, COR.serra2);
    // o monstro grande andando no morro do fundo (atrás da neblina e das árvores); para e olha de vez em quando
    if (bruto) {
      const parado = Math.sin(t * .35 + bruto.f) > .82;
      if (!parado) bruto.x += bruto.v;
      const passo = parado ? 0 : Math.floor(t * 2.4) % 2;
      const x = bruto.x - ox * .14, y = H * .56 - H * .12 * .55 - 13 + (passo ? 0 : -1);
      sprite(BRUTO[passo], x, y, COR.bruto, Math.sin(t * 3) > -.6 ? COR.olho : COR.bruto);
      if (bruto.x > W + 40) bruto = null;
    }
    // neblina passando entre as fileiras
    g.fillStyle = COR.neblina;
    for (let k = 0; k < 3; k++) { const y = Math.round(H * (.58 + k * .07)), x0 = Math.round((t * (4 + k * 2) + k * 90) % (W + 160)) - 160; g.fillRect(x0, y, 150, 3 + k); g.fillRect(x0 + 40, y - 2, 70, 2); }
    // fileiras de pinheiros (as de perto andam mais com o mouse)
    for (const c of camadas) {
      const d = Math.round(ox * c.par);
      for (const a of c.arvores) { let x = a.x - 40 - d; x = ((x % (W + 80)) + W + 80) % (W + 80) - 40; pinheiro(x, a.y, a.h, c.cor, c.cor2); }
      // o morro da fileira, ondulado, do pé das árvores para baixo
      const base = Math.min(...c.arvores.map(a => a.y)) + 2; g.fillStyle = c.cor;
      for (let x = 0; x < W; x++) { const y = Math.round(base + 2 * Math.sin((x + d) * .05 + base)); g.fillRect(x, y, 1, H - y); }
    }
    // chão com capim balançando
    const chao = Math.round(H * .9); g.fillStyle = COR.chao; g.fillRect(0, chao, W, H - chao);
    // a manada passando pelo chão, na frente das árvores
    for (const m of manada) { m.x -= m.v; sprite(PASTOR[Math.floor(t * 4 + m.f) % 2].map(l => [...l].reverse().join("")), m.x - ox * .7, chao - 8, COR.manada, COR.olho2); }
    manada = manada.filter(m => m.x > -20);
    for (let x = 0; x < W; x += 3) {
      const onda = Math.round(Math.sin(t * 2 + x * .15) * .9), alt = 2 + ((x * 7) % 3);
      g.fillStyle = (x % 9 === 0) ? COR.capim2 : COR.capim; g.fillRect(x + onda, chao - alt, 1, alt); g.fillRect(x, chao - 1, 1, 1);
    }
    // vaga-lumes: sobem e descem devagar e piscam
    for (const v of vagas) {
      v.f += .25; const on = Math.sin(v.f) > .2; if (!on) continue;
      const x = Math.round(v.x + Math.sin(v.f * .3) * 3 - ox * .5), y = Math.round(v.y + Math.cos(v.f * .2) * 2);
      g.fillStyle = v.c; g.fillRect(((x % W) + W) % W, y, 1, 1);
      if (Math.sin(v.f) > .8) { g.globalAlpha = .35; g.fillRect(((x % W) + W) % W - 1, y, 3, 1); g.fillRect(((x % W) + W) % W, y - 1, 1, 3); g.globalAlpha = 1; }
    }
  }

  function passo(agora) {
    if (!rodando) return;
    requestAnimationFrame(passo);
    if (agora - ultimo < 1000 / FPS) return;
    ultimo = agora; t += 1 / FPS;
    mx += (mxAlvo - mx) * .25;
    if (t > proxWyv && !wyv) { wyv = { x: -30, y: H * (.12 + Math.random() * .16), v: 1.1 + Math.random() * .6 }; proxWyv = t + 18 + Math.random() * 20; }
    if (t > proxBruto && !bruto) { bruto = { x: -34, v: .45 + Math.random() * .2, f: Math.random() * 6 }; proxBruto = t + 70 + Math.random() * 50; }
    if (t > proxManada && !manada.length) { const n = 3 + Math.floor(Math.random() * 3); manada = Array.from({ length: n }, (_, i) => ({ x: W + 10 + i * (16 + Math.random() * 10), v: .8, f: i })); proxManada = t + 45 + Math.random() * 40; }
    if (t > proxAves) { const y = H * (.1 + Math.random() * .25); aves.push(...[0, 1, 2].map(i => ({ x: -6 - i * 5, y: y + i * 2, v: .7, f: i }))); proxAves = t + 14 + Math.random() * 20; }
    quadro();
  }

  function medir() {
    const w = Math.ceil(innerWidth / ESC), h = Math.ceil(innerHeight / ESC);
    if (w === W && h === H) return;
    W = w; H = h; cv.width = W; cv.height = H; gerar(); quadro();
  }

  return {
    ligar(onde) {
      if (cv) return;
      cv = document.createElement("canvas"); cv.id = "floresta"; onde.prepend(cv); g = cv.getContext("2d");
      medir(); proxWyv = 6; proxAves = 3;
      addEventListener("resize", medir);
      addEventListener("mousemove", e => { mxAlvo = (e.clientX / innerWidth - .5) * 24; });
      const ver = () => { const v = !document.hidden; if (v && !rodando) { rodando = true; requestAnimationFrame(passo); } else if (!v) rodando = false; };
      document.addEventListener("visibilitychange", ver);
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) { quadro(); return; }
      ver();
    },
  };
})();

// Troca de aba em blocos de pixel: a página nova aparece em quadrados, em diagonal, em 4 degraus.
const TrocaPixel = (() => {
  let cv, g;
  return {
    async cobrir(area) {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!cv) { cv = document.createElement("canvas"); cv.id = "troca-pixel"; area.append(cv); g = cv.getContext("2d"); }
      const T = 24, w = Math.ceil(area.clientWidth / T), h = Math.ceil(area.clientHeight / T);
      cv.width = w; cv.height = h; cv.hidden = false;
      const passos = 5, cor = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#090f0b";
      for (let p = passos; p >= 0; p--) {
        g.clearRect(0, 0, w, h); g.fillStyle = cor;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = (x + y) / (w + h) * passos; if (d < p - .2 + ((x * 7 + y * 3) % 3) * .25) g.fillRect(x, y, 1, 1); }
        await new Promise(r => setTimeout(r, 34));
      }
      cv.hidden = true;
    },
  };
})();
