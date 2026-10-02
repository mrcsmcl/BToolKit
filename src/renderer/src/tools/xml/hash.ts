/**
 * Resumos criptográficos, no navegador.
 *
 * SHA-1, SHA-256 e SHA-512 saem do `crypto.subtle`, que existe tanto no app
 * quanto no site — o renderer do Electron é contexto seguro mesmo servindo de
 * `file://`. MD5 não está na Web Crypto e vai implementado aqui, porque ainda
 * é o que muito sistema publica junto do arquivo.
 *
 * Nada disto sai da máquina: o arquivo é lido e resumido na própria tela.
 */

export type Algoritmo = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-512'

export const ALGORITMOS: Algoritmo[] = ['MD5', 'SHA-1', 'SHA-256', 'SHA-512']

/** Quantos caracteres hexadecimais cada algoritmo produz. */
const TAMANHO_HEX: Record<Algoritmo, number> = {
  MD5: 32,
  'SHA-1': 40,
  'SHA-256': 64,
  'SHA-512': 128
}

function paraHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// ------------------------------------------------------------------------ MD5

/* eslint-disable no-bitwise */

const K_MD5 = Int32Array.from(
  { length: 64 },
  (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)
)

const DESLOCAMENTO = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
]

function girar(valor: number, quanto: number): number {
  return (valor << quanto) | (valor >>> (32 - quanto))
}

/** RFC 1321. Conferido contra os vetores de teste do próprio documento. */
export function md5(dados: Uint8Array): string {
  const bitsOriginais = dados.length * 8

  // Preenchimento: um bit 1, zeros, e o comprimento em 64 bits little-endian.
  const comPadding = new Uint8Array((((dados.length + 8) >> 6) + 1) << 6)
  comPadding.set(dados)
  comPadding[dados.length] = 0x80

  const visao = new DataView(comPadding.buffer)
  visao.setUint32(comPadding.length - 8, bitsOriginais >>> 0, true)
  visao.setUint32(comPadding.length - 4, Math.floor(bitsOriginais / 4294967296), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  const bloco = new Int32Array(16)

  for (let inicio = 0; inicio < comPadding.length; inicio += 64) {
    for (let i = 0; i < 16; i++) bloco[i] = visao.getInt32(inicio + i * 4, true)

    let a = a0
    let b = b0
    let c = c0
    let d = d0

    for (let i = 0; i < 64; i++) {
      let f: number
      let g: number

      if (i < 16) {
        f = (b & c) | (~b & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | (~d & c)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (7 * i) % 16
      }

      const temp = d
      d = c
      c = b
      b = (b + girar((a + f + K_MD5[i] + bloco[g]) | 0, DESLOCAMENTO[i])) | 0
      a = temp
    }

    a0 = (a0 + a) | 0
    b0 = (b0 + b) | 0
    c0 = (c0 + c) | 0
    d0 = (d0 + d) | 0
  }

  const saida = new Uint8Array(16)
  new DataView(saida.buffer).setInt32(0, a0, true)
  new DataView(saida.buffer).setInt32(4, b0, true)
  new DataView(saida.buffer).setInt32(8, c0, true)
  new DataView(saida.buffer).setInt32(12, d0, true)
  return paraHex(saida)
}

/* eslint-enable no-bitwise */

// ----------------------------------------------------------------- interface

export async function calcular(algoritmo: Algoritmo, dados: Uint8Array): Promise<string> {
  if (algoritmo === 'MD5') return md5(dados)
  // `subtle.digest` quer um ArrayBuffer exato; uma view fatiada confundiria.
  const copia = dados.slice()
  const resumo = await crypto.subtle.digest(algoritmo, copia.buffer as ArrayBuffer)
  return paraHex(new Uint8Array(resumo))
}

export async function calcularTodos(dados: Uint8Array): Promise<Record<Algoritmo, string>> {
  const pares = await Promise.all(
    ALGORITMOS.map(async (a) => [a, await calcular(a, dados)] as const)
  )
  return Object.fromEntries(pares) as Record<Algoritmo, string>
}

/**
 * Descobre o algoritmo pelo comprimento do hexadecimal.
 *
 * Quem cola um hash para conferir raramente diz de onde ele veio, e o tamanho
 * já identifica sem ambiguidade entre os quatro.
 */
export function algoritmoDoHash(valor: string): Algoritmo | null {
  const limpo = valor.trim().replace(/\s+/g, '').toLowerCase()
  if (!/^[0-9a-f]+$/.test(limpo)) return null
  return ALGORITMOS.find((a) => TAMANHO_HEX[a] === limpo.length) ?? null
}

export function normalizarHash(valor: string): string {
  return valor.trim().replace(/\s+/g, '').toLowerCase()
}
