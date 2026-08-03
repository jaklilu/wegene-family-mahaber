(function () {
  function setupMenu(toggleId, menuId) {
    const toggle = document.getElementById(toggleId);
    const menu = document.getElementById(menuId);
    if (!toggle || !menu) return;

    const close = () => {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    };

    const open = () => {
      menu.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
    };

    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      if (menu.classList.contains('is-open')) close();
      else open();
    });

    menu.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    menu.querySelectorAll('a, button').forEach((item) => {
      item.addEventListener('click', () => {
        if (window.matchMedia('(max-width: 760px)').matches) close();
      });
    });

    document.addEventListener('click', () => {
      if (menu.classList.contains('is-open')) close();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });

    window.addEventListener('resize', () => {
      if (!window.matchMedia('(max-width: 760px)').matches) close();
    });
  }

  window.WegeneMenu = { setupMenu };
}());
