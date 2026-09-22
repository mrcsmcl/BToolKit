import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import log from 'electron-log'
import type {
  BatchKind,
  BatchSummary,
  ReposSettings,
  ProgressUpdate,
  RepoInfo
} from '../../shared/repos'
import { checkout, executarEmLote, refresh, update } from './operations'
import { versaoGit } from './runner'
import { PROFUNDIDADE_PADRAO, scan } from './scanner'

const RAIZ_PREFERIDA = 'C:\\Git'

let execucaoAtual: { runId: number; controle: AbortController } | null = null
let proximoRunId = 1

// --------------------------------------------------------------- Preferências

function arquivoConfig(): string {
  return join(app.getPath('userData'), 'repos.json')
}

/** C:\Git quando existe; senão a pasta de documentos do usuário. */
function raizPadrao(): string {
  if (existsSync(RAIZ_PREFERIDA)) return RAIZ_PREFERIDA
  return app.getPath('documents')
}

function carregarConfig(): ReposSettings {
  let config: ReposSettings = { raiz: '', ultimaBranch: '' }

  try {
    const arquivo = arquivoConfig()
    if (existsSync(arquivo)) {
      config = { ...config, ...JSON.parse(readFileSync(arquivo, 'utf8')) }
    }
  } catch {
    // configuração corrompida ou inacessível: volta ao padrão
  }

  // Cobre a primeira execução e o caso da pasta salva não existir mais.
  if (!config.raiz.trim() || !existsSync(config.raiz)) {
    config.raiz = raizPadrao()
  }

  return config
}

function salvarConfig(config: ReposSettings): void {
  try {
    const arquivo = arquivoConfig()
    mkdirSync(dirname(arquivo), { recursive: true })
    writeFileSync(arquivo, JSON.stringify(config, null, 2), 'utf8')
  } catch (e) {
    // não vale interromper o usuário por falha ao salvar preferência
    log.warn('não foi possível salvar as preferências dos repositórios', e)
  }
}

// ----------------------------------------------------------------- Transmissão

function emitir(canal: string, carga: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(canal, carga)
  }
}

// ------------------------------------------------------------------------ IPC

export function setupRepos(): void {
  ipcMain.handle('repos:versao-git', () => versaoGit())

  ipcMain.handle('repos:config-ler', () => carregarConfig())
  ipcMain.handle('repos:config-gravar', (_e, config: ReposSettings) => salvarConfig(config))

  ipcMain.handle('repos:escolher-pasta', async (_e, atual: string) => {
    const janela = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const opcoes = {
      title: 'Pasta que contém os repositórios',
      properties: ['openDirectory' as const],
      defaultPath: existsSync(atual) ? atual : raizPadrao()
    }

    const r = janela
      ? await dialog.showOpenDialog(janela, opcoes)
      : await dialog.showOpenDialog(opcoes)

    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('repos:abrir-pasta', (_e, caminho: string) => shell.openPath(caminho))

  ipcMain.handle('repos:procurar', (_e, raiz: string) => scan(raiz, PROFUNDIDADE_PADRAO))

  ipcMain.handle(
    'repos:executar',
    async (_e, kind: BatchKind, repos: RepoInfo[], branch: string): Promise<BatchSummary> => {
      // Uma execução por vez: a anterior é cancelada em vez de disputar os mesmos repos.
      execucaoAtual?.controle.abort()

      const runId = proximoRunId++
      const controle = new AbortController()
      execucaoAtual = { runId, controle }

      const operacao =
        kind === 'checkout'
          ? (repo: RepoInfo, s: AbortSignal) => checkout(repo, branch, s)
          : kind === 'update'
            ? update
            : refresh

      let ok = 0
      let pulados = 0
      let falhas = 0
      const total = repos.length

      try {
        await executarEmLote(
          repos,
          operacao,
          (repo, resultado, concluidos) => {
            if (resultado.outcome === 'ok') ok += 1
            else if (resultado.outcome === 'pulado') pulados += 1
            else falhas += 1

            const carga: ProgressUpdate = { runId, concluidos, total, repo, resultado }
            emitir('repos:progresso', carga)
          },
          controle.signal
        )
      } finally {
        if (execucaoAtual?.runId === runId) execucaoAtual = null
      }

      return { runId, ok, pulados, falhas, cancelado: controle.signal.aborted }
    }
  )

  ipcMain.handle('repos:cancelar', () => {
    execucaoAtual?.controle.abort()
  })
}
