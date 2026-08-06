import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const distDir = path.join(projectRoot, 'dist');
const remoteName = process.env.GITHUB_PAGES_REMOTE || 'origin';
const branchName = process.env.GITHUB_PAGES_BRANCH || 'gh-pages';
const noPush = process.argv.includes('--no-push');

function log(message) {
  console.log(`[deploy-github-pages] ${message}`);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
    ...options,
  }).trim();
}

function runVisible(cwd, command, args, options = {}) {
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    ...options,
  });
}

function runNpm(args) {
  if (process.platform === 'win32') {
    runVisible(projectRoot, 'cmd.exe', [
      '/d',
      '/s',
      '/c',
      `npm ${args.join(' ')}`,
    ]);
  } else {
    runVisible(projectRoot, 'npm', args);
  }
}

function build() {
  log('Building app...');
  runNpm(['run', 'build']);

  if (!fs.existsSync(distDir)) {
    throw new Error(`Webpack output directory was not found: ${distDir}`);
  }

  const distStat = fs.statSync(distDir);
  if (!distStat.isDirectory()) {
    throw new Error(`Webpack output path is not a directory: ${distDir}`);
  }

  const indexFile = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexFile)) {
    throw new Error(
      `Webpack output is incomplete: ${indexFile} was not found.`,
    );
  }

  // Disable Jekyll processing so every generated asset is served verbatim.
  fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
  fs.writeFileSync(
    path.join(distDir, '.gitignore'),
    [
      '.babelrc',
      'package-lock.json',
      'pnpm-lock.yaml',
      'node_modules',
      'eslint.config.mjs',
      '.prettierignore',
      '.prettierrc.json',
      'dist',
      '.env',
      '.env.*',
      '*.log',
      '.DS_Store',
      'Thumbs.db',
      '',
    ].join('\n'),
  );
}

function getRemoteUrl() {
  try {
    return run('git', ['remote', 'get-url', remoteName]);
  } catch {
    throw new Error(`Git remote "${remoteName}" was not found.`);
  }
}

function getGitIdentity(key, fallback) {
  try {
    return run('git', ['config', '--get', key]) || fallback;
  } catch {
    return fallback;
  }
}

function createSingleCommit(remoteUrl = null) {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'fun-html-gh-pages-'),
  );

  try {
    fs.cpSync(distDir, tempDir, {
      recursive: true,
      force: true,
    });

    runVisible(tempDir, 'git', [
      'init',
      '--initial-branch',
      branchName,
    ]);

    runVisible(tempDir, 'git', [
      'config',
      'user.name',
      getGitIdentity('user.name', 'fun-html deploy'),
    ]);

    runVisible(tempDir, 'git', [
      'config',
      'user.email',
      getGitIdentity(
        'user.email',
        'actions@users.noreply.github.com',
      ),
    ]);

    runVisible(tempDir, 'git', ['add', '--all']);
    runVisible(tempDir, 'git', [
      'commit',
      '-m',
      'Deploy GitHub Pages',
    ]);

    const commitCount = execFileSync(
      'git',
      ['rev-list', '--count', 'HEAD'],
      {
        cwd: tempDir,
        encoding: 'utf8',
      },
    ).trim();

    if (commitCount !== '1') {
      throw new Error(
        `Deployment history verification failed: expected 1 commit, found ${commitCount}.`,
      );
    }

    const commit = execFileSync(
      'git',
      ['rev-parse', '--short', 'HEAD'],
      {
        cwd: tempDir,
        encoding: 'utf8',
      },
    ).trim();

    if (noPush) {
      log(
        `Dry run complete. Created single commit ${commit}; nothing was pushed.`,
      );
      return;
    }

    if (!remoteUrl) {
      throw new Error('Remote URL is required when pushing.');
    }

    runVisible(tempDir, 'git', [
      'remote',
      'add',
      remoteName,
      remoteUrl,
    ]);

    runVisible(tempDir, 'git', [
      'push',
      '--force',
      remoteName,
      `${branchName}:${branchName}`,
    ]);

    log(
      `Published single commit ${commit} to ${remoteName}/${branchName}.`,
    );
  } finally {
    fs.rmSync(tempDir, {
      recursive: true,
      force: true,
    });
  }
}

function main() {
  build();

  if (noPush) {
    createSingleCommit();
    return;
  }

  const remoteUrl = getRemoteUrl();
  createSingleCommit(remoteUrl);
}

try {
  main();
} catch (error) {
  console.error(
    '[deploy-github-pages] Failed:',
    error instanceof Error ? error.message : error,
  );

  process.exitCode = 1;
}
