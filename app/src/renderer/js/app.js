// Início do launcher: monta as páginas, o menu com a seleção que desliza, a busca, o mini-player e o botão de jogar.
(async () => {
  const est = await api.estado();
  document.documentElement.dataset.so = est.plataforma;  // (win32: os botões da janela são os do Windows)
  $("#logo").style.background = "url('img/icone.png') center/cover";

  // sem o Generations Ultimate instalado o launcher abre na biblioteca (os outros ports funcionam sem ele) e as abas
  // dele somem; o cartão dele na biblioteca explica como instalar
  const temGU = !!est.pasta;
  if (!temGU) $$("[data-gu]").forEach(e => e.hidden = true);

  // ---- páginas: a primeira já aparece, as outras montam logo depois (abrir fica rápido)
  const ordem = temGU ? ["inicio", "jogos", "online", "cacada", "graficos", "fps", "controles", "mods", "sobre"] : ["jogos", "sobre"];
  const montadas = {};
  async function montar(p) { if (montadas[p]) return montadas[p]; montadas[p] = (async () => { const c = $("#pg-" + p + " .conteudo"); try { await Paginas[p].montar(c); } catch (e) { console.error(p, e); c.append(el("div", { class: "aviso" }, el("div", { class: "t" }, el("b", {}, "Algo deu errado nesta página"), el("span", {}, String(e.message || e))))); } numerar(c); })(); return montadas[p]; }

  // ---- menu: a seleção corre até a aba escolhida (com uma esticadinha no caminho)
  const marca = $("#marcaNav"), nav = $("#nav");
  function moverMarca(btn, animar) {
    const y = btn.offsetTop;
    marca.style.setProperty("--de", "translateY(" + y + "px)");
    if (!animar) { marca.style.transition = "none"; marca.style.transform = "translateY(" + y + "px)"; marca.offsetHeight; marca.style.transition = ""; return; }
    marca.classList.remove("estica"); void marca.offsetWidth; marca.classList.add("estica");
    marca.style.transform = "translateY(" + y + "px)";
  }
  async function ir(p, animar = true) {
    const btn = $('nav button[data-p="' + p + '"]'); if (!btn) return;
    $$("nav button").forEach(b => b.classList.toggle("on", b === btn));
    btn.classList.remove("pulo"); void btn.offsetWidth; btn.classList.add("pulo");
    moverMarca(btn, animar);
    await montar(p);
    $$(".pagina").forEach(s => s.classList.toggle("ativa", s.id === "pg-" + p));
    const pg = $("#pg-" + p); pg.scrollTop = 0;
    // a cena do Início só toca com o Início na tela
    Cenas.visivel(p === "inicio" && !document.hidden);
    $("#mini").classList.toggle("on", p === "inicio" && Cenas.ligado());
  }
  $$("nav button").forEach(b => b.addEventListener("click", () => ir(b.dataset.p)));
  window.addEventListener("resize", () => { const b = $("nav button.on"); if (b) moverMarca(b, false); });
  api.aoNavegar(p => ir(p, false));
  document.addEventListener("visibilitychange", () => Cenas.visivel(!document.hidden && $("#pg-inicio").classList.contains("ativa")));

  // barra de rolagem: só aparece enquanto rola
  $$(".pagina, nav").forEach(s => { let t; s.addEventListener("scroll", () => { s.classList.add("rolando"); clearTimeout(t); t = setTimeout(() => s.classList.remove("rolando"), 900); }); });

  await ir(ordem[0], false);
  // as outras páginas montam em seguida, uma a uma (o índice da busca já fica completo)
  for (const p of ordem.slice(1)) await montar(p);

  // ---- mini-player da cena
  const mini = $("#mini");
  const pintaMini = c => { $("#miniNome").textContent = c.nome; Cenas.quadro(c.v, c.foto).then(u => u && ($("#miniCapa").style.backgroundImage = "url('" + u + "')")); };
  Cenas.aoTrocar(pintaMini);
  if (Cenas.atual() >= 0) pintaMini(Cenas.LISTA[Cenas.atual()]);  // (a primeira cena já tocou antes daqui)
  $("#miniAnt").onclick = () => Cenas.tocar((Cenas.atual() + Cenas.LISTA.length - 1) % Cenas.LISTA.length);
  $("#miniProx").onclick = () => Cenas.tocar((Cenas.atual() + 1) % Cenas.LISTA.length);
  $("#miniPlay").onclick = () => { const p = !Cenas.pausado(); Cenas.pausar(p); $("#miniIcone").setAttribute("d", p ? "M7 5l12 7-12 7z" : "M8 5v14 M16 5v14"); };
  mini.classList.toggle("on", Cenas.ligado());

  // ---- busca de ajustes
  const campo = $("#busca"), res = $("#resultados");
  let achados = [], sel = 0;
  const paginaDe = alvo => { const s = alvo.closest(".pagina"); return s && s.id.replace("pg-", ""); };
  const NOMES = { inicio: "Início", online: "Online", cacada: "Caçada", graficos: "Gráficos", fps: "FPS e Hz", controles: "Controles", mods: "Mods e Cheats", sobre: "Sobre" };
  function mostrar() {
    const q = busca.normal(campo.value.trim()); res.innerHTML = "";
    if (q.length < 2) { res.hidden = true; return; }
    achados = busca.itens.filter(i => i.chave.includes(q)).sort((a, b) => (b.chave.startsWith(q) - a.chave.startsWith(q))).slice(0, 8); sel = 0;
    if (!achados.length) res.append(el("div", { class: "dica", style: { padding: "8px 10px" } }, "Nada encontrado"));
    achados.forEach((a, i) => res.append(el("button", { class: i === sel ? "sel" : "", onclick: () => abrir(a) }, a.texto, el("small", {}, NOMES[paginaDe(a.alvo)] || ""))));
    res.hidden = false;
  }
  async function abrir(a) {
    res.hidden = true; campo.value = ""; campo.blur();
    await ir(paginaDe(a.alvo));
    a.alvo.scrollIntoView({ behavior: "smooth", block: "center" });
    a.alvo.animate([{ background: "rgba(226,96,63,.22)" }, { background: "transparent" }], { duration: 1800, easing: "cubic-bezier(.23,1,.32,1)" });
  }
  campo.addEventListener("input", mostrar);
  campo.addEventListener("keydown", e => {
    if (e.key === "Escape") { campo.value = ""; mostrar(); campo.blur(); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { sel = (sel + (e.key === "ArrowDown" ? 1 : achados.length - 1)) % Math.max(1, achados.length); [...res.children].forEach((b, i) => b.classList.toggle("sel", i === sel)); e.preventDefault(); }
    if (e.key === "Enter" && achados[sel]) abrir(achados[sel]);
  });
  document.addEventListener("click", e => { if (!e.target.closest(".busca")) res.hidden = true; });

  // ---- janela
  $$("#barra .janela button").forEach(b => b.addEventListener("click", () => api.janela(b.dataset.j)));
  $("#barra").addEventListener("dblclick", e => { if (!e.target.closest("button, .mini")) api.janela("max"); });

  // ---- partir em missão (o reflexo de luz passa no botão de tempos em tempos)
  const jogar = $("#jogar");
  jogar.addEventListener("click", async () => { const r = await api.jogoAbrir(); if (r && r.erro) toast(r.erro); });
  const brilho = () => { jogar.classList.remove("brilha"); void jogar.offsetWidth; jogar.classList.add("brilha"); setTimeout(brilho, 6000 + Math.random() * 5000); };
  setTimeout(brilho, 2500);

  // ---- aviso de atualização: procura ao abrir e a cada 30 min (o launcher, o port oficial e as correções). Cada
  // novidade avisa uma vez: um aviso no Início, uma bolinha na aba Sobre e, com a janela escondida ou minimizada
  // (durante o jogo, por exemplo), uma notificação do sistema.
  const avisadas = new Set();
  async function procurarAtualizacoes() {
    const novas = [];
    try { const r = await api.atualizaLauncher(); if (r && r.nova) novas.push({ k: "l" + r.ultima, t: "launcher v" + r.ultima }); if (r && r.correcao) novas.push({ k: "c" + r.correcao.nome, t: "correções do port " + r.correcao.nome }); } catch {}
    if (temGU) try { const p = await api.atualizaPort(); if (p && p.nova) novas.push({ k: "p" + p.ultima, t: "port " + p.ultima }); } catch {}
    try { const b = await api.bibliotecaProcurar(); for (const g of BIBLIOTECA) if (b[g.id] && b[g.id].nova) novas.push({ k: g.id + b[g.id].ultima, t: g.cod + " " + b[g.id].ultima, jogo: true }); } catch {}
    $('nav button[data-p="sobre"]').classList.toggle("tem-novo", novas.some(n => !n.jogo));
    $('nav button[data-p="jogos"]').classList.toggle("tem-novo", novas.some(n => n.jogo));
    const agora = novas.filter(n => !avisadas.has(n.k));
    if (!agora.length) return;
    agora.forEach(n => avisadas.add(n.k));
    const txt = agora.map(n => n.t).join(" · ");
    $$(".aviso.atualizacao").forEach(a => a.remove());
    const a = aviso("Atualização disponível", "Nova versão: " + txt + ". Leva um minuto e não mexe no seu save.", botao("Ver e atualizar", () => ir(agora.every(n => n.jogo) ? "jogos" : "sobre"), "primario", "baixar"), true);
    a.classList.add("atualizacao"); if (Paginas.inicio.avisos) Paginas.inicio.avisos.prepend(a);
    toast("Atualização disponível: " + txt);
    if (document.hidden || !document.hasFocus())
      try { const n = new Notification("MHGU Launcher: atualização disponível", { body: "Nova versão: " + txt + ". Clique para ver." }); n.onclick = () => { api.janela("mostrar"); ir(agora.every(n => n.jogo) ? "jogos" : "sobre"); }; } catch {}
    if (Paginas.sobre && Paginas.sobre.reverificar) Paginas.sobre.reverificar();
    if (Paginas.jogos.procurar && agora.some(n => n.jogo)) Paginas.jogos.procurar();
  }
  setTimeout(procurarAtualizacoes, 6000);
  setInterval(procurarAtualizacoes, 30 * 60 * 1000);

  const nov = await api.novidades();
  if (nov && Paginas.inicio.avisos) Paginas.inicio.avisos.prepend(aviso("Atualizado para a v" + nov.versao, nov.notas.split(/\r?\n/).filter(Boolean).slice(0, 4).join(" · "), botao("Entendi", e => e.target.closest(".aviso").remove(), "peq"), true));
})();
