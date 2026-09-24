import { createContext, useContext, type ReactNode } from 'react'

/** Release mais recente, usado pelo site para montar o botão de download. */
export interface InfoDownload {
  url: string
  /** Falso quando a API não respondeu e o link aponta para a página de releases. */
  direto: boolean
  versao: string
  tamanhoMb: number | null
  publicadoEm: string | null
}

export interface Ambiente {
  /** `app` no Electron, `site` no navegador. */
  tipo: 'app' | 'site'
  /** Só existe no site. */
  download: InfoDownload | null
  urlRepositorio: string
}

const PADRAO: Ambiente = { tipo: 'app', download: null, urlRepositorio: '' }

const Contexto = createContext<Ambiente>(PADRAO)

/**
 * A casca é a mesma nos dois produtos; só o ambiente muda. Em vez de duplicar a
 * rail, o Início e o roteamento num segundo App, quem monta a árvore diz onde
 * está rodando e os poucos pontos que divergem consultam este contexto.
 */
export function AmbienteProvider({
  valor,
  children
}: {
  valor: Ambiente
  children: ReactNode
}): ReactNode {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useAmbiente(): Ambiente {
  return useContext(Contexto)
}
