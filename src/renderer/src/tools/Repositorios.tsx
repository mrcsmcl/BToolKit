import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { BatchKind, Outcome, RepoInfo } from '../../../shared/repos'

type Linha = RepoInfo & { status: string; desfecho: Outcome | 'executando' | null }

interface LinhaLog {
  id: number
  texto: string
  tom: 'normal' | 'titulo' | 'ok' | 'aviso' | 'erro'
}

const TOM_CLASSE: Record<LinhaLog['tom'], string> = {
  normal: 'text-fg/80',
  titulo: 'text-accent-fg',
  ok: 'text-emerald-400',
  aviso: 'text-amber-400',
  erro: 'text-red-400'
}

const LINHA_CLASSE: Record<string, string> = {
  ok: 'bg-emerald-500/10',
  pulado: 'bg-amber-500/10',
  falhou: 'bg-red-500/10',
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
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [log, setLog] = useState<LinhaLog[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0, texto: 'Pronto' })
  const [gitOk, setGitOk] = useState<boolean | null>(null)

  const proximoId = useRef(0)
  const fimDoLog = useRef<HTMLDivElement>(null)

  // Espelho das linhas para leitura depois que um lote termina, sem entrar na
  // lista de dependencias dos callbacks.
  const linhasRef = useRef<Linha[]>([])
  linhasRef.current = linhas

  const registrar = useCallback((texto: string, tom: LinhaLog['tom'] = 'normal'): void => {
    setLog((atual) => [...atual.slice(-500), { id: proximoId.current++, texto, tom }])
  }, [])

  useEffect(() => {
    fimDoLog.current?.scrollIntoView({ block: 'end' })
  }, [log])

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

  // Progresso chega do processo principal enquanto o lote roda.
  useEffect(() => {
    return window.api.repos.onProgresso((p) => {
      setLinhas((atual) =>
        atual.map((l) =>
          l.caminho === p.repo.caminho
            ? { ...l, ...p.repo, status: p.resultado.mensagem, desfecho: p.resultado.outcome }
            : l
        )
      )

      setProgresso({ feitos: p.concluidos, total: p.total, texto: `${p.repo.nome}` })

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
  }, [registrar])

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

  async function executar(
    kind: BatchKind,
    titulo: string,
    repos: Linha[],
    silencioso = false
  ): Promise<void> {
    if (ocupado || repos.length === 0) return

    setOcupado(true)
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

      if (resumo.cancelado) {
        registrar('-- operação cancelada pelo usuário --', 'aviso')
      } else if (!silencioso || resumo.falhas > 0) {
        registrar(
          `-- concluído: ${resumo.ok} ok, ${resumo.pulados} pulado(s), ${resumo.falhas} falha(s) --`,
          resumo.falhas > 0 ? 'erro' : 'ok'
        )
      }
    } catch (e) {
      registrar(`-- erro inesperado: ${e instanceof Error ? e.message : String(e)} --`, 'erro')
    } finally {
      setOcupado(false)
      setProgresso((p) => ({ ...p, texto: 'Pronto' }))
    }
  }

  async function carregar(): Promise<void> {
    if (ocupado) return

    const pasta = raiz.trim()
    registrar(`procurando repositórios em ${pasta} (até 3 níveis)...`, 'titulo')

    const encontrados = await window.api.repos.procurar(pasta)
    const novas: Linha[] = encontrados.map((r) => ({ ...r, status: '', desfecho: null }))
    setMarcados(new Set())
    setLinhas(novas)

    if (encontrados.length === 0) {
      registrar('nenhum repositório git encontrado.', 'aviso')
      return
    }

    registrar(`${encontrados.length} repositório(s) encontrado(s).`)
    void window.api.repos.gravarConfig({ raiz: pasta, ultimaBranch: branch.trim() })

    await executar('refresh', 'Lendo estado local', novas, true)
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

  const todosMarcados = linhas.length > 0 && marcados.size === linhas.length

  return (
    <div className="flex h-full flex-col gap-3">
      {gitOk === false && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          git não encontrado no PATH. Instale o Git for Windows para usar esta ferramenta.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-64 flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-muted uppercase">Pasta raiz</span>
          <input
            value={raiz}
            onChange={(e) => setRaiz(e.target.value)}
            disabled={ocupado}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
          />
        </label>

        <Botao
          variante="fantasma"
          disabled={ocupado}
          onClick={async () => {
            const escolhida = await window.api.repos.escolherPasta(raiz)
            if (escolhida) setRaiz(escolhida)
          }}
        >
          Procurar...
        </Botao>

        <Botao variante="fantasma" disabled={ocupado} onClick={carregar}>
          Recarregar lista
        </Botao>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-48 flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-muted uppercase">Branch</span>
          <input
            list="repos-branches"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            disabled={ocupado}
            placeholder="ex.: develop"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent disabled:opacity-50"
          />
          <datalist id="repos-branches">
            {branchesConhecidas.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </label>

        <Botao disabled={ocupado || !branch.trim() || linhas.length === 0} onClick={trocarBranch}>
          Trocar para a branch
        </Botao>

        <Botao
          variante="fantasma"
          disabled={ocupado || linhas.length === 0}
          onClick={() => executar('update', 'Atualizando (fetch + fast-forward)', alvos)}
        >
          Atualizar tudo
        </Botao>

        <Botao
          variante="fantasma"
          disabled={!ocupado}
          onClick={() => window.api.repos.cancelar()}
        >
          Cancelar
        </Botao>
      </div>

      <div className="min-h-48 flex-1 overflow-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-surface-2 text-left text-xs text-muted uppercase">
            <tr>
              <th className="w-9 px-2 py-2">
                <input
                  type="checkbox"
                  checked={todosMarcados}
                  disabled={ocupado || linhas.length === 0}
                  onChange={() =>
                    setMarcados(todosMarcados ? new Set() : new Set(linhas.map((l) => l.caminho)))
                  }
                />
              </th>
              <th className="px-2 py-2 font-medium">Grupo</th>
              <th className="px-2 py-2 font-medium">Repositório</th>
              <th className="px-2 py-2 font-medium">Branch atual</th>
              <th className="px-2 py-2 text-right font-medium">Alt.</th>
              <th className="px-2 py-2 text-right font-medium">Stash</th>
              <th className="px-2 py-2 font-medium">Em relação ao remoto</th>
              <th className="px-2 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={l.caminho}
                onDoubleClick={() => window.api.repos.abrirPasta(l.caminho)}
                title={l.caminho}
                className={`border-t border-border ${l.desfecho ? LINHA_CLASSE[l.desfecho] : ''}`}
              >
                <td className="px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={marcados.has(l.caminho)}
                    disabled={ocupado}
                    onChange={() => alternar(l.caminho)}
                  />
                </td>
                <td className="px-2 py-1.5 text-muted">{l.grupo}</td>
                <td className="px-2 py-1.5">{l.nome}</td>
                <td className="px-2 py-1.5 font-mono text-xs">{l.branch}</td>
                <td
                  className={`px-2 py-1.5 text-right ${l.alteracoes > 0 ? 'text-red-400' : 'text-muted'}`}
                >
                  {l.alteracoes || ''}
                </td>
                <td className="px-2 py-1.5 text-right font-semibold text-amber-400">
                  {l.stashes || ''}
                </td>
                <td className="px-2 py-1.5 text-muted">{l.aheadBehind}</td>
                <td className="px-2 py-1.5">{l.status}</td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted">
                  Escolha a pasta raiz e clique em Recarregar lista.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted">
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-accent transition-all"
            style={{
              width: progresso.total > 0 ? `${(progresso.feitos / progresso.total) * 100}%` : '0%'
            }}
          />
        </div>
        <span>
          {ocupado
            ? `${progresso.feitos}/${progresso.total} - ${progresso.texto}`
            : progresso.texto}
        </span>
        {marcados.size > 0 && <span>· {marcados.size} selecionado(s)</span>}
      </div>

      <div className="h-48 shrink-0 overflow-auto rounded-lg border border-border bg-surface p-3 font-mono text-xs leading-relaxed">
        {log.map((l) => (
          <div key={l.id} className={`whitespace-pre-wrap ${TOM_CLASSE[l.tom]}`}>
            {l.texto || ' '}
          </div>
        ))}
        <div ref={fimDoLog} />
      </div>
    </div>
  )
}

function Botao({
  variante = 'solido',
  ...props
}: React.ComponentProps<'button'> & { variante?: 'solido' | 'fantasma' }): ReactNode {
  const base =
    'rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed'
  const cor =
    variante === 'solido'
      ? 'bg-accent text-white hover:brightness-110'
      : 'border border-border bg-surface-2 text-fg hover:border-accent'

  return <button type="button" {...props} className={`${base} ${cor}`} />
}
