/* Private-preview compatibility only.
 * The host's preview frame uses Referrer-Policy: no-referrer. Native POSTs from
 * that frame send Origin:null, which Django correctly rejects. A same-origin
 * fetch sends the real Origin and retains the normal session + CSRF controls.
 * Production templates do not load this file.
 */
(() => {
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || (form.getAttribute('method') || 'get').toLowerCase() !== 'post') return;
    if (form.hasAttribute('data-native-submit') || form.getAttribute('target') && form.getAttribute('target') !== '_self') return;
    // Favorites already use the dedicated, JSON-returning enhancement.
    if (form.classList.contains('favorite-form')) return;
    const action = new URL(form.getAttribute('action') || location.href, location.href);
    if (action.origin !== location.origin) return;
    event.preventDefault();
    if (form.dataset.submitting === 'true') return;
    form.dataset.submitting = 'true';
    const submitter = event.submitter;
    const body = new FormData(form);
    if (submitter?.name) body.append(submitter.name, submitter.value);
    const controls = [...form.querySelectorAll('button[type=submit], button:not([type]), input[type=submit]')];
    const disabledBefore = controls.map(control => control.disabled);
    controls.forEach(control => {
      control.disabled = true;
    });
    form.setAttribute('aria-busy', 'true');
    const oldNotice = form.querySelector('[data-preview-error]');
    oldNotice?.remove();
    try {
      const response = await fetch(action.href, {
        method: 'POST',
        body,
        mode: 'same-origin',
        credentials: 'same-origin',
        redirect: 'follow',
        headers: {
          'Accept': 'text/html, application/json',
          'X-Preview-Form': '1'
        }
      });
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        const result = await response.json();
        if (result.external_redirect) {
          const destination = new URL(result.external_redirect);
          // Only the configured Google OAuth first hop may leave this preview.
          if (destination.protocol !== 'https:' || destination.hostname !== 'accounts.google.com') throw new Error('Unexpected sign-in destination.');
          location.assign(destination.href);
          return;
        }
        throw new Error('The server returned an unexpected response.');
      }
      if (!contentType.includes('text/html')) throw new Error('The server returned an unexpected response.');
      const destination = new URL(response.url);
      if (destination.origin !== location.origin) throw new Error('Unexpected response destination.');
      const html = await response.text();
      // Replace with the actual server response, not a fabricated success state.
      // Parsing it as a new document also re-runs its deferred interaction scripts.
      if (destination.href !== location.href) history.pushState({
        previewForm: true
      }, '', destination.href);
      document.open();
      document.write(html);
      document.close();
      window.scrollTo(0, 0);
    } catch (error) {
      const notice = document.createElement('p');
      notice.dataset.previewError = 'true';
      notice.className = 'form-errors';
      notice.setAttribute('role', 'alert');
      notice.textContent = 'We could not display the result. Check your account before trying again; your submission may have been received.';
      form.prepend(notice);
      form.dataset.submitting = 'false';
      form.removeAttribute('aria-busy');
      controls.forEach((control, index) => {
        control.disabled = disabledBefore[index];
      });
    }
  });
  window.addEventListener('popstate', () => location.reload());
})();
