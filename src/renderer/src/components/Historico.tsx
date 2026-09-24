import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { HistoricoContribuidor, HistoricoResult } from '../../../shared/app'
import {
  Icone,
  faChevronRight,
  faClockRotateLeft,
  faGithub,
  faMagnifyingGlass
} from './Icone'

const COMMITS_POR_PAGINA = 20
const FORMATADOR_DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

function formatarData(valor: string): string {
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? valor : FORMATADOR_DATA.format(data)
}

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('')
}

function ehBot(contribuidor: HistoricoContribuidor): boolean {
  return /\[bot\]$/i.test(contribuidor.nome) || /\[bot\]@users\.noreply\.github\.com$/i.test(contribuidor.email)
}

interface HistoricoProps {
  version: string
}

export default function Historico({ version }: HistoricoProps): ReactNode {
  const [resultado, setResultado] = useState<HistoricoResult | null>(null)
  const [falhaIpc, setFalhaIpc] = useState('')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)

  useEffect(() => {
    let ativo = true

    void window.api.app
      .historico()
      .then((valor) => {
        if (ativo) setResultado(valor)
      })
      .catch((erro: unknown) => {
        if (ativo) setFalhaIpc(erro instanceof Error ? erro.message : String(erro))
      })

    return () => {
      ativo = false
    }
  }, [])

  const commitsFiltrados = useMemo(() => {
    if (!resultado?.ok) return []
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    if (!termo) return resultado.commits

    return resultado.commits.filter((commit) =>
      [commit.titulo, commit.corpo, commit.autor, commit.hashCurto]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(termo)
    )
  }, [busca, resultado])

  const contribuidores = useMemo(
    () => (resultado?.ok ? resultado.contribuidores.filter((item) => !ehBot(item)) : []),
    [resultado]
  )
  const totalPaginas = Math.max(1, Math.ceil(commitsFiltrados.length / COMMITS_POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicioPagina = (paginaAtual - 1) * COMMITS_POR_PAGINA
  const commitsDaPagina = commitsFiltrados.slice(inicioPagina, inicioPagina + COMMITS_POR_PAGINA)

  useEffect(() => {
    setPagina(1)
  }, [busca])

  if (falhaIpc) {
    return <HistoricoErro mensagem={`Falha ao acessar o histórico: ${falhaIpc}`} />
  }

  if (resultado === null) {
    return (
      <div className="history-loading" role="status">
        <Icone icon={faClockRotateLeft} className="animate-girar" />
        <span>Carregando histórico Git…</span>
      </div>
    )
  }

  if (!resultado.ok) {
    return <HistoricoErro mensagem={resultado.mensagem} />
  }

  return (
    <div className="history-screen">
      <header className="history-header">
        <div>
          <p className="ui-label history-eyebrow">Projeto BToolKit</p>
          <h1>
            <Icone icon={faClockRotateLeft} aria-hidden="true" />
            Changelog e contribuidores
          </h1>
          <p>
            {resultado.commits.length} commit(s) · {contribuidores.length} contribuidor(es) ·{' '}
            {resultado.origem === 'git-local' ? 'Git local' : 'incluído nesta versão'}
          </p>
        </div>

        <div className="history-header-controls">
          <label className="history-search">
            <span className="sr-only">Buscar no changelog</span>
            <Icone icon={faMagnifyingGlass} aria-hidden="true" />
            <input
              className="ui-input"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar commit ou autor…"
            />
          </label>
          <span className="ui-selo history-version">v{version || '—'}</span>
          <button
            type="button"
            title="Abrir repositório no GitHub"
            aria-label="Abrir repositório no GitHub"
            className="history-repository-button"
            onClick={() => window.api.app.abrirRepositorio()}
          >
            <Icone icon={faGithub} />
          </button>
        </div>
      </header>

      <div className="history-layout">
        <section className="history-commits" aria-label="Changelog Git">
          <header className="history-section-header">
            <h2>Commits</h2>
            <span>
              {commitsFiltrados.length === 0
                ? '0 resultados'
                : `${inicioPagina + 1}–${Math.min(inicioPagina + COMMITS_POR_PAGINA, commitsFiltrados.length)} de ${commitsFiltrados.length}`}
            </span>
          </header>

          <div className="history-commit-list">
            {commitsDaPagina.map((commit) => (
              <article key={commit.hash} className="history-commit">
                <span className="history-commit-dot" aria-hidden="true" />
                <div className="history-commit-content">
                  <div className="history-commit-title">
                    <h3>{commit.titulo}</h3>
                    <code>{commit.hashCurto}</code>
                  </div>
                  <p className="history-commit-meta">
                    <strong>{commit.autor}</strong>
                    <span>·</span>
                    <time dateTime={commit.data}>{formatarData(commit.data)}</time>
                  </p>
                  {commit.corpo && (
                    <details>
                      <summary>Ver detalhes</summary>
                      <pre>{commit.corpo}</pre>
                    </details>
                  )}
                </div>
              </article>
            ))}

            {commitsDaPagina.length === 0 && (
              <div className="history-no-results">Nenhum commit corresponde à busca.</div>
            )}
          </div>

          {totalPaginas > 1 && (
            <footer className="history-pagination" aria-label="Paginação do changelog">
              <button
                type="button"
                className="ui-btn ui-btn--sm"
                disabled={paginaAtual === 1}
                aria-label="Página anterior"
                onClick={() => setPagina((atual) => Math.max(1, atual - 1))}
              >
                <Icone icon={faChevronRight} aria-hidden="true" className="history-chevron-previous" />
                Anterior
              </button>
              <span>
                Página {paginaAtual} de {totalPaginas}
              </span>
              <button
                type="button"
                className="ui-btn ui-btn--sm"
                disabled={paginaAtual === totalPaginas}
                aria-label="Próxima página"
                onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))}
              >
                Próxima
                <Icone icon={faChevronRight} aria-hidden="true" />
              </button>
            </footer>
          )}
        </section>

        <aside className="history-contributors" aria-label="Contribuidores">
          <header className="history-section-header">
            <h2>Contribuidores</h2>
            <span>por commits</span>
          </header>
          <div className="history-contributor-list">
            {contribuidores.map((contribuidor, indice) => (
              <article key={`${contribuidor.nome}-${contribuidor.email}`} className="history-contributor">
                <AvatarContribuidor contribuidor={contribuidor} />
                <span className="history-contributor-name">
                  <strong>{contribuidor.nome}</strong>
                  <span>{contribuidor.commits} commit(s)</span>
                </span>
                <span className="history-rank">#{indice + 1}</span>
              </article>
            ))}
            {contribuidores.length === 0 && (
              <div className="ui-vazio history-contributors-empty">Nenhum contribuidor humano identificado.</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function AvatarContribuidor({
  contribuidor
}: {
  contribuidor: HistoricoContribuidor
}): ReactNode {
  const elemento = useRef<HTMLSpanElement>(null)
  const [avatar, setAvatar] = useState<{ usuario: string; dataUrl: string } | null>(null)

  useEffect(() => {
    const alvo = elemento.current
    if (!alvo || !('IntersectionObserver' in window)) return

    let ativo = true
    const observer = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((entrada) => entrada.isIntersecting)) return
        observer.disconnect()

        void window.api.app.avatarContribuidor(contribuidor.commitHash).then((resultadoAvatar) => {
          if (ativo && resultadoAvatar.ok) {
            setAvatar({ usuario: resultadoAvatar.usuario, dataUrl: resultadoAvatar.dataUrl })
          }
        })
      },
      { rootMargin: '80px' }
    )

    observer.observe(alvo)
    return () => {
      ativo = false
      observer.disconnect()
    }
  }, [contribuidor.commitHash])

  return (
    <span
      ref={elemento}
      className="history-avatar"
      title={avatar ? `@${avatar.usuario}` : contribuidor.nome}
    >
      {avatar ? (
        <img src={avatar.dataUrl} alt="" loading="lazy" />
      ) : (
        iniciais(contribuidor.nome) || '?'
      )}
    </span>
  )
}

function HistoricoErro({ mensagem }: { mensagem: string }): ReactNode {
  return (
    <div className="history-error" role="alert">
      <Icone icon={faClockRotateLeft} aria-hidden="true" />
      <h1>Histórico indisponível</h1>
      <p>{mensagem}</p>
      <button
        type="button"
        className="ui-btn ui-btn--icone"
        title="Abrir repositório no GitHub"
        aria-label="Abrir repositório no GitHub"
        onClick={() => window.api.app.abrirRepositorio()}
      >
        <Icone icon={faGithub} aria-hidden="true" />
      </button>
    </div>
  )
}
