import { useEffect, useState, type ReactNode } from 'react'
import AppShell from '../renderer/src/App'
import { AmbienteProvider, type InfoDownload } from '../renderer/src/ambiente'
import { obterDownload, urlRepositorio } from './download'

/**
 * O site não tem casca própria: usa a mesma do app. Este componente só resolve
 * o que é específico do navegador — o release mais recente para o botão de
 * download — e entrega tudo pelo contexto de ambiente.
 */
export default function App(): ReactNode {
  const [download, setDownload] = useState<InfoDownload | null>(null)

  useEffect(() => {
    let vivo = true
    void obterDownload().then((d) => {
      if (vivo) setDownload(d)
    })
    return () => {
      vivo = false
    }
  }, [])

  return (
    <AmbienteProvider valor={{ tipo: 'site', download, urlRepositorio: urlRepositorio() }}>
      <AppShell />
    </AmbienteProvider>
  )
}
