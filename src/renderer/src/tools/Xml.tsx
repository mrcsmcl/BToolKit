import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import {
  Icone,
  faCheck,
  faCircleCheck,
  faCopy,
  faFileCode,
  faMagnifyingGlass,
  faTriangleExclamation,
  faXmark
} from '../components/Icone'
import { Botao } from '../components/ui'
import { analisar, formatar, minificar, textoNormalizado } from './xml/documento'
import VisaoLeitura from './xml/VisaoLeitura'
import { contarCampos, filtrar, paraLeitura } from './xml/leitura'
import { ALGORITMOS, algoritmoDoHash, calcularTodos, normalizarHash, type Algoritmo } from './xml/hash'
import './xml/xml.css'

type Modo = 'leitura' | 'formatado' | 'minificado' | 'hash'

const MODOS: { id: Modo; rotulo: string }[] = [
  { id: 'leitura', rotulo: 'Leitura' },
  { id: 'formatado', rotulo: 'Formatado' },
  { id: 'minificado', rotulo: 'Minificado' },
  { id: 'hash', rotulo: 'Hash' }
]

/** Acima disto a tela trava ao pintar; o arquivo ainda é lido e resumido. */
const LIMITE_EXIBICAO = 2 * 1024 * 1024

interface Entrada {
  nome: string
  bytes: Uint8Array
  texto: string
  /** Texto colado é convertido para UTF-8; de arquivo, são os bytes originais. */
  deArquivo: boolean
}

/**
 * Decodifica respeitando o que o próprio documento declara.
 *
 * XML gerado por sistema antigo costuma vir em ISO-8859-1, e lê-lo como UTF-8
 * estraga todo acento. A declaração está no prólogo, que é ASCII nos dois
 * casos, então dá para espiá-la antes de decidir.
 */
