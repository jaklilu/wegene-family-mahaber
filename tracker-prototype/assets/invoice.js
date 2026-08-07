(async function () {
  const AUTH = window.WegeneAuth;
  const CONFIG = window.WEGENE_CONFIG || {};
  const API_PATH = CONFIG.paypalInvoicesApiPath || '/api/paypal-invoices';

  const $ = (id) => document.getElementById(id);

  function formatDate(value) {
    if (!value) return '—';
    const parts = String(value).slice(0, 10).split('-');
    if (parts.length !== 3) return value;
    return `${parts[1]}/${parts[2]}/${parts[0]}`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderInvoices(payload) {
    const body = $('invoice-table-body');
    const summary = $('invoice-summary');
    const error = $('invoice-error');
    if (error) {
      error.hidden = true;
      error.textContent = '';
    }

    const invoices = (payload.invoices || []).slice().sort((a, b) =>
      String(a.recipient || '').localeCompare(String(b.recipient || ''), undefined, {
        sensitivity: 'base'
      })
    );
    if (summary) {
      summary.textContent = invoices.length
        ? `${invoices.length} unpaid invoice${invoices.length === 1 ? '' : 's'}`
        : 'No unpaid invoices found.';
    }

    if (!body) return;
    if (!invoices.length) {
      body.innerHTML = '<tr><td colspan="6">No unpaid invoices right now.</td></tr>';
      return;
    }

    body.innerHTML = invoices.map((invoice) => {
      const member = [invoice.recipient, invoice.phone].filter(Boolean).join(' · ');
      const payHref = invoice.payUrl || invoice.viewUrl;
      const link = payHref
        ? `<a class="invoice-pay-link" href="${escapeHtml(payHref)}" target="_blank" rel="noopener noreferrer">Pay with PayPal</a>`
        : '—';
      return `<tr>
        <td data-label="Invoice"><strong>${escapeHtml(invoice.number)}</strong></td>
        <td data-label="Member">${escapeHtml(member || '—')}</td>
        <td data-label="Amount" class="date-cell">${escapeHtml(invoice.amount || '—')}</td>
        <td data-label="Due">${escapeHtml(formatDate(invoice.dueDate))}</td>
        <td data-label="Status"><span class="badge waiting">${escapeHtml(invoice.status)}</span></td>
        <td data-label="Pay">${link}</td>
      </tr>`;
    }).join('');
  }

  function showError(message) {
    const error = $('invoice-error');
    const body = $('invoice-table-body');
    const summary = $('invoice-summary');
    if (summary) summary.textContent = 'Could not load invoices.';
    if (body) body.innerHTML = '<tr><td colspan="6">Unable to load unpaid invoices.</td></tr>';
    if (error) {
      error.hidden = false;
      error.textContent = message;
    }
  }

  async function loadInvoices() {
    const summary = $('invoice-summary');
    const body = $('invoice-table-body');
    if (summary) summary.textContent = 'Loading unpaid invoices from PayPal…';
    if (body) body.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';

    try {
      const response = await fetch(API_PATH, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      renderInvoices(data);
    } catch (err) {
      showError(err.message || 'Could not load PayPal invoices.');
    }
  }

  await AUTH.requireGate({
    mode: 'member',
    loginScreenId: 'login-screen',
    appShellId: 'app-shell',
    passwordInputId: 'member-password',
    loginButtonId: 'login-button',
    errorId: 'login-error',
    unlockName: 'unlockWegeneInvoice'
  });

  if (window.WegeneMenu) window.WegeneMenu.setupMenu('menu-toggle', 'site-menu');
  $('logout-button')?.addEventListener('click', () => {
    AUTH.clearSession('member');
    location.reload();
  });
  $('invoice-refresh')?.addEventListener('click', loadInvoices);

  await loadInvoices();
})();
