(function () {
  'use strict';

  function createApiClient(basePath = '/api') {
    async function request(path, options = {}) {
      const response = await fetch(`${basePath}${path}`, options);
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json() : await response.text();

      if (!response.ok) {
        const message = typeof payload === 'string' ? payload : payload.error || 'Request failed';
        throw new Error(message);
      }

      return payload;
    }

    return {
      get(path) {
        return request(path);
      },
      post(path, body, headers = {}) {
        return request(path, {
          method: 'POST',
          headers: { ...(headers || {}), ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
          body: body instanceof FormData ? body : JSON.stringify(body),
        });
      },
      delete(path) {
        return request(path, { method: 'DELETE' });
      },
    };
  }

  window.__appApi = createApiClient();
})();
