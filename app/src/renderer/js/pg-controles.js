// Controles: os ícones de botão dentro do jogo (PlayStation / Xbox / Nintendo), um controle desenhado com esses
// botões, os controles conectados (Gamepad API: aparece assim que você aperta um botão) e os atalhos.
const LAYOUT = {
  PS: { nome: "PlayStation", t: ["△", "○", "✕", "☐"], c: ["#3e8e7e", "#c24b5a", "#4a7bc0", "#b06aa8"], gat: ["L1", "R1"], meio: ["Create", "Options"] },
  Xbox: { nome: "Xbox", t: ["Y", "B", "A", "X"], c: ["#b89a2e", "#c24b3a", "#3fa34d", "#2f6fc0"], gat: ["LB", "RB"], meio: ["View", "Menu"] },
  Nintendo: { nome: "Nintendo", t: ["X", "A", "B", "Y"], c: ["#6e6e6e", "#6e6e6e", "#6e6e6e", "#6e6e6e"], gat: ["L", "R"], meio: ["−", "+"] },
};

function desenharControle(lay) {
  const L = LAYOUT[lay], ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg"); s.setAttribute("viewBox", "0 0 400 230");
  const add = (tag, a, txt) => { const e = document.createElementNS(ns, tag); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; s.append(e); return e; };
  s.innerHTML = '<defs><linearGradient id="couro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a312a"/><stop offset="1" stop-color="#1e1915"/></linearGradient>' +
    '<radialGradient id="alav"><stop offset="0" stop-color="#2e2722"/><stop offset="1" stop-color="#120f0c"/></radialGradient></defs>';
  [[62, L.gat[0]], [278, L.gat[1]]].forEach(([x, t]) => { add("rect", { x, y: 16, width: 60, height: 20, rx: 8, fill: "url(#couro)", stroke: "#8a6e52", "stroke-width": 1.5 }); add("text", { x: x + 30, y: 30.5, "text-anchor": "middle", fill: "#f2e9d8", "font-size": 11, "font-weight": 700, "font-family": "Alegreya Sans" }, t); });
  add("path", { d: "M100,38 H300 C356,38 378,88 388,148 C396,198 360,216 334,188 L296,148 H104 L66,188 C40,216 4,198 12,148 C22,88 44,38 100,38 Z", fill: "url(#couro)", stroke: "#8a6e52", "stroke-width": 2 });
  add("circle", { cx: 102, cy: 94, r: 24, fill: "url(#alav)", stroke: "#8a6e52", "stroke-width": 1.5 });
  add("circle", { cx: 254, cy: 148, r: 24, fill: "url(#alav)", stroke: "#8a6e52", "stroke-width": 1.5 });
  add("path", { d: "M138,130 h10 v10 h10 v10 h-10 v10 h-10 v-10 h-10 v-10 h10 z", fill: "#2a231e", stroke: "#8a6e52", "stroke-width": 1.2 });
  add("text", { x: 172, y: 86, fill: "#8c7d68", "font-size": 10, "font-family": "Alegreya Sans" }, L.meio[0]);
  add("text", { x: 214, y: 86, fill: "#8c7d68", "font-size": 10, "font-family": "Alegreya Sans" }, L.meio[1]);
  const pos = [[0, -26], [26, 0], [0, 26], [-26, 0]], botoes = [];
  pos.forEach(([dx, dy], i) => {
    const g = document.createElementNS(ns, "g"); g.setAttribute("class", "bface");
    const c = document.createElementNS(ns, "circle"); c.setAttribute("cx", 300 + dx); c.setAttribute("cy", 94 + dy); c.setAttribute("r", 12); c.setAttribute("fill", L.c[i]); c.setAttribute("stroke", "rgba(0,0,0,.5)");
    const t = document.createElementNS(ns, "text"); t.setAttribute("x", 300 + dx); t.setAttribute("y", 94 + dy + 4.5); t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "#fff"); t.setAttribute("font-size", 12.5); t.setAttribute("font-weight", 800); t.setAttribute("font-family", "Alegreya Sans"); t.textContent = L.t[i];
    g.append(c, t); s.append(g); botoes.push(g);
  });
  return { s, botoes };
}

