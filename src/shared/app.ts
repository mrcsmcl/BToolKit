export interface HistoricoCommit {
  hash: string
  hashCurto: string
  autor: string
  email: string
  data: string
  titulo: string
  corpo: string
}

export interface HistoricoContribuidor {
  nome: string
  email: string
  commits: number
  /** Commit usado para identificar o usuário correspondente na API pública do GitHub. */
  commitHash: string
}

export type AvatarContribuidorResult =
  | { ok: true; usuario: string; dataUrl: string }
  | { ok: false }

export type HistoricoResult =
  | {
      ok: true
      origem: 'git-local' | 'snapshot-empacotado'
      commits: HistoricoCommit[]
      contribuidores: HistoricoContribuidor[]
    }
  | {
      ok: false
      codigo:
        | 'git-indisponivel'
        | 'sem-repositorio'
        | 'sem-commits'
        | 'snapshot-indisponivel'
        | 'erro-inesperado'
      mensagem: string
    }
