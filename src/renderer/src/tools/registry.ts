import { faCodeBranch } from '../components/Icone'
import Repositorios from './Repositorios'
import type { Tool } from './types'

/**
 * Para adicionar uma ferramenta: crie o componente em src/renderer/src/tools/
 * e registre uma entrada aqui. Nada mais precisa mudar — a barra lateral, a
 * busca e o roteamento saem deste registro.
 */
export const tools: Tool[] = [
  {
    id: 'repos',
    name: 'Repositórios',
    description: 'Troca de branch e atualização em lote de vários repositórios git.',
    group: 'Git',
    glyph: faCodeBranch,
    Component: Repositorios
  }
]
