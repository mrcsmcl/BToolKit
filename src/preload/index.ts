import { contextBridge, ipcRenderer } from 'electron'
import type {
  BatchKind,
  BatchSummary,
  ReposSettings,
  ProgressUpdate,
  RepoInfo
} from '../shared/repos'
import type { UpdateStatus } from '../shared/updater'

const api = {
  updater: {
    getStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke('updater:get-status'),
    getVersion: (): Promise<string> => ipcRenderer.invoke('updater:get-version'),
    check: (): Promise<void> => ipcRenderer.invoke('updater:check'),
    install: (): Promise<void> => ipcRenderer.invoke('updater:install'),
    adiar: (): Promise<void> => ipcRenderer.invoke('updater:adiar'),
    onStatus: (cb: (status: UpdateStatus) => void): (() => void) => {
      const listener = (_e: unknown, status: UpdateStatus): void => cb(status)
      ipcRenderer.on('updater:status', listener)
      return () => ipcRenderer.off('updater:status', listener)
    }
  },

  repos: {
    versaoGit: (): Promise<{ disponivel: boolean; versao: string }> =>
      ipcRenderer.invoke('repos:versao-git'),
    lerConfig: (): Promise<ReposSettings> => ipcRenderer.invoke('repos:config-ler'),
    gravarConfig: (config: ReposSettings): Promise<void> =>
      ipcRenderer.invoke('repos:config-gravar', config),
    escolherPasta: (atual: string): Promise<string | null> =>
      ipcRenderer.invoke('repos:escolher-pasta', atual),
    abrirPasta: (caminho: string): Promise<string> =>
      ipcRenderer.invoke('repos:abrir-pasta', caminho),
    procurar: (raiz: string): Promise<RepoInfo[]> => ipcRenderer.invoke('repos:procurar', raiz),
    executar: (kind: BatchKind, repos: RepoInfo[], branch: string): Promise<BatchSummary> =>
      ipcRenderer.invoke('repos:executar', kind, repos, branch),
    cancelar: (): Promise<void> => ipcRenderer.invoke('repos:cancelar'),
    onProgresso: (cb: (p: ProgressUpdate) => void): (() => void) => {
      const listener = (_e: unknown, p: ProgressUpdate): void => cb(p)
      ipcRenderer.on('repos:progresso', listener)
      return () => ipcRenderer.off('repos:progresso', listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
