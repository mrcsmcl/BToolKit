import { ipcMain, shell } from 'electron'
import pkg from '../../package.json'
import { carregarAvatarContribuidor, carregarHistorico } from './historico'

/**
 * Fonte única da URL: o mesmo campo que o electron-builder usa para publicar.
 * Aceita as formas que o npm grava (git+https://..., ...git) e devolve o endereço
 * que abre no navegador.
 */
function urlRepositorio(): string {
  const bruta = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
  if (!bruta) return ''

  return bruta
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^git:\/\//, 'https://')
}

export function setupApp(): void {
  ipcMain.handle('app:url-repositorio', () => urlRepositorio())
  ipcMain.handle('app:historico', () => carregarHistorico())
  ipcMain.handle('app:avatar-contribuidor', (_evento, commitHash: unknown) =>
    carregarAvatarContribuidor(commitHash, urlRepositorio())
  )

  ipcMain.handle('app:abrir-repositorio', async () => {
    const url = urlRepositorio()

    // Sem parâmetro vindo da tela: a renderer não escolhe o destino, só pede
    // para abrir este endereço.
    if (url.startsWith('https://')) {
      await shell.openExternal(url)
    }
  })
}
