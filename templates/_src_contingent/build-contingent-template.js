/*
 * build-contingent-template.js — Generate Contingent_POA_Tagged_Template.docx
 *
 * Reads the Durable POA's document.xml, applies the 6 specific differences
 * between the Durable and Contingent forms, and writes the tagged .docx.
 *
 * Run from the project root:
 *   node templates/_src_contingent/build-contingent-template.js
 *
 * Never alter legal language here without attorney review.
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const PizZip = require('./../../backend/node_modules/pizzip');

const SRC_XML    = path.join(__dirname, '..', '_src', 'word', 'document.xml');
const STYLES_XML = path.join(__dirname, '..', '_src', 'word', 'styles.xml');
const OUT_PATH   = path.join(__dirname, '..', 'Contingent_POA_Tagged_Template.docx');

let xml = fs.readFileSync(SRC_XML, 'utf8');

// ── 1. Title ──────────────────────────────────────────────────────────────────
xml = xml.replace(
  'STATUTORY POWER OF ATTORNEY- LONG FORM',
  'CONTINGENCY POWER OF ATTORNEY'
);

// ── 2. NOTICE block — add incapacity sentence after existing text ─────────────
xml = xml.replace(
  'THIS POWER OF ATTORNEY DOES NOT AUTHORIZE THE AGENT TO MAKE HEALTH CARE DECISIONS FOR YOU.</w:t>',
  'THIS POWER OF ATTORNEY DOES NOT AUTHORIZE THE AGENT TO MAKE HEALTH CARE DECISIONS FOR YOU.  THIS POWER OF ATTORNEY IS EFFECTIVE UPON THE OCCURRENCE OF A FUTURE EVENT OR THE PRINCIPAL&#8217;S INCAPACITY.  THE DETERMINATION OF MY INCAPACITY SHALL BE DETERMINED BY TWO INDEPENDENT PHYSICIANS WITHIN THE MEANING SET FORTH IN SUBPARAGRAPH (A) OF SUBDIVISION (5) OF SECTION 1-350a.</w:t>'
);

// ── 3. Opening sentence ───────────────────────────────────────────────────────
xml = xml.replace(
  'KNOW ALL PEOPLE BY THESE PRESENTS, which are intended to constitute a GENERAL POWER OF ATTORNEY pursuant to the Connecticut Uniform Power of Attorney Act:',
  'Know All People By These Presents, which are intended to constitute a CONTINGENCY POWER OF ATTORNEY pursuant to the Connecticut Uniform Power of Attorney Act:'
);

// ── 4. Sixth paragraph — effective on incapacity (not immediately) ────────────
xml = xml.replace(
  'Sixth:   This power of attorney is effective immediately unless I have stated otherwise in the special instructions.',
  'Sixth:  This power of attorney shall become effective upon the determination of my incapacity by two independent physicians in accordance within the meaning set forth in subparagraph (B) of subdivision (5) of section 1-350a.'
);

// ── 5. Execution header — mixed case per Contingent source ───────────────────
xml = xml.replace(
  'IN WITNESS WHEREOF, I have hereunto signed my name and affixed my seal on {{signing_date}}.',
  'In Witness Whereof, I have hereunto signed my name and affixed my seal on {{signing_date}}.'
);

// ── 6. Pronoun in notary — possessive form ────────────────────────────────────
xml = xml.replace(
  '{{principal_pronoun}} free act and deed',
  '{{principal_pronoun_possessive}} free act and deed'
);

// ── Build .docx ───────────────────────────────────────────────────────────────
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"   ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const PKG_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const WORD_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const zip = new PizZip();
zip.file('[Content_Types].xml',          CONTENT_TYPES);
zip.file('_rels/.rels',                  PKG_RELS);
zip.file('word/_rels/document.xml.rels', WORD_RELS);
zip.file('word/styles.xml',              fs.readFileSync(STYLES_XML, 'utf8'));
zip.file('word/document.xml',            xml);

fs.writeFileSync(OUT_PATH, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log('Built:', OUT_PATH);
