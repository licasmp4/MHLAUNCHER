// Mods e Cheats, e Sobre (atualizações, aparência, pastas e créditos).
Paginas.mods = {
  async montar(c) {
    const lista = el("div"), cheats = el("div");
    const tam = b => b > 1 << 30 ? (b / (1 << 30)).toFixed(1).replace(".", ",") + " GB" : Math.round(b / (1 << 20)) + " MB";
    for (const m of await api.mods()) lista.append(linha(m.nome === "HUD de Caca" ? "HUD de Caça (barra de vida + números de dano)" : m.nome, fmt(m.arquivos) + " arquivos · " + tam(m.bytes) + (m.plugins ? " · plugins Forge" : ""),
      chave(m.ligado, async v => { try { await api.modsLigar(m.nome, v); toast(v ? "Mod ligado" : "Mod desligado"); } catch { toast("Não deu: o jogo está aberto?"); } })));
    if (!lista.children.length) lista.append(el("div", { class: "dica" }, "Nenhum mod. Cada mod é uma pasta com romfs dentro, em mods."));
    for (const ch of await api.cheats()) cheats.append(linha(ch.nome, null, chave(ch.ligado, v => { api.cheatsLigar(ch.arquivo, v); ch.arquivo = (v ? "" : "_") + ch.arquivo.replace(/^_/, ""); toast(v ? "Cheat ligado" : "Cheat desligado"); })));
    if (!cheats.children.length) cheats.append(el("div", { class: "dica" }, "Nenhum cheat. Coloque arquivos .txt (Ryujinx/Atmosphère, versão 1.4.0) na pasta."));
    // a tradução: nomes de itens, joias e áreas em inglês (como nas wikis e nos guias) ou tudo em português
    const lay = await api.layouts();
    const temPT = lay.instaladosPT && lay.instaladosPT[lay.atual];
    const exemplo = el("div", { class: "dica", style: { marginTop: "6px" } });
    const pintaEx = n => { exemplo.textContent = n === "PT" ? "Exemplo: Poção, Megapoção, Pedra de Amolar, Minério de Ferro, Fronteira Jurássica." : "Exemplo: Potion, Mega Potion, Whetstone, Iron Ore, Jurassic Frontier. O resto do jogo fica em português."; };
    pintaEx(lay.nomes);
    const traducao = cartao(secao("Tradução"),
      linha("Nomes de itens, joias e áreas", temPT ? "Em inglês ficam iguais aos das wikis e dos guias; em português, o jogo fica todo traduzido. Vale ao abrir o jogo." : "A versão com tudo em português não está instalada nesta cópia. Atualize pelo instalador novo.",
        seg([["EN", "Em inglês"], ["PT", "Tudo em português"]], lay.nomes, async v => {
          const r = await api.layoutsNomes(v); if (r && r.erro) { toast(r.erro); return; } pintaEx(v); toast(v === "PT" ? "Tudo em português ao abrir o jogo" : "Nomes em inglês ao abrir o jogo");
        }), "globo"), exemplo);
    const hud = await cartaoHud(await api.plugins());
    c.append(cabecalho("mods", "Mods e Cheats", "Ligue e desligue sem mexer em pastas. Vale ao abrir o jogo.", [1, 21], "respira"), hud, traducao,
      cartao(secao("Mods", botao("Abrir pasta", () => api.abrir("mods"), "peq fantasma", "pasta")), lista),
      cartao(secao("Cheats · .txt da versão 1.4.0", botao("Abrir pasta", () => api.abrir("cheats"), "peq fantasma", "pasta")), cheats));
  },
};