Paginas.controles = {
  async montar(c) {
    // ---- botões no jogo
    const lays = await api.layouts();
    const prev = el("section", { class: "previa controle" });
    const legenda = el("div", { class: "legenda" });
    let botoes = [];
    const pintar = lay => {
      prev.querySelectorAll("svg").forEach(x => x.remove());
      const d = desenharControle(lay); prev.prepend(d.s); botoes = d.botoes;
      const t = LAYOUT[lay].t;
      legenda.innerHTML = ""; legenda.append(el("b", {}, t[0]), "  sacar arma   ·   ", el("b", {}, t[1]), "  atacar / confirmar   ·   ", el("b", {}, t[2]), "  rolar / voltar   ·   ", el("b", {}, t[3]), "  usar item");
    };
    prev.append(el("span", { class: "etiqueta" }, "Seu controle no jogo"), legenda);
    let vez = 0;
    setInterval(() => { if (!$("#pg-controles").classList.contains("ativa") || !botoes.length) return; const b = botoes[vez++ % botoes.length]; b.classList.remove("acende"); void b.getBoundingClientRect(); b.classList.add("acende"); }, 520);
    const ops = Object.entries(LAYOUT).map(([k, L]) => {
      const inst = k === "PS" || lays.instalados[k];
      const mini = el("div", { style: { position: "relative", width: "44px", height: "44px", flex: "none" } }, [[14, 0], [28, 14], [14, 28], [0, 14]].map(([x, y], i) => el("span", { style: { position: "absolute", left: x + "px", top: y + "px", width: "16px", height: "16px", borderRadius: "50%", background: L.c[i], color: "#fff", fontSize: "9.5px", fontWeight: 800, display: "grid", placeItems: "center" } }, L.t[i])));
      const o = el("button", { class: "opcao" + (lays.atual === k ? " on" : ""), disabled: !inst }, el("div", { style: { display: "flex", gap: "14px", alignItems: "center" } }, mini, el("div", {}, el("div", { class: "nome" }, L.nome), el("div", { class: "info" }, inst ? L.t.join(" ") : "não instalado"))));
      o.addEventListener("click", async () => { const r = await api.layoutsTrocar(k); if (r.erro) return toast(r.erro); ops.forEach(x => x.classList.toggle("on", x.k === k)); pintar(k); toast("Botões de " + L.nome + " no jogo"); });
      o.k = k; return o;
    });
    pintar(lays.atual);

    // ---- conectados agora (Gamepad API)
    const lista = el("div");
    const nomeDe = id => /054c/i.test(id) ? (/0ce6|0df2/i.test(id) ? "DualSense (PS5)" : "DualShock 4 (PS4)") : /045e/i.test(id) ? "Controle Xbox" : /057e/i.test(id) ? (/2009/i.test(id) ? "Pro Controller (Switch)" : "Joy-Con (Switch)") : /8bitdo/i.test(id) ? "8BitDo" : id.replace(/\(.*\)/, "").trim() || "Controle";
    const atualizar = () => {
      const pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean);
      lista.innerHTML = "";
      if (!pads.length) return lista.append(el("div", { class: "dica" }, "Aperte qualquer botão do controle para ele aparecer aqui. Teclado e mouse também funcionam."));
      for (const p of pads) lista.append(el("div", { class: "ip" }, svg("M7 8h10c3 0 4.5 3 4.5 6 0 3-2 4-3.5 2.5L16 14.5H8L6 16.5C4.5 18 2.5 17 2.5 14 2.5 11 4 8 7 8z"),
        el("div", {}, el("b", { style: { font: "700 16px var(--sans)" } }, nomeDe(p.id)), el("span", { style: { color: "var(--verde)" } }, "conectado · reconhecido pelo port")), el("span", { class: "selo verde" }, "ativo")));
    };
    window.addEventListener("gamepadconnected", atualizar); window.addEventListener("gamepaddisconnected", atualizar);
    setInterval(() => $("#pg-controles").classList.contains("ativa") && atualizar(), 1500); atualizar();

    // ---- mapa de botões (o jogo foi feito para o controle do Switch: confirmar é o botão da direita)
    const fb = await ini.get("Controls", "FaceButtons", "Position");
    const mapa = el("div", { class: "grade g2", style: { gap: "4px 28px" } });
    const MAPA = [["A · confirmar", "○", "B"], ["B · voltar", "✕", "A"], ["X", "△", "Y"], ["Y", "☐", "X"], ["L", "L1", "LB"], ["R", "R1", "RB"], ["ZL", "L2", "LT"], ["ZR", "R2", "RT"], ["+ · menu", "Options", "Menu"], ["−", "Create", "View"]];
    for (const [sw, ps] of MAPA) mapa.append(el("div", { class: "linha", style: { gridTemplateColumns: "1fr auto", padding: "8px 0" } }, el("span", { class: "dica", style: { fontSize: "14.5px" } }, "Switch " + sw), el("span", { class: "selo brasa", style: { minWidth: "56px", justifyContent: "center", fontSize: "13.5px" } }, ps)));

    const atalhos = el("div", { class: "grade g2", style: { gap: "4px 28px", marginTop: "6px" } }, [["Mouse", "câmera (clique na janela)"], ["Esc", "solta o mouse"], ["Alt+Enter", "janela ou tela cheia"], ["Insert", "menu da barra de vida e do dano"], ["F12", "screenshot"], ["F7", "troca o anti-serrilhado"]]
      .map(([k, t]) => el("div", { class: "linha", style: { gridTemplateColumns: "auto 1fr", padding: "8px 0" } }, el("span", { class: "selo", style: { fontFamily: "ui-monospace, Consolas, monospace" } }, k), el("span", { class: "dica", style: { fontSize: "14.5px" } }, t))));
    const tec = await montarTeclado();
    const sens = +(await ini.get("Mouse", "MouseSensitivity", "1.0")) || 1;

    c.append(cabecalho("controles", "Controles", "Os botões que aparecem no jogo e o seu controle.", [3, 27], "flutua"),
      secao("Botões no jogo"), el("div", { class: "grade g3" }, ops), el("div", { class: "dica", style: { margin: "10px 0 18px" } }, "Os ícones de botão dentro do jogo (menus, dicas, tutoriais). Vale ao abrir o jogo."),
      prev,
      cartao(secao("Conectados agora"), lista),
      cartao(secao("Botões no seu controle", el("span", {}, seg([["Position", "Pela posição"], ["Label", "Pela letra"]], fb, v => ini.set("Controls", "FaceButtons", v)))), mapa),
      cartao(secao("Teclado e mouse", tec.restaurar), el("div", { class: "dica", style: { marginBottom: "4px" } }, "Clique numa tecla para trocar e aperte a nova (tecla, botão do mouse ou rodinha). O + junta mais uma; o × tira. Vale ao abrir o jogo."), tec.caixa,
        el("div", { style: { height: "10px" } }), secao("Fixos"), atalhos, linha("Sensibilidade do mouse", "Clique no jogo para prender o mouse; Esc solta.", el("div", { style: { width: "min(360px, 40vw)" } }, faixa(.1, 5, .1, sens, x => x.toFixed(1).replace(".", ","), x => ini.set("Mouse", "MouseSensitivity", x.toFixed(1)))), "mouse")));
    prev.style.marginBottom = "20px";
  },
};
