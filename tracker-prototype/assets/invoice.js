(async function () {
  const AUTH = window.WegeneAuth;
  const CONFIG = window.WEGENE_CONFIG || {};
  const API_PATH = CONFIG.paypalInvoicesApiPath || '/api/paypal-invoices';
  const showAll = new URLSearchParams(location.search).get('all') === '1';

  const $ = (id) => document.getElementById(id);
  let allInvoices = [];

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

  function recipientKey(invoice) {
    return String(invoice.recipient || '').trim();
  }

  function uniqueNames(invoices) {
    const names = [...new Set(invoices.map(recipientKey).filter((name) => name && name !== '—'))];
    return names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  function setPickerVisible(visible) {
    const label = document.querySelector('.invoice-select-label');
    const select = $('invoice-member-select');
    if (label) label.hidden = !visible;
    if (select) select.hidden = !visible;
  }

  function fillNameDropdown(invoices) {
    const select = $('invoice-member-select');
    if (!select) return;

    const names = uniqueNames(invoices);
    const previous = select.value;
    select.innerHTML =
      '<option value="">Choose your name…</option>' +
      names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    select.disabled = names.length === 0;

    if (previous && names.includes(previous)) {
      select.value = previous;
      renderSelectedMember(previous);
    } else {
      select.value = '';
      if (!showAll) hideResults();
    }
  }

  function hideResults() {
    const results = $('invoice-results');
    if (results) {
      results.hidden = true;
      results.innerHTML = '';
    }
  }

  function invoiceCard(invoice, name) {
    const payHref = invoice.payUrl || invoice.viewUrl;
    const payButton = payHref
      ? `<a class="invoice-pay-link" href="${escapeHtml(payHref)}" target="_blank" rel="noopener noreferrer">Pay with PayPal</a>`
      : '<span class="hint">Pay link unavailable</span>';

    return `<article class="invoice-result-card">
      <div class="invoice-result-top">
        <p class="invoice-result-name">${escapeHtml(name)}</p>
      </div>
      <dl class="invoice-result-meta">
        <div><dt>Invoice</dt><dd>${escapeHtml(invoice.number)}</dd></div>
        <div><dt>Amount</dt><dd class="invoice-result-amount">${escapeHtml(invoice.amount || '—')}</dd></div>
        <div class="invoice-due-pay">
          <div>
            <dt>Due Date</dt>
            <dd>${escapeHtml(formatDate(invoice.dueDate || invoice.invoiceDate || invoice.sentDate))}</dd>
          </div>
          ${payButton}
        </div>
      </dl>
    </article>`;
  }

  function renderAllInvoices() {
    const results = $('invoice-results');
    if (!results) return;

    if (!allInvoices.length) {
      results.hidden = false;
      results.innerHTML = `<div class="invoice-empty-card">
        <p class="invoice-empty-title">All clear!</p>
        <p class="invoice-empty">There are no unpaid invoices at the moment. Thank you for supporting Wegene Family Mahaber.</p>
      </div>`;
      return;
    }

    results.hidden = false;
    results.innerHTML =
      `<p class="invoice-all-note">${allInvoices.length} unpaid invoice${allInvoices.length === 1 ? '' : 's'}</p>` +
      allInvoices.map((invoice) => invoiceCard(invoice, recipientKey(invoice) || '—')).join('');
  }

  function renderSelectedMember(name) {
    const results = $('invoice-results');
    if (!results) return;

    if (!name) {
      hideResults();
      return;
    }

    const matches = allInvoices.filter((invoice) => recipientKey(invoice) === name);
    if (!matches.length) {
      results.hidden = false;
      results.innerHTML = `<div class="invoice-empty-card">
        <p class="invoice-empty-title">You're all caught up, ${escapeHtml(name)}!</p>
        <p class="invoice-empty">No unpaid invoice right now. Thank you for staying current with Wegene Family Mahaber.</p>
      </div>`;
      return;
    }

    results.hidden = false;
    results.innerHTML = matches.map((invoice) => invoiceCard(invoice, name)).join('');
  }

  function showLoadedState(invoices) {
    const summary = $('invoice-summary');
    const error = $('invoice-error');
    if (error) {
      error.hidden = true;
      error.textContent = '';
    }

    allInvoices = invoices;

    if (showAll) {
      setPickerVisible(false);
      if (summary) {
        summary.textContent = invoices.length
          ? `${invoices.length} unpaid invoice${invoices.length === 1 ? '' : 's'}`
          : 'Great news — everyone is paid up right now.';
      }
      renderAllInvoices();
      return;
    }

    setPickerVisible(true);
    fillNameDropdown(invoices);

    if (summary) {
      const count = uniqueNames(invoices).length;
      summary.textContent = count
        ? `${count} member${count === 1 ? '' : 's'} with unpaid invoices`
        : 'Great news — everyone is paid up right now.';
    }

    if (!invoices.length) {
      const results = $('invoice-results');
      if (results) {
        results.hidden = false;
        results.innerHTML = `<div class="invoice-empty-card">
          <p class="invoice-empty-title">All clear!</p>
          <p class="invoice-empty">There are no unpaid invoices at the moment. Thank you for supporting Wegene Family Mahaber.</p>
        </div>`;
      }
    }
  }

  function showError(message) {
    const error = $('invoice-error');
    const summary = $('invoice-summary');
    const select = $('invoice-member-select');
    allInvoices = [];
    hideResults();
    if (select) {
      select.innerHTML = '<option value="">Choose your name…</option>';
      select.disabled = true;
    }
    if (summary) summary.textContent = 'Could not load invoices.';
    if (error) {
      error.hidden = false;
      error.textContent = message;
    }
  }

  async function loadInvoices() {
    const summary = $('invoice-summary');
    const select = $('invoice-member-select');
    if (summary) summary.textContent = showAll ? 'Loading unpaid invoices…' : 'Loading names…';
    if (select && !showAll) {
      select.disabled = true;
      select.innerHTML = '<option value="">Loading…</option>';
    }
    if (!showAll) hideResults();

    try {
      const response = await fetch(API_PATH, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      const invoices = (data.invoices || []).slice().sort((a, b) =>
        String(a.recipient || '').localeCompare(String(b.recipient || ''), undefined, {
          sensitivity: 'base'
        })
      );
      showLoadedState(invoices);
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
  $('invoice-member-select')?.addEventListener('change', (event) => {
    renderSelectedMember(event.target.value);
  });

  if (showAll) {
    const title = document.querySelector('.invoice-hero-copy h1');
    const sub = document.querySelector('.invoice-sub');
    if (title) title.textContent = 'Unpaid Invoices';
    if (sub) {
      sub.innerHTML = 'Full unpaid list. <a class="invoice-paypal-quiet" href="invoice.html">Back to name lookup</a>.';
    }
  }

  await loadInvoices();
})();
