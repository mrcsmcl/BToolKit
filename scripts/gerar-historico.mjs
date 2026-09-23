import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SEPARADOR_CAMPO = '\0'
const CAMPOS_POR_COMMIT = 7
const FORMATO_LOG = '%H%x00%h%x00%aN%x00%aE%x00%aI%x00%s%x00%b'

function git(args) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  })
}

function parsearCommits(saida) {
  const campos = saida.split(SEPARADOR_CAMPO)
  if (campos.at(-1) === '') campos.pop()

  const commits = []
  for (let indice = 0; indice + CAMPOS_POR_COMMIT <= campos.length; indice += CAMPOS_POR_COMMIT) {
    const [hash, hashCurto, autor, email, data, titulo, corpo] = campos.slice(
      indice,
      indice + CAMPOS_POR_COMMIT
    )
    if (!/^[0-9a-f]{40}$/i.test(hash ?? '')) continue

    commits.push({
      hash,
      hashCurto: hashCurto ?? hash.slice(0, 7),
      autor: autor || 'Autor desconhecido',
      email: email ?? '',
      data: data ?? '',
      titulo: titulo || 'Commit sem título',
      corpo: (corpo ?? '').trim()
    })
  }

  return commits
}

function contribuidoresDosCommits(commits) {
  const contagem = new Map()
  for (const commit of commits) {
    const chave = `${commit.autor}\0${commit.email}`
    const existente = contagem.get(chave)
    if (existente) existente.commits += 1
    else
      contagem.set(chave, {
        nome: commit.autor,
        email: commit.email,
        commits: 1,
        commitHash: commit.hash
      })
  }
  return [...contagem.values()].sort(
    (a, b) => b.commits - a.commits || a.nome.localeCompare(b.nome, 'pt-BR')
  )
}

const commits = parsearCommits(
  git(['log', '-z', '--date=iso-strict', `--format=${FORMATO_LOG}`, 'HEAD', '--'])
)

if (commits.length === 0) throw new Error('não há commits para gerar o histórico')

const destino = resolve('.generated', 'historico.json')
mkdirSync(resolve('.generated'), { recursive: true })
writeFileSync(
  destino,
  JSON.stringify(
    {
      ok: true,
      origem: 'snapshot-empacotado',
      commits,
      contribuidores: contribuidoresDosCommits(commits)
    },
    null,
    2
  ),
  'utf8'
)

console.log(`Histórico gerado: ${commits.length} commits em ${destino}`)
