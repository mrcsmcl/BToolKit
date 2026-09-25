# Contribuindo com o BToolKit

Este documento é o guia para adicionar funcionalidade ao projeto. Ele foi escrito para ser
suficiente por si só: quem chegar aqui — pessoa ou IA — deve conseguir entregar uma
ferramenta nova sem precisar reconstruir o raciocínio das decisões já tomadas.

A parte visual tem documento próprio, em [UI.md](UI.md). **Os dois são obrigatórios**: este
define o que construir e como ligar as peças; o outro define como a coisa aparece na tela.

---

## 1. O que é o projeto

Um kit de ferramentas para Windows, em Electron. Cada ferramenta é independente e aparece
no menu lateral. A ideia é acumular utilidades ao longo do tempo sem que uma atrapalhe a
outra.

O app se atualiza sozinho a partir dos releases do GitHub, sem assistente de instalação.

**São dois produtos com o mesmo código de ferramenta:** o aplicativo Electron e um site no
GitHub Pages. O site serve para baixar o app e também executa, ali mesmo no navegador, as
ferramentas que não precisam do sistema operacional. Quem decide o que roda onde é o campo
`runtime` do registro — ver §4.3.

---

## 2. Começando

Requisitos: Node 22 ou superior e Git no PATH.

```bash
npm install
npm run dev
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o app com recarga automática |
| `npm run typecheck` | Checagem de tipos dos três processos |
| `npm run build` | `typecheck` + bundle (não empacota) |
| `npm run start` | Roda o bundle de produção, sem empacotar |
| `npm run historico` | Gera `.generated/historico.json` (ver §6.2) |
| `npm run build:win` | `build` + `historico` + instalador local (ver §10) |
| `npm run dev:site` | Sobe o site com recarga automática |
| `npm run build:site` | `typecheck` + guarda de runtime + site em `dist-web/` |
| `npm run preview:site` | Serve `dist-web/` como o Pages serviria |
| `npm run checar:runtime` | Confere se ferramenta universal não usa `window.api` |

---

## 3. Mapa do repositório

```
.github/workflows/   CI: versão, tag, release
.generated/          saída do npm run historico — ignorada pelo git
dist-web/            saída do npm run build:site — ignorada pelo git
docs/                CONTRIBUTING.md, UI.md e ui-concepts/ (estudo visual, não é código)
resources/           icon.png e icon.ico do app
scripts/             utilitários de build
semantic-review/     relatórios de revisão gerados por ferramenta; não são fonte de verdade
src/                 código
```

### Os três processos

Electron tem três processos e a separação entre eles é a decisão estrutural mais importante
do projeto. Respeitar essa divisão é o que permitiu reescrever a interface inteira sem tocar
na lógica.

```
src/
├── main/                processo principal — Node completo, acesso ao sistema
│   ├── index.ts         ciclo de vida da janela, instância única
│   ├── app.ts           URLs do repositório e do site, histórico, avatares
│   ├── historico.ts     changelog: git local em dev, snapshot no pacote
│   ├── updater.ts       atualização automática
│   └── repos/           ferramenta "Repositórios" (lógica)
├── preload/
│   └── index.ts         a ponte: a ÚNICA superfície que a tela enxerga
├── renderer/            processo de interface — React, sem acesso ao sistema
│   └── src/
│       ├── App.tsx      casca dos DOIS produtos: barra de título, rail, roteamento
│       ├── ambiente.tsx contexto que diz se está no app ou no site
│       ├── components/  Inicio, Historico, UpdateBanner, Icone, ui (primitivos)
│       ├── hooks/       hooks compartilhados
│       ├── tokens.css   paleta, keyframes, reset — compartilhado com o site
│       ├── componentes.css  camada ui-: botão, campo, rótulo, selo, vazio
│       ├── index.css    classes da casca do app (ver UI.md)
│       └── tools/       uma ferramenta por arquivo + registry.ts
├── web/                 entrada do site — NÃO tem casca própria
│   ├── App.tsx          provê o ambiente e renderiza a mesma casca do app
│   ├── api-ausente.ts   Proxy que explica a falta de window.api no navegador
│   ├── download.ts      consulta o release mais recente
│   └── web.css          importa o index.css e acrescenta o pouco que é do site
└── shared/              tipos usados pelos dois lados
    ├── app.ts           histórico e avatares
    ├── repos.ts         ferramenta Repositórios
    └── updater.ts       estados do updater
