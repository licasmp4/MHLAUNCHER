// Jogos: a biblioteca do MHLAUNCHER. Em cima o jogo escolhido em destaque (a capa em 3D, que inclina com o mouse, sobre
// ela mesma desfocada), embaixo a estante com as capas. O Generations Ultimate tem o launcher inteiro (as outras abas);
// os outros ports são baixados e atualizados pelos Releases de cada projeto e abrem o launcher próprio
// (main/biblioteca.js). As capas vêm do acervo do libretro na hora (nenhuma arte dos jogos vai no projeto).
const BIBLIOTECA = [
  { id: "mhgu", nome: "Monster Hunter Generations Ultimate", curto: "Generations Ultimate", sist: "Switch", ano: 2017, cor: "brasa",
    projeto: ["MHGURecomp", "https://github.com/morerokk/MHGURecomp"],
    sobre: "Nativo no PC, com tradução pt-BR, texturas HD, barra de vida e dano dos monstros, online com os amigos e todos os ajustes nas outras abas.",
    precisa: ["O seu jogo (XCI) e a atualização 1.4.0 (NSP)", "O prod.keys do seu Switch"] },
  { id: "mh4u", nome: "Monster Hunter 4 Ultimate", curto: "4 Ultimate", sist: "3DS", ano: 2015, cor: "verde", foco: "30% 50%",
    projeto: ["MH4UltimateDC", "https://github.com/CompaLarios18/MH4UltimateDC"],
    sobre: "Até 120 FPS, tela larga, a tela de toque por cima do jogo e online pela internet. Teclado e mouse no estilo do Rise.",
    precisa: ["O seu MH4U (EUA) decriptado: .3ds, .cci ou .cxi", "A atualização 1.3.0 (.cia)", "O Python 3.10 ou mais novo (python.org)"],
    nota: "Na primeira vez, o launcher do port prepara o jogo no seu PC (alguns minutos)." },
  { id: "mhfu", nome: "Monster Hunter Freedom Unite", curto: "Freedom Unite", sist: "PSP", ano: 2009, cor: "ouro",
    projeto: ["MHForever", "https://github.com/Mango77x/MHForever"],
    sobre: "Nativo, sem emulador: o código do jogo recompilado para o PC. Controle e teclado configuráveis. Ainda sem online.",
    precisa: ["O .iso sem compressão do seu MHFU, versão 1.01 (europeu ULES01213 ou americano ULUS10391)"] },
  { id: "mhp3", nome: "Monster Hunter Portable 3rd", curto: "Portable 3rd", sist: "PSP · HD Ver.", ano: 2010, cor: "azul",
    projeto: ["Yakumo", "https://github.com/TeamGDB/Yakumo"],
    sobre: "Nativo, sem emulador. Online pelos servidores ad hoc ou na rede local, texturas HD, mods e até 120 FPS com interpolação.",
    precisa: ["O seu Monster Hunter Portable 3rd HD Ver. (PS3, NPJB-40001)"],
    traducao: "https://github.com/devdouglasonofre/mhp3rd-yakumo-ptbr/releases/latest",
    nota: "Tem tradução pt-BR da comunidade: baixe o arquivo .lang e, no jogo, use System → Text → Import Translation." },
];

