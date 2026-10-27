// Atualizações pelos Releases do GitHub: o port oficial, as correções (licas) e o próprio launcher.
const fs = require("fs"), path = require("path"), os = require("os");
const { app } = require("electron");
const AdmZip = require("adm-zip");
const WIN = process.platform === "win32";

// o repositório do launcher se chama MHLAUNCHER; o nome antigo fica de reserva (até a troca, e o GitHub redireciona)
const PORT = "morerokk/MHGURecomp", LAUNCHER = "licasmp4/MHLAUNCHER", LAUNCHER_ANTIGO = "licasmp4/MONSTER-HUNTER-GU-PORT-LAUNHCER";
const H = { "User-Agent": "MHLAUNCHER", Accept: "application/vnd.github+json" };

async function release(repo) {
  const r = await fetch("https://api.github.com/repos/" + repo + "/releases/latest", { headers: H });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("GitHub respondeu " + r.status);
  return r.json();
}
const versao = s => (String(s || "").replace(/^v/i, "").match(/\d+/g) || []).map(Number);
function maior(a, b) { const x = versao(a), y = versao(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; }

async function baixar(url, arq, progresso) {
  const r = await fetch(url, { headers: { "User-Agent": "MHGU-Launcher" } });
  if (!r.ok) throw new Error("download falhou (" + r.status + ")");
  const total = +r.headers.get("content-length") || 0, partes = []; let feito = 0;
  const leitor = r.body.getReader();
  for (;;) { const { done, value } = await leitor.read(); if (done) break; partes.push(Buffer.from(value)); feito += value.length; if (total && progresso) progresso(Math.round(feito * 100 / total)); }
  fs.writeFileSync(arq, Buffer.concat(partes));
}

// ---- port oficial
async function verPort(dir) {
  const rel = await release(PORT); if (!rel) return null;
  const asset = rel.assets.find(a => WIN ? /Windows.*\.zip$/i.test(a.name) : /Linux.*\.zip$/i.test(a.name));
  let instalada = null; try { instalada = fs.readFileSync(path.join(dir, "versao_port.txt"), "utf8").trim(); } catch {}
  return { ultima: rel.tag_name, instalada, url: asset && asset.browser_download_url, nova: !!asset && (!instalada || maior(rel.tag_name, instalada)) };
}

// troca só os arquivos do port: nunca o .ini, o jogo (data), os mods, os cheats ou os saves
async function atualizarPort(dir, info, progresso) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mhgu-port-")), zip = path.join(tmp, "port.zip");
  try {
    await baixar(info.url, zip, progresso);
    const z = new AdmZip(zip); z.extractAllTo(path.join(tmp, "x"), true);
    const acha = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isFile() && /^mhgurecomp(\.exe)?$/.test(f.name)) return d; if (f.isDirectory()) { const r = acha(p); if (r) return r; } } return null; };
    const raiz = acha(path.join(tmp, "x")); if (!raiz) throw new Error("o zip não tem o mhgurecomp");
    const ant = path.join(dir, "port_anterior"); let n = 0;
    // DLLs da versão antiga que a nova não traz (a 0.10 juntou dezenas numa só): vão para port_anterior, porque
    // uma DLL velha com o mesmo nome de uma do sistema pode ser carregada no lugar da certa
    const novas = new Set(fs.readdirSync(raiz).map(n => n.toLowerCase()));
    for (const f of fs.readdirSync(dir)) {
      if (!/\.dll$/i.test(f) || novas.has(f.toLowerCase())) continue;
      fs.mkdirSync(ant, { recursive: true }); fs.renameSync(path.join(dir, f), path.join(ant, f)); n++;
    }
    for (const f of fs.readdirSync(raiz, { withFileTypes: true })) {
      if (!f.isFile() || f.name === "mhgurecomp.ini") continue;
      const de = path.join(raiz, f.name), para = path.join(dir, f.name);
      if (fs.existsSync(para) && fs.readFileSync(para).equals(fs.readFileSync(de))) continue;
      if (fs.existsSync(para)) { fs.mkdirSync(ant, { recursive: true }); fs.copyFileSync(para, path.join(ant, f.name)); }
      fs.copyFileSync(de, para); if (!WIN) fs.chmodSync(para, 0o755); n++;
    }
    const bonus = path.join(raiz, "bonus", "system"), bonusAlvo = path.join(dir, "bonus", "system");
    if (fs.existsSync(bonus) && !fs.existsSync(bonusAlvo)) { fs.mkdirSync(path.dirname(bonusAlvo), { recursive: true }); fs.copyFileSync(bonus, bonusAlvo); }
    fs.writeFileSync(path.join(dir, "versao_port.txt"), info.ultima);
    try { fs.unlinkSync(path.join(dir, "versao_licas.txt")); } catch {}  // o exe oficial substituiu o nosso
    return n;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ---- launcher (e as correções do port, que vêm no mesmo Release: mhgurecomp-<versão>-licasN.exe)
