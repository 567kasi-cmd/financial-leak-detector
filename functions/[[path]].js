export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  // Never let static assets fall through into app routing.
  if (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/js/') ||
    /\.(css|js|mjs|map|png|jpg|jpeg|gif|svg|ico|webp|txt|xml|json)$/i.test(pathname)
  ) {
    return context.next();
  }

  // Static HTML pages and routes are served by the published files themselves.
  return context.next();
}