Paginas.jogos = {
  async montar(c) {
    const est = await api.estado();
    let lib = await api.biblioteca(), info = null, atual = 0;
    const capas = {};
    const logo = await api.logo();

    // ---- o destaque
    const fundo = el("img", { class: "lib-fundo", alt: "" });
    const capaImg = el("img", { alt: "" }), brilho = el("i", { class: "brilho" });
    const caixa = el("div", { class: "caixa" }, capaImg, brilho);
    const palco = el("div", { class: "lib-palco" }, caixa);
    const olho = el("div", { class: "olho" }), titulo = el("h2"), chips = el("div", { class: "chips" });
    const sobre = el("p", { class: "sobre" }), precisa = el("div", { class: "precisa" }), nota = el("div", { class: "nota" });
    const pasta = el("div", { class: "pasta-jogo" }), acoes = el("div", { class: "acoes" });
    const texto = el("div", { class: "lib-info" }, olho, titulo, chips, sobre, precisa, nota, pasta, acoes);
    const destaque = el("section", { class: "lib-destaque" }, fundo, el("div", { class: "lib-veu" }), palco, texto);

    // ---- a estante
    const estante = el("div", { class: "lib-estante" });
    const itens = BIBLIOTECA.map((g, i) => {
      const img = el("img", { alt: "", style: { objectPosition: g.foco || "50% 50%" } }), ponto = el("span", { class: "ponto" });
      const b = el("button", { class: "lib-item " + g.cor, "aria-label": g.nome }, el("div", { class: "moldura" + (g.id === "mhgu" ? " quadrada" : "") }, img, el("i", { class: "brilho" })),
        el("div", { class: "rot" }, ponto, el("b", {}, g.curto)), el("small", {}, g.sist));
      b.addEventListener("click", () => escolher(i));
      b.img = img; b.ponto = ponto; estante.append(b); return b;
    });

    // ---- a capa em 3D: inclina para o lado do mouse, o reflexo vai junto
    destaque.addEventListener("mousemove", e => {
      const r = palco.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      caixa.style.transform = "rotateY(" + (x * 16).toFixed(2) + "deg) rotateX(" + (-y * 12).toFixed(2) + "deg)";
      brilho.style.background = "radial-gradient(circle at " + (50 + x * 90) + "% " + (50 + y * 90) + "%, rgba(255,246,228,.32), transparent 55%)";
    });
    destaque.addEventListener("mouseleave", () => { caixa.style.transform = ""; brilho.style.background = ""; });

    const kb = n => n > 0 ? (n / 1048576).toFixed(0) + " MB" : "";
    const situacao = g => {
      if (g.id === "mhgu") return est.pasta ? { on: true, txt: "instalado · port " + (est.versaoPort || "") } : { on: false, txt: "não instalado" };
      const s = (info && info[g.id]) || lib[g.id] || {};
      return s.instalado ? { on: true, nova: s.nova, txt: s.nova ? "atualização: " + s.ultima : "instalado" + (s.versao ? " · " + s.versao : ""), s } : { on: false, txt: "não instalado", s };
    };
    const limpaErro = e => String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

    function pintarEstante() {
      itens.forEach((b, i) => { const st = situacao(BIBLIOTECA[i]); b.ponto.className = "ponto" + (st.nova ? " novo" : st.on ? " on" : ""); b.classList.toggle("on", i === atual); });
    }
    function pintarAcoes() {
      const g = BIBLIOTECA[atual], st = situacao(g), s = st.s || {};
      chips.innerHTML = "";
      chips.append(el("span", { class: "selo " + (st.nova ? "brasa" : st.on ? "verde" : "") }, st.txt));
      if (g.projeto) chips.append(el("a", { class: "selo", href: "#", onclick: e => { e.preventDefault(); api.externo(g.projeto[1]); } }, "port: " + g.projeto[0] + " ↗"));
      acoes.innerHTML = ""; pasta.textContent = "";
      if (g.id === "mhgu") {
        if (est.pasta) acoes.append(botao("Jogar", async () => { const r = await api.jogoAbrir(); if (r && r.erro) toast(r.erro); }, "primario grande", "raio"), botao("Ajustes", () => $('nav button[data-p="inicio"]').click(), "grande", "olho"));
        else acoes.append(botao("Baixar o instalador", () => api.externo("https://github.com/licasmp4/MHLAUNCHER/releases/latest"), "primario grande", "baixar"),
          botao("Já instalei: escolher pasta", async () => { if (await api.pastaEscolher()) location.reload(); else toast("Essa pasta não tem o " + (est.plataforma === "win32" ? "mhgurecomp.exe" : "mhgurecomp")); }, "grande", "pasta"));
      } else if (st.on) {
        acoes.append(botao("Jogar", async () => { const r = await api.bibliotecaAbrir(g.id); toast(r && r.erro ? r.erro : "Abrindo o " + g.curto + "..."); }, "primario grande", "raio"));
        if (st.nova) acoes.append(instalar(g, "Atualizar para " + s.ultima));
        acoes.append(botao("Pasta", () => api.bibliotecaAbrirPasta(g.id), "fantasma", "pasta"));
        pasta.textContent = s.pasta || "";
      } else {
        acoes.append(instalar(g, "Instalar" + (s.tamanho ? " · " + kb(s.tamanho) : "")),
          botao("Mudar a pasta", async () => { const r = await api.bibliotecaPasta(g.id); if (r) { lib[g.id] = r; pintarAcoes(); } }, "fantasma", "pasta"));
        pasta.textContent = s.pasta ? "vai para " + s.pasta : "";
      }
      if (g.traducao) acoes.append(botao("Tradução pt-BR", () => api.externo(g.traducao), "fantasma", "globo"));
    }
    function instalar(g, txt) {
      const b = botao(txt, async () => {
        b.disabled = true;
        try { await api.bibliotecaInstalar(g.id); toast(g.curto + " instalado. Clique em Jogar."); info = await api.bibliotecaProcurar(); pintarAcoes(); pintarEstante(); }
        catch (e) { toast(limpaErro(e)); b.disabled = false; b.lastChild.textContent = txt; }
      }, "primario grande", "baixar");
      b.dataset.jogo = g.id; return b;
    }
    api.aoProgresso(({ tipo, p }) => { if (!tipo.startsWith("jogo:")) return; const b = acoes.querySelector('[data-jogo="' + tipo.slice(5) + '"]'); if (b) b.lastChild.textContent = "Baixando " + p + "%"; });

    function escolher(i, primeira) {
      atual = i; const g = BIBLIOTECA[i];
      destaque.className = "lib-destaque " + g.cor + (primeira ? "" : " troca");
      if (!primeira) { void destaque.offsetWidth; destaque.classList.add("troca"); }
      palco.className = "lib-palco" + (g.id === "mhgu" ? " quadrada" : "");
      const u = capas[g.id] || ""; capaImg.src = u; fundo.src = u; capaImg.style.objectPosition = g.foco || "50% 50%"; caixa.classList.toggle("sem", !u);
      olho.textContent = g.sist + " · " + g.ano; titulo.textContent = g.nome; sobre.textContent = g.sobre;
      const mostrarPrecisa = g.precisa && !(g.id === "mhgu" && est.pasta);
      precisa.hidden = !mostrarPrecisa; precisa.innerHTML = "";
      if (mostrarPrecisa) precisa.append(el("b", {}, "Você precisa"), el("ul", {}, g.precisa.map(t => el("li", {}, t))));
      nota.hidden = !g.nota; nota.textContent = g.nota || "";
      pintarAcoes(); pintarEstante();
      try { localStorage.setItem("mhl-jogo", g.id); } catch {}
    }
    document.addEventListener("keydown", e => {
      if (!$("#pg-jogos").classList.contains("ativa") || e.target.closest("input")) return;
      if (e.key === "ArrowRight") escolher((atual + 1) % BIBLIOTECA.length); else if (e.key === "ArrowLeft") escolher((atual + BIBLIOTECA.length - 1) % BIBLIOTECA.length);
    });

    let ini = 0; try { ini = Math.max(0, BIBLIOTECA.findIndex(g => g.id === localStorage.getItem("mhl-jogo"))); } catch {}
    escolher(ini, true);
    c.append(destaque, el("div", { class: "lib-legenda" }, el("h3", { class: "secao" }, "Sua estante"), el("span", { class: "dica" }, "← → troca de jogo")), estante,
      el("div", { class: "dica lib-rodape" }, "Os ports são projetos de fãs, cada um com o seu autor. O MHLAUNCHER baixa a versão mais nova de cada um pelo GitHub do projeto e avisa quando sai outra. Nenhum jogo vem junto: você usa a sua cópia. Capas: acervo libretro-thumbnails."));

    // as capas chegam depois (a primeira vez baixa, as outras vêm do cache)
    for (const [i, g] of BIBLIOTECA.entries()) {
      (g.id === "mhgu" ? Promise.resolve(logo) : api.bibliotecaCapa(g.id)).then(u => {
        if (!u) return; capas[g.id] = u; itens[i].img.src = u; itens[i].classList.add("tem-capa");
        if (i === atual) { capaImg.src = u; fundo.src = u; caixa.classList.remove("sem"); }
      });
    }
    api.bibliotecaProcurar().then(r => { info = r; pintarAcoes(); pintarEstante(); }).catch(() => {});
    Paginas.jogos.procurar = async () => { info = await api.bibliotecaProcurar(); pintarAcoes(); pintarEstante(); return info; };
  },
};
