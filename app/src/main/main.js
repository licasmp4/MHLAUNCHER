// MHGU Launcher 3 (Electron): Windows e Linux. A janela e a ponte entre a interface e o sistema.
const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, nativeImage, protocol, net } = require("electron");
const fs = require("fs"), path = require("path");
const { pathToFileURL } = require("url");
const { Ini } = require("./ini");
const jogo = require("./jogo"), rede = require("./rede"), sistema = require("./sistema"), mods = require("./mods"), atualiza = require("./atualiza"), diag = require("./diag");

let win = null, ini = null, dir = null, jogoProc = null, salvarTimer = null;

// protocolo próprio: a interface, os vídeos do jogo e o cache saem da mesma origem (mhgu://app/), senão o navegador
// não deixa tirar foto dos vídeos num <canvas>
protocol.registerSchemesAsPrivileged([{ scheme: "mhgu", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
const RENDER = path.join(__dirname, "..", "renderer");
const pastaCache = () => { const d = path.join(app.getPath("userData"), "cenas"); fs.mkdirSync(d, { recursive: true }); return d; };
function servir() {
  protocol.handle("mhgu", req => {
    const u = new URL(req.url), rel = decodeURIComponent(u.pathname).replace(/^\/+/, "");
    let arq;
    if (rel.startsWith("_jogo/")) arq = dir && path.join(dir, "data", "romfs", "nativeNX", "movie", path.basename(rel));
    else if (rel.startsWith("_logo")) arq = dir && path.join(dir, "mhgu.ico");
    else if (rel.startsWith("_cache/")) arq = path.join(pastaCache(), path.basename(rel));
    else { arq = path.normalize(path.join(RENDER, rel)); if (!arq.startsWith(RENDER)) arq = null; }
    if (!arq || !fs.existsSync(arq)) return new Response("não encontrado", { status: 404 });
    // vídeo: atende pedidos de pedaço (Range), senão o navegador não consegue pular para o meio da cena
    if (arq.endsWith(".mp4")) {
      const total = fs.statSync(arq).size, m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
      const ini = m && m[1] ? +m[1] : 0, fim = m && m[2] ? Math.min(+m[2], total - 1) : total - 1;
      const corpo = require("stream").Readable.toWeb(fs.createReadStream(arq, { start: ini, end: fim }));
      const cab = { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Content-Length": String(fim - ini + 1) };
      if (m) cab["Content-Range"] = "bytes " + ini + "-" + fim + "/" + total;
      return new Response(corpo, { status: m ? 206 : 200, headers: cab });
    }
    return net.fetch(pathToFileURL(arq).href);
  });
}
const args = process.argv.slice(1);
const printsDir = args.includes("--prints") ? (args[args.indexOf("--prints") + 1] || path.join(app.getPath("temp"), "mhgu-prints")) : null;

function carregarIni() { dir = jogo.pastaJogo(); ini = dir ? new Ini(path.join(dir, "mhgurecomp.ini")) : null; }
const porta = () => { const p = +(ini && ini.get("Multiplayer", "Port", "39500")); return p > 0 && p < 65535 ? p : 39500; };
const salvarIniJa = () => { clearTimeout(salvarTimer); salvarTimer = null; try { ini && ini.salvar(); } catch {} };

function criarJanela() {
  win = new BrowserWindow({
    width: 1200, height: 790, minWidth: 880, minHeight: 600, frame: false, show: false, backgroundColor: "#120F0D",
    title: "MHGU Launcher", icon: path.join(__dirname, "..", "..", "build", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "..", "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: false, backgroundThrottling: true },
  });
  win.loadURL("mhgu://app/index.html" + (printsDir ? "?prints=1" : ""));
  win.once("ready-to-show", () => { win.show(); if (printsDir) tirarPrints(); });
  win.on("maximize", () => win.webContents.send("janela", { max: true }));
  win.on("unmaximize", () => win.webContents.send("janela", { max: false }));
  win.on("close", salvarIniJa);
}

// --prints <pasta>: uma imagem de cada página (para conferir o visual)
async function tirarPrints() {
  fs.mkdirSync(printsDir, { recursive: true });
  const espera = ms => new Promise(r => setTimeout(r, ms));
  await espera(5000);
  for (const p of ["inicio", "online", "cacada", "graficos", "fps", "controles", "mods", "sobre"]) {
    win.webContents.send("nav", p);
    await espera(1300);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(printsDir, p + ".png"), img.toPNG());
  }
  app.quit();
}

// ---- presença: o que os amigos veem (atualizado a cada 3 s)
let meuNome = "Caçador";
async function atualizarPresenca() {
  if (!dir) return;
  const aberto = await jogo.jogoAberto(dir), hub = aberto && await jogo.portaEscutando(porta());
  rede.definirResposta(["MHGU!1", meuNome.replace(/\|/g, "/"), jogo.versaoPort(dir) || "?", app.getVersion(), ini.get("Multiplayer", "SyncSmallMonsters", "On"), hub ? "H" : aberto ? "J" : "L"].join("|"));
}

const h = (canal, fn) => ipcMain.handle(canal, async (e, ...a) => fn(...a));
function registrar() {
  h("estado", () => ({ pasta: dir, plataforma: process.platform, versao: app.getVersion(), versaoPort: dir && jogo.versaoPort(dir), monitor: sistema.monitor(), presenca: rede.ativo(), prints: !!printsDir }));
  h("pasta:escolher", async () => {
    const r = await dialog.showOpenDialog(win, { title: "Pasta do MHGURecomp (onde fica o " + jogo.EXE + ")", properties: ["openDirectory"] });
    if (r.canceled || !r.filePaths[0]) return false;
    if (!jogo.definirPasta(r.filePaths[0])) return false;
    carregarIni(); return true;
  });
  // .ini do port: lê na hora, grava meio segundo depois da última mudança
  h("ini:get", (s, k, p) => (ini ? ini.get(s, k, p) : p));
  h("ini:set", (s, k, v) => { if (!ini) return; ini.set(s, k, v); clearTimeout(salvarTimer); salvarTimer = setTimeout(salvarIniJa, 500); return true; });
  h("ini:restaurar", () => { if (!ini) return; salvarIniJa(); fs.copyFileSync(ini.caminho, ini.caminho + ".bak"); fs.unlinkSync(ini.caminho); carregarIni(); });
  h("config:get", k => jogo.config()[k]);
  h("config:set", (k, v) => { const c = jogo.config(); c[k] = v; jogo.salvarConfig(c); });

  h("jogo:aberto", () => dir && jogo.jogoAberto(dir));
  h("jogo:abrir", async () => {
    if (!dir) return { erro: "Escolha a pasta do jogo primeiro." };
    if (await jogo.jogoAberto(dir)) return { erro: "O jogo já está aberto." };
    salvarIniJa();
    jogoProc = jogo.abrir(dir);
    win.hide();
    // fica escondido (respondendo aos amigos) até o jogo fechar; aí fecha junto
    const vigia = setInterval(async () => { if (!(await jogo.jogoAberto(dir))) { clearInterval(vigia); app.quit(); } }, 4000);
    return { ok: true };
  });

  h("saves", () => ({ pc: jogo.lerSave(jogo.savePc()), pcExiste: fs.existsSync(jogo.savePc()), pcQuando: fs.existsSync(jogo.savePc()) ? fs.statSync(jogo.savePc()).mtimeMs : 0,
                      emuladores: jogo.savesEmuladores().map(e => ({ ...e, cacadores: jogo.lerSave(e.arquivo) })) }));
  h("saves:importar", async arquivo => { if (await jogo.jogoAberto(dir)) return { erro: "Feche o jogo antes de importar o save." }; jogo.importarSave(arquivo); return { ok: true }; });
  h("presenca:nome", n => { meuNome = n || "Caçador"; atualizarPresenca(); });

  h("sistema:placa", async () => { const p = await sistema.placa(); return p && { ...p, recomendado: sistema.recomendar(p) }; });
  h("sistema:ips", () => sistema.ips());
  h("sistema:firewall", () => sistema.firewall(porta(), dir && jogo.exe(dir)));
  h("sistema:liberar", async () => { await sistema.liberarFirewall(porta(), dir && jogo.exe(dir)); return sistema.firewall(porta(), dir && jogo.exe(dir)); });
  h("sistema:ipPublico", async () => { try { return (await (await fetch("https://api.ipify.org")).text()).trim(); } catch { return null; } });

  h("mods", () => dir ? mods.listar(dir) : []);
  h("mods:ligar", (n, l) => mods.ligarMod(dir, n, l));
  h("plugins", () => dir ? mods.plugins(dir) : {});
  h("plugins:ligar", (q, l) => mods.ligarPlugin(dir, q, l));
  h("layouts", () => dir ? mods.layouts(dir) : { atual: "PS", instalados: {} });
  h("layouts:trocar", async l => { if (await jogo.jogoAberto(dir)) return { erro: "Feche o jogo para trocar os botões." }; mods.trocarLayout(dir, l); return mods.layouts(dir); });
  h("cheats", () => dir ? mods.cheats(dir) : []);
  h("cheats:ligar", (a, l) => mods.ligarCheat(dir, a, l));
  h("abrir", qual => {
    const alvos = { jogo: dir, mods: dir && path.join(dir, "mods"), cheats: dir && path.join(dir, "cheats"), saves: jogo.pastaSaves(), prints: dir && path.join(dir, "shots"), log: dir && path.join(dir, "log.txt") };
    const p = alvos[qual]; if (!p) return; if (!p.endsWith(".txt")) fs.mkdirSync(p, { recursive: true }); shell.openPath(p);
  });
  h("externo", url => shell.openExternal(url));
  h("copiar", t => clipboard.writeText(t));

  const amigosArq = () => dir && path.join(dir, "launcher_amigos.txt");
  h("amigos", () => { try { return fs.readFileSync(amigosArq(), "utf8").split(/\r?\n/).map(s => s.trim()).filter(Boolean); } catch { return []; } });
  h("amigos:salvar", lista => fs.writeFileSync(amigosArq(), lista.join("\r\n")));
  h("amigos:consultar", end => rede.consultar(end, porta()));

  const progresso = tipo => p => win && win.webContents.send("progresso", { tipo, p });
  h("atualiza:port", () => dir && atualiza.verPort(dir));
  h("atualiza:portAplicar", async info => { if (await jogo.jogoAberto(dir)) throw new Error("Feche o jogo antes de atualizar."); return atualiza.atualizarPort(dir, info, progresso("port")); });
  h("atualiza:launcher", () => atualiza.verLauncher(dir));
  h("atualiza:correcao", async c => { if (await jogo.jogoAberto(dir)) throw new Error("Feche o jogo antes de atualizar."); return atualiza.aplicarCorrecao(dir, c, progresso("correcao")); });
  h("atualiza:launcherAplicar", async info => { const exe = await atualiza.atualizarLauncher(info, progresso("launcher")); require("child_process").spawn(exe, [], { detached: true, stdio: "ignore" }).unref(); app.quit(); });
  h("novidades", () => { const f = path.join(app.getPath("userData"), "novidades.json"); try { const n = JSON.parse(fs.readFileSync(f, "utf8")); fs.unlinkSync(f); return n.versao === app.getVersion() ? n : null; } catch { return null; } });

  h("diag", () => dir && diag.ler(dir));
  // cenas do jogo: os vídeos da cópia do jogador, e as fotos tiradas deles (cache)
  h("cena:video", n => { const nome = "movie" + String(n).padStart(2, "0") + ".mp4", f = dir && path.join(dir, "data", "romfs", "nativeNX", "movie", nome); return f && fs.existsSync(f) ? "mhgu://app/_jogo/" + nome : null; });
  h("logo", () => dir && fs.existsSync(path.join(dir, "mhgu.ico")) ? "mhgu://app/_logo.ico" : null);
  h("cache:ler", nome => fs.existsSync(path.join(pastaCache(), nome)) ? "mhgu://app/_cache/" + encodeURIComponent(nome) : null);
  h("cache:salvar", (nome, dataUrl) => { fs.writeFileSync(path.join(pastaCache(), nome), nativeImage.createFromDataURL(dataUrl).toJPEG(88)); return "mhgu://app/_cache/" + encodeURIComponent(nome); });

  h("janela", acao => { if (acao === "min") win.minimize(); else if (acao === "max") win.isMaximized() ? win.unmaximize() : win.maximize(); else if (acao === "fechar") win.close(); });
}

// uma janela só: abrir de novo traz a que já está aberta para a frente
if (!printsDir && !app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });

app.whenReady().then(async () => {
  carregarIni();
  servir();
  registrar();
  criarJanela();
  if (dir) { await rede.iniciar(porta()); atualizarPresenca(); setInterval(atualizarPresenca, 3000); }
});
app.on("window-all-closed", () => { salvarIniJa(); rede.parar(); app.quit(); });
