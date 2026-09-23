import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import log from 'electron-log'
import type {
  AvatarContribuidorResult,
  HistoricoCommit,
  HistoricoContribuidor,
  HistoricoResult
} from '../shared/app'
import { runGit } from './repos/runner'

const SEPARADOR_CAMPO = '\0'
const CAMPOS_POR_COMMIT = 7
const FORMATO_LOG = '%H%x00%h%x00%aN%x00%aE%x00%aI%x00%s%x00%b'

let cache: Promise<HistoricoResult> | null = null
const cacheAvatares = new Map<string, Promise<AvatarContribuidorResult>>()

function contribuidoresDosCommits(commits: HistoricoCommit[]): HistoricoContribuidor[] {
  const contagem = new Map<string, HistoricoContribuidor>()

  for (const commit of commits) {
    const chave = `${commit.autor}\0${commit.email}`
    const existente = contagem.get(chave)
    if (existente) existente.commits += 1
    else
      contagem.set(chave, {
        nome: commit.autor,
        email: commit.email,
        commits: 1,
        commitHash: commit.hash
      })
  }

  return [...contagem.values()].sort(
    (a, b) => b.commits - a.commits || a.nome.localeCompare(b.nome, 'pt-BR')
  )
}

function parsearCommits(saida: string): HistoricoCommit[] {
  const campos = saida.split(SEPARADOR_CAMPO)
  if (campos.at(-1) === '') campos.pop()

  const commits: HistoricoCommit[] = []
  for (let indice = 0; indice + CAMPOS_POR_COMMIT <= campos.length; indice += CAMPOS_POR_COMMIT) {
    const [hash, hashCurto, autor, email, data, titulo, corpo] = campos.slice(
      indice,
      indice + CAMPOS_POR_COMMIT
    )
    if (!/^[0-9a-f]{40}$/i.test(hash ?? '')) continue

    commits.push({
      hash,
      hashCurto: hashCurto ?? hash.slice(0, 7),
      autor: autor || 'Autor desconhecido',
      email: email ?? '',
      data: data ?? '',
      titulo: titulo || 'Commit sem título',
      corpo: (corpo ?? '').trim()
    })
  }

  return commits
}

function snapshotValido(valor: unknown): valor is Extract<HistoricoResult, { ok: true }> {
  if (!valor || typeof valor !== 'object') return false
  const candidato = valor as Partial<Extract<HistoricoResult, { ok: true }>>
  return candidato.ok === true && Array.isArray(candidato.commits) && Array.isArray(candidato.contribuidores)
}

async function carregarSnapshot(): Promise<HistoricoResult> {
  try {
    const conteudo = await readFile(join(process.resourcesPath, 'historico.json'), 'utf8')
    const snapshot: unknown = JSON.parse(conteudo)
    if (!snapshotValido(snapshot)) throw new Error('formato de snapshot inválido')
    return { ...snapshot, origem: 'snapshot-empacotado' }
  } catch (erro) {
    log.warn('histórico empacotado indisponível', erro)
    return {
      ok: false,
      codigo: 'snapshot-indisponivel',
      mensagem: 'O histórico não foi incluído nesta instalação.'
    }
  }
}

async function carregarGitLocal(): Promise<HistoricoResult> {
  const raiz = await runGit(app.getAppPath(), ['rev-parse', '--show-toplevel'])
  if (!raiz.ok) {
    const gitAusente = raiz.stderr.includes('não foi possível executar o git')
    return {
      ok: false,
      codigo: gitAusente ? 'git-indisponivel' : 'sem-repositorio',
      mensagem: gitAusente
        ? 'Git não está disponível para ler o histórico.'
        : 'A pasta atual não contém o histórico Git do BToolKit.'
    }
  }

  const resultado = await runGit(raiz.stdout.trim(), [
    'log',
    '-z',
    '--date=iso-strict',
    `--format=${FORMATO_LOG}`,
    'HEAD',
    '--'
  ])

  if (!resultado.ok) {
    return {
      ok: false,
      codigo: 'sem-commits',
      mensagem: 'Não foi possível encontrar commits no repositório do BToolKit.'
    }
  }

  const commits = parsearCommits(resultado.stdout)
  if (commits.length === 0) {
    return { ok: false, codigo: 'sem-commits', mensagem: 'O repositório ainda não possui commits.' }
  }

  return {
    ok: true,
    origem: 'git-local',
    commits,
    contribuidores: contribuidoresDosCommits(commits)
  }
}

async function carregar(): Promise<HistoricoResult> {
  try {
    return app.isPackaged ? await carregarSnapshot() : await carregarGitLocal()
  } catch (erro) {
    log.error('falha inesperada ao carregar histórico', erro)
    return {
      ok: false,
      codigo: 'erro-inesperado',
      mensagem: 'Não foi possível carregar o histórico do projeto.'
    }
  }
}

export function carregarHistorico(): Promise<HistoricoResult> {
  cache ??= carregar()
  return cache
}


async function buscarAvatar(
  commitHash: string,
  urlRepositorio: string
): Promise<AvatarContribuidorResult> {
  const repositorio = /^https:\/\/github\.com\/([^/]+)\/([^/]+)$/.exec(urlRepositorio)
  if (!repositorio) return { ok: false }

  try {
    const [, owner, repo] = repositorio
    const respostaCommit = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${commitHash}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'BToolKit'
        },
        signal: AbortSignal.timeout(8_000)
      }
    )
    if (!respostaCommit.ok) return { ok: false }

    const payload = (await respostaCommit.json()) as {
      author?: { login?: unknown; avatar_url?: unknown } | null
    }
    const usuario = payload.author?.login
    const avatarUrl = payload.author?.avatar_url
    if (typeof usuario !== 'string' || typeof avatarUrl !== 'string') return { ok: false }

    const url = new URL(avatarUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'avatars.githubusercontent.com') {
      return { ok: false }
    }
    url.searchParams.set('s', '80')

    const respostaAvatar = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!respostaAvatar.ok) return { ok: false }

    const tipo = respostaAvatar.headers.get('content-type')?.split(';')[0]
    if (!tipo?.startsWith('image/')) return { ok: false }

    const bytes = Buffer.from(await respostaAvatar.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > 1_000_000) return { ok: false }

    return { ok: true, usuario, dataUrl: `data:${tipo};base64,${bytes.toString('base64')}` }
  } catch (erro) {
    log.debug(`avatar GitHub indisponível para ${commitHash}`, erro)
    return { ok: false }
  }
}

/**
 * Busca somente quando a linha do contribuidor fica visível. O resultado é mantido
 * apenas em memória durante a sessão; nenhuma imagem é gravada no disco.
 */
export function carregarAvatarContribuidor(
  commitHash: unknown,
  urlRepositorio: string
): Promise<AvatarContribuidorResult> {
  if (typeof commitHash !== 'string' || !/^[0-9a-f]{40}$/i.test(commitHash)) {
    return Promise.resolve({ ok: false })
  }

  let requisicao = cacheAvatares.get(commitHash)
  if (!requisicao) {
    requisicao = buscarAvatar(commitHash, urlRepositorio)
    cacheAvatares.set(commitHash, requisicao)
  }
  return requisicao
}
