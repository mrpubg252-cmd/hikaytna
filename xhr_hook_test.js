const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url) {
  if (typeof url === 'string' && (url.includes('.m3u8') || url.includes('.mp4') || url.includes('.ts'))) {
    if (!url.includes('/api/v1/stream-proxy/')) {
       // Convert to proxy
       // Need a way to encrypt or just pass as base64 and handle it on server
    }
  }
  return originalOpen.apply(this, arguments);
};
