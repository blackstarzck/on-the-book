import app from './index.js';

export default function handler(req, res) {
  const url = new URL(req.url, 'https://on-the-book.invalid');
  const route = url.searchParams.get('route');
  if (route && (route.startsWith('/api/') || route.startsWith('/uploads/'))) {
    url.searchParams.delete('route');
    req.url = route + (url.search ? url.search : '');
  }
  return app(req, res);
}
