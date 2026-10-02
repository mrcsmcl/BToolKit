/**
 * Leitura, conferência e formatação de XML — tudo com o que o navegador já
 * tem: `DOMParser` para analisar e um serializador próprio para imprimir.
 *
 * Funções puras, sem React: dá para exercitar com o harness de esbuild do
 * CONTRIBUTING §8.1, desde que haja um `DOMParser` (o do jsdom serve, ou o
 * harness dentro do Electron da §8.2).
 */

export interface ErroXml {
  mensagem: string
  linha: number | null
  coluna: number | null
}

export interface Analise {
  ok: boolean
  erro: ErroXml | null
  /** Nome do elemento raiz; vazio quando não deu para analisar. */
  raiz: string
  elementos: number
  profundidade: number
  /** Declaração de encoding do prólogo, quando existe. */
  encoding: string
  /** Valores de assinatura encontrados no documento, se houver. */
  assinatura: Assinatura | null
}

export interface Assinatura {
  digestValue: string
  signatureValue: string
  digestMethod: string
  signatureMethod: string
  referenciaUri: string
}

const ENTIDADES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}

function escapar(texto: string, comAspas: boolean): string {
  return texto.replace(comAspas ? /[&<>"]/g : /[&<>]/g, (c) => ENTIDADES[c])
}

/**
 * O `parsererror` do Chromium traz linha e coluna no texto, em inglês. Não há
 * API estruturada para isso, então o jeito é ler a frase.
 */
function lerErro(doc: Document): ErroXml | null {
  const erro = doc.querySelector('parsererror')
  if (!erro) return null

  // O Chromium anexa "Below is a rendering..." ao texto do erro; fora isso o
  // formato e "error on line N at column M: <motivo>".
  const texto = (erro.textContent ?? '')
    .split(/Below is a rendering/i)[0]
    .replace(/\s+/g, ' ')
    .trim()

  const completo = /error on line (\d+) at column (\d+):\s*(.*)$/i.exec(texto)
  if (completo) {
    return { mensagem: completo[3].trim(), linha: Number(completo[1]), coluna: Number(completo[2]) }
  }

  return {
    mensagem: texto.replace(/^This page contains the following errors:\s*/i, '').trim(),
    linha: null,
    coluna: null
  }
}

function contar(no: Node, nivel: number): { elementos: number; profundidade: number } {
  let elementos = 0
  let profundidade = nivel

  for (const filho of Array.from(no.childNodes)) {
    if (filho.nodeType !== Node.ELEMENT_NODE) continue
    elementos++
    const dentro = contar(filho, nivel + 1)
    elementos += dentro.elementos
    profundidade = Math.max(profundidade, dentro.profundidade)
  }

  return { elementos, profundidade }
}

/** Lê o que o documento *declara* sobre a própria assinatura. Não a valida. */
function lerAssinatura(doc: Document): Assinatura | null {
  const local = (nome: string): Element | null =>
    doc.getElementsByTagName('*').length === 0
      ? null
      : (Array.from(doc.getElementsByTagName('*')).find(
          (e) => e.localName === nome && e.namespaceURI === 'http://www.w3.org/2000/09/xmldsig#'
        ) ?? null)

  const digest = local('DigestValue')
  const assinatura = local('SignatureValue')
  if (!digest && !assinatura) return null

  return {
    digestValue: digest?.textContent?.trim() ?? '',
    signatureValue: assinatura?.textContent?.trim() ?? '',
    digestMethod: local('DigestMethod')?.getAttribute('Algorithm') ?? '',
    signatureMethod: local('SignatureMethod')?.getAttribute('Algorithm') ?? '',
    referenciaUri: local('Reference')?.getAttribute('URI') ?? ''
  }
}

export function analisar(texto: string): { analise: Analise; doc: Document | null } {
  const doc = new DOMParser().parseFromString(texto, 'application/xml')
  const erro = lerErro(doc)
  const encoding = /<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i.exec(texto)?.[1] ?? ''

  if (erro) {
    return {
      analise: {
        ok: false,
        erro,
        raiz: '',
        elementos: 0,
        profundidade: 0,
        encoding,
        assinatura: null
      },
      doc: null
    }
  }

  const { elementos, profundidade } = contar(doc, 0)

  return {
    analise: {
      ok: true,
      erro: null,
      raiz: doc.documentElement?.nodeName ?? '',
      elementos,
      profundidade,
      encoding,
      assinatura: lerAssinatura(doc)
    },
    doc
  }
}

// ------------------------------------------------------------------ formatar

function ehEspacoApenas(no: Node): boolean {
  return no.nodeType === Node.TEXT_NODE && (no.nodeValue ?? '').trim() === ''
}

/**
 * Conteúdo misto: elemento que tem texto com significado ao lado de filhos.
 *
 * Reindentar um desses mudaria o dado — `<p>oi <b>tu</b></p>` viraria
 * `<p>oi<b>tu</b></p>` com quebras no meio. Então ele sai numa linha só.
 */
function temConteudoMisto(elemento: Element): boolean {
  const filhos = Array.from(elemento.childNodes)
  const temElemento = filhos.some((f) => f.nodeType === Node.ELEMENT_NODE)
  const temTexto = filhos.some(
    (f) => (f.nodeType === Node.TEXT_NODE || f.nodeType === Node.CDATA_SECTION_NODE) && !ehEspacoApenas(f)
  )
  return temElemento && temTexto
}

function atributos(elemento: Element): string {
  return Array.from(elemento.attributes)
    .map((a) => ` ${a.name}="${escapar(a.value, true)}"`)
    .join('')
}

function serializarInline(no: Node): string {
  switch (no.nodeType) {
    case Node.TEXT_NODE:
      return escapar(no.nodeValue ?? '', false)
    case Node.CDATA_SECTION_NODE:
      return `<![CDATA[${no.nodeValue ?? ''}]]>`
    case Node.COMMENT_NODE:
      return `<!--${no.nodeValue ?? ''}-->`
    case Node.PROCESSING_INSTRUCTION_NODE: {
      const pi = no as ProcessingInstruction
      return `<?${pi.target} ${pi.data}?>`
    }
    case Node.ELEMENT_NODE: {
      const e = no as Element
      const dentro = Array.from(e.childNodes).map(serializarInline).join('')
      if (!dentro) return `<${e.nodeName}${atributos(e)}/>`
      return `<${e.nodeName}${atributos(e)}>${dentro}</${e.nodeName}>`
    }
    default:
      return ''
  }
}

function serializar(no: Node, nivel: number, recuo: string, saida: string[]): void {
  const prefixo = recuo.repeat(nivel)

  switch (no.nodeType) {
    case Node.COMMENT_NODE:
      saida.push(`${prefixo}<!--${no.nodeValue ?? ''}-->`)
      return
    case Node.PROCESSING_INSTRUCTION_NODE: {
      const pi = no as ProcessingInstruction
      saida.push(`${prefixo}<?${pi.target} ${pi.data}?>`)
      return
    }
    case Node.TEXT_NODE:
      if (!ehEspacoApenas(no)) saida.push(prefixo + escapar(no.nodeValue ?? '', false))
      return
    case Node.CDATA_SECTION_NODE:
      saida.push(`${prefixo}<![CDATA[${no.nodeValue ?? ''}]]>`)
      return
    case Node.ELEMENT_NODE:
      break
    default:
      return
  }

  const elemento = no as Element
  const abertura = `<${elemento.nodeName}${atributos(elemento)}`
  const filhos = Array.from(elemento.childNodes).filter((f) => !ehEspacoApenas(f))

  if (filhos.length === 0) {
    saida.push(`${prefixo}${abertura}/>`)
    return
  }

  // Um texto só, ou conteúdo misto: tudo na mesma linha, e **sem aparar**.
  //
  // Espaço dentro do texto de um elemento é dado, não formatação: aparar
  // `<b>  dois espaços  </b>` muda o conteúdo do documento. O que se descarta
  // é só o nó que é espaço inteiro entre elementos, que é o que permite
  // reindentar sem mentir.
  const soTexto =
    filhos.length === 1 &&
    (filhos[0].nodeType === Node.TEXT_NODE || filhos[0].nodeType === Node.CDATA_SECTION_NODE)

  if (soTexto || temConteudoMisto(elemento)) {
    const dentro = filhos.map(serializarInline).join('')
    saida.push(`${prefixo}${abertura}>${dentro}</${elemento.nodeName}>`)
    return
  }

  saida.push(`${prefixo}${abertura}>`)
  for (const filho of filhos) serializar(filho, nivel + 1, recuo, saida)
  saida.push(`${prefixo}</${elemento.nodeName}>`)
}

/** Prólogo original, para não perder a declaração de encoding ao reimprimir. */
function prologo(texto: string): string {
  return /^\s*(<\?xml[^>]*\?>)/.exec(texto)?.[1] ?? ''
}

export function formatar(texto: string, doc: Document, espacos = 2): string {
  const saida: string[] = []
  const inicio = prologo(texto)
  if (inicio) saida.push(inicio)

  for (const no of Array.from(doc.childNodes)) {
    serializar(no, 0, ' '.repeat(espacos), saida)
  }

  return saida.join('\n')
}

export function minificar(texto: string, doc: Document): string {
  const inicio = prologo(texto)
  const corpo = Array.from(doc.childNodes)
    .map((no) => serializarInline(no).replace(/>\s+</g, '><'))
    .join('')
  return inicio + corpo
}

/**
 * Texto para comparar dois arquivos que só diferem na formatação.
 *
 * É o documento minificado: o espaço entre elementos some, o de dentro do
 * texto fica. Serve para responder "é o mesmo conteúdo?" quando um dos lados
 * foi reindentado.
 *
 * **Não é C14N.** A canonicalização do XML-DSig tem regras próprias de
 * namespace e ordem de atributos, e o hash daqui não serve para conferir
 * assinatura digital.
 */
export function textoNormalizado(texto: string, doc: Document): string {
  return minificar(texto, doc)
}
