import { Router } from 'express';
import crypto from 'crypto';

const authRouter = Router();

/** In-memory store: sessionId -> { accessToken, refreshToken?, expiry } */
const sharePointSessions = new Map();

const COOKIE_NAME = 'raqib_sp_session';
const COOKIE_OPTIONS = { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax', path: '/' };

/**
 * GET /api/auth/sharepoint
 * Query: returnUrl (optional) - where to redirect after login.
 * Redirects to corporate SSO (Azure AD / SharePoint). For demo, redirects to a stub login page.
 */
authRouter.get('/sharepoint', (req, res) => {
  const returnUrl = (req.query.returnUrl && String(req.query.returnUrl)) || '/';
  const sessionId = crypto.randomBytes(16).toString('hex');
  const state = Buffer.from(JSON.stringify({ sessionId, returnUrl })).toString('base64url');

  const authorizeUrl = process.env.SHAREPOINT_AUTHORIZE_URL;
  if (authorizeUrl) {
    const redirect = `${authorizeUrl}${authorizeUrl.includes('?') ? '&' : '?'}state=${encodeURIComponent(state)}`;
    return res.redirect(302, redirect);
  }

  // Stub: redirect to same-origin stub login page (served by client or a minimal server page)
  const stubUrl = `${req.protocol}://${req.get('host')}/api/auth/sharepoint/stub-login?state=${encodeURIComponent(state)}`;
  res.redirect(302, stubUrl);
});

/**
 * GET /api/auth/sharepoint/stub-login
 * Stub login page for development when SHAREPOINT_AUTHORIZE_URL is not set.
 * Renders a minimal HTML page that redirects to callback with a fake code.
 */
authRouter.get('/sharepoint/stub-login', (req, res) => {
  const state = req.query.state || '';
  const html = `<!DOCTYPE html>
<html><head><title>SharePoint sign-in</title></head>
<body>
  <p>Corporate SharePoint sign-in (stub).</p>
  <p>In production, this redirects to your Corp SSO (e.g. Azure AD).</p>
  <form id="f" method="get" action="/api/auth/sharepoint/callback">
    <input type="hidden" name="state" value="${state.replace(/"/g, '&quot;')}" />
    <input type="hidden" name="code" value="stub-code-${Date.now()}" />
    <button type="submit">Sign in</button>
  </form>
  <script>document.getElementById('f').submit();</script>
</body></html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * GET /api/auth/sharepoint/callback
 * Query: state (base64url JSON { sessionId, returnUrl }), code (from IdP or stub).
 * Exchanges code for token (stub: creates a fake token), stores it, sets cookie, redirects to returnUrl.
 */
authRouter.get('/sharepoint/callback', (req, res) => {
  const stateRaw = req.query.state;
  const code = req.query.code;
  let returnUrl = '/';
  let sessionId = null;
  try {
    const decoded = JSON.parse(Buffer.from(stateRaw || '', 'base64url').toString('utf8'));
    returnUrl = decoded.returnUrl || returnUrl;
    sessionId = decoded.sessionId;
  } catch {
    return res.redirect(302, returnUrl);
  }
  if (!sessionId) return res.redirect(302, returnUrl);

  // In production: exchange code for access_token via Azure AD token endpoint
  const accessToken = process.env.SHAREPOINT_ACCESS_TOKEN || `stub-token-${code}-${Date.now()}`;
  const expiry = Date.now() + 60 * 60 * 1000;
  sharePointSessions.set(sessionId, { accessToken, expiry });

  res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);
  let redirect = returnUrl.startsWith('http') ? returnUrl : `${req.protocol}://${req.get('host')}${returnUrl.startsWith('/') ? '' : '/'}${returnUrl}`;
  try {
    const u = new URL(redirect);
    u.searchParams.set('sharepoint_connected', '1');
    u.searchParams.set('session', sessionId);
    redirect = u.origin + u.pathname + (u.search || '') + (u.hash || '');
  } catch {
    const sep = redirect.includes('?') ? '&' : '?';
    redirect += `${sep}sharepoint_connected=1&session=${encodeURIComponent(sessionId)}`;
  }
  res.redirect(302, redirect);
});

/**
 * GET /api/auth/sharepoint/status
 * Returns { connected: boolean }. Uses cookie to look up session.
 */
authRouter.get('/sharepoint/status', (req, res) => {
  const sessionId = req.cookies?.[COOKIE_NAME] || req.get('X-Raqib-Session');
  if (!sessionId) return res.json({ connected: false });
  const session = sharePointSessions.get(sessionId);
  if (!session || (session.expiry && session.expiry < Date.now())) {
    sharePointSessions.delete(sessionId);
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return res.json({ connected: false });
  }
  res.json({ connected: true });
});

/**
 * POST /api/auth/sharepoint/disconnect
 * Clears the SharePoint session and cookie.
 */
authRouter.post('/sharepoint/disconnect', (req, res) => {
  const sessionId = req.cookies?.[COOKIE_NAME] || req.get('X-Raqib-Session');
  if (sessionId) sharePointSessions.delete(sessionId);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ disconnected: true });
});

export function getSharePointSession(req) {
  const sessionId = req.cookies?.[COOKIE_NAME] || req.get('X-Raqib-Session');
  if (!sessionId) return null;
  const session = sharePointSessions.get(sessionId);
  if (!session || (session.expiry && session.expiry < Date.now())) {
    if (sessionId) sharePointSessions.delete(sessionId);
    return null;
  }
  return session;
}

export { authRouter };
