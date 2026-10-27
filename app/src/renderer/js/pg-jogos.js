// Jogos: a biblioteca do MHLAUNCHER. O Generations Ultimate tem o launcher inteiro (as outras abas); os outros ports
// são baixados e atualizados pelos Releases de cada projeto e abrem o launcher próprio (main/biblioteca.js).
const BIBLIOTECA = [
  { id: "mhgu", cod: "GU", nome: "Monster Hunter Generations Ultimate", sist: "Switch", cor: "brasa",
    projeto: ["MHGURecomp", "https://github.com/morerokk/MHGURecomp"],
    sobre: "Tradução pt-BR, texturas HD, HUD de caça, online e todos os ajustes nas outras abas.",
    precisa: ["O seu jogo (XCI) e a atualização 1.4.0 (NSP)", "O prod.keys do seu Switch"] },
  { id: "mh4u", cod: "4U", nome: "Monster Hunter 4 Ultimate", sist: "3DS", cor: "verde",
    projeto: ["MH4UltimateDC", "https://github.com/CompaLarios18/MH4UltimateDC"],
    sobre: "Até 120 FPS, tela larga, a tela de toque por cima do jogo e online pela internet. Teclado e mouse estilo Rise.",
    precisa: ["O seu MH4U (EUA) decriptado: .3ds, .cci ou .cxi", "A atualização 1.3.0 (.cia)", "O Python 3.10 ou mais novo instalado (python.org)"],
    nota: "Na primeira vez o launcher dele prepara o jogo no seu PC (alguns minutos)." },
  { id: "mhfu", cod: "FU", nome: "Monster Hunter Freedom Unite", sist: "PSP", cor: "ouro",
    projeto: ["MHForever", "https://github.com/Mango77x/MHForever"],
    sobre: "Nativo, sem emulador: o código do jogo recompilado para o PC. Ainda sem online.",
    precisa: ["O .iso sem compressão do seu MHFU, versão 1.01 (europeu ULES01213 ou americano ULUS10391)"] },
  { id: "mhp3", cod: "P3", nome: "Monster Hunter Portable 3rd", sist: "PSP", cor: "cinza", embreve: true,
    sobre: "Ainda não tem port para PC publicado. Quando sair um, ele aparece aqui." },
];

