import type { OperationResult, RepoInfo } from '../../shared/repos'
import { resumoErro, runGit, saidaCompleta } from './runner'

export const PARALELISMO_PADRAO = 4

const ok = (mensagem: string, detalhe = ''): OperationResult => ({
  outcome: 'ok',
  mensagem,
  detalhe
})
const pulado = (mensagem: string, detalhe = ''): OperationResult => ({
  outcome: 'pulado',
  mensagem,
  detalhe
})
const falhou = (mensagem: string, detalhe = ''): OperationResult => ({
  outcome: 'falhou',
  mensagem,
  detalhe
})

function contarLinhas(texto: string): number {
  return texto.split('\n').filter((l) => l.trim().length > 0).length
}

async function obterUpstream(caminho: string, signal: AbortSignal): Promise<string | null> {
  const r = await runGit(
    caminho,
    ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
    signal
  )
  return r.ok ? r.stdout.trim() : null
}

async function refExiste(caminho: string, ref: string, signal: AbortSignal): Promise<boolean> {
  const r = await runGit(caminho, ['show-ref', '--verify', '--quiet', ref], signal)
  return r.ok
}

async function contarStashes(caminho: string, signal: AbortSignal): Promise<number> {
  const r = await runGit(caminho, ['stash', 'list'], signal)
  return r.ok ? contarLinhas(r.stdout) : 0
}

export async function listarBranchesRemotas(
  caminho: string,
  signal: AbortSignal
): Promise<string[]> {
  const r = await runGit(
    caminho,
    ['for-each-ref', '--format=%(refname:strip=3)', 'refs/remotes/origin'],
    signal
  )
  if (!r.ok) return []

  return r.stdout
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => b.length > 0 && b !== 'HEAD')
}

function formatarAheadBehind(saida: string): string {
  const partes = saida.split(/[\t ]+/).filter((p) => p.length > 0)
  if (partes.length < 2) return '-'

  const atras = Number(partes[0])
  const frente = Number(partes[1])
  if (Number.isNaN(atras) || Number.isNaN(frente)) return '-'
  if (atras === 0 && frente === 0) return 'em dia'

  const texto: string[] = []
  if (atras > 0) texto.push(`${atras} atrás`)
  if (frente > 0) texto.push(`${frente} à frente`)
  return texto.join(', ')
}

/**
 * Junta os avisos ao texto principal. Todo desfecho passa por aqui: um aviso de stash
 * nunca pode ficar de fora da mensagem, inclusive quando o repositório é pulado.
 */
function comporMensagem(principal: string, avisos: string[]): string {
  return avisos.length === 0 ? principal : `${principal} - ${avisos.join(' | ')}`
}

// ---------------------------------------------------------------------- Refresh

/** Lê o estado local do repositório. Não acessa a rede. */
export async function refresh(repo: RepoInfo, signal: AbortSignal): Promise<OperationResult> {
  const branch = await runGit(repo.caminho, ['rev-parse', '--abbrev-ref', 'HEAD'], signal)
  if (!branch.ok) {
    repo.branch = '?'
    return falhou('não foi possível ler a branch', saidaCompleta(branch))
  }

  let nomeBranch = branch.stdout.trim()
  if (nomeBranch === 'HEAD') {
    const sha = await runGit(repo.caminho, ['rev-parse', '--short', 'HEAD'], signal)
    nomeBranch = `(detached ${sha.stdout.trim()})`
  }
  repo.branch = nomeBranch

  const status = await runGit(repo.caminho, ['status', '--porcelain'], signal)
  repo.alteracoes = status.ok ? contarLinhas(status.stdout) : 0

  // Trabalho guardado precisa ficar visível na tabela, e não só na mensagem da operação.
  repo.stashes = await contarStashes(repo.caminho, signal)

  const upstream = await obterUpstream(repo.caminho, signal)
  repo.temUpstream = upstream !== null

  if (upstream === null) {
    repo.aheadBehind = 'sem upstream'
  } else {
    const contagem = await runGit(
      repo.caminho,
      ['rev-list', '--left-right', '--count', '@{u}...HEAD'],
      signal
    )
    repo.aheadBehind = contagem.ok ? formatarAheadBehind(contagem.stdout) : '-'
  }

  repo.branchesRemotas = await listarBranchesRemotas(repo.caminho, signal)

  return ok('carregado')
}

// ----------------------------------------------------------------------- Update

/** Avança a branch atual até o upstream, apenas se for fast-forward. */
async function atualizarPorFastForward(
  repo: RepoInfo,
  signal: AbortSignal
): Promise<OperationResult> {
  const upstream = await obterUpstream(repo.caminho, signal)
  if (upstream === null) {
    await refresh(repo, signal)
    return pulado('sem upstream configurado')
  }

  const merge = await runGit(repo.caminho, ['merge', '--ff-only', '@{u}'], signal)
  await refresh(repo, signal)

  if (merge.ok) {
    const jaAtualizado = /up to date/i.test(merge.stdout) || /atualizado/i.test(merge.stdout)
    return ok(jaAtualizado ? 'já estava atualizado' : 'atualizado', saidaCompleta(merge))
  }

  const erro = resumoErro(merge)
  const mensagem = /local changes|would be overwritten/i.test(erro)
    ? 'alterações locais impedem a atualização; resolva manualmente'
    : 'a branch divergiu do remoto; resolva manualmente'

  return falhou(mensagem, saidaCompleta(merge))
}

