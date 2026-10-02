import { lazy } from 'react'
import {
  faCodeBranch,
  faFileCode,
  faLocationDot,
  faShieldHalved,
  faUsers
} from '../components/Icone'
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
    id: 'cadastros',
    name: 'Cadastros',
    description: 'Gera pessoas e empresas fictícias com documentos válidos.',
    group: 'Dados de teste',
    glyph: faUsers,
    runtime: 'universal',
    Component: lazy(() => import('./Cadastros'))
  },
  {
    id: 'cep',
    name: 'CEP',
    description: 'Procura o endereço pelo CEP, os CEPs de uma rua ou o município pelo IBGE.',
    group: 'Dados de teste',
    glyph: faLocationDot,
    runtime: 'desktop',
    Component: lazy(() => import('./Cep'))
  },
  {
    id: 'xml',
    name: 'XML',
    description: 'Confere, formata e calcula o hash de um arquivo XML.',
    group: 'Arquivos',
    glyph: faFileCode,
    runtime: 'universal',
    Component: lazy(() => import('./Xml'))
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
