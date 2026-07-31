(function () {
  'use strict';

  function createModal(modalElement, closeButton, backdrop) {
    if (!modalElement) return null;

    function open() {
      modalElement.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function close() {
      modalElement.classList.add('hidden');
      document.body.style.overflow = '';
    }

    if (closeButton) {
      closeButton.addEventListener('click', close);
    }

    if (backdrop) {
      backdrop.addEventListener('click', close);
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        close();
      }
    });

    return { open, close };
  }

  window.__components = {
    createModal,
  };
})();
