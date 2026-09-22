import { useEffect, useState, type ReactNode } from 'react'
import type { UpdateStatus } from '../../../shared/updater'

export default function UpdateBanner(): ReactNode {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    window.api.updater.getStatus().then(setStatus)
    return window.api.updater.onStatus(setStatus)
  }, [])

  if (status.state === 'idle' || status.state === 'checking' || status.state === 'up-to-date') {
    return null
  }

  if (status.state === 'error') {
    return (
      <Bar tone="error">Não foi possível verificar atualizações: {status.message}</Bar>
    )
  }

  if (status.state === 'available') {
    return <Bar>Versão {status.version} encontrada. Baixando…</Bar>
  }

  if (status.state === 'downloading') {
    return (
      <Bar>
        Baixando {status.version}… {status.percent}%
        <span className="ml-3 inline-block h-1 w-32 overflow-hidden rounded-full bg-border align-middle">
          <span
            className="block h-full bg-accent transition-all"
            style={{ width: `${status.percent}%` }}
          />
        </span>
      </Bar>
    )
  }

  return (
    <Bar>
      Versão {status.version} pronta para instalar.
      <button
        type="button"
        onClick={() => window.api.updater.install()}
        className="ml-3 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:brightness-110"
      >
        Reiniciar agora
      </button>
    </Bar>
  )
}

function Bar({ children, tone }: { children: ReactNode; tone?: 'error' }): ReactNode {
  return (
    <div
      className={`flex items-center border-b px-4 py-2 text-sm ${
        tone === 'error'
          ? 'border-red-900/60 bg-red-950/40 text-red-300'
          : 'border-accent/40 bg-accent/10 text-accent-fg'
      }`}
    >
      {children}
    </div>
  )
}
