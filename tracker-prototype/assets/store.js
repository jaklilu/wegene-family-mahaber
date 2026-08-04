(function () {
  const CONFIG = window.WEGENE_CONFIG || {};
  const API_PATH = CONFIG.trackerApiPath || '/api/tracker-data';
  const WRITE_PASSWORD = CONFIG.memberPassword || 'Wegene2026!';

  function isValidData(data) {
    return data && Array.isArray(data.members) && data.state && Array.isArray(data.history);
  }

  async function fetchSharedData() {
    const response = await fetch(API_PATH, { cache: 'no-store' });
    if (response.status === 404) return { empty: true };
    if (!response.ok) throw new Error(`Shared data request failed (${response.status})`);
    return { empty: false, data: await response.json() };
  }

  function useSeed(storageKey, seed) {
    localStorage.setItem(storageKey, JSON.stringify(seed));
    saveTrackerData(storageKey, seed);
    return { data: seed, source: 'seed' };
  }

  async function loadTrackerData(storageKey, seed) {
    try {
      const remote = await fetchSharedData();
      if (!remote.empty && isValidData(remote.data)) {
        localStorage.setItem(storageKey, JSON.stringify(remote.data));
        return { data: remote.data, source: 'shared' };
      }
      // Empty shared store: always seed Nov 1 (ignore per-device local drift).
      if (remote.empty) return useSeed(storageKey, seed);
    } catch (_) {
      // Offline / API down: keep working from this device only.
    }

    const local = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (isValidData(local)) {
      return { data: local, source: 'local' };
    }

    return useSeed(storageKey, seed);
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
