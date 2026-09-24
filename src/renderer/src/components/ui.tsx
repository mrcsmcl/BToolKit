import type { ReactNode } from 'react'

/**
 * Primitivos de interface compartilhados pelo app e pelo site.
 *
 * Antes cada ferramenta tinha o próprio `Botao`, e eles divergiram sem ninguém
 * decidir: raio 6 contra 7, fonte 11 contra 9.5, recuo 12 contra 10 e nomes de
 * variante diferentes. Aqui existe uma implementação só.
 *
 * O estilo correspondente está em `componentes.css`, sob o prefixo `ui-`. Peça
 * que não precisa de comportamento em React — rótulo, campo, estado vazio —
 * usa a classe direto, sem embrulho: `<span className="ui-label">`.
 *
 * Para um link com aparência de botão, também vale a classe:
 * `<a className="ui-btn ui-btn--primario">`.
 */

type Variante = 'secundario' | 'primario' | 'perigo'
type Tamanho = 'sm' | 'md' | 'lg'

export function Botao({
  variante = 'secundario',
  tamanho = 'md',
  icone = false,
  className = '',
  ...props
}: React.ComponentProps<'button'> & {
  variante?: Variante
  tamanho?: Tamanho
  /** Só ícone: o botão vira quadrado. Exige `aria-label`. */
  icone?: boolean
}): ReactNode {
  const classes = [
    'ui-btn',
    variante !== 'secundario' && `ui-btn--${variante}`,
    tamanho !== 'md' && `ui-btn--${tamanho}`,
    icone && 'ui-btn--icone',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return <button type="button" {...props} className={classes} />
}
