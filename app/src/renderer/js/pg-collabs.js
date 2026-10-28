// Collabs: as missões de evento de colaboração do Generations Ultimate (nomes como estão na tradução pt-BR do jogo).
const COLLABS = [
  { serie: "The Legend of Zelda", capa: "c-zelda", cor: "#7f955c", missoes: ["The Legend of Zelda: Coragem", "The Legend of Zelda: Poder", "The Legend of Zelda: Sabedoria"], premio: "Bilhetes Zelda: o equipamento do Link" },
  { serie: "Super Mario", capa: "c-mario", cor: "#e45f38", missoes: ["Mario: O Donkey Kong Branco?"], premio: "Gorro e Macacão Mario para o Palico" },
  { serie: "Okami", capa: "c-okami", cor: "#c9bd98", missoes: ["Okami: Mais Procurado"], premio: "Capuz Okami para o Palico" },
  { serie: "Star Fox", capa: "c-starfox", cor: "#6f8fb0", missoes: ["Star Fox: Batalha na Cordilheira Ártica"] },
  { serie: "Metroid", capa: "c-metroid", cor: "#d08a3c", missoes: ["Metroid: Missão Especial"] },
  { serie: "Mega Man", capa: "c-megaman", cor: "#4f7fc0", missoes: ["Mega Man: Demônio Amarelo"] },
  { serie: "Fire Emblem", capa: "c-fe", cor: "#b0485a", missoes: ["Fire Emblem: Afastando o Desespero"] },
  { serie: "Street Fighter", capa: "c-sf", cor: "#e45f38", missoes: ["SF: Exame de Admissão Supremo"] },
  { serie: "Devil May Cry", capa: "c-dmc", cor: "#a33a3a", missoes: ["DMC: O Grito da Seltas Queen"] },
  { serie: "Ghosts 'n Goblins", capa: "c-gng", cor: "#8a6fb0", missoes: ["Ghosts 'n Goblins: Vendo Vermelho"] },
  { serie: "Strider", capa: "c-strider", cor: "#5a8f8a", missoes: ["Strider: Missão Congelada"] },
  { serie: "Detetive Conan", cor: "#4f7fc0", missoes: ["Detetive Conan: Prisão no Deserto!", "Detetive Conan: Arquivos de Monstros"] },
  { serie: "Yu-Gi-Oh!", capa: "c-yugioh", cor: "#c9a23c", missoes: ["Yu-Gi-Oh: Um Belo Wyvern"] },
  { serie: "Baki", cor: "#a33a3a", missoes: ["Baki: O Maior vs. O Mais Forte", "Baki: Garras Mortais"] },
  { serie: "Magi", cor: "#c9a23c", missoes: ["Magi: Resgate da Queda"] },
  { serie: "Capcom", cor: "#4f7fc0", missoes: ["Capcom: Orquestra Brilhante", "Capcom: Espírito Prowler", "Capcom: A Fúria do Soberano", "Capcom: Branco e Preto"] },
  { serie: "Revistas e mangás do Japão", cor: "#7f955c", missoes: ["CoroCoro: Insetões Malvados", "CoroCoro: O Pum das Trevas", "CoroCoro: Perdido no Pântano", "CoroCoro: Boliche Rolante",
    "Jump: Magma Fervente", "Jump: Fortões Carmesins", "Jump: A Coroa do Deserto", "Famitsu: O Furo do Kecha!", "Famitsu: Especial Mizutsune", "Dengeki: No Topo do Velho Faísca", "Dengeki: Mares Turbulentos",
    "Nakayoshi: Cristal de Prata", "Shonen: Noturno Alado", "Crows: Os Corvos Negros", "Drifters: Ilha das Almas Perdidas"] },
];

Paginas.collabs = {
  async montar(c) {
    const busca = el("input", { class: "collab-busca", placeholder: "Procurar série ou missão", style: { width: "min(360px, 100%)" } });
    const grade = el("div", { class: "grade g2 collabs" });
    const copiar = t => { navigator.clipboard.writeText(t).then(() => toast("Copiado: " + t)); };
    const cartas = COLLABS.map(x => {
      const foto = el("div", { class: "collab-foto" }, el("span", {}, x.serie.slice(0, 1)));
      if (x.capa) api.bibliotecaCapa(x.capa).then(u => { if (u) { foto.style.backgroundImage = "url('" + u + "')"; foto.classList.add("tem"); } });
      const card = el("div", { class: "cartao collab" }, foto,
        el("div", { class: "collab-topo" }, el("b", {}, x.serie), el("span", { class: "selo" }, x.missoes.length + (x.missoes.length > 1 ? " missões" : " missão"))),
        ...x.missoes.map(m => el("button", { class: "collab-missao", title: "Copiar o nome", onclick: () => copiar(m) }, m)),
        ...(x.premio ? [el("div", { class: "dica", style: { marginTop: "6px" } }, "Prêmio: " + x.premio)] : []));
      card.style.setProperty("--c", x.cor);
      card.dataset.busca = (x.serie + " " + x.missoes.join(" ")).toLowerCase();
      return card;
    });
    grade.append(...cartas);
    busca.oninput = () => { const q = busca.value.trim().toLowerCase(); for (const k of cartas) k.style.display = !q || k.dataset.busca.includes(q) ? "" : "none"; };
    const bonus = (await ini.get("Bonus Content", "BonusContent", "On")) === "On";
    c.append(cabecalho("collabs", "Collabs", "As missões de colaboração com outros jogos e séries, e onde achar cada uma.", null, "respira"),
      el("div", { class: "aviso", style: { padding: "16px 20px" } }, el("div", { class: "t" },
        el("b", {}, "Onde ficam"),
        el("span", {}, "No balcão de missões, em Missões de Evento. " + (bonus
          ? "O conteúdo bônus está ligado: o launcher põe as missões de evento no seu save na primeira vez que o jogo abre."
          : "Ligue o Conteúdo bônus em Caçada para receber as missões de evento no save.")))),
      cartao(secao("Séries", busca), grade,
        el("div", { class: "dica", style: { paddingTop: "8px" } }, "Clique numa missão para copiar o nome. As capas são de um jogo de cada série, baixadas do acervo público do libretro. Algumas missões de revistas japonesas podem não aparecer na lista do jogo.")));
  },
};