Paginas.sobre = {
  async montar(c) {
    const est = await api.estado();
    // ---- atualizações: o launcher, o port oficial e as correções
    const lTxt = el("div", { class: "dica" }, "Procurando..."), pTxt = el("div", { class: "dica" }, "Procurando...");
    const lBtn = botao("Procurar de novo", () => verLauncher(), "peq"), pBtn = botao("Procurar de novo", () => verPort(), "peq");
    async function verLauncher() {
      lTxt.textContent = "Procurando..."; lTxt.style.color = "";
      try {
        const r = await api.atualizaLauncher();
        if (r.nenhum) { lTxt.textContent = "Ainda não há versões publicadas no GitHub."; return; }
        if (r.correcao) Paginas.sobre.correcao = r.correcao;
        if (!r.nova) { lTxt.textContent = "Você está na versão mais nova."; lTxt.style.color = "var(--verde)"; lBtn.textContent = "Procurar de novo"; lBtn.onclick = verLauncher; }
        else {
          lTxt.textContent = "Nova versão: v" + r.ultima; lTxt.style.color = "var(--brasa2)"; lBtn.textContent = "Atualizar para v" + r.ultima; lBtn.classList.add("primario");
          lBtn.onclick = async () => { lBtn.disabled = true; try { await api.atualizaLauncherAplicar(r); } catch (e) { toast(String(e.message || e)); lBtn.disabled = false; } };
        }
        if (r.correcao) pintaCorrecao(r.correcao);
      } catch { lTxt.textContent = "Sem internet agora."; }
    }
    function pintaCorrecao(cr) {
      pTxt.textContent = "Correções disponíveis: " + cr.nome; pTxt.style.color = "var(--brasa2)"; pBtn.textContent = "Aplicar correções"; pBtn.classList.add("primario");
      pBtn.onclick = async () => { pBtn.disabled = true; try { await api.atualizaCorrecao(cr); toast("Port atualizado: " + cr.nome); pTxt.textContent = "Correções aplicadas: " + cr.nome; pTxt.style.color = "var(--verde)"; pBtn.textContent = "Procurar de novo"; pBtn.classList.remove("primario"); pBtn.onclick = verPort; } catch (e) { toast(String(e.message || e)); } pBtn.disabled = false; };
    }
    async function verPort() {
      pTxt.textContent = "Procurando..."; pTxt.style.color = "";
      try {
        const r = await api.atualizaPort(); if (!r) { pTxt.textContent = "Não deu para procurar."; return; }
        if (!r.nova) { pTxt.textContent = "Você está na versão mais nova (" + (est.versaoPort || r.instalada) + ")."; pTxt.style.color = "var(--verde)"; if (Paginas.sobre.correcao) pintaCorrecao(Paginas.sobre.correcao); return; }
        pTxt.textContent = "Nova versão do port: " + r.ultima; pTxt.style.color = "var(--brasa2)"; pBtn.textContent = "Atualizar para " + r.ultima; pBtn.classList.add("primario");
        pBtn.onclick = async () => { pBtn.disabled = true; try { const n = await api.atualizaPortAplicar(r); toast("Port atualizado para " + r.ultima); pTxt.textContent = "Atualizado para " + r.ultima + " (" + n + " arquivo(s); os antigos estão em port_anterior)."; pTxt.style.color = "var(--verde)"; } catch (e) { toast(String(e.message || e)); } pBtn.disabled = false; };
      } catch { pTxt.textContent = "Sem internet agora."; }
    }
    api.aoProgresso(({ tipo, p }) => { if (tipo.startsWith("jogo:")) return; const b = tipo === "launcher" ? lBtn : pBtn; b.textContent = "Baixando " + p + "%"; });
    verLauncher().then(verPort);
    Paginas.sobre.reverificar = () => verLauncher().then(verPort);

    const cenas = (await api.configGet("cenas")) !== false;
    c.append(cabecalho("sobre", "Sobre", "Quem fez cada parte, atualizações e pastas.", [9, 169], "sobe"),
      el("div", { class: "aviso", style: { padding: "20px 22px" } }, el("div", { class: "t" }, el("span", {}, "MHGU Launcher · tradução pt-BR · instalador · correções do port"), el("b", { style: { font: "900 30px var(--display)", margin: "2px 0" } }, "licas.mp3"))),
      cartao(secao("Atualizações"), linha("MHGU Launcher v" + est.versao, lTxt, lBtn), linha("Port MHGURecomp " + (est.versaoPort || ""), pTxt, pBtn),
        el("div", { class: "dica", style: { paddingTop: "6px" } }, "A atualização troca só os arquivos do port. Jogo, tradução, mods, saves e configurações ficam como estão.")),
      cartao(secao("Aparência"), linha("Cenas animadas", "Cenas do jogo no Início e no fundo (dos vídeos da sua cópia). Desligue em PC fraco.", chave(cenas, async v => { await api.configSet("cenas", v); v ? Cenas.ligar($(".destaque")) : Cenas.desligar(); }), "cena")),
      cartao(secao("Pastas"), el("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
        botao("Pasta do jogo", () => api.abrir("jogo"), "peq", "pasta"), botao("Saves", () => api.abrir("saves"), "peq", "pasta"), botao("Screenshots", () => api.abrir("prints"), "peq", "pasta"), botao("Log do jogo", () => api.abrir("log"), "peq"),
        botao("Trocar pasta do jogo", async () => { if (await api.pastaEscolher()) location.reload(); else toast("Essa pasta não tem o " + (est.plataforma === "win32" ? "mhgurecomp.exe" : "mhgurecomp")); }, "peq"),
        botao("Restaurar padrões", async () => { await api.iniRestaurar(); toast("Configurações do port restauradas"); }, "peq fantasma"))),
      // no pergaminho (app.css #pg-sobre .cartao): texto na tinta das dicas, nomes na tinta escura
      cartao(secao("Créditos"), el("div", { class: "dica", style: { lineHeight: "1.9", fontSize: "inherit" } },
        "Tradução pt-BR, launcher, instalador e correções do port: ", el("b", {}, "licas.mp3"), el("br"),
        "Design e pixel art (tema, ícones e cenas animadas): ", el("b", {}, "Thainá (Ataenas)"), el("br"),
        "Port de PC MHGURecomp: morerokk", el("br"), "Texturas HD (MHGU HD Project): Monkbreh", el("br"), "Barra de vida e números de dano: Lawrence-al (plugins Forge)", el("br"),
        "Forge: Fexty12573 · fontes Cinzel e Alegreya Sans (SIL OFL 1.1)", el("br"), "Monster Hunter Generations Ultimate © CAPCOM. Use a sua própria cópia do jogo.")));
  },
};
