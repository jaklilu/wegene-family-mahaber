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
    sameIdAndSecret: Boolean(CLIENT_ID) && CLIENT_ID === CLIENT_SECRET,
    mode: PAYPAL_MODE || 'live',
    customApiBase: CUSTOM_API_BASE || null,
    basesTried: apiBasesToTry()
  };
}

function apiBasesToTry() {
  const live = 'https://api-m.paypal.com';
  const sandbox = 'https://api-m.sandbox.paypal.com';
  if (CUSTOM_API_BASE) {
    const other = CUSTOM_API_BASE.includes('sandbox') ? live : sandbox;
    return [CUSTOM_API_BASE, other];
  }
  if (PAYPAL_MODE === 'sandbox') return [sandbox, live];
  return [live, sandbox];
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

function extractPayUrl(item) {
  return (
    item?.detail?.metadata?.recipient_view_url ||
    item?.metadata?.recipient_view_url ||
    item?.links?.find((link) =>
      ['payer-view', 'recipient_view', 'self'].includes(String(link.rel || ''))
    )?.href ||
    null
  );
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

  const payUrl = extractPayUrl(item);
  const payHref =
    payUrl && String(payUrl).includes('paypal.com')
      ? payUrl
      : item.id
        ? `https://www.paypal.com/invoice/payerView/details/${item.id}`
        : null;

  const metadata = detail.metadata || item.metadata || {};
  const sentRaw =
    metadata.first_sent_time ||
    metadata.last_sent_time ||
    metadata.create_time ||
    null;
  const sentDate = sentRaw ? String(sentRaw).slice(0, 10) : detail.invoice_date || null;
  const invoiceDate = detail.invoice_date || null;
  const dueDate =
    detail.payment_term?.due_date ||
    detail.due_date ||
    item.due_date ||
    item.payment_term?.due_date ||
    null;

  return {
    id: item.id || detail.invoice_id || '',
    number: detail.invoice_number || item.invoice_number || item.id || '—',
    status: item.status || detail.status || 'UNKNOWN',
    recipient,
    phone,
    amount,
    dueDate,
    invoiceDate,
    sentDate,
    viewUrl: payHref,
    payUrl: payHref
  };
}

async function fetchInvoiceDetails(token, apiBase, invoiceId) {
  if (!invoiceId) return null;
  const response = await fetch(`${apiBase}/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

async function attachPayLinks(token, apiBase, invoices) {
  const enriched = [];
  const chunkSize = 5;

  for (let i = 0; i < invoices.length; i += chunkSize) {
    const chunk = invoices.slice(i, i + chunkSize);
    const details = await Promise.all(
      chunk.map(async (invoice) => {
        const needsDetails = !invoice.dueDate || !invoice.payUrl || !String(invoice.payUrl).includes('paypal.com');
        if (!needsDetails) return invoice;

        const full = await fetchInvoiceDetails(token, apiBase, invoice.id);
        if (!full) return invoice;
        const merged = normalizeInvoice(full);
        return {
          ...invoice,
          ...merged,
          recipient: invoice.recipient !== '—' ? invoice.recipient : merged.recipient,
          phone: invoice.phone || merged.phone,
          amount: invoice.amount || merged.amount,
          dueDate: merged.dueDate || invoice.dueDate || merged.invoiceDate || invoice.invoiceDate || null,
          invoiceDate: merged.invoiceDate || invoice.invoiceDate || null,
          sentDate: merged.sentDate || invoice.sentDate || null,
          payUrl: merged.payUrl || invoice.payUrl || null,
          viewUrl: merged.viewUrl || invoice.viewUrl || null
        };
      })
    );
    enriched.push(...details);
  }

  return enriched;
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

    invoices = await attachPayLinks(token, apiBase, invoices);

    invoices.sort((a, b) =>
      String(a.recipient || '').localeCompare(String(b.recipient || ''), undefined, {
        sensitivity: 'base'
      })
    );

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
