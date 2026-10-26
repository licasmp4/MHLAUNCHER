// Online: amigos (quem está online, jogando ou com Hub aberto), hospedar ou entrar, firewall e o grupo sem dessincronia.
Paginas.online = {
  async montar(c) {
    const est = await api.estado();
    const minhaVersao = est.versaoPort || "?";
    const meuSync = await ini.get("Multiplayer", "SyncSmallMonsters", "On");
    const statusAmigos = {};

    // ---- amigos
    const lista = el("div"), vazio = el("div", { class: "dica", style: { padding: "6px 0" } }, "Adicione o endereço do seu amigo (o IP do Radmin, como 26.12.34.56). Quando ele abrir o launcher, aparece aqui se está online, jogando ou com Hub aberto.");
    const campo = el("input", { class: "campo", placeholder: "Endereço do amigo (ex.: 26.12.34.56)", spellcheck: "false" });
    const adicionar = async () => { const a = campo.value.trim(); if (!a) return; const l = await api.amigos(); if (!l.includes(a)) { l.push(a); await api.amigosSalvar(l); } campo.value = ""; toast("Amigo adicionado"); desenhar(); consultar(); };
    campo.addEventListener("keydown", e => e.key === "Enter" && adicionar());
    const cartaoAmigos = cartao(secao("Amigos", el("span", { class: "dica" }, est.presenca ? "● você aparece online" : "presença desligada")), lista, vazio,
      el("div", { style: { display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", marginTop: "12px" } }, campo, botao("Adicionar", adicionar)));

    async function desenhar() {
      const amigos = await api.amigos(); lista.innerHTML = ""; vazio.hidden = amigos.length > 0;
      for (const end of amigos) {
        const st = statusAmigos[end], on = st && st.online;
        const nome = on && st.nome ? st.nome : end;
        const estado = !on ? "Offline" : st.estado === "H" ? "Hub aberto · jogando" : st.estado === "J" ? "Jogando" : "No launcher";
        const avisos = [];
        if (on && st.port !== minhaVersao) avisos.push("port diferente (dele " + st.port + ", seu " + minhaVersao + ")");
        if (on && st.sync && st.sync.toLowerCase() !== meuSync.toLowerCase()) avisos.push("sincronia dos monstros pequenos diferente");
        const cor = !on ? "#636366" : st.ping < 60 ? "#64c3a4" : st.ping < 130 ? "#e9ba6f" : "#e5574b";
        const hub = on && st.estado === "H";
        lista.append(el("div", { class: "amigo" },
          el("div", { class: "av" }, on ? nome[0].toUpperCase() : "?", el("i", { class: on ? (st.estado === "J" ? "jogando" : "on") : "" })),
          el("div", { class: "n" }, el("b", {}, nome), el("span", {}, estado + " · " + end), avisos.length ? el("em", {}, "⚠ " + avisos.join(" · ")) : null),
          on ? el("div", { class: "ping" }, el("i", { style: { background: cor } }), st.ping + " ms") : el("span"),
          el("button", { class: "btn peq " + (hub ? "primario" : ""), disabled: !on, title: on ? "Configura o endereço dele e abre o jogo" : "Ele precisa estar com o launcher aberto",
            onclick: async () => { await ini.set("Multiplayer", "Join", end); toast("No jogo: Jogo Local > Procurar Hubs"); const r = await api.jogoAbrir(); if (r.erro) toast(r.erro); } }, hub ? "Entrar no Hub" : "Entrar"),
          el("button", { class: "ic-btn", title: "Remover", onclick: async () => { const l = (await api.amigos()).filter(x => x !== end); await api.amigosSalvar(l); delete statusAmigos[end]; desenhar(); } }, svg("x"))));
      }
      const n = Object.values(statusAmigos).filter(s => s.online).length;
      if (Paginas.inicio.tileOnline) Paginas.inicio.tileOnline.textContent = n ? n + (n === 1 ? " amigo online" : " amigos online") : "Hospedar";
    }
    async function consultar() {
      const amigos = await api.amigos();
      await Promise.all(amigos.map(async a => { statusAmigos[a] = await api.amigosConsultar(a); desenhar(); }));
    }
    desenhar(); consultar();
    setInterval(() => { if ($("#pg-online").classList.contains("ativa")) consultar(); }, 3000);
    setInterval(consultar, 15000);

    // ---- hospedar / entrar
    const join = await ini.get("Multiplayer", "Join", "");
    const painelHost = el("div"), painelJoin = el("div");
    const opHost = el("button", { class: "opcao" + (join ? "" : " on") }, el("div", { style: { display: "flex", gap: "14px", alignItems: "center" } }, svg("escudo"), el("div", {}, el("div", { class: "nome" }, "Hospedar"), el("div", { class: "info" }, "Eu crio o Hub e os amigos entram"))));
    const opJoin = el("button", { class: "opcao" + (join ? " on" : "") }, el("div", { style: { display: "flex", gap: "14px", alignItems: "center" } }, svg("pessoas"), el("div", {}, el("div", { class: "nome" }, "Entrar"), el("div", { class: "info" }, "Entro no Hub de um amigo"))));
    [opHost, opJoin].forEach(o => o.querySelector("svg").style.cssText = "width:26px;height:26px;color:var(--brasa2)");
    const modo = entrar => { opHost.classList.toggle("on", !entrar); opJoin.classList.toggle("on", entrar); painelHost.hidden = entrar; painelJoin.hidden = !entrar; };
    opHost.onclick = async () => { modo(false); await ini.set("Multiplayer", "Join", ""); };
    opJoin.onclick = () => modo(true);

    const ipsBox = el("div");
    for (const i of await api.sistemaIps()) ipsBox.append(el("div", { class: "ip" }, svg(i.tipo.startsWith("Rede") ? "pc" : "rede"), el("div", {}, el("b", {}, i.ip), el("span", {}, i.tipo)), botao("Copiar", () => { api.copiar(i.ip); toast("Copiado: " + i.ip); }, "peq", "copiar")));
    const btnPub = botao("Descobrir IP da internet", async () => { btnPub.disabled = true; const ip = await api.sistemaIpPublico(); btnPub.disabled = false; if (!ip) return toast("Sem internet?"); ipsBox.append(el("div", { class: "ip" }, svg("globo"), el("div", {}, el("b", {}, ip), el("span", {}, "Internet · precisa abrir a porta no roteador")), botao("Copiar", () => { api.copiar(ip); toast("Copiado"); }, "peq", "copiar"))); }, "peq");
    const fwTxt = el("div", { class: "dica" }), fwBtn = botao("Liberar", async () => { fwBtn.disabled = true; const r = await api.sistemaLiberar(); pintaFw(r); }, "peq");
    const pintaFw = r => { fwTxt.textContent = r.aviso || (r.liberado ? "Liberado para o jogo e as portas " + porta + " e " + (porta + 1) + "." : "Falta liberar (inclui a porta " + (porta + 1) + ", que mostra você online para os amigos)."); fwTxt.style.color = r.liberado ? "var(--verde)" : ""; fwBtn.textContent = r.liberado ? "Liberado ✓" : "Liberar"; fwBtn.disabled = !r.pode; };
    const porta = +(await ini.get("Multiplayer", "Port", "39500")) || 39500;
    api.sistemaFirewall().then(pintaFw);
    const portaCampo = el("input", { class: "campo", value: porta, style: { width: "110px", textAlign: "center" } });
    portaCampo.addEventListener("change", () => { const p = +portaCampo.value; if (p > 0 && p < 65535) ini.set("Multiplayer", "Port", p); });
    painelHost.append(
      cartao(secao("Seu endereço · mande para os amigos"), ipsBox, el("div", { style: { marginTop: "8px" } }, btnPub)),
      cartao(secao("Preparar o PC"), linha("Firewall", fwTxt, fwBtn, "escudo"), linha("Porta", "Só pela internet sem VPN: abra esta porta (TCP e UDP) no roteador.", portaCampo)),
      cartao(secao("No jogo"), el("div", { class: "dica", style: { fontSize: "15px", lineHeight: "1.7" } }, "1. Clique em Partir em missão e carregue seu save.", el("br"), "2. No Hub, escolha Jogo Local > Criar Hub.", el("br"), "3. Seus amigos escolhem Entrar e usam o seu endereço.")));
    const campoJoin = el("input", { class: "campo", value: join, placeholder: "IP do amigo (ex.: 26.12.34.56) ou IP:porta" });
    campoJoin.addEventListener("change", () => ini.set("Multiplayer", "Join", campoJoin.value.trim()));
    const teste = el("div", { class: "dica", style: { marginTop: "8px" } });
    painelJoin.append(cartao(secao("Endereço do amigo"), el("div", { style: { display: "grid", gridTemplateColumns: "1fr auto", gap: "10px" } }, campoJoin,
      botao("Testar", async () => { teste.textContent = "Procurando..."; const r = await api.amigosConsultar(campoJoin.value.trim()); teste.textContent = r.online ? "✓ Achei o launcher de " + r.nome + " (" + r.ping + " ms). " + (r.estado === "H" ? "O Hub dele está aberto." : "Peça para ele criar o Hub.") : "✗ Não achei. Ele está com o launcher aberto? Firewall liberado? Mesmo IP de VPN?"; teste.style.color = r.online ? "var(--verde)" : "var(--vermelho)"; })), teste),
      cartao(secao("No jogo"), el("div", { class: "dica", style: { fontSize: "15px", lineHeight: "1.7" } }, "1. Peça para o amigo criar o Hub (Jogo Local > Criar Hub).", el("br"), "2. Clique em Partir em missão, vá ao Hub e escolha Jogo Local > Procurar Hubs.")));
    modo(!!join);

    // ---- grupo sem dessincronia
    const grupo = cartao(secao("Grupo sem dessincronia"),
      linha("Sincronizar monstros pequenos", "Jaggi, Aptonoth etc. no mesmo lugar e mortos para todos. Todo mundo do grupo deve usar igual.", chave(meuSync === "On", v => ini.set("Multiplayer", "SyncSmallMonsters", v ? "On" : "Off")), "sinc"),
      linha("Versão do port", "Você e seus amigos precisam da mesma versão.", el("span", { class: "valor" }, minhaVersao), "atualizar"));

    c.append(cabecalho("online", "Online", "Jogue com amigos pela rede local, por VPN (Radmin, ZeroTier, Hamachi) ou pela internet.", [8, 78], "pan"),
      cartaoAmigos, el("div", { class: "grade g2", style: { marginTop: "20px" } }, opHost, opJoin), painelHost, painelJoin, grupo);
    [...painelHost.children, ...painelJoin.children].forEach(x => x.style.marginTop = "20px");
    grupo.style.marginTop = "20px";
  },
};
