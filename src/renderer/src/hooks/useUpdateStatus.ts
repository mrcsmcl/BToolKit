import { useEffect, useState } from 'react'
import type { UpdateStatus } from '../../../shared/updater'

/**
 * Estado do updater compartilhado. O banner e o botão do rodapé precisam do mesmo
 * dado — cada um assinando por conta própria evita passar prop por toda a árvore.
 */
export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    void window.api.updater.getStatus().then(setStatus)
    return window.api.updater.onStatus(setStatus)
  }, [])

  return status
}
