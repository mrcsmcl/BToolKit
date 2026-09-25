import { faGithub } from '@fortawesome/free-brands-svg-icons'
import {
  faArrowsRotate,
  faBriefcase,
  faBuilding,
  faCheck,
  faChevronRight,
  faCircleCheck,
  faClockRotateLeft,
  faCodeBranch,
  faCopy,
  faDownload,
  faFolderOpen,
  faGlobe,
  faHouse,
  faIdCard,
  faLayerGroup,
  faLock,
  faMagnifyingGlass,
  faRotate,
  faShieldHalved,
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
  faBriefcase,
  faBuilding,
  faCheck,
  faChevronRight,
  faCircleCheck,
  faClockRotateLeft,
  faCodeBranch,
  faCopy,
  faDownload,
  faFolderOpen,
  faGithub,
  faGlobe,
  faHouse,
  faIdCard,
  faLayerGroup,
  faLock,
  faMagnifyingGlass,
  faRotate,
  faShieldHalved,
  faTerminal,
  faTriangleExclamation,
  faXmark
}
