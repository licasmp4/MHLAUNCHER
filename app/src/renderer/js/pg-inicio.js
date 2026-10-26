// Início: a missão em destaque (cena do jogo tocando), o quadro de missões, seus números e seus caçadores.
window.Paginas = window.Paginas || {};
Paginas.inicio = {
  async montar(c) {
    const saves = await api.saves();
    const pc = saves.pc, emu = saves.emuladores[0];
    const mostrar = pc.length ? pc : emu ? emu.cacadores : [];
    const nome = mostrar[0] ? mostrar[0].nome : null;
    api.presencaNome(nome || "Caçador");

    // ---- destaque
    const estrelas = el("span", { class: "estrelas" }, "★★★★★★");
    const emCena = el("div", { class: "em-cena" }, el("i"), el("span", {}, "Em cena"));
    const pontos = el("div", { class: "pontos" });
    const destaque = el("section", { class: "destaque" },
      emCena, pontos,
      el("div", { class: "txt" },
        el("div", { class: "faixa-missao" }, el("span", { class: "etq" }, "Missão em destaque"), estrelas),
        el("h1", {}, nome ? "Bem-vindo, " + nome + "!" : "Bem-vindo, caçador!"),
        el("p", {}, "Tradução pt-BR por licas.mp3 · texturas HD · botões de PlayStation")));
    Cenas.LISTA.forEach((x, i) => pontos.append(el("i", { onclick: () => Cenas.tocar(i), title: x.nome })));
    Cenas.aoTrocar((cena, i) => {
      emCena.lastChild.textContent = "Em cena · " + cena.nome;
      estrelas.textContent = "★".repeat(cena.rank);
      [...pontos.children].forEach((p, k) => p.classList.toggle("on", k === i));
      $$(".cartaz", c).forEach((p, k) => p.classList.toggle("on", k === i));
    });

    // ---- avisos (atualizações, novidades, importar save)
    const avisos = el("div", { class: "grade", style: { gap: "12px", marginTop: "16px" } });

    // ---- quadro de missões: cartazes com a foto de cada cena
    const trilho = el("div", { class: "trilho" });
    const giros = [-2.4, 1.6, -1.1, 2.2, -1.8, 1.2, -2.0, 1.8, -1.4, 2.4];
    Cenas.LISTA.forEach((x, i) => {
      const foto = el("div", { class: "foto" });
      trilho.append(el("div", { class: "cartaz", style: { "--giro": giros[i] + "deg" }, onclick: () => Cenas.tocar(i) },
        foto, el("b", {}, x.nome), el("small", {}, el("em", {}, "★".repeat(x.rank)), "   Cena " + (i + 1))));
      Cenas.quadro(x.v, x.foto).then(u => { if (u) foto.style.backgroundImage = "url('" + u + "')"; });
    });
    const rolar = d => trilho.scrollBy({ left: d * trilho.clientWidth * .8 });
    const prateleira = el("div", { class: "prateleira" },
      el("button", { class: "seta e", onclick: () => rolar(-1), "aria-label": "anterior" }, svg("esquerda")), trilho,
      el("button", { class: "seta d", onclick: () => rolar(1), "aria-label": "próximo" }, svg("direita")));
    trilho.addEventListener("wheel", e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { trilho.scrollBy({ left: e.deltaY }); e.preventDefault(); } }, { passive: false });

    // ---- seus números
    const est = await api.estado();
    const res = await ini.get("Display", "Resolution", "Desktop");
    const fps = await ini.get("Performance", "FPS", "60"), vs = await ini.get("Performance", "VSync", "On");
    const ms = (await api.mods()).filter(m => m.ligado).length;
    const tOnline = el("b", {}, "Hospedar");
    const tiles = el("div", { class: "grade g4" },
      el("div", { class: "tile" }, svg("tela"), el("small", {}, "Resolução"), el("b", { class: "num" }, res === "Desktop" ? est.monitor.largura + "x" + est.monitor.altura : res)),
      el("div", { class: "tile" }, svg("raio"), el("small", {}, "Limite de FPS"), el("b", { class: "num" }, fps + " FPS" + (vs === "On" ? " · VSync" : ""))),
      el("div", { class: "tile" }, svg("bolsa"), el("small", {}, "Mods ativos"), el("b", {}, ms + (ms === 1 ? " mod" : " mods"))),
      el("div", { class: "tile" }, svg("pessoas"), el("small", {}, "Online"), tOnline));
    Paginas.inicio.tileOnline = tOnline;

    // ---- caçadores (Cartão de Guilda)
    const cartas = el("div", { class: "grade g3" });
    for (const h of mostrar) cartas.append(el("div", { class: "guilda" },
      el("div", { class: "selo-hr" }, el("small", {}, "HR"), el("b", {}, h.hr)),
      el("div", { class: "q" }, el("small", {}, "Cartão de Guilda · " + h.slot + "º personagem"), el("b", {}, h.nome),
        el("span", { class: "num" }, (h.horas < 1 ? Math.round(h.horas * 60) + " min" : h.horas.toFixed(1).replace(".", ",") + " h") + " de caça · " + fmt(h.zenny) + " z"))));
    if (!mostrar.length) cartas.append(el("div", { class: "dica" }, "Nenhum caçador ainda. Crie um no jogo ou importe seu save do Switch/emulador."));
    if (emu && (!pc.length || emu.quando > saves.pcQuando + 60000)) {
      const nomes = emu.cacadores.map(h => h.nome + " (HR " + h.hr + ")").join(", ");
      avisos.append(aviso((pc.length ? "Seu save do " + emu.emulador + " é mais novo" : "Achei seu save do " + emu.emulador) + ": " + nomes,
        "Continuar de onde parou no PC? O save atual do PC vai para um backup antes.",
        botao("Importar save", async () => { const r = await api.savesImportar(emu.arquivo); toast(r.erro || "Save importado"); }, "primario")));
    }

    c.append(destaque, avisos, el("h3", { class: "secao", style: { marginTop: "26px" } }, "Quadro de missões", el("span", { class: "acao dica" }, "escolha um cartaz para ver em destaque")),
      prateleira, el("h3", { class: "secao", style: { marginTop: "8px" } }, "Seu jogo"), tiles, el("h3", { class: "secao", style: { marginTop: "26px" } }, "Seus caçadores"), cartas);
    Paginas.inicio.avisos = avisos;

    if ((await api.configGet("cenas")) !== false && Cenas.LISTA.length) {
      const tem = await Cenas.video(2);
      if (tem) Cenas.ligar(destaque);
      else destaque.style.background = "radial-gradient(90% 120% at 80% 30%, rgba(226,96,63,.3), transparent), #1b1714";
    }
  },
};
