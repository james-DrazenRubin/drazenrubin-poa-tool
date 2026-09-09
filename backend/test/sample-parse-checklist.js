/*
 * sample-parse-checklist.js — Test the checklist parser against a real PDF.
 *
 * Usage:
 *   cd backend
 *   node test/sample-parse-checklist.js
 *   node test/sample-parse-checklist.js path/to/other-checklist.pdf
 *
 * Prints the extracted JSON and a field-by-field summary so you can eyeball
 * accuracy before wiring the parser into the frontend.
 *
 * SSNs are noted as "[PRESENT]" and not printed to the console.
 */
'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { parseChecklist } = require('../checklistParser');

const DEFAULT_PDF = path.join(__dirname, '..', '..', 'templates', 'sample-checklist.pdf');
const pdfPath = process.argv[2] || DEFAULT_PDF;

if (!fs.existsSync(pdfPath)) {
  console.error('PDF not found:', pdfPath);
  process.exit(1);
}

async function main() {
  console.log('Parsing:', pdfPath, '\n');
  const buf = fs.readFileSync(pdfPath);

  let result;
  try {
    result = await parseChecklist(buf);
  } catch (err) {
    console.error('Parse failed:', err.message);
    process.exit(1);
  }

  console.log('── Confidence ──────────────────────────────────────────────');
  console.log('Overall:', result.confidence.overall);
  if (result.confidence.notes) console.log('Notes:  ', result.confidence.notes);
  console.log();

  result.clients.forEach((client, i) => {
    console.log(`── Client ${i + 1}: ${client.label} ${'─'.repeat(Math.max(0, 50 - client.label.length))}`);
    console.log('POA type :', client.poaType || '(not detected)');
    console.log('SSN      :', client.ssn ? '[PRESENT — not printed]' : '(not found)');
    console.log();

    // Prefill data (omit long fields for readability)
    const { specialProvisions, standardPowers, estatePowers, ...shortData } = client.data;
    console.log('Prefill data:');
    Object.entries(shortData).forEach(([k, v]) => {
      const flag = client.flagged.includes(k) ? ' ⚑' : '';
      console.log(`  ${k.padEnd(32)} ${JSON.stringify(v)}${flag}`);
    });
    console.log(`  ${'estatePowers'.padEnd(32)} ${JSON.stringify(estatePowers)}`);
    console.log(`  ${'specialProvisions'.padEnd(32)} (${specialProvisions ? specialProvisions.length : 0} chars — first 120: ${(specialProvisions || '').slice(0, 120).replace(/\n/g, '↵')}...)`);

    console.log();
    console.log('Flagged fields ⚑:', client.flagged.join(', ') || '(none)');

    if (client.ancillaryDocs && Object.keys(client.ancillaryDocs).length) {
      console.log('Ancillary docs pre-checked:');
      ['conservator','revocation','disposition','hci'].forEach((k) => {
        console.log(`  ${k.padEnd(12)} ${client.ancillaryDocs[k] === true ? '✓ YES' : client.ancillaryDocs[k] === false ? '✗ no' : '(not detected)'}`);
      });
    }
    if (client.additionalPowersNotes) {
      console.log('Additional powers notes:', client.additionalPowersNotes);
      console.log('Suggested bundles      :', client.suggestedBundles.join(', ') || '(none)');
    }
    console.log();
  });
}

main().catch((err) => { console.error(err); process.exit(1); });
