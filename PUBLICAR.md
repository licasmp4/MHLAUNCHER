# Como publicar uma versão nova

O launcher procura o último **Release** deste repositório toda vez que abre. Se a versão for maior que a dele,
aparece o aviso **"Nova versão do launcher"** no Início, com o botão **Atualizar launcher**. Depois de atualizar,
ele mostra o texto do Release como **Novidades**.

## Passo a passo

1. Em `launcher/Launcher.cs`, aumente a versão:

   ```csharp
   public const string VERSAO = "2.2.0";
   ```

2. Rode `build.bat`.
3. No GitHub: **Releases → Draft a new release**.
   - **Tag**: `v2.2.0` (o mesmo número, com `v` na frente).
   - **Título**: `MHGU Launcher v2.2.0`.
   - **Descrição**: as novidades, uma por linha começando com `-`. A primeira linha aparece no aviso do launcher.
   - **Arquivos**: anexe `dist\MHGU Launcher.exe` (obrigatório: é ele que o launcher baixa).
     Com correções no port, anexe também o `mhgurecomp-0.9.11-licas1.exe` (veja `port/LEIA-ME.md`):
     o launcher aplica sozinho em quem estiver no port oficial 0.9.11.
     Para quem vai instalar do zero, anexe também o `Novo MHGU.zip`.
4. **Publish release**. Pronto: quem abrir o launcher já recebe o aviso.

## Regras

- A tag precisa ser uma versão (`v2.2.0`, `v2.10.1`). O launcher compara números, então `v2.10.0` é maior que `v2.9.0`.
- O `.exe` anexado precisa ter `Launcher` no nome.
- Não marque como *pre-release*: o launcher só olha o último release normal.
- Nunca anexe arquivos do jogo, `prod.keys` ou saves.
