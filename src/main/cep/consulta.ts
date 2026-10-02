import log from 'electron-log'
import { UFS, type BuscaPorEndereco, type EnderecoCep, type ResultadoCep } from '../../shared/cep'

/**
 * Consulta de CEP, seguindo as regras de rede do CONTRIBUTING §5.2.
 *
 * Separada do `index.ts` para poder ser exercitada sem subir o Electron: a
 * validação de entrada é a parte que mais merece teste, e ela não depende de
 * janela nenhuma.
 *
 * A tela nunca passa URL: manda CEP, UF, cidade e logradouro, tudo validado
 * aqui antes de virar endereço. O host é fixo nesta constante e não vem de
 * lugar nenhum em runtime.
 *
 * É a única ferramenta que precisa de rede, e é por isso que ela é `desktop`:
 * a CSP do renderer é `default-src 'self'`, então no site a busca não teria
 * como acontecer nem com a tela tentando.
 */

const HOST = 'viacep.com.br'
const TEMPO_LIMITE_MS = 8_000
const TAMANHO_MAXIMO = 1024 * 1024
/** A busca por logradouro devolve no máximo 50 resultados na origem. */
const MAXIMO_RESULTADOS = 50

/** Dado de terceiro buscado em runtime fica na sessão, nunca em disco (§5.2, regra 6). */
const cache = new Map<string, EnderecoCep[]>()


// ------------------------------------------------------------------ validação

function normalizarCep(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '')
  return /^\d{8}$/.test(digitos) ? digitos : null
}

function normalizarUf(valor: string): string | null {
  const uf = valor.trim().toUpperCase()
  return (UFS as readonly string[]).includes(uf) ? uf : null
}

/**
 * Cidade e logradouro entram na URL, então o conteúdo é restrito a letras,
 * números, espaço, hífen e apóstrofo. A origem exige pelo menos 3 caracteres.
 */
function normalizarTermo(valor: string): string | null {
  const termo = valor.trim().replace(/\s+/g, ' ')
  if (termo.length < 3 || termo.length > 72) return null
  return /^[\p{L}\p{N} '-]+$/u.test(termo) ? termo : null
}

// -------------------------------------------------------------------- resposta

/** A origem responde `{ "erro": true }` — ou `"true"`, dependendo da rota. */
function naoEncontrado(corpo: unknown): boolean {
  if (typeof corpo !== 'object' || corpo === null) return false
  const erro = (corpo as Record<string, unknown>).erro
  return erro === true || erro === 'true'
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

function paraEndereco(bruto: Record<string, unknown>): EnderecoCep {
  return {
    cep: texto(bruto.cep),
    logradouro: texto(bruto.logradouro),
    complemento: texto(bruto.complemento),
    bairro: texto(bruto.bairro),
    cidade: texto(bruto.localidade),
    uf: texto(bruto.uf),
    ibge: texto(bruto.ibge),
    ddd: texto(bruto.ddd)
  }
}

// ----------------------------------------------------------------------- rede

async function buscar(caminho: string): Promise<{ ok: true; corpo: unknown } | { ok: false; motivo: string }> {
  const url = `https://${HOST}/ws/${caminho}/json/`

  try {
    const resposta = await fetch(url, {
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      headers: { accept: 'application/json' }
    })

    if (!resposta.ok) {
      // 400 é o que a origem devolve para CEP com formato aceito mas inexistente.
      if (resposta.status === 400) return { ok: false, motivo: 'CEP não encontrado.' }
      return { ok: false, motivo: `A consulta respondeu ${resposta.status}.` }
    }

    const tipo = resposta.headers.get('content-type') ?? ''
    if (!tipo.includes('json')) return { ok: false, motivo: 'A resposta não veio em JSON.' }

    const tamanho = Number(resposta.headers.get('content-length') ?? 0)
    if (tamanho > TAMANHO_MAXIMO) return { ok: false, motivo: 'A resposta veio grande demais.' }

    const bruto = await resposta.text()
    if (bruto.length > TAMANHO_MAXIMO) return { ok: false, motivo: 'A resposta veio grande demais.' }

    return { ok: true, corpo: JSON.parse(bruto) }
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') {
      return { ok: false, motivo: 'A consulta demorou demais e foi cancelada.' }
    }
    if (e instanceof SyntaxError) return { ok: false, motivo: 'A resposta não era JSON válido.' }
    log.warn('CEP: falha na consulta', e)
    return { ok: false, motivo: 'Sem conexão com o serviço de CEP.' }
  }
}

export async function porCep(valor: string): Promise<ResultadoCep> {
  const cep = normalizarCep(valor)
  if (!cep) return { ok: false, motivo: 'O CEP precisa ter 8 dígitos.' }

  const chave = `cep:${cep}`
  const guardado = cache.get(chave)
  if (guardado) return { ok: true, enderecos: guardado, doCache: true }

  const r = await buscar(cep)
  if (!r.ok) return r
  if (naoEncontrado(r.corpo)) return { ok: false, motivo: 'CEP não encontrado.' }
  if (typeof r.corpo !== 'object' || r.corpo === null) {
    return { ok: false, motivo: 'A resposta veio num formato inesperado.' }
  }

  const enderecos = [paraEndereco(r.corpo as Record<string, unknown>)]
  cache.set(chave, enderecos)
  return { ok: true, enderecos, doCache: false }
}

export async function porEndereco(busca: BuscaPorEndereco): Promise<ResultadoCep> {
  const uf = normalizarUf(busca.uf)
  if (!uf) return { ok: false, motivo: 'Escolha o estado.' }

  const cidade = normalizarTermo(busca.cidade)
  if (!cidade) return { ok: false, motivo: 'A cidade precisa de ao menos 3 letras.' }

  const logradouro = normalizarTermo(busca.logradouro)
  if (!logradouro) return { ok: false, motivo: 'O logradouro precisa de ao menos 3 letras.' }

  const chave = `end:${uf}/${cidade.toLowerCase()}/${logradouro.toLowerCase()}`
  const guardado = cache.get(chave)
  if (guardado) return { ok: true, enderecos: guardado, doCache: true }

  const caminho = [uf, cidade, logradouro].map(encodeURIComponent).join('/')
  const r = await buscar(caminho)
  if (!r.ok) return r

  if (!Array.isArray(r.corpo)) {
    if (naoEncontrado(r.corpo)) return { ok: false, motivo: 'Nenhum endereço com esse nome.' }
    return { ok: false, motivo: 'A resposta veio num formato inesperado.' }
  }

  const enderecos = r.corpo
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .slice(0, MAXIMO_RESULTADOS)
    .map(paraEndereco)

  if (enderecos.length === 0) return { ok: false, motivo: 'Nenhum endereço com esse nome.' }

  cache.set(chave, enderecos)
  return { ok: true, enderecos, doCache: false }
}