async function verLauncher(dir) {
  const rel = (await release(LAUNCHER)) || (await release(LAUNCHER_ANTIGO)); if (!rel) return { nenhum: true };
  const atual = app.getVersion();
  const asset = rel.assets.find(a => WIN ? /windows\.exe$/i.test(a.name) : /linux\.AppImage$/i.test(a.name));
  let base = null, licas = 0; try { base = fs.readFileSync(path.join(dir, "versao_port.txt"), "utf8").trim(); } catch {}
  try { licas = +fs.readFileSync(path.join(dir, "versao_licas.txt"), "utf8").trim() || 0; } catch {}
  let correcao = null;
  if (WIN && base) for (const a of rel.assets) { const m = a.name.match(/^mhgurecomp-([0-9.]+)-licas(\d+)\.exe$/); if (m && m[1] === base && +m[2] > licas && (!correcao || +m[2] > correcao.n)) correcao = { n: +m[2], url: a.browser_download_url, nome: base + "-licas" + m[2] }; }
  return { ultima: rel.tag_name.replace(/^v/i, ""), atual, notas: rel.body || "", url: asset && asset.browser_download_url, nova: !!asset && maior(rel.tag_name, atual), correcao };
}

async function aplicarCorrecao(dir, c, progresso) {
  const novo = path.join(dir, "mhgurecomp.exe.novo"), exe = path.join(dir, "mhgurecomp.exe");
  await baixar(c.url, novo, progresso);
  const b = fs.readFileSync(novo); if (b.length < 1000000 || b[0] !== 0x4d || b[1] !== 0x5a) { fs.unlinkSync(novo); throw new Error("o arquivo baixado não é um programa válido"); }
  fs.mkdirSync(path.join(dir, "port_anterior"), { recursive: true }); fs.copyFileSync(exe, path.join(dir, "port_anterior", "mhgurecomp.exe"));
  fs.copyFileSync(novo, exe); fs.unlinkSync(novo);
  fs.writeFileSync(path.join(dir, "versao_licas.txt"), String(c.n));
}

// troca o próprio launcher: no Windows o .exe portátil em uso pode ser renomeado; no Linux o AppImage é trocado no lugar
async function atualizarLauncher(info, progresso) {
  const atual = WIN ? process.env.PORTABLE_EXECUTABLE_FILE : process.env.APPIMAGE;
  if (!atual) throw new Error("este launcher não é a versão portátil: baixe a nova pelo GitHub");
  const novo = atual + ".novo";
  await baixar(info.url, novo, progresso);
  if (WIN) { const velho = atual.replace(/\.exe$/i, "") + ".old.exe"; try { fs.unlinkSync(velho); } catch {} fs.renameSync(atual, velho); }
  fs.renameSync(novo, atual); if (!WIN) fs.chmodSync(atual, 0o755);
  fs.writeFileSync(path.join(app.getPath("userData"), "novidades.json"), JSON.stringify({ versao: info.ultima, notas: info.notas }));
  return atual;
}

module.exports = { verPort, atualizarPort, verLauncher, aplicarCorrecao, atualizarLauncher, release, baixar, maior };
