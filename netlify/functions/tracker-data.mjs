import { getStore } from '@netlify/blobs';

const STORE_NAME = 'wegene-tracker';
const DATA_KEY = 'shared-data';
const WRITE_PASSWORD = process.env.TRACKER_WRITE_PASSWORD || 'Wegene2026!';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export default async (req) => {
  const store = getStore(STORE_NAME);

  if (req.method === 'GET') {
    const data = await store.get(DATA_KEY, { type: 'json' });
    if (!data) return json(404, { error: 'No shared tracker data yet.' });
    return json(200, data);
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch (_) {
      return json(400, { error: 'Invalid JSON body.' });
    }

    if (!body || body.password !== WRITE_PASSWORD) {
      return json(401, { error: 'Unauthorized.' });
    }

    const data = body.data;
    if (!data || !Array.isArray(data.members) || !data.state || !Array.isArray(data.history)) {
      return json(400, { error: 'Tracker data must include members, state, and history.' });
    }

    data.state = data.state || {};
    data.state.updatedAt = new Date().toISOString();
    await store.setJSON(DATA_KEY, data);
    return json(200, { ok: true, updatedAt: data.state.updatedAt });
  }

  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  return json(405, { error: 'Method not allowed.' });
};

export const config = {
  path: '/api/tracker-data'
};
