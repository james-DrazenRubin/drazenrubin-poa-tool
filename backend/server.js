/*
 * server.js — POA document assembly API for Drazen Rubin Law.
 *
 * Endpoint:  POST /api/generate-poa   { form JSON } -> .docx download
 *
 * v1: internal network use, no auth, no database. Each generation is logged
 * (timestamp + principal name only — no other client data) for firm records.
 */
'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const multer   = require('multer');
const archiver = require('archiver');
const { generatePoa, generateContingentPoa, buildFilename } = require('./documentEngine');
const str = (v) => (v === undefined || v === null) ? '' : String(v).trim();
const { generateAncillaryDocs }         = require('./ancillaryEngine');
const { parseChecklist }                = require('./checklistParser');
const pp = require('./practicePanther');

// In-memory only — checklists contain SSNs and are never persisted to disk.
const checklistUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },  // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    const err = new Error('Only PDF files are accepted.');
    err.code = 'WRONG_TYPE';
    cb(err);
  },
});

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: '512kb' }));

// CORS — allow-list origins for when the frontend is hosted separately.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: function (origin, cb) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Origin not allowed by CORS: ' + origin));
  }
}));

// Optionally serve the frontend from this backend.
if (String(process.env.SERVE_FRONTEND).toLowerCase() !== 'false') {
  const publicDir   = path.join(__dirname, 'public');
  const frontendDir = path.join(__dirname, '..', 'frontend');
  app.use(express.static(fs.existsSync(publicDir) ? publicDir : frontendDir));
}

// Required fields the form must supply before we generate.
const REQUIRED_FIELDS = [
  'principal_name', 'principal_dob', 'principal_street_address', 'principal_city',
  'principal_zip', 'principal_pronoun',
  'agent1_name', 'agent1_dob', 'agent1_street_address', 'agent1_city', 'agent1_state', 'agent1_zip',
  'signing_date', 'signing_city', 'signing_county',
  'witness1_name', 'witness2_name',
  'notary_name', 'notary_commission_expiration'
];

function validate(form) {
  const missing = REQUIRED_FIELDS.filter((f) => !form[f] || String(form[f]).trim() === '');
  // If a co-agent is named, the authority selection is required.
  if (form.agent2_name && String(form.agent2_name).trim() !== '') {
    if (!form.agent_authority || String(form.agent_authority).trim() === '') {
      missing.push('agent_authority');
    }
  }
  return missing;
}

const LOG_PATH = path.join(__dirname, 'logs', 'generation.log');
function logGeneration(form) {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    const line = `${new Date().toISOString()}\tGENERATED\t${String(form.principal_name || '(no name)').trim()}\n`;
    fs.appendFileSync(LOG_PATH, line, 'utf8');
  } catch (e) {
    // Logging must never block a generation.
    console.error('[log] could not write generation log:', e.message);
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'drazenrubin-poa-tool', time: new Date().toISOString() });
});

app.get('/api/debug-paths', (req, res) => {
  const publicDir   = path.join(__dirname, 'public');
  const frontendDir = path.join(__dirname, '..', 'frontend');
  res.json({
    __dirname,
    cwd: process.cwd(),
    publicExists:   fs.existsSync(publicDir),
    frontendExists: fs.existsSync(frontendDir),
    publicDir,
    frontendDir,
  });
});

// ── Practice Panther integration ──────────────────────────────────────────────

app.get('/api/pp-status', (req, res) => {
  res.json({ ok: true, configured: pp.isConfigured(), authorized: pp.isAuthorized() });
});

app.get('/api/pp-auth', (req, res) => {
  if (!pp.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Practice Panther credentials not configured.' });
  }
  res.redirect(pp.buildAuthUrl());
});

app.get('/api/pp-callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect('/?pp=error');
  }
  try {
    await pp.exchangeCode(String(code));
    res.redirect('/?pp=connected');
  } catch (err) {
    console.error('[pp-callback] token exchange error:', err.message);
    res.redirect('/?pp=error');
  }
});

