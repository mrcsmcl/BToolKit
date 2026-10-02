/**
 * As 27 unidades da federação.
 *
 * Fica no shared porque os dois lados precisam da mesma lista: a tela monta o
 * seletor e o main recusa o que não estiver aqui. Duas letras quaisquer não
 * bastam — `XX` passaria e gastaria uma requisição para nada.
 */
export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
] as const

/** Um endereço devolvido pela consulta de CEP. */
export interface EnderecoCep {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  /** Código do IBGE do município; vazio quando a fonte não informa. */
  ibge: string
  ddd: string
}

/**
 * Resultado de uma consulta.
 *
 * Falha de rede é resultado, não exceção (CONTRIBUTING §5.2, regra 5): a tela
 * mostra o motivo e segue viva.
 */
export type ResultadoCep =
  | { ok: true; enderecos: EnderecoCep[]; doCache: boolean }
  | { ok: false; motivo: string }

export interface BuscaPorEndereco {
  uf: string
  cidade: string
  logradouro: string
}

/** Um município do IBGE, já sem o aninhamento de regiões da origem. */
export interface Municipio {
  /** Código de 7 dígitos. */
  codigo: string
  nome: string
  uf: string
  estado: string
}

export type ResultadoMunicipios =
  | { ok: true; municipios: Municipio[]; doCache: boolean }
  | { ok: false; motivo: string }

