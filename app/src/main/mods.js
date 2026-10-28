// Mods, plugins do HUD, botões do jogo e cheats (tudo é pasta ou arquivo renomeado: nada é apagado).
// O port aplica os mods em ordem alfabética (o último ganha) e ignora pastas que começam com "_".
const fs = require("fs"), path = require("path");

const NRO = { vida: "target_health_display.nro", dano: "attack_damage_display.nro" };
const LAYOUTS = ["Xbox", "Nintendo"];
const ehPacoteBotoes = n => n.includes("~Botoes") || n.includes("~Nomes PT");

const dirs = dir => ({ on: path.join(dir, "mods"), off: path.join(dir, "mods_desativados"), cheats: path.join(dir, "cheats") });
const pastas = p => { try { return fs.readdirSync(p, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch { return []; } };

function tamanho(p) {
  let arquivos = 0, bytes = 0, plugins = false;
  const andar = d => { let it; try { it = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const x of it) { const q = path.join(d, x.name); if (x.isDirectory()) andar(q); else { arquivos++; try { bytes += fs.statSync(q).size; } catch {} if (/\.nro(\.off)?$/.test(x.name)) plugins = true; } } };
  andar(p);
  return { arquivos, bytes, plugins };
}

function listar(dir) {
  const d = dirs(dir), r = [];
  for (const n of pastas(d.on)) if (!n.startsWith("_") && !ehPacoteBotoes(n)) r.push({ nome: n, ligado: true, ...tamanho(path.join(d.on, n)) });
  for (const n of pastas(d.off)) r.push({ nome: n, ligado: false, ...tamanho(path.join(d.off, n)) });
  return r.sort((a, b) => a.nome.localeCompare(b.nome));
}

function ligarMod(dir, nome, ligar) {
  const d = dirs(dir), a = path.join(d.on, nome), b = path.join(d.off, nome);
  if (ligar && fs.existsSync(b)) { fs.mkdirSync(d.on, { recursive: true }); fs.renameSync(b, a); }
  if (!ligar && fs.existsSync(a)) { fs.mkdirSync(d.off, { recursive: true }); fs.renameSync(a, b); }
}

// plugin ligado = .nro; desligado = .nro.off (só nas pastas de plugins de cada mod: varrer tudo era lento)
function acharPlugin(dir, nro) {
  for (const m of pastas(dirs(dir).on)) {
    const pl = path.join(dirs(dir).on, m, "romfs", "nativeNX", "plugins");
    for (const c of [nro, nro + ".off"]) if (fs.existsSync(path.join(pl, c))) return path.join(pl, c);
  }
  return null;
}
// plugins que vêm dentro do launcher (src/main/recursos, fora do git): trocam os do mod quando são outros, para quem
// instalou antes receber as versões novas (ex.: o hitmarker). Com o jogo aberto o arquivo está em uso: fica para a próxima.
function atualizarPlugins(dir) {
  for (const n of Object.values(NRO)) {
    const novo = path.join(__dirname, "recursos", n), f = acharPlugin(dir, n);
    if (!f || !fs.existsSync(novo)) continue;
    try { const a = fs.readFileSync(novo); if (Buffer.compare(a, fs.readFileSync(f)) !== 0) fs.writeFileSync(f, a); } catch {}
  }
}
function plugins(dir) { const r = {}; for (const [k, n] of Object.entries(NRO)) { const f = acharPlugin(dir, n); r[k] = f ? { instalado: true, ligado: !f.endsWith(".off") } : { instalado: false, ligado: false }; } return r; }
function ligarPlugin(dir, qual, ligar) {
  const f = acharPlugin(dir, NRO[qual]); if (!f) return;
  const alvo = ligar ? f.replace(/\.off$/, "") : (f.endsWith(".off") ? f : f + ".off");
  if (alvo !== f) fs.renameSync(f, alvo);
}

// opções do plugin de dano: "hitmarker = ..." e "numbers = ..." (true|false) no attack_damage_display.ini de cada
// save (%APPDATA%\MHGURecomp\save\save_N; sem a linha, o plugin usa ligado)
function iniDano() {
  const b = path.join(process.env.APPDATA || "", "MHGURecomp", "save");
  try { return fs.readdirSync(b).filter(n => /^save_\d+$/.test(n)).map(n => path.join(b, n, "attack_damage_display.ini")); } catch { return []; }
}
function opcaoDano(dir, chave, ligar) {
  if (!["hitmarker", "numbers"].includes(chave)) return;
  const re = new RegExp("^" + chave + "\\s*=.*$", "m");
  if (ligar === undefined) {
    for (const f of iniDano()) { try { const m = re.exec(fs.readFileSync(f, "utf8")); if (m) return /=\s*true/.test(m[0]); } catch {} }
    return true;
  }
  for (const f of iniDano()) {
    let s = "[display]\n"; try { s = fs.readFileSync(f, "utf8"); } catch {}
    s = re.test(s) ? s.replace(re, chave + " = " + !!ligar) : s.replace(/\s*$/, "\n" + chave + " = " + !!ligar + "\n");
    try { fs.writeFileSync(f, s); } catch {}
  }
  if (ligar) ligarPlugin(dir, "dano", true);  // (números ou hitmarker precisam do plugin ligado)
  return !!ligar;
}

// botões no jogo: a tradução vem com PlayStation; Xbox e Nintendo são pacotes por cima
const pastaLayout = (dir, l, ligado) => path.join(dirs(dir).on, (ligado ? "" : "_") + "MHGU pt-BR ~Botoes " + l);
const pastaNomes = (dir, l, ligado) => path.join(dirs(dir).on, (ligado ? "" : "_") + "MHGU pt-BR ~Nomes PT " + l);
const existe = (f, dir, l) => fs.existsSync(f(dir, l, true)) || fs.existsSync(f(dir, l, false));
function layouts(dir) {
  const inst = {}, instPT = {}; let atual = "PS", nomes = "EN";
  for (const l of LAYOUTS) { inst[l] = existe(pastaLayout, dir, l); if (fs.existsSync(pastaLayout(dir, l, true))) atual = l; }
  for (const l of ["PS", ...LAYOUTS]) { instPT[l] = existe(pastaNomes, dir, l); if (fs.existsSync(pastaNomes(dir, l, true))) { atual = l; nomes = "PT"; } }
  return { atual, nomes, instalados: inst, instaladosPT: instPT };
}
// liga só o pacote certo para o estilo e os nomes escolhidos, desliga os outros
function aplicar(dir, estilo, nomes) {
  if (nomes === "PT" && !existe(pastaNomes, dir, estilo)) throw new Error("O pacote com tudo em português para " + estilo + " não está instalado.");
  const liga = (f, l, on) => { const a = f(dir, l, !on), b = f(dir, l, on); if (fs.existsSync(a)) fs.renameSync(a, b); };
  for (const l of LAYOUTS) liga(pastaLayout, l, nomes === "EN" && l === estilo);
  for (const l of ["PS", ...LAYOUTS]) liga(pastaNomes, l, nomes === "PT" && l === estilo);
}
function trocarLayout(dir, escolha) { aplicar(dir, escolha, layouts(dir).nomes); }
function trocarNomes(dir, nomes) { aplicar(dir, layouts(dir).atual, nomes); }

// cheats: .txt na pasta cheats; desligado = "_" na frente do nome
function cheats(dir) {
  const c = dirs(dir).cheats; let it = []; try { it = fs.readdirSync(c).filter(f => f.toLowerCase().endsWith(".txt")); } catch {}
  return it.sort().map(f => ({ nome: f.replace(/^_/, "").replace(/\.txt$/i, ""), ligado: !f.startsWith("_"), arquivo: f }));
}
function ligarCheat(dir, arquivo, ligar) {
  const c = dirs(dir).cheats, limpo = arquivo.replace(/^_/, "");
  const de = path.join(c, arquivo), para = path.join(c, ligar ? limpo : "_" + limpo);
  if (de !== para && fs.existsSync(de)) fs.renameSync(de, para);
}

module.exports = { listar, ligarMod, atualizarPlugins, plugins, ligarPlugin, opcaoDano, layouts, trocarLayout, trocarNomes, cheats, ligarCheat, dirs };
