// Biblioteca do MHLAUNCHER: os outros ports de Monster Hunter, instalados e atualizados pelos Releases de cada
// projeto. Cada um tem o launcher próprio (é ele que pede os arquivos do jogo e prepara tudo); aqui ficam só baixar,
// atualizar e abrir. O Generations Ultimate não está aqui: ele tem o launcher inteiro (as outras abas).
const fs = require("fs"), path = require("path"), os = require("os");
const { spawn, execFileSync } = require("child_process");
const AdmZip = require("adm-zip");
const atualiza = require("./atualiza");
const jogo = require("./jogo");
const WIN = process.platform === "win32";

const JOGOS = {
  mh4u: {
    repo: "CompaLarios18/MH4UltimateDC", pasta: "MH4U",
    asset: WIN ? /windows\.zip$/i : /linux\.tar\.gz$/i,
    exe: WIN ? ["mh4u.exe"] : ["mh4u", "mh4u.sh"],
  },
  mhfu: {
    repo: "Mango77x/MHForever", pasta: "MHFU",
    asset: WIN ? /windows-x64\.zip$/i : /linux-x64\.tar\.gz$/i,
    exe: WIN ? ["MHForever.exe"] : ["MHForever", "mhforever"],
  },
  mhp3: {  // (a versão normal, não a "-portable": os dados dela ficam em %APPDATA%, e atualizar não mexe neles)
    repo: "TeamGDB/Yakumo", pasta: "MHP3rd",
    asset: WIN ? /windows-x86_64\.zip$/i : /linux-x86_64\.tar\.gz$/i,
    exe: WIN ? ["Yakumo.exe", "yakumo.exe"] : ["Yakumo", "yakumo"],
  },
};

// capas: baixadas na hora do acervo público do libretro (o mesmo do RetroArch) e guardadas no PC; nenhuma arte dos
// jogos vai no projeto. O Generations Ultimate não está lá (o acervo não tem o Switch): ele usa o ícone da cópia do
// próprio jogador (mhgu.ico, main.js "logo").
const LIBRETRO = "https://thumbnails.libretro.com/";
const CAPAS = {
  mh4u: "Nintendo - Nintendo 3DS/Named_Boxarts/Monster Hunter 4 Ultimate (USA).png",
  mhfu: "Sony - PlayStation Portable/Named_Boxarts/Monster Hunter Freedom Unite (USA) (En,Fr,De,Es,It).png",
  mhp3: "Sony - PlayStation Portable/Named_Boxarts/Monster Hunter Portable 3rd (Japan) (v1.02).png",
  // aba Collabs: um jogo de cada série que tem collab no Generations Ultimate
  "c-zelda": "Nintendo - Nintendo 64/Named_Boxarts/Legend of Zelda, The - Ocarina of Time (USA).png",
  "c-mario": "Nintendo - Nintendo 64/Named_Boxarts/Super Mario 64 (USA).png",
  "c-okami": "Nintendo - Nintendo DS/Named_Boxarts/Okamiden (USA).png",
  "c-starfox": "Nintendo - Nintendo 64/Named_Boxarts/Star Fox 64 (USA).png",
  "c-metroid": "Nintendo - Super Nintendo Entertainment System/Named_Boxarts/Super Metroid (Japan, USA) (En,Ja).png",
  "c-megaman": "Nintendo - Nintendo Entertainment System/Named_Boxarts/Mega Man 2 (USA).png",
  "c-fe": "Nintendo - Nintendo 3DS/Named_Boxarts/Fire Emblem - Awakening (USA).png",
  "c-sf": "Nintendo - Super Nintendo Entertainment System/Named_Boxarts/Street Fighter II Turbo (USA).png",
  "c-dmc": "Sony - PlayStation 2/Named_Boxarts/Devil May Cry (USA).png",
  "c-gng": "Nintendo - Nintendo Entertainment System/Named_Boxarts/Ghosts'n Goblins (USA).png",
  "c-strider": "Sega - Mega Drive - Genesis/Named_Boxarts/Strider (USA, Europe).png",
  "c-yugioh": "Nintendo - Game Boy Advance/Named_Boxarts/Yu-Gi-Oh! - The Eternal Duelist Soul (USA).png",
};
async function capa(id, pasta) {
  if (!CAPAS[id]) return null;
  const arq = path.join(pasta, "capa-" + id + ".png");
  if (!fs.existsSync(arq)) {
    const r = await fetch(LIBRETRO + CAPAS[id].split("/").map(encodeURIComponent).join("/"), { headers: { "User-Agent": "MHLAUNCHER" } });
    if (!r.ok) return null;
    fs.writeFileSync(arq, Buffer.from(await r.arrayBuffer()));
  }
  return "capa-" + id + ".png";
}
const VERSAO = ".mhlauncher-versao";

