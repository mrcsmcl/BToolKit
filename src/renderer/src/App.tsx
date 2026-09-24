import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import logo from './assets/logo.png'
import {
  Icone,
  faArrowsRotate,
  faChevronRight,
  faCircleCheck,
  faDownload,
  faGithub,
  faHouse,
  faLock,
  faMagnifyingGlass
} from './components/Icone'
import { useAmbiente } from './ambiente'
import Historico from './components/Historico'
import Inicio from './components/Inicio'
import RequerApp from './components/RequerApp'
import UpdateBanner from './components/UpdateBanner'
import { tools } from './tools/registry'

/** Tempo mínimo de giro, para a resposta não sumir antes de ser vista. */
const PISO_GIRO_MS = 900
const TELA_HISTORICO = '$historico'

export default function App(): ReactNode {
  const ambiente = useAmbiente()
  const noApp = ambiente.tipo === 'app'
  const linkDownload = ambiente.download?.url ?? `${ambiente.urlRepositorio}/releases/latest`

  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [railExpandida, setRailExpandida] = useState(false)
  const [versaoApp, setVersaoApp] = useState('')
  const [checando, setChecando] = useState(false)
  const [semNovidade, setSemNovidade] = useState(false)
  const timerConfirmacao = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    // No site não existe ponte: a versão vem do release consultado pelo ambiente.
    if (noApp) void window.api.updater.getVersion().then(setVersaoApp)
    return () => clearTimeout(timerConfirmacao.current)
  }, [noApp])

  const version = noApp ? versaoApp : (ambiente.download?.versao ?? '')

  useEffect(() => {
    if (!railExpandida) setQuery('')
  }, [railExpandida])

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

  const historicoAtivo = activeId === TELA_HISTORICO
  const active = !historicoAtivo && activeId ? tools.find((t) => t.id === activeId) : undefined
  const tituloAtual = historicoAtivo ? 'Changelog' : active?.name ?? 'Início'

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
    <div className="flex h-full flex-col bg-bg">
      <header
        className="flex h-10 shrink-0 items-center gap-2 border-b border-border/60 px-4"
        // Arrastar a janela só faz sentido no app; no navegador não há janela para mover.
        style={noApp ? ({ WebkitAppRegion: 'drag' } as React.CSSProperties) : undefined}
      >
        <img src={logo} alt="" className="h-5 w-5" />
        <span className="text-xs font-semibold tracking-wide text-fg">BToolKit</span>
        <span className="ml-1 text-[11px] text-muted">/ {tituloAtual}</span>

        {!noApp && (
          <a className="ui-btn ui-btn--primario ui-btn--sm ml-auto" href={linkDownload}>
            <Icone icon={faDownload} aria-hidden="true" />
            Baixar para Windows
          </a>
        )}
      </header>

      {noApp && <UpdateBanner />}

      <div className="app-body flex min-h-0 flex-1">
        <button
          type="button"
          aria-label="Fechar menu de ferramentas"
          tabIndex={railExpandida ? 0 : -1}
          className={`app-rail-scrim ${railExpandida ? 'app-rail-scrim--visible' : ''}`}
          onClick={() => setRailExpandida(false)}
        />

        <div className={`app-rail-slot ${railExpandida ? 'app-rail-slot--expanded' : ''}`}>
          <aside
            id="menu-ferramentas"
            aria-label="Menu de ferramentas"
            className="app-rail flex h-full flex-col border-r border-border bg-surface"
          >
            <div className="app-rail-topo flex shrink-0 items-center border-b border-border px-3">
              <button
                type="button"
                aria-expanded={railExpandida}
                aria-controls="navegacao-ferramentas"
                aria-label={railExpandida ? 'Recolher menu de ferramentas' : 'Expandir menu de ferramentas'}
                title={railExpandida ? 'Recolher menu' : 'Expandir menu'}
                onClick={() => setRailExpandida((atual) => !atual)}
                className={`app-rail-toggle ${railExpandida ? 'app-rail-toggle--expanded' : ''}`}
              >
                <span aria-hidden="true" className="app-rail-toggle__icon">
                  <Icone icon={faChevronRight} />
                </span>
                {railExpandida && <span>Recolher menu</span>}
              </button>
            </div>

            {railExpandida && (
              <div className="relative shrink-0 p-3 pb-2">
                <label htmlFor="busca-ferramentas" className="sr-only">
                  Buscar ferramenta
                </label>
                <Icone
                  icon={faMagnifyingGlass}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-[10px] text-muted"
                />
                <input
                  id="busca-ferramentas"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar ferramenta…"
                  className="w-full rounded-md border border-border bg-surface-2 py-2 pr-2.5 pl-7 text-xs outline-none transition placeholder:text-muted focus:border-muted focus:ring-2 focus:ring-fg/10"
                />
              </div>
            )}

            <nav
              id="navegacao-ferramentas"
              aria-label="Ferramentas"
              className={`min-h-0 flex-1 overflow-y-auto ${railExpandida ? 'px-2 pb-2' : 'px-2 py-3'}`}
            >
              <div className={railExpandida ? 'mb-3' : 'mb-2'}>
                <button
                  type="button"
                  aria-current={activeId === null ? 'page' : undefined}
                  aria-label="Início"
                  title={railExpandida ? 'Ver todas as ferramentas' : 'Início — todas as ferramentas'}
                  onClick={() => {
                    setActiveId(null)
                    if (window.innerWidth < 1100) setRailExpandida(false)
                  }}
                  className={`app-rail-tool ${railExpandida ? 'app-rail-tool--expanded' : ''} ${
                    activeId === null ? 'app-rail-tool--active' : ''
                  }`}
                >
                  <span className="app-rail-tool__glyph" aria-hidden="true">
                    <Icone icon={faHouse} />
                  </span>
                  {railExpandida && <span className="truncate">Início</span>}
                </button>
              </div>

              {Object.entries(groups).map(([group, items]) => (
                <div key={group} className={railExpandida ? 'mb-3' : 'mb-2'}>
                  {railExpandida && (
                    <p className="px-2 py-1 text-[9px] font-semibold tracking-[0.12em] text-muted uppercase">
                      {group}
                    </p>
                  )}
                  <div className="grid gap-1">
                    {items.map((tool) => {
                      const ativo = tool.id === activeId
                      const bloqueada = !noApp && tool.runtime === 'desktop'
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          aria-current={ativo ? 'page' : undefined}
                          aria-label={bloqueada ? `${tool.name} — requer o aplicativo` : tool.name}
                          title={
                            bloqueada
                              ? `${tool.name} — requer o aplicativo`
                              : railExpandida
                                ? tool.description
                                : `${tool.name} — ${tool.description}`
                          }
                          onClick={() => {
                            setActiveId(tool.id)
                            if (window.innerWidth < 1100) setRailExpandida(false)
                          }}
                          className={`app-rail-tool ${railExpandida ? 'app-rail-tool--expanded' : ''} ${
                            ativo ? 'app-rail-tool--active' : ''
                          }`}
                        >
                          <span className="app-rail-tool__glyph" aria-hidden="true">
                            <Icone icon={tool.glyph} />
                          </span>
                          {railExpandida && <span className="truncate">{tool.name}</span>}
                          {bloqueada && railExpandida && (
                            <Icone icon={faLock} aria-hidden="true" className="ml-auto text-[9px]" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {Object.keys(groups).length === 0 && railExpandida && (
                <p className="animate-surgir px-2 py-4 text-xs text-muted">
                  {tools.length === 0 ? 'Nenhuma ferramenta ainda.' : 'Nada encontrado.'}
                </p>
              )}
            </nav>

            <footer
              className={`app-rail-footer border-t border-border text-muted ${
                railExpandida ? 'app-rail-footer--expanded' : ''
              }`}
            >
              {noApp ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(TELA_HISTORICO)
                    if (window.innerWidth < 1100) setRailExpandida(false)
                  }}
                  title="Changelog e contribuidores"
                  aria-label="Abrir changelog e contribuidores"
                  aria-current={historicoAtivo ? 'page' : undefined}
                  className={`app-rail-footer__button ${
                    historicoAtivo ? 'app-rail-footer__button--active' : ''
                  }`}
                >
                  <Icone icon={faGithub} />
                </button>
              ) : (
                // O changelog lê o histórico pelo processo principal, que o site não tem.
                <a
                  href={ambiente.urlRepositorio}
                  target="_blank"
                  rel="noreferrer noopener"
                  title="Ver o projeto no GitHub"
                  aria-label="Ver o projeto no GitHub"
                  className="app-rail-footer__button"
                >
                  <Icone icon={faGithub} />
                </a>
              )}

              {railExpandida && version && (
                <span className="whitespace-nowrap text-[10px]">v{version}</span>
              )}

              {noApp ? (
                <button
                  type="button"
                  onClick={verificarAtualizacao}
                  disabled={checando}
                  title="Verificar atualização"
                  aria-label="Verificar atualização"
                  aria-busy={checando}
                  className="app-rail-footer__button disabled:text-fg"
                >
                  {semNovidade ? (
                    <Icone icon={faCircleCheck} className="text-emerald-400" />
                  ) : (
                    <Icone icon={faArrowsRotate} className={checando ? 'animate-girar' : undefined} />
                  )}
                  {railExpandida && (
                    <span>{semNovidade ? 'Atualizado' : checando ? 'Verificando…' : 'Verificar'}</span>
                  )}
                </button>
              ) : (
                <a
                  href={linkDownload}
                  title="Baixar o aplicativo para Windows"
                  aria-label="Baixar o aplicativo para Windows"
                  className="app-rail-footer__button"
                >
                  <Icone icon={faDownload} />
                  {railExpandida && <span>Baixar app</span>}
                </a>
              )}
            </footer>
          </aside>
        </div>

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {historicoAtivo ? (
            <div key={TELA_HISTORICO} className="animate-surgir h-full min-h-0">
              <Historico version={version} />
            </div>
          ) : active ? (
            // A chave remonta o bloco somente ao trocar de ferramenta; expandir a rail preserva o estado.
            <div key={active.id} className="animate-surgir h-full min-h-0">
              {!noApp && active.runtime === 'desktop' ? (
                <RequerApp tool={active} />
              ) : (
                /* A ferramenta é carregada sob demanda; o fallback cobre só o instante do import. */
                <Suspense fallback={<CarregandoFerramenta />}>
                  <active.Component />
                </Suspense>
              )}
            </div>
          ) : (
            <Inicio onSelectTool={setActiveId} />
          )}
        </main>
      </div>
    </div>
  )
}

function CarregandoFerramenta(): ReactNode {
  return (
    <div className="grid h-full place-items-center" role="status">
      <span className="text-xs text-muted">Carregando ferramenta…</span>
    </div>
  )
}
