import { faGithub } from '@fortawesome/free-brands-svg-icons'
import {
  faArrowsRotate,
  faChevronRight,
  faCircleCheck,
  faClockRotateLeft,
  faCodeBranch,
  faDownload,
  faFolderOpen,
  faHouse,
  faMagnifyingGlass,
  faRotate,
  faTerminal,
  faTriangleExclamation,
  faXmark
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

/**
 * Os ícones são importados um a um e passados por referência (icon={faX}).
 * Não usamos library.add() com nomes em string: isso obriga o bundler a manter
 * o registro inteiro e derruba o tree-shaking.
 */
export {
  FontAwesomeIcon as Icone,
  faArrowsRotate,
  faChevronRight,
  faCircleCheck,
  faClockRotateLeft,
  faCodeBranch,
  faDownload,
  faFolderOpen,
  faGithub,
  faHouse,
  faMagnifyingGlass,
  faRotate,
  faTerminal,
  faTriangleExclamation,
  faXmark
}
