// Cenas do jogo: os vídeos da cópia do jogador (movie00–09.mp4). Fotos para os cartazes e cabeçalhos (cache),
// a cena em destaque no Início, o fundo desfocado e o mini-player.
const Cenas = (() => {
  // foto: o melhor momento de cada vídeo para o cartaz (escolhido à mão, sem cenas escuras nem logos)
  const LISTA = [
    { nome: "Glavenus", v: 2, ini: 2, fim: 58, foto: 36, rank: 6 },
    { nome: "Mizutsune", v: 4, ini: 2, fim: 44, foto: 27.5, rank: 5 },
    { nome: "Gammoth", v: 5, ini: 2, fim: 49, foto: 41, rank: 6 },
    { nome: "Selva dourada", v: 3, ini: 2, fim: 43, foto: 27, rank: 4 },
    { nome: "Tempestade", v: 6, ini: 34, fim: 110, foto: 35, rank: 5 },
    { nome: "Olhar do dragão", v: 7, ini: 2, fim: 45, foto: 9.4, rank: 6 },
    { nome: "Abertura", v: 0, ini: 40, fim: 200, foto: 90.5, rank: 4 },
    { nome: "Felynes", v: 1, ini: 4, fim: 100, foto: 21, rank: 4 },
    { nome: "Festa no Hub", v: 8, ini: 10, fim: 120, foto: 78, rank: 5 },
    { nome: "Nova aventura", v: 9, ini: 120, fim: 205, foto: 169.5, rank: 4 },
  ];
  const SEG = 16;
  const urls = {};
  async function video(n) { if (!(n in urls)) urls[n] = await api.cenaVideo(n); return urls[n]; }

  // uma foto do vídeo no tempo t (tirada num <video> fora da tela e guardada no cache)
  const fila = []; let tirando = false;
  function quadro(v, t, w = 640, h = 360) {
    return new Promise(res => { fila.push({ v, t, w, h, res }); proximo(); });
  }
  async function proximo() {
    if (tirando || !fila.length) return;
    tirando = true;
    const { v, t, w, h, res } = fila.shift();
    const nome = `movie${String(v).padStart(2, "0")}_${Math.round(t)}_${w}.jpg`;
    let url = await api.cacheLer(nome);
    if (!url) {
      const src = await video(v);
      if (src) url = await capturar(src, t, w, h, nome);
    }
    res(url); tirando = false; proximo();
  }

  // o vídeo toca um instante antes da foto (parado logo depois de pular, o quadro ainda não foi desenhado);
  // quadro escuro demais (transição) = tenta alguns segundos depois
  function capturar(src, t, w, h, nome) {
    return new Promise(ok => {
      // (fora da página o navegador não desenha o quadro: fica na página, fora da área visível)
      const vd = document.createElement("video"); vd.muted = true; vd.preload = "auto"; vd.src = src;
      Object.assign(vd.style, { position: "fixed", left: "-2000px", top: "0", width: "320px", height: "180px", opacity: "0", pointerEvents: "none" });
      document.body.append(vd);
      let tentativa = 0, tempo;
      const fim = u => { clearTimeout(tempo); vd.pause(); vd.removeAttribute("src"); vd.load(); vd.remove(); ok(u); };
      const ir = () => { clearTimeout(tempo); tempo = setTimeout(() => fim(null), 9000); vd.currentTime = Math.min(t + tentativa * 3, vd.duration - .5); };
      vd.addEventListener("loadedmetadata", ir, { once: true });
      vd.addEventListener("seeked", () => {
        vd.play().then(() => {
          const pega = () => {
            vd.pause();
            try {
              const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(vd, 0, 0, w, h);
              const px = x.getImageData(0, 0, w, h).data; let soma = 0, n = 0;
              for (let i = 0; i < px.length; i += 4 * 211) { soma += px[i] + px[i + 1] + px[i + 2]; n++; }
              const media = soma / n / 3;
              if ((media < 30 || media > 228) && tentativa < 4) { tentativa++; ir(); return; }
              api.cacheSalvar(nome, c.toDataURL("image/jpeg", .9)).then(fim, () => fim(null));
            } catch { fim(null); }
          };
          // espera dois quadros desenhados de verdade
          if (vd.requestVideoFrameCallback) vd.requestVideoFrameCallback(() => vd.requestVideoFrameCallback(() => pega())); else setTimeout(pega, 200);
        }).catch(() => fim(null));
      });
      vd.addEventListener("error", () => fim(null), { once: true });
    });
  }

  // ---- o destaque do Início: duas camadas de vídeo para a troca ser suave
  let camadas = [], atual = -1, fimTrecho = 0, pausado = false, ligado = false, aoTrocar = [], timer = null, vez = 0;
  function montar(container) { camadas = [0, 1].map(() => { const v = document.createElement("video"); v.muted = true; v.playsInline = true; container.prepend(v); return v; }); }
  async function tocar(i) {
    if (!ligado || !camadas.length) return;
    const c = LISTA[i]; atual = i;
    const src = await video(c.v); if (!src) return;
    const entra = camadas[vez % 2], sai = camadas[(vez + 1) % 2]; vez++;
    const ini = c.ini + Math.random() * Math.max(0, c.fim - c.ini - SEG);
    fimTrecho = ini + SEG;
    entra.src = src;
    entra.addEventListener("loadedmetadata", () => { entra.currentTime = ini; }, { once: true });
    entra.addEventListener("seeked", () => { if (!pausado) entra.play().catch(() => {}); entra.classList.add("on"); sai.classList.remove("on"); setTimeout(() => { sai.pause(); }, 600); }, { once: true });
    aoTrocar.forEach(f => f(c, i));
    fundo(c);
  }
  function ativa() { return camadas.find(v => v.classList.contains("on")); }
  function tick() {
    const v = ativa(); if (!v || pausado) return;
    const prog = (v.currentTime - (fimTrecho - SEG)) / SEG;
    const p = document.getElementById("miniProg"); if (p) p.style.width = Math.max(0, Math.min(1, prog)) * 100 + "%";
    if (v.currentTime >= fimTrecho) tocar((atual + 1) % LISTA.length);
  }
  function ligar(container) {
    if (!camadas.length) montar(container);
    ligado = true; clearInterval(timer); timer = setInterval(tick, 250);
    tocar(atual >= 0 ? atual : Math.floor(Math.random() * 6));
  }
  function desligar() { ligado = false; clearInterval(timer); camadas.forEach(v => { v.pause(); v.classList.remove("on"); }); }
  function pausar(p) { pausado = p; const v = ativa(); if (v) p ? v.pause() : v.play().catch(() => {}); }
  // vídeo só no Início e com a janela visível (o resto do tempo, pausado)
  function visivel(sim) { const v = ativa(); if (!v || !ligado) return; if (sim && !pausado) v.play().catch(() => {}); else v.pause(); }

  // fundo da janela: a foto da cena, desfocada pelo CSS uma vez (barato), com troca suave
  let fundoB = false;
  async function fundo(c) {
    const u = await quadro(c.v, c.foto); if (!u) return;
    const a = document.getElementById(fundoB ? "fundoB" : "fundoA"), b = document.getElementById(fundoB ? "fundoA" : "fundoB"); fundoB = !fundoB;
    a.src = u; a.onload = () => { a.classList.add("on"); b.classList.remove("on"); };
  }

  return { LISTA, quadro, video, ligar, desligar, pausar, visivel, tocar, aoTrocar: f => aoTrocar.push(f), atual: () => atual, pausado: () => pausado, ligado: () => ligado };
})();