```

**A regra que sustenta tudo:** o renderer não tem Node. Nada de `fs`, `child_process`,
`path`, `shell` ou `fetch` para fora na tela. Tudo que toca o sistema operacional ou a rede
vive em `src/main/` e é exposto por um canal IPC nomeado. Se você se pegar querendo importar
um módulo do Node dentro de `src/renderer/`, o desenho está errado.

---

## 4. Adicionando uma ferramenta

### 4.1 Ferramenta que só precisa de interface

Exemplo: um formatador de JSON, um gerador de senha, uma calculadora. Não toca em arquivo,
rede nem processo.

**Passo 1** — crie o componente em `src/renderer/src/tools/MinhaFerramenta.tsx`:

```tsx
import { useState, type ReactNode } from 'react'

export default function MinhaFerramenta(): ReactNode {
  const [valor, setValor] = useState('')
  return <div className="flex h-full flex-col gap-4">{/* ... */}</div>
}
```

**Passo 2** — exporte o ícone em `src/renderer/src/components/Icone.tsx` e registre em
`src/renderer/src/tools/registry.ts`:

```ts
import { lazy } from 'react'
import { faWandMagicSparkles } from '../components/Icone'

export const tools: Tool[] = [
  // ...
  {
    id: 'minha-ferramenta',
    name: 'Minha Ferramenta',
    description: 'Uma frase dizendo o que ela faz.',
    group: 'Utilidades',
    glyph: faWandMagicSparkles,
    runtime: 'universal',
    Component: lazy(() => import('./MinhaFerramenta'))
  }
]
```

O `lazy` não é preferência de estilo: é o que mantém o código de ferramenta `desktop` fora
do que o navegador baixa. Import direto no registro arrasta tudo para o bundle inicial.

Acabou. Menu, busca, agrupamento, tela inicial e roteamento são todos gerados a partir desse
array — não existe arquivo de rotas para editar.

O contrato do registro está em [`tools/types.ts`](../src/renderer/src/tools/types.ts):

| Campo | Tipo | Para que serve |
| --- | --- | --- |
| `id` | `string` | Chave única, em kebab-case. Não reutilize. |
| `name` | `string` | Rótulo no menu e título da página. Curto. |
| `description` | `string` | Uma frase. Aparece na tela inicial e alimenta a busca. |
| `group` | `string` | Cabeçalho no menu. Reaproveite um existente quando fizer sentido. |
| `glyph` | `IconDefinition` | Ícone Font Awesome **importado por referência**, nunca o nome em string. |
| `runtime` | `'universal' \| 'desktop'` | Onde a ferramenta consegue rodar. Obrigatório — ver §4.3. |
| `Component` | `LazyExoticComponent` | `lazy(() => import('./MinhaFerramenta'))`, nunca o import direto. |

Ícones são registrados num ponto só, [`components/Icone.tsx`](../src/renderer/src/components/Icone.tsx),
que reexporta cada `faX` usado. Importar por referência é o que mantém o tree-shaking
funcionando — ver [UI.md §8](UI.md#8-iconografia).

O componente recebe uma área com altura definida e deve se virar dentro dela. Use `h-full`
e `min-h-0` nos contêineres que precisam rolar.

**O CSS da ferramenta mora junto dela**, não no `index.css`:

```
tools/MinhaFerramenta.tsx          →  import './minha-ferramenta/minha-ferramenta.css'
tools/minha-ferramenta/minha-ferramenta.css
```

O `index.css` é a casca do **app** e o site não o carrega. Regra escrita depois de a
ferramenta Documentos aparecer sem estilo nenhum no site, por estar lá dentro. Como bônus,
o CSS acompanha o chunk da ferramenta e também vira carregamento sob demanda.

O que é comum aos dois produtos — paleta, keyframes, reset — vive em `tokens.css`.

### 4.2 Ferramenta que precisa do sistema operacional

Exemplo: ler pastas, rodar um executável, chamar uma API, abrir um arquivo. Aqui a
ferramenta atravessa os três processos. Use `src/main/repos/` como referência viva — é uma
implementação completa desse padrão.

**Passo 1 — tipos compartilhados** em `src/shared/minha-ferramenta.ts`.

Só tipos, sem lógica e sem import de `electron` ou do Node. Os dois lados importam daqui, e
é isso que garante que a tela e o processo principal não desandem um do outro.

Para resultado que pode falhar, prefira união discriminada a exceção — o renderer precisa
distinguir os casos para escolher a mensagem. `HistoricoResult` em
[`shared/app.ts`](../src/shared/app.ts) é o modelo:

```ts
export type MeuResultado =
  | { ok: true; itens: Item[] }
  | { ok: false; codigo: 'sem-permissao' | 'nao-encontrado'; mensagem: string }
