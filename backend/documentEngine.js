/*
 * documentEngine.js — Merges form data into POA_Tagged_Template.docx.
 *
 * Uses PizZip + docxtemplater. The template uses {{ }} delimiters, paragraph
 * loops for the powers, boolean sections for optional blocks, and a linebreak-
 * aware {{special_provisions}} slot.
 *
 * This module NEVER alters legal language — all power text comes verbatim from
 * powersText.js, and Special Provisions comes from the submitted text (or the
 * firm default). It only decides which pieces are included.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const { STANDARD_POWERS, ESTATE_PLANNING_POWERS } = require('./powersText');
const { DEFAULT_SPECIAL_PROVISIONS } = require('./defaultSpecialProvisions');

const TEMPLATE_PATH            = path.join(__dirname, 'templates', 'POA_Tagged_Template.docx');
const CONTINGENT_TEMPLATE_PATH = path.join(__dirname, 'templates', 'Contingent_POA_Tagged_Template.docx');

// All simple {{placeholder}} fields, mapped from the submitted form.
const TEXT_FIELDS = [
  'principal_name', 'principal_dob', 'principal_street_address', 'principal_city',
  'principal_zip', 'principal_pronoun',
  'agent1_name', 'agent1_dob', 'agent1_street_address', 'agent1_city', 'agent1_state', 'agent1_zip',
  'agent2_name', 'agent2_dob', 'agent2_street_address', 'agent2_city', 'agent2_state', 'agent2_zip',
  'successor1_name', 'successor1_address', 'successor2_name', 'successor2_address',
  'signing_date', 'signing_city', 'signing_county',
  'witness1_name', 'witness2_name',
  'notary_name', 'notary_commission_expiration'
];

function str(v) {
  return (v === undefined || v === null) ? '' : String(v).trim();
}

/** Convert a 0-based index to a subdivision letter (0->A, 1->B, ... 25->Z). */
function seqLetter(index) {
  return String.fromCharCode(65 + index);
}

/**
 * Select the Standard Powers to include (in canonical order).
 * Rule (from spec): Power N ("All other matters", id 'all_other_matters') is
 * included ONLY if all of the other standard powers (statutory A–M) are
 * selected — otherwise it is automatically eliminated.
 * Returns full power objects; display letters are assigned later in buildData.
 */
function buildStandardPowers(selectedIds) {
  const selected = new Set(selectedIds || []);
  const aToM = STANDARD_POWERS.filter((p) => p.letter !== 'N');
  const allAtoMSelected = aToM.every((p) => selected.has(p.id));

  return STANDARD_POWERS.filter((p) => {
    if (p.letter === 'N') return selected.has(p.id) && allAtoMSelected;
    return selected.has(p.id);
  });
}

/** Select the Estate Planning Powers to include (in canonical order). */
function buildEstatePowers(selectedIds) {
  const selected = new Set(selectedIds || []);
  return ESTATE_PLANNING_POWERS.filter((p) => selected.has(p.id));
}

/**
 * Turn a submitted form object into the data object docxtemplater expects.
 * `form.standardPowers` / `form.estatePowers` are arrays of power ids.
 */
function buildData(form) {
  form = form || {};

  const data = {};
  TEXT_FIELDS.forEach((f) => { data[f] = str(form[f]); });

  const hasAgent2 = data.agent2_name !== '';
  data.has_agent2 = hasAgent2;
  // Authority word only applies when there's a co-agent; blank otherwise.
  data.agent_authority = hasAgent2 ? (str(form.agent_authority) || 'severally') : '';

  // Powers are re-lettered SEQUENTIALLY with no gaps, in one continuous run
  // across the standard powers and then the estate powers (matching the source
  // document's single A→X sequence).
  const standard = buildStandardPowers(form.standardPowers);
  const estate = buildEstatePowers(form.estatePowers);
  let seq = 0;
  data.standard_powers = standard.map((p) => ({ letter: seqLetter(seq++), text: p.text }));
  data.estate_powers = estate.map((p) => ({ letter: seqLetter(seq++), text: p.text }));
  data.has_estate_powers = estate.length > 0;

  data.has_successor1 = data.successor1_name !== '';
  data.has_successor2 = data.successor2_name !== '';

  // Whatever staff left in the text area wins; fall back to the firm default.
  const provided = form.specialProvisions;
  data.special_provisions =
    (provided !== undefined && provided !== null && String(provided).trim() !== '')
      ? String(provided)
      : DEFAULT_SPECIAL_PROVISIONS;

  return data;
}

/**
 * Build data for the Contingent POA — same as buildData() plus the
 * possessive pronoun needed in the notary acknowledgment block.
 */
function buildContingentData(form) {
  const data = buildData(form);
  const possessiveMap = { he: 'his', she: 'her', they: 'their' };
  data.principal_pronoun_possessive = possessiveMap[str(form.principal_pronoun)] || 'his/her';
  return data;
}

/**
 * Render the POA template using a given path and data-builder.
 * Shared by generatePoa and generateContingentPoa.
 */
function renderTemplate(templatePath, dataBuilder, form) {
  if (!fs.existsSync(templatePath)) {
    const err = new Error('POA template not found at expected path: ' + templatePath);
    err.code = 'TEMPLATE_MISSING';
    throw err;
  }
  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);
  let doc;
  try {
    doc = new Docxtemplater(zip, {
      delimiters: { start: '{{', end: '}}' },
      paragraphLoop: true,
      linebreaks: true
    });
    doc.render(dataBuilder(form));
  } catch (error) {
    const err = new Error('Failed to render POA document.');
    err.code = 'RENDER_FAILED';
    err.detail = summarizeTemplateError(error);
    throw err;
  }
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * Generate the completed .docx as a Buffer.
 * Throws with err.code = 'TEMPLATE_MISSING' or 'RENDER_FAILED'.
 */
function generatePoa(form) {
  return renderTemplate(TEMPLATE_PATH, buildData, form);
}

/** Generate the Contingent POA as a Buffer. */
function generateContingentPoa(form) {
  return renderTemplate(CONTINGENT_TEMPLATE_PATH, buildContingentData, form);
}

function summarizeTemplateError(error) {
  if (error && error.properties && Array.isArray(error.properties.errors)) {
    return error.properties.errors.map((e) => e.properties && e.properties.explanation).filter(Boolean);
  }
  return error && error.message ? [error.message] : ['Unknown template error'];
}

/**
 * Build the download filename: POA_[Type]_[PrincipalLastName]_[YYYY-MM-DD].docx
 * `now` is injectable for testing. `type` is 'Durable' or 'Contingent'.
 */
function buildFilename(form, now, type) {
  const name = str(form && form.principal_name);
  const parts = name.split(/\s+/).filter(Boolean);
  const last = parts.length ? parts[parts.length - 1] : 'Client';
  const safeLast = last.replace(/[^A-Za-z0-9\-]/g, '') || 'Client';
  const d = now || new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const typeLabel = type === 'Contingent' ? 'Contingent' : 'Durable';
  return `POA_${typeLabel}_${safeLast}_${yyyy}-${mm}-${dd}.docx`;
}

module.exports = {
  generatePoa,
  generateContingentPoa,
  buildData,
  buildContingentData,
  buildStandardPowers,
  buildEstatePowers,
  buildFilename,
  TEMPLATE_PATH,
  CONTINGENT_TEMPLATE_PATH,
};
