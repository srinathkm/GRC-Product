/**
 * Fetch file content from a URL using optional SharePoint (Microsoft Graph) auth.
 * Used when Application mode provides SharePoint/OneDrive links and user has connected Corporate SharePoint.
 */

/**
 * Check if URL looks like SharePoint / OneDrive.
 */
export function isSharePointUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim().toLowerCase();
  return u.includes('sharepoint.com') || u.includes('sharepoint.') || u.includes('onedrive.') || u.includes('live.com');
}

/**
 * Fetch file content from a SharePoint sharing URL using Microsoft Graph.
 * POST https://graph.microsoft.com/v1.0/shares/{encodedShareUrl}/driveItem/content
 * encodedShareUrl = base64("u!" + rest of sharing URL in a specific format).
 * See https://learn.microsoft.com/en-us/graph/api/shares-get
 */
async function fetchViaGraph(sharingUrl, accessToken) {
  const shareUrl = sharingUrl.trim();
  const base64url = Buffer.from(shareUrl, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const encodedShareUrl = `u!${base64url}`;
  const graphUrl = `https://graph.microsoft.com/v1.0/shares/${encodedShareUrl}/driveItem/content`;
  const res = await fetch(graphUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.arrayBuffer();
}

/**
 * Fetch file content from a URL.
 * - If url is SharePoint-like and accessToken is provided, uses Microsoft Graph.
 * - Otherwise uses plain fetch (for public links or Google Drive; may fail for protected resources).
 */
export async function fetchFileContentFromUrl(url, accessToken = null) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (isSharePointUrl(trimmed) && accessToken) {
    try {
      const buffer = await fetchViaGraph(trimmed, accessToken);
      return buffer ? Buffer.from(buffer) : null;
    } catch (e) {
      console.warn('SharePoint fetch failed:', e.message);
      return null;
    }
  }

  try {
    const res = await fetch(trimmed, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer);
  } catch (e) {
    console.warn('URL fetch failed:', e.message);
    return null;
  }
}
