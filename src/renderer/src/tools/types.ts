import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { ComponentType, LazyExoticComponent } from 'react'

/**
 * Onde a ferramenta consegue rodar.
 *
 * `universal` — só precisa do navegador: aparece no site e no app.
 * `desktop`   — usa window.api (disco, processo, rede pelo main): só no app.
 *
 * Campo obrigatório de propósito. Sem valor padrão, quem cria ferramenta nova é
 * obrigado a decidir, em vez de herdar um default silenciosamente errado.
 *
 * Marcar como `universal` é também uma decisão de exposição: o site é público,
 * então a ferramenta fica ao alcance de qualquer pessoa na internet.
 */
export type Runtime = 'universal' | 'desktop'

export interface Tool {
  id: string
  name: string
  description: string
  /** Agrupamento na barra lateral. */
  group: string
  /** Ícone Font Awesome importado por referência. */
  glyph: IconDefinition
  runtime: Runtime
  /**
   * Carregado sob demanda. É isso que mantém o código de ferramenta `desktop`
   * fora do bundle do site: o import só é resolvido quando a tela abre.
   */
  Component: LazyExoticComponent<ComponentType>
}
