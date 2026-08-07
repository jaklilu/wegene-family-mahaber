const PAYPAL_API_BASE = (process.env.PAYPAL_API_BASE || 'https://api-m.paypal.com').replace(/\/$/, '');
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';

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

async function getAccessToken() {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    const detail = data.error_description || data.error || data.message || `HTTP ${response.status}`;
    throw new Error(`PayPal auth failed: ${detail}`);
  }
  return data.access_token;
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

async function searchUnpaidInvoices(token) {
  const invoices = [];
  let page = 1;
  const pageSize = 100;

  while (page <= 20) {
    const url = `${PAYPAL_API_BASE}/v2/invoicing/search-invoices?page=${page}&page_size=${pageSize}&total_required=true`;
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

async function listAndFilterUnpaid(token) {
  const invoices = [];
  let page = 1;
  const pageSize = 100;

  while (page <= 20) {
    const url = `${PAYPAL_API_BASE}/v2/invoicing/invoices?page=${page}&page_size=${pageSize}&total_required=true`;
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
      error: 'PayPal credentials are missing. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in Netlify.'
    });
  }

  try {
    const token = await getAccessToken();
    let invoices;
    try {
      invoices = await searchUnpaidInvoices(token);
    } catch (_) {
      invoices = await listAndFilterUnpaid(token);
    }

    invoices.sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));

    return json(200, {
      ok: true,
      count: invoices.length,
      invoices,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    return json(502, {
      error: error.message || 'Could not load PayPal invoices.'
    });
  }
};

export const config = {
  path: '/api/paypal-invoices'
};
