import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import type { RepoInfo } from '../../shared/repos'

export const PROFUNDIDADE_PADRAO = 3

const PASTAS_IGNORADAS = new Set([
  'node_modules',
  'bin',
  'obj',
  'packages',
  '.vs',
  '.idea',
  '$tf'
])

/** `.git` pode ser diretório (clone comum) ou arquivo (worktree / submódulo). */
function ehRepositorio(pasta: string): boolean {
  return existsSync(join(pasta, '.git'))
}

function criar(raiz: string, caminhoRepo: string): RepoInfo {
  const nome = basename(caminhoRepo.replace(/[\/]+$/, ''))
  const pai = dirname(caminhoRepo)
  const grupo =
    !pai || resolve(pai).toLowerCase() === raiz.toLowerCase() ? '(raiz)' : relative(raiz, pai)

  return {
    grupo,
    nome,
    caminho: caminhoRepo,
    branch: '',
    alteracoes: 0,
    stashes: 0,
    aheadBehind: '',
    temUpstream: false,
    branchesRemotas: []
  }
}

async function varrer(
  raiz: string,
  pastaAtual: string,
  nivel: number,
  profundidadeMaxima: number,
  encontrados: RepoInfo[]
): Promise<void> {
  if (nivel > profundidadeMaxima) return

  let entradas
  try {
    entradas = await readdir(pastaAtual, { withFileTypes: true })
  } catch {
    // pasta sem permissão de leitura: ignora em silêncio
    return
  }

  for (const entrada of entradas) {
    if (!entrada.isDirectory()) continue
    if (PASTAS_IGNORADAS.has(entrada.name) || entrada.name.startsWith('.')) continue

    const sub = join(pastaAtual, entrada.name)

    if (ehRepositorio(sub)) {
      // Repositório encontrado: não desce mais nesse ramo.
      encontrados.push(criar(raiz, sub))
      continue
    }

    await varrer(raiz, sub, nivel + 1, profundidadeMaxima, encontrados)
  }
}

/** Descobre repositórios git sob uma raiz, sem descer para dentro de um repositório já encontrado. */
export async function scan(
  raiz: string,
  profundidadeMaxima = PROFUNDIDADE_PADRAO
): Promise<RepoInfo[]> {
  if (!raiz.trim() || !existsSync(raiz)) return []

  const raizCompleta = resolve(raiz)
  const encontrados: RepoInfo[] = []

  // A própria raiz pode ser um repositório.
  if (ehRepositorio(raizCompleta)) {
    return [criar(raizCompleta, raizCompleta)]
  }

  await varrer(raizCompleta, raizCompleta, 1, profundidadeMaxima, encontrados)

  const comparar = (a: string, b: string): number =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })

  return encontrados.sort(
    (a, b) => comparar(a.grupo, b.grupo) || comparar(a.nome, b.nome)
  )
}
