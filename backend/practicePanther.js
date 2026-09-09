/*
 * practicePanther.js — Practice Panther OAuth + contact search.
 *
 * Handles the full OAuth 2.0 authorization-code flow, stores tokens in
 * .pp-tokens.json (never committed), auto-refreshes before expiry, and
 * exposes a searchContacts() helper used by the /api/search-contact route.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const PP_BASE   = 'https://app.practicepanther.com';
const TOKEN_FILE = path.join(__dirname, '.pp-tokens.json');

// ── Token storage ─────────────────────────────────────────────────────────────

function loadTokens() {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); }
  catch { return null; }
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf8');
}

// ── OAuth flow ────────────────────────────────────────────────────────────────

function buildAuthUrl() {
  const params = new URLSearchParams({
    client_id:     process.env.PP_CLIENT_ID,
    redirect_uri:  process.env.PP_REDIRECT_URI,
    response_type: 'code',
  });
  return `${PP_BASE}/OAuth/Authorize?${params}`;
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    client_id:     process.env.PP_CLIENT_ID,
    client_secret: process.env.PP_CLIENT_SECRET,
    redirect_uri:  process.env.PP_REDIRECT_URI,
    code,
  });
  const res = await fetch(`${PP_BASE}/OAuth/Token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PP token exchange failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  const tokens = {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    Date.now() + (data.expires_in || 86400) * 1000,
  };
  saveTokens(tokens);
  return tokens;
}

async function refreshAccessToken(tokens) {
  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     process.env.PP_CLIENT_ID,
    client_secret: process.env.PP_CLIENT_SECRET,
    refresh_token: tokens.refresh_token,
  });
  const res = await fetch(`${PP_BASE}/OAuth/Token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PP token refresh failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  const newTokens = {
    access_token:  data.access_token,
    refresh_token: data.refresh_token || tokens.refresh_token,
    expires_at:    Date.now() + (data.expires_in || 86400) * 1000,
  };
  saveTokens(newTokens);
  return newTokens;
}

async function getAccessToken() {
  let tokens = loadTokens();
  if (!tokens) {
    const err = new Error('Practice Panther not authorized.');
    err.code = 'PP_NOT_AUTHORIZED';
    throw err;
  }
  // Refresh if expiring within 5 minutes
  if (tokens.expires_at - Date.now() < 5 * 60 * 1000) {
    tokens = await refreshAccessToken(tokens);
  }
  return tokens.access_token;
}

// ── Contact search ────────────────────────────────────────────────────────────
// PP's API doesn't support server-side filtering by contact name, so we fetch
// all accounts once, cache them for 30 minutes, and filter locally.

let _cache = null;
const CACHE_TTL = 30 * 60 * 1000;

async function getAllAccounts() {
  if (_cache && (Date.now() - _cache.fetchedAt) < CACHE_TTL) return _cache.data;
  const token  = await getAccessToken();
  const PAGE   = 500;
  let all      = [];
  let skip     = 0;
  let page;
  do {
    const res = await fetch(`${PP_BASE}/api/account?$top=${PAGE}&$skip=${skip}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PP accounts fetch failed: ${res.status} ${text}`);
    }
    const raw = await res.json();
    page = Array.isArray(raw) ? raw : (raw.value || raw.data || []);
    all  = all.concat(page);
    skip += PAGE;
  } while (page.length === PAGE);
  _cache = { data: all, fetchedAt: Date.now() };
  return all;
}

async function searchContacts(q) {
  const accounts = await getAllAccounts();
  const lower = q.toLowerCase();
  return accounts
    .filter((a) => {
      const name = (a.primaryContact && a.primaryContact.displayName) || a.nameAndNumber || '';
      return name.toLowerCase().includes(lower);
    })
    .slice(0, 10)
    .map(mapAccount);
}

function mapAccount(a) {
  const c    = a.primaryContact || {};
  const addr = a.billingAddress  || {};
  return {
    id:           a.guid || String(a.id || ''),
    display_name: c.displayName || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
    street:       addr.address1   || '',
    city:         addr.city       || '',
    state:        addr.state      || '',
    zip:          addr.postalCode || '',
    dob:          '',
  };
}

// ── Status helpers ────────────────────────────────────────────────────────────

function isConfigured() {
  return !!(process.env.PP_CLIENT_ID && process.env.PP_CLIENT_SECRET && process.env.PP_REDIRECT_URI);
}

function isAuthorized() {
  return !!loadTokens();
}

module.exports = { buildAuthUrl, exchangeCode, searchContacts, isConfigured, isAuthorized };
