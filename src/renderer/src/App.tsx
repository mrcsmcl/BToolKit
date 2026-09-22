import { useEffect, useMemo, useState, type ReactNode } from 'react'
import UpdateBanner from './components/UpdateBanner'
import { tools } from './tools/registry'

export default function App(): ReactNode {
  const [activeId, setActiveId] = useState(tools[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.updater.getVersion().then(setVersion)
  }, [])

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase()
    const matched = term
      ? tools.filter(
          (t) =>
            t.name.toLowerCase().includes(term) || t.description.toLowerCase().includes(term)
        )
      : tools
    return matched.reduce<Record<string, typeof tools>>((acc, tool) => {
      ;(acc[tool.group] ??= []).push(tool)
      return acc
    }, {})
  }, [query])

  const active = tools.find((t) => t.id === activeId)

  return (
    <div className="flex h-full flex-col">
      <header
        className="flex h-10 shrink-0 items-center px-4 text-sm font-semibold tracking-wide"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        BToolKit
      </header>

      <UpdateBanner />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
          <div className="p-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ferramenta…"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
            />
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {Object.entries(groups).map(([group, items]) => (
              <div key={group} className="mb-3">
                <p className="px-2 py-1 text-[11px] font-semibold tracking-widest text-muted uppercase">
                  {group}
                </p>
                {items.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setActiveId(tool.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition ${
                      tool.id === activeId
                        ? 'bg-accent/15 text-accent-fg'
                        : 'text-fg hover:bg-surface-2'
                    }`}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-xs">
                      {tool.glyph}
                    </span>
                    {tool.name}
                  </button>
                ))}
              </div>
            ))}
            {Object.keys(groups).length === 0 && (
              <p className="px-2 py-4 text-sm text-muted">
                {tools.length === 0 ? 'Nenhuma ferramenta ainda.' : 'Nada encontrado.'}
              </p>
            )}
          </nav>

          <footer className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted">
            <span>v{version}</span>
            <button
              type="button"
              onClick={() => window.api.updater.check()}
              className="hover:text-accent-fg"
            >
              Verificar atualização
            </button>
          </footer>
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto">
          {active ? (
            <div className="mx-auto max-w-3xl p-6">
              <h1 className="text-xl font-semibold">{active.name}</h1>
              <p className="mt-1 mb-6 text-sm text-muted">{active.description}</p>
              <active.Component />
            </div>
          ) : (
            <div className="grid h-full place-items-center p-6 text-center">
              <div>
                <p className="text-sm text-muted">
                  {tools.length === 0
                    ? 'Nenhuma ferramenta registrada ainda.'
                    : 'Selecione uma ferramenta na barra lateral.'}
                </p>
                {tools.length === 0 && (
                  <p className="mt-2 text-xs text-muted">
                    Adicione a primeira em <code>src/renderer/src/tools/registry.ts</code>.
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
