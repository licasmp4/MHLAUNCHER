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
function plugins(dir) { const r = {}; for (const [k, n] of Object.entries(NRO)) { const f = acharPlugin(dir, n); r[k] = f ? { instalado: true, ligado: !f.endsWith(".off") } : { instalado: false, ligado: false }; } return r; }
function ligarPlugin(dir, qual, ligar) {
  const f = acharPlugin(dir, NRO[qual]); if (!f) return;
  const alvo = ligar ? f.replace(/\.off$/, "") : (f.endsWith(".off") ? f : f + ".off");
  if (alvo !== f) fs.renameSync(f, alvo);
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

module.exports = { listar, ligarMod, plugins, ligarPlugin, layouts, trocarLayout, trocarNomes, cheats, ligarCheat, dirs };
