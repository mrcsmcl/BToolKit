/**
 * Converte o documento numa estrutura feita para ler, não para editar.
 *
 * A ideia é separar três formas que o XML assume e que pedem apresentação
 * diferente:
 *
 *  - **campo**  — elemento folha: vira uma linha rótulo/valor.
 *  - **lista**  — vários irmãos com a mesma tag e conteúdo simples: viram uma
 *                 tabela, que é onde o XML cru fica realmente ilegível.
 *  - **grupo**  — o resto: uma seção com os filhos dentro.
 *
 * O nome mostrado é o local, sem prefixo de namespace: `ns:cUF` vira `cUF`.
 * Numa tela de leitura o prefixo é ruído, e o nome completo continua no título
 * do elemento para quem precisar.
 */

export interface Atributo {
  nome: string
  valor: string
}

export interface Campo {
  tipo: 'campo'
  nome: string
  nomeCompleto: string
  valor: string
  atributos: Atributo[]
}

export interface Grupo {
  tipo: 'grupo'
  nome: string
  nomeCompleto: string
  atributos: Atributo[]
  filhos: NoLeitura[]
}

export interface Lista {
  tipo: 'lista'
  nome: string
  nomeCompleto: string
  /** Caminho comum a todas as colunas de dado; vira legenda do cabeçalho. */
  prefixo: string
  colunas: string[]
  linhas: Record<string, string>[]
}

export type NoLeitura = Campo | Grupo | Lista

/** A partir daqui a tabela fica larga demais e a leitura piora. */
const MAXIMO_COLUNAS = 12

function elementos(no: Element): Element[] {
  return Array.from(no.children)
}

function texto(no: Element): string {
  return (no.textContent ?? '').trim()
}

function atributosDe(no: Element): Atributo[] {
  return Array.from(no.attributes)
    // xmlns é endereçamento, não dado: numa tela de leitura só atrapalha.
    .filter((a) => a.name !== 'xmlns' && !a.name.startsWith('xmlns:'))
    .map((a) => ({ nome: a.name, valor: a.value }))
}

function ehFolha(no: Element): boolean {
  return no.children.length === 0
}

/**
 * Achata o item numa linha de tabela, descendo até as folhas.
 *
 * Descer importa: numa NF-e o item é `<det><prod>…campos…</prod></det>`, com o
 * que interessa um nível abaixo. Olhar só os filhos diretos deixaria de fora
 * justamente a lista que mais precisa virar tabela.
 *
 * Devolve `null` quando o item tem repetição interna — aí ele não cabe numa
 * linha, e forçar perderia dado.
 */
function achatar(item: Element): Record<string, string> | null {
  const linha: Record<string, string> = {}
  let cabe = true

  const descer = (no: Element, prefixo: string): void => {
    if (!cabe) return

    for (const a of atributosDe(no)) {
      const chave = `${prefixo}@${a.nome}`
      if (chave in linha) {
        cabe = false
        return
      }
      linha[chave] = a.valor
    }

    for (const filho of elementos(no)) {
      if (!cabe) return
      const chave = prefixo + filho.localName

      if (ehFolha(filho)) {
        if (chave in linha) {
          // Mesmo nome duas vezes é lista dentro do item.
          cabe = false
          return
        }
        linha[chave] = texto(filho)
      } else {
        descer(filho, `${chave}/`)
      }
    }
  }

  descer(item, '')
  return cabe ? linha : null
}

/**
 * Quando toda coluna de dado vem do mesmo caminho, ele vira legenda do cabeçalho.
 *
 * Numa NF-e isso troca `prod/cProd`, `prod/xProd`… por `cProd`, `xProd`, com
 * um "campos de prod" no topo. Atributos do próprio item não entram na conta.
 */
function prefixoComum(colunas: string[]): string {
  const deDado = colunas.filter((c) => !c.startsWith('@'))
  if (deDado.length < 2) return ''

  const primeiro = deDado[0]
  const barra = primeiro.indexOf('/')
  if (barra === -1) return ''

  const candidato = primeiro.slice(0, barra + 1)
  return deDado.every((c) => c.startsWith(candidato)) ? candidato : ''
}

