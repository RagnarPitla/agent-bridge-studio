/* Boots the app after core + feature modules have registered. Reads ?tab=<id>
 * so a popped-out window opens directly on its tab. */
(() => {
  'use strict';
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') || undefined;
  if (params.get('detached') === '1') document.body.classList.add('detached');
  const start = () => window.ABS.init({ tab }).catch((e) => console.error('init failed', e));
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
