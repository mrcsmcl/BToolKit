import { lazy } from 'react'
import { faCodeBranch, faShieldHalved } from '../components/Icone'
import type { Tool } from './types'

/**
 * Para adicionar uma ferramenta: crie o componente em src/renderer/src/tools/
 * e registre uma entrada aqui. Nada mais precisa mudar — a barra lateral, a
 * busca, a tela inicial e o site saem deste registro.
 */
export const tools: Tool[] = [
  {
    id: 'repos',
    name: 'Repositórios',
    description: 'Troca de branch e atualização em lote de vários repositórios git.',
    group: 'Git',
    glyph: faCodeBranch,
    runtime: 'desktop',
    Component: lazy(() => import('./Repositorios'))
  },
  {
    id: 'documentos',
    name: 'Documentos',
    description: 'Valida e gera CPF, CNPJ, CAEPF, CNS e PIS/PASEP.',
    group: 'Validação',
    glyph: faShieldHalved,
    runtime: 'universal',
    Component: lazy(() => import('./Documentos'))
  }
]
