// Teclado e mouse: a seção [Keyboard] do mhgurecomp.ini (o port lê ao abrir o jogo). Cada botão do controle do
// Switch aceita até 4 teclas ou botões do mouse; clicar numa tecla troca, "+" junta outra, o × tira.
const TECLADO = {
  // [chave no .ini, o que faz no jogo, padrão do port (runtime/config.c)]
  grupos: [
    ["Andar", [["MoveForward", "Frente", "W"], ["MoveBack", "Trás", "S"], ["MoveLeft", "Esquerda", "A"], ["MoveRight", "Direita", "D"], ["Walk", "Andar devagar (segurar)", "Left Shift"]]],
    ["Caçar", [["X", "X · sacar arma / atacar", "Mouse Left"], ["A", "A · atacar / confirmar", "Mouse Right"], ["B", "B · rolar / voltar", "Space"], ["Y", "Y · usar item / guardar arma", "R"],
      ["R", "R · ação da arma", "E"], ["L", "L · centralizar câmera / alvo", "Q, Mouse Middle"], ["ZL", "ZL", "Tab"], ["ZR", "ZR", "T"]]],
    ["Itens e menus", [["ItemPrev", "Item anterior na bolsa (L + Y)", "Wheel Up"], ["ItemNext", "Próximo item na bolsa (L + A)", "Wheel Down"],
      ["Plus", "+ · menu", "Return, Keypad Enter"], ["Minus", "− · mapa / menu rápido", "Backspace"],
      ["DpadUp", "Direcional ↑", "Up"], ["DpadDown", "Direcional ↓", "Down"], ["DpadLeft", "Direcional ←", "Left"], ["DpadRight", "Direcional →", "Right"],
      ["LStick", "Clique do analógico esquerdo", "Left Ctrl, Right Ctrl"], ["RStick", "Clique do analógico direito", "Left Alt, Right Alt"]]],
  ],
  // KeyboardEvent.code -> nome do SDL (o que o port entende). Fora daqui: não dá para usar.
  sdl(code) {
    let m;
    if ((m = /^Key([A-Z])$/.exec(code))) return m[1];
    if ((m = /^Digit(\d)$/.exec(code))) return m[1];
    if ((m = /^Numpad(\d)$/.exec(code))) return "Keypad " + m[1];
    if ((m = /^F([1-6])$/.exec(code))) return "F" + m[1];
    return {
      Space: "Space", Tab: "Tab", Enter: "Return", Backspace: "Backspace", CapsLock: "CapsLock", ShiftLeft: "Left Shift", ShiftRight: "Right Shift",
      ControlLeft: "Left Ctrl", ControlRight: "Right Ctrl", AltLeft: "Left Alt", AltRight: "Right Alt", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left",
      ArrowRight: "Right", Delete: "Delete", Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown", NumpadEnter: "Keypad Enter",
      NumpadAdd: "Keypad +", NumpadSubtract: "Keypad -", NumpadMultiply: "Keypad *", NumpadDivide: "Keypad /", NumpadDecimal: "Keypad .",
      Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Quote: "'", Backquote: "`", Period: ".", Slash: "/",
    }[code] || null;
  },
  // teclas que o port já usa para outra coisa (ou que quebram o .ini: ; # ,)
  reservada(code) {
    if (code === "Escape") return "Esc solta o mouse no jogo.";
    if (/^F(7|8|9|1[0-2])$/.test(code)) return code + " já é atalho do port (prints e anti-serrilhado).";
    if (code === "Insert") return "Insert abre o menu da barra de vida e do dano.";
    if (code === "Comma" || code === "Semicolon") return "Essa tecla não pode ser usada (ela quebra o arquivo de ajustes).";
    return null;
  },
  mouse: ["Mouse Left", "Mouse Middle", "Mouse Right", "Mouse 4", "Mouse 5"],
  // o nome bonito, em português
  nome(n) {
    const t = {
      "Mouse Left": "Clique esq.", "Mouse Right": "Clique dir.", "Mouse Middle": "Clique do meio", "Mouse 4": "Mouse 4", "Mouse 5": "Mouse 5",
      "Wheel Up": "Rodinha ↑", "Wheel Down": "Rodinha ↓", Space: "Espaço", Return: "Enter", "Keypad Enter": "Enter (num.)", Backspace: "Backspace",
      "Left Shift": "Shift esq.", "Right Shift": "Shift dir.", "Left Ctrl": "Ctrl esq.", "Right Ctrl": "Ctrl dir.", "Left Alt": "Alt esq.", "Right Alt": "Alt dir.",
      Up: "↑", Down: "↓", Left: "←", Right: "→", CapsLock: "Caps Lock", Delete: "Delete", PageUp: "Page Up", PageDown: "Page Down",
    };
    return t[n] || n.replace(/^Keypad /, "Num ");
  },
  lista: v => String(v || "").split(",").map(s => s.trim()).filter(s => s && s.toLowerCase() !== "none"),
};