```

**Passo 2 — a lógica** em `src/main/minha-ferramenta/`.

Divida em arquivos pequenos e com responsabilidade única. Em `repos/` a divisão ficou:
`runner.ts` (executa o processo externo), `scanner.ts` (varre o disco), `operations.ts` (as
operações de negócio), `index.ts` (registro dos canais).

Funções longas devem aceitar um `AbortSignal` e respeitá-lo — sem isso o botão de cancelar
da interface é decorativo.

**Passo 3 — os canais IPC** em `src/main/minha-ferramenta/index.ts`:

```ts
import { ipcMain } from 'electron'

export function setupMinhaFerramenta(): void {
  ipcMain.handle('minha-ferramenta:listar', (_e, raiz: unknown) => listar(raiz))
}
```

Prefixe **todo** canal com o nome da ferramenta e um dois-pontos. Sem prefixo, dois módulos
colidem em silêncio e o erro só aparece em produção.

**Passo 4 — registre no processo principal**, em `src/main/index.ts`, dentro do
`app.whenReady()`:

```ts
setupUpdater()
setupApp()
setupRepos()
setupMinhaFerramenta()   // <—
```

**Passo 5 — exponha no preload**, em `src/preload/index.ts`:

```ts
const api = {
  // ...
  minhaFerramenta: {
    listar: (raiz: string): Promise<MeuResultado> =>
      ipcRenderer.invoke('minha-ferramenta:listar', raiz)
  }
}
```

O tipo da API é inferido daqui e chega na tela por `src/preload/index.d.ts`. Você não
precisa declarar nada à mão: `window.api.minhaFerramenta.listar` já vem tipado.

**Passo 6 — a tela**, como em §4.1, consumindo `window.api.minhaFerramenta` e seguindo
[UI.md](UI.md).

### 4.3 Escolhendo o runtime

Todo item do registro declara onde consegue rodar. Não existe valor padrão: o typecheck
obriga a decisão, porque herdar o default errado é exatamente o tipo de engano que só
aparece em produção.

| Valor | Quando | Onde aparece |
| --- | --- | --- |
| `universal` | Só precisa do navegador: cálculo, texto, formatação | Site **e** app |
| `desktop` | Usa `window.api` — disco, processo, rede pelo main | Só no app |

No site, ferramenta `desktop` continua no catálogo, mas como cartão com o selo "Requer o
app" e um botão de download. Ela nunca é montada, e o chunk dela nunca é baixado.

**Duas coisas que a escolha implica.**

*Não dá para ser universal e usar a ponte.* No navegador `window.api` não existe. A
declaração de tipo vale para a árvore inteira, então o TypeScript **não** pega o engano —
quem pega é `npm run checar:runtime`, que segue os imports da ferramenta e recusa
`window.api` em qualquer arquivo alcançável a partir de um componente universal. O script
roda dentro do `build:site`, e o entry do site ainda instala um `window.api` falso que
lança mensagem explicativa, caso algo escape.

*`universal` é decisão de exposição, não só técnica.* O site é público. Uma ferramenta
marcada assim fica ao alcance de qualquer pessoa na internet, indexável. Cálculo de dígito
verificador não tem problema nenhum; qualquer coisa que toque regra, dado ou nomenclatura
interna da empresa deve ficar `desktop`, mesmo que tecnicamente rodasse no navegador.

### 4.4 Eventos contínuos (progresso, log, fluxo)

`invoke`/`handle` serve para pergunta e resposta. Para progresso durante uma operação longa,
o processo principal empurra eventos e o preload devolve uma função de cancelamento:

```ts
// main
for (const win of BrowserWindow.getAllWindows()) {
  win.webContents.send('minha-ferramenta:progresso', carga)
}

