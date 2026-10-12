const assert = require('assert');
const registrationApi = require('../src/background/selection-script-registration.js');

function createChromeStub(options) {
  const config = options || {};
  const calls = [];
  let registered = (config.registered || []).slice();
  const chromeApi = {
    runtime: { lastError: null },
    scripting: {
      getRegisteredContentScripts(filter, callback) {
        calls.push(['get', filter]);
        callback(registered.filter((script) => filter.ids.includes(script.id)));
      },
      registerContentScripts(scripts, callback) {
        calls.push(['register', scripts]);
        registered = registered.concat(scripts);
        callback();
      },
      updateContentScripts(scripts, callback) {
        calls.push(['update', scripts]);
        registered = registered.map((script) => scripts.find((next) => next.id === script.id) || script);
        callback();
      },
      unregisterContentScripts(filter, callback) {
        calls.push(['unregister', filter]);
        registered = registered.filter((script) => !filter.ids.includes(script.id));
        callback();
      },
      executeScript(injection, callback) {
        calls.push(['execute', injection.target.tabId, injection.files]);
        if (config.failTabId === injection.target.tabId) {
          chromeApi.runtime.lastError = { message: 'Cannot access contents of the page' };
          callback();
          chromeApi.runtime.lastError = null;
          return;
        }
        callback([{ result: null }]);
      }
    },
    tabs: {
      query(queryInfo, callback) {
        calls.push(['query', queryInfo]);
        callback(config.tabs || []);
      }
    }
  };
  return { chromeApi, calls, getRegistered: () => registered };
}

(async () => {
  const { SCRIPT_ID, SCRIPT_FILES, RUN_AT } = registrationApi;

  {
    const stub = createChromeStub();
    const registration = registrationApi.createSelectionScriptRegistration({ chromeApi: stub.chromeApi });
    assert.strictEqual(await registration.sync(false), false);
    assert.deepStrictEqual(stub.calls.map((call) => call[0]), ['get'], 'staying off should only check the registration');
  }

  {
    const stub = createChromeStub({ tabs: [{ id: 1, url: 'https://example.com/' }] });
    const registration = registrationApi.createSelectionScriptRegistration({ chromeApi: stub.chromeApi });
    assert.strictEqual(await registration.sync(true), true);
    assert.deepStrictEqual(stub.calls.map((call) => call[0]), ['get', 'register'], 'a worker start should not inject into open tabs');
    const [script] = stub.getRegistered();
    assert.strictEqual(script.id, SCRIPT_ID);
    assert.deepStrictEqual(script.js, Array.from(SCRIPT_FILES));
    assert.deepStrictEqual(script.matches, ['<all_urls>']);
    assert.strictEqual(script.runAt, RUN_AT);
    assert.strictEqual(script.allFrames, false, 'the toolbar runs in the top frame only, as the manifest entry did');
    assert.strictEqual(script.persistAcrossSessions, true);

    await registration.sync(true);
    assert.strictEqual(stub.calls.filter((call) => call[0] === 'register').length, 1, 'a current registration should be left alone');
  }

  {
    const stub = createChromeStub({
      tabs: [
        { id: 1, url: 'https://example.com/' },
        { id: 2, url: 'chrome://settings/' },
        { id: 3, url: 'file:///Users/me/notes.html' },
        { id: 4, url: 'http://broken.example/' },
        { id: 5 }
      ],
      failTabId: 4
    });
    const registration = registrationApi.createSelectionScriptRegistration({ chromeApi: stub.chromeApi });
    assert.strictEqual(await registration.sync(true, { injectOpenTabs: true }), true);
    const injected = stub.calls.filter((call) => call[0] === 'execute');
    assert.deepStrictEqual(injected.map((call) => call[1]), [1, 3, 4], 'turning it on should reach open web and file pages only');
    injected.forEach((call) => assert.deepStrictEqual(call[2], Array.from(SCRIPT_FILES)));
    assert.strictEqual(stub.chromeApi.runtime.lastError, null);
  }

  {
    const stale = { id: SCRIPT_ID, matches: ['<all_urls>'], js: ['src/content/selection-quick-actions.js'], runAt: 'document_end' };
    const stub = createChromeStub({ registered: [stale] });
    const registration = registrationApi.createSelectionScriptRegistration({ chromeApi: stub.chromeApi });
    await registration.sync(true);
    assert.deepStrictEqual(stub.calls.map((call) => call[0]), ['get', 'update'], 'a registration from an older version should be updated');
    assert.deepStrictEqual(stub.getRegistered()[0].js, Array.from(SCRIPT_FILES));
  }

  {
    const stub = createChromeStub({ registered: [{ id: SCRIPT_ID, js: Array.from(SCRIPT_FILES), runAt: RUN_AT }] });
    const registration = registrationApi.createSelectionScriptRegistration({ chromeApi: stub.chromeApi });
    const first = registration.sync(true);
    const second = registration.sync(false);
    assert.strictEqual(await first, true);
    assert.strictEqual(await second, false);
    assert.deepStrictEqual(stub.getRegistered(), [], 'turning it off should unregister after earlier syncs finish');
  }

  {
    const registration = registrationApi.createSelectionScriptRegistration({ chromeApi: { runtime: {} } });
    assert.strictEqual(await registration.sync(true), true, 'a browser without scripting should not throw');
  }

  console.log('selection script registration tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
