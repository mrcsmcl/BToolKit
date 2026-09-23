import type { ReactNode } from 'react'
import { useUpdateStatus } from '../hooks/useUpdateStatus'
import { Icone, faArrowsRotate, faCircleCheck, faDownload, faTriangleExclamation } from './Icone'

export default function UpdateBanner(): ReactNode {
  const status = useUpdateStatus()

  if (status.state === 'idle' || status.state === 'checking' || status.state === 'up-to-date') {
    return null
  }

  if (status.state === 'error') {
    return (
      <Bar tom="erro" icone={<Icone icon={faTriangleExclamation} />}>
        Não foi possível verificar atualizações: {status.message}
      </Bar>
    )
  }

  if (status.state === 'available') {
    return (
      <Bar icone={<Icone icon={faDownload} className="animate-pulsar" />}>
        Versão {status.version} encontrada. Baixando…
      </Bar>
    )
  }

  if (status.state === 'downloading') {
    return (
      <Bar icone={<Icone icon={faDownload} className="animate-pulsar" />}>
        <span>Baixando {status.version}… {status.percent}%</span>
        <span
          role="progressbar"
          aria-label={`Download da versão ${status.version}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={status.percent}
          className="ml-2 inline-block h-1 w-32 overflow-hidden rounded-full bg-border align-middle"
        >
          <span
            className="block h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${status.percent}%` }}
          />
        </span>
      </Bar>
    )
  }

  const restantes = status.segundosParaReiniciar

  return (
    <Bar icone={<Icone icon={faCircleCheck} />}>
      <span>
        {restantes > 0
          ? `Versão ${status.version} pronta. Reiniciando em ${restantes}s…`
          : `Versão ${status.version} será aplicada ao fechar o app.`}
      </span>
      <button
        type="button"
        onClick={() => window.api.updater.install()}
        className="ml-2 flex h-7 items-center gap-1.5 rounded-md bg-accent px-2.5 text-[11px] font-semibold text-bg transition hover:brightness-110 active:scale-95"
      >
        <Icone icon={faArrowsRotate} />
        Reiniciar agora
      </button>
      {restantes > 0 && (
        <button
          type="button"
          onClick={() => window.api.updater.adiar()}
          className="ml-1 h-7 rounded-md border border-border px-2.5 text-[11px] font-medium transition hover:border-muted active:scale-95"
        >
          Agora não
        </button>
      )}
    </Bar>
  )
}

function Bar({
  children,
  icone,
  tom
}: {
  children: ReactNode
  icone: ReactNode
  tom?: 'erro'
}): ReactNode {
  return (
    <div
      role={tom === 'erro' ? 'alert' : 'status'}
      className={`animate-descer flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2 text-xs ${
        tom === 'erro'
          ? 'border-red-900/60 bg-red-950/40 text-red-300'
          : 'border-border bg-surface text-accent-fg'
      }`}
    >
      <span className="shrink-0">{icone}</span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-y-2">{children}</span>
    </div>
  )
}
