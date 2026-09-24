/**
 * No navegador não existe `window.api` — a ponte do preload só é criada pelo
 * Electron. Sem isto, uma ferramenta que escapasse da regra falharia com
 * "Cannot read properties of undefined", sem dizer o que faltou.
 *
 * O Proxy responde a qualquer caminho e só explode quando alguém chama, com o
 * nome do canal na mensagem. O engano aparece alto, no primeiro teste.
 */
export function instalarApiAusente(): void {
  if ('api' in window) return

  Object.defineProperty(window, 'api', {
    value: criarRamo([]),
    configurable: false,
    writable: false
  })
}

function criarRamo(caminho: string[]): unknown {
  const alvo = (): never => {
    const nome = caminho.join('.') || 'api'
    throw new Error(
      `window.${nome} não existe no navegador. Esta ferramenta precisa do BToolKit instalado — ` +
        `marque-a como runtime: 'desktop' no registro.`
    )
  }

  return new Proxy(alvo, {
    get(_destino, propriedade) {
      // Deixa o JavaScript inspecionar o objeto sem disparar o erro.
      if (typeof propriedade === 'symbol' || propriedade === 'then') return undefined
      return criarRamo([...caminho, String(propriedade)])
    },
    apply: alvo
  })
}
