import type { ReactNode } from 'react'
import { useAmbiente } from '../ambiente'
import type { Tool } from '../tools/types'
import { Icone, faDownload, faLock } from './Icone'

/**
 * Mostrada no lugar da ferramenta quando o site abre uma entrada `desktop`.
 * O componente nunca é montado — no navegador ele não teria a ponte —, então
 * o chunk dela também não é baixado.
 */
export default function RequerApp({ tool }: { tool: Tool }): ReactNode {
  const { download, urlRepositorio } = useAmbiente()
  const href = download?.url ?? `${urlRepositorio}/releases/latest`

  return (
    <div className="requer-app">
      <span className="requer-app__icone" aria-hidden="true">
        <Icone icon={faLock} />
      </span>
      <h1>{tool.name} precisa do aplicativo</h1>
      <p>{tool.description}</p>
      <p className="requer-app__motivo">
        Esta ferramenta mexe em arquivos e programas da sua máquina, coisa que uma página no
        navegador não alcança. No aplicativo ela funciona igual às demais.
      </p>
      <a className="ui-btn ui-btn--primario ui-btn--lg" href={href}>
        <Icone icon={faDownload} aria-hidden="true" />
        Baixar para Windows
      </a>
      {download?.versao && (
        <span className="requer-app__nota">
          Versão {download.versao}
          {download.tamanhoMb ? ` · ${download.tamanhoMb} MB` : ''} — depois de instalado,
          atualiza sozinho.
        </span>
      )}
    </div>
  )
}
