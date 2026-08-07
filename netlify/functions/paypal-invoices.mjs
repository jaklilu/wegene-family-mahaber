function cleanEnv(value) {
  return String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\r?\n/g, '')
    .trim();
}

const CLIENT_ID = cleanEnv(
  process.env.PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENTID || process.env.CLIENT_ID
);
const CLIENT_SECRET = cleanEnv(
  process.env.PAYPAL_CLIENT_SECRET ||
    process.env.PAYPAL_SECRET ||
    process.env.PAYPAL_SECRET_KEY ||
    process.env.CLIENT_SECRET
);
const PAYPAL_MODE = cleanEnv(process.env.PAYPAL_MODE || 'live').toLowerCase();
const CUSTOM_API_BASE = cleanEnv(process.env.PAYPAL_API_BASE).replace(/\/$/, '');

const UNPAID_STATUSES = new Set([
  'SENT',
  'UNPAID',
  'PAYMENT_PENDING',
  'PARTIALLY_PAID',
  'MARKED_AS_UNPAID'
]);

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

function credentialDiagnostics() {
  return {
    hasClientId: Boolean(CLIENT_ID),
    hasClientSecret: Boolean(CLIENT_SECRET),
    clientIdLength: CLIENT_ID.length,
    clientSecretLength: CLIENT_SECRET.length,
    clientIdPrefix: CLIENT_ID ? CLIENT_ID.slice(0, 6) : '',
    mode: PAYPAL_MODE || 'live',
    customApiBase: CUSTOM_API_BASE || null
  };
}

function apiBasesToTry() {
  if (CUSTOM_API_BASE) return [CUSTOM_API_BASE];
  if (PAYPAL_MODE === 'sandbox') {
    return ['https://api-m.sandbox.paypal.com', 'https://api-m.paypal.com'];
  }
  return ['https://api-m.paypal.com', 'https://api-m.sandbox.paypal.com'];
}

async function getAccessToken() {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const bases = apiBasesToTry();
  const errors = [];

  for (const base of bases) {
    try {
      const response = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.access_token) {
        return { token: data.access_token, apiBase: base };
      }

      const detail = data.error_description || data.error || data.message || `HTTP ${response.status}`;
      errors.push(`${base}: ${detail}`);
    } catch (error) {
      errors.push(`${base}: ${error.message || 'network error'}`);
    }
  }

  throw new Error(`PayPal auth failed: ${errors.join(' | ')}`);
}

function money(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value.value != null) {
    const currency = value.currency_code || value.currencyCode || '';
    return currency ? `${value.value} ${currency}` : String(value.value);
  }
  return null;
}

function normalizeInvoice(item) {
  const detail = item.detail || {};
  const amount =
    money(item.amount) ||
    money(item.due_amount) ||
    money(item.amount_summary?.total) ||
    money(item.amount?.breakdown?.custom) ||
    money(detail.invoice_amount) ||
    null;

  const recipient =
    item.primary_recipients?.[0]?.billing_info?.name?.full_name ||
    item.primary_recipients?.[0]?.billing_info?.email_address ||
    item.primary_recipients?.[0]?.email_address ||
    detail.reference ||
    '—';

  const phone =
    item.primary_recipients?.[0]?.billing_info?.phones?.[0]?.national_number ||
    item.primary_recipients?.[0]?.billing_info?.phone?.national_number ||
    '';

  return {
    id: item.id || detail.invoice_id || '',
    number: detail.invoice_number || item.invoice_number || item.id || '—',
    status: item.status || detail.status || 'UNKNOWN',
    recipient,
    phone,
    amount,
    dueDate: detail.payment_term?.due_date || detail.due_date || null,
    invoiceDate: detail.invoice_date || null,
    viewUrl:
      item.detail?.metadata?.recipient_view_url ||
      item.metadata?.recipient_view_url ||
      item.links?.find((link) => link.rel === 'payer-view' || link.rel === 'recipient_view')?.href ||
      null
  };
}

function isUnpaid(invoice) {
  return UNPAID_STATUSES.has(String(invoice.status || '').toUpperCase());
}

async function searchUnpaidInvoices(token, apiBase) {
  const invoices = [];
  let page = 1;
  const pageSize = 100;

  while (page <= 20) {
    const url = `${apiBase}/v2/invoicing/search-invoices?page=${page}&page_size=${pageSize}&total_required=true`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        status: ['SENT', 'PAYMENT_PENDING', 'PARTIALLY_PAID']
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.message || data.name || `HTTP ${response.status}`;
      throw new Error(`PayPal invoice search failed: ${detail}`);
    }

    const items = data.items || data.invoices || [];
    invoices.push(...items.map(normalizeInvoice).filter(isUnpaid));

    const totalPages = Number(data.total_pages || data.totalPages || 1);
    if (page >= totalPages || items.length === 0) break;
    page += 1;
  }

  return invoices;
}

async function listAndFilterUnpaid(token, apiBase) {
  const invoices = [];
  let page = 1;
  const pageSize = 100;

  while (page <= 20) {
    const url = `${apiBase}/v2/invoicing/invoices?page=${page}&page_size=${pageSize}&total_required=true`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.message || data.name || `HTTP ${response.status}`;
      throw new Error(`PayPal invoice list failed: ${detail}`);
    }

    const items = data.items || data.invoices || [];
    invoices.push(...items.map(normalizeInvoice).filter(isUnpaid));

    const totalPages = Number(data.total_pages || data.totalPages || 1);
    if (page >= totalPages || items.length === 0) break;
    page += 1;
  }

  return invoices;
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (req.method !== 'GET') {
    return json(405, { error: 'Method not allowed.' });
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return json(500, {
      error: 'PayPal credentials are missing. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in Netlify.',
      diagnostics: credentialDiagnostics()
    });
  }

  try {
    const { token, apiBase } = await getAccessToken();
    let invoices;
    try {
      invoices = await searchUnpaidInvoices(token, apiBase);
    } catch (_) {
      invoices = await listAndFilterUnpaid(token, apiBase);
    }

    invoices.sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));

    return json(200, {
      ok: true,
      count: invoices.length,
      invoices,
      apiBase,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    return json(502, {
      error: error.message || 'Could not load PayPal invoices.',
      diagnostics: credentialDiagnostics(),
      hint:
        'In Netlify, use exact names PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET from the same PayPal Developer app. No quotes. After saving, Trigger deploy. Live business invoices need Live credentials (not Sandbox).'
    });
  }
};

export const config = {
  path: '/api/paypal-invoices'
};
