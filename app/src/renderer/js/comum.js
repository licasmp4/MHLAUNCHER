// Utilidades e componentes da interface (sem framework: elementos criados direto, com o sistema de design do base.css).
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const api = window.mhgu;
const PRINTS = new URLSearchParams(location.search).get("prints") === "1";
const espera = ms => new Promise(r => setTimeout(r, ms));

function el(tag, attrs, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (k === "html") e.innerHTML = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const f of filhos.flat()) if (f != null && f !== false) e.append(f.nodeType ? f : document.createTextNode(String(f)));
  return e;
}

// ícones (traço de 1.6, cantos redondos: o mesmo desenho do menu)
const ICONES = {
  copiar: "M9 9h11v11H9z M5 15H4V4h11v1", pasta: "M3 6.5h6l2 2h10v10.5H3z", seta: "M5 12h14 M13 6l6 6-6 6", esquerda: "M15 6l-6 6 6 6", direita: "M9 6l6 6-6 6",
  atualizar: "M4 12a8 8 0 0 1 14-5.3 M20 4v4h-4 M20 12a8 8 0 0 1-14 5.3 M4 20v-4h4", baixar: "M12 4v11 M7 10l5 5 5-5 M5 20h14", x: "M6 6l12 12 M18 6L6 18",
  escudo: "M12 3l7 3v5c0 4.6-3 8-7 10-4-2-7-5.4-7-10V6z", raio: "M13 2L4 14h7l-1 8 9-12h-7z", rede: "M12 20h.01 M8.5 16.5a5 5 0 0 1 7 0 M5 13a10 10 0 0 1 14 0 M2 9.5a14 14 0 0 1 20 0",
  pc: "M3 4h18v12H3z M8 20h8 M12 16v4", globo: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c3 3.5 3 14.5 0 18 M12 3c-3 3.5-3 14.5 0 18",
  tela: "M3 5h18v11H3z M9 20h6", olho: "M2.5 12c3-5.5 16-5.5 19 0-3 5.5-16 5.5-19 0z M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z", bolsa: "M8.5 7.5c0-3.5 7-3.5 7 0 M4.5 8h15L18 20.5H6z",
  coroa: "M4 18h16 M5 15l-1-8 5 4 3-6 3 6 5-4-1 8z",
  janela: "M3 5h18v14H3z M3 9h18", resolucao: "M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5", proporcao: "M3 7h18v10H3z M7 7v10 M17 7v10", hud: "M3 5h18v14H3z M6 8h6 M6 11h4",
  nitido: "M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z", serrilha: "M3 17l3-3 3 3 3-3 3 3 3-3 3 3 M3 9l3-3 3 3 3-3 3 3 3-3 3 3", filtro: "M4 5h16l-6 8v6l-4-2v-4z",
  fov: "M12 19L4 7 M12 19l8-12 M5.5 9.3a10 10 0 0 1 13 0", fps: "M13 2L4 14h7l-1 8 9-12h-7z", vsync: "M3 12h4l3-7 4 14 3-7h4",
  vida: "M12 21s-7.5-4.6-9-10C2 7 5 4 8 4c2 0 3.2 1 4 2.4C12.8 5 14 4 16 4c3 0 6 3 4.9 7-1.4 5.4-8.9 10-8.9 10z", dano: "M14.5 3l6.5 6.5-11 11L3.5 14z M11 7l6 6", monstro: "M4 19c1-6 4-9 8-9s7 3 8 9 M8 10 6 4l4 3 2-3 2 3 4-3-2 6", vila: "M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-6h4v6",
  presente: "M3 9h18v4H3z M5 13v8h14v-8 M12 9v12 M12 9c-2-4-6-4-6-1s6 1 6 1 6 2 6-1-4-3-6 1", sinc: "M4 12a8 8 0 0 1 14-5 M20 4v4h-4 M20 12a8 8 0 0 1-14 5 M4 20v-4h4", porta: "M5 3h11v18H5z M13 12h.01",
  mouse: "M12 3a6 6 0 0 0-6 6v6a6 6 0 0 0 12 0V9a6 6 0 0 0-6-6z M12 7v4", cena: "M3 5h18v14H3z M10 9l5 3-5 3z", pessoas: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5 M16 4.5a3.3 3.3 0 0 1 0 6.4 M18 14.8c1.8.7 3.1 2.5 3.5 5.2",
};
function svg(nome, extra) {
  const ns = "http://www.w3.org/2000/svg", s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "1.7"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
  const p = document.createElementNS(ns, "path"); p.setAttribute("d", ICONES[nome] || nome); s.append(p);
  if (extra) s.setAttribute("class", extra);
  return s;
}