app.get('/api/search-contact', async (req, res) => {
  if (!pp.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Practice Panther not configured.' });
  }
  const q = String(req.query.q || '').trim();
  if (q.length < 2) {
    return res.status(400).json({ ok: false, error: 'Query must be at least 2 characters.' });
  }
  try {
    const contacts = await pp.searchContacts(q);
    res.json({ ok: true, contacts });
  } catch (err) {
    if (err.code === 'PP_NOT_AUTHORIZED') {
      return res.status(401).json({ ok: false, error: 'Practice Panther not authorized. Please reconnect.' });
    }
    console.error('[search-contact] error:', err.message);
    res.status(500).json({ ok: false, error: 'Contact search unavailable.' });
  }
});

// ── Ancillary document generation ────────────────────────────────────────────

const VALID_DOC_TYPES = new Set(['conservator', 'revocation', 'disposition', 'hci']);

app.post('/api/generate-ancillary', async (req, res) => {
  const { docs, form } = req.body || {};

  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({ ok: false, error: 'No document types selected.', fields: [] });
  }

  const invalid = docs.filter((d) => !VALID_DOC_TYPES.has(d));
  if (invalid.length) {
    return res.status(400).json({ ok: false, error: `Unknown document type(s): ${invalid.join(', ')}`, fields: [] });
  }

  if (!form || !form.principal_name || !String(form.principal_name).trim()) {
    return res.status(400).json({ ok: false, error: 'Principal name is required.', fields: ['principal_name'] });
  }

  try {
    const generated = generateAncillaryDocs(form, docs);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="AncillaryDocs_${String(form.principal_name).trim().split(/\s+/).pop()}_${new Date().toISOString().slice(0,10)}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => {
      console.error('[generate-ancillary] archiver error:', err.message);
    });
    archive.pipe(res);
    generated.forEach(({ filename, buffer }) => archive.append(buffer, { name: filename }));
    await archive.finalize();
  } catch (err) {
    console.error('[generate-ancillary] error:', err.code || '', err.message, err.detail || '');
    if (err.code === 'TEMPLATE_MISSING') {
      return res.status(500).json({ ok: false, error: 'An ancillary template is missing on the server. Please contact IT.', fields: [] });
    }
    return res.status(500).json({ ok: false, error: 'Could not generate the ancillary documents. Please try again.', fields: [] });
  }
});

// ── Checklist parse ───────────────────────────────────────────────────────────

app.post('/api/parse-checklist', (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ ok: false, error: 'Checklist parsing is not configured on this server.', fields: [] });
  }

  checklistUpload.single('checklist')(req, res, async (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large. Maximum size is 20 MB.'
        : (err.message || 'File upload error.');
      return res.status(400).json({ ok: false, error: msg, fields: [] });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No PDF file uploaded.', fields: [] });
    }

    try {
      const result = await parseChecklist(req.file.buffer);
      // req.file.buffer is the only reference to the PDF; it will be GC'd after this response.
      return res.json(result);
    } catch (parseErr) {
      console.error('[parse-checklist] error:', parseErr.code || '', parseErr.message);
      if (parseErr.code === 'NO_CLIENTS') {
        return res.status(422).json({
          ok: false,
          error: 'Could not find client information in this PDF. Please check that you uploaded the correct checklist.',
          fields: [],
        });
      }
      return res.status(500).json({
        ok: false,
        error: 'Could not parse the checklist. Please fill in the form manually.',
        fields: [],
      });
    }
  });
});

app.post('/api/generate-poa', (req, res) => {
  const form = req.body || {};

  const missing = validate(form);
  if (missing.length) {
    return res.status(400).json({
      ok: false,
      error: 'Please complete all required fields before generating.',
      fields: missing
    });
  }

  try {
    const isContingent = str(form.poa_type) === 'contingent';
    const buffer   = isContingent ? generateContingentPoa(form) : generatePoa(form);
    const filename = buildFilename(form, null, isContingent ? 'Contingent' : 'Durable');
    logGeneration(form);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  } catch (err) {
    console.error('[generate-poa] error:', err.code || '', err.message, err.detail || '');
    if (err.code === 'TEMPLATE_MISSING') {
      return res.status(500).json({ ok: false, error: 'The document template is missing on the server. Please contact IT.' });
    }
    // Never expose stack traces / internal detail to the client.
    return res.status(500).json({ ok: false, error: 'We could not generate the document. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`Drazen Rubin Law POA tool backend listening on port ${PORT}`);
});

module.exports = app;