function decodificar(bytes: Uint8Array): string {
  const espiada = new TextDecoder('utf-8').decode(bytes.slice(0, 200))
  const declarado = /encoding\s*=\s*["']([^"']+)["']/i.exec(espiada)?.[1]

  if (declarado && !/^utf-?8$/i.test(declarado)) {
    try {
      return new TextDecoder(declarado, { fatal: false }).decode(bytes)
    } catch {
      // rótulo de encoding que o navegador não conhece: segue em UTF-8
    }
  }

  return new TextDecoder('utf-8').decode(bytes)
}

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function Xml(): ReactNode {
  const [entrada, setEntrada] = useState<Entrada | null>(null)
  const [colado, setColado] = useState('')
  const [modo, setModo] = useState<Modo>('leitura')
  const [busca, setBusca] = useState('')
  const [arrastando, setArrastando] = useState(false)
  const [hashes, setHashes] = useState<Record<Algoritmo, string> | null>(null)
  const [hashNormalizado, setHashNormalizado] = useState('')
  const [esperado, setEsperado] = useState('')
  const [copiado, setCopiado] = useState('')

  const seletor = useRef<HTMLInputElement>(null)

  const { analise, doc } = useMemo(
    () => (entrada ? analisar(entrada.texto) : { analise: null, doc: null }),
    [entrada]
  )

  const arvore = useMemo(() => (doc && analise?.ok ? paraLeitura(doc) : null), [doc, analise])

  const arvoreFiltrada = useMemo(
    () => (arvore ? filtrar(arvore, busca) : null),
    [arvore, busca]
  )

  const saida = useMemo(() => {
    if (!entrada || !doc || !analise?.ok) return ''
    if (entrada.bytes.length > LIMITE_EXIBICAO) return ''
    return modo === 'minificado' ? minificar(entrada.texto, doc) : formatar(entrada.texto, doc)
  }, [entrada, doc, analise, modo])

  // Os resumos são de bytes, não da tela: recalculam só quando a entrada muda.
  useEffect(() => {
    if (!entrada) {
      setHashes(null)
      setHashNormalizado('')
      return
    }

    let vivo = true
    void (async () => {
      const todos = await calcularTodos(entrada.bytes)
      if (!vivo) return
      setHashes(todos)

      if (!doc) {
        setHashNormalizado('')
        return
      }
      const normalizado = new TextEncoder().encode(textoNormalizado(entrada.texto, doc))
      const r = await calcularTodos(normalizado)
      if (vivo) setHashNormalizado(r['SHA-256'])
    })()

    return () => {
      vivo = false
    }
  }, [entrada, doc])

  async function receberArquivo(arquivo: File): Promise<void> {
    const bytes = new Uint8Array(await arquivo.arrayBuffer())
    setEntrada({ nome: arquivo.name, bytes, texto: decodificar(bytes), deArquivo: true })
    setColado('')
  }

  function usarTextoColado(texto: string): void {
    setColado(texto)
    if (!texto.trim()) {
      setEntrada(null)
      return
    }
    setEntrada({
      nome: 'colado',
      bytes: new TextEncoder().encode(texto),
      texto,
      deArquivo: false
    })
  }

  function soltar(evento: DragEvent): void {
    evento.preventDefault()
    setArrastando(false)
    const arquivo = evento.dataTransfer.files[0]
    if (arquivo) void receberArquivo(arquivo)
  }

  function copiar(texto: string, marca: string): void {
    void navigator.clipboard.writeText(texto).then(() => {
      setCopiado(marca)
      window.setTimeout(() => setCopiado((atual) => (atual === marca ? '' : atual)), 1400)
    })
  }

  const algoritmoEsperado = algoritmoDoHash(esperado)
  const confere =
    hashes && algoritmoEsperado ? hashes[algoritmoEsperado] === normalizarHash(esperado) : null

  function limpar(): void {
    setEntrada(null)
    setColado('')
    setEsperado('')
  }

  return (
    <div className="xml-root">
      <header className="tool-header">
        <span className="tool-header__icone" aria-hidden="true">
          <Icone icon={faFileCode} />
        </span>
        <div>
          <h1>XML</h1>
          <p>Confere se o documento está bem formado, formata para leitura e calcula o hash.</p>
        </div>
        <span className="tool-header__acoes">
          <div className="ui-seg" role="group" aria-label="O que mostrar">
            {MODOS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`ui-seg__item ${modo === m.id ? 'ui-seg__item--ativo' : ''}`}
                aria-pressed={modo === m.id}
                onClick={() => setModo(m.id)}
              >
                {m.rotulo}
              </button>
            ))}
          </div>
        </span>
      </header>

      <div className="xml-shell">
        {!entrada ? (
          <div
            className={`xml-solte ${arrastando ? 'xml-solte--ativo' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setArrastando(true)
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={soltar}
          >
            <Icone icon={faFileCode} aria-hidden="true" />
            <p>Arraste um arquivo .xml aqui</p>
            <Botao variante="primario" onClick={() => seletor.current?.click()}>
              Escolher arquivo
            </Botao>
            <input
              ref={seletor}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="xml-seletor"
              onChange={(e) => {
                const arquivo = e.target.files?.[0]
                if (arquivo) void receberArquivo(arquivo)
                e.target.value = ''
              }}
            />
            <span className="xml-ou">ou cole o conteúdo</span>
            <textarea
              className="ui-textarea ui-mono xml-colar"
              value={colado}
              onChange={(e) => usarTextoColado(e.target.value)}
              placeholder="<?xml version=&quot;1.0&quot;?>…"
              spellCheck={false}
            />
          </div>
        ) : (
          <>
            <div className={`xml-estado ${analise?.ok ? 'xml-estado--ok' : 'xml-estado--erro'}`}>
              <Icone icon={analise?.ok ? faCircleCheck : faTriangleExclamation} aria-hidden="true" />
              <div className="xml-estado__texto">
                {analise?.ok ? (
                  <>
                    <strong>Bem formado</strong>
                    <span>
                      {analise.raiz} · {analise.elementos} elementos · {analise.profundidade} níveis
                      {analise.encoding && ` · ${analise.encoding}`}
                    </span>
                  </>
                ) : (
                  <>
                    <strong>
                      Não é um XML válido
                      {analise?.erro?.linha !== null &&
                        ` — linha ${analise?.erro?.linha}, coluna ${analise?.erro?.coluna}`}
                    </strong>
                    <span>{analise?.erro?.mensagem}</span>
                  </>
                )}
              </div>
              <span className="xml-arquivo ui-mono" title={entrada.nome}>
                {entrada.deArquivo ? entrada.nome : 'texto colado'} ·{' '}
                {tamanhoLegivel(entrada.bytes.length)}
              </span>
              <Botao icone tamanho="sm" aria-label="Escolher outro" title="Limpar" onClick={limpar}>
                <Icone icon={faXmark} />
              </Botao>
            </div>

            {modo === 'hash' ? (
              <section className="xml-painel" aria-label="Resumos">
                <header className="xml-painel-topo">
                  <h2>Resumo do arquivo</h2>
                  <span className="xml-nota">
                    {entrada.deArquivo
                      ? 'calculado sobre os bytes do arquivo'
                      : 'calculado sobre o texto colado, em UTF-8'}
                  </span>
                </header>

                <dl className="xml-hashes">
                  {ALGORITMOS.map((a) => (
                    <div key={a}>
                      <dt>{a}</dt>
                      <dd>
                        <button
                          type="button"
                          className="xml-valor"
                          title={`Copiar ${a}`}
                          aria-label={`Copiar ${a}`}
                          onClick={() => copiar(hashes?.[a] ?? '', a)}
                        >
                          <span className="ui-mono">{hashes?.[a] ?? 'calculando…'}</span>
                          <Icone icon={copiado === a ? faCheck : faCopy} aria-hidden="true" />
                        </button>
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="xml-conferir">
                  <label>
                    <span className="ui-label">Conferir com um hash esperado</span>
                    <input
                      className="ui-input ui-mono"
                      value={esperado}
                      onChange={(e) => setEsperado(e.target.value)}
                      placeholder="cole o hash recebido; o algoritmo sai do tamanho"
                    />
                  </label>
                  {esperado.trim() && (
                    <p
                      className={`xml-veredito ${confere ? 'xml-veredito--ok' : 'xml-veredito--erro'}`}
                      role="status"
                    >
                      <Icone
                        icon={confere ? faCircleCheck : faTriangleExclamation}
                        aria-hidden="true"
                      />
                      {!algoritmoEsperado
                        ? 'Não reconheci: um hash tem 32, 40, 64 ou 128 caracteres hexadecimais.'
                        : confere
                          ? `Confere com o ${algoritmoEsperado} do arquivo.`
                          : `Não confere com o ${algoritmoEsperado} do arquivo.`}
                    </p>
                  )}
                </div>

                {analise?.ok && hashNormalizado && (
                  <div className="xml-extra">
                    <span className="ui-label">SHA-256 do conteúdo sem formatação</span>
                    <button
                      type="button"
                      className="xml-valor"
                      title="Copiar"
                      aria-label="Copiar o resumo do conteúdo sem formatação"
                      onClick={() => copiar(hashNormalizado, 'normalizado')}
                    >
                      <span className="ui-mono">{hashNormalizado}</span>
                      <Icone icon={copiado === 'normalizado' ? faCheck : faCopy} aria-hidden="true" />
                    </button>
                    <p className="xml-nota">
                      Serve para responder "é o mesmo conteúdo?" quando um dos lados foi
                      reindentado: o espaço entre elementos é descartado antes do cálculo.
                      Não é a canonicalização do XML-DSig e não vale para conferir assinatura.
                    </p>
                  </div>
                )}

                {analise?.assinatura && (
                  <div className="xml-extra">
                    <span className="ui-label">Assinatura declarada no documento</span>
                    <dl className="xml-hashes">
                      <div>
                        <dt>DigestValue</dt>
                        <dd className="ui-mono">{analise.assinatura.digestValue || '—'}</dd>
                      </div>
                      <div>
                        <dt>Referência</dt>
                        <dd className="ui-mono">{analise.assinatura.referenciaUri || '—'}</dd>
                      </div>
                      <div>
                        <dt>Algoritmo</dt>
                        <dd className="ui-mono">{analise.assinatura.digestMethod || '—'}</dd>
                      </div>
                    </dl>
                    <p className="xml-nota">
                      São os valores que o arquivo declara, lidos como estão. Conferir se a
                      assinatura é válida exige canonicalizar o trecho assinado e verificar o
                      certificado — isso a ferramenta não faz.
                    </p>
                  </div>
                )}
              </section>
            ) : modo === 'leitura' ? (
              <section className="xml-painel" aria-label="Leitura">
                <header className="xml-painel-topo">
                  <h2>Leitura</h2>
                  <span className="xml-nota">
                    {arvore ? `${contarCampos(arvore)} valores` : ''}
                  </span>
                  <div className="xml-busca">
                    <Icone icon={faMagnifyingGlass} aria-hidden="true" />
                    <input
                      className="ui-input"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Filtrar por campo ou valor"
                      aria-label="Filtrar campos"
                    />
                  </div>
                </header>

                {!analise?.ok ? (
                  <div className="ui-vazio xml-vazio">
                    <Icone icon={faTriangleExclamation} aria-hidden="true" />
                    <span>
                      Só dá para montar a leitura de um documento bem formado. Veja o erro
                      acima; o hash continua disponível.
                    </span>
                  </div>
                ) : !arvoreFiltrada ? (
                  <div className="ui-vazio xml-vazio">
                    <Icone icon={faMagnifyingGlass} aria-hidden="true" />
                    <span>Nenhum campo ou valor com “{busca}”.</span>
                  </div>
                ) : (
                  <VisaoLeitura no={arvoreFiltrada} copiado={copiado} aoCopiar={copiar} />
                )}
              </section>
            ) : (
              <section className="xml-painel" aria-label="Documento">
                <header className="xml-painel-topo">
                  <h2>{modo === 'minificado' ? 'Minificado' : 'Formatado'}</h2>
                  <span className="xml-nota">
                    {saida ? `${saida.split('\n').length} linha(s)` : ''}
                  </span>
                  <Botao
                    tamanho="sm"
                    disabled={!saida}
                    onClick={() => copiar(saida, 'saida')}
                  >
                    <Icone icon={copiado === 'saida' ? faCheck : faCopy} aria-hidden="true" />
                    Copiar
                  </Botao>
                </header>

                {!analise?.ok ? (
                  <div className="ui-vazio xml-vazio">
                    <Icone icon={faTriangleExclamation} aria-hidden="true" />
                    <span>
                      Corrija o documento para poder formatá-lo. O hash continua disponível:
                      ele não depende do XML estar correto.
                    </span>
                  </div>
                ) : !saida ? (
                  <div className="ui-vazio xml-vazio">
                    <Icone icon={faFileCode} aria-hidden="true" />
                    <span>
                      Arquivo de {tamanhoLegivel(entrada.bytes.length)} — grande demais para
                      pintar na tela sem travar. O hash continua sendo calculado.
                    </span>
                  </div>
                ) : (
                  <pre className="xml-saida ui-mono">{saida}</pre>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
