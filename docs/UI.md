# Guia de interface do BToolKit

> **Estado: implementado.** A direção atual é a variação 05B — rail compacta expansível,
> com workspace central e atividade operacional à direita.

## 1. Restrições que a interface deve respeitar

### 1.1 Sem origem externa

O `index.html` declara:

```
default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:
```

Nada de CDN, Google Fonts, scripts, ícones ou folhas de estilo remotos. Recursos entram
via npm ou arquivo local e são empacotados pelo Vite.

### 1.2 O registro de ferramentas é o contrato

Navegação, busca, agrupamento e ferramenta ativa saem de
[`tools/registry.ts`](../src/renderer/src/tools/registry.ts), no formato de
[`tools/types.ts`](../src/renderer/src/tools/types.ts): `id`, `name`, `description`,
`group`, `glyph`, `runtime`, `Component`. Adicionar ferramenta não pode exigir uma segunda
declaração em rota, menu ou layout.

O mesmo registro alimenta **duas** cascas: o app e o site. `runtime` diz qual delas executa
a ferramenta — ver [CONTRIBUTING §4.3](CONTRIBUTING.md#43-escolhendo-o-runtime). Uma
ferramenta precisa aguentar as duas molduras: a área útil do app tem altura fixa, a do site
rola com a página.

### 1.3 A tela não fala diretamente com o sistema

Todo acesso passa por `window.api`, definido em [`src/preload/index.ts`](../src/preload/index.ts).
A interface usa somente os grupos `app`, `updater` e `repos`. Assinaturas de `onStatus` e
`onProgresso` devolvem uma função de cancelamento, retornada pelo `useEffect` correspondente.

| Grupo | Métodos |
| --- | --- |
| `api.app` | `urlRepositorio`, `abrirRepositorio`, `historico`, `avatarContribuidor` |
| `api.updater` | `getStatus`, `getVersion`, `check`, `install`, `adiar`, `onStatus` |
| `api.repos` | `versaoGit`, `lerConfig`, `gravarConfig`, `escolherPasta`, `abrirPasta`, `procurar`, `executar`, `cancelar`, `onProgresso` |

Mudança de interface não deveria precisar de canal novo. Se precisar, é sinal de que lógica
está indo para o lado errado da ponte — ver
[CONTRIBUTING §5](CONTRIBUTING.md#5-regras-do-contrato-ipc).

### 1.4 Movimento respeita o sistema

Toda transição e animação é neutralizada em `prefers-reduced-motion: reduce`. Movimento
serve para continuidade espacial e feedback, nunca como requisito para entender estado.

### 1.5 Barra de título própria

A janela usa `titleBarStyle: 'hidden'` e `titleBarOverlay` em
[`src/main/index.ts`](../src/main/index.ts). A faixa de 40 px continua arrastável e não
contém controles interativos. As cores `#0b0d12` e `#8b93a7` permanecem sincronizadas
com fundo e texto de apoio do renderer.

### 1.6 Alvo

Windows 10/11, tela única, mínimo de 860 × 560. A tabela pode rolar horizontalmente; dados
não são removidos silenciosamente para caber na janela mínima.

## 2. Princípios

1. **Conteúdo antes da decoração:** repositórios, estado e andamento são protagonistas.
2. **Densidade legível:** a interface comporta muitos itens sem reduzir texto a ponto de
   prejudicar leitura.
3. **Estado explícito:** sucesso, aviso e falha sempre têm texto, não apenas cor.
4. **Progressão sem surpresa:** ações destrutivas ou que envolvam stash explicam o efeito
   e mantêm uma saída técnica verificável.

A interface evita cartões decorativos, métricas sem ação, gradientes chamativos e
navegação duplicada.

## 3. Tokens

### 3.1 Cor

Os tokens vivem em `@theme` no `index.css`:

| Token | Valor | Uso |
| --- | --- | --- |
| `bg` | `#0b0d12` | fundo da janela e barra de título |
| `surface` | `#101318` | rail, campos e superfícies principais |
| `surface-2` | `#171a20` | hover, seleção e cabeçalhos |
| `border` | `#2a2e35` | separadores e contornos de 1 px |
| `fg` | `#e5e7eb` | texto principal |
| `muted` | `#858d98` | rótulos e informação secundária |
| `accent` | `#dfe3e8` | ação primária e progresso |
| `accent-fg` | `#f3f4f6` | texto sobre superfície de destaque |

Estados usam verde para sucesso, âmbar para aviso e vermelho para falha. Todos aparecem
junto a rótulo ou mensagem. Texto normal busca contraste mínimo WCAG AA (4,5:1).

### 3.2 Tipografia

- Interface: Segoe UI, Inter local se disponível, `system-ui`.
- Caminho, branch e saída: Consolas ou Cascadia Mono.
- Escala principal: 9, 10, 11, 12 e 18 px.
- Pesos: 400 para conteúdo, 600 para ação/título, 700 apenas para rótulos curtos.
- Títulos não usam caixa alta; rótulos de campo podem usar caixa alta com espaçamento.

### 3.3 Espaçamento e raio

A base é 4 px, com uso recorrente de 8, 12, 16 e 18 px. Raios: 6–8 px em controles,
8 px em tabela e nenhum raio em separadores estruturais. Alvos interativos principais têm
pelo menos 32 px de altura; botões somente de ícone têm área mínima de 34 × 32 px.

### 3.4 Elevação

Camadas normais são separadas por borda e mudança sutil de superfície. Sombra só aparece
quando a rail expandida sobrepõe o conteúdo em janela estreita; nesse caso comunica uma
camada temporária, não decoração.

### 3.5 Pontos de quebra

A janela é pequena e única, então não existe grid responsivo genérico. Os cortes abaixo são
os que a interface realmente usa; **reaproveite um deles em vez de inventar um novo**, senão
o layout passa a mudar em larguras que ninguém consegue prever.

| Corte | O que muda |
| --- | --- |
| `max-width: 1099px` | a rail expandida passa a sobrepor o conteúdo |
| `min-width: 900px and max-width: 1099px` | ajustes de densidade da faixa intermediária |
| `max-width: 1000px` | compressão de cabeçalhos e listas |
| `max-width: 899px` | empilhamento de blocos que eram lado a lado |
| `max-width: 760px` | layout de coluna única |
| `max-width: 700px` | último recurso, perto do mínimo da janela |
| `max-height: 620px` | reduz respiro vertical; janela baixa não pode perder ação |

Dentro do workspace de Repositórios a adaptação é por **container query**, não por largura de
janela: `container-name: repos-workspace` com `@container repos-workspace (max-width: 760px)`
e `(max-width: 560px)`. É o certo — o workspace muda de tamanho quando a rail expande, sem a
janela mudar. Prefira container query sempre que o elemento não ocupar a janela inteira.

### 3.6 Onde o estilo mora

Duas formas convivem, e a escolha entre elas não é gosto:

**Utilitário Tailwind no JSX** — para layout e espaçamento locais de um componente, variação
condicional simples, e qualquer coisa que se leia melhor perto da marcação.

**Classe no `index.css`** — para estrutura nomeada da casca e das telas grandes: a rail, o
workspace, a timeline, os cartões da tela inicial. Ganha nome quando o conjunto de regras é
grande, tem estado (`--expanded`, `--active`), responde a breakpoint ou container query, ou
quando repetir os utilitários no JSX tornaria a marcação ilegível.

Convenção de nome: prefixo por área, em kebab-case, com modificador em `--`.

| Prefixo | Área | Arquivo |
| --- | --- | --- |
| `app-` | casca do app: barra de título, rail, scrim, corpo | `index.css` |
| `tool-` | moldura que toda ferramenta usa (hoje, a faixa de título) | `index.css` |
| `home-` | tela inicial | `index.css` |
| `history-` | changelog e contribuidores | `index.css` |
| `site-` | o pouco que só o site tem: botão de download, painel RequerApp | `web/web.css` |
| `repos-` | ferramenta Repositórios | `index.css` |
| `doc-` | ferramenta Documentos | `tools/documentos/documentos.css` |

Uma ferramenta nova usa o próprio prefixo.

**E o CSS dela mora junto dela**, num arquivo importado pelo componente — não no
`index.css`. O `index.css` é a casca do app, e o site não o carrega: ferramenta universal
com estilo lá dentro aparece sem formatação nenhuma no navegador. Foi o que aconteceu com a
Documentos antes de a regra existir. O `repos-` ainda está no `index.css` por ser anterior
a isso; como a ferramenta é `desktop`, não quebra nada, mas o lugar certo é junto dela.

O que os dois produtos compartilham — paleta, keyframes, reset, `prefers-reduced-motion` —
vive em [`tokens.css`](../src/renderer/src/tokens.css), importado pelas duas cascas. **Nenhuma classe cita hexadecimal** — cor vem
sempre de token (`var(--color-surface)` ou a classe Tailwind equivalente). Trocar a paleta
tem que ser uma edição em um lugar só.

## 4. Tema

A implementação atual é escura e fixa. Não há seletor ou persistência de tema. Uma futura
versão clara deve trocar tokens semanticamente e sincronizar o `titleBarOverlay`, sem
hexadecimais dentro dos componentes.

## 5. Layout

- Barra de título: 40 px, fixa no topo.
- Banner de atualização: altura conforme conteúdo, com quebra de linha.
- Rail: 64 px recolhida e 232 px expandida.
- Em largura a partir de 1100 px, a rail expandida ocupa espaço no fluxo.
- Abaixo de 1100 px, continua reservando 64 px e expande sobre o conteúdo com scrim.
- O estado da rail é local e não persistido; expandir não remonta a ferramenta ativa.
- Repositórios: workspace central + painel de atividade de 258 px (228 px em janelas
  estreitas).
- Tabela e painéis de atividade/log têm rolagem independente.
- O log fica na base da atividade; progresso e ações de lote ficam na base do workspace.

### 5.1 As três telas

A rail comanda três destinos, e a casca é a mesma nos três. O caminho atual aparece na barra
de título como `BToolKit / <título>`.

| Destino | Quando | Conteúdo |
| --- | --- | --- |
| **Início** | estado inicial, `activeId === null` | cabeçalho, contagem de ferramentas e um cartão por ferramenta do registro |
| **Ferramenta** | `activeId` casa com um `id` do registro | o componente da ferramenta, em área de altura definida |
| **Changelog** | item próprio da rail (`$historico`) | commits e contribuidores |

Início é gerado inteiramente a partir do registro de ferramentas — acrescentar uma ferramenta
faz um cartão aparecer sozinho. Não exista uma lista paralela.

O identificador do Changelog usa prefixo `$` justamente para não colidir com `id` de
ferramenta. Tela de sistema nova segue o mesmo padrão.

## 6. Componentes base

### Botão

Altura de 32 px. Variantes: primário sólido claro, secundário com borda e perigo textual
vermelho. Desabilitado reduz opacidade e bloqueia ponteiro. Uma tela não deve ter mais de
uma ação primária por grupo operacional.

### Campo de texto

Superfície escura, borda de 1 px, altura de 32 px e foco visível. Caminhos e branches usam
fonte monoespaçada. O rótulo sempre permanece visível acima do campo.

### Campo com sugestões

Branch usa `input` + `datalist`, preservando digitação livre e oferecendo branches locais
ou remotas conhecidas.

### Seletor de pasta

Campo de caminho seguido de botão “Procurar…”. Selecionar pasta não dispara leitura
automática; “Recarregar lista” mantém a confirmação explícita.

### Caixa de seleção

A primeira coluna seleciona repositórios; o cabeçalho seleciona todos. Cada caixa tem
nome acessível. A regra de domínio permanece: nenhuma seleção explícita significa todos.

### Tabela de dados

Cabeçalho fixo, oito colunas e largura mínima interna de 760 px. Em espaço insuficiente há
rolagem horizontal. Linhas mostram outcome com fundo sutil e texto. Clique no nome ou
duplo clique na linha abre a pasta.

### Banner / faixa de aviso

Fica abaixo da barra de título, aceita quebra de linha e usa `role="status"` ou
`role="alert"`. A atualização pronta mantém “Reiniciar agora” e “Agora não”.

### Barra de progresso

Linha de 3 px acompanhada por contagem textual. Nunca é a única indicação de andamento.

### Painel de atividade

Timeline dos resultados efetivamente recebidos por `onProgresso`. Cada evento mostra
horário, repositório, mensagem e outcome. Como o IPC informa conclusão, a interface não
inventa qual repositório começou a executar.

### Painel de log

Saída técnica monoespaçada, limitada a aproximadamente 500 linhas e com rolagem automática.
Mantém detalhes de erro e comandos para recuperar stash.

### Faixa de título da ferramenta

`.tool-header`, definida no `index.css` porque é **moldura**, não conteúdo de uma
ferramenta específica. Altura de `var(--altura-faixa-titulo)`, borda inferior de 1 px,
18 px de recuo lateral. Ocupa a largura inteira da ferramenta, inclusive por cima de
painéis laterais: à esquerda o ícone e o título, à direita o indicador de estado ou a ação
principal.

**A faixa do topo da rail usa a mesma medida, de propósito.** As duas bordas inferiores
ficam na mesma altura e formam uma linha só atravessando a janela. Elas estavam com 52 e
62 px e o desencontro de 10 px era visível. Por isso a altura virou um token em
`tokens.css` — mudar em um lugar move as duas.

Uma ferramenta que não usar `.tool-header` quebra essa continuidade, e é o tipo de coisa
que só se percebe quando já está em produção.

### Cartão de ferramenta (Início)

Um por entrada do registro: ícone, nome, descrição e affordance de avanço. O cartão inteiro é
o alvo de clique, não só o título. A ordem é a do registro — não há ordenação alternativa,
e se um dia houver, o critério entra no `Tool`, não numa lista à parte.

### Timeline de changelog

Lista de commits com marcador, título, corpo opcional, autor, data e hash curto. Paginada,
com controles rotulados por `aria-label`. Um selo indica a origem do dado — “Git local” em
desenvolvimento, “incluído nesta versão” quando vem do snapshot empacotado (ver
[CONTRIBUTING §6.2](CONTRIBUTING.md#62-histórico-e-changelog)). O selo não é enfeite: ele
explica por que o histórico pode estar parado na data do build.

### Avatar de contribuidor

Começa como iniciais sobre superfície neutra e só então tenta a imagem. A busca dispara por
`IntersectionObserver`, quando a linha entra em vista — não no carregamento da tela.

Três consequências que precisam continuar valendo:

- **A ausência é normal.** Sem rede, sem correspondência no GitHub ou fora do repositório
  oficial, ficam as iniciais. Não existe estado de erro para o usuário aqui.
- **Nada some do layout.** A caixa tem tamanho fixo desde o primeiro quadro; a imagem não
  empurra a lista quando chega.
- **Nada é gravado em disco.** O cache é de memória e morre com a sessão. Persistir imagem de
  terceiro seria uma decisão de privacidade, não uma otimização.

### Dica de contexto

Controles compactos usam `title` e nome acessível. Tooltips não carregam informação
indispensável nem substituem rótulos no modo expandido.

## 7. Estados da tela

- **Inicial:** tabela orienta a escolher uma pasta e recarregar; atividade explica onde
  resultados aparecerão.
- **Sem resultados:** busca de repositórios informa que nada foi encontrado e registra
  o evento na atividade.
- **Em andamento:** alvos recebem “executando…”, progresso textual atualiza e a atividade
  mostra “Ao vivo”.
- **Sucesso/aviso/falha:** texto, cor semântica e evento na timeline.
- **Cancelado:** log e timeline registram explicitamente o cancelamento.
- **Git ausente:** alerta com `role="alert"` e instrução para instalar Git for Windows.
- **Busca de ferramenta vazia:** menu expandido mostra “Nada encontrado”.
- **Changelog carregando:** região com `role="status"` enquanto o histórico é lido.
- **Changelog indisponível:** `role="alert"` com a mensagem vinda do `codigo` do resultado —
  git ausente, pasta sem repositório, sem commits ou snapshot faltando produzem textos
  diferentes, e o atalho para o repositório no GitHub continua oferecido.
- **Sem registro de ferramentas:** Início explica que nenhuma foi registrada ainda.

## 8. Iconografia

Font Awesome continua importado por referência em `components/Icone.tsx`. Glifos de
ferramentas vêm do registro. Ícone sozinho só é permitido com `aria-label` e `title`;
quando a rail expande, o rótulo textual reaparece. Não adicionar registros globais de
ícones nem fontes externas.

## 9. Movimento

- Entrada de ferramenta: 180 ms.
- Expansão da rail: 180 ms, curva de continuidade espacial.
- Banner: 220 ms.
- Progresso: 200–300 ms.
- Verificação manual mantém no mínimo 900 ms de indicador visível.

Nada pulsa continuamente além de download ativo. `prefers-reduced-motion` reduz todas as
durações para praticamente zero.

## 10. Acessibilidade

- Navegação completa por teclado e foco de 2 px visível.
- Toggle da rail usa `aria-expanded` e `aria-controls`.
- Ferramenta ativa usa `aria-current="page"`.
- Ícones compactos mantêm nome acessível.
- Progresso, resumo da operação e updater usam regiões de status com parcimônia.
- Erros usam `role="alert"`.
- Estados não dependem exclusivamente de cor.
- A tabela preserva nomes acessíveis nas seleções e ação de abrir pasta via botão.

## 11. Texto de interface

Português direto e impessoal. Botões usam verbo no infinitivo (“Atualizar”, “Cancelar”,
“Verificar”). Erros dizem o que ocorreu e, quando possível, o próximo passo. Vocabulário
fixo: repositório, branch, stash, pasta raiz, atualizar, verificar e cancelar.

## 12. Checklist de revisão

- [ ] Nova ferramenta exige somente uma entrada no registro.
- [ ] Rail funciona recolhida, expandida e no modo sobreposto.
- [ ] Ferramenta ativa não perde estado ao expandir a rail.
- [ ] Layout funciona em 1100 × 720 e 860 × 560.
- [ ] Tabela mantém todas as colunas por rolagem horizontal.
- [ ] Foco, rótulos e nomes acessíveis estão presentes.
- [ ] Sucesso, aviso e falha têm texto além de cor.
- [ ] Updater quebra linha e mantém todas as ações.
- [ ] `prefers-reduced-motion` continua efetivo.
- [ ] Tela nova usa um prefixo de classe próprio e nenhum hexadecimal solto.
- [ ] Breakpoint novo reaproveita a tabela de §3.5, ou a atualiza com justificativa.
- [ ] Ferramenta nova aparece em Início e na rail só com a entrada no registro.
- [ ] Recurso de rede degrada em silêncio, sem buraco no layout.
- [ ] CSS de ferramenta está no arquivo da ferramenta, não no `index.css`.
- [ ] Ferramenta universal foi vista no site, não só no app.
- [ ] Selo de runtime correto no cartão do catálogo.
- [ ] Ferramenta usa `.tool-header`, e a linha dela continua a da rail.
- [ ] `npm run typecheck`, `npm run build` e `npm run build:site` passam.

## 13. O site

**É a mesma casca.** O site monta a `App.tsx` do aplicativo — rail, Início, roteamento,
tokens, animações — e carrega o `index.css` inteiro. Não existe segunda identidade visual,
e não deve passar a existir: qualquer tela nova aparece nos dois produtos de graça.

As únicas diferenças visuais, todas comandadas por `useAmbiente()`:

- **Faixa do topo:** no app é área de arrastar a janela; no site, um botão "Baixar para
  Windows" à direita.
- **Ferramenta `desktop` na rail:** cadeado à direita do nome quando expandida, e o
  `aria-label` diz "requer o aplicativo".
- **Cartão no Início:** opacidade reduzida e a ação vira "Requer o app" com cadeado.
- **Abrir uma `desktop` no site:** em vez da ferramenta, o painel `RequerApp` — ícone,
  o porquê em uma frase e o botão de download. O componente não é montado, então o chunk
  dela nem é baixado.
- **Rodapé da rail:** GitHub abre o repositório em vez do Changelog, e o botão de
  atualizar vira o de download.

O Changelog não aparece no site: ele lê o histórico pelo processo principal.

Único ponto de rede do site é a API do GitHub para o release mais recente, refletido na CSP
do `index.html` com `connect-src https://api.github.com`. Recurso novo de rede precisa
entrar ali também.
