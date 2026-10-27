// A ponte segura entre a interface e o sistema: só estas funções ficam visíveis para a página.
const { contextBridge, ipcRenderer } = require("electron");
const chama = canal => (...a) => ipcRenderer.invoke(canal, ...a);
const canais = ["estado", "pasta:escolher", "ini:get", "ini:set", "ini:restaurar", "config:get", "config:set", "jogo:aberto", "jogo:abrir", "saves", "saves:importar",
  "presenca:nome", "sistema:placa", "sistema:ips", "sistema:firewall", "sistema:liberar", "sistema:ipPublico", "mods", "mods:ligar", "plugins", "plugins:ligar",
  "layouts", "layouts:trocar", "cheats", "cheats:ligar", "abrir", "externo", "copiar", "amigos", "amigos:salvar", "amigos:consultar", "atualiza:port",
  "atualiza:portAplicar", "atualiza:launcher", "atualiza:correcao", "atualiza:launcherAplicar", "novidades", "diag", "cena:video", "logo", "cache:ler", "cache:salvar", "janela",
  "biblioteca", "biblioteca:procurar", "biblioteca:instalar", "biblioteca:abrir", "biblioteca:abrirPasta", "biblioteca:pasta", "biblioteca:capa"];
const api = {};
for (const c of canais) api[c.replace(/:(\w)/g, (_, l) => l.toUpperCase())] = chama(c);
api.aoNavegar = fn => ipcRenderer.on("nav", (e, p) => fn(p));
api.aoProgresso = fn => ipcRenderer.on("progresso", (e, x) => fn(x));
api.aoJanela = fn => ipcRenderer.on("janela", (e, x) => fn(x));
contextBridge.exposeInMainWorld("mhgu", api);