// preload
onProgresso: (cb: (p: Carga) => void): (() => void) => {
  const listener = (_e: unknown, p: Carga): void => cb(p)
  ipcRenderer.on('minha-ferramenta:progresso', listener)
  return () => ipcRenderer.off('minha-ferramenta:progresso', listener)
}
```

Sempre devolva a função de remoção e sempre a use no `return` do `useEffect`. Sem isso o
listener acumula a cada remontagem do componente.

A tela mostra **o que o evento disse que aconteceu**, não o que ela supõe estar acontecendo.
O painel de atividade de Repositórios lista conclusões reais recebidas por `onProgresso`;
ele não inventa qual repositório "começou" a executar.

### 4.5 Preferências da ferramenta

Grave em `app.getPath('userData')`, um arquivo JSON por ferramenta. Veja `carregarConfig` /
`salvarConfig` em `src/main/repos/index.ts`. Falha ao salvar preferência não deve interromper
o usuário — registre no log e siga.

---

## 5. Regras do contrato IPC

Estas não são preferências de estilo. O renderer executa conteúdo que pode ser manipulado; o
processo principal tem a máquina inteira na mão.

### 5.1 Superfície

1. **Nada de handler genérico.** `executar(comando)`, `abrirUrl(url)`, `lerArquivo(caminho)`
   entregam o sistema para quem controlar a tela. O handler deve ser específico:
   `app:abrir-repositorio` não aceita parâmetro nenhum — a tela pede a ação, o processo
   principal decide o endereço, a partir do campo `repository` do `package.json`.
2. **Valide no main.** Todo argumento vindo do renderer é entrada não confiável, mesmo que a
   tela seja sua. Tipe o parâmetro como `unknown` e valide a forma antes de usar. Modelo:
   `carregarAvatarContribuidor` rejeita qualquer coisa que não case com
   `/^[0-9a-f]{40}$/i` antes de montar uma URL com o valor.
3. **Não desligue `contextIsolation`.** A ponte é o `contextBridge`, e só.
4. **Uma execução por vez, cancelável.** Operações longas guardam seu `AbortController`, e a
   nova execução cancela a anterior em vez de disputar o mesmo recurso.
5. **Não exponha objeto do Electron pelo bridge.** Passe dados simples, serializáveis.

### 5.2 Acesso à rede

O processo principal tem rede irrestrita, e a tela não deveria conseguir apontá-la para
onde quiser. Toda requisição de saída segue estas regras — a busca de avatares em
[`main/historico.ts`](../src/main/historico.ts) é a implementação de referência:

1. **O destino é decidido no main.** A tela nunca passa URL. No máximo passa um
   identificador validado, e o main monta o endereço.
2. **Valide o host da resposta.** Uma API pode devolver URL para qualquer lugar. O avatar só
   é baixado se o host for exatamente `avatars.githubusercontent.com` e o protocolo `https:`.
3. **Sempre com timeout.** `AbortSignal.timeout(8_000)`. Requisição sem prazo trava o
   recurso para sempre.
4. **Limite o tamanho e confira o tipo.** O avatar é recusado acima de 1 MB e se o
   `content-type` não começar com `image/`.
5. **Falha de rede é resultado, não exceção.** Devolva `{ ok: false }` e deixe a tela seguir
   sem aquele dado. Recurso enfeite nunca derruba a tela.
6. **Cache em memória, não em disco.** Dado de terceiro buscado em runtime fica na sessão. Se
   precisar persistir, isso vira uma decisão de privacidade e tem que ser dita ao usuário.
7. **Nada de rede no renderer.** A CSP é `default-src 'self'`; a tela não alcança a rede nem
   por acidente, e é assim que deve continuar.

---

## 6. Subsistemas existentes

Referência rápida de como cada parte já resolvida funciona, para não reinventar nem quebrar.

### 6.1 Atualização automática

`src/main/updater.ts`. Baixa sozinho (`autoDownload`), instala ao fechar
(`autoInstallOnAppQuit`) e, quando o download termina, conta 10 s e reinicia. O instalador é
`oneClick`, o que faz a instalação rodar sem assistente.

Duas coisas que mordem quem mexe aqui:

- `checkForUpdates()` **sai na hora** quando `app.isPackaged` é falso. O estado `checking`
  nunca chega ao renderer em `npm run dev`. Feedback de interface deve ser comandado pelo
  clique, não por esse estado.
- Uma consulta real às vezes responde em ~120 ms. Sem tempo mínimo visível, o indicador
  aparece e some antes de ser percebido — daí o piso de 900 ms em `App.tsx`.

### 6.2 Histórico e changelog

`src/main/historico.ts` alimenta a tela de Changelog, e tem duas origens:

| Contexto | Origem | Por quê |
| --- | --- | --- |
| `npm run dev` | `git log` do próprio repositório | dado sempre fresco |
| App instalado | `resources/historico.json` | o app instalado não é um repositório git |

O snapshot é gerado por `npm run historico` (script em `scripts/gerar-historico.mjs`), cai em
`.generated/historico.json` — ignorado pelo git — e é copiado pelo `extraResources` do
electron-builder. Os scripts `build:win` e `release` já chamam `historico` antes de empacotar;
`npm run build` **não** chama, de propósito, para o build comum não depender de git.

Por isso o job de build no CI usa `fetch-depth: 0`: com o checkout raso padrão só viria um
commit, e o changelog do instalador sairia vazio.

O resultado é cacheado por sessão. Reiniciar o app é o que recarrega.

### 6.3 Repositórios

`src/main/repos/`. Operações em lote sobre repositórios git, com paralelismo 4 e timeout de
120 s por comando. Nada escreve no remoto: as únicas escritas são locais (`stash`,
`checkout`, `merge --ff-only`).

Uma invariante que não pode ser quebrada: **o stash só acontece depois de confirmar que a
branch existe.** Um repositório que não vai trocar de branch não pode ter as alterações
guardadas. E todo desfecho passa por `comporMensagem`, para que um aviso de stash nunca fique
de fora da mensagem — inclusive quando o repositório é pulado.

---

### 6.4 O site

O site **não tem casca própria**. Ele monta a mesma `App.tsx` do aplicativo — mesma rail,
mesmo Início, mesmo roteamento — e só informa onde está rodando:

```tsx
<AmbienteProvider valor={{ tipo: 'site', download, urlRepositorio }}>
  <AppShell />
