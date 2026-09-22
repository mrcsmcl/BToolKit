import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import log from 'electron-log'
import { setupApp } from './app'
import { setupRepos } from './repos'
import { checkForUpdates, setupUpdater } from './updater'

// Uma hora entre verificações, para sessões que ficam abertas o dia todo.
const CHECK_INTERVAL_MS = 60 * 60 * 1000

// Rede de segurança: se a primeira pintura não chegar, a janela aparece assim mesmo.
// Sem isso um erro de carregamento deixa o processo vivo e invisível, segurando o lock
// de instância única — e todo clique seguinte no atalho morre calado.
const LIMITE_EXIBICAO_MS = 10_000

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    // Empacotado, o icone da janela vem do proprio executavel; em dev precisa ser dito.
    ...(app.isPackaged ? {} : { icon: join(__dirname, '../../resources/icon.png') }),
    width: 1100,
    height: 720,
    minWidth: 860,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0d12',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0b0d12', symbolColor: '#8b93a7', height: 40 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  let exibida = false
  const exibir = (motivo: string): void => {
    if (exibida || win.isDestroyed()) return
    exibida = true
    clearTimeout(reserva)
    log.info(`janela exibida (${motivo})`)
    win.show()
  }

  const reserva = setTimeout(() => exibir('tempo limite'), LIMITE_EXIBICAO_MS)

  win.once('ready-to-show', () => exibir('ready-to-show'))
  win.webContents.once('did-finish-load', () => exibir('did-finish-load'))

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log.error(`falha ao carregar ${url}: ${desc} (${code})`)
    exibir('did-fail-load')
  })

  win.webContents.on('render-process-gone', (_e, detalhe) =>
    log.error('render process encerrou:', detalhe.reason)
  )

  win.webContents.on('console-message', (_e, nivel, mensagem, linha, origem) => {
    if (nivel >= 2) log.warn(`[renderer] ${mensagem} (${origem}:${linha})`)
  })

  win.on('closed', () => clearTimeout(reserva))

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function focarOuCriar(): void {
  const [win] = BrowserWindow.getAllWindows()

  // Sem janela, o processo primário é inútil para quem clicou no atalho.
  if (!win || win.isDestroyed()) {
    createWindow()
    return
  }

  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) win.show()
  win.focus()
}

// Instância única: a segunda abertura foca a janela existente.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', focarOuCriar)

  app.whenReady().then(() => {
    log.info(`BToolKit ${app.getVersion()} iniciando`)
    setupUpdater()
    setupApp()
    setupRepos()
    createWindow()
    void checkForUpdates()
    setInterval(() => void checkForUpdates(), CHECK_INTERVAL_MS)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
