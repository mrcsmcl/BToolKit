import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { useMemo, useState, type ReactNode } from 'react'
import {
  Icone,
  faBriefcase,
  faBuilding,
  faCheck,
  faChevronRight,
  faCopy,
  faIdCard,
  faLayerGroup,
  faMagnifyingGlass,
  faRotate,
  faShieldHalved,
  faXmark
} from '../components/Icone'
import {
  DOCUMENTOS,
  documentoPorTipo,
  type CategoriaDocumento,
  type TipoDocumento
} from './documentos/validadores'
import './documentos/documentos.css'

interface Linha {
  original: string
  formatado: string
  ok: boolean
  motivo: string
}

type Modo = 'validar' | 'gerar'
type FiltroResultado = 'todos' | 'validos' | 'invalidos'
type CategoriaFiltro = CategoriaDocumento | 'todos'

interface Categoria {
  id: CategoriaFiltro
  rotulo: string
  icone: IconDefinition
}

const QUANTIDADES = [1, 5, 10, 50]
const CATEGORIAS: Categoria[] = [
  { id: 'todos', rotulo: 'Todos', icone: faLayerGroup },
  { id: 'identificacao', rotulo: 'Identificação', icone: faIdCard },
  { id: 'empresa', rotulo: 'Empresa', icone: faBuilding },
  { id: 'trabalho', rotulo: 'Trabalho', icone: faBriefcase }
]

