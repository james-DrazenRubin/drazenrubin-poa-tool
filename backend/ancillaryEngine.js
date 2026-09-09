/*
 * ancillaryEngine.js — Generate ancillary estate-planning documents.
 *
 * Mirrors the buildData() / generatePoa() pattern in documentEngine.js.
 * Does NOT touch the POA generation path.
 *
 * Supported doc types: 'conservator' | 'revocation' | 'disposition' | 'hci'
 * All use the same {{ }} delimiters + paragraphLoop as the POA template.
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const PizZip        = require('pizzip');
const Docxtemplater = require('docxtemplater');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates', 'ancillary');

const TEMPLATES = {
  conservator: 'Designation_of_Conservator_Tagged.docx',
  revocation:  'Revocation_of_POA_Tagged.docx',
  disposition: 'Disposition_of_Remains_Tagged.docx',
  hci:         'Health_Care_Instructions_Tagged.docx',
  hci_custom:  'Health_Care_Instructions_Custom_Tagged.docx',
};

function str(v) {
  return (v === undefined || v === null) ? '' : String(v).trim();
}

// ── Per-doc data builders ─────────────────────────────────────────────────────

function buildConservatorData(form) {
  const conservators = [];
  for (let i = 1; i <= 3; i++) {
    const name = str(form[`conservator${i}_name`]);
    const dob  = str(form[`conservator${i}_dob`]);
    if (name) conservators.push({ name, dob });
  }

  return {
    client_name:                 str(form.principal_name),
    client_city:                 str(form.principal_city),
    signing_date:                str(form.signing_date),
    signing_county:              str(form.signing_county),
    witness1_name:               str(form.witness1_name),
    witness2_name:               str(form.witness2_name),
    notary_name:                 str(form.notary_name),
    notary_commission_expiration: str(form.notary_commission_expiration),
    conservators,
  };
}

function buildRevocationData(form) {
  const pronounMap = { he: 'he', she: 'she', they: 'they' };
  const pronoun = pronounMap[str(form.principal_pronoun)] || 'he/she';

  return {
    client_name:                  str(form.principal_name),
    client_city:                  str(form.principal_city),
    prior_poa_date:               str(form.prior_poa_date),
    prior_agent_name:             str(form.prior_agent_name),
    pronoun,
    signing_date:                 str(form.signing_date),
    signing_city:                 str(form.signing_city),
    signing_county:               str(form.signing_county),
    witness1_name:                str(form.witness1_name),
    notary_name:                  str(form.notary_name),
    notary_commission_expiration: str(form.notary_commission_expiration),
  };
}

function buildDispositionData(form) {
  const agent2 = str(form.disposition_agent2_name);
  return {
    client_name:                    str(form.principal_name),
    client_town:                    str(form.principal_city),
    disposition_directions:         str(form.disposition_directions),
    disposition_agent1_name:        str(form.disposition_agent1_name),
    disposition_agent1_address_phone: str(form.disposition_agent1_address_phone),
    has_disposition_agent2:         !!agent2,
    disposition_agent2_name:        agent2,
    disposition_agent2_address_phone: str(form.disposition_agent2_address_phone),
    signing_date:                   str(form.signing_date),
    witness1_name:                  str(form.witness1_name),
    witness2_name:                  str(form.witness2_name),
  };
}

function buildHciData(form) {
  // Build alternates array
  const alt_hcas = [];
  for (let i = 1; i <= 4; i++) {
    const name = str(form[`alt_hca_${i}_name`]);
    const dob  = str(form[`alt_hca_${i}_dob`]);
    if (name) alt_hcas.push({ name, dob });
  }

  const numAlts         = alt_hcas.length;
  const has_single_alt  = numAlts === 1;
  const has_multiple_alts = numAlts >= 2;

  // Home care / comfort statement
  const homeCare = form.hci_home_care_preference !== false && form.hci_home_care_preference !== 'false';
  const comfort_statement = homeCare
    ? 'I do not intend any direct taking of my life, but only that my dying not be unreasonably prolonged. If possible, I would prefer to receive home care services instead of relocating to a designated care facility. I value quality of life over quantity.'
    : 'I do not intend any direct taking of my life, but only that my dying not be unreasonably prolonged.';

  // Organ donation
  const donate_specific = str(form.hci_donate) === 'specific';
  const organ_gift_text = donate_specific
    ? `only the following organs or parts: ${str(form.hci_specific_organs)}`
    : 'any needed organs or parts';

  const limited_purpose = donate_specific && str(form.hci_purpose) === 'limited';
  const organ_purpose_text = limited_purpose
    ? `these limited purposes: ${str(form.hci_limited_purpose)}`
    : 'any of the purposes stated in Subsection (a) of 19a-279f of the General Statutes';

  return {
    client_name:    str(form.principal_name),
    client_dob:     str(form.principal_dob),
    signing_date:   str(form.signing_date),
    signing_county: str(form.signing_county),
    witness1_name:  str(form.witness1_name),
    witness2_name:  str(form.witness2_name),
    notary_name:    str(form.notary_name),
    notary_commission_expiration: str(form.notary_commission_expiration),

    hca_name:         str(form.hca_name),
    hca_dob:          str(form.hca_dob),
    has_single_alt,
    has_multiple_alts,
    alt_hca_1_name:   has_single_alt ? alt_hcas[0].name : '',
    alt_hca_1_dob:    has_single_alt ? alt_hcas[0].dob  : '',
    alt_hcas,

    comfort_statement,
    donate_specific,
    organ_gift_text,
    organ_purpose_text,
  };
}

function buildHciCustomData(form) {
  return {
    client_name:  str(form.principal_name),
    signing_date: str(form.signing_date),
    custom_body:  str(form.hci_custom_body),
  };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderDoc(templateKey, data) {
  const tplPath = path.join(TEMPLATE_DIR, TEMPLATES[templateKey]);
  if (!fs.existsSync(tplPath)) {
    const err = new Error(`Ancillary template not found: ${tplPath}`);
    err.code = 'TEMPLATE_MISSING';
    throw err;
  }

  const content = fs.readFileSync(tplPath, 'binary');
  const zip = new PizZip(content);
  let doc;
  try {
    doc = new Docxtemplater(zip, {
      delimiters:    { start: '{{', end: '}}' },
      paragraphLoop: true,
      linebreaks:    true,
    });
    doc.render(data);
  } catch (error) {
    const err = new Error('Failed to render ancillary document.');
    err.code = 'RENDER_FAILED';
    err.templateKey = templateKey;
    err.detail = error && error.properties && Array.isArray(error.properties.errors)
      ? error.properties.errors.map((e) => e.properties && e.properties.explanation).filter(Boolean)
      : [error && error.message ? error.message : 'Unknown error'];
    throw err;
  }

  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * Generate one or more ancillary documents from form data.
 * Returns an array of { filename, buffer } objects ready to zip.
 *
 * @param {object}   form        Form data (same shape as /api/generate-poa plus ancillary fields)
 * @param {string[]} selectedDocs  e.g. ['conservator','revocation','hci']
 * @param {Date}     [now]       Injectable for tests
 */