Paginas.jogos = {
  async montar(c) {
    const est = await api.estado();
    let lib = await api.biblioteca();
    const grade = el("div", { class: "biblioteca" });
    const cartoes = {};

    const kb = n => n > 0 ? (n / 1048576).toFixed(0) + " MB" : "";
    function pintar(info) {
      for (const g of BIBLIOTECA) {
        const k = cartoes[g.id]; if (!k) continue;
        const acoes = k.acoes, st = k.status; acoes.innerHTML = "";
        if (g.embreve) { st.className = "selo"; st.textContent = "em breve"; continue; }
        if (g.id === "mhgu") {
          if (est.pasta) {
            st.className = "selo verde"; st.textContent = "instalado · port " + (est.versaoPort || "");
            acoes.append(botao("Jogar", async () => { const r = await api.jogoAbrir(); if (r && r.erro) toast(r.erro); }, "primario", "raio"), botao("Ajustes", () => $('nav button[data-p="inicio"]').click(), "", "olho"));
          } else {
            st.className = "selo"; st.textContent = "não instalado";
            acoes.append(botao("Baixar o instalador", () => api.externo("https://github.com/licasmp4/MHLAUNCHER/releases/latest"), "primario", "baixar"),
              botao("Já instalei: escolher pasta", async () => { if (await api.pastaEscolher()) location.reload(); else toast("Essa pasta não tem o " + (est.plataforma === "win32" ? "mhgurecomp.exe" : "mhgurecomp")); }, "", "pasta"));
          }
          continue;
        }
        const s = (info && info[g.id]) || lib[g.id] || {};
        if (s.instalado) {
          st.className = "selo " + (s.nova ? "brasa" : "verde");
          st.textContent = s.nova ? "atualização: " + s.ultima : "instalado" + (s.versao ? " · " + s.versao : "");
          acoes.append(botao("Jogar", async () => { const r = await api.bibliotecaAbrir(g.id); if (r && r.erro) toast(r.erro); else toast("Abrindo o " + g.nome + "..."); }, "primario", "raio"));
          if (s.nova) acoes.append(instalarBtn(g, "Atualizar para " + s.ultima, s));
          acoes.append(botao("Pasta", () => api.bibliotecaAbrirPasta(g.id), "fantasma", "pasta"));
        } else {
          st.className = "selo"; st.textContent = "não instalado";
          acoes.append(instalarBtn(g, "Instalar" + (s.tamanho ? " · " + kb(s.tamanho) : ""), s),
            botao("Mudar a pasta", async () => { const r = await api.bibliotecaPasta(g.id); if (r) { lib[g.id] = r; k.pasta.textContent = r.pasta; pintar(info); } }, "fantasma", "pasta"));
        }
        k.pasta.textContent = s.pasta || "";
      }
    }
    function instalarBtn(g, texto, s) {
      const b = botao(texto, async () => {
        b.disabled = true; b.dataset.texto = b.textContent;
        try { await api.bibliotecaInstalar(g.id); toast(g.nome + " instalado. Clique em Jogar."); info = await api.bibliotecaProcurar(); pintar(info); }
        catch (e) { toast(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "")); b.disabled = false; b.textContent = b.dataset.texto; }
      }, s && s.nova ? "primario" : "primario", "baixar");
      b.dataset.jogo = g.id; return b;
    }
    api.aoProgresso(({ tipo, p }) => { if (!tipo.startsWith("jogo:")) return; const b = grade.querySelector('[data-jogo="' + tipo.slice(5) + '"]'); if (b) b.lastChild.textContent = "Baixando " + p + "%"; });

    for (const g of BIBLIOTECA) {
      const status = el("span", { class: "selo" }, "..."), acoes = el("div", { class: "acoes" }), pasta = el("div", { class: "pasta-jogo" });
      cartoes[g.id] = { status, acoes, pasta };
      grade.append(el("article", { class: "jogo " + g.cor + (g.embreve ? " embreve" : "") },
        el("div", { class: "emblema" }, el("b", {}, g.cod), el("small", {}, g.sist)),
        el("div", { class: "corpo" },
          el("div", { class: "topo" }, el("h4", {}, g.nome), status),
          g.projeto ? el("div", { class: "dica" }, "Port: ", el("a", { href: "#", onclick: e => { e.preventDefault(); api.externo(g.projeto[1]); } }, g.projeto[0])) : null,
          el("p", {}, g.sobre),
          g.precisa && !(g.id === "mhgu" && est.pasta) ? el("div", { class: "precisa" }, el("b", {}, "Você precisa"), el("ul", {}, g.precisa.map(t => el("li", {}, t)))) : null,
          g.nota ? el("div", { class: "dica" }, g.nota) : null,
          pasta, acoes)));
    }
    let info = null;
    pintar(null);
    c.append(cabecalho("jogos", "Jogos", "Os ports de Monster Hunter no PC, num lugar só. Cada um usa a sua própria cópia do jogo.", [3, 27], "flutua"),
      grade, el("div", { class: "dica", style: { marginTop: "18px" } }, "Os ports são projetos de fãs, cada um com o seu autor. O MHLAUNCHER baixa a versão mais nova de cada um pelo GitHub do projeto e avisa quando sai outra. Nenhum jogo vem junto: você usa a sua cópia."));
    api.bibliotecaProcurar().then(r => { info = r; pintar(r); }).catch(() => {});
    Paginas.jogos.procurar = async () => { info = await api.bibliotecaProcurar(); pintar(info); return info; };
  },
};
