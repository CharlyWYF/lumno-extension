const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { findChrome, launchChrome } = require('./helpers/chrome-launcher.js');

const repoRoot = path.resolve(__dirname, '..');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check, timeoutMs, label) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await check();
      if (value) {
        return value;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(50);
  }
  const suffix = lastError ? `: ${lastError.message}` : '';
  throw new Error(`Timed out waiting for ${label}${suffix}`);
}

class CdpSession {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.once('open', resolve);
      this.socket.once('error', reject);
    });
    this.socket.on('message', (raw) => {
      const message = JSON.parse(String(raw));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message || 'CDP request failed'));
        } else {
          pending.resolve(message.result || {});
        }
        return;
      }
      const handlers = this.listeners.get(message.method) || [];
      handlers.forEach((handler) => handler(message.params || {}));
    });
  }

  on(method, handler) {
    const handlers = this.listeners.get(method) || [];
    handlers.push(handler);
    this.listeners.set(method, handlers);
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const response = new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return response;
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(session, expression, awaitPromise = false) {
  const response = await session.send('Runtime.evaluate', {
    awaitPromise,
    expression,
    returnByValue: true,
    userGesture: true
  });
  if (response.exceptionDetails) {
    const description = response.exceptionDetails.exception &&
      response.exceptionDetails.exception.description;
    throw new Error(description || response.exceptionDetails.text || 'Runtime evaluation failed');
  }
  return response.result ? response.result.value : undefined;
}

async function waitForOptionsReady(session, previousTimeOrigin) {
  return waitFor(async () => {
    const value = await evaluate(session, `(() => {
      const root = document.documentElement;
      const ready = root && root.getAttribute('data-lumno-options-ready') === 'true';
      const timeOrigin = performance.timeOrigin;
      return ready && (!${Number(previousTimeOrigin) || 0} || timeOrigin !== ${Number(previousTimeOrigin) || 0})
        ? timeOrigin
        : 0;
    })()`);
    return Number(value) || 0;
  }, 10000, 'Options ready marker');
}

async function readStartupMetrics(session) {
  return evaluate(session, `(() => {
    const root = document.documentElement;
    const navigation = performance.getEntriesByType('navigation')[0] || {};
    const read = (name) => root.getAttribute(name);
    return {
      readyMs: Number(read('data-lumno-options-ready-ms')),
      readyNavigationMs: Number(read('data-lumno-options-ready-navigation-ms')),
      storageReads: Number(read('data-lumno-options-bootstrap-storage-reads')),
      storageRequests: Number(read('data-lumno-options-bootstrap-storage-requests')),
      storageKeys: read('data-lumno-options-bootstrap-storage-keys'),
      controlRefreshes: Number(read('data-lumno-options-control-refreshes')),
      initialTab: read('data-options-initial-tab'),
      domInteractiveMs: Number(navigation.domInteractive || 0),
      loadEndMs: Number(navigation.loadEventEnd || 0),
      heapBytes: performance.memory ? performance.memory.usedJSHeapSize : null,
      visibilityState: document.visibilityState,
      timeOrigin: performance.timeOrigin
    };
  })()`);
}

async function createTarget(port, url) {
  const response = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,
    { method: 'PUT' }
  );
  if (!response.ok) {
    throw new Error(`Unable to create CDP target: HTTP ${response.status}`);
  }
  return response.json();
}

async function listTargets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) {
    throw new Error(`Unable to list CDP targets: HTTP ${response.status}`);
  }
  return response.json();
}

async function closeTarget(port, targetId) {
  await fetch(`http://127.0.0.1:${port}/json/close/${encodeURIComponent(targetId)}`);
}

function summarize(values) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const pick = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
  return {
    count: sorted.length,
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    median: Number(pick(0.5).toFixed(2)),
    min: Number(sorted[0].toFixed(2)),
    p95: Number(pick(0.95).toFixed(2))
  };
}

