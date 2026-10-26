// .ini do port (mhgurecomp.ini): lê e grava sem perder comentários nem a ordem das linhas.
const fs = require("fs");

class Ini {
  constructor(caminho) { this.caminho = caminho; this.ler(); }

  ler() {
    this.linhas = fs.existsSync(this.caminho) ? fs.readFileSync(this.caminho, "utf8").replace(/^﻿/, "").split(/\r?\n/) : [];
  }

  // índice da linha "chave = valor" dentro de [secao] (-1 se não tem) e a última linha da seção
  achar(secao, chave) {
    let atual = null, fim = -1;
    for (let i = 0; i < this.linhas.length; i++) {
      const t = this.linhas[i].trim();
      if (t.startsWith("[") && t.endsWith("]")) { atual = t.slice(1, -1); continue; }
      if (atual !== secao) continue;
      fim = i;
      if (t.startsWith(";")) continue;
      const eq = t.indexOf("=");
      if (eq > 0 && t.slice(0, eq).trim().toLowerCase() === chave.toLowerCase()) return { i, fim };
    }
    return { i: -1, fim };
  }

  get(secao, chave, padrao) {
    const { i } = this.achar(secao, chave);
    if (i < 0) return padrao;
    const t = this.linhas[i];
    return t.slice(t.indexOf("=") + 1).trim();
  }

  set(secao, chave, valor) {
    valor = String(valor);
    const { i, fim } = this.achar(secao, chave);
    const linha = chave + " =" + (valor.length ? " " + valor : "");
    if (i >= 0) this.linhas[i] = linha;
    else if (fim >= 0) this.linhas.splice(fim + 1, 0, linha);
    else this.linhas.push("", "[" + secao + "]", linha);
  }

  salvar() { fs.writeFileSync(this.caminho, this.linhas.join("\r\n"), "utf8"); }
}

module.exports = { Ini };
