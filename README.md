# BToolKit

Kit de ferramentas em Electron para Windows, com auto-atualização a partir dos
GitHub Releases.

## Antes do primeiro release

O repositório precisa ser **público** — o `electron-updater` baixa o release sem token.

No GitHub:

- **Settings → Actions → General → Workflow permissions**: marque *Read and write permissions*.
- Se a `main` tiver branch protection, libere o `github-actions[bot]` no bypass — senão o
  push do commit de versão é recusado e o release não sai.

A versão no `package.json` é `0.0.0` de propósito: o primeiro push na `main` gera a
**v0.0.1**.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Site

O produto também tem uma página no GitHub Pages, com download e as ferramentas que rodam no
navegador. `npm run dev:site` para desenvolver, `npm run build:site` para gerar em
`dist-web/`. Publicada automaticamente a cada push na `main`.

## Documentação

- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — arquitetura, como adicionar uma ferramenta,
  regras do contrato IPC e de acesso à rede, subsistemas existentes, como verificar o
  trabalho e as armadilhas conhecidas do ambiente.
- [docs/UI.md](docs/UI.md) — guia de interface: restrições, tokens, layout, componentes,
  movimento e acessibilidade.

## Adicionar uma ferramenta

1. Crie o componente em `src/renderer/src/tools/MinhaFerramenta.tsx`.
2. Registre uma entrada em `src/renderer/src/tools/registry.ts`.

Nada mais precisa mudar — a barra lateral, a busca e o roteamento são gerados a partir
do registro. O passo a passo completo, inclusive para ferramenta que precisa do sistema
operacional, está no [CONTRIBUTING.md](docs/CONTRIBUTING.md#4-adicionando-uma-ferramenta).

## Como funciona a atualização

1. PR mergeado na `main`.
2. O workflow `.github/workflows/release.yml` sobe a versão no `package.json`, cria a
   tag, faz o push de volta na `main` (com `[skip ci]`, para não gerar loop) e abre um
   release **rascunho**.
3. O build roda no Windows e o `electron-builder` sobe o instalador para esse rascunho,
   junto com o manifesto `latest.yml`.
4. Terminado o build, o último job tira o rascunho. O `electron-updater` ignora
   rascunhos, então ninguém baixa um release pela metade.
5. Ao abrir o app, ele compara a versão instalada com o `latest.yml`, baixa em segundo
   plano e instala ao fechar — com um botão "Reiniciar agora" no banner. Também
   reverifica a cada hora, para quem deixa o app aberto o dia todo.

O nível do bump vem da mensagem do commit de merge: `feat:` → minor,
`BREAKING CHANGE` ou `tipo!:` → major, qualquer outra coisa → patch.

## Testando a atualização de ponta a ponta

1. Faça o primeiro push na `main` e espere o release **v0.0.1** sair do rascunho.
2. Baixe o `BToolKit-0.0.1-setup.exe` do release e instale.
3. Faça qualquer outro merge na `main` (pode ser um ajuste no README) e espere a
   **v0.0.2** publicar.
4. Abra o app instalado: o banner aparece sozinho, baixa, e o botão "Reiniciar agora"
   aplica a atualização.

O updater só roda em build empacotado — em `npm run dev` ele reporta "up-to-date" e não
consulta o GitHub. Se precisar investigar, o log fica em
`%APPDATA%\BToolKit\logs\main.log`.

## Assinatura de código

O instalador Windows não é assinado, então o SmartScreen mostra um aviso nas primeiras
instalações. O auto-update funciona mesmo assim. Para remover o aviso é preciso um
certificado de Code Signing (OV ou EV) em `win.certificateFile` / `CSC_LINK`.
