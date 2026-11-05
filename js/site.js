/* Small, progressive enhancements. Forms and navigation work without JavaScript. */
(() => {
  const menuButton = document.querySelector('[data-menu-toggle]');
  menuButton?.addEventListener('click', () => {
    const menu = document.getElementById(menuButton.getAttribute('aria-controls'));
    menu.hidden = !menu.hidden;
    menuButton.setAttribute('aria-expanded', String(!menu.hidden));
    menuButton.setAttribute('aria-label', menu.hidden ? 'Open menu' : 'Close menu');
  });
  document.querySelectorAll('[data-auto-submit]').forEach(select => select.addEventListener('change', () => select.form.requestSubmit()));

  function toast(message) {
    const box = document.querySelector('.toast');
    box.textContent = message;
    box.hidden = false;
    window.setTimeout(() => {
      box.hidden = true;
    }, 3500);
  }
  document.querySelectorAll('[data-share]').forEach(button => button.addEventListener('click', async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({
        title: document.title,
        url
      });
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast('Link copied to clipboard');
      } else {
        window.prompt('Copy this link to share', url);
      }
    } catch (error) {
      if (error.name !== 'AbortError') window.prompt('Copy this link to share', url);
    }
  }));
  document.querySelectorAll('[data-category-group]').forEach(group => {
    const cards = [...group.querySelectorAll('[data-business-card]')];
    const totalPages = Math.ceil(cards.length / 3);
    let current = 0;
    const previous = group.querySelector('[data-category-prev]');
    const next = group.querySelector('[data-category-next]');
    const page = group.querySelector('[data-category-page]');
    const pages = group.querySelector('[data-category-pages]');
    const range = group.querySelector('[data-category-range]');
    if (pages) pages.textContent = totalPages;

    function update() {
      cards.forEach((card, i) => {
        card.hidden = i < current * 3 || i >= current * 3 + 3;
      });
      if (page) page.textContent = current + 1;
      if (previous) previous.disabled = current === 0;
      if (next) next.disabled = current + 1 >= totalPages;
      if (range) range.textContent = totalPages > 1 ? `Showing ${current * 3 + 1}–${Math.min(current * 3 + 3, cards.length)} of ${cards.length}` : '';
    }
    previous?.addEventListener('click', () => {
      current = Math.max(0, current - 1);
      update();
    });
    next?.addEventListener('click', () => {
      current = Math.min(totalPages - 1, current + 1);
      update();
    });
    update();
  });
  document.querySelectorAll('.favorite-form').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: {
          'Accept': 'application/json'
        },
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('Save failed');
      const result = await response.json();
      button.classList.toggle('saved', result.favorite);
      button.setAttribute('aria-pressed', String(result.favorite));
      toast(result.favorite ? 'Saved to My Faves' : 'Removed from My Faves');
    } catch {
      toast('Unable to save. Please try again.');
    } finally {
      button.disabled = false;
    }
  }));
})();
document.querySelectorAll('.file-drop input[type=file]').forEach(input => input.addEventListener('change', () => {
  input.closest('.file-drop').querySelector('[data-file-label]').textContent = input.files[0]?.name || 'Click to upload an image';
}));