function normalizarBusca(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

export default function Documentos(): ReactNode {
  const [tipo, setTipo] = useState<TipoDocumento>('cpf')
  const [entrada, setEntrada] = useState('')
  const [gerados, setGerados] = useState<string[]>([])
  const [comMascara, setComMascara] = useState(true)
  const [copiado, setCopiado] = useState('')
  const [modo, setModo] = useState<Modo>('validar')
  const [catalogoAberto, setCatalogoAberto] = useState(true)
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState<CategoriaFiltro>('todos')
  const [filtroResultado, setFiltroResultado] = useState<FiltroResultado>('todos')

  const documento = documentoPorTipo(tipo)

  const documentosFiltrados = useMemo(() => {
    const termo = normalizarBusca(busca.trim())
    return DOCUMENTOS.filter((item) => {
      const correspondeCategoria = categoria === 'todos' || item.categoria === categoria
      const texto = normalizarBusca(`${item.rotulo} ${item.descricao} ${item.categoria}`)
      return correspondeCategoria && (!termo || texto.includes(termo))
    })
  }, [busca, categoria])

  const linhas = useMemo<Linha[]>(() => {
    return entrada
      .split(/[\n,;]/)
      .map((linha) => linha.trim())
      .filter(Boolean)
      .map((original) => {
        const resultado = documento.validar(original)
        return {
          original,
          formatado: documento.formatar(original),
          ok: resultado.ok,
          motivo: resultado.ok ? '' : resultado.motivo
        }
      })
  }, [entrada, documento])

  const validos = linhas.filter((linha) => linha.ok)
  const invalidos = linhas.filter((linha) => !linha.ok)
  const linhasVisiveis = linhas.filter((linha) => {
    if (filtroResultado === 'validos') return linha.ok
    if (filtroResultado === 'invalidos') return !linha.ok
    return true
  })

  async function copiar(texto: string, marca: string): Promise<void> {
    if (!texto) return
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(marca)
    } catch {
      setCopiado('erro')
    }
    setTimeout(() => setCopiado((atual) => (atual === marca || atual === 'erro' ? '' : atual)), 1600)
  }

  function gerar(quantidade: number): void {
    setGerados(Array.from({ length: quantidade }, () => documento.gerar()))
  }

  function trocarTipo(novo: TipoDocumento): void {
    setTipo(novo)
    setGerados([])
    setCopiado('')
  }

  const saidaGerada = gerados
    .map((valor) => (comMascara ? documento.formatar(valor) : valor))
    .join('\n')

  return (
    <div className="doc-shell">
      <header className="tool-header doc-header">
        <span className="doc-header-icon" aria-hidden="true">
          <Icone icon={faShieldHalved} />
        </span>
        <div>
          <h1>Documentos</h1>
          <p>Valide lotes e gere documentos brasileiros para cenários de teste.</p>
        </div>
        <span className="doc-ready" title="Ferramenta pronta" aria-label="Ferramenta pronta" />
      </header>

      <div className={`doc-explorer ${catalogoAberto ? '' : 'doc-explorer--fechado'}`}>
        <aside className="doc-category-rail" aria-label="Categorias de documentos">
          <button
            type="button"
            className="doc-category-toggle"
            aria-expanded={catalogoAberto}
            aria-controls="doc-catalogo"
            aria-label={catalogoAberto ? 'Recolher catálogo' : 'Expandir catálogo'}
            title={catalogoAberto ? 'Recolher catálogo' : 'Expandir catálogo'}
            onClick={() => setCatalogoAberto((atual) => !atual)}
          >
            <Icone icon={faChevronRight} />
          </button>
          <span className="doc-category-divider" />
          {CATEGORIAS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`doc-category-button ${categoria === item.id ? 'doc-category-button--ativo' : ''}`}
              aria-pressed={categoria === item.id}
              aria-label={item.rotulo}
              title={item.rotulo}
              onClick={() => {
                setCategoria(item.id)
                if (!catalogoAberto) setCatalogoAberto(true)
              }}
            >
              <Icone icon={item.icone} />
              <span>{DOCUMENTOS.filter((doc) => item.id === 'todos' || doc.categoria === item.id).length}</span>
            </button>
          ))}
        </aside>

        {catalogoAberto && (
          <aside id="doc-catalogo" className="doc-catalog" aria-label="Catálogo de documentos">
            <div className="doc-search">
              <Icone icon={faMagnifyingGlass} aria-hidden="true" />
              <label htmlFor="doc-busca" className="sr-only">
                Buscar documento
              </label>
              <input
                id="doc-busca"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar documento…"
              />
              {busca && (
                <button type="button" aria-label="Limpar busca" title="Limpar busca" onClick={() => setBusca('')}>
                  <Icone icon={faXmark} />
                </button>
              )}
            </div>

            <div className="doc-catalog-list">
              {CATEGORIAS.filter((item) => item.id !== 'todos').map((grupo) => {
                const itens = documentosFiltrados.filter((item) => item.categoria === grupo.id)
                if (itens.length === 0) return null
                return (
                  <section key={grupo.id} className="doc-catalog-group">
                    <header>
                      <span>{grupo.rotulo}</span>
                      <span>{itens.length}</span>
                    </header>
                    {itens.map((item) => (
                      <button
                        key={item.tipo}
                        type="button"
                        aria-current={item.tipo === tipo ? 'true' : undefined}
                        className={`doc-catalog-item ${item.tipo === tipo ? 'doc-catalog-item--ativo' : ''}`}
                        onClick={() => trocarTipo(item.tipo)}
                      >
                        <span className="doc-catalog-symbol">{item.rotulo.slice(0, 4)}</span>
                        <span className="doc-catalog-name">
                          <strong>{item.rotulo}</strong>
                          <span>{item.descricao}</span>
                        </span>
                      </button>
                    ))}
                  </section>
                )
              })}

              {documentosFiltrados.length === 0 && (
                <div className="doc-catalog-empty">
                  <Icone icon={faMagnifyingGlass} aria-hidden="true" />
                  <span>Nenhum documento encontrado.</span>
                </div>
              )}
            </div>
            <footer className="doc-catalog-footer">
              {documentosFiltrados.length} de {DOCUMENTOS.length} documento(s)
            </footer>
          </aside>
        )}

        <section className="doc-workspace">
          <header className="doc-modebar">
            <div className="doc-mode-switch" aria-label="Modo de trabalho">
              <button
                type="button"
                aria-pressed={modo === 'validar'}
                className={modo === 'validar' ? 'doc-mode--ativo' : ''}
                onClick={() => setModo('validar')}
              >
                <Icone icon={faCheck} aria-hidden="true" />
                Validar
              </button>
              <button
                type="button"
                aria-pressed={modo === 'gerar'}
                className={modo === 'gerar' ? 'doc-mode--ativo' : ''}
                onClick={() => setModo('gerar')}
              >
                <Icone icon={faRotate} aria-hidden="true" />
                Gerar
              </button>
            </div>
            <div className="doc-selected-meta">
              <strong>{documento.rotulo}</strong>
              <span>{documento.descricao}</span>
            </div>
            <span className={`doc-copy-feedback ${copiado === 'erro' ? 'doc-copy-feedback--erro' : ''}`} role="status" aria-live="polite">
              {copiado === 'erro' ? 'Não foi possível copiar' : copiado ? 'Copiado' : ''}
            </span>
          </header>

          {modo === 'validar' ? (
            <div className="doc-validate-workspace">
              <section className="doc-editor" aria-label="Entrada para validação">
                <header>
                  <h2>Entrada</h2>
                  <span>Validação instantânea</span>
                </header>
                <p>Cole uma coluna. Aceita linha, vírgula ou ponto e vírgula.</p>
                <label htmlFor="doc-entrada" className="doc-label">
                  Valores de {documento.rotulo}
                </label>
                <textarea
                  id="doc-entrada"
                  value={entrada}
                  spellCheck={false}
                  onChange={(evento) => setEntrada(evento.target.value)}
                  placeholder={`Cole valores de ${documento.rotulo}…`}
                  className="doc-textarea"
                />
                <div className="doc-editor-summary" role="status" aria-live="polite">
                  <span>{linhas.length} processado(s)</span>
                  <strong className="doc-ok">{validos.length} válido(s)</strong>
                  <strong className="doc-erro">{invalidos.length} inválido(s)</strong>
                </div>
              </section>

              <section className="doc-results-panel" aria-label="Resultados da validação">
                <header className="doc-results-header">
                  <h2>Resultados</h2>
                  <div className="doc-result-filters" aria-label="Filtrar resultados">
                    {(['todos', 'validos', 'invalidos'] as const).map((filtro) => (
                      <button
                        key={filtro}
                        type="button"
                        aria-pressed={filtroResultado === filtro}
                        className={filtroResultado === filtro ? 'doc-result-filter--ativo' : ''}
                        onClick={() => setFiltroResultado(filtro)}
                      >
                        {filtro === 'todos' ? 'Todos' : filtro === 'validos' ? 'Válidos' : 'Inválidos'}
                      </button>
                    ))}
                  </div>
                </header>

                <div className="doc-results-list">
                  {linhasVisiveis.length === 0 ? (
                    <div className="doc-empty-state">
                      <Icone icon={faShieldHalved} aria-hidden="true" />
                      <span>{linhas.length === 0 ? 'Os resultados aparecerão aqui.' : 'Nenhum resultado neste filtro.'}</span>
                    </div>
                  ) : (
                    <ul>
                      {linhasVisiveis.map((linha, indice) => (
                        <li key={`${linha.original}-${indice}`} className={linha.ok ? 'doc-result-row' : 'doc-result-row doc-result-row--erro'}>
                          <span className={`doc-result-icon ${linha.ok ? 'doc-result-icon--ok' : 'doc-result-icon--erro'}`}>
                            <Icone icon={linha.ok ? faCheck : faXmark} aria-hidden="true" />
                          </span>
                          <span className="doc-valor">{linha.ok ? linha.formatado : linha.original}</span>
                          <span className={linha.ok ? 'doc-result-status doc-ok' : 'doc-result-status doc-erro'}>
                            {linha.ok ? 'Documento válido' : linha.motivo}
                          </span>
                          {linha.ok && (
                            <button
                              type="button"
                              className="doc-copy-button"
                              aria-label={`Copiar ${linha.formatado}`}
                              title="Copiar"
                              onClick={() => void copiar(linha.formatado, `linha-${indice}`)}
                            >
                              <Icone icon={copiado === `linha-${indice}` ? faCheck : faCopy} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {linhas.length > 0 && (
                  <footer className="doc-results-actions">
                    <Botao variante="perigo" onClick={() => setEntrada('')}>Limpar</Botao>
                    <span className="doc-actions-spacer" />
                    <Botao
                      disabled={invalidos.length === 0}
                      onClick={() => void copiar(invalidos.map((linha) => linha.original).join('\n'), 'invalidos')}
                    >
                      <Icone icon={copiado === 'invalidos' ? faCheck : faCopy} />
                      Copiar inválidos
                    </Botao>
                    <Botao
                      variante="primario"
                      disabled={validos.length === 0}
                      onClick={() => void copiar(validos.map((linha) => linha.formatado).join('\n'), 'validos')}
                    >
                      <Icone icon={copiado === 'validos' ? faCheck : faCopy} />
                      Copiar válidos
                    </Botao>
                  </footer>
                )}
              </section>
            </div>
          ) : (
            <div className="doc-generate-workspace">
              <section className="doc-generate-toolbar">
                <div>
                  <span className="doc-label">Quantidade</span>
                  <div className="doc-quantity-buttons">
                    {QUANTIDADES.map((quantidade) => (
                      <Botao key={quantidade} onClick={() => gerar(quantidade)}>{quantidade}</Botao>
                    ))}
                    <Botao
                      icone
                      disabled={gerados.length === 0}
                      aria-label="Gerar novamente"
                      title="Gerar novamente"
                      onClick={() => gerar(gerados.length)}
                    >
                      <Icone icon={faRotate} />
                    </Botao>
                  </div>
                </div>
                <label className="doc-mask-switch">
                  <input type="checkbox" checked={comMascara} onChange={(evento) => setComMascara(evento.target.checked)} />
                  <span className="doc-mask-track" aria-hidden="true" />
                  Com máscara
                </label>
              </section>

              <div className="doc-warning">
                <span>!</span>
                <p>Valores sintaticamente válidos para teste. Não representam pessoas reais nem confirmam existência cadastral.</p>
              </div>

              <section className="doc-generated-panel" aria-label="Documentos gerados">
                <header>
                  <h2>Gerados</h2>
                  <span>{gerados.length} valor(es)</span>
                </header>
                <div className="doc-generated-list">
                  {gerados.length === 0 ? (
                    <div className="doc-empty-state">
                      <Icone icon={faRotate} aria-hidden="true" />
                      <span>Escolha uma quantidade para gerar {documento.rotulo}.</span>
                    </div>
                  ) : (
                    <ul>
                      {gerados.map((valor, indice) => {
                        const exibido = comMascara ? documento.formatar(valor) : valor
                        const marca = `gerado-${indice}`
                        return (
                          <li key={`${valor}-${indice}`}>
                            <span className="doc-valor">{exibido}</span>
                            <button
                              type="button"
                              className="doc-copy-button"
                              aria-label={`Copiar ${exibido}`}
                              title="Copiar"
                              onClick={() => void copiar(exibido, marca)}
                            >
                              <Icone icon={copiado === marca ? faCheck : faCopy} />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
                {gerados.length > 0 && (
                  <footer className="doc-generated-actions">
                    <span>{gerados.length} gerado(s)</span>
                    <Botao variante="primario" onClick={() => void copiar(saidaGerada, 'todos')}>
                      <Icone icon={copiado === 'todos' ? faCheck : faCopy} />
                      Copiar todos
                    </Botao>
                  </footer>
                )}
              </section>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Botao({
  variante = 'normal',
  icone = false,
  className = '',
  ...props
}: React.ComponentProps<'button'> & {
  variante?: 'normal' | 'primario' | 'perigo'
  icone?: boolean
}): ReactNode {
  return (
    <button
      type="button"
      {...props}
      className={`doc-button doc-button--${variante} ${icone ? 'doc-button--icone' : ''} ${className}`}
    />
  )
}
