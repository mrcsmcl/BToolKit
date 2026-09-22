import { spawn } from 'node:child_process'

/** Saída bruta de um comando git. Exit code diferente de zero não vira exceção. */
export interface GitResult {
  exitCode: number
  stdout: string
  stderr: string
  ok: boolean
}

const TEMPO_LIMITE_MS = 120_000

/** Executa o git por processo, preservando credential manager, git-lfs e .gitconfig do usuário. */
export function runGit(
  repoPath: string,
  args: string[],
  signal?: AbortSignal
): Promise<GitResult> {
  return new Promise((resolve) => {
    const child = spawn('git', ['-C', repoPath, '-c', 'core.quotepath=false', ...args], {
      windowsHide: true,
      env: {
        ...process.env,
        // Impede que um prompt de credencial em console trave a operação esperando stdin.
        // A janela gráfica do Git Credential Manager continua funcionando normalmente.
        GIT_TERMINAL_PROMPT: '0',
        GIT_OPTIONAL_LOCKS: '0'
      }
    })

    let stdout = ''
    let stderr = ''
    let encerrado = false

    const finalizar = (r: GitResult): void => {
      if (encerrado) return
      encerrado = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', aoCancelar)
      resolve(r)
    }

    const timer = setTimeout(() => {
      child.kill()
      finalizar({
        exitCode: -1,
        stdout: '',
        stderr: `tempo limite de ${TEMPO_LIMITE_MS / 1000} segundos excedido`,
        ok: false
      })
    }, TEMPO_LIMITE_MS)

    const aoCancelar = (): void => {
      child.kill()
      finalizar({ exitCode: -1, stdout: '', stderr: 'cancelado', ok: false })
    }

    if (signal?.aborted) {
      aoCancelar()
      return
    }
    signal?.addEventListener('abort', aoCancelar, { once: true })

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (c: string) => (stdout += c))
    child.stderr.on('data', (c: string) => (stderr += c))

    child.on('error', (err) =>
      finalizar({
        exitCode: -1,
        stdout: '',
        stderr: `não foi possível executar o git: ${err.message}`,
        ok: false
      })
    )

    child.on('close', (code) =>
      finalizar({ exitCode: code ?? -1, stdout, stderr, ok: code === 0 })
    )
  })
}

/** Primeira linha útil da saída, para exibir no status da tabela. */
export function resumoErro(r: GitResult): string {
  const texto = r.stderr.trim() ? r.stderr : r.stdout
  const linha = texto
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  return linha ?? `git saiu com código ${r.exitCode}`
}

export function saidaCompleta(r: GitResult): string {
  return [r.stdout.trimEnd(), r.stderr.trimEnd()].filter((s) => s.length > 0).join('\n')
}

export async function versaoGit(): Promise<{ disponivel: boolean; versao: string }> {
  const r = await runGit(process.cwd(), ['--version'])
  return { disponivel: r.ok, versao: r.stdout.trim() }
}
