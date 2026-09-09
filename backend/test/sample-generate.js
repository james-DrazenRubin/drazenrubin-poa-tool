/*
 * sample-generate.js — Quick local test of the document engine.
 *
 * Run (after `npm install`):   node test/sample-generate.js
 * Produces test-output/POA_sample_*.docx files you can open in Word to verify
 * placeholder replacement, dynamic powers, and Special Provisions handling.
 *
 * This does NOT start the server — it calls the engine directly.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { generatePoa, buildData, buildFilename } = require('../documentEngine');
const { generateAncillaryDocs } = require('../ancillaryEngine');

const OUT_DIR = path.join(__dirname, '..', 'test-output');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Sample A — full Medicaid planning: co-agent + all standard + all estate powers.
const sampleFull = {
  principal_name: 'Margaret A. Whitfield',
  principal_dob: 'March 3, 1946',
  principal_street_address: '18 Maple Court',
  principal_city: 'Milford',
  principal_zip: '06460',
  principal_pronoun: 'her',
  agent1_name: 'David Whitfield',
  agent1_dob: 'June 12, 1972',
  agent1_street_address: '44 Elm Street',
  agent1_city: 'Milford',
  agent1_state: 'CT',
  agent1_zip: '06460',
  agent2_name: 'Sarah Whitfield-Byrne',
  agent2_dob: 'January 9, 1975',
  agent2_street_address: '9 Harbor Road',
  agent2_city: 'Stratford',
  agent2_state: 'CT',
  agent2_zip: '06614',
  agent_authority: 'severally',
  successor1_name: 'Thomas Whitfield',
  successor1_address: '7 Birch Lane, Orange, CT 06477',
  successor2_name: '',
  successor2_address: '',
  signing_date: 'July 22, 2026',
  signing_city: 'Milford',
  signing_county: 'NEW HAVEN',
  witness1_name: 'Jane Doe',
  witness2_name: 'John Roe',
  notary_name: 'Patricia Nolan',
  notary_commission_expiration: 'April 30, 2028',
  standardPowers: [
    'real_property', 'tangible_personal', 'stocks_bonds', 'commodities_options',
    'banks', 'operation_business', 'insurance_annuities', 'estates_trusts',
    'claims_litigation', 'personal_family_maintenance', 'governmental_benefits',
    'retirement_plans', 'taxes', 'all_other_matters'
  ],
  estatePowers: [
    'inter_vivos_trust', 'make_gift', 'rights_survivorship', 'beneficiary_designation',
    'waive_survivor_annuity', 'authorize_another', 'disclaim_interest',
    'fiduciary_powers', 'digital_assets', 'intellectual_property'
  ]
  // specialProvisions omitted -> uses firm default
};

// Sample B — simple/limited: single agent, subset of standard powers, no estate.
const sampleSimple = {
  principal_name: 'Robert Klein',
  principal_dob: 'October 21, 1950',
  principal_street_address: '5 Seaside Avenue',
  principal_city: 'Milford',
  principal_zip: '06460',
  principal_pronoun: 'his',
  agent1_name: 'Linda Klein',
  agent1_dob: 'February 2, 1953',
  agent1_street_address: '5 Seaside Avenue',
  agent1_city: 'Milford',
  agent1_state: 'CT',
  agent1_zip: '06460',
  agent2_name: '', // no co-agent -> Agent 2 block should disappear, authority blank
  signing_date: 'July 22, 2026',
  signing_city: 'Milford',
  signing_county: 'NEW HAVEN',
  witness1_name: 'Jane Doe',
  witness2_name: 'John Roe',
  notary_name: 'Patricia Nolan',
  notary_commission_expiration: 'April 30, 2028',
  standardPowers: ['banks', 'personal_family_maintenance', 'governmental_benefits', 'retirement_plans', 'taxes'],
  estatePowers: [], // none -> whole estate section should be omitted
  specialProvisions: 'Client-specific note: limited authority only. [Test override of Special Provisions.]'
};

function run(label, form) {
  const data = buildData(form);
  const buf = generatePoa(form);
  const filename = buildFilename(form);
  const outPath = path.join(OUT_DIR, `${label}__${filename}`);
  fs.writeFileSync(outPath, buf);
  console.log(`\n=== ${label} ===`);
  console.log(`  standard powers included: ${data.standard_powers.map((p) => p.letter).join(', ') || '(none)'}`);
  console.log(`  estate powers included:   ${data.estate_powers.map((p) => p.letter).join(', ') || '(none)'}  (section shown: ${data.has_estate_powers})`);
  console.log(`  has_agent2: ${data.has_agent2}   agent_authority: "${data.agent_authority}"`);
  console.log(`  special provisions chars: ${data.special_provisions.length}`);
  console.log(`  wrote: ${outPath}`);
}

// ── Shared ancillary base ─────────────────────────────────────────────────────
const ancBase = {
  principal_name:    'Margaret A. Whitfield',
  principal_dob:     'March 3, 1946',
  principal_city:    'Milford',
  principal_pronoun: 'she',
  signing_date:      'July 22, 2026',
  signing_city:      'Milford',
  signing_county:    'NEW HAVEN',
  witness1_name:     'Samantha L. Rillstone',
  witness2_name:     'Michelle DeFelice',
  notary_name:       'Leah Persano',
  notary_commission_expiration: 'November 30, 2025',
};

// HCI Variant A — no alternates
const hciVariantA = {
  ...ancBase,
  hca_name: 'David Whitfield', hca_dob: 'June 12, 1972',
  hci_home_care_preference: true,
  hci_donate: 'all',
};

// HCI Variant B — 1 alternate
const hciVariantB = {
  ...ancBase,
  hca_name: 'David Whitfield', hca_dob: 'June 12, 1972',
  alt_hca_1_name: 'Sarah Whitfield-Byrne', alt_hca_1_dob: 'January 9, 1975',
  hci_home_care_preference: true,
  hci_donate: 'specific',
  hci_specific_organs: 'kidneys and corneas',
  hci_purpose: 'general',
};

// HCI Variant C — 2+ alternates
const hciVariantC = {
  ...ancBase,
  hca_name: 'David Whitfield', hca_dob: 'June 12, 1972',
  alt_hca_1_name: 'Sarah Whitfield-Byrne', alt_hca_1_dob: 'January 9, 1975',
  alt_hca_2_name: 'Thomas Whitfield',       alt_hca_2_dob: 'May 4, 1970',
  hci_home_care_preference: false,
  hci_donate: 'specific',
  hci_specific_organs: 'heart and lungs',
  hci_purpose: 'limited',
  hci_limited_purpose: 'transplantation only',
};

const conservatorForm = {
  ...ancBase,
  conservator1_name: 'David Whitfield',       conservator1_dob: 'June 12, 1972',
  conservator2_name: 'Sarah Whitfield-Byrne', conservator2_dob: 'January 9, 1975',
};

const revocationForm = {
  ...ancBase,
  prior_poa_date:   'January 15, 2020',
  prior_agent_name: 'Thomas Whitfield',
};

const dispositionForm = {
  ...ancBase,
  disposition_directions:           'Cremation. Ashes to be scattered at sea.',
  disposition_agent1_name:          'David Whitfield',
  disposition_agent1_address_phone: '44 Elm Street, Milford, CT 06460 — (203) 555-1234',
  disposition_agent2_name:          'Sarah Whitfield-Byrne',
  disposition_agent2_address_phone: '9 Harbor Road, Stratford, CT 06614 — (203) 555-5678',
};

function runAncillary(label, docs, form) {
  const results = generateAncillaryDocs(form, docs, new Date('2026-07-22'));
  results.forEach(({ filename, buffer }) => {
    const outPath = path.join(OUT_DIR, `ancillary__${label}__${filename}`);
    fs.writeFileSync(outPath, buffer);
    console.log(`  wrote: ${outPath}`);
  });
}

try {
  run('sampleFull', sampleFull);
  run('sampleSimple', sampleSimple);

  // Edge check: Power N should drop automatically if not all A–M are selected.
  const dropN = buildData({ ...sampleFull, standardPowers: ['banks', 'taxes', 'all_other_matters'] });
  console.log(`\n=== edge: Power N auto-drop ===`);
  console.log(`  requested [banks, taxes, all_other_matters] -> included letters: ${dropN.standard_powers.map((p) => p.letter).join(', ')}`);
  console.log(`  (N should NOT appear because A–M are not all selected)`);

  // ── Ancillary tests ────────────────────────────────────────────────────────
  console.log('\n=== ancillary: Designation of Conservator (2 designees) ===');
  runAncillary('conservator', ['conservator'], conservatorForm);

  console.log('\n=== ancillary: Revocation of POA ===');
  runAncillary('revocation', ['revocation'], revocationForm);

  console.log('\n=== ancillary: Disposition of Remains (2 agents) ===');
  runAncillary('disposition', ['disposition'], dispositionForm);

  console.log('\n=== ancillary: HCI Variant A (no alternates) ===');
  runAncillary('hci-variantA', ['hci'], hciVariantA);

  console.log('\n=== ancillary: HCI Variant B (1 alternate, donate specific) ===');
  runAncillary('hci-variantB', ['hci'], hciVariantB);

  console.log('\n=== ancillary: HCI Variant C (2 alternates, limited purpose, no home care) ===');
  runAncillary('hci-variantC', ['hci'], hciVariantC);

  console.log('\nAll samples generated successfully.');
} catch (err) {
  console.error('\nGENERATION FAILED:', err.code || '', err.message);
  if (err.detail) console.error('  detail:', err.detail);
  process.exit(1);
}
