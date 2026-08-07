window.WEGENE_CONFIG = {
  // MVP client-side gates for local preview only.
  // Temporary local preview member password: Wegene2026!
  // Temporary local preview admin password: AdminDemo2026!
  // For production, replace these with Netlify/server-side access control or real auth.
  memberPassword: 'Wegene2026!',
  adminPassword: 'AdminDemo2026!',
  memberSessionStorageKey: 'wegene-member-session-v1',
  adminSessionStorageKey: 'wegene-admin-session-v1',
  trackerApiPath: '/api/tracker-data',
  paypalInvoicesApiPath: '/api/paypal-invoices',
  // Always include these names in Check Invoice even if currently paid up.
  invoiceExtraNames: ['Samson Zegeye', 'Mimi Mendaye', 'Alem Desta']
};
