/**
 * Validação e geração de documentos brasileiros.
 *
 * Funções puras, sem dependência de React nem do processo principal: dá para
 * exercitar tudo com o harness de esbuild descrito em CONTRIBUTING §8.1.
 */

export type TipoDocumento = 'cpf' | 'cnpj' | 'caepf' | 'cns' | 'pis'
export type CategoriaDocumento = 'identificacao' | 'empresa' | 'trabalho'

export interface Documento {
  tipo: TipoDocumento
  categoria: CategoriaDocumento
  rotulo: string
  descricao: string
  /** Comprimento depois de remover formatação. */
  tamanho: number
  validar: (valor: string) => Validacao
  gerar: () => string
  formatar: (valor: string) => string
}

export type Validacao = { ok: true } | { ok: false; motivo: string }

const invalido = (motivo: string): Validacao => ({ ok: false, motivo })
const valido: Validacao = { ok: true }

// ------------------------------------------------------------------ utilidades

export function soDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/** CNPJ pode conter letras nos 12 primeiros caracteres desde o formato alfanumérico. */
function soAlfanumerico(valor: string): string {
  return valor.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
}

function todosIguais(valor: string): boolean {
  return valor.split('').every((c) => c === valor[0])
}

function digitosAleatorios(quantidade: number): string {
  const bytes = crypto.getRandomValues(new Uint32Array(quantidade))
  return Array.from(bytes, (n) => String(n % 10)).join('')
}

function aplicarMascara(valor: string, mascara: string): string {
  let indice = 0
  let saida = ''
  for (const c of mascara) {
    if (indice >= valor.length) break
    saida += c === '#' ? valor[indice++] : c
  }
  return saida + valor.slice(indice)
}

// ------------------------------------------------------------------------ CPF