async function run() {
  const chromePath = findChrome(process.env.LUMNO_PERF_CHROME);
  if (!chromePath) {
    throw new Error('Chrome for Testing or Chromium was not found');
  }

  const stderr = [];
  let browser = null;
  let session = null;

  try {
    const chromeArgs = [
      `--disable-extensions-except=${repoRoot}`,
      `--load-extension=${repoRoot}`,
      '--remote-debugging-port=0',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-component-update',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--window-position=4000,0',
      '--window-size=1440,1000',
      'about:blank'
    ];
    if (process.env.LUMNO_PERF_HEADLESS === '1') {
      chromeArgs.unshift('--headless=new');
    }
    browser = launchChrome({
      executable: chromePath,
      profileName: 'options-perf',
      args: chromeArgs,
      stdio: ['ignore', 'ignore', 'pipe']
    });
    const activePortPath = path.join(browser.profileDir, 'DevToolsActivePort');
    browser.child.stderr.on('data', (chunk) => {
      stderr.push(String(chunk));
      if (stderr.length > 40) stderr.shift();
    });

    const port = await waitFor(() => {
      if (!fs.existsSync(activePortPath)) return null;
      const value = fs.readFileSync(activePortPath, 'utf8').split(/\r?\n/)[0];
      return Number(value) || null;
    }, 10000, 'Chrome remote debugging port');

    const extensionTarget = await waitFor(async () => {
      const targets = await listTargets(port);
      return targets.find((target) =>
        /^chrome-extension:\/\//.test(target.url) &&
        /\/src\/background\/background\.js(?:$|[?#])/.test(target.url)
      );
    }, 15000, 'Lumno extension target');
    const extensionIdMatch = extensionTarget.url.match(/^chrome-extension:\/\/([^/]+)/);
    if (!extensionIdMatch) {
      throw new Error(`Unable to derive extension ID from ${extensionTarget.url}`);
    }
    const extensionId = extensionIdMatch[1];
    const optionsUrl = `chrome-extension://${extensionId}/src/options/options.html#general`;
    const target = await createTarget(port, optionsUrl);
    const pageTargets = (await listTargets(port)).filter((item) =>
      item.type === 'page' && item.id !== target.id
    );
    await Promise.all(pageTargets.map((item) => closeTarget(port, item.id)));
    session = new CdpSession(target.webSocketDebuggerUrl);
    const logEntries = [];
    const exceptions = [];
    session.on('Log.entryAdded', ({ entry }) => {
      if (entry) logEntries.push(entry);
    });
    session.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      if (exceptionDetails) exceptions.push(exceptionDetails);
    });
    await Promise.all([
      session.send('Log.enable'),
      session.send('HeapProfiler.enable'),
      session.send('Page.enable'),
      session.send('Performance.enable'),
      session.send('Runtime.enable')
    ]);
    await delay(1200);
    const latePageTargets = (await listTargets(port)).filter((item) =>
      item.type === 'page' && item.id !== target.id
    );
    await Promise.all(latePageTargets.map((item) => closeTarget(port, item.id)));
    await session.send('Page.bringToFront');
    await waitFor(
      () => evaluate(session, "document.visibilityState === 'visible'"),
      5000,
      'foreground Options page'
    );

    let timeOrigin = 0;
    try {
      timeOrigin = await waitForOptionsReady(session, 0);
    } catch (error) {
      const diagnostic = await evaluate(session, `(() => ({
        bodyText: document.body ? document.body.innerText.slice(0, 500) : '',
        href: location.href,
        readyState: document.readyState,
        visibilityState: document.visibilityState,
        rootAttributes: document.documentElement
          ? Array.from(document.documentElement.attributes).map((item) => [item.name, item.value])
          : [],
        scripts: Array.from(document.scripts).map((item) => item.src || 'inline')
      }))()`);
      error.message += `\nOptions diagnostic: ${JSON.stringify(diagnostic)}`;
      throw error;
    }
    const startupRuns = [];
    for (let index = 0; index < 12; index += 1) {
      const previousTimeOrigin = timeOrigin;
      await session.send('Page.reload', { ignoreCache: true });
      timeOrigin = await waitForOptionsReady(session, previousTimeOrigin);
      startupRuns.push(await readStartupMetrics(session));
    }
    await session.send('HeapProfiler.collectGarbage');
    const heapAfterGcBytes = await evaluate(
      session,
      'performance.memory ? performance.memory.usedJSHeapSize : null'
    );

    await waitFor(async () => evaluate(session, `(() => {
      const hosts = [
        '_x_extension_search_engine_builtin_list_2026_unique_',
        '_x_extension_site_search_builtin_list_2024_unique_',
        '_x_extension_site_search_ai_builtin_list_2026_unique_'
      ].map((id) => document.getElementById(id)).filter(Boolean);
      return hosts.reduce((sum, host) => sum + host.textContent.trim().length, 0) > 100;
    })()`), 8000, 'site search providers');

    const tabStress = await evaluate(session, `(async () => {
      const tabKeys = ['general', 'account', 'appearance', 'shortcuts', 'blacklist', 'labs'];
      const firstFrame = [];
      const longTasks = [];
      const observer = typeof PerformanceObserver === 'function'
        ? new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => longTasks.push(entry.duration));
          })
        : null;
      if (observer) {
        try { observer.observe({ type: 'longtask' }); } catch (e) {}
      }
      for (let index = 0; index < 180; index += 1) {
        const button = document.querySelector('[data-tab="' + tabKeys[index % tabKeys.length] + '"]');
        const startedAt = performance.now();
        button.click();
        await new Promise((resolve) => requestAnimationFrame((frameAt) => {
          firstFrame.push(frameAt - startedAt);
          resolve();
        }));
      }
      const burstStartedAt = performance.now();
      for (let index = 0; index < 600; index += 1) {
        document.querySelector('[data-tab="' + tabKeys[index % tabKeys.length] + '"]').click();
      }
      const burstMs = performance.now() - burstStartedAt;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (observer) {
        observer.takeRecords().forEach((entry) => longTasks.push(entry.duration));
        observer.disconnect();
      }
      const sorted = firstFrame.slice().sort((a, b) => a - b);
      const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
      return {
        burstClicks: 600,
        burstMs,
        firstFrameMaxMs: sorted[sorted.length - 1],
        firstFrameMedianMs: percentile(0.5),
        firstFrameP95Ms: percentile(0.95),
        framesOver20Ms: sorted.filter((value) => value > 20).length,
        framesOver32Ms: sorted.filter((value) => value > 32).length,
        longTaskCount: longTasks.length,
        longestTaskMs: longTasks.length ? Math.max(...longTasks) : 0
      };
    })()`, true);

    const listStress = await evaluate(session, `(async () => {
      document.querySelector('[data-tab="shortcuts"]').click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const sourceHosts = [
        '_x_extension_search_engine_builtin_list_2026_unique_',
        '_x_extension_site_search_builtin_list_2024_unique_',
        '_x_extension_site_search_ai_builtin_list_2026_unique_'
      ].map((id) => document.getElementById(id)).filter(Boolean);
      const sourceNodes = sourceHosts.flatMap((host) => Array.from(host.children));
      let sourceClones = 0;
      for (let repeat = 0; repeat < 18; repeat += 1) {
        sourceNodes.forEach((node, index) => {
          const clone = node.cloneNode(true);
          clone.querySelectorAll('[id]').forEach((item) => item.removeAttribute('id'));
          sourceHosts[index % sourceHosts.length].appendChild(clone);
          sourceClones += 1;
        });
      }

      document.querySelector('[data-tab="blacklist"]').click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const blacklistHost = document.getElementById('_x_extension_blacklist_list_2026_unique_');
      const blacklistFragment = document.createDocumentFragment();
      for (let index = 0; index < 1000; index += 1) {
        const row = document.createElement('div');
        row.className = '_x_extension_shortcut_item_2024_unique_';
        row.textContent = 'pressure-test-' + index + '.example.com';
        blacklistFragment.appendChild(row);
      }
      blacklistHost.appendChild(blacklistFragment);

      const frameDelays = [];
      const longTasks = [];
      const observer = typeof PerformanceObserver === 'function'
        ? new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => longTasks.push(entry.duration));
          })
        : null;
      if (observer) {
        try { observer.observe({ type: 'longtask' }); } catch (e) {}
      }
      for (let index = 0; index < 160; index += 1) {
        const startedAt = performance.now();
        window.scrollTo(0, index % 2 ? 0 : document.documentElement.scrollHeight);
        await new Promise((resolve) => requestAnimationFrame((frameAt) => {
          frameDelays.push(frameAt - startedAt);
          resolve();
        }));
      }
      if (observer) {
        observer.takeRecords().forEach((entry) => longTasks.push(entry.duration));
        observer.disconnect();
      }
      const sorted = frameDelays.slice().sort((a, b) => a - b);
      const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
      return {
        blacklistRows: 1000,
        documentHeight: document.documentElement.scrollHeight,
        frameMaxMs: sorted[sorted.length - 1],
        frameMedianMs: percentile(0.5),
        frameP95Ms: percentile(0.95),
        framesOver20Ms: sorted.filter((value) => value > 20).length,
        framesOver32Ms: sorted.filter((value) => value > 32).length,
        longTaskCount: longTasks.length,
        longestTaskMs: longTasks.length ? Math.max(...longTasks) : 0,
        sourceClones
      };
    })()`, true);

    const startupReadyValues = startupRuns.map((item) => item.readyMs);
    const startupNavigationReadyValues = startupRuns.map((item) => item.readyNavigationMs);
    const domInteractiveValues = startupRuns.map((item) => item.domInteractiveMs);
    const heapValues = startupRuns.map((item) => item.heapBytes).filter(Number.isFinite);
    const relevantLogs = logEntries
      .filter((entry) => entry.level === 'warning' || entry.level === 'error')
      .map((entry) => ({ level: entry.level, source: entry.source, text: entry.text }));
    const report = {
      chromePath,
      console: {
        exceptions: exceptions.length,
        warningsAndErrors: relevantLogs
      },
      extensionId,
      listStress,
      startup: {
        controlRefreshes: Array.from(new Set(startupRuns.map((item) => item.controlRefreshes))),
        domInteractiveMs: summarize(domInteractiveValues),
        heapBytes: summarize(heapValues),
        heapAfterGcBytes,
        navigationReadyMs: summarize(startupNavigationReadyValues),
        readyMs: summarize(startupReadyValues),
        runs: startupRuns,
        storageReads: Array.from(new Set(startupRuns.map((item) => item.storageReads))),
        storageRequests: Array.from(new Set(startupRuns.map((item) => item.storageRequests)))
      },
      tabStress
    };
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (stderr.length > 0) {
      error.message += `\nChrome stderr:\n${stderr.slice(-12).join('')}`;
    }
    throw error;
  } finally {
    if (session) session.close();
    if (browser) await browser.close();
  }
}

run().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