function generateAncillaryDocs(form, selectedDocs, now) {
  const d = now || new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const nameParts = str(form.principal_name).split(/\s+/).filter(Boolean);
  const lastName  = nameParts.length ? nameParts[nameParts.length - 1] : 'Client';
  const safeLast  = lastName.replace(/[^A-Za-z0-9\-]/g, '') || 'Client';

  const results = [];

  for (const docType of selectedDocs) {
    let templateKey, data, label;

    switch (docType) {
      case 'conservator':
        templateKey = 'conservator';
        data  = buildConservatorData(form);
        label = 'Conservator';
        break;
      case 'revocation':
        templateKey = 'revocation';
        data  = buildRevocationData(form);
        label = 'Revocation';
        break;
      case 'disposition':
        templateKey = 'disposition';
        data  = buildDispositionData(form);
        label = 'Disposition';
        break;
      case 'hci':
        if (form.hci_custom === true || form.hci_custom === 'true') {
          templateKey = 'hci_custom';
          data  = buildHciCustomData(form);
        } else {
          templateKey = 'hci';
          data  = buildHciData(form);
        }
        label = 'HCI';
        break;
      default:
        continue;
    }

    const buffer   = renderDoc(templateKey, data);
    const filename = `${label}_${safeLast}_${dateStr}.docx`;
    results.push({ filename, buffer });
  }

  return results;
}

module.exports = {
  generateAncillaryDocs,
  buildConservatorData,
  buildRevocationData,
  buildDispositionData,
  buildHciData,
};
