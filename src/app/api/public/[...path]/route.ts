import { NextRequest, NextResponse } from 'next/server';

// GET /api/public/<bucket>/<key>
// Proxies requests to MinIO/S3 so the public URL can be the app domain rather
// than an internal minio:9000 address. This replaces the Caddy /quotes/* proxy
// used in the docker-compose.prod.yml setup and lets Coolify deployments work
// with a single domain (no separate storage subdomain needed).
//
// S3_PUBLIC_URL should be set to `https://<app-domain>/api/public` so
// getPublicUrl() produces URLs like https://crm.example.com/api/public/quotes/file.pdf
// which this route intercepts and forwards to http://minio:9000/quotes/file.pdf.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;

  const s3Endpoint = process.env.S3_ENDPOINT;
  if (!s3Endpoint) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
  }

  // path[0] = bucket, path[1..] = object key segments
  const upstream = `${s3Endpoint.replace(/\/+$/, '')}/${path.join('/')}`;

  try {
    const res = await fetch(upstream, { cache: 'no-store' });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const headers = new Headers();
    const passthroughHeaders = [
      'content-type', 'content-length', 'content-disposition',
      'cache-control', 'etag', 'last-modified',
    ];
    for (const h of passthroughHeaders) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    // Allow browsers to cache public assets for 7 days
    if (!headers.has('cache-control')) {
      headers.set('cache-control', 'public, max-age=604800, immutable');
    }

    return new NextResponse(res.body, { status: 200, headers });
  } catch (err) {
    console.error('[api/public] upstream fetch failed', err);
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 502 });
  }
}

export const dynamic = 'force-dynamic';
