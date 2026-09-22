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
        Baixando {status.version}… {status.percent}%
        <span className="ml-3 inline-block h-1 w-32 overflow-hidden rounded-full bg-border align-middle">
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
      {restantes > 0
        ? `Versão ${status.version} pronta. Reiniciando em ${restantes}s…`
        : `Versão ${status.version} será aplicada ao fechar o app.`}
      <button
        type="button"
        onClick={() => window.api.updater.install()}
        className="ml-3 flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white transition hover:brightness-110 active:scale-95"
      >
        <Icone icon={faArrowsRotate} />
        Reiniciar agora
      </button>
      {restantes > 0 && (
        <button
          type="button"
          onClick={() => window.api.updater.adiar()}
          className="ml-2 rounded-md border border-border px-2.5 py-1 text-xs font-medium transition hover:border-accent active:scale-95"
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
      className={`animate-descer flex items-center gap-2.5 border-b px-4 py-2 text-sm ${
        tom === 'erro'
          ? 'border-red-900/60 bg-red-950/40 text-red-300'
          : 'border-accent/40 bg-accent/10 text-accent-fg'
      }`}
    >
      {icone}
      <span className="flex items-center">{children}</span>
    </div>
  )
}
