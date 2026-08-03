async function bootAdmin() {
  if (!window.WegeneAuth) throw new Error('WegeneAuth failed to load');
  await window.WegeneAuth.requireGate({
    mode: 'admin',
    loginScreenId: 'admin-login-screen',
    appShellId: 'admin-shell',
    passwordInputId: 'admin-password',
    loginButtonId: 'admin-login-button',
    errorId: 'admin-login-error',
    unlockName: 'unlockWegeneAdmin'
  });

  const logout = document.getElementById('admin-logout-button');
  if (logout) {
    logout.addEventListener('click', () => {
      window.WegeneAuth.clearSession('admin');
      location.reload();
    });
  }
}

bootAdmin().catch(err => {
  console.error(err);
  document.body.insertAdjacentHTML('afterbegin', '<main class="card"><h1>Could not load admin gate</h1><p>Check local prototype scripts.</p></main>');
});