</AmbienteProvider>
```

`src/web/App.tsx` tem 29 linhas e nenhuma decisão de interface. Foi uma reescrita: a
primeira versão tinha landing própria, catálogo próprio e navegação própria, o que
duplicava conceito e ia divergir do app na primeira mudança.

**Onde os dois divergem** — os únicos pontos que consultam `useAmbiente()`:

| Ponto | App | Site |
| --- | --- | --- |
| Faixa do topo | área de arrastar a janela | botão "Baixar para Windows" |
| Banner de atualização | aparece | não existe |
| Versão no rodapé | `window.api.updater` | release consultado na API |
| Botão do GitHub | abre o Changelog | abre o repositório |
| Botão de atualizar | verifica atualização | baixa o app |
| Ferramenta `desktop` | abre normalmente | cadeado na rail e painel `RequerApp` |

Acrescentar divergência exige passar por essa tabela. Se a lista começar a crescer, é
sinal de que a casca está virando duas — melhor rever do que continuar remendando.

Build por `vite.config.web.ts`, saída em `dist-web/`, publicação por
[pages.yml](../.github/workflows/pages.yml) a cada push na `main`. `base` é `/BToolKit/`
porque project page mora num subcaminho; passe `BASE_SITE` para mudar.

**O botão de download não tem link fixo.** O nome do instalador carrega a versão
(`BToolKit-0.1.4-setup.exe`), então `download.ts` consulta a API pública do GitHub para
montar o link direto e mostrar versão, tamanho e data. Em qualquer falha — rede fora,
limite de requisições, release sem `.exe` — cai para `/releases/latest`. Por isso o site
**não** precisa ser republicado a cada release.


## 7. Convenções de código

- **TypeScript estrito.** Sem `any`. Anote o retorno de funções exportadas.
- **Idioma.** Comentários e textos de interface em português. Nos identificadores o código
  mistura os dois de propósito: termos que são nome próprio do domínio ficam em inglês
  (`checkout`, `refresh`, `RepoInfo`, `Tool`), o resto em português (`carregarConfig`,
  `executarEmLote`). Siga o que estiver ao redor.
- **Comentário explica o porquê, não o quê.** O código já diz o que faz. O comentário serve
  para a decisão que não é óbvia — por que o stash só acontece depois de confirmar a branch,
  por que o giro do botão tem tempo mínimo. Comentário que narra a linha seguinte é ruído.
- **Estilo:** antes de escrever CSS, veja se o primitivo já existe. Botão, campo, rótulo,
  selo e estado vazio vivem na camada `ui-` e são compartilhados — ver
  [UI.md §3.6](UI.md#36-onde-o-estilo-mora) e [§6](UI.md#6-componentes-base). Reescrever um
  deles é como as medidas divergem.
- **Sem dependência nova sem necessidade real.** O app já é grande por ser Electron; o que
  entra tem que se pagar. Biblioteca usada só pelo renderer vai em `devDependencies` — o Vite
  a empacota no bundle, e deixá-la em `dependencies` faz o electron-builder copiá-la de novo
  para dentro do `asar`.

---

## 8. Verificando o que você fez

`npm run typecheck` e `npm run build` são o mínimo, não a verificação. Eles provam que
compila, não que funciona.

### 8.1 Lógica do processo principal, sem abrir janela

Os módulos de `src/main/<ferramenta>/` que não importam `electron` rodam em Node puro.
Escreva um arquivo temporário na raiz e empacote com o esbuild que já está instalado:

```ts
// teste.ts — apagar depois
import { minhaFuncao } from './src/main/minha-ferramenta/logica'

