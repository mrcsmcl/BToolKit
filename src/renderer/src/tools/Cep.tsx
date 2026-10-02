import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { UFS, type EnderecoCep, type Municipio } from '../../../shared/cep'
import {
  Icone,
  faCheck,
  faCopy,
  faLocationDot,
  faMagnifyingGlass,
  faTriangleExclamation
} from '../components/Icone'
import { Botao } from '../components/ui'
import './cep/cep.css'

type Modo = 'cep' | 'endereco' | 'ibge'

const MODOS: { id: Modo; rotulo: string }[] = [
  { id: 'cep', rotulo: 'Por CEP' },
  { id: 'endereco', rotulo: 'Por endereço' },
  { id: 'ibge', rotulo: 'Por IBGE' }
]

/** Teto da lista que aparece enquanto se digita; o resto é ruído. */
const MAXIMO_SUGESTOES = 40
/** Espera depois da última tecla antes de consultar o CEP completo. */
const ESPERA_MS = 350

/**
 * Os municípios ficam aqui, fora do componente.
 *
 * São 237 KB que atravessam a ponte uma vez por sessão; guardar no módulo
 * evita refazer a travessia toda vez que alguém volta para a ferramenta.
 */
let municipiosEmMemoria: Municipio[] | null = null

/** 8 dígitos viram 00000-000 enquanto se digita. */
function mascaraCep(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
}

function linhaDoEndereco(e: EnderecoCep): string {
  const complemento = e.complemento ? `, ${e.complemento}` : ''
  const logradouro = e.logradouro || '(sem logradouro — CEP de cidade inteira)'
  return `${logradouro}${complemento} — ${e.bairro}, ${e.cidade}/${e.uf}, CEP ${e.cep}`
}

