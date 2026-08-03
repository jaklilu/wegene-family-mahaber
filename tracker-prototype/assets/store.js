(function () {
  const CONFIG = window.WEGENE_CONFIG || {};
  const API_PATH = CONFIG.trackerApiPath || '/api/tracker-data';
  const WRITE_PASSWORD = CONFIG.memberPassword || 'Wegene2026!';
  const PREVIOUS_STORAGE_KEYS = ['wegene-tracker-mvp-v6', 'wegene-tracker-mvp-v5', 'wegene-tracker-mvp-v4'];

  function isValidData(data) {
    return data && Array.isArray(data.members) && data.state && Array.isArray(data.history);
  }

  async function fetchSharedData() {
    const response = await fetch(API_PATH, { cache: 'no-store' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Shared data request failed (${response.status})`);
    return response.json();
  }

  function readLocalData(storageKey) {
    const current = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (isValidData(current)) return current;

    for (const key of PREVIOUS_STORAGE_KEYS) {
      const previous = JSON.parse(localStorage.getItem(key) || 'null');
      if (isValidData(previous)) return previous;
    }
    return null;
  }

  async function loadTrackerData(storageKey, seed) {
    try {
      const remote = await fetchSharedData();
      if (isValidData(remote)) {
        localStorage.setItem(storageKey, JSON.stringify(remote));
        return { data: remote, source: 'shared' };
      }
    } catch (_) {
      // Fall through to local/seed when offline or API unavailable.
    }

    const local = readLocalData(storageKey);
    if (isValidData(local)) {
      localStorage.setItem(storageKey, JSON.stringify(local));
      // Publish existing browser data once so phones can sync after deploy.
      saveTrackerData(storageKey, local);
      return { data: local, source: 'local' };
    }

    return { data: seed, source: 'seed' };
  }

  async function saveTrackerData(storageKey, data) {
    data.state = data.state || {};
    data.state.updatedAt = new Date().toISOString();
    localStorage.setItem(storageKey, JSON.stringify(data));

    try {
      const response = await fetch(API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: WRITE_PASSWORD,
          data
        })
      });
      if (!response.ok) throw new Error(`Shared save failed (${response.status})`);
      return { ok: true, shared: true };
    } catch (_) {
      return { ok: true, shared: false };
    }
  }

  window.WegeneStore = {
    loadTrackerData,
    saveTrackerData
  };
}());
