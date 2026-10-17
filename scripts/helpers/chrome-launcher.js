'use strict';

// Launches a throwaway Chromium with a temp profile and guarantees it dies with
// the Node process that started it. A `finally` block alone is not enough: when
// the runner is killed (`timeout`, a tool timeout, Ctrl-C, SIGKILL) the browser
// is reparented to launchd and keeps running with its DevTools port open.
//
// Three layers of cleanup:
// 1. `close()` for the normal path.
// 2. exit/signal handlers for SIGINT/SIGTERM/SIGHUP and uncaught errors.
// 3. A detached shell watchdog that polls the parent pid and kills the browser
//    once the parent is gone, which also covers SIGKILL.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PROFILE_PREFIX = 'lumno-';
const playwrightCache = path.join(os.homedir(), 'Library/Caches/ms-playwright');

function findChrome(override) {
  if (override && fs.existsSync(override)) return override;
  let builds = [];
  try {
    builds = fs.readdirSync(playwrightCache)
      .filter((name) => /^chromium-\d+$/.test(name))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  } catch (_error) { /* no Playwright cache */ }
  const candidates = [
    ...builds.map((build) => path.join(
      playwrightCache,
      build,
      'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
    )),
    '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

const live = new Set();
let hooksInstalled = false;

function killAllSync() {
  for (const entry of live) entry.closeSync();
}

function installExitHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  process.on('exit', killAllSync);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.once(signal, () => {
      killAllSync();
      process.kill(process.pid, signal);
    });
  }
}

function startWatchdog(browserPid, profileDir) {
  // Runs in its own process group so a group-wide kill of the runner does not
  // take the watchdog down with it.
  const script = [
    'while kill -0 "$1" 2>/dev/null && kill -0 "$2" 2>/dev/null; do sleep 1; done',
    'kill -9 "$2" 2>/dev/null',
    'sleep 1',
    'case "$3" in */' + PROFILE_PREFIX + '*) rm -rf "$3" ;; esac'
  ].join('\n');
  const watchdog = spawn('/bin/sh', ['-c', script, 'lumno-chrome-watchdog', String(process.pid), String(browserPid), profileDir], {
    detached: true,
    stdio: 'ignore'
  });
  watchdog.unref();
  return watchdog;
}

/**
 * @param {object} options
 * @param {string[]} options.args Chrome flags; --user-data-dir is added here.
 * @param {string} [options.executable] Explicit binary; falls back to findChrome().
 * @param {string} [options.profileName] Suffix for the temp profile dir name.
 * @param {import('child_process').StdioOptions} [options.stdio]
 */
function launchChrome({ args, executable, profileName = 'chrome', stdio = 'ignore' }) {
  const chromePath = executable || findChrome();
  if (!chromePath) {
    throw new Error('No Chromium build that loads extensions was found.');
  }
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), `${PROFILE_PREFIX}${profileName}-`));
  installExitHooks();
  const child = spawn(chromePath, [`--user-data-dir=${profileDir}`, ...args], { stdio });

  let closed = false;
  const removeProfile = () => {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5 });
    } catch (_error) { /* the watchdog retries after the browser exits */ }
  };
  const entry = {
    closeSync() {
      if (closed) return;
      closed = true;
      live.delete(entry);
      try { child.kill('SIGKILL'); } catch (_error) { /* already gone */ }
      removeProfile();
    }
  };
  live.add(entry);
  child.once('exit', () => live.delete(entry));
  if (child.pid) startWatchdog(child.pid, profileDir);

  async function close() {
    if (closed) return;
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 1500);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    entry.closeSync();
  }

  return { child, profileDir, close };
}

module.exports = { findChrome, launchChrome, PROFILE_PREFIX };