export default function Cep(): ReactNode {
  const [modo, setModo] = useState<Modo>('cep')
  const [cep, setCep] = useState('')
  const [uf, setUf] = useState('SP')
  const [cidade, setCidade] = useState('')
  const [logradouro, setLogradouro] = useState('')
  const [buscaIbge, setBuscaIbge] = useState('')

  const [municipios, setMunicipios] = useState<Municipio[]>(municipiosEmMemoria ?? [])
  const [erroMunicipios, setErroMunicipios] = useState('')

  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<EnderecoCep[]>([])
  const [municipio, setMunicipio] = useState<Municipio | null>(null)
  const [erro, setErro] = useState('')
  const [doCache, setDoCache] = useState(false)
  const [copiado, setCopiado] = useState('')

  // Descarta resposta de consulta que já não é a última pedida.
  const consultaAtual = useRef(0)

  useEffect(() => {
    if (municipiosEmMemoria) return
    let vivo = true

    void (async () => {
      const r = await window.api.cep.municipios()
      if (!vivo) return
      if (r.ok) {
        municipiosEmMemoria = r.municipios
        setMunicipios(r.municipios)
      } else {
        setErroMunicipios(r.motivo)
      }
    })()

    return () => {
      vivo = false
    }
  }, [])

  function limpar(): void {
    setResultados([])
    setMunicipio(null)
    setErro('')
    setCopiado('')
  }

  async function consultarCep(valor: string): Promise<void> {
    const id = ++consultaAtual.current
    setBuscando(true)
    const r = await window.api.cep.porCep(valor)
    if (id !== consultaAtual.current) return

    setBuscando(false)
    if (r.ok) {
      setResultados(r.enderecos)
      setDoCache(r.doCache)
      setErro('')
    } else {
      setResultados([])
      setErro(r.motivo)
    }
  }

  /**
   * Busca sozinho quando o oitavo dígito entra.
   *
   * Não dá para ir filtrando por prefixo como no IBGE: a origem recusa CEP
   * incompleto com 400, não existe consulta por começo de CEP. O que dá é
   * poupar o clique assim que o valor fica completo.
   */
  useEffect(() => {
    if (modo !== 'cep') return
    const digitos = cep.replace(/\D/g, '')

    if (digitos.length !== 8) {
      consultaAtual.current++
      setBuscando(false)
      limpar()
      return
    }

    const id = window.setTimeout(() => void consultarCep(digitos), ESPERA_MS)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cep, modo])

  /** Filtra os municípios já carregados: por código quando são dígitos, senão por nome. */
  const sugestoes = useMemo(() => {
    const termo = buscaIbge.trim()
    if (termo.length < 2) return []

    const soDigitos = /^\d+$/.test(termo)
    const alvo = normalizar(termo)

    const casa = (m: Municipio): boolean =>
      soDigitos ? m.codigo.startsWith(termo) : normalizar(m.nome).includes(alvo)

    const achados: Municipio[] = []
    for (const m of municipios) {
      if (!casa(m)) continue
      achados.push(m)
      if (achados.length > MAXIMO_SUGESTOES) break
    }
    return achados
  }, [buscaIbge, municipios])

  const cidadesDoEstado = useMemo(
    () => municipios.filter((m) => m.uf === uf),
    [municipios, uf]
  )

  async function escolherMunicipio(m: Municipio): Promise<void> {
    setMunicipio(m)
    setBuscaIbge(m.codigo)
    setResultados([])
    setErro('')

    if (logradouro.trim().length < 3) return

    const id = ++consultaAtual.current
    setBuscando(true)
    const r = await window.api.cep.porEndereco({ uf: m.uf, cidade: m.nome, logradouro })
    if (id !== consultaAtual.current) return

    setBuscando(false)
    if (r.ok) {
      setResultados(r.enderecos)
      setDoCache(r.doCache)
    } else {
      setErro(r.motivo)
    }
  }

  async function buscarPorEndereco(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    const id = ++consultaAtual.current
    setBuscando(true)
    limpar()

    const r = await window.api.cep.porEndereco({ uf, cidade, logradouro })
    if (id !== consultaAtual.current) return

    setBuscando(false)
    if (r.ok) {
      setResultados(r.enderecos)
      setDoCache(r.doCache)
    } else {
      setErro(r.motivo)
    }
  }

  async function copiar(texto: string, marca: string): Promise<void> {
    await navigator.clipboard.writeText(texto)
    setCopiado(marca)
    window.setTimeout(() => setCopiado((atual) => (atual === marca ? '' : atual)), 1400)
  }

  function trocarModo(novo: Modo): void {
    setModo(novo)
    consultaAtual.current++
    setBuscando(false)
    limpar()
  }

  const dica =
    modo === 'cep'
      ? 'Digite um CEP: a busca sai sozinha no oitavo dígito.'
      : modo === 'ibge'
        ? 'Digite o código ou o nome do município; a lista vai filtrando.'
        : 'Informe estado, cidade e logradouro para ver os CEPs.'

  return (
    <div className="cep-root">
      <header className="tool-header">
        <span className="tool-header__icone" aria-hidden="true">
          <Icone icon={faLocationDot} />
        </span>
        <div>
          <h1>CEP</h1>
          <p>Procura o endereço pelo CEP, os CEPs de uma rua ou o município pelo IBGE.</p>
        </div>
        <span className="tool-header__acoes">
          <div className="ui-seg" role="group" aria-label="Como procurar">
            {MODOS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`ui-seg__item ${modo === m.id ? 'ui-seg__item--ativo' : ''}`}
                aria-pressed={modo === m.id}
                onClick={() => trocarModo(m.id)}
              >
                {m.rotulo}
              </button>
            ))}
          </div>
        </span>
      </header>

      <div className="cep-shell">
        {modo === 'endereco' ? (
          <form className="cep-busca" onSubmit={(e) => void buscarPorEndereco(e)}>
            <label className="cep-campo cep-campo--uf">
              <span className="ui-label">Estado</span>
              <select className="ui-input" value={uf} onChange={(e) => setUf(e.target.value)}>
                {UFS.map((sigla) => (
                  <option key={sigla} value={sigla}>
                    {sigla}
                  </option>
                ))}
              </select>
            </label>
            <label className="cep-campo">
              <span className="ui-label">
                Cidade
                {cidadesDoEstado.length > 0 && ` · ${cidadesDoEstado.length} em ${uf}`}
              </span>
              <input
                className="ui-input"
                list="cep-municipios"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="comece a digitar"
              />
              <datalist id="cep-municipios">
                {cidadesDoEstado.map((m) => (
                  <option key={m.codigo} value={m.nome} />
                ))}
              </datalist>
            </label>
            <label className="cep-campo">
              <span className="ui-label">Logradouro</span>
              <input
                className="ui-input"
                value={logradouro}
                onChange={(e) => setLogradouro(e.target.value)}
                placeholder="Avenida Brasil"
              />
            </label>
            <Botao
              variante="primario"
              type="submit"
              disabled={buscando || cidade.trim().length < 3 || logradouro.trim().length < 3}
            >
              <Icone icon={faMagnifyingGlass} aria-hidden="true" />
              {buscando ? 'Buscando…' : 'Buscar'}
            </Botao>
          </form>
        ) : (
          <div className="cep-busca">
            {modo === 'cep' ? (
              <label className="cep-campo cep-campo--curto">
                <span className="ui-label">CEP</span>
                <input
                  className="ui-input ui-mono"
                  value={cep}
                  onChange={(e) => setCep(mascaraCep(e.target.value))}
                  placeholder="00000-000"
                  inputMode="numeric"
                  autoFocus
                />
              </label>
            ) : (
              <label className="cep-campo">
                <span className="ui-label">
                  Código ou nome do município
                  {municipios.length > 0 && ` · ${municipios.length} no país`}
                </span>
                <input
                  className="ui-input"
                  value={buscaIbge}
                  onChange={(e) => {
                    setBuscaIbge(e.target.value)
                    setMunicipio(null)
                    setErro('')
                  }}
                  placeholder="3509502 ou Campinas"
                  autoFocus
                />
              </label>
            )}

            {modo === 'ibge' && (
              <label className="cep-campo">
                <span className="ui-label">Logradouro (opcional)</span>
                <input
                  className="ui-input"
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                  placeholder="busca os CEPs da rua no município escolhido"
                />
              </label>
            )}

            <span className="cep-estado-busca" role="status">
              {buscando ? 'Buscando…' : ''}
            </span>
          </div>
        )}

        {erroMunicipios && modo !== 'cep' && (
          <p className="cep-erro" role="alert">
            <Icone icon={faTriangleExclamation} aria-hidden="true" />
            Lista de municípios indisponível: {erroMunicipios}
          </p>
        )}

        {erro && (
          <p className="cep-erro" role="alert">
            <Icone icon={faTriangleExclamation} aria-hidden="true" />
            {erro}
          </p>
        )}

        {municipio && (
          <div className="cep-municipio">
            <div>
              <span className="ui-label">Município</span>
              <strong>
                {municipio.nome}/{municipio.uf}
              </strong>
              <span className="cep-municipio__estado">{municipio.estado}</span>
            </div>
            <Botao
              tamanho="sm"
              onClick={() =>
                void copiar(`${municipio.codigo} — ${municipio.nome}/${municipio.uf}`, 'municipio')
              }
            >
              <Icone icon={copiado === 'municipio' ? faCheck : faCopy} aria-hidden="true" />
              {municipio.codigo}
            </Botao>
          </div>
        )}

        <section className="cep-resultados" aria-label="Resultados">
          {/* No modo IBGE a lista que importa é a de municípios filtrando. */}
          {modo === 'ibge' && !municipio && sugestoes.length > 0 ? (
            <>
              <header className="cep-resultados-topo">
                <span className="ui-label">
                  {sugestoes.length > MAXIMO_SUGESTOES
                    ? `mais de ${MAXIMO_SUGESTOES} municípios`
                    : `${sugestoes.length} ${sugestoes.length === 1 ? 'município' : 'municípios'}`}
                </span>
              </header>
              <ul className="cep-lista">
                {sugestoes.slice(0, MAXIMO_SUGESTOES).map((m) => (
                  <li key={m.codigo}>
                    <button
                      type="button"
                      className="cep-sugestao"
                      onClick={() => void escolherMunicipio(m)}
                    >
                      <strong className="ui-mono">{m.codigo}</strong>
                      <span>{m.nome}</span>
                      <em>
                        {m.estado} · {m.uf}
                      </em>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : resultados.length > 0 ? (
            <>
              <header className="cep-resultados-topo">
                <span className="ui-label">
                  {resultados.length} {resultados.length === 1 ? 'endereço' : 'endereços'}
                </span>
                {doCache && (
                  <span className="ui-selo" title="Já consultado nesta sessão">
                    da sessão
                  </span>
                )}
                {resultados.length > 1 && (
                  <Botao
                    tamanho="sm"
                    onClick={() => void copiar(resultados.map(linhaDoEndereco).join('\n'), 'todos')}
                  >
                    <Icone icon={copiado === 'todos' ? faCheck : faCopy} aria-hidden="true" />
                    Copiar todos
                  </Botao>
                )}
              </header>

              <ul className="cep-lista">
                {resultados.map((e, indice) => (
                  <li key={`${e.cep}-${indice}`} className="cep-item">
                    <div className="cep-item-principal">
                      <strong className="ui-mono">{e.cep}</strong>
                      <span>{e.logradouro || '(CEP geral da cidade)'}</span>
                    </div>
                    <div className="cep-item-detalhe">
                      {e.bairro && <span>{e.bairro}</span>}
                      <span>
                        {e.cidade}/{e.uf}
                      </span>
                      {e.ddd && <span>DDD {e.ddd}</span>}
                      {e.ibge && <span title="Código do município no IBGE">IBGE {e.ibge}</span>}
                      {e.complemento && <span>{e.complemento}</span>}
                    </div>
                    <Botao
                      icone
                      tamanho="sm"
                      aria-label={`Copiar o endereço do CEP ${e.cep}`}
                      title="Copiar este endereço"
                      onClick={() => void copiar(linhaDoEndereco(e), `item-${indice}`)}
                    >
                      <Icone icon={copiado === `item-${indice}` ? faCheck : faCopy} />
                    </Botao>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            !erro && (
              <div className="ui-vazio cep-vazio">
                <Icone icon={faLocationDot} aria-hidden="true" />
                <span>{dica}</span>
              </div>
            )
          )}
        </section>
      </div>
    </div>
  )
}
