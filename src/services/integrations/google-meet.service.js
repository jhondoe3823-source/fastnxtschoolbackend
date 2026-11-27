/**
 * Google Meet REST API v2 client (spaces + conference records + participants).
 * https://developers.google.com/workspace/meet/api/guides/overview
 */

const logger = require('../../utils/logger');
const { badRequest } = require('../../utils/errors');

const MEET_BASE = 'https://meet.googleapis.com/v2';

async function meetFetch(accessToken, path, { method = 'GET', body, retries = 2 } = {}) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    const res = await fetch(`${MEET_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429 && attempt <= retries) {
      const wait = Number(res.headers.get('retry-after') || 2) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const message =
        json?.error?.message ||
        json?.error_description ||
        `Google Meet API error (${res.status})`;
      logger.warn(`Meet API ${method} ${path} failed: ${message}`);
      const err = badRequest(message);
      err.status = res.status;
      err.google = json;
      throw err;
    }
    return json;
  }
}

/** Create a Meet conference space and return meeting URI. */
async function createSpace(accessToken, { title } = {}) {
  const space = await meetFetch(accessToken, '/spaces', {
    method: 'POST',
    body: {
      config: {
        accessType: 'OPEN',
        entryPointAccess: 'ALL',
      },
      ...(title ? { meetingCode: undefined } : {}),
    },
  });
  return {
    meetingSpaceName: space.name || null,
    meetingUrl: space.meetingUri || null,
    meetingCode: space.meetingCode || null,
    raw: space,
  };
}

async function getSpace(accessToken, spaceName) {
  const name = String(spaceName || '').replace(/^spaces\//, '');
  return meetFetch(accessToken, `/spaces/${encodeURIComponent(name)}`);
}

async function listConferenceRecords(accessToken, spaceName) {
  const filter = `space.name = "${spaceName}"`;
  const params = new URLSearchParams({ filter, pageSize: '50' });
  const json = await meetFetch(accessToken, `/conferenceRecords?${params.toString()}`);
  return Array.isArray(json.conferenceRecords) ? json.conferenceRecords : [];
}

async function listParticipants(accessToken, conferenceRecordName) {
  const parent = conferenceRecordName.startsWith('conferenceRecords/')
    ? conferenceRecordName
    : `conferenceRecords/${conferenceRecordName}`;
  const out = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({ pageSize: '250' });
    if (pageToken) params.set('pageToken', pageToken);
    const json = await meetFetch(
      accessToken,
      `/${parent}/participants?${params.toString()}`
    );
    out.push(...(json.participants || []));
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return out;
}

async function listParticipantSessions(accessToken, participantName) {
  const parent = participantName;
  const params = new URLSearchParams({ pageSize: '100' });
  const json = await meetFetch(
    accessToken,
    `/${parent}/participantSessions?${params.toString()}`
  );
  return Array.isArray(json.participantSessions) ? json.participantSessions : [];
}

module.exports = {
  createSpace,
  getSpace,
  listConferenceRecords,
  listParticipants,
  listParticipantSessions,
};