async function montarTeclado() {
  const acoes = TECLADO.grupos.flatMap(g => g[1]);
  const atual = {};
  for (const [k, , pad] of acoes) atual[k] = TECLADO.lista(await ini.get("Keyboard", k, pad));
  const caixa = el("div", { class: "teclado" });
  let ouvindo = null;  // { k, i, chip }: esperando a tecla nova

  const salvar = k => ini.set("Keyboard", k, atual[k].length ? atual[k].join(", ") : "None");
  const parar = () => {
    if (!ouvindo) return;
    window.removeEventListener("keydown", aoTecla, true); window.removeEventListener("mousedown", aoMouse, true);
    window.removeEventListener("wheel", aoRoda, { capture: true }); window.removeEventListener("contextmenu", semMenu, true);
    ouvindo = null; pintar();
  };
  const pegar = nome => {
    const { k, i } = ouvindo;
    const l = atual[k].filter((x, j) => j !== i && x !== nome);
    if (i == null || i >= atual[k].length) l.push(nome); else l.splice(i, 0, nome);
    atual[k] = l.slice(0, 4); salvar(k); parar();
    const outros = acoes.filter(([o]) => o !== k && atual[o].includes(nome)).map(a => a[1]);
    toast(outros.length ? TECLADO.nome(nome) + " também está em: " + outros.join(", ") : TECLADO.nome(nome) + " salvo. Vale ao abrir o jogo.");
  };
  const aoTecla = e => {
    e.preventDefault(); e.stopPropagation();
    if (e.code === "Escape") return parar();
    const r = TECLADO.reservada(e.code); if (r) return toast(r);
    const n = TECLADO.sdl(e.code); if (!n) return toast("Essa tecla o jogo não reconhece. Tente outra.");
    pegar(n);
  };
  const aoMouse = e => { if (e.target.closest(".teclado .x, .teclado .mais")) return; e.preventDefault(); e.stopPropagation(); if (TECLADO.mouse[e.button]) pegar(TECLADO.mouse[e.button]); };
  const aoRoda = e => { e.preventDefault(); if (e.deltaY) pegar(e.deltaY < 0 ? "Wheel Up" : "Wheel Down"); };
  const semMenu = e => e.preventDefault();
  const ouvir = (k, i) => {
    parar(); ouvindo = { k, i }; pintar();
    setTimeout(() => {  // (o clique que abriu não conta como a tecla nova)
      window.addEventListener("keydown", aoTecla, true); window.addEventListener("mousedown", aoMouse, true);
      window.addEventListener("wheel", aoRoda, { capture: true, passive: false }); window.addEventListener("contextmenu", semMenu, true);
    }, 120);
  };

  const usos = () => { const u = {}; for (const [k] of acoes) for (const n of atual[k]) (u[n] = u[n] || []).push(k); return u; };
  function pintar() {
    const u = usos();
    caixa.innerHTML = "";
    for (const [titulo, lista] of TECLADO.grupos) {
      caixa.append(el("div", { class: "tgrupo" }, titulo));
      for (const [k, rotulo] of lista) {
        const chips = el("div", { class: "teclas" });
        atual[k].forEach((n, i) => {
          const esperando = ouvindo && ouvindo.k === k && ouvindo.i === i;
          const ch = el("button", { class: "tecla" + (esperando ? " ouve" : "") + (u[n].length > 1 ? " repetida" : ""), title: u[n].length > 1 ? "Também em outro botão" : "Clique para trocar" },
            esperando ? "aperte…" : TECLADO.nome(n), el("span", { class: "x", title: "Tirar" }, "×"));
          ch.addEventListener("click", e => { if (e.target.classList.contains("x")) { atual[k].splice(i, 1); salvar(k); return pintar(); } ouvir(k, i); });
          chips.append(ch);
        });
        const novo = ouvindo && ouvindo.k === k && ouvindo.i >= atual[k].length;
        if (novo) chips.append(el("span", { class: "tecla ouve" }, "aperte…"));
        else if (atual[k].length < 4) { const m = el("button", { class: "tecla mais", title: "Juntar outra tecla" }, "+"); m.addEventListener("click", () => ouvir(k, atual[k].length)); chips.append(m); }
        caixa.append(el("div", { class: "tlinha" + (ouvindo && ouvindo.k === k ? " on" : "") }, el("span", { class: "rot" }, rotulo), chips));
      }
    }
  }
  pintar();
  $$(".pagina").forEach(p => new MutationObserver(() => !$("#pg-controles").classList.contains("ativa") && parar()).observe(p, { attributes: true, attributeFilter: ["class"] }));

  const restaurar = botao("Restaurar padrão", () => { parar(); for (const [k, , pad] of acoes) { atual[k] = TECLADO.lista(pad); salvar(k); } pintar(); toast("Teclas do padrão de volta"); }, "peq fantasma");
  return { caixa, restaurar };
}