function digitoCpf(base: string): number {
  const peso = base.length + 1
  const soma = base.split('').reduce((acc, d, i) => acc + Number(d) * (peso - i), 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

function validarCpf(valor: string): Validacao {
  const cpf = soDigitos(valor)
  if (cpf.length !== 11) return invalido(`precisa de 11 dígitos, tem ${cpf.length}`)
  if (todosIguais(cpf)) return invalido('todos os dígitos iguais')

  const base = cpf.slice(0, 9)
  const d1 = digitoCpf(base)
  const d2 = digitoCpf(base + d1)
  if (`${d1}${d2}` !== cpf.slice(9)) return invalido(`dígito verificador deveria ser ${d1}${d2}`)

  return valido
}

function gerarCpf(): string {
  let base = digitosAleatorios(9)
  // Base repetida geraria um documento que o próprio validador recusa.
  while (todosIguais(base)) base = digitosAleatorios(9)

  const d1 = digitoCpf(base)
  return `${base}${d1}${digitoCpf(base + d1)}`
}

// ----------------------------------------------------------------------- CNPJ

const PESOS_CNPJ = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

/**
 * Valor do caractere no CNPJ alfanumérico: código ASCII menos 48, conforme a
 * Receita Federal. Dígitos ficam 0-9 e letras 17-42.
 */
function valorCaractereCnpj(c: string): number {
  return c.charCodeAt(0) - 48
}

function digitoCnpj(base: string): number {
  const pesos = PESOS_CNPJ.slice(PESOS_CNPJ.length - base.length)
  const soma = base.split('').reduce((acc, c, i) => acc + valorCaractereCnpj(c) * pesos[i], 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

function validarCnpj(valor: string): Validacao {
  const cnpj = soAlfanumerico(valor)
  if (cnpj.length !== 14) return invalido(`precisa de 14 caracteres, tem ${cnpj.length}`)
  if (todosIguais(cnpj)) return invalido('todos os caracteres iguais')

  const raiz = cnpj.slice(0, 12)
  if (!/^[0-9A-Z]{12}$/.test(raiz)) return invalido('os 12 primeiros aceitam apenas letras e números')
  if (!/^\d{2}$/.test(cnpj.slice(12))) return invalido('o dígito verificador precisa ser numérico')

  const d1 = digitoCnpj(raiz)
  const d2 = digitoCnpj(raiz + d1)
  if (`${d1}${d2}` !== cnpj.slice(12)) return invalido(`dígito verificador deveria ser ${d1}${d2}`)

  return valido
}

function gerarCnpj(): string {
  let raiz = digitosAleatorios(8) + '0001'
  while (todosIguais(raiz)) raiz = digitosAleatorios(8) + '0001'

  const d1 = digitoCnpj(raiz)
  return `${raiz}${d1}${digitoCnpj(raiz + d1)}`
}

// ---------------------------------------------------------------------- CAEPF

/**
 * Porte fiel de CAEPFCalculaDigito, da macro SFN_PESSOA.vb (MG). O peso vem da
 * posição contada da direita: até a oitava é 10-posição, depois 18-posição.
 */
function digitoCaepf(base: string): number {
  let soma = 0
  for (let i = 0; i < base.length; i++) {
    const posicaoDireita = base.length - i
    const peso = posicaoDireita <= 8 ? 10 - posicaoDireita : 18 - posicaoDireita
    soma += Number(base[i]) * peso
  }

  const resto = soma % 11
  return resto === 10 ? 0 : resto
}

/** Os dois dígitos do CAEPF são um número só: (d1 * 10 + d2 + 12) mod 100. */
function verificadorCaepf(base: string): string {
  const d1 = digitoCaepf(base)
  const d2 = digitoCaepf(base + d1)
  return String((d1 * 10 + d2 + 12) % 100).padStart(2, '0')
}

function validarCaepf(valor: string): Validacao {
  const caepf = soDigitos(valor)
  if (caepf.length !== 14) return invalido(`precisa de 14 dígitos, tem ${caepf.length}`)
  if (todosIguais(caepf)) return invalido('todos os dígitos iguais')

  const esperado = verificadorCaepf(caepf.slice(0, 12))
  if (esperado !== caepf.slice(12)) return invalido(`dígito verificador deveria ser ${esperado}`)

  return valido
}

function gerarCaepf(): string {
  let base = digitosAleatorios(12)
  while (todosIguais(base)) base = digitosAleatorios(12)
  return base + verificadorCaepf(base)
}

// ------------------------------------------------------------------------ CNS

function somaCns(cns: string): number {
  return cns.split('').reduce((acc, d, i) => acc + Number(d) * (15 - i), 0)
}

function validarCns(valor: string): Validacao {
  const cns = soDigitos(valor)
  if (cns.length !== 15) return invalido(`precisa de 15 dígitos, tem ${cns.length}`)

  const inicio = cns[0]

  // Definitivo: os 11 primeiros dígitos são o PIS do cidadão.
  if (inicio === '1' || inicio === '2') {
    const pis = cns.slice(0, 11)
    const soma = pis.split('').reduce((acc, d, i) => acc + Number(d) * (15 - i), 0)
    let dv = 11 - (soma % 11)
    if (dv === 11) dv = 0

    let esperado: string
    if (dv === 10) {
      // Regra da faixa: soma ganha 2 e o dígito vira 001 na sequência.
      const dvCorrigido = 11 - ((soma + 2) % 11)
      esperado = `001${dvCorrigido === 11 ? 0 : dvCorrigido}`
    } else {
      esperado = `000${dv}`
    }

    if (cns.slice(11) !== esperado) return invalido(`os 4 últimos dígitos deveriam ser ${esperado}`)
    return valido
  }

  // Provisório: a soma ponderada dos 15 dígitos precisa fechar em múltiplo de 11.
  if (inicio === '7' || inicio === '8' || inicio === '9') {
    if (somaCns(cns) % 11 !== 0) return invalido('soma de verificação não fecha')
    return valido
  }

  return invalido(`começa com ${inicio}; precisa começar com 1, 2, 7, 8 ou 9`)
}

function gerarCns(): string {
  // Faixa definitiva, que é a que aparece no cadastro de beneficiário.
  for (;;) {
    const pis = String(1 + Math.floor(Math.random() * 2)) + digitosAleatorios(10)
    const soma = pis.split('').reduce((acc, d, i) => acc + Number(d) * (15 - i), 0)
    const resto = soma % 11
    let dv = 11 - resto
    if (dv === 11) dv = 0
    if (dv === 10) continue // faixa com regra especial: sorteia outro

    return `${pis}000${dv}`
  }
}

// ------------------------------------------------------------------ PIS/PASEP

const PESOS_PIS = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

function digitoPis(base: string): number {
  const soma = base.split('').reduce((acc, d, i) => acc + Number(d) * PESOS_PIS[i], 0)
  const resto = soma % 11
  const dv = 11 - resto
  return dv >= 10 ? 0 : dv
}

function validarPis(valor: string): Validacao {
  const pis = soDigitos(valor)
  if (pis.length !== 11) return invalido(`precisa de 11 dígitos, tem ${pis.length}`)
  if (todosIguais(pis)) return invalido('todos os dígitos iguais')

  const esperado = digitoPis(pis.slice(0, 10))
  if (String(esperado) !== pis[10]) return invalido(`dígito verificador deveria ser ${esperado}`)

  return valido
}

function gerarPis(): string {
  let base = digitosAleatorios(10)
  while (todosIguais(base)) base = digitosAleatorios(10)
  return base + digitoPis(base)
}

// ------------------------------------------------------------------- catálogo

export const DOCUMENTOS: Documento[] = [
  {
    tipo: 'cpf',
    categoria: 'identificacao',
    rotulo: 'CPF',
    descricao: 'Pessoa física. 11 dígitos, módulo 11.',
    tamanho: 11,
    validar: validarCpf,
    gerar: gerarCpf,
    formatar: (v) => aplicarMascara(soDigitos(v), '###.###.###-##')
  },
  {
    tipo: 'cnpj',
    categoria: 'empresa',
    rotulo: 'CNPJ',
    descricao: 'Pessoa jurídica. Aceita o formato alfanumérico da Receita.',
    tamanho: 14,
    validar: validarCnpj,
    gerar: gerarCnpj,
    formatar: (v) => aplicarMascara(soAlfanumerico(v), '##.###.###/####-##')
  },
  {
    tipo: 'caepf',
    categoria: 'empresa',
    rotulo: 'CAEPF',
    descricao: 'Atividade econômica de pessoa física. 14 dígitos.',
    tamanho: 14,
    validar: validarCaepf,
    gerar: gerarCaepf,
    formatar: (v) => aplicarMascara(soDigitos(v), '###.###.###/###-##')
  },
  {
    tipo: 'cns',
    categoria: 'identificacao',
    rotulo: 'CNS',
    descricao: 'Cartão Nacional de Saúde. 15 dígitos, definitivo ou provisório.',
    tamanho: 15,
    validar: validarCns,
    gerar: gerarCns,
    formatar: (v) => aplicarMascara(soDigitos(v), '### #### #### ####')
  },
  {
    tipo: 'pis',
    categoria: 'trabalho',
    rotulo: 'PIS/PASEP',
    descricao: 'Também usado como NIT. 11 dígitos.',
    tamanho: 11,
    validar: validarPis,
    gerar: gerarPis,
    formatar: (v) => aplicarMascara(soDigitos(v), '###.#####.##-#')
  }
]

export function documentoPorTipo(tipo: TipoDocumento): Documento {
  const encontrado = DOCUMENTOS.find((d) => d.tipo === tipo)
  if (!encontrado) throw new Error(`tipo de documento desconhecido: ${tipo}`)
  return encontrado
}
