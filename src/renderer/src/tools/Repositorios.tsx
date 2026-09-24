import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import type { BatchKind, Outcome, RepoInfo } from '../../../shared/repos'
import {
  Icone,
  faArrowsRotate,
  faClockRotateLeft,
  faCodeBranch,
  faFolderOpen,
  faRotate,
  faTerminal,
  faXmark
} from '../components/Icone'
import { Botao } from '../components/ui'

type Linha = RepoInfo & { status: string; desfecho: Outcome | 'executando' | null }

interface LinhaLog {
  id: number
  texto: string
  tom: 'normal' | 'titulo' | 'ok' | 'aviso' | 'erro'
}

interface EventoAtividade {
  id: number
  hora: string
  repositorio: string
  mensagem: string
  outcome: Outcome
}

const FORMATADOR_HORA = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})

const TOM_CLASSE: Record<LinhaLog['tom'], string> = {
  normal: 'text-fg/75',
  titulo: 'text-fg',
  ok: 'text-emerald-400',
  aviso: 'text-amber-400',
  erro: 'text-red-400'
}

const LINHA_CLASSE: Record<string, string> = {
  ok: 'bg-emerald-500/7',
  pulado: 'bg-amber-500/8',
  falhou: 'bg-red-500/8',
  executando: 'bg-surface-2'
}

const TOM_DESFECHO: Record<Outcome, LinhaLog['tom']> = {
  ok: 'ok',
  pulado: 'aviso',
  falhou: 'erro'
}

