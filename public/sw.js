// =============================================================================
// Service Worker - 評価制度システム PWA基盤
// キャッシュ戦略: Network First (常に最新データ優先)
// =============================================================================

const CACHE_NAME = 'hyoka-v1';

// プリキャッシュ対象 (シェルのみ)
const PRECACHE_URLS = [
  '/dashboard',
  '/offline',
];

// インストール: プリキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// アクティベート: 古いキャッシュ削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// フェッチ: Network First → キャッシュフォールバック
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // http/https以外のスキーム(chrome-extension://等)はスキップ
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // クロスオリジンリクエストはスキップ（CSPエラー防止）
  if (url.origin !== self.location.origin) {
    return;
  }

  // API・認証・Service Worker自身はキャッシュしない
  if (
    event.request.method !== 'GET' ||
    url.pathname.includes('/api/') ||
    url.pathname.includes('/auth/') ||
    url.pathname.endsWith('/sw.js')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 成功レスポンスをキャッシュに保存
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('/offline'))
      )
  );
});