/** fetch --prune seguido de merge --ff-only. Nunca cria merge nem reescreve histórico. */
export async function update(repo: RepoInfo, signal: AbortSignal): Promise<OperationResult> {
  const fetch = await runGit(repo.caminho, ['fetch', '--prune', 'origin'], signal)
  if (!fetch.ok) {
    await refresh(repo, signal)
    return falhou(`fetch falhou: ${resumoErro(fetch)}`, saidaCompleta(fetch))
  }

  return atualizarPorFastForward(repo, signal)
}

// --------------------------------------------------------------------- Checkout

/**
 * Leva o repositório para a branch pedida. Faz stash automático das alterações pendentes
 * e pula o repositório quando a branch não existe nem local nem em origin.
 */
export async function checkout(
  repo: RepoInfo,
  branch: string,
  signal: AbortSignal
): Promise<OperationResult> {
  const avisos: string[] = []
  const detalhe: string[] = []

  if (repo.branch === branch) {
    // Já está na branch pedida: só precisa atualizar.
    return atualizarPorFastForward(repo, signal)
  }

  // 1. Busca refs novas para enxergar branches recém-criadas no remoto.
  const fetch = await runGit(repo.caminho, ['fetch', '--prune', 'origin'], signal)
  const fetchOk = fetch.ok
  if (!fetchOk) {
    avisos.push(`fetch falhou: ${resumoErro(fetch)}`)
    detalhe.push(saidaCompleta(fetch))
  }

  // 2. A branch existe? Verificar ANTES de tocar na árvore de trabalho: um repositório
  //    que não vai trocar de branch não pode ter as alterações guardadas no stash.
  const temLocal = await refExiste(repo.caminho, `refs/heads/${branch}`, signal)
  const temRemota =
    !temLocal && (await refExiste(repo.caminho, `refs/remotes/origin/${branch}`, signal))

  if (!temLocal && !temRemota) {
    // Se o fetch falhou, o motivo real é o fetch, e não a ausência da branch.
    return fetchOk
      ? pulado(comporMensagem('branch inexistente neste repositório', avisos), detalhe.join('\n'))
      : falhou(comporMensagem(`fetch falhou: ${resumoErro(fetch)}`, avisos), detalhe.join('\n'))
  }

  // 3. Só agora as alterações pendentes vão para o stash, identificado por data/hora.
  if (repo.alteracoes > 0) {
    const quando = new Date().toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    })
    const marca = `BToolKit ${quando}`
    const stash = await runGit(repo.caminho, ['stash', 'push', '-u', '-m', marca], signal)
    if (!stash.ok) {
      return falhou(
        comporMensagem(`stash falhou: ${resumoErro(stash)}`, avisos),
        saidaCompleta(stash)
      )
    }

    avisos.push(`alterações guardadas no stash "${marca}"`)
    detalhe.push(saidaCompleta(stash))
    repo.alteracoes = 0
  }

  // 4. Branch local existente, ou criação local rastreando origin.
  const co = temLocal
    ? await runGit(repo.caminho, ['checkout', branch], signal)
    : await runGit(repo.caminho, ['checkout', '-b', branch, '--track', `origin/${branch}`], signal)

  detalhe.push(saidaCompleta(co))

  if (!co.ok) {
    await refresh(repo, signal)
    return falhou(comporMensagem(`checkout falhou: ${resumoErro(co)}`, avisos), detalhe.join('\n'))
  }

  // 5. Já deixa a branch recém-selecionada atualizada.
  const ff = await atualizarPorFastForward(repo, signal)
  if (ff.detalhe) detalhe.push(ff.detalhe)

  const mensagem =
    ff.outcome === 'falhou'
      ? `está na branch ${branch}, mas ${ff.mensagem}`
      : ff.outcome === 'ok'
        ? `na branch ${branch}: ${ff.mensagem}`
        : `na branch ${branch}`

  return {
    outcome: ff.outcome === 'falhou' ? 'falhou' : 'ok',
    mensagem: comporMensagem(mensagem, avisos),
    detalhe: detalhe.join('\n')
  }
}

// ------------------------------------------------------------------ Lote / util

/** Executa uma operação sobre vários repositórios com paralelismo limitado. */
export async function executarEmLote(
  repos: RepoInfo[],
  operacao: (repo: RepoInfo, signal: AbortSignal) => Promise<OperationResult>,
  aoConcluir: (repo: RepoInfo, resultado: OperationResult, concluidos: number) => void,
  signal: AbortSignal,
  paralelismo = PARALELISMO_PADRAO
): Promise<void> {
  const fila = [...repos]
  let concluidos = 0

  const trabalhador = async (): Promise<void> => {
    for (;;) {
      const repo = fila.shift()
      if (!repo || signal.aborted) return

      let resultado: OperationResult
      try {
        resultado = await operacao(repo, signal)
      } catch (e) {
        resultado = falhou(`falhou: ${e instanceof Error ? e.message : String(e)}`)
      }

      // Um git morto pelo cancelamento devolve erro; isso nao e falha do repositorio.
      if (signal.aborted) {
        resultado = pulado('cancelado')
      }

      concluidos += 1
      aoConcluir(repo, resultado, concluidos)
    }
  }

  await Promise.all(Array.from({ length: Math.min(paralelismo, repos.length) }, trabalhador))
}
