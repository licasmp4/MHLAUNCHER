// Gráficos (perfis, prévia de qualidade, tela e qualidade) e FPS e Hz.
const PERFIS = monitor => [
  { nome: "Leve", render: "1280x720", msaa: "Off", fxaa: true, fps: 60, barras: 1, qualidade: 1, leveza: 5 },
  { nome: "Equilibrado", render: "Auto", msaa: "2x", fxaa: true, fps: Math.max(60, Math.min(120, monitor.hz)), barras: 2, qualidade: 3, leveza: 3 },
  { nome: "Ultra", render: monitor.altura <= 900 ? "2560x1440" : "3840x2160", msaa: "8x", fxaa: false, fps: Math.max(60, Math.min(240, monitor.hz)), barras: 3, qualidade: 5, leveza: 1 },
];
const NOME_RES = { "1280x720": "720p", Auto: "resolução da tela", "1920x1080": "1080p", "2560x1440": "1440p", "3840x2160": "4K" };

Paginas.graficos = {
  async montar(c) {
    const est = await api.estado(), m = est.monitor, perfis = PERFIS(m);
    const g = { render: await ini.get("Display", "RenderResolution", "Auto"), msaa: await ini.get("Anti-aliasing", "MSAA", "Off"), fxaa: (await ini.get("Anti-aliasing", "FXAA", "On")) === "On", fps: +(await ini.get("Performance", "FPS", "60")) };
    const controles = {};
    const atual = () => perfis.find(p => p.render.toLowerCase() === g.render.toLowerCase() && p.msaa.toLowerCase() === g.msaa.toLowerCase() && p.fxaa === g.fxaa && p.fps === g.fps);

    // ---- perfis
    const ops = perfis.map(p => {
      const bars = el("div", { style: { display: "flex", gap: "3px", alignItems: "flex-end", height: "16px" } }, [0, 1, 2].map(k => el("i", { style: { width: "5px", height: 6 + k * 5 + "px", borderRadius: "1.5px", background: k < p.barras ? "var(--tx)" : "var(--s4)" } })));
      const rec = el("span", { class: "selo brasa", hidden: true }, "Recomendado");
      const o = el("button", { class: "opcao" }, el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, bars, rec),
        el("div", { class: "nome", style: { marginTop: "12px" } }, p.nome), el("div", { class: "info num" }, NOME_RES[p.render] + " · " + p.fps + " FPS · " + (p.msaa === "Off" ? "sem MSAA" : "MSAA " + p.msaa)),
        el("div", { class: "medidor", style: { marginTop: "12px" } }, el("span", {}, "Qualidade"), el("div", { class: "trilho" }, [1, 2, 3, 4, 5].map(k => el("i", { class: k <= p.qualidade ? "on" : "" })))),
        el("div", { class: "medidor" }, el("span", {}, "Leveza"), el("div", { class: "trilho leve" }, [1, 2, 3, 4, 5].map(k => el("i", { class: k <= p.leveza ? "on" : "" })))));
      o.addEventListener("click", () => aplicar(p));
      o.rec = rec; o.perfil = p;
      return o;
    });
    const placaTxt = el("div", { class: "dica", style: { marginTop: "10px" } });
    async function aplicar(p) {
      g.render = p.render; g.msaa = p.msaa; g.fxaa = p.fxaa; g.fps = p.fps;
      await ini.set("Display", "RenderResolution", p.render); await ini.set("Anti-aliasing", "MSAA", p.msaa); await ini.set("Anti-aliasing", "FXAA", p.fxaa ? "On" : "Off");
      await ini.set("Performance", "FPS", p.fps); await ini.set("Performance", "VSync", "On");
      controles.render.value = p.render; controles.msaa.definir(p.msaa); controles.fxaa.definir(p.fxaa);
      toast("Perfil " + p.nome + " aplicado"); marcar();
    }
    let placa = null;
    function marcar() {
      const a = atual(); ops.forEach(o => o.classList.toggle("on", o.perfil === a));
      placaTxt.textContent = (a ? "Perfil " + a.nome + " ativo." : "Personalizado: os ajustes abaixo não batem com nenhum perfil.") + (placa ? "  ·  Sua placa: " + placa.nome + " (" + Math.round(placa.vram / 1073741824) + " GB) → recomendado: " + placa.recomendado : "");
    }
    api.sistemaPlaca().then(p => { placa = p; if (p) ops.forEach(o => o.rec.hidden = o.perfil.nome !== p.recomendado); marcar(); });

    // ---- tela e qualidade
    const res = await ini.get("Display", "Resolution", "Desktop");
    controles.render = selecao([["Auto", "Automática"], ["1280x720", "720p · leve"], ["1920x1080", "1080p"], ["2560x1440", "1440p"], ["3840x2160", "4K · mais nítido"]], g.render, v => { g.render = v; ini.set("Display", "RenderResolution", v); marcar(); });
    controles.msaa = seg([["Off", "Off"], ["2x", "2x"], ["4x", "4x"], ["8x", "8x"]], g.msaa, v => { g.msaa = v; ini.set("Anti-aliasing", "MSAA", v); marcar(); });
    controles.fxaa = chave(g.fxaa, v => { g.fxaa = v; ini.set("Anti-aliasing", "FXAA", v ? "On" : "Off"); marcar(); });
    const fov = Math.max(70, Math.min(120, Math.round((+(await ini.get("Display", "FOV", "1.0")) || 1) * 90)));
    const fovF = faixa(70, 120, 1, fov, x => x + "°", x => ini.set("Display", "FOV", (x / 90).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")));
    const atalhos = el("div", { style: { display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" } }, [80, 90, 100, 110, 120].map(x => botao(x + "°" + (x === 90 ? " padrão" : ""), () => { fovF.definir(x); ini.set("Display", "FOV", (x / 90).toFixed(3)); }, "peq")));
    const tela = cartao(secao("Tela"),
      linha("Modo de tela", "Sem borda é a tela cheia mais rápida para trocar de janela.", seg([["Borderless", "Sem borda"], ["Fullscreen", "Tela cheia"], ["Windowed", "Janela"]], await ini.get("Display", "Mode", "Borderless"), v => ini.set("Display", "Mode", v)), "janela"),
      linha("Resolução da tela", "Tamanho da janela ou da tela cheia.", selecao([["Desktop", "Do monitor (" + m.largura + "x" + m.altura + ")"], ["1280x720", "1280x720"], ["1600x900", "1600x900"], ["1920x1080", "1920x1080"], ["2560x1440", "2560x1440"], ["3840x2160", "3840x2160"]], res, v => ini.set("Display", "Resolution", v)), "resolucao"),
      linha("Proporção", "21:9 e 32:9 para monitores ultrawide.", seg([["Auto", "Auto"], ["16:9", "16:9"], ["16:10", "16:10"], ["21:9", "21:9"], ["32:9", "32:9"]], await ini.get("Display", "AspectRatio", "Auto"), v => ini.set("Display", "AspectRatio", v)), "proporcao"),
      linha("HUD em tela larga", "No centro (como o jogo) ou espalhado até as bordas.", seg([["Center", "No centro"], ["Edges", "Nas bordas"]], await ini.get("Display", "UIAnchor", "Center"), v => ini.set("Display", "UIAnchor", v)), "hud"));
    const qual = cartao(secao("Qualidade"),
      linha("Resolução 3D", "Acima da tela fica mais nítido e mais pesado.", controles.render, "nitido"),
      linha("Anti-serrilhado (MSAA)", "Suaviza as bordas. Pesa em placas antigas.", controles.msaa, "serrilha"),
      linha("FXAA", "Filtro leve de bordas do próprio jogo (deixa um pouco borrado).", controles.fxaa, "filtro"),
      linha("Campo de visão (FOV)", "90° é o padrão do jogo. Limite: 70° a 120°.", el("div", { style: { width: "min(420px, 46vw)" } }, fovF, atalhos), "fov"));

    c.append(cabecalho("graficos", "Gráficos", "Tela, resolução e qualidade da imagem.", [4, 27], "olho"),
      secao("Perfil"), el("div", { class: "grade g3" }, ops), placaTxt, tela, qual);
    tela.style.marginTop = "20px";
    busca.registrar("Perfil Leve Equilibrado Ultra", ops[0]);
    marcar();
    ini.aoMudar((s, k) => { if (s === "Performance" && k === "FPS") ini.get("Performance", "FPS", "60").then(v => { g.fps = +v; marcar(); }); });
  },
};

Paginas.fps = {
  async montar(c) {
    const m = (await api.estado()).monitor;
    const fps = +(await ini.get("Performance", "FPS", "60")) || 60, vs = (await ini.get("Performance", "VSync", "On")) === "On";
    CenasPixel.fps(fps);
    ini.aoMudar((s, k) => { if (s === "Performance" && k === "FPS") ini.get("Performance", "FPS", "60").then(v => CenasPixel.fps(v)); });
    const dica = el("div", { class: "dica", style: { marginTop: "10px" } });
    let atual = fps, vsync = vs;
    const pintaDica = () => dica.textContent = vsync && atual > m.hz ? "Com VSync ligado o jogo não passa de " + m.hz + " FPS no seu monitor." : vsync && m.hz % atual ? "Dica: com VSync, um limite que divide " + m.hz + " (ex.: " + m.hz + " ou " + m.hz / 2 + ") fica mais liso." : "Boa escolha para o seu monitor.";
    const grande = el("b", { class: "num", style: { font: "900 44px var(--display)" } }, fps);
    const f = faixa(30, 240, 1, fps, x => "", x => { atual = x; grande.textContent = x; pintaDica(); ini.set("Performance", "FPS", x); });
    f.querySelector(".valor").remove();
    const chips = el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "14px" } },
      [30, 60, 120, 144, 165, 240].map(x => botao(x + " FPS", () => { f.definir(x); atual = x; grande.textContent = x; pintaDica(); ini.set("Performance", "FPS", x); }, "peq")),
      botao("Igual ao monitor (" + m.hz + ")", () => { const x = Math.max(30, Math.min(240, m.hz)); f.definir(x); atual = x; grande.textContent = x; pintaDica(); ini.set("Performance", "FPS", x); }, "peq primario"));
    pintaDica();
    c.append(cabecalho("fps", "FPS e Hz", "Seu monitor: " + m.largura + "x" + m.altura + " a " + m.hz + " Hz.", [6, 35], "corre"),
      cartao(secao("Limite de FPS"), el("div", { style: { display: "flex", alignItems: "center", gap: "22px" } }, el("div", { style: { flex: "1" } }, f), grande), chips,
        el("div", { class: "dica", style: { marginTop: "12px" } }, "30 = como no Switch. A velocidade do jogo é a mesma em qualquer FPS.")),
      cartao(secao("Sincronia"), linha("VSync", "Sem rasgos na imagem; o FPS não passa dos Hz do monitor.", chave(vs, v => { vsync = v; pintaDica(); ini.set("Performance", "VSync", v ? "On" : "Off"); }), "vsync"), dica));
  },
};