const pastaDe = id => (jogo.config().jogos || {})[id] || path.join(os.homedir(), "MHLAUNCHER", JOGOS[id].pasta);
function definirPasta(id, p) { const c = jogo.config(); c.jogos = c.jogos || {}; c.jogos[id] = p; jogo.salvarConfig(c); }
const exeDe = (id, dir) => JOGOS[id].exe.map(n => path.join(dir, n)).find(f => fs.existsSync(f)) || null;
const lerVersao = dir => { try { return fs.readFileSync(path.join(dir, VERSAO), "utf8").trim(); } catch { return null; } };

// o que está instalado (sem internet)
function estado() {
  const r = {};
  for (const id in JOGOS) { const dir = pastaDe(id), exe = exeDe(id, dir); r[id] = { pasta: dir, instalado: !!exe, versao: exe ? lerVersao(dir) : null }; }
  return r;
}

// a versão mais nova de cada um (com internet); nova = instalado e desatualizado
async function procurar() {
  const est = estado(), r = {};
  await Promise.all(Object.keys(JOGOS).map(async id => {
    try {
      const rel = await atualiza.release(JOGOS[id].repo), a = rel && rel.assets.find(x => JOGOS[id].asset.test(x.name));
      r[id] = { ...est[id], ultima: rel ? rel.tag_name : null, url: a ? a.browser_download_url : null, tamanho: a ? a.size : 0,
        nova: !!(a && est[id].instalado && (!est[id].versao || est[id].versao !== rel.tag_name)) };
    } catch (e) { r[id] = { ...est[id], erro: String(e.message || e) }; }
  }));
  return r;
}

// baixa o pacote do Release e põe na pasta do jogo. Os pacotes vêm com uma pasta só dentro: o conteúdo dela vai para
// a pasta do jogo, por cima (as configurações e os saves desses ports ficam fora da pasta, em AppData / Documentos).
async function instalar(id, progresso) {
  const info = (await procurar())[id];
  if (!info || !info.url) throw new Error("não achei o pacote para " + (WIN ? "Windows" : "Linux") + " no GitHub do projeto");
  const dir = pastaDe(id), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mhlauncher-")), arq = path.join(tmp, WIN ? "p.zip" : "p.tar.gz"), x = path.join(tmp, "x");
  try {
    await atualiza.baixar(info.url, arq, progresso);
    fs.mkdirSync(x);
    if (WIN) new AdmZip(arq).extractAllTo(x, true); else execFileSync("tar", ["-xzf", arq, "-C", x]);
    let raiz = x; const dentro = fs.readdirSync(x);
    if (dentro.length === 1 && fs.statSync(path.join(x, dentro[0])).isDirectory()) raiz = path.join(x, dentro[0]);
    fs.mkdirSync(dir, { recursive: true });
    fs.cpSync(raiz, dir, { recursive: true, force: true });
    if (!WIN) for (const n of JOGOS[id].exe) { const f = path.join(dir, n); if (fs.existsSync(f)) fs.chmodSync(f, 0o755); }
    if (!exeDe(id, dir)) throw new Error("o pacote não tem o " + JOGOS[id].exe[0]);
    fs.writeFileSync(path.join(dir, VERSAO), info.ultima);
    return estado()[id];
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

function abrir(id) {
  const dir = pastaDe(id), exe = exeDe(id, dir);
  if (!exe) return { erro: "Instale primeiro." };
  spawn(exe, [], { cwd: dir, detached: true, stdio: "ignore" }).unref();
  return { ok: true };
}

module.exports = { JOGOS, estado, procurar, instalar, abrir, pastaDe, definirPasta, capa };