async function main(): Promise<void> {
  console.log(await minhaFuncao('C:\\algum\\caminho'))
}
void main()
```

```bash
npx esbuild teste.ts --bundle --platform=node --format=cjs --outfile=teste.cjs && node teste.cjs
```

### 8.2 Interface, sem mexer no mouse do sistema

Não dirija a interface clicando por coordenada de tela: o clique erra a janela e vai parar em
outro aplicativo do usuário. Carregue o renderer já buildado dentro do Electron, com handlers
de IPC falsos, e comande a tela por dentro:

```js
// teste-ui.cjs — apagar depois. Rode: npm run build && npx electron teste-ui.cjs
const { app, BrowserWindow, ipcMain } = require('electron')
const { join } = require('node:path')

ipcMain.handle('updater:get-status', () => ({ state: 'idle' }))
// ... um handler falso para cada canal que a tela chama ao montar

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { preload: join(__dirname, 'out/preload/index.js'), sandbox: false }
  })
  await win.loadFile(join(__dirname, 'out/renderer/index.html'))
  await new Promise((r) => setTimeout(r, 1200))

  console.log(
    await win.webContents.executeJavaScript(`
      (() => {
        const b = document.querySelector('[aria-label="Meu botão"]')
        b.click()
        return { texto: b.textContent, animacao: getComputedStyle(b.querySelector('svg')).animationName }
      })()
    `)
  )
  app.exit(0)
})
```

Isso lê o DOM e o CSS computado de verdade, prova que o comportamento existe, e não toca em
nada fora do app. Apague o arquivo quando terminar.

### 8.3 Antes de abrir o PR

- [ ] `npm run typecheck` passa (cobre app, renderer e site)
- [ ] `npm run build` passa
- [ ] `npm run build:site` passa, se mexeu em ferramenta ou registro
- [ ] A ferramenta foi exercitada de fato, não só compilada
- [ ] Operação longa pode ser cancelada e o cancelamento aparece na tela
- [ ] Erro previsível vira mensagem legível, não exceção silenciosa
- [ ] Nenhum handler IPC genérico foi introduzido
- [ ] Requisição de saída, se houver, segue §5.2
- [ ] O checklist de [UI.md §12](UI.md#12-checklist-de-revisão) passa
- [ ] Ferramenta universal foi aberta no site (`npm run preview:site`), não só no app
- [ ] Arquivos temporários de teste removidos

---

## 9. Versão e release

O CI cuida disso; você só escolhe o prefixo da mensagem de commit.

| Prefixo da mensagem | Efeito na versão |
| --- | --- |
| `feat:` | minor — 0.1.0 → 0.2.0 |
| `tipo!:` ou corpo com `BREAKING CHANGE` | major — 0.1.0 → 1.0.0 |
| qualquer outro (`chore:`, `fix:`, `docs:`) | patch — 0.1.0 → 0.1.1 |

Ao entrar na `main`, o [workflow](../.github/workflows/release.yml) sobe a versão, cria a tag
anotada, abre um release rascunho, builda o instalador Windows e só então tira o rascunho — o
`electron-updater` ignora rascunhos, então ninguém baixa um release pela metade.

**O bump lê apenas o último commit da `main`.** Empurrar um `feat:` junto com um `chore:`
depois dele resulta em patch. Se a ordem importa para você, empurre em levas separadas.

O site é publicado por um fluxo próprio, também a cada push na `main`. Os dois convivem: o
commit de versão do release traz `[skip ci]`, então não dispara nova publicação.

Commits e descrições de PR vão **sem linha de atribuição** de ferramenta de IA.

---

## 10. Armadilhas conhecidas

**O instalador não empacota nesta máquina.** No Windows sem Modo de Desenvolvedor, o
electron-builder falha ao extrair o pacote `winCodeSign` porque não consegue criar links
simbólicos:

```
ERROR: Cannot create symbolic link : O cliente não tem o privilégio necessário.
```

O bundle é gerado, mas o instalador não, e o ícone não é gravado no `.exe` (o `rcedit` vive
nesse mesmo pacote). Solução: habilitar o Modo de Desenvolvedor do Windows, ou rodar num
terminal como administrador. O CI não sofre disso.

**O app não abre e nada acontece.** Instância única: se sobrou um processo `BToolKit.exe` sem
janela, todo atalho novo sai em silêncio. Encerre pelo Gerenciador de Tarefas. O código tem
rede de proteção para isso em `src/main/index.ts` — a janela aparece por `ready-to-show`,
`did-finish-load`, `did-fail-load` ou um limite de 10 s, o que vier primeiro.

**O updater não funciona em dev.** Ver §6.1.

**O changelog aparece vazio no app instalado.** O snapshot não foi gerado ou não entrou no
pacote. Confira se `npm run historico` rodou antes do `electron-builder` e se o checkout do
CI tem `fetch-depth: 0`.

**Log do app:** `%APPDATA%\BToolKit\logs\main.log`. O processo principal registra a
inicialização, a exibição da janela, falhas de carregamento e erros do console do renderer.
