import type { ReactNode } from 'react'
import { useAmbiente } from '../ambiente'
import { tools } from '../tools/registry'
import { Icone, faChevronRight, faLock } from './Icone'

interface InicioProps {
  onSelectTool: (id: string) => void
}

export default function Inicio({ onSelectTool }: InicioProps): ReactNode {
  const { tipo } = useAmbiente()
  const noApp = tipo === 'app'
  const quantidade = tools.length
  const universais = tools.filter((t) => t.runtime === 'universal').length

  return (
    <div className="home-screen">
      <header className="home-header">
        <div>
          <p className="home-eyebrow">Visão geral</p>
          <h1>BToolKit</h1>
          <p>
            {noApp
              ? 'Escolha uma ferramenta para começar.'
              : 'Use aqui as que rodam no navegador; as demais vêm no aplicativo.'}
          </p>
        </div>
        <span className="home-count">
          {noApp
            ? `${quantidade} ${quantidade === 1 ? 'ferramenta disponível' : 'ferramentas disponíveis'}`
            : `${universais} de ${quantidade} no navegador`}
        </span>
      </header>

      {quantidade > 0 ? (
        <section className="home-tools" aria-label="Todas as ferramentas">
          {tools.map((tool, indice) => {
            // No site a ferramenta desktop continua no catálogo, mas anunciando o que precisa.
            const bloqueada = !noApp && tool.runtime === 'desktop'
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onSelectTool(tool.id)}
                className={`home-tool-card ${bloqueada ? 'home-tool-card--bloqueada' : ''}`}
                style={{ '--tool-index': indice } as React.CSSProperties}
              >
                <span className="home-tool-icon" aria-hidden="true">
                  <Icone icon={tool.glyph} />
                </span>
                <span className="home-tool-content">
                  <span className="home-tool-group">{tool.group}</span>
                  <strong>{tool.name}</strong>
                  <span className="home-tool-description">{tool.description}</span>
                </span>
                <span className="home-tool-action" aria-hidden="true">
                  <span>{bloqueada ? 'Requer o app' : 'Abrir'}</span>
                  <Icone icon={bloqueada ? faLock : faChevronRight} />
                </span>
              </button>
            )
          })}
        </section>
      ) : (
        <div className="home-empty">
          <p>Nenhuma ferramenta registrada.</p>
          <code>src/renderer/src/tools/registry.ts</code>
        </div>
      )}
    </div>
  )
}
