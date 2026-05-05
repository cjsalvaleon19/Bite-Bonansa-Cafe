import { createClient } from '@supabase/supabase-js';

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  if (!serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Proxies a GCash payment proof image from Supabase Storage using the service
 * role key so the image loads correctly regardless of bucket visibility settings.
 *
 * GET /api/payment-proof?path=<file-path-within-payment-proofs-bucket>
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { path: filePath } = req.query;
  if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
    return res.status(400).json({ error: 'Missing or invalid path parameter' });
  }

  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Service unavailable' });
  }

  const { data, error } = await supabaseAdmin.storage
    .from('payment-proofs')
    .download(filePath.trim());

  if (error || !data) {
    console.error('[payment-proof] Download error:', error?.message);
    return res.status(404).json({ error: 'Proof not found or access denied' });
  }

  // Determine content type from file extension
  const ext = filePath.split('.').pop()?.toLowerCase();
  const contentTypeMap = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  const contentType = contentTypeMap[ext] || 'image/jpeg';

  const buffer = Buffer.from(await data.arrayBuffer());
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', buffer.length);
  return res.status(200).send(buffer);
}
