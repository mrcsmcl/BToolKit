import { app, BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'
import electronUpdater from 'electron-updater'
import type { UpdateStatus } from '../shared/updater'

const { autoUpdater } = electronUpdater

let current: UpdateStatus = { state: 'idle' }
let pendingVersion = ''

function broadcast(status: UpdateStatus): void {
  current = status
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('updater:status', status)
  }
}

export function setupUpdater(): void {
  autoUpdater.logger = log
  log.transports.file.level = 'info'

  // Baixa sozinho assim que encontra uma versão nova; instala ao fechar o app.
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
  autoUpdater.on('update-downloaded', (info) =>
    broadcast({ state: 'downloaded', version: info.version })
  )
  autoUpdater.on('error', (err) =>
    broadcast({ state: 'error', message: err?.message ?? String(err) })
  )

  ipcMain.handle('updater:get-status', () => current)
  ipcMain.handle('updater:get-version', () => app.getVersion())
  ipcMain.handle('updater:check', () => checkForUpdates())
  ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall())
}

export function checkForUpdates(): void {
  // Sem build empacotado não existe release para comparar.
  if (!app.isPackaged) {
    broadcast({ state: 'up-to-date' })
    return
  }
  autoUpdater.checkForUpdates().catch((err) => log.error('checkForUpdates falhou', err))
}
