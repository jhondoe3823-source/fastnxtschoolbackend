/**
 * Google OAuth 2.0 for Meet REST API (user credentials only).
 */

const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/database');
const env = require('../../config/env');
const { badRequest, notFound, forbidden } = require('../../utils/errors');
const { encryptSecret, decryptSecret } = require('../../utils/token-crypto');
const logger = require('../../utils/logger');

const MEET_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space.readonly',
].join(' ');

function googleConfigured() {
  return Boolean(env.google.clientId && env.google.clientSecret && env.google.redirectUri);
}

function assertGoogleConfigured() {
  if (!googleConfigured()) {
    throw badRequest(
      'Google Meet is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI.'
    );
  }
}

function signOAuthState(payload) {
  return jwt.sign(
    { ...payload, purpose: 'google_oauth' },
    env.jwt.secret,
    { expiresIn: '15m' }
  );
}

function verifyOAuthState(state) {
  try {
    const decoded = jwt.verify(String(state || ''), env.jwt.secret);
    if (decoded.purpose !== 'google_oauth') throw new Error('bad purpose');
    return decoded;
  } catch {
    throw badRequest('Invalid or expired Google OAuth state.');
  }
}

function buildAuthUrl({ schoolId, userId, returnTo }) {
  assertGoogleConfigured();
  const state = signOAuthState({ schoolId, userId, returnTo: returnTo || '/online-classes/settings' });
  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: env.google.redirectUri,
    response_type: 'code',
    scope: MEET_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCode(code) {
  assertGoogleConfigured();
  const body = new URLSearchParams({
    code: String(code || ''),
    client_id: env.google.clientId,
    client_secret: env.google.clientSecret,
    redirect_uri: env.google.redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.warn(`Google token exchange failed: ${json.error || res.status}`);
    throw badRequest(json.error_description || 'Google authorization failed.');
  }
  return json;
}

async function fetchGoogleProfile(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw badRequest('Could not load Google account profile.');
  }
  return json;
}

async function upsertIntegration({ schoolId, userId, tokenPayload, profile }) {
  const accessToken = tokenPayload.access_token;
  const refreshToken = tokenPayload.refresh_token;
  if (!accessToken) throw badRequest('Google did not return an access token.');

  const existing = await prisma.googleIntegration.findUnique({
    where: { schoolId_userId: { schoolId, userId } },
  });

  const expiry = tokenPayload.expires_in
    ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000)
    : null;

  const data = {
    googleEmail: profile.email || existing?.googleEmail || '',
    googleAccountId: profile.sub || existing?.googleAccountId || null,
    encryptedAccessToken: encryptSecret(accessToken),
    tokenExpiry: expiry,
    scopes: tokenPayload.scope || MEET_SCOPES,
    connectionStatus: 'Connected',
    lastError: null,
  };

  if (refreshToken) {
    data.encryptedRefreshToken = encryptSecret(refreshToken);
  } else if (!existing?.encryptedRefreshToken) {
    throw badRequest('Google did not return a refresh token. Reconnect with consent prompt.');
  }

  if (existing) {
    return prisma.googleIntegration.update({ where: { id: existing.id }, data });
  }

  return prisma.googleIntegration.create({
    data: {
      schoolId,
      userId,
      encryptedRefreshToken: data.encryptedRefreshToken,
      ...data,
    },
  });
}

async function handleCallback({ code, state }) {
  const decoded = verifyOAuthState(state);
  const tokenPayload = await exchangeCode(code);
  const profile = await fetchGoogleProfile(tokenPayload.access_token);
  const integration = await upsertIntegration({
    schoolId: decoded.schoolId,
    userId: decoded.userId,
    tokenPayload,
    profile,
  });
  return {
    integration: serializeIntegration(integration),
    returnTo: decoded.returnTo || '/online-classes/settings',
  };
}

function serializeIntegration(row) {
  if (!row) return null;
  return {
    id: row.id,
    schoolId: row.schoolId,
    userId: row.userId,
    googleEmail: row.googleEmail,
    connectionStatus: row.connectionStatus,
    tokenExpiry: row.tokenExpiry ? row.tokenExpiry.toISOString() : null,
    scopes: row.scopes,
    lastError: row.lastError || null,
    connected: row.connectionStatus === 'Connected',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getIntegration(schoolId, userId) {
  const row = await prisma.googleIntegration.findUnique({
    where: { schoolId_userId: { schoolId, userId } },
  });
  return serializeIntegration(row);
}

async function disconnect(schoolId, userId) {
  const existing = await prisma.googleIntegration.findUnique({
    where: { schoolId_userId: { schoolId, userId } },
  });
  if (!existing) throw notFound('Google account is not connected.');
  await prisma.googleIntegration.delete({ where: { id: existing.id } });
  return { disconnected: true };
}

async function refreshAccessToken(integration) {
  assertGoogleConfigured();
  let refreshToken;
  try {
    refreshToken = decryptSecret(integration.encryptedRefreshToken);
  } catch {
    await prisma.googleIntegration.update({
      where: { id: integration.id },
      data: { connectionStatus: 'Error', lastError: 'Stored refresh token is corrupt.' },
    });
    throw badRequest('Google refresh token is invalid. Reconnect your Google account.');
  }

  const body = new URLSearchParams({
    client_id: env.google.clientId,
    client_secret: env.google.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const status = json.error === 'invalid_grant' ? 'Revoked' : 'Expired';
    await prisma.googleIntegration.update({
      where: { id: integration.id },
      data: {
        connectionStatus: status,
        lastError: json.error_description || json.error || 'Token refresh failed',
      },
    });
    throw badRequest('Google access expired or was revoked. Reconnect your Google account.');
  }

  const expiry = json.expires_in
    ? new Date(Date.now() + Number(json.expires_in) * 1000)
    : null;
  const updated = await prisma.googleIntegration.update({
    where: { id: integration.id },
    data: {
      encryptedAccessToken: encryptSecret(json.access_token),
      tokenExpiry: expiry,
      connectionStatus: 'Connected',
      lastError: null,
      ...(json.refresh_token ? { encryptedRefreshToken: encryptSecret(json.refresh_token) } : {}),
    },
  });
  return updated;
}

async function getValidAccessToken(schoolId, userId) {
  const integration = await prisma.googleIntegration.findUnique({
    where: { schoolId_userId: { schoolId, userId } },
  });
  if (!integration) {
    throw badRequest('Connect a Google account before creating Google Meet classes.');
  }
  if (integration.connectionStatus === 'Revoked') {
    throw badRequest('Google account access was revoked. Reconnect it in Online Classes settings.');
  }

  const skewMs = 60_000;
  const expired =
    !integration.tokenExpiry ||
    integration.tokenExpiry.getTime() <= Date.now() + skewMs;

  const current = expired ? await refreshAccessToken(integration) : integration;
  try {
    return {
      accessToken: decryptSecret(current.encryptedAccessToken),
      integration: current,
    };
  } catch {
    throw badRequest('Could not decrypt Google access token. Reconnect Google.');
  }
}

async function requireOwnerOrAdmin(auth, ownerUserId) {
  const role = String(auth.role || '').toLowerCase();
  const isAdmin =
    auth.panel === 'admin' &&
    (role.includes('admin') || role.includes('owner') || role.includes('principal'));
  if (auth.userId === ownerUserId || isAdmin) return;
  throw forbidden('You do not have access to this Google integration.');
}

module.exports = {
  googleConfigured,
  buildAuthUrl,
  handleCallback,
  getIntegration,
  disconnect,
  getValidAccessToken,
  serializeIntegration,
  requireOwnerOrAdmin,
  MEET_SCOPES,
};
