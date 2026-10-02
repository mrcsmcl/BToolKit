import { ipcMain } from 'electron'
import type { BuscaPorEndereco } from '../../shared/cep'
import { porCep, porEndereco } from './consulta'
import { todosMunicipios } from './ibge'

/**
 * Ponte da consulta de CEP.
 *
 * A tela nunca passa URL: manda CEP, UF, cidade e logradouro, e quem valida e
 * monta o endereço é `consulta.ts`. Ver CONTRIBUTING §5.2.
 */
export function setupCep(): void {
  ipcMain.handle('cep:por-cep', (_e, valor: string) => porCep(valor))
  ipcMain.handle('cep:por-endereco', (_e, busca: BuscaPorEndereco) => porEndereco(busca))
  // Uma chamada só: a tela recebe os 5.571 municípios e filtra sozinha.
  ipcMain.handle('cep:municipios', () => todosMunicipios())
}
