import { app, BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'
import electronUpdater from 'electron-updater'
import type { UpdateStatus } from '../shared/updater'

const { autoUpdater } = electronUpdater

/** Margem para o usuário adiar antes do reinício automático. */
const SEGUNDOS_ATE_REINICIAR = 10

let current: UpdateStatus = { state: 'idle' }
let pendingVersion = ''
let contagem: NodeJS.Timeout | null = null

function broadcast(status: UpdateStatus): void {
  current = status
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('updater:status', status)
  }
}

function pararContagem(): void {
  if (contagem) {
    clearInterval(contagem)
    contagem = null
  }
}

/**
 * O instalador é oneClick, então a instalação não mostra assistente nenhum.
 * A contagem existe só para não arrancar a janela de quem está no meio de algo:
 * ao zerar, o app reinicia sozinho; se o usuário adiar, instala ao fechar.
 */
function agendarReinicio(version: string): void {
  pararContagem()
  let restantes = SEGUNDOS_ATE_REINICIAR
  broadcast({ state: 'downloaded', version, segundosParaReiniciar: restantes })

  contagem = setInterval(() => {
    restantes -= 1

    if (restantes <= 0) {
      pararContagem()
      log.info(`instalando ${version} e reiniciando`)
      autoUpdater.quitAndInstall()
      return
    }

    broadcast({ state: 'downloaded', version, segundosParaReiniciar: restantes })
  }, 1000)
}

export function setupUpdater(): void {
  autoUpdater.logger = log
  log.transports.file.level = 'info'

  // Baixa sozinho assim que encontra uma versão nova; se o reinício for adiado,
  // a instalação acontece em silêncio quando o app fechar.
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => broadcast({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => {
    pendingVersion = info.version
    broadcast({ state: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', () => broadcast({ state: 'up-to-date' }))
  autoUpdater.on('download-progress', (p) =>
    broadcast({ state: 'downloading', version: pendingVersion, percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => agendarReinicio(info.version))
  autoUpdater.on('error', (err) => {
    pararContagem()
    broadcast({ state: 'error', message: err?.message ?? String(err) })
  })

  ipcMain.handle('updater:get-status', () => current)
  ipcMain.handle('updater:get-version', () => app.getVersion())
  ipcMain.handle('updater:check', () => checkForUpdates())
  ipcMain.handle('updater:install', () => {
    pararContagem()
    autoUpdater.quitAndInstall()
  })
  ipcMain.handle('updater:adiar', () => {
    // Sai da contagem, mas a instalação continua agendada para o fechamento.
    pararContagem()
    broadcast({ state: 'downloaded', version: pendingVersion, segundosParaReiniciar: 0 })
  })
}

export function checkForUpdates(): void {
  // Sem build empacotado não existe release para comparar.
  if (!app.isPackaged) {
    broadcast({ state: 'up-to-date' })
    return
  }
  autoUpdater.checkForUpdates().catch((err) => log.error('checkForUpdates falhou', err))
}