// aviso flutuante (pergaminho)
let toastT;
function toast(t) { const e = $("#toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove("on"), 2400); }

// .ini do port: cada mudança grava sozinha (o main espera meio segundo)
const ouvintesIni = [];
const ini = {
  get: (s, k, p) => api.iniGet(s, k, p),
  set: async (s, k, v) => { await api.iniSet(s, k, v); ouvintesIni.forEach(f => f(s, k, v)); },
  aoMudar: f => ouvintesIni.push(f),
};

// ---- componentes
const cartao = (...filhos) => el("div", { class: "cartao" }, ...filhos);
const secao = (titulo, acao) => el("h3", { class: "secao" }, titulo, acao ? el("span", { class: "acao" }, acao) : null);
const botao = (texto, onclick, cls = "", icone) => el("button", { class: "btn " + cls, onclick }, icone ? svg(icone) : null, texto);
function linha(rotulo, dica, controle, icone) {
  const l = el("div", { class: "linha" + (icone ? " com-icone" : "") }, icone ? el("span", { class: "chip-ic" }, svg(icone)) : null,
    el("div", { class: "txt" }, el("div", { class: "rotulo" }, rotulo), dica ? el("div", { class: "dica" }, dica) : null), controle);
  busca.registrar(rotulo, l);
  return l;
}
function chave(ligado, aoMudar, desligada) {
  const i = el("input", { type: "checkbox", "aria-label": "ligar ou desligar" }); i.checked = !!ligado; i.disabled = !!desligada;
  i.addEventListener("change", () => aoMudar(i.checked));
  const c = el("label", { class: "chave" }, i, el("span"));
  c.definir = v => { i.checked = !!v; };
  return c;
}
// controle segmentado: o destaque desliza até a opção escolhida
function seg(opcoes, valor, aoMudar) {
  const marca = el("i", { class: "marca" }), s = el("div", { class: "seg", role: "radiogroup" }, marca);
  const botoes = opcoes.map(([v, txt]) => { const b = el("button", { role: "radio" }, txt); b.dataset.v = v; b.addEventListener("click", () => { escolher(v); aoMudar(v); }); s.append(b); return b; });
  function posicionar() { const b = botoes.find(x => x.classList.contains("on")); if (!b || !b.offsetWidth) return; marca.style.width = b.offsetWidth + "px"; marca.style.transform = "translateX(" + b.offsetLeft + "px)"; }
  function escolher(v) { botoes.forEach(b => b.classList.toggle("on", b.dataset.v === String(v))); posicionar(); }
  escolher(String(valor));
  new ResizeObserver(posicionar).observe(s);
  s.definir = escolher;
  return s;
}
function faixa(min, max, passo, valor, formato, aoMudar) {
  const r = el("input", { type: "range", min, max, step: passo }); r.value = valor;
  const v = el("span", { class: "valor" });
  const pinta = () => { r.style.setProperty("--p", ((r.value - min) / (max - min) * 100) + "%"); v.textContent = formato(+r.value); };
  r.addEventListener("input", () => { pinta(); aoMudar(+r.value); });
  pinta();
  const f = el("div", { class: "faixa" }, r, v);
  f.definir = x => { r.value = x; pinta(); };
  return f;
}
function selecao(opcoes, valor, aoMudar) {
  const s = el("select", { class: "campo" });
  for (const [v, t] of opcoes) { const o = el("option", { value: v }, t); s.append(o); }
  if (!opcoes.some(([v]) => String(v) === String(valor))) s.append(el("option", { value: valor }, valor));
  s.value = valor;
  s.addEventListener("change", () => aoMudar(s.value));
  return s;
}
function aviso(titulo, texto, acao, verde) { return el("div", { class: "aviso" + (verde ? " verde" : "") }, el("div", { class: "t" }, el("b", {}, titulo), texto ? el("span", {}, texto) : null), acao); }
const divisoria = () => el("div", { class: "divisoria" }, el("i"), el("b"), el("s"));

// cabeçalho de página: um monstro por aba, cada um com um movimento (a cena é tirada dos vídeos da cópia do jogador)
function cabecalho(pagina, titulo, sub, cena, mov) {
  const fundo = el("div", { class: "cena" });
  const c = el("header", { class: "cabeca mov-" + mov }, fundo, el("div", { class: "titulo" }, el("h1", { class: "h1" }, titulo), divisoria(), el("p", { class: "sub" }, sub)));
  if (cena) Cenas.quadro(cena[0], cena[1], 960, 540).then(u => { if (u) fundo.style.backgroundImage = "url('" + u + "')"; });
  // parallax: a cena se afasta um pouco do mouse
  const pg = () => c.closest(".pagina");
  setTimeout(() => pg() && pg().addEventListener("mousemove", e => { const r = c.getBoundingClientRect(); fundo.style.translate = ((e.clientX - r.left) / r.width - .5) * -18 + "px " + ((e.clientY - r.top) / r.height - .5) * -8 + "px"; }), 0);
  fundo.style.transition = "translate .8s cubic-bezier(.23,1,.32,1)";
  return c;
}

// ---- busca de ajustes (o índice vem das linhas e dos títulos de cada página)
const busca = {
  itens: [],
  registrar(texto, alvo) { if (texto && typeof texto === "string") this.itens.push({ texto, alvo, chave: busca.normal(texto) }); },
  normal: t => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
};

// numeração das entradas em sequência (cada bloco nasce 45 ms depois do anterior)
function numerar(conteudo) { [...conteudo.children].forEach((c, i) => c.style.setProperty("--i", Math.min(i, 10))); }
const fmt = n => Number(n).toLocaleString("pt-BR");
