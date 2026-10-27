// Onde está o jogo, como abrir, se está aberto, versões e saves. Windows e Linux.
const fs = require("fs"), path = require("path"), os = require("os");
const { execFile, spawn } = require("child_process");
const { app } = require("electron");

const WIN = process.platform === "win32";
const EXE = WIN ? "mhgurecomp.exe" : "mhgurecomp";

function configArq() { return path.join(app.getPath("userData"), "config.json"); }
function config() { try { return JSON.parse(fs.readFileSync(configArq(), "utf8")); } catch { return {}; } }
function salvarConfig(c) { fs.mkdirSync(path.dirname(configArq()), { recursive: true }); fs.writeFileSync(configArq(), JSON.stringify(c, null, 2)); }

// a pasta do port: a escolhida antes, a do próprio launcher (portátil / AppImage) ou a de teste
function pastaJogo() {
  if (process.env.MHGU_DIR) return fs.existsSync(path.join(process.env.MHGU_DIR, EXE)) ? process.env.MHGU_DIR : null;  // (teste: só essa)
  const candidatos = [
    process.env.MHGU_DIR,
    config().pastaJogo,
    process.env.PORTABLE_EXECUTABLE_DIR,
    process.env.APPIMAGE && path.dirname(process.env.APPIMAGE),
    path.dirname(process.execPath),
    WIN ? "C:\\MHGURecomp\\Windows-MHGURecomp" : path.join(os.homedir(), "MHGURecomp"),
  ];
  for (const c of candidatos) if (c && fs.existsSync(path.join(c, EXE))) return c;
  return null;
}
function definirPasta(p) { if (!fs.existsSync(path.join(p, EXE))) return false; const c = config(); c.pastaJogo = p; salvarConfig(c); return true; }

function exe(dir) { return path.join(dir, EXE); }

// o mhgurecomp desta pasta está rodando?
function jogoAberto(dir) {
  return new Promise(res => {
    if (WIN) {
      execFile("powershell", ["-NoProfile", "-Command", "Get-Process mhgurecomp -ErrorAction SilentlyContinue | ForEach-Object { $_.Path }"], { windowsHide: true }, (e, out) => {
        res(String(out || "").split(/\r?\n/).some(l => l.trim().toLowerCase() === exe(dir).toLowerCase()));
      });
    } else {
      execFile("pgrep", ["-f", exe(dir)], (e, out) => res(!!String(out || "").trim()));
    }
  });
}

// algum programa escutando a porta TCP do jogo (= Hub aberto)
function portaEscutando(porta) {
  return new Promise(res => {
    const cmd = WIN ? ["netstat", ["-ano", "-p", "tcp"]] : ["ss", ["-ltn"]];
    execFile(cmd[0], cmd[1], { windowsHide: true }, (e, out) => {
      const re = new RegExp("[:.]" + porta + "\\s.*LISTEN", "i");
      res(String(out || "").split(/\r?\n/).some(l => re.test(l)));
    });
  });
}

function abrir(dir) {
  const p = spawn(exe(dir), [], { cwd: dir, detached: true, stdio: "ignore", windowsHide: false });
  p.unref();
  return p;
}

function lerTexto(arq) { try { return fs.readFileSync(arq, "utf8").trim(); } catch { return null; } }
function versaoPort(dir) {
  const v = lerTexto(path.join(dir, "versao_port.txt")), l = lerTexto(path.join(dir, "versao_licas.txt"));
  return v ? v + (l && +l > 0 ? "-licas" + l : "") : null;
}

// ---- saves (cabeçalho de 0x24 bytes + estrutura do 3DS; slots em 0x34; ativos em 0x28..0x2A)
function pastaSaves() {
  if (WIN) return path.join(process.env.APPDATA || "", "MHGURecomp", "save");
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"), "MHGURecomp", "save");
}
function savePc() { return path.join(pastaSaves(), "save_0", "system"); }

function lerSave(arq) {
  const r = [];
  try {
    const d = fs.readFileSync(arq);
    if (d.length < 0x40) return r;
    for (let i = 0; i < 3; i++) {
      if (!d[0x28 + i]) continue;
      const o = d.readInt32LE(0x34 + 4 * i) + 0x24;
      if (o <= 0 || o + 0x2c > d.length) continue;
      let fim = d.indexOf(0, o); if (fim < 0 || fim > o + 32) fim = o + 32;
      const nome = d.slice(o, fim).toString("utf8").trim();
      if (!nome) continue;
      r.push({ nome, slot: i + 1, horas: d.readUInt32LE(o + 0x20) / 3600, zenny: d.readUInt32LE(o + 0x24), hr: d.readUInt16LE(o + 0x28) });
    }
  } catch {}
  return r;
}

// saves do MHGU em emuladores (Eden, yuzu e derivados, Ryujinx), no Windows e no Linux
function savesEmuladores() {
  const casa = os.homedir();
  const raizes = WIN
    ? ["eden", "yuzu", "citron", "sudachi", "suyu", "torzu"].map(n => [n, path.join(process.env.APPDATA || "", n, "nand", "user", "save")]).concat([["Ryujinx", path.join(process.env.APPDATA || "", "Ryujinx", "bis", "user", "save")]])
    : ["eden", "yuzu", "citron", "sudachi", "suyu", "torzu"].map(n => [n, path.join(casa, ".local", "share", n, "nand", "user", "save")]).concat([["Ryujinx", path.join(casa, ".config", "Ryujinx", "bis", "user", "save")]]);
  const achados = [];
  const andar = (dir, prof, nomeEmu) => {
    if (prof > 8) return;
    let itens; try { itens = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const it of itens) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) andar(p, prof + 1, nomeEmu);
      else if (it.name === "system") {
        try {
          const st = fs.statSync(p);
          const ehMhgu = /0100770008DD8000/i.test(p) || nomeEmu === "Ryujinx";
          if (st.size > 5000000 && st.size < 5400000 && ehMhgu && lerSave(p).length) achados.push({ emulador: nomeEmu, arquivo: p, quando: st.mtimeMs });
        } catch {}
      }
    }
  };
  for (const [nome, raiz] of raizes) if (fs.existsSync(raiz)) andar(raiz, 0, nome);
  return achados.sort((a, b) => b.quando - a.quando);
}

function importarSave(origem) {
  const dest = path.dirname(savePc()), orig = path.dirname(origem);
  if (fs.existsSync(dest)) {
    const d = new Date(), z = n => String(n).padStart(2, "0");
    const bk = dest + "_backup_" + d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + "_" + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds());
    fs.mkdirSync(bk, { recursive: true });
    for (const f of fs.readdirSync(dest)) { const p = path.join(dest, f); if (fs.statSync(p).isFile()) fs.copyFileSync(p, path.join(bk, f)); }
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const n of ["system", "system_backup"]) if (fs.existsSync(path.join(orig, n))) fs.copyFileSync(path.join(orig, n), path.join(dest, n));
}

module.exports = { WIN, EXE, pastaJogo, definirPasta, exe, jogoAberto, portaEscutando, abrir, versaoPort, pastaSaves, savePc, lerSave, savesEmuladores, importarSave, config, salvarConfig };
