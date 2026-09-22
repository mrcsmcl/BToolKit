export type Outcome = 'ok' | 'pulado' | 'falhou'

export interface OperationResult {
  outcome: Outcome
  mensagem: string
  detalhe: string
}

/** Estado de um repositório git encontrado sob a raiz configurada. */
export interface RepoInfo {
  /** Pasta pai relativa à raiz — dois repositórios podem ter o mesmo nome em grupos diferentes. */
  grupo: string
  nome: string
  caminho: string
  branch: string
  alteracoes: number
  /** Entradas em `git stash list`. Torna visível o trabalho guardado pelo checkout. */
  stashes: number
  aheadBehind: string
  temUpstream: boolean
  /** Branches remotas de origin, usadas para alimentar o autocomplete. */
  branchesRemotas: string[]
}

export interface ProgressUpdate {
  runId: number
  concluidos: number
  total: number
  repo: RepoInfo
  resultado: OperationResult
}

export interface BatchSummary {
  runId: number
  ok: number
  pulados: number
  falhas: number
  cancelado: boolean
}

export interface ReposSettings {
  raiz: string
  ultimaBranch: string
}

export type BatchKind = 'refresh' | 'update' | 'checkout'
