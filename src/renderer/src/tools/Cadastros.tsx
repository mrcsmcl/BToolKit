import { useMemo, useState, type ReactNode } from 'react'
import {
  Icone,
  faBuilding,
  faCheck,
  faCopy,
  faDownload,
  faIdCard,
  faRotate,
  faUsers
} from '../components/Icone'
import { Botao } from '../components/ui'
import {
  camposDaEmpresa,
  camposDaPessoa,
  gerarEmpresa,
  gerarPessoa,
  paraCsv,
  paraTexto
} from './cadastros/gerador'
import './cadastros/cadastros.css'

type Especie = 'pessoa' | 'empresa'
type Formato = 'texto' | 'csv' | 'json'

const QUANTIDADES = [1, 5, 10, 50]

/** Campos que se leem caractere a caractere, e por isso pedem monoespaçada. */
const MONOESPACADOS = new Set([
  'CPF',
  'CNPJ',
  'RG',
  'PIS/PASEP',
  'CNS',
  'Celular',
  'Telefone',
  'E-mail'
])

const ESPECIES: { id: Especie; rotulo: string; icone: typeof faIdCard }[] = [
  { id: 'pessoa', rotulo: 'Pessoas', icone: faIdCard },
  { id: 'empresa', rotulo: 'Empresas', icone: faBuilding }
]

const FORMATOS: { id: Formato; rotulo: string }[] = [
  { id: 'texto', rotulo: 'Texto' },
  { id: 'csv', rotulo: 'CSV' },
  { id: 'json', rotulo: 'JSON' }
]

