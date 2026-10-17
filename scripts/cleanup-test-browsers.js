#!/usr/bin/env node
'use strict';

// Kills test browsers (and, with --servers, local dev servers) that outlived
// the script that started them. Only orphans are touched: processes already
// reparented to launchd (ppid 1). The user's own Chrome is never matched.
//
//   npm run cleanup:browsers                  kill every orphaned test browser
//   npm run cleanup:browsers -- --dry-run     list them only
//   npm run cleanup:browsers -- --min-age=15  only orphans older than 15 minutes
//   npm run cleanup:browsers -- --servers     also orphaned http.server/vite/serve
//                                             whose cwd is this repo or a Claude scratchpad

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const quiet = args.includes('--quiet');
const includeServers = args.includes('--servers');
const minAgeArg = args.find((arg) => arg.startsWith('--min-age='));
const minAgeSeconds = minAgeArg ? Number(minAgeArg.split('=')[1]) * 60 : 0;

const TEST_BROWSER_PATTERN = /(Google Chrome for Testing\.app|Chromium\.app|ms-playwright\/chromium[^/]*\/)[^ ]*\/MacOS\//;
const SERVER_PATTERN = /(-m\s+http\.server|\bvite\b|webpack-dev-server|live-server|\bserve\b|http-server)/;
const tempRoots = [os.tmpdir(), '/tmp', '/private/tmp'].map((dir) => {
  try { return fs.realpathSync(dir); } catch (_error) { return dir; }
});
const serverRoots = [repoRoot, '/private/tmp/claude-', '/tmp/claude-'];

function log(message) {
  if (!quiet) console.log(message);
}

function parseElapsed(value) {
  const [days, clock] = value.includes('-') ? value.split('-') : ['0', value];
  const parts = clock.split(':').map(Number);
  while (parts.length < 3) parts.unshift(0);
  return Number(days) * 86400 + parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function listProcesses() {
  const output = execFileSync('ps', ['-axww', '-o', 'pid=,ppid=,etime=,command='], { encoding: 'utf8' });
  return output.split('\n').map((line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/);
    if (!match) return null;
    return { pid: Number(match[1]), ppid: Number(match[2]), age: parseElapsed(match[3]), command: match[4] };
  }).filter(Boolean);
}

function tempProfileOf(command) {
  const match = command.match(/--user-data-dir=(\S+)/);
  if (!match) return null;
  let parent = path.dirname(match[1]);
  try { parent = fs.realpathSync(parent); } catch (_error) { /* profile already removed */ }
  return tempRoots.includes(parent) ? match[1] : null;
}

function cwdOf(pid) {
  try {
    const output = execFileSync('lsof', ['-a', '-d', 'cwd', '-p', String(pid), '-Fn'], { encoding: 'utf8' });
    const line = output.split('\n').find((item) => item.startsWith('n'));
    return line ? line.slice(1) : null;
  } catch (_error) {
    return null;
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (_error) {
    return false;
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const orphans = listProcesses().filter((proc) => proc.ppid === 1 && proc.age >= minAgeSeconds);
const browsers = orphans
  .filter((proc) => TEST_BROWSER_PATTERN.test(proc.command) && !/--type=/.test(proc.command))
  .map((proc) => ({ ...proc, profile: tempProfileOf(proc.command) }))
  .filter((proc) => proc.profile);
const servers = includeServers
  ? orphans
    .filter((proc) => SERVER_PATTERN.test(proc.command))
    .map((proc) => ({ ...proc, cwd: cwdOf(proc.pid) }))
    .filter((proc) => proc.cwd && serverRoots.some((root) => proc.cwd.startsWith(root)))
  : [];

const targets = [...browsers, ...servers];
if (targets.length === 0) {
  log('No orphaned test browsers or dev servers.');
  process.exit(0);
}

for (const proc of browsers) log(`browser ${proc.pid}  ${Math.round(proc.age / 60)}m  ${proc.profile}`);
for (const proc of servers) log(`server  ${proc.pid}  ${Math.round(proc.age / 60)}m  ${proc.cwd}  ${proc.command.slice(0, 80)}`);
if (dryRun) process.exit(0);

for (const proc of targets) {
  try { process.kill(proc.pid, 'SIGTERM'); } catch (_error) { /* already gone */ }
}
for (let attempt = 0; attempt < 10 && targets.some((proc) => alive(proc.pid)); attempt += 1) sleep(200);
for (const proc of targets) {
  if (alive(proc.pid)) {
    try { process.kill(proc.pid, 'SIGKILL'); } catch (_error) { /* already gone */ }
  }
}
for (const proc of browsers) {
  try {
    fs.rmSync(proc.profile, { recursive: true, force: true, maxRetries: 5 });
  } catch (_error) { /* best effort */ }
}
const survivors = targets.filter((proc) => alive(proc.pid));
log(`Cleaned ${targets.length - survivors.length} of ${targets.length}.`);
if (survivors.length > 0) {
  console.error(`Could not stop: ${survivors.map((proc) => proc.pid).join(', ')}`);
  process.exitCode = 1;
}
