import type { ComponentType } from 'react'

export interface Tool {
  id: string
  name: string
  description: string
  /** Agrupamento na barra lateral. */
  group: string
  /** Glifo curto mostrado no ícone da ferramenta. */
  glyph: string
  Component: ComponentType
}
