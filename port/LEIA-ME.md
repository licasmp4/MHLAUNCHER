# Correções no port (MHGURecomp)

Consertos feitos em cima do código aberto do [MHGURecomp](https://github.com/morerokk/MHGURecomp) (licença MIT).
O launcher aplica sozinho: ele baixa o `mhgurecomp-<versão>-licasN.exe` do último Release deste repositório e
troca o `mhgurecomp.exe` do port oficial da mesma versão. O `mhgugame.dll` (código do jogo) continua sendo o do
release oficial: os dois são compilados com o mesmo identificador, então funcionam juntos.

## licas1 (sobre a 0.9.11)

- **Monstros pequenos morrendo só para um jogador.** Com `SyncSmallMonsters = On`, o jogo de quem comanda os
  monstros pequenos da área descartava todas as mensagens deles vindas dos outros jogadores, inclusive as de
  status e morte (tipo 4 e outros), que o jogo original sempre troca. Um Jaggi morto pelo amigo continuava vivo
  para o anfitrião. Agora só as mensagens de movimento (tipos 1 e 2) são filtradas.

## Compilar

Siga o "Building from source" do README do MHGURecomp e, antes do `make`:

```bash
git checkout 0.9.11
git apply caminho/para/correcoes-0.9.11.patch
```

Publique `build/mhgurecomp.exe` com o nome `mhgurecomp-0.9.11-licas1.exe` (aumente o número a cada correção nova).