export default function Repositorios(): ReactNode {
  const [raiz, setRaiz] = useState('')
  const [branch, setBranch] = useState('')
  const [comboboxAberto, setComboboxAberto] = useState(false)
  const [indiceSugestao, setIndiceSugestao] = useState(-1)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [log, setLog] = useState<LinhaLog[]>([])
  const [atividade, setAtividade] = useState<EventoAtividade[]>([])
  const [tituloAtividade, setTituloAtividade] = useState('Atividade da operação')
  const [ocupado, setOcupado] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0, texto: 'Pronto' })
  const [gitOk, setGitOk] = useState<boolean | null>(null)

  const proximoId = useRef(0)
  const proximoEventoId = useRef(0)
  const fimDoLog = useRef<HTMLDivElement>(null)
  const fimDaAtividade = useRef<HTMLDivElement>(null)

  // Espelho das linhas para leitura depois que um lote termina, sem entrar na
  // lista de dependências dos callbacks.
  const linhasRef = useRef<Linha[]>([])
  linhasRef.current = linhas

  const registrar = useCallback((texto: string, tom: LinhaLog['tom'] = 'normal'): void => {
    setLog((atual) => [...atual.slice(-500), { id: proximoId.current++, texto, tom }])
  }, [])

  const adicionarAtividade = useCallback(
    (repositorio: string, mensagem: string, outcome: Outcome): void => {
      setAtividade((atual) => [
        ...atual.slice(-49),
        {
          id: proximoEventoId.current++,
          hora: FORMATADOR_HORA.format(new Date()),
          repositorio,
          mensagem,
          outcome
        }
      ])
    },
    []
  )

  useEffect(() => {
    fimDoLog.current?.scrollIntoView({ block: 'end' })
  }, [log])

  useEffect(() => {
    fimDaAtividade.current?.scrollIntoView({ block: 'end' })
  }, [atividade])

  // Estado inicial: preferências salvas e disponibilidade do git.
  useEffect(() => {
    let vivo = true

    void (async () => {
      const config = await window.api.repos.lerConfig()
      if (!vivo) return
      setRaiz(config.raiz)
      setBranch(config.ultimaBranch)

      const { disponivel, versao } = await window.api.repos.versaoGit()
      if (!vivo) return
      setGitOk(disponivel)
      registrar(
        disponivel ? versao : 'git não encontrado no PATH. Instale o Git for Windows.',
        disponivel ? 'titulo' : 'erro'
      )
    })()

    return () => {
      vivo = false
    }
  }, [registrar])

  // O processo principal informa cada repositório concluído. Esses resultados
  // alimentam tanto a tabela quanto a timeline, sem inferir qual item iniciou.
  useEffect(() => {
    return window.api.repos.onProgresso((p) => {
      setLinhas((atual) =>
        atual.map((l) =>
          l.caminho === p.repo.caminho
            ? { ...l, ...p.repo, status: p.resultado.mensagem, desfecho: p.resultado.outcome }
            : l
        )
      )

      setProgresso({ feitos: p.concluidos, total: p.total, texto: p.repo.nome })
      adicionarAtividade(p.repo.nome, p.resultado.mensagem, p.resultado.outcome)

      if (p.resultado.outcome !== 'ok') {
        registrar(
          `[${p.repo.grupo}/${p.repo.nome}] ${p.resultado.mensagem}`,
          TOM_DESFECHO[p.resultado.outcome]
        )
        for (const linha of p.resultado.detalhe.split('\n').filter((l) => l.trim())) {
          registrar('      ' + linha.trimEnd())
        }
      }
    })
  }, [adicionarAtividade, registrar])

  const alvos = useMemo(() => {
    const selecionados = linhas.filter((l) => marcados.has(l.caminho))
    return selecionados.length > 0 ? selecionados : linhas
  }, [linhas, marcados])

  const branchesConhecidas = useMemo(() => {
    const todas = new Set<string>()
    for (const l of linhas) {
      for (const b of l.branchesRemotas) todas.add(b)
      if (l.branch && !l.branch.startsWith('(')) todas.add(l.branch)
    }
    return [...todas].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [linhas])

  const branchesFiltradas = useMemo(() => {
    const termo = branch.trim().toLocaleLowerCase('pt-BR')
    const correspondentes = termo
      ? branchesConhecidas.filter((item) => item.toLocaleLowerCase('pt-BR').includes(termo))
      : branchesConhecidas

    return correspondentes.slice(0, 12)
  }, [branch, branchesConhecidas])

  useEffect(() => {
    setIndiceSugestao((atual) => Math.min(atual, branchesFiltradas.length - 1))
  }, [branchesFiltradas.length])

  async function executar(
    kind: BatchKind,
    titulo: string,
    repos: Linha[],
    silencioso = false
  ): Promise<void> {
    if (ocupado || repos.length === 0) return

    setOcupado(true)
    setTituloAtividade(titulo)
    setAtividade([])
    setProgresso({ feitos: 0, total: repos.length, texto: '' })
    setLinhas((atual) =>
      atual.map((l) =>
        repos.some((r) => r.caminho === l.caminho)
          ? { ...l, status: 'executando...', desfecho: 'executando' }
          : l
      )
    )

    registrar('')
    registrar(`== ${titulo} - ${repos.length} repositório(s) ==`, 'titulo')

    try {
      const resumo = await window.api.repos.executar(kind, repos, branch.trim())
      setTituloAtividade(
        resumo.cancelado
          ? 'Operação cancelada'
          : resumo.falhas > 0
            ? 'Concluída com falhas'
            : 'Operação concluída'
      )

      if (resumo.cancelado) {
        registrar('-- operação cancelada pelo usuário --', 'aviso')
        adicionarAtividade('Operação', 'Cancelada pelo usuário', 'pulado')
      } else if (!silencioso || resumo.falhas > 0) {
        registrar(
          `-- concluído: ${resumo.ok} ok, ${resumo.pulados} pulado(s), ${resumo.falhas} falha(s) --`,
          resumo.falhas > 0 ? 'erro' : 'ok'
        )
      }
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e)
      setTituloAtividade('Falha na operação')
      registrar(`-- erro inesperado: ${mensagem} --`, 'erro')
      adicionarAtividade('Operação', mensagem, 'falhou')
    } finally {
      setOcupado(false)
      setProgresso((p) => ({ ...p, texto: 'Pronto' }))
    }
  }

  async function carregar(): Promise<void> {
    if (ocupado || carregando || gitOk === false) return

    const pasta = raiz.trim()
    setCarregando(true)
    setTituloAtividade('Procurando repositórios')
    setAtividade([])
    registrar(`procurando repositórios em ${pasta} (até 3 níveis)...`, 'titulo')

    try {
      const encontrados = await window.api.repos.procurar(pasta)
      const novas: Linha[] = encontrados.map((r) => ({ ...r, status: '', desfecho: null }))
      setMarcados(new Set())
      setLinhas(novas)

      if (encontrados.length === 0) {
        setTituloAtividade('Busca concluída')
        registrar('nenhum repositório git encontrado.', 'aviso')
        adicionarAtividade('Busca', 'Nenhum repositório Git encontrado', 'pulado')
        return
      }

      registrar(`${encontrados.length} repositório(s) encontrado(s).`)
      void window.api.repos.gravarConfig({ raiz: pasta, ultimaBranch: branch.trim() })

      setCarregando(false)
      await executar('refresh', 'Lendo estado local', novas, true)
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro)
      setTituloAtividade('Falha ao examinar pasta')
      registrar(`erro ao procurar repositórios: ${mensagem}`, 'erro')
      adicionarAtividade('Busca', mensagem, 'falhou')
    } finally {
      setCarregando(false)
    }
  }

  async function trocarBranch(): Promise<void> {
    const alvo = branch.trim()
    if (!alvo) return

    const sujos = alvos.filter((l) => l.alteracoes > 0).length
    if (sujos > 0) {
      registrar(
        `${sujos} repositório(s) com alterações pendentes terão stash automático — nada é perdido.`,
        'aviso'
      )
    }

    void window.api.repos.gravarConfig({ raiz: raiz.trim(), ultimaBranch: alvo })
    await executar('checkout', `Trocando para ${alvo}`, alvos)
    avisarSobreStashes()
  }

  /**
   * Trabalho guardado no stash some da árvore de trabalho. Sem um aviso visível ao fim
   * da operação isso parece perda de código — então vem destacado e com o comando.
   */
  function avisarSobreStashes(): void {
    const comStash = linhasRef.current.filter((l) => l.stashes > 0)
    if (comStash.length === 0) return

    registrar('')
    registrar(
      `ATENÇÃO: ${comStash.length} repositório(s) com alterações guardadas no stash. ` +
        'Elas saíram da pasta e voltam com os comandos abaixo:',
      'aviso'
    )
    for (const l of comStash) {
      registrar(`      git -C "${l.caminho}" stash pop`, 'aviso')
    }
  }

  function alternar(caminho: string): void {
    setMarcados((atual) => {
      const novo = new Set(atual)
      if (novo.has(caminho)) novo.delete(caminho)
      else novo.add(caminho)
      return novo
    })
  }

  function selecionarBranch(valor: string): void {
    setBranch(valor)
    setIndiceSugestao(-1)
    setComboboxAberto(false)
  }

  function navegarSugestoes(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.nativeEvent.isComposing) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setComboboxAberto(true)
      setIndiceSugestao((atual) =>
        branchesFiltradas.length === 0 ? -1 : Math.min(atual + 1, branchesFiltradas.length - 1)
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setComboboxAberto(true)
      setIndiceSugestao((atual) =>
        branchesFiltradas.length === 0
          ? -1
          : atual <= 0
            ? branchesFiltradas.length - 1
            : atual - 1
      )
      return
    }

    if (event.key === 'Enter' && comboboxAberto && indiceSugestao >= 0) {
      event.preventDefault()
      selecionarBranch(branchesFiltradas[indiceSugestao])
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setComboboxAberto(false)
      setIndiceSugestao(-1)
    }
  }

  const todosMarcados = linhas.length > 0 && marcados.size === linhas.length
  const gitIndisponivel = gitOk === false
  const emAndamento = ocupado || carregando
  const bloqueado = emAndamento || gitIndisponivel
  const resumoAtividade = emAndamento
    ? carregando
      ? 'Examinando a pasta configurada'
      : `${progresso.feitos} de ${progresso.total} concluído(s)`
    : tituloAtividade === 'Operação cancelada'
      ? 'Interrompida pelo usuário'
      : tituloAtividade.startsWith('Falha')
        ? 'Não foi possível concluir a operação'
        : tituloAtividade === 'Concluída com falhas'
          ? 'Finalizada com itens que exigem atenção'
          : atividade.length > 0
            ? 'Última operação concluída'
            : 'Nenhuma operação recente'

  return (
    <div className="repos-root">
      {gitOk === false && (
        <p role="alert" className="m-3 mb-0 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          Git não encontrado no PATH. Instale o Git for Windows para usar esta ferramenta.
        </p>
      )}

      <header className="tool-header repos-header">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight text-fg">
            <Icone icon={faCodeBranch} aria-hidden="true" className="text-sm text-muted" />
            Repositórios
          </h1>
          <div className="repos-header__meta">
            <span>{linhas.length} encontrado(s)</span>
            {marcados.size > 0 && <span>· {marcados.size} selecionado(s)</span>}
            {gitOk !== null && (
              <span
                className={`repos-git-dot ${gitOk ? 'repos-git-dot--ok' : 'repos-git-dot--erro'}`}
                role="status"
                aria-label={gitOk ? 'Git disponível' : 'Git indisponível'}
                title={gitOk ? 'Git disponível' : 'Git indisponível'}
              />
            )}
          </div>
        </div>
        <Botao
          className="repos-reload-button"
          disabled={bloqueado}
          onClick={carregar}
        >
          <Icone icon={faRotate} aria-hidden="true" />
          Recarregar
        </Botao>
      </header>

      <div className="repos-shell">
        <section className="repos-main">
          <div className="repos-controls">
            <label className="min-w-0">
              <span className="ui-label">Pasta raiz</span>
              <input
                value={raiz}
                onChange={(e) => setRaiz(e.target.value)}
                disabled={bloqueado}
                className="ui-input ui-mono"
              />
            </label>

            <Botao
              disabled={bloqueado}
              onClick={async () => {
                const escolhida = await window.api.repos.escolherPasta(raiz)
                if (escolhida) setRaiz(escolhida)
              }}
            >
              <Icone icon={faFolderOpen} aria-hidden="true" />
              Procurar…
            </Botao>

            <div
              className="repos-branch-combobox min-w-0"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setComboboxAberto(false)
                  setIndiceSugestao(-1)
                }
              }}
            >
              <label htmlFor="repos-branch" className="ui-label">
                Branch
              </label>
              <div className="relative">
                <input
                  id="repos-branch"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={comboboxAberto && !bloqueado && branchesConhecidas.length > 0}
                  aria-controls="repos-branches-listbox"
                  aria-activedescendant={
                    indiceSugestao >= 0 ? `repos-branch-option-${indiceSugestao}` : undefined
                  }
                  value={branch}
                  onChange={(event) => {
                    setBranch(event.target.value)
                    setIndiceSugestao(-1)
                    setComboboxAberto(true)
                  }}
                  onFocus={() => {
                    if (branchesConhecidas.length > 0) setComboboxAberto(true)
                  }}
                  onKeyDown={navegarSugestoes}
                  disabled={bloqueado}
                  placeholder="Buscar branch…"
                  className="ui-input ui-mono pr-8 placeholder:text-muted"
                />
                {branchesConhecidas.length > 0 && (
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[9px] text-muted">
                    {branchesFiltradas.length}
                  </span>
                )}
              </div>

              {comboboxAberto && !bloqueado && branchesConhecidas.length > 0 && (
                <ul id="repos-branches-listbox" role="listbox" className="repos-branch-listbox">
                  {branchesFiltradas.length > 0 ? (
                    branchesFiltradas.map((item, indice) => (
                      <li
                        key={item}
                        id={`repos-branch-option-${indice}`}
                        role="option"
                        aria-selected={indice === indiceSugestao}
                        className={`repos-branch-option ${
                          indice === indiceSugestao ? 'repos-branch-option--active' : ''
                        }`}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setIndiceSugestao(indice)}
                        onClick={() => selecionarBranch(item)}
                      >
                        <Icone icon={faCodeBranch} aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <li className="repos-branch-empty">Nenhuma branch correspondente.</li>
                  )}
                </ul>
              )}
            </div>

            <Botao
              disabled={bloqueado || !branch.trim() || linhas.length === 0}
              onClick={trocarBranch}
            >
              <Icone icon={faCodeBranch} aria-hidden="true" />
              Trocar branch
            </Botao>
          </div>

          <div className="repos-table">
            <table className="w-full border-collapse text-[11px]">
              <thead className="sticky top-0 z-10 bg-surface text-left text-[9px] tracking-wider text-muted uppercase">
                <tr>
                  <th className="w-9 px-2 py-2">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos os repositórios"
                      checked={todosMarcados}
                      disabled={bloqueado || linhas.length === 0}
                      onChange={() =>
                        setMarcados(todosMarcados ? new Set() : new Set(linhas.map((l) => l.caminho)))
                      }
                    />
                  </th>
                  <th className="repos-col-group px-2 py-2 font-semibold">Grupo</th>
                  <th className="px-2 py-2 font-semibold">Repositório</th>
                  <th className="px-2 py-2 font-semibold">Branch atual</th>
                  <th className="px-2 py-2 text-right font-semibold">Alt.</th>
                  <th className="repos-col-stash px-2 py-2 text-right font-semibold">Stash</th>
                  <th className="repos-col-remote px-2 py-2 font-semibold">Remoto</th>
                  <th className="px-2 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr
                    key={l.caminho}
                    onDoubleClick={() => window.api.repos.abrirPasta(l.caminho)}
                    title={`${l.caminho} — clique duplo para abrir`}
                    className={`border-t border-border ${l.desfecho ? LINHA_CLASSE[l.desfecho] : ''}`}
                  >
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${l.nome}`}
                        checked={marcados.has(l.caminho)}
                        disabled={ocupado}
                        onChange={() => alternar(l.caminho)}
                      />
                    </td>
                    <td className="repos-col-group px-2 py-1.5 text-muted">{l.grupo}</td>
                    <td className="px-2 py-1.5 font-medium text-fg">
                      <button
                        type="button"
                        title={`Abrir ${l.caminho}`}
                        onClick={() => window.api.repos.abrirPasta(l.caminho)}
                        className="max-w-52 truncate text-left hover:underline"
                      >
                        {l.nome}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[10px] text-fg/80">{l.branch}</td>
                    <td className={`px-2 py-1.5 text-right ${l.alteracoes > 0 ? 'font-semibold text-red-400' : 'text-muted'}`}>
                      {l.alteracoes || ''}
                    </td>
                    <td className="repos-col-stash px-2 py-1.5 text-right font-semibold text-amber-400">
                      {l.stashes || ''}
                    </td>
                    <td className="repos-col-remote px-2 py-1.5 text-muted">{l.aheadBehind}</td>
                    <td className="px-2 py-1.5">{l.status}</td>
                  </tr>
                ))}
                {linhas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-xs text-muted">
                      Escolha a pasta raiz e clique em Recarregar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className="repos-action-row">
            <div className="repos-action-row__track" aria-hidden="true">
              <span
                style={{
                  width: progresso.total > 0 ? `${(progresso.feitos / progresso.total) * 100}%` : '0%'
                }}
              />
            </div>
            <span role="status" aria-live="polite">
              {emAndamento
                ? carregando
                  ? 'Examinando pasta…'
                  : `${progresso.feitos}/${progresso.total} · ${progresso.texto}`
                : progresso.texto}
            </span>
            {marcados.size > 0 && <span>· {marcados.size} selecionado(s)</span>}

            <div className="repos-action-row__actions">
              <Botao
                disabled={bloqueado || linhas.length === 0}
                onClick={() => executar('update', 'Atualizando (fetch + fast-forward)', alvos)}
              >
                <Icone icon={faArrowsRotate} aria-hidden="true" />
                Atualizar tudo
              </Botao>
              <Botao variante="perigo" disabled={!ocupado} onClick={() => window.api.repos.cancelar()}>
                <Icone icon={faXmark} aria-hidden="true" />
                Cancelar
              </Botao>
            </div>
          </footer>
        </section>

        <aside className="repos-activity" aria-label="Atividade da operação">
          <header className="repos-activity-header">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 truncate text-[11px] font-semibold text-fg">
                <Icone icon={faClockRotateLeft} aria-hidden="true" className="text-[10px] text-muted" />
                {tituloAtividade}
              </h2>
              <p className="mt-1 text-[9px] text-muted" role="status" aria-live="polite">
                {resumoAtividade}
              </p>
            </div>
            {emAndamento && (
              <span
                className="repos-live"
                role="status"
                aria-label="Operação em andamento"
                title="Operação em andamento"
              />
            )}
          </header>

          <div className="repos-events" aria-label="Resultados recentes">
            {atividade.length === 0 ? (
              <div className="ui-vazio repos-events-empty">
                <p>
                  Os resultados de cada repositório aparecerão aqui durante uma operação.
                </p>
              </div>
            ) : (
              atividade.map((evento) => (
                <article key={evento.id} className={`repos-event repos-event--${evento.outcome}`}>
                  <span className="repos-event__dot" aria-hidden="true" />
                  <time>{evento.hora}</time>
                  <strong>{evento.repositorio}</strong>
                  <p>{evento.mensagem}</p>
                </article>
              ))
            )}
            <div ref={fimDaAtividade} />
          </div>

          <section className="repos-log-section" aria-label="Saída detalhada">
            <header className="repos-log-header">
              <span className="flex items-center gap-2">
                <Icone icon={faTerminal} aria-hidden="true" />
                Saída
              </span>
              <span>{log.length} linha(s)</span>
            </header>
            <div className="repos-log">
              {log.length === 0 && <div className="text-muted">Aguardando atividade…</div>}
              {log.map((l) => (
                <div key={l.id} className={`whitespace-pre-wrap ${TOM_CLASSE[l.tom]}`}>
                  {l.texto || ' '}
                </div>
              ))}
              <div ref={fimDoLog} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
