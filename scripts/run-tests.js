const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

// Runs every scripts/test-*.js file in its own Node process. Files run in a
// bounded worker pool; each file's output is buffered and printed in file
// name order so logs read the same as a serial run. Set LUMNO_TEST_SERIAL=1
// to run one file at a time (or LUMNO_TEST_JOBS=<n> to pick the pool size).

const repoRoot = path.join(__dirname, '..');
const testFiles = fs.readdirSync(__dirname)
  .filter((file) => /^test-.*\.js$/.test(file))
  .sort();

const MAX_JOBS = 8;

function getJobCount() {
  if (process.env.LUMNO_TEST_SERIAL === '1') {
    return 1;
  }
  const requested = Number.parseInt(process.env.LUMNO_TEST_JOBS || '', 10);
  if (Number.isFinite(requested) && requested > 0) {
    return requested;
  }
  const available = typeof os.availableParallelism === 'function'
    ? os.availableParallelism()
    : os.cpus().length;
  return Math.max(1, Math.min(MAX_JOBS, available || 1));
}

function runTestFile(relativePath) {
  return new Promise((resolve) => {
    const chunks = [];
    const child = spawn(process.execPath, [relativePath], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', (chunk) => chunks.push({ stream: 'stdout', chunk }));
    child.stderr.on('data', (chunk) => chunks.push({ stream: 'stderr', chunk }));
    child.on('error', (error) => {
      chunks.push({ stream: 'stderr', chunk: Buffer.from(`${error.stack || error}\n`) });
    });
    child.on('close', (code, signal) => {
      resolve({ chunks, ok: code === 0 && !signal });
    });
  });
}

async function main() {
  const jobs = Math.min(getJobCount(), testFiles.length) || 1;
  const results = new Array(testFiles.length);
  let nextToStart = 0;
  let nextToPrint = 0;
  let failures = 0;

  // Print finished results as soon as every earlier file has been printed.
  function flush() {
    while (nextToPrint < testFiles.length && results[nextToPrint]) {
      const relativePath = path.join('scripts', testFiles[nextToPrint]);
      const result = results[nextToPrint];
      process.stdout.write(`\n[TEST] ${relativePath}\n`);
      result.chunks.forEach(({ stream, chunk }) => process[stream].write(chunk));
      if (!result.ok) {
        failures += 1;
        process.stderr.write(`[FAIL] ${relativePath}\n`);
      }
      results[nextToPrint] = true;
      nextToPrint += 1;
    }
  }

  async function worker() {
    while (nextToStart < testFiles.length) {
      const index = nextToStart;
      nextToStart += 1;
      results[index] = await runTestFile(path.join('scripts', testFiles[index]));
      flush();
    }
  }

  await Promise.all(Array.from({ length: jobs }, worker));

  if (failures > 0) {
    process.stderr.write(`\n${failures} test file(s) failed.\n`);
    process.exit(1);
  }

  process.stdout.write(`\nAll ${testFiles.length} test files passed.\n`);
}

main();
