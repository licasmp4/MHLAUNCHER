// O HUD de caça (barra de vida, números de dano, hitmarker): o mesmo cartão nas abas Caçada e Mods.
async function cartaoHud(pl) {
  const num = await api.pluginsDano("numbers"), hit = await api.pluginsDano("hitmarker");
  const afi = await api.pluginsDano("sharpness"), med = await api.pluginsDano("meter");
  const dano = (k, v, t) => api.pluginsDano(k, v).then(() => toast(t));
  return cartao(secao("HUD de caça"),
    linha("Barra de vida do monstro", pl.vida.instalado ? "Mostra sozinha o monstro grande da área, com coroa e raiva. Marcando outro na câmera de alvo, ela segue o marcado." : "Plugin não instalado.",
      chave(pl.vida.ligado, async v => { await api.pluginsLigar("vida", v); toast(v ? "Barra de vida ligada" : "Barra de vida desligada"); }, !pl.vida.instalado), "vida"),
    linha("Números de dano", pl.dano.instalado ? "O dano de cada golpe seu, no ponto do golpe (amarelo = ponto fraco)." : "Plugin não instalado.",
      chave(pl.dano.ligado && num, v => dano("numbers", v, v ? "Números de dano ligados" : "Números de dano desligados"), !pl.dano.instalado), "dano"),
    linha("Hitmarker", pl.dano.instalado ? "Um X rápido no ponto de cada golpe que acerta (maior no ponto fraco)." : "Plugin não instalado.",
      chave(pl.dano.ligado && hit, v => dano("hitmarker", v, v ? "Hitmarker ligado" : "Hitmarker desligado"), !pl.dano.instalado), "olho"),
    linha("Afiação exata", pl.dano.instalado ? "Os pontos de afiação da arma (atual / máximo) com uma barrinha, no canto da tela durante a missão." : "Plugin não instalado.",
      chave(pl.dano.ligado && afi, v => dano("sharpness", v, v ? "Afiação exata ligada" : "Afiação exata desligada"), !pl.dano.instalado), "nitido"),
    linha("Medidor de dano", pl.dano.instalado ? "O seu dano total na missão e o dano por segundo. Recomeça a cada missão." : "Plugin não instalado.",
      chave(pl.dano.ligado && med, v => dano("meter", v, v ? "Medidor de dano ligado" : "Medidor de dano desligado"), !pl.dano.instalado), "dano"),
    el("div", { class: "dica", style: { paddingTop: "8px" } }, "Vale ao abrir o jogo. No jogo, Insert abre o menu Forge > Plugin UI (posição, cores e tamanho)."));
}

