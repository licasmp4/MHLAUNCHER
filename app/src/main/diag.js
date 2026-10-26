// Diagnóstico do HUD de caça: lê as linhas "diag" que os plugins gravam no log.txt do jogo (sem trancar o arquivo).
const fs = require("fs"), path = require("path"), readline = require("readline");

async function ler(dir) {
  const log = path.join(dir, "log.txt");
  if (!fs.existsSync(log)) return { semLog: true };
  const r = { vidaCarregou: false, danoCarregou: false, vidaIncompat: false, danoIncompat: false, desenhou: false, semAlvo: false, vida: null, telaVida: null, imguiVida: null, dano: null };
  const rl = readline.createInterface({ input: fs.createReadStream(log, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const l of rl) {
    if (!l.startsWith("[forge]")) continue;
    const depois = k => l.slice(l.indexOf(k) + k.length).trim();
    if (l.includes("target-health-display v")) r.vidaCarregou = true;
    else if (l.includes("attack-damage-display v")) r.danoCarregou = true;
    else if (l.includes("mhgu-target-health-display: main+")) r.vidaIncompat = true;
    else if (l.includes("mhgu-attack-damage-display: main+")) r.danoIncompat = true;
    else if (l.includes("diag vida: tela informada")) r.telaVida = depois("diag vida:");
    else if (l.includes("diag vida: ImGui")) r.imguiVida = depois("diag vida:");
    else if (l.includes("diag vida:") && !l.includes("slot do alvo")) {
      r.vida = depois("diag vida:");
      if (r.vida.includes("desenhando")) r.desenhou = true;
      if (r.vida.includes("nenhum monstro")) r.semAlvo = true;
    } else if (l.includes("diag dano:")) r.dano = depois("diag dano:");
  }
  return r;
}

module.exports = { ler };
