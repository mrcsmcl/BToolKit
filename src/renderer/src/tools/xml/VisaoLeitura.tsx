import { useState, type ReactNode } from 'react'
import { Icone, faCheck, faChevronRight, faCopy } from '../../components/Icone'
import type { Campo, Grupo, Lista, NoLeitura } from './leitura'

/**
 * Desenha a árvore de leitura: seções aninhadas, campos como rótulo/valor e
 * repetições como tabela.
 *
 * Fica separado do `Xml.tsx` porque é recursivo e tem estado próprio por nó
 * (recolher), que não cabe no componente da ferramenta.
 */

interface Props {
  no: NoLeitura
  nivel: number
  copiado: string
  caminho: string
  aoCopiar: (texto: string, marca: string) => void
}

function Valor({
  texto,
  marca,
  copiado,
  aoCopiar
}: {
  texto: string
  marca: string
  copiado: string
  aoCopiar: (t: string, m: string) => void
}): ReactNode {
  if (!texto) return <span className="xml-leitura__vazio">vazio</span>

  return (
    <button
      type="button"
      className="xml-valor"
      title="Copiar"
      aria-label={`Copiar ${texto.slice(0, 60)}`}
      onClick={() => aoCopiar(texto, marca)}
    >
      <span>{texto}</span>
      <Icone icon={copiado === marca ? faCheck : faCopy} aria-hidden="true" />
    </button>
  )
}

function Atributos({ de }: { de: { nome: string; valor: string }[] }): ReactNode {
  if (de.length === 0) return null
  return (
    <span className="xml-leitura__atributos">
      {de.map((a) => (
        <span key={a.nome} className="xml-leitura__atributo" title={`${a.nome} = ${a.valor}`}>
          <em>{a.nome}</em>
          {a.valor}
        </span>
      ))}
    </span>
  )
}

function LinhaCampo({ no, caminho, copiado, aoCopiar }: Props & { no: Campo }): ReactNode {
  return (
    <div className="xml-leitura__campo">
      <dt title={no.nomeCompleto}>{no.nome}</dt>
      <dd>
        <Valor texto={no.valor} marca={caminho} copiado={copiado} aoCopiar={aoCopiar} />
        <Atributos de={no.atributos} />
      </dd>
    </div>
  )
}

function Tabela({ no, caminho, copiado, aoCopiar }: Props & { no: Lista }): ReactNode {
  return (
    <section className="xml-leitura__lista">
      <header>
        <strong title={no.nomeCompleto}>{no.nome}</strong>
        <span>{no.linhas.length} itens</span>
        {no.prefixo && <span className="xml-leitura__prefixo">campos de {no.prefixo.slice(0, -1)}</span>}
      </header>
      <div className="xml-leitura__rolagem">
        <table>
          <thead>
            <tr>
              <th scope="col" className="xml-leitura__indice">
                #
              </th>
              {no.colunas.map((c) => (
                <th key={c} scope="col" title={c}>
                  {no.prefixo && c.startsWith(no.prefixo) ? c.slice(no.prefixo.length) : c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {no.linhas.map((linha, i) => (
              <tr key={i}>
                <td className="xml-leitura__indice">{i + 1}</td>
                {no.colunas.map((c) => (
                  <td key={c}>
                    <Valor
                      texto={linha[c] ?? ''}
                      marca={`${caminho}/${i}/${c}`}
                      copiado={copiado}
                      aoCopiar={aoCopiar}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Secao({ no, nivel, caminho, copiado, aoCopiar }: Props & { no: Grupo }): ReactNode {
  const [aberto, setAberto] = useState(true)

  // Campos folha ficam juntos numa lista de definição; o resto segue aninhado.
  const blocos: ReactNode[] = []
  let acumulados: Campo[] = []

  const despejar = (): void => {
    if (acumulados.length === 0) return
    blocos.push(
      <dl className="xml-leitura__campos" key={`campos-${blocos.length}`}>
        {acumulados.map((c, i) => (
          <LinhaCampo
            key={`${c.nome}-${i}`}
            no={c}
            nivel={nivel + 1}
            caminho={`${caminho}/${c.nome}-${i}`}
            copiado={copiado}
            aoCopiar={aoCopiar}
          />
        ))}
      </dl>
    )
    acumulados = []
  }

  for (const [i, filho] of no.filhos.entries()) {
    if (filho.tipo === 'campo') {
      acumulados.push(filho)
      continue
    }
    despejar()
    blocos.push(
      <No
        key={`${filho.nome}-${i}`}
        no={filho}
        nivel={nivel + 1}
        caminho={`${caminho}/${filho.nome}-${i}`}
        copiado={copiado}
        aoCopiar={aoCopiar}
      />
    )
  }
  despejar()

  return (
    <section className={`xml-leitura__grupo ${aberto ? '' : 'xml-leitura__grupo--fechado'}`}>
      <button
        type="button"
        className="xml-leitura__titulo"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        <Icone icon={faChevronRight} aria-hidden="true" />
        <strong title={no.nomeCompleto}>{no.nome}</strong>
        <Atributos de={no.atributos} />
      </button>
      {aberto && <div className="xml-leitura__corpo">{blocos}</div>}
    </section>
  )
}

function No(props: Props): ReactNode {
  if (props.no.tipo === 'campo') return <LinhaCampo {...props} no={props.no} />
  if (props.no.tipo === 'lista') return <Tabela {...props} no={props.no} />
  return <Secao {...props} no={props.no} />
}

export default function VisaoLeitura({
  no,
  copiado,
  aoCopiar
}: {
  no: NoLeitura
  copiado: string
  aoCopiar: (texto: string, marca: string) => void
}): ReactNode {
  return (
    <div className="xml-leitura">
      <No no={no} nivel={0} caminho={no.nome} copiado={copiado} aoCopiar={aoCopiar} />
    </div>
  )
}
