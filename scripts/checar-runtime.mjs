/**
 * Garante que ferramenta marcada como `universal` não use window.api.
 *
 * O TypeScript não pega isso: a declaração de `window.api` vale para a árvore
 * inteira, então uma ferramenta universal que chamasse a ponte compilaria sem
 * reclamar e só quebraria no navegador, na mão do usuário. Este script fecha
 * essa brecha antes do build do site.
 */
import { readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pastaTools = resolve(raiz, 'src/renderer/src/tools')
const registro = resolve(pastaTools, 'registry.ts')

const EXTENSOES = ['.tsx', '.ts', '/index.tsx', '/index.ts']

function resolverImport(deArquivo, especificador) {
  if (!especificador.startsWith('.')) return null
  const base = resolve(dirname(deArquivo), especificador)
  for (const ext of ['', ...EXTENSOES]) {
    const tentativa = base + ext
    // Precisa ser arquivo: um diretório com o mesmo nome faria o readFileSync explodir.
    try {
      if (statSync(tentativa).isFile()) return tentativa
    } catch {
      // caminho não existe: tenta a próxima extensão
    }
  }
  return null
}

/** Segue os imports relativos a partir do componente, para não olhar só o arquivo de entrada. */
function arquivosAlcancaveis(entrada) {
  const vistos = new Set()
  const fila = [entrada]

  while (fila.length > 0) {
    const arquivo = fila.pop()
    if (!arquivo || vistos.has(arquivo)) continue
    vistos.add(arquivo)

    const fonte = readFileSync(arquivo, 'utf8')
    for (const m of fonte.matchAll(/from\s+'([^']+)'|import\('([^']+)'\)/g)) {
      const alvo = resolverImport(arquivo, m[1] ?? m[2])
      if (alvo) fila.push(alvo)
    }
  }

  return [...vistos]
}

const fonteRegistro = readFileSync(registro, 'utf8')

// Cada entrada do array: captura o id, o runtime e o caminho do import dinâmico.
const entradas = [...fonteRegistro.matchAll(/\{[^{}]*?id:\s*'([^']+)'[\s\S]*?\}/g)]
  .map((m) => m[0])
  .map((bloco) => ({
    id: /id:\s*'([^']+)'/.exec(bloco)?.[1],
    runtime: /runtime:\s*'([^']+)'/.exec(bloco)?.[1],
    modulo: /import\('([^']+)'\)/.exec(bloco)?.[1]
  }))
  .filter((e) => e.id)

if (entradas.length === 0) {
  console.error('checar-runtime: nenhuma ferramenta encontrada no registro.')
  process.exit(1)
}

let problemas = 0

for (const entrada of entradas) {
  if (!entrada.runtime) {
    console.error(`  XX ${entrada.id}: sem o campo runtime`)
    problemas++
    continue
  }
  if (entrada.runtime !== 'universal') continue

  const componente = entrada.modulo && resolverImport(registro, entrada.modulo)
  if (!componente) {
    console.error(`  XX ${entrada.id}: não consegui resolver o componente (${entrada.modulo})`)
    problemas++
    continue
  }

  for (const arquivo of arquivosAlcancaveis(componente)) {
    const fonte = readFileSync(arquivo, 'utf8')
    if (/window\.api\b/.test(fonte)) {
      console.error(
        `  XX ${entrada.id}: usa window.api em ${arquivo.replace(raiz + '\\', '').replace(/\\/g, '/')}\n` +
          `     Uma ferramenta universal roda no navegador, onde a ponte não existe.\n` +
          `     Troque para runtime: 'desktop' ou tire a dependência.`
      )
      problemas++
    }
  }
}

const universais = entradas.filter((e) => e.runtime === 'universal').length
if (problemas > 0) {
  console.error(`\ncheçar-runtime: ${problemas} problema(s).`)
  process.exit(1)
}

console.log(
  `checar-runtime: ${entradas.length} ferramenta(s), ${universais} universal(is), tudo coerente.`
)
