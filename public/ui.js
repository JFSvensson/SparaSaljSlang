(function () {
  'use strict';

  function setStatus(element, msg, type) {
    if (!element) return;
    element.textContent = msg;
    element.className = 'status-msg' + (type ? ' ' + type : '');
  }

  window.__ui = {
    setStatus,
  };
})();
