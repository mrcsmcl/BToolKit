import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { ComponentType } from 'react'

export interface Tool {
  id: string
  name: string
  description: string
  /** Agrupamento na barra lateral. */
  group: string
  /** Ícone Font Awesome importado por referência. */
  glyph: IconDefinition
  Component: ComponentType
}
