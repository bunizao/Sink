import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const scriptPath = resolve(process.cwd(), 'scripts/sync-upstream.mjs')
const fixturesRoot = resolve(process.cwd(), '.github')

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `${command} ${args.join(' ')} failed`)
  }

  return result.stdout.trim()
}

function runAllowFailure(command, args, cwd, env = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  })
}

function writeFile(repoDir, relativePath, contents) {
  const absolutePath = join(repoDir, relativePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, contents)
}

function commitAll(repoDir, message) {
  run('git', ['add', '.'], repoDir)
  run('git', ['commit', '-m', message], repoDir)
}

function setupRepoPair() {
  const rootDir = mkdtempSync(join(tmpdir(), 'sink-sync-test-'))
  const currentDir = join(rootDir, 'current')
  const upstreamDir = join(rootDir, 'upstream')

  mkdirSync(currentDir, { recursive: true })
  run('git', ['init', '-b', 'master'], currentDir)
  run('git', ['config', 'user.name', 'Test User'], currentDir)
  run('git', ['config', 'user.email', 'test@example.com'], currentDir)

  mkdirSync(join(currentDir, '.github'), { recursive: true })
  cpSync(
    join(fixturesRoot, 'sync-upstream-excluded-paths.txt'),
    join(currentDir, '.github', 'sync-upstream-excluded-paths.txt'),
  )

  writeFile(currentDir, 'app/error.vue', '<template>base-error</template>\n')
  writeFile(currentDir, 'app/pages/index.vue', '<template>base-home</template>\n')
  writeFile(currentDir, 'server/api/example.ts', 'export const value = "base"\n')
  commitAll(currentDir, 'feat: create base state')

  run('git', ['clone', currentDir, upstreamDir], rootDir)
  run('git', ['config', 'user.name', 'Test User'], upstreamDir)
  run('git', ['config', 'user.email', 'test@example.com'], upstreamDir)

  return { rootDir, currentDir, upstreamDir }
}

const cleanupDirs = []

afterEach(() => {
  for (const dir of cleanupDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('sync-upstream script', () => {
  it('preserves excluded frontend files while merging upstream backend changes', () => {
    const { rootDir, currentDir, upstreamDir } = setupRepoPair()
    cleanupDirs.push(rootDir)

    writeFile(currentDir, 'app/error.vue', '<template>local-error</template>\n')
    writeFile(currentDir, 'app/pages/index.vue', '<template>local-home</template>\n')
    commitAll(currentDir, 'feat: customize frontend')

    writeFile(upstreamDir, 'app/error.vue', '<template>upstream-error</template>\n')
    writeFile(upstreamDir, 'app/pages/index.vue', '<template>upstream-home</template>\n')
    writeFile(upstreamDir, 'server/api/example.ts', 'export const value = "upstream"\n')
    writeFile(upstreamDir, 'server/api/new.ts', 'export const added = true\n')
    commitAll(upstreamDir, 'feat: update upstream files')

    const result = runAllowFailure('node', [scriptPath], currentDir, {
      UPSTREAM_REMOTE_URL: upstreamDir,
      UPSTREAM_BRANCH: 'master',
    })

    expect(result.status).toBe(0)
    expect(readFileSync(join(currentDir, 'app/error.vue'), 'utf8')).toBe('<template>local-error</template>\n')
    expect(readFileSync(join(currentDir, 'app/pages/index.vue'), 'utf8')).toBe('<template>local-home</template>\n')
    expect(readFileSync(join(currentDir, 'server/api/new.ts'), 'utf8')).toBe('export const added = true\n')

    const unresolved = run('git', ['diff', '--name-only', '--diff-filter=U'], currentDir)
    expect(unresolved).toBe('')

    run('git', ['commit', '-m', 'chore: prepare merge commit'], currentDir)
    const parents = run('git', ['rev-list', '--parents', '-n', '1', 'HEAD'], currentDir).split(' ')
    expect(parents).toHaveLength(3)
  })

  it('aborts when non-excluded files still conflict after handling frontend overrides', () => {
    const { rootDir, currentDir, upstreamDir } = setupRepoPair()
    cleanupDirs.push(rootDir)

    writeFile(currentDir, 'server/api/example.ts', 'export const value = "local"\n')
    commitAll(currentDir, 'feat: local backend change')

    writeFile(upstreamDir, 'server/api/example.ts', 'export const value = "upstream"\n')
    commitAll(upstreamDir, 'feat: upstream backend change')

    const result = runAllowFailure('node', [scriptPath], currentDir, {
      UPSTREAM_REMOTE_URL: upstreamDir,
      UPSTREAM_BRANCH: 'master',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('non-excluded paths')
    expect(runAllowFailure('git', ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], currentDir).status).not.toBe(0)
    expect(readFileSync(join(currentDir, 'server/api/example.ts'), 'utf8')).toBe('export const value = "local"\n')
  })
})
