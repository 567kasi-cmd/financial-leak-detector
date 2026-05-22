const STATIC_ASSET_PATTERN = /\.(?:css|js|mjs|map|png|jpg|jpeg|gif|svg|ico|webp|avif|txt|xml|json|woff2?|ttf|eot)$/i;

function isDocumentRequest(request) {
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

async function fetchAsset(context, pathname) {
  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = pathname;
  return context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request));
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Static assets should never fall through into route handling.
  if (STATIC_ASSET_PATTERN.test(pathname) || pathname.startsWith('/assets/')) {
    return fetchAsset(context, pathname);
  }

  const directResponse = await fetchAsset(context, pathname);
  if (directResponse.ok) {
    return directResponse;
  }

  if (isDocumentRequest(request)) {
    const normalizedPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
    const routeResponse = await fetchAsset(context, `${normalizedPath}index.html`);
    if (routeResponse.ok) {
      return routeResponse;
    }

    const spaFallback = await fetchAsset(context, '/index.html');
    if (spaFallback.ok) {
      return spaFallback;
    }
  }

  return directResponse;
}
