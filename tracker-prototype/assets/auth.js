(function () {
  const CONFIG = window.WEGENE_CONFIG || {};

  const defaults = {
    member: {
      password: CONFIG.memberPassword || 'Wegene2026!',
      storageKey: CONFIG.memberSessionStorageKey || CONFIG.sessionStorageKey || 'wegene-member-session-v1'
    },
    admin: {
      password: CONFIG.adminPassword || 'AdminDemo2026!',
      storageKey: CONFIG.adminSessionStorageKey || 'wegene-admin-session-v1'
    }
  };

  const $ = (id) => document.getElementById(id);

  function safeGet(key) {
    try { return sessionStorage.getItem(key) || localStorage.getItem(key); }
    catch (_) { return null; }
  }

  function safeSet(key) {
    try { sessionStorage.setItem(key, 'ok'); }
    catch (_) { localStorage.setItem(key, 'ok'); }
  }

  function safeClear(key) {
    try { sessionStorage.removeItem(key); } catch (_) {}
    try { localStorage.removeItem(key); } catch (_) {}
  }

  function showApp(loginScreenId, appShellId) {
    document.body.classList.add('is-authenticated');
    const login = $(loginScreenId);
    const shell = $(appShellId);
    if (login) login.hidden = true;
    if (shell) shell.hidden = false;
  }

  function showLogin(loginScreenId, appShellId) {
    document.body.classList.remove('is-authenticated');
    const login = $(loginScreenId);
    const shell = $(appShellId);
    if (login) login.hidden = false;
    if (shell) shell.hidden = true;
  }

  async function requireGate(options) {
    const mode = options.mode || 'member';
    const gate = defaults[mode];
    const input = $(options.passwordInputId);
    const button = $(options.loginButtonId);
    const error = $(options.errorId);

    if (!gate) throw new Error(`Unknown gate mode: ${mode}`);

    if (safeGet(gate.storageKey) === 'ok') {
      showApp(options.loginScreenId, options.appShellId);
      return true;
    }

    showLogin(options.loginScreenId, options.appShellId);

    const unlock = () => {
      const entered = (input?.value || '').trim();
      if (entered === gate.password) {
        safeSet(gate.storageKey);
        if (input) input.value = '';
        if (error) error.hidden = true;
        showApp(options.loginScreenId, options.appShellId);
        return true;
      }
      if (error) error.hidden = false;
      return false;
    };

    if (options.unlockName) window[options.unlockName] = unlock;
    if (button) button.addEventListener('click', unlock);
    if (input) {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          unlock();
        }
      });
    }
    return false;
  }

  function clearSession(mode = 'member') {
    const gate = defaults[mode];
    if (gate) safeClear(gate.storageKey);
  }

  window.WegeneAuth = { requireGate, clearSession };
}());
