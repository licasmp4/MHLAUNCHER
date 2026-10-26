// Amigos online sem servidor: cada launcher responde, na porta do jogo + 1 (UDP), quem é e o que está fazendo.
// Pergunta "MHGU?1"; resposta "MHGU!1|nome|versão do port|versão do launcher|sincronia|estado" (L launcher, J jogando,
// H Hub aberto). É o mesmo protocolo do launcher 2.x, então as duas versões se enxergam.
const dgram = require("dgram");

let servidor = null, resposta = "MHGU!1|Caçador|?|?|On|L";

function iniciar(porta) {
  return new Promise(res => {
    try {
      servidor = dgram.createSocket("udp4");
      servidor.on("message", (msg, de) => {
        if (msg.length !== 6 || msg.toString("ascii") !== "MHGU?1") return;  // só a pergunta exata
        const r = Buffer.from(resposta, "utf8");
        servidor.send(r, de.port, de.address);
      });
      servidor.on("error", () => { try { servidor.close(); } catch {} servidor = null; res(false); });
      servidor.bind(porta + 1, () => res(true));
    } catch { res(false); }
  });
}

function definirResposta(r) { resposta = r; }

// pergunta duas vezes e fica com o menor ping (a primeira inclui o preparo do socket)
function consultar(endereco, portaPadrao) {
  let host = endereco, porta = portaPadrao;
  const c = endereco.lastIndexOf(":");
  if (c > 0 && /^\d+$/.test(endereco.slice(c + 1))) { host = endereco.slice(0, c); porta = +endereco.slice(c + 1); }
  return new Promise(res => {
    const st = { online: false, ping: 0 };
    let s; try { s = dgram.createSocket("udp4"); } catch { return res(st); }
    let tentativas = 0, inicio = 0, fim = false;
    const acabar = () => { if (fim) return; fim = true; clearTimeout(t); try { s.close(); } catch {} res(st); };
    const perguntar = () => {
      if (tentativas >= 3 || (st.online && tentativas >= 2)) return acabar();
      tentativas++; inicio = Date.now();
      s.send(Buffer.from("MHGU?1", "ascii"), porta + 1, host, e => { if (e) acabar(); });
    };
    s.on("message", msg => {
      const p = msg.toString("utf8").split("|");
      if (p.length < 6 || p[0] !== "MHGU!1") return;
      const ms = Date.now() - inicio;
      st.ping = st.online ? Math.min(st.ping, ms) : ms; st.online = true;
      Object.assign(st, { nome: p[1], port: p[2], launcher: p[3], sync: p[4], estado: p[5] });
      perguntar();
    });
    s.on("error", acabar);
    const t = setTimeout(acabar, 3800);
    const repete = setInterval(() => { if (fim) return clearInterval(repete); if (!st.online) perguntar(); }, 1200);
    perguntar();
  });
}

function parar() { try { servidor && servidor.close(); } catch {} servidor = null; }

module.exports = { iniciar, definirResposta, consultar, parar, ativo: () => !!servidor };