/**
 * Agrupa filhos consecutivos de mesma tag.
 *
 * Consecutivos de propósito: a ordem é informação no XML, e juntar ocorrências
 * separadas mudaria o que o documento diz.
 */
function agrupar(filhos: Element[]): Element[][] {
  const grupos: Element[][] = []
  for (const filho of filhos) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo[0].localName === filho.localName) ultimo.push(filho)
    else grupos.push([filho])
  }
  return grupos
}

function converterGrupo(no: Element): Grupo {
  return {
    tipo: 'grupo',
    nome: no.localName,
    nomeCompleto: no.nodeName,
    atributos: atributosDe(no),
    filhos: converterFilhos(elementos(no))
  }
}

function converterFilhos(filhos: Element[]): NoLeitura[] {
  const saida: NoLeitura[] = []

  for (const irmaos of agrupar(filhos)) {
    // Repetição que cabe em linhas: vira tabela.
    if (irmaos.length > 1) {
      const achatados = irmaos.map(achatar)

      if (achatados.every((l): l is Record<string, string> => l !== null)) {
        const colunas: string[] = []
        for (const linha of achatados) {
          for (const chave of Object.keys(linha)) {
            if (!colunas.includes(chave)) colunas.push(chave)
          }
        }

        if (colunas.length > 0 && colunas.length <= MAXIMO_COLUNAS) {
          saida.push({
            tipo: 'lista',
            nome: irmaos[0].localName,
            nomeCompleto: irmaos[0].nodeName,
            prefixo: prefixoComum(colunas),
            colunas,
            linhas: achatados
          })
          continue
        }
      }
    }

    for (const no of irmaos) {
      if (ehFolha(no)) {
        saida.push({
          tipo: 'campo',
          nome: no.localName,
          nomeCompleto: no.nodeName,
          valor: texto(no),
          atributos: atributosDe(no)
        })
      } else {
        saida.push(converterGrupo(no))
      }
    }
  }

  return saida
}

export function paraLeitura(doc: Document): NoLeitura | null {
  const raiz = doc.documentElement
  if (!raiz) return null
  return ehFolha(raiz)
    ? {
        tipo: 'campo',
        nome: raiz.localName,
        nomeCompleto: raiz.nodeName,
        valor: texto(raiz),
        atributos: atributosDe(raiz)
      }
    : converterGrupo(raiz)
}

// ------------------------------------------------------------------ filtro

function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
}

/**
 * Mantém o que casa com o termo, e os ancestrais de quem casou.
 *
 * Sem preservar o caminho, o resultado sairia solto da hierarquia e perderia
 * o que dá sentido ao valor.
 */
export function filtrar(no: NoLeitura, termo: string): NoLeitura | null {
  const alvo = normalizar(termo.trim())
  if (!alvo) return no

  const casaTexto = (...partes: string[]): boolean =>
    partes.some((p) => normalizar(p).includes(alvo))

  if (no.tipo === 'campo') {
    const casa = casaTexto(no.nome, no.valor, ...no.atributos.map((a) => `${a.nome} ${a.valor}`))
    return casa ? no : null
  }

  if (no.tipo === 'lista') {
    if (casaTexto(no.nome)) return no
    const linhas = no.linhas.filter((l) => casaTexto(...Object.values(l), ...Object.keys(l)))
    return linhas.length > 0 ? { ...no, linhas } : null
  }

  const filhos = no.filhos
    .map((f) => filtrar(f, termo))
    .filter((f): f is NoLeitura => f !== null)

  if (filhos.length > 0) return { ...no, filhos }
  return casaTexto(no.nome) ? no : null
}

export function contarCampos(no: NoLeitura): number {
  if (no.tipo === 'campo') return 1
  if (no.tipo === 'lista') return no.linhas.length * no.colunas.length
  return no.filhos.reduce((total, f) => total + contarCampos(f), 0)
}
