import { contextBridge, ipcRenderer } from 'electron'
import type { UpdateStatus } from '../shared/updater'

const api = {
  updater: {
    getStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke('updater:get-status'),
    getVersion: (): Promise<string> => ipcRenderer.invoke('updater:get-version'),
    check: (): Promise<void> => ipcRenderer.invoke('updater:check'),
    install: (): Promise<void> => ipcRenderer.invoke('updater:install'),
    onStatus: (cb: (status: UpdateStatus) => void): (() => void) => {
      const listener = (_e: unknown, status: UpdateStatus): void => cb(status)
      ipcRenderer.on('updater:status', listener)
      return () => ipcRenderer.off('updater:status', listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
