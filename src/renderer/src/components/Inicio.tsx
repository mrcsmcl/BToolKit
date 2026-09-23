import type { ReactNode } from 'react'
import { tools } from '../tools/registry'
import { Icone, faChevronRight } from './Icone'

interface InicioProps {
  onSelectTool: (id: string) => void
}

export default function Inicio({ onSelectTool }: InicioProps): ReactNode {
  const quantidade = tools.length

  return (
    <div className="home-screen">
      <header className="home-header">
        <div>
          <p className="home-eyebrow">Visão geral</p>
          <h1>BToolKit</h1>
          <p>Escolha uma ferramenta para começar.</p>
        </div>
        <span className="home-count">
          {quantidade} {quantidade === 1 ? 'ferramenta disponível' : 'ferramentas disponíveis'}
        </span>
      </header>

      {quantidade > 0 ? (
        <section className="home-tools" aria-label="Todas as ferramentas">
          {tools.map((tool, indice) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool(tool.id)}
              className="home-tool-card"
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
                <span>Abrir</span>
                <Icone icon={faChevronRight} />
              </span>
            </button>
          ))}
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