export default function Cadastros(): ReactNode {
  const [especie, setEspecie] = useState<Especie>('pessoa')
  const [alfanumerico, setAlfanumerico] = useState(false)
  const [formato, setFormato] = useState<Formato>('texto')
  const [registros, setRegistros] = useState<unknown[]>([])
  const [copiado, setCopiado] = useState('')

  function gerar(quantidade: number, especieAlvo = especie, alfa = alfanumerico): void {
    setCopiado('')
    setRegistros(
      Array.from({ length: quantidade }, () =>
        especieAlvo === 'pessoa' ? gerarPessoa() : gerarEmpresa({ alfanumerico: alfa })
      )
    )
  }

  function trocarEspecie(nova: Especie): void {
    setEspecie(nova)
    setCopiado('')
    // Regerar na espécie nova em vez de limpar: ninguém troca de aba para ver vazio.
    if (registros.length > 0) gerar(registros.length, nova)
    else setRegistros([])
  }

  // Pares rótulo/valor; é esta forma que a tela mostra e que o CSV segue.
  const campos = useMemo(
    () =>
      registros.map((r) =>
        especie === 'pessoa'
          ? camposDaPessoa(r as Parameters<typeof camposDaPessoa>[0])
          : camposDaEmpresa(r as Parameters<typeof camposDaEmpresa>[0])
      ),
    [registros, especie]
  )

  const saida = useMemo(() => {
    if (registros.length === 0) return ''
    if (formato === 'json') return JSON.stringify(registros, null, 2)
    if (formato === 'csv') return paraCsv(campos)
    return paraTexto(campos)
  }, [registros, campos, formato])

  async function copiar(texto: string, marca: string): Promise<void> {
    await navigator.clipboard.writeText(texto)
    setCopiado(marca)
    window.setTimeout(() => setCopiado((atual) => (atual === marca ? '' : atual)), 1400)
  }

  const rotuloEspecie = especie === 'pessoa' ? 'pessoa(s)' : 'empresa(s)'

  return (
    <div className="cad-root">
      <header className="tool-header">
        <span className="tool-header__icone" aria-hidden="true">
          <Icone icon={faUsers} />
        </span>
        <div>
          <h1>Cadastros</h1>
          <p>Gera pessoas e empresas fictícias com documentos que passam na validação.</p>
        </div>
        <span className="tool-header__acoes">
          <div className="ui-seg" role="group" aria-label="O que gerar">
            {ESPECIES.map((e) => (
              <button
                key={e.id}
                type="button"
                className={`ui-seg__item ${e.id === especie ? 'ui-seg__item--ativo' : ''}`}
                aria-pressed={e.id === especie}
                onClick={() => trocarEspecie(e.id)}
              >
                <Icone icon={e.icone} aria-hidden="true" />
                {e.rotulo}
              </button>
            ))}
          </div>
        </span>
      </header>

      <div className="cad-shell">
        <section className="cad-barra">
          <div>
            <span className="ui-label">Quantidade</span>
            <div className="cad-quantidades">
              {QUANTIDADES.map((q) => (
                <Botao key={q} onClick={() => gerar(q)}>
                  {q}
                </Botao>
              ))}
              <Botao
                icone
                disabled={registros.length === 0}
                aria-label="Gerar novamente"
                title="Gerar novamente"
                onClick={() => gerar(registros.length)}
              >
                <Icone icon={faRotate} />
              </Botao>
            </div>
          </div>

          {especie === 'empresa' && (
            <label
              className="cad-switch"
              title="Gera o CNPJ com letras na raiz, no formato que a Receita passa a aceitar"
            >
              <input
                type="checkbox"
                checked={alfanumerico}
                onChange={(e) => {
                  setAlfanumerico(e.target.checked)
                  if (registros.length > 0) gerar(registros.length, especie, e.target.checked)
                }}
              />
              <span className="cad-switch-track" aria-hidden="true" />
              CNPJ alfanumérico
            </label>
          )}
        </section>

        <section className="cad-conteudo" aria-label="Cadastros gerados">
          <header className="cad-conteudo-topo">
            <h2>Gerados</h2>
            <span className="cad-contagem">
              {registros.length} {rotuloEspecie}
            </span>
            <div className="ui-seg" role="group" aria-label="Formato da cópia">
              {FORMATOS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`ui-seg__item ${f.id === formato ? 'ui-seg__item--ativo' : ''}`}
                  aria-pressed={f.id === formato}
                  onClick={() => setFormato(f.id)}
                >
                  {f.rotulo}
                </button>
              ))}
            </div>
          </header>

          {registros.length === 0 ? (
            <div className="ui-vazio cad-vazio">
              <Icone icon={faUsers} aria-hidden="true" />
              <span>Escolha uma quantidade para gerar {rotuloEspecie}.</span>
            </div>
          ) : formato === 'texto' ? (
            <div className="cad-cartoes">
              {campos.map((registro, indice) => {
                const [rotuloNome, nome] = registro[0]
                return (
                  <article key={indice} className="cad-cartao">
                    <header>
                      <button
                        type="button"
                        className="cad-nome"
                        title={`Copiar ${rotuloNome.toLowerCase()}`}
                        aria-label={`Copiar ${rotuloNome}: ${nome}`}
                        onClick={() => void copiar(nome, `${indice}-nome`)}
                      >
                        {nome}
                        <Icone
                          icon={copiado === `${indice}-nome` ? faCheck : faCopy}
                          aria-hidden="true"
                        />
                      </button>
                      <Botao
                        icone
                        tamanho="sm"
                        aria-label={`Copiar o cadastro de ${nome}`}
                        title="Copiar o cadastro inteiro"
                        onClick={() =>
                          void copiar(
                            registro.map(([r, v]) => `${r}: ${v}`).join('\n'),
                            `cartao-${indice}`
                          )
                        }
                      >
                        <Icone icon={copiado === `cartao-${indice}` ? faCheck : faCopy} />
                      </Botao>
                    </header>
                    <dl>
                      {registro.slice(1).map(([rotulo, valor]) => {
                        const marca = `${indice}-${rotulo}`
                        return (
                          <div key={rotulo} className="cad-campo">
                            <dt>{rotulo}</dt>
                            <dd>
                              {/* Clicar no valor copia: é o gesto que se tenta
                                  primeiro, e o ícone diz que ele funciona. */}
                              <button
                                type="button"
                                className="cad-valor"
                                title={`Copiar ${rotulo.toLowerCase()}`}
                                aria-label={`Copiar ${rotulo}: ${valor}`}
                                onClick={() => void copiar(valor, marca)}
                              >
                                <span className={MONOESPACADOS.has(rotulo) ? 'ui-mono' : ''}>
                                  {valor}
                                </span>
                                <Icone
                                  icon={copiado === marca ? faCheck : faCopy}
                                  aria-hidden="true"
                                />
                              </button>
                            </dd>
                          </div>
                        )
                      })}
                    </dl>
                  </article>
                )
              })}
            </div>
          ) : (
            <pre className="cad-saida ui-mono">{saida}</pre>
          )}

          {registros.length > 0 && (
            <footer className="cad-rodape">
              <span>
                Pessoas e empresas fictícias. Logradouro, bairro, cidade e CEP são reais e
                combinam entre si — só o número da casa é sorteado, então o endereço resolve
                numa consulta de CEP sem apontar para a porta de ninguém.
              </span>
              <Botao variante="primario" onClick={() => void copiar(saida, 'tudo')}>
                <Icone icon={copiado === 'tudo' ? faCheck : faDownload} aria-hidden="true" />
                {copiado === 'tudo' ? 'Copiado' : `Copiar em ${formato.toUpperCase()}`}
              </Botao>
            </footer>
          )}
        </section>
      </div>
    </div>
  )
}
