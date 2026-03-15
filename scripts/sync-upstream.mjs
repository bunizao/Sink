import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
  })

  if (!options.allowFailure && result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `git ${args.join(' ')} failed`)
  }

  return result
}

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT
  if (!outputFile)
    return

  appendFileSync(outputFile, `${name}=${value}\n`)
}

function readExcludedPaths(cwd) {
  const filePath = resolve(cwd, process.env.SYNC_EXCLUDED_PATHS_FILE || '.github/sync-upstream-excluded-paths.txt')
  return readFileSync(filePath, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

function hasPathInCommit(cwd, ref, filePath) {
  const result = runGit(['cat-file', '-e', `${ref}:${filePath}`], { cwd, allowFailure: true })
  return result.status === 0
}

function listUnmergedPaths(cwd) {
  return runGit(['diff', '--name-only', '--diff-filter=U'], { cwd }).stdout.split('\n').map(line => line.trim()).filter(Boolean)
}

function restoreExcludedPath(cwd, ref, filePath) {
  if (hasPathInCommit(cwd, ref, filePath)) {
    runGit(['checkout', ref, '--', filePath], { cwd })
    runGit(['add', '--', filePath], { cwd })
    return
  }

  rmSync(resolve(cwd, filePath), { recursive: true, force: true })
  runGit(['add', '-A', '--', filePath], { cwd, allowFailure: true })
}

function verifyExcludedPath(cwd, ref, filePath) {
  if (hasPathInCommit(cwd, ref, filePath)) {
    const result = runGit(['diff', '--quiet', ref, '--', filePath], { cwd, allowFailure: true })
    if (result.status !== 0) {
      throw new Error(`Excluded path drifted after merge: ${filePath}`)
    }
    return
  }

  const tracked = runGit(['ls-files', '--error-unmatch', '--', filePath], {
    cwd,
    allowFailure: true,
  })

  if (tracked.status === 0 || existsSync(resolve(cwd, filePath))) {
    throw new Error(`Excluded path should stay absent after merge: ${filePath}`)
  }
}

function main() {
  const cwd = process.cwd()
  const upstreamBranch = process.env.UPSTREAM_BRANCH || 'master'
  const upstreamRepo = process.env.UPSTREAM_REPO
  const upstreamRemoteUrl = process.env.UPSTREAM_REMOTE_URL || (upstreamRepo ? `https://github.com/${upstreamRepo}.git` : '')
  const upstreamRemoteName = process.env.SYNC_UPSTREAM_REMOTE_NAME || 'upstream'

  if (!upstreamRemoteUrl) {
    throw new Error('UPSTREAM_REPO or UPSTREAM_REMOTE_URL is required')
  }

  const excludedPaths = readExcludedPaths(cwd)
  const preSyncSha = runGit(['rev-parse', 'HEAD'], { cwd }).stdout.trim()
  const currentBranch = process.env.SYNC_CURRENT_BRANCH || runGit(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd }).stdout.trim()

  runGit(['remote', 'remove', upstreamRemoteName], { cwd, allowFailure: true })
  runGit(['remote', 'add', upstreamRemoteName, upstreamRemoteUrl], { cwd })
  runGit(['fetch', upstreamRemoteName, upstreamBranch], { cwd, stdio: 'inherit' })

  const pendingCommits = runGit(
    ['rev-list', '--count', `HEAD..${upstreamRemoteName}/${upstreamBranch}`],
    { cwd },
  ).stdout.trim()

  if (pendingCommits === '0') {
    console.log('No upstream changes to merge.')
    setOutput('has_changes', 'false')
    setOutput('current_branch', currentBranch)
    return
  }

  const mergeResult = runGit(
    ['merge', '--no-commit', '--no-ff', `${upstreamRemoteName}/${upstreamBranch}`],
    { cwd, allowFailure: true, stdio: 'inherit' },
  )

  if (mergeResult.status !== 0) {
    const excludedSet = new Set(excludedPaths)
    const conflictedPaths = listUnmergedPaths(cwd)

    for (const filePath of conflictedPaths) {
      if (!excludedSet.has(filePath))
        continue

      runGit(['checkout', '--ours', '--', filePath], { cwd })
      runGit(['add', '--', filePath], { cwd })
    }

    const remainingConflicts = listUnmergedPaths(cwd)
    if (remainingConflicts.length > 0) {
      runGit(['merge', '--abort'], { cwd, allowFailure: true })
      throw new Error(`Sync failed due to conflicts in non-excluded paths:\n${remainingConflicts.join('\n')}`)
    }
  }

  for (const filePath of excludedPaths) {
    restoreExcludedPath(cwd, preSyncSha, filePath)
  }

  for (const filePath of excludedPaths) {
    verifyExcludedPath(cwd, preSyncSha, filePath)
  }

  console.log(`Prepared upstream merge for ${currentBranch}.`)
  setOutput('has_changes', 'true')
  setOutput('current_branch', currentBranch)
}

try {
  main()
}
catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