// Caçada: prévia do HUD (barra de vida e números de dano sobre uma cena), plugins, diagnóstico e a vida dos monstros.
Paginas.cacada = {
  async montar(c) {
    const pl = await api.plugins();
    // ---- plugins
    const hud = await cartaoHud(pl);

    // ---- diagnóstico da última caçada
    const diagBox = el("div");
    async function diagnostico() {
      diagBox.innerHTML = ""; diagBox.append(el("div", { class: "dica" }, "Lendo o log do jogo..."));
      const d = await api.diag(); diagBox.innerHTML = "";
      const item = (cor, t) => diagBox.append(el("div", { style: { padding: "4px 0", color: cor } }, t));
      if (!d || d.semLog) return item("var(--tx3)", "Ainda não há log: abra o jogo e faça uma caçada.");
      if (!pl.vida.ligado) item("var(--tx3)", "Barra de vida: desligada.");
      else if (d.vidaIncompat) item("var(--vermelho)", "Barra de vida: o plugin não é compatível com esta versão do jogo (precisa da 1.4.0).");
      else if (!d.vidaCarregou) item("var(--tx3)", "Barra de vida: não carregou na última vez que o jogo abriu.");
      else if (d.desenhou) item("var(--verde)", "Barra de vida: funcionando (monstro encontrado e barra desenhada).");
      else if (d.semAlvo) item("var(--ouro)", "Barra de vida: nenhum monstro grande apareceu na área ainda.");
      else item("var(--tx3)", "Barra de vida: carregou. Ainda sem dados de caçada — entre numa missão.");
      if (!pl.dano.ligado) item("var(--tx3)", "Números de dano: desligados.");
      else if (d.danoIncompat) item("var(--vermelho)", "Números de dano: o plugin não é compatível com esta versão do jogo.");
      else if (!d.danoCarregou) item("var(--tx3)", "Números de dano: não carregou na última vez que o jogo abriu.");
      else if (!d.dano) item("var(--tx3)", "Números de dano: carregou. Ainda sem golpes registrados — bata num monstro.");
      else {
        const n = (d.dano.match(/\d+/g) || []).map(Number);
        if (n[0] === 0) item("var(--vermelho)", "Números de dano: os golpes não chegaram até o plugin.");
        else if (n[4] === 0 && n[3] > 0) item("var(--vermelho)", "Números de dano: criados, mas fora da tela.");
        else item(n[3] > 0 ? "var(--verde)" : "var(--ouro)", "Números de dano: " + (n[3] > 0 ? "funcionando (" + n[3] + " números)" : "golpes vistos, sem dano ligado a eles ainda") + ".");
        diagBox.append(el("div", { class: "dica" }, "Detalhe técnico: " + d.dano));
      }
    }
    diagnostico();
    const diagCard = cartao(secao("Diagnóstico da última caçada", botao("Atualizar", diagnostico, "peq fantasma", "atualizar")), diagBox);

    // ---- vida dos monstros
    const vidas = cartao(secao("Vida dos monstros · missões do Hub"), el("div", { class: "dica", style: { marginBottom: "4px" } }, "1,00 = original · 0,60 = 60% da vida · vale para todo o grupo (usa o do anfitrião)."));
    for (const [k, t] of [["1Player", "1 caçador"], ["2Players", "2 caçadores"], ["3Players", "3 caçadores"], ["4Players", "4 caçadores"]]) {
      const v = +(await ini.get("Monster HP", k, "1.0")) || 1;
      vidas.append(linha(t, null, el("div", { style: { width: "min(420px, 46vw)" } }, faixa(.1, 3, .05, v, x => x.toFixed(2).replace(".", ",") + "x", x => ini.set("Monster HP", k, x.toFixed(2)))), "pessoas"));
    }
    const vila = await ini.get("Village Quests", "VillageQuestsInHub", "On"), hubhp = +(await ini.get("Village Quests", "HubHP", "2.0")) || 2;
    const bonus = await ini.get("Bonus Content", "BonusContent", "On");
    const extra = cartao(secao("Missões da Vila e bônus"),
      linha("Missões da Vila no Hub", "No balcão do Hub, L/R troca para as missões da Vila (para jogar junto).", chave(vila === "On", v => ini.set("Village Quests", "VillageQuestsInHub", v ? "On" : "Off")), "vila"),
      linha("Vida extra nelas", "Multiplica a vida das missões da Vila jogadas no Hub.", el("div", { style: { width: "min(420px, 46vw)" } }, faixa(.5, 5, .1, hubhp, x => x.toFixed(1).replace(".", ",") + "x", x => ini.set("Village Quests", "HubHP", x.toFixed(1)))), "vida"),
      linha("Conteúdo bônus", "Missões de evento, itens e Felynes grátis, copiados de um save doador (pasta bonus).", chave(bonus === "On", v => ini.set("Bonus Content", "BonusContent", v ? "On" : "Off")), "presente"));

    // ---- modo tranquilo: para quem está começando (vida na Vila e ataque dos monstros grandes)
    const vHP = +(await ini.get("Difficulty", "VillageHP", "1.0")) || 1, atq = +(await ini.get("Difficulty", "MonsterAttack", "1.0")) || 1;
    const fVila = faixa(.3, 2, .05, vHP, x => x.toFixed(2).replace(".", ",") + "x", x => ini.set("Difficulty", "VillageHP", x.toFixed(2)));
    const fAtq = faixa(.3, 2, .05, atq, x => x.toFixed(2).replace(".", ",") + "x", x => ini.set("Difficulty", "MonsterAttack", x.toFixed(2)));
    const preset = async (h, a, txt) => {
      await ini.set("Difficulty", "VillageHP", h.toFixed(2)); await ini.set("Difficulty", "MonsterAttack", a.toFixed(2)); fVila.definir(h); fAtq.definir(a);
      for (const k of ["1Player", "2Players"]) await ini.set("Monster HP", k, h.toFixed(2));
      toast(txt); setTimeout(() => location.reload(), 400);
    };
    const facil = cartao(secao("Modo tranquilo"),
      el("div", { class: "dica", style: { marginBottom: "4px" } }, "Para quem está começando: monstros grandes com menos vida e batendo mais fraco. Só a vida e o ataque mudam."),
      linha("Vida nas missões da Vila", "1,00 = original · 0,60 = 60% da vida (as do Hub ficam em Vida dos monstros).", el("div", { style: { width: "min(420px, 46vw)" } }, fVila), "vida"),
      linha("Força dos monstros", "0,50 = batem com metade da força. No online, cada um usa o seu (combine com o grupo).", el("div", { style: { width: "min(420px, 46vw)" } }, fAtq), "escudo"),
      el("div", { style: { display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" } },
        botao("Tranquilo (60% vida, 50% força)", () => preset(.6, .5, "Modo tranquilo ligado"), "peq primario"),
        botao("Leve (80% vida, 75% força)", () => preset(.8, .75, "Modo leve ligado"), "peq"),
        botao("Original", () => preset(1, 1, "Dificuldade original"), "peq fantasma")),
      el("div", { class: "dica", style: { paddingTop: "8px" } }, "Os botões também ajustam a vida no Hub para 1 e 2 caçadores. Vale ao abrir o jogo."));
    c.append(cabecalho("cacada", "Caçada", "O que aparece na tela durante a caçada e a dificuldade dos monstros.", [2, 36], "zoom"), hud, facil, diagCard, vidas, extra);
  },
};
