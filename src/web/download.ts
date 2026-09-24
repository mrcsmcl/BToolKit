import pkg from '../../package.json'
import type { InfoDownload } from '../renderer/src/ambiente'

/** Mesmo campo que o electron-builder usa para publicar — fonte única da URL. */
export function urlRepositorio(): string {
  const bruta = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
  if (!bruta) return ''

  return bruta
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^git:\/\//, 'https://')
}

function paginaDeReleases(): InfoDownload {
  return {
    url: `${urlRepositorio()}/releases/latest`,
    direto: false,
    versao: '',
    tamanhoMb: null,
    publicadoEm: null
  }
}

/**
 * O nome do arquivo carrega a versão, então não existe link fixo para o .exe.
 * Consulta a API pública para montar o link direto e, em qualquer falha —
 * rede, limite de requisições, release sem instalador —, devolve a página de
 * releases, que sempre funciona.
 */
export async function obterDownload(): Promise<InfoDownload> {
  const repo = /^https:\/\/github\.com\/([^/]+)\/([^/]+)$/.exec(urlRepositorio())
  if (!repo) return paginaDeReleases()

  try {
    const [, dono, nome] = repo
    const resposta = await fetch(
      `https://api.github.com/repos/${dono}/${nome}/releases/latest`,
      { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(6000) }
    )
    if (!resposta.ok) return paginaDeReleases()

    const dados = (await resposta.json()) as {
      tag_name?: string
      published_at?: string
      assets?: Array<{ name?: string; browser_download_url?: string; size?: number }>
    }

    const instalador = dados.assets?.find((a) => a.name?.toLowerCase().endsWith('.exe'))
    if (!instalador?.browser_download_url) return paginaDeReleases()

    return {
      url: instalador.browser_download_url,
      direto: true,
      versao: (dados.tag_name ?? '').replace(/^v/, ''),
      tamanhoMb: instalador.size ? Math.round((instalador.size / 1_048_576) * 10) / 10 : null,
      publicadoEm: dados.published_at ?? null
    }
  } catch {
    return paginaDeReleases()
  }
}
