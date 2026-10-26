// Placa de vídeo, monitor, IPs e firewall. Windows e Linux.
const os = require("os"), fs = require("fs");
const { execFile } = require("child_process");
const { screen } = require("electron");
const WIN = process.platform === "win32";

const rodar = (cmd, args) => new Promise(res => execFile(cmd, args, { windowsHide: true, maxBuffer: 8 << 20 }, (e, out) => res(String(out || ""))));

// nome e memória da placa de vídeo (no Windows o registro tem o valor real; o WMI corta em 4 GB)
async function placa() {
  if (WIN) {
    const out = await rodar("reg", ["query", "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}", "/s"]);
    let melhor = null, nome = null;
    for (const linha of out.split(/\r?\n/)) {
      let m = linha.match(/^\s*DriverDesc\s+REG_SZ\s+(.+)$/); if (m) nome = m[1].trim();
      m = linha.match(/^\s*HardwareInformation\.qwMemorySize\s+REG_(?:QWORD|BINARY)\s+(\S+)/);
      if (m && nome) {
        const v = m[1].startsWith("0x") ? Number(BigInt(m[1])) : Number(BigInt("0x" + (m[1].match(/../g) || []).reverse().join("")));
        if (!melhor || v > melhor.vram) melhor = { nome, vram: v };
      }
    }
    return melhor;
  }
  const nv = await rodar("nvidia-smi", ["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"]);
  if (nv.trim()) { const [n, mb] = nv.split(/\r?\n/)[0].split(","); return { nome: n.trim(), vram: +mb * 1048576 }; }
  const pci = await rodar("lspci", []);
  const l = pci.split(/\r?\n/).find(x => /VGA|3D controller/i.test(x));
  let vram = 0;
  try { for (const c of fs.readdirSync("/sys/class/drm")) { const f = "/sys/class/drm/" + c + "/device/mem_info_vram_total"; if (fs.existsSync(f)) vram = Math.max(vram, +fs.readFileSync(f, "utf8")); } } catch {}
  return l ? { nome: l.replace(/^.*?:\s*/, "").replace(/\(rev.*\)$/, "").trim(), vram } : null;
}

function recomendar(p) {
  if (!p) return null;
  const n = p.nome.toUpperCase(), gb = p.vram / 1073741824;
  const dedicada = /GEFORCE|RTX|GTX|RADEON RX|ARC /.test(n), forte = /RTX/.test(n) || /RX\s?[6-9]\d{3}/.test(n) || /ARC B|ARC A7/.test(n);
  return dedicada && forte && gb >= 6 ? "Ultra" : dedicada && gb >= 3 ? "Equilibrado" : "Leve";
}

function monitor() {
  const d = screen.getPrimaryDisplay();
  return { largura: Math.round(d.size.width * d.scaleFactor), altura: Math.round(d.size.height * d.scaleFactor), hz: Math.round(d.displayFrequency || 60) };
}

// os IPs desta máquina (VPNs reconhecidas pelo nome ou pela faixa)
function ips() {
  const r = [];
  for (const [nome, lista] of Object.entries(os.networkInterfaces())) {
    for (const a of lista || []) {
      if (a.family !== "IPv4" || a.internal || a.address.startsWith("169.254.")) continue;
      const n = nome.toLowerCase(); let tipo;
      if (a.address.startsWith("26.") || n.includes("radmin")) tipo = "Radmin VPN · recomendado, sem abrir porta";
      else if (n.includes("zerotier") || n.startsWith("zt")) tipo = "ZeroTier";
      else if (n.includes("hamachi") || a.address.startsWith("25.")) tipo = "Hamachi";
      else if (n.includes("tailscale") || a.address.startsWith("100.")) tipo = "Tailscale";
      else if (/vethernet|virtualbox|vmware|docker|br-|virbr/.test(n)) continue;
      else tipo = "Rede local · mesma casa ou Wi-Fi";
      r.push({ ip: a.address, tipo });
    }
  }
  return r;
}

// firewall: no Windows uma regra "MHGURecomp" para o jogo e as portas; no Linux, o ufw (se estiver ligado)
async function firewall(porta, exe) {
  if (WIN) {
    const out = await rodar("netsh", ["advfirewall", "firewall", "show", "rule", "name=MHGURecomp"]);
    return { liberado: out.includes("MHGURecomp") && out.includes(String(porta)) && out.includes(String(porta + 1)), pode: true };
  }
  const out = await rodar("ufw", ["status"]);
  if (!/Status:\s*active/i.test(out)) return { liberado: true, pode: false, aviso: "Firewall do Linux (ufw) desligado: nada a liberar." };
  return { liberado: out.includes(String(porta)) && out.includes(String(porta + 1)), pode: true };
}

function liberarFirewall(porta, exe) {
  if (WIN) {
    const cmd = `netsh advfirewall firewall delete rule name="MHGURecomp" & netsh advfirewall firewall add rule name="MHGURecomp" dir=in action=allow program="${exe}" enable=yes & netsh advfirewall firewall add rule name="MHGURecomp" dir=in action=allow protocol=TCP localport=${porta} & netsh advfirewall firewall add rule name="MHGURecomp" dir=in action=allow protocol=UDP localport=${porta},${porta + 1}`;
    return rodar("powershell", ["-NoProfile", "-Command", `Start-Process cmd -ArgumentList '/c ${cmd.replace(/'/g, "''")}' -Verb RunAs -WindowStyle Hidden -Wait`]);
  }
  return rodar("pkexec", ["sh", "-c", `ufw allow ${porta}/tcp && ufw allow ${porta}:${porta + 1}/udp`]);
}

module.exports = { placa, recomendar, monitor, ips, firewall, liberarFirewall };
