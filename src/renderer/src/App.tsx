import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import logo from './assets/logo.png'
import { Icone, faArrowsRotate, faCircleCheck, faGithub } from './components/Icone'
import UpdateBanner from './components/UpdateBanner'
import { useUpdateStatus } from './hooks/useUpdateStatus'
import { tools } from './tools/registry'

/** Tempo mínimo de giro, para a resposta não sumir antes de ser vista. */
const PISO_GIRO_MS = 900

export default function App(): ReactNode {
  const [activeId, setActiveId] = useState(tools[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [version, setVersion] = useState('')
  const [repositorio, setRepositorio] = useState('')
  const [checando, setChecando] = useState(false)
  const [semNovidade, setSemNovidade] = useState(false)
  const status = useUpdateStatus()
  const timerConfirmacao = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    void window.api.updater.getVersion().then(setVersion)
    void window.api.app.urlRepositorio().then(setRepositorio)
    return () => clearTimeout(timerConfirmacao.current)
  }, [])

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase()
    const matched = term
      ? tools.filter(
          (t) => t.name.toLowerCase().includes(term) || t.description.toLowerCase().includes(term)
        )
      : tools
    return matched.reduce<Record<string, typeof tools>>((acc, tool) => {
      ;(acc[tool.group] ??= []).push(tool)
      return acc
    }, {})
  }, [query])

  const active = tools.find((t) => t.id === activeId)

  /**
   * O giro é comandado pelo clique, não pelo estado 'checking' do updater.
   * Em build não empacotado esse estado nunca chega, e mesmo empacotado a
   * consulta às vezes responde rápido demais para o olho registrar — daí o
   * piso de tempo.
   */
  async function verificarAtualizacao(): Promise<void> {
    if (checando) return

    setChecando(true)
    setSemNovidade(false)
    clearTimeout(timerConfirmacao.current)
    const inicio = Date.now()

    let atualizado = false
    try {
      await window.api.updater.check()
      // Lido do processo principal, e não do estado desta render, que já está velho.
      atualizado = (await window.api.updater.getStatus()).state === 'up-to-date'
    } finally {
      const restante = PISO_GIRO_MS - (Date.now() - inicio)
      if (restante > 0) await new Promise((r) => setTimeout(r, restante))
      setChecando(false)
    }

    // Sem novidade o banner não aparece; sem esta confirmação o clique ficaria sem resposta.
    // Só vale para a verificação pedida pelo usuário — a automática da inicialização é muda.
    if (atualizado) {
      setSemNovidade(true)
      timerConfirmacao.current = setTimeout(() => setSemNovidade(false), 2500)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header
        className="flex h-10 shrink-0 items-center gap-2 px-4"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <img src={logo} alt="" className="h-5 w-5" />
        <span className="text-sm font-semibold tracking-wide">BToolKit</span>
      </header>

      <UpdateBanner />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
          <div className="p-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ferramenta…"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/25"
            />
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {Object.entries(groups).map(([group, items]) => (
              <div key={group} className="mb-3">
                <p className="px-2 py-1 text-[11px] font-semibold tracking-widest text-muted uppercase">
                  {group}
                </p>
                {items.map((tool) => {
                  const ativo = tool.id === activeId
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => setActiveId(tool.id)}
                      className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-all duration-200 ${
                        ativo
                          ? 'bg-accent/15 text-accent-fg'
                          : 'text-fg hover:translate-x-0.5 hover:bg-surface-2'
                      }`}
                    >
                      {/* Marcador da ferramenta ativa: cresce em vez de piscar. */}
                      <span
                        className={`absolute top-1/2 left-0 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-all duration-200 ${
                          ativo ? 'h-5 opacity-100' : 'h-0 opacity-0'
                        }`}
                      />
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border text-xs transition-colors duration-200 ${
                          ativo
                            ? 'border-accent/50 bg-accent/20'
                            : 'border-border bg-surface-2 group-hover:border-accent/40'
                        }`}
                      >
                        {tool.glyph}
                      </span>
                      {tool.name}
                    </button>
                  )
                })}
              </div>
            ))}
            {Object.keys(groups).length === 0 && (
              <p className="animate-surgir px-2 py-4 text-sm text-muted">
                {tools.length === 0 ? 'Nenhuma ferramenta ainda.' : 'Nada encontrado.'}
              </p>
            )}
          </nav>

          <footer className="flex items-center gap-3 border-t border-border px-3 py-2 text-xs text-muted">
            <button
              type="button"
              onClick={() => window.api.app.abrirRepositorio()}
              title={repositorio ? `Contribua: ${repositorio}` : 'Repositório do projeto'}
              aria-label="Abrir o repositório no GitHub"
              className="flex items-center transition-transform duration-200 hover:scale-110 hover:text-fg"
            >
              <Icone icon={faGithub} />
            </button>
            <span>v{version}</span>
            <button
              type="button"
              onClick={verificarAtualizacao}
              disabled={checando}
              title="Verificar atualização"
              aria-label="Verificar atualização"
              aria-busy={checando}
              className="ml-auto flex items-center gap-1.5 transition hover:text-accent-fg disabled:text-accent-fg"
            >
              {semNovidade ? (
                <>
                  <Icone icon={faCircleCheck} className="text-emerald-400" />
                  Atualizado
                </>
              ) : (
                <>
                  <Icone icon={faArrowsRotate} className={checando ? 'animate-girar' : undefined} />
                  {checando ? 'Verificando…' : 'Verificar'}
                </>
              )}
            </button>
          </footer>
        </aside>

        <main className="min-h-0 flex-1 overflow-hidden">
          {active ? (
            // A chave remonta o bloco a cada troca, para a entrada rodar de novo.
            <div key={active.id} className="animate-surgir mx-auto flex h-full max-w-6xl flex-col p-6">
              <h1 className="text-xl font-semibold">{active.name}</h1>
              <p className="mt-1 mb-5 text-sm text-muted">{active.description}</p>
              <div className="min-h-0 flex-1">
                <active.Component />
              </div>
            </div>
          ) : (
            <div className="animate-surgir grid h-full place-items-center p-6 text-center">
              <div>
                <img src={logo} alt="" className="mx-auto mb-4 h-14 w-14 opacity-25" />
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
