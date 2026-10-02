import log from 'electron-log'
import type { Municipio, ResultadoMunicipios } from '../../shared/cep'

/**
 * Municípios do IBGE, seguindo as mesmas regras de rede da consulta de CEP
 * (CONTRIBUTING §5.2). Host fixo aqui, e a tela não passa nada.
 *
 * Traz os 5.571 de uma vez, não um estado por vez. A resposta crua tem 2,3 MB
 * de microrregião, mesorregião e região imediata aninhadas; ficando só com
 * código, nome e UF sobram 405 KB, que cabem na memória sem pensar. Com a
 * lista inteira na tela, filtrar por código ou por nome não custa requisição
 * nenhuma — é o que permite ir mostrando resultado enquanto se digita.
 */

const HOST = 'servicodados.ibge.gov.br'
const TEMPO_LIMITE_MS = 20_000
/** A resposta crua passa de 2,3 MB; o corte existe para o caso de ela crescer. */
const TAMANHO_MAXIMO = 8 * 1024 * 1024

let cache: Municipio[] | null = null

/**
 * A resposta aninha a UF em dois lugares, e é preciso tentar os dois.
 *
 * O caminho usual é `microrregiao.mesorregiao.UF`, mas município criado
 * recentemente pode vir com `microrregiao: null` — hoje é o caso de Boa
 * Esperança do Norte (MT, 5101837). Nesses, a UF só existe em
 * `regiao-imediata.regiao-intermediaria.UF`. Sem a alternativa, o município
 * entrava na lista sem estado e sumia de qualquer filtro por UF.
 *
 * Guardamos quatro campos; o resto do aninhamento não atravessa a ponte.
 */
function paraMunicipio(bruto: unknown): Municipio | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const item = bruto as Record<string, unknown>
  if (typeof item.id !== 'number' || typeof item.nome !== 'string') return null

  const porDentro = (raiz: unknown, nivel: string): Record<string, unknown> | undefined => {
    const pai = raiz as Record<string, unknown> | undefined
    return pai?.[nivel] as Record<string, unknown> | undefined
  }

  const uf =
    porDentro(porDentro(item, 'microrregiao'), 'mesorregiao')?.UF ??
    porDentro(porDentro(item, 'regiao-imediata'), 'regiao-intermediaria')?.UF

  const dados = uf as Record<string, unknown> | undefined
  if (typeof dados?.sigla !== 'string' || typeof dados.nome !== 'string') return null

  return {
    codigo: String(item.id),
    nome: item.nome,
    uf: dados.sigla,
    estado: dados.nome
  }
}

export async function todosMunicipios(): Promise<ResultadoMunicipios> {
  if (cache) return { ok: true, municipios: cache, doCache: true }

  try {
    const resposta = await fetch(`https://${HOST}/api/v1/localidades/municipios`, {
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      headers: { accept: 'application/json' }
    })

    if (!resposta.ok) return { ok: false, motivo: `O IBGE respondeu ${resposta.status}.` }

    const tipo = resposta.headers.get('content-type') ?? ''
    if (!tipo.includes('json')) return { ok: false, motivo: 'A resposta não veio em JSON.' }

    // A origem não manda content-length, então o corte é pelo corpo lido.
    const bruto = await resposta.text()
    if (bruto.length > TAMANHO_MAXIMO) return { ok: false, motivo: 'A resposta veio grande demais.' }

    const corpo: unknown = JSON.parse(bruto)
    if (!Array.isArray(corpo)) return { ok: false, motivo: 'A resposta veio num formato inesperado.' }

    const municipios = corpo
      .map(paraMunicipio)
      .filter((m): m is Municipio => m !== null)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    if (municipios.length === 0) return { ok: false, motivo: 'O IBGE não listou nenhum município.' }

    cache = municipios
    log.info(`IBGE: ${municipios.length} municípios em cache`)
    return { ok: true, municipios, doCache: false }
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') {
      return { ok: false, motivo: 'A consulta ao IBGE demorou demais e foi cancelada.' }
    }
    if (e instanceof SyntaxError) return { ok: false, motivo: 'A resposta do IBGE não era JSON válido.' }
    log.warn('IBGE: falha na consulta', e)
    return { ok: false, motivo: 'Sem conexão com o serviço do IBGE.' }
  }
}
