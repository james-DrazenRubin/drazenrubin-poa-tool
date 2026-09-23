/*
 * build-templates.js — Generate tagged .docx templates for ancillary estate docs.
 *
 * Run once (or after any template change) with:
 *   node templates/ancillary/_build/build-templates.js
 *
 * Outputs to templates/ancillary/. Source of truth for template content is
 * this file; mirrors how templates/_src/ documents the POA template build.
 *
 * Never alter legal / boilerplate language here without attorney review.
 * Delimiters: {{ }} — same as POA_Tagged_Template.docx.
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const PizZip = require('../../../backend/node_modules/pizzip');

const OUT = path.join(__dirname, '..');

// ── Shared .docx skeleton parts ───────────────────────────────────────────────

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

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault/>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
</w:styles>`;

// ── XML helpers ───────────────────────────────────────────────────────────────

function p(text, { center = false, bold = false, after = 160 } = {}) {
  const pPr = center
    ? `<w:pPr><w:jc w:val="center"/><w:spacing w:after="${after}"/></w:pPr>`
    : `<w:pPr><w:spacing w:after="${after}"/></w:pPr>`;
  const rPr = bold ? '<w:rPr><w:b/></w:rPr>' : '';
  return `    <w:p>\n      ${pPr}\n      <w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r>\n    </w:p>`;
}

// A paragraph whose sole content is a docxtemplater loop/condition tag.
// These are removed by docxtemplater; only the content between them is kept.
function tag(t) {
  return `    <w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
}

function wrap(docXml) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
${docXml}
    <w:sectPr/>
  </w:body>
</w:document>`;
}

function makeDocx(documentXml) {
  const zip = new PizZip();
  zip.file('[Content_Types].xml',         CONTENT_TYPES);
  zip.file('_rels/.rels',                 PKG_RELS);
  zip.file('word/_rels/document.xml.rels', WORD_RELS);
  zip.file('word/styles.xml',             STYLES);
  zip.file('word/document.xml',           documentXml);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ── 1. Designation of Conservator ────────────────────────────────────────────

const CONSERVATOR_XML = wrap([
  p('DESIGNATION OF CONSERVATOR', { center: true, bold: true, after: 240 }),

  p('I, {{client_name}}, residing in {{client_city}}, Connecticut, being of sound mind, hereby declare that if at any time hereafter, I am found to be incapable of managing my own affairs or incapable of caring for myself, then I direct that the following persons, in the order listed below, be appointed Conservator of my person by a court of appropriate jurisdiction:', { after: 40 }),
  tag('{{#conservators}}'),
  p('{{name}}, born {{dob}}', { after: 40 }),
  tag('{{/conservators}}'),

  p('I, {{client_name}}, residing in {{client_city}}, Connecticut, being of sound mind, hereby declare that if at any time hereafter, I am found to be incapable of managing my own affairs or incapable of caring for myself, then I direct that the following persons, in the order listed below, be appointed Conservator of my estate by a court of appropriate jurisdiction:', { after: 40 }),
  tag('{{#conservators}}'),
  p('{{name}}, born {{dob}}', { after: 40 }),
  tag('{{/conservators}}'),

  p('I direct that no bond or security be required of any such Conservator. This designation is made under the authority of Connecticut General Statutes Section 45a-645, but is intended to be given effect by any court with jurisdiction over myself and my estate.'),
  p('The word Conservator shall include the word Guardian in any jurisdiction where such term would apply.', { after: 280 }),

  p('____________________________________', { after: 40 }),
  p('{{client_name}}', { after: 280 }),

  p('{{signing_date}}, the foregoing instrument was signed, and subscribed at the end thereof by {{client_name}}, in the presence of each of us as attesting witnesses, and was then and there published and declared by the declarant to each of us to be a Designation of Conservator, and thereupon we, at the request of and in the presence of each other, subscribed our name thereto as attesting witnesses at the time aforesaid, and we hereby certify that the matters herein stated took place, in fact, and in the order herein stated.'),

  p('_________________________residing at 17 Page Street, Ansonia, Connecticut 06401', { after: 40 }),
  p('{{witness1_name}}', { after: 160 }),
  p('_________________________residing at 5 Highland Drive, North Haven, Connecticut 06473', { after: 40 }),
  p('{{witness2_name}}', { after: 280 }),

  p('STATE OF CONNECTICUT ) ss.:', { after: 40 }),
  p('{{signing_date}} COUNTY OF {{signing_county}}', { after: 40 }),
  p('The above-subscribing witnesses, {{witness1_name}} and {{witness2_name}}, being duly sworn, severally depose and say: That they each witnessed the foregoing Designation of Conservator by {{client_name}} and subscribed the same in the presence of each other, and that {{client_name}} at the time of the execution of said instrument appeared to each of them to be of full age and of sound and disposing mind, memory and understanding, not under any restraint or improper influence of any kind or in any respect incompetent to make such a designation, and that {{client_name}} signed said Designation in their presence and that they make this affidavit at the request of {{client_name}}.'),

  p('____________________________________', { after: 40 }),
  p('{{witness1_name}}', { after: 160 }),
  p('____________________________________', { after: 40 }),
  p('{{witness2_name}}', { after: 280 }),

  p('Subscribed and sworn to at the request of the above-named declarant on the day and year first above written, before me.', { after: 160 }),
  p('____________________________________', { after: 40 }),
  p('{{notary_name}}', { after: 40 }),
  p('Notary Public', { after: 40 }),
  p('State of Connecticut', { after: 40 }),
  p('My commission expires {{notary_commission_expiration}}'),
].join('\n'));

// ── 2. Revocation of POA ──────────────────────────────────────────────────────

const REVOCATION_XML = wrap([
  p('REVOCATION OF ANY POWER OF ATTORNEY', { center: true, bold: true, after: 40 }),
  p('TO {{prior_agent_name}}', { center: true, after: 240 }),

  p('{{signing_date}}', { after: 160 }),
  p('To Whom It May Concern:', { after: 160 }),
  p('I, {{client_name}}, of {{client_city}}, Connecticut, hereby revoke in writing any and all Powers of Attorney, Durable or otherwise, including, but not limited to a Statutory Short Form Durable Power of Attorney dated {{prior_poa_date}}, which I may have given or may be outstanding in the name of {{prior_agent_name}}.'),
  p('It is my intention hereby that {{pronoun}} have no further authority to transact business or handle financial affairs on my behalf.', { after: 280 }),

  p('________________________________', { after: 40 }),
  p('{{client_name}}', { after: 160 }),
  p('________________________________', { after: 40 }),
  p('{{witness1_name}}', { after: 280 }),

  p('STATE OF CONNECTICUT )', { after: 40 }),
  p('ss.: {{signing_city}}', { after: 40 }),
  p('{{signing_date}} COUNTY OF {{signing_county}}', { after: 160 }),
  p('{{signing_date}}, before me, {{notary_name}}, the undersigned officer, personally appeared, {{client_name}}, known to me (or satisfactorily proven) to be the person whose name is subscribed to the within instrument as principal and acknowledged that the principal executed the same for the purposes therein contained, as the principal\'s free act and deed. IN WITNESS WHEREOF, I hereunto set my hand.', { after: 200 }),

  p('____________________________________', { after: 40 }),
  p('{{notary_name}}', { after: 40 }),
  p('Notary Public', { after: 40 }),
  p('State of Connecticut', { after: 40 }),
  p('My Commission Expires {{notary_commission_expiration}}'),
].join('\n'));

// ── 3. Disposition of Remains ─────────────────────────────────────────────────

const DISPOSITION_XML = wrap([
  p('DISPOSITION OF REMAINS AND APPOINTMENT OF AGENT', { center: true, bold: true, after: 40 }),
  p('The powers granted in this form are defined in Connecticut General Statutes', { after: 240 }),

  p('I, {{client_name}} of {{client_town}}, Connecticut, being of sound mind, make known that upon my death my body shall be disposed of in the following manner:'),
  p('{{disposition_directions}}', { after: 200 }),

  p('I appoint {{disposition_agent1_name}}, having an address and telephone number of {{disposition_agent1_address_phone}}, to have custody and control of my body to act as my agent to carry out the disposition directions expressed in this document, and in the absence of disposition directions, to have custody and control of my body and to determine the disposition of my body.'),
  tag('{{#has_disposition_agent2}}'),
  p('If {{disposition_agent1_name}} shall decline to act or cannot be located within forty-eight hours of my death or the discovery of my body, then {{disposition_agent2_name}}, having an address and telephone number of {{disposition_agent2_address_phone}}, shall act in that person\'s place and stead.'),
  tag('{{/has_disposition_agent2}}'),

  p('Executed at 245 Cherry Street, Milford, Connecticut on {{signing_date}}', { after: 200 }),
  p('____________________________________', { after: 40 }),
  p('{{client_name}}', { after: 200 }),

  p('Signed in our presence by {{client_name}} who, at the time of the execution of this document, appeared to be of sound mind and over eighteen years old.', { after: 160 }),
  p('The author appeared to be under no improper influence.', { after: 160 }),
  p('We have subscribed this document in the author\'s presence and at the author\'s request and in the presence of each other.', { after: 200 }),

  p('______________________________ ______________________________', { after: 40 }),
  p('{{witness1_name}}                    {{witness2_name}}', { after: 40 }),
  p('Ansonia, Connecticut 06401          North Haven, Connecticut 06473'),
].join('\n'));

// ── 4. Health Care Instructions (all 3 variants via conditionals) ─────────────

const HCI_XML = wrap([
  p('THESE ARE MY HEALTH CARE INSTRUCTIONS, MY APPOINTMENT OF A HEALTH CARE REPRESENTATIVE, THE DESIGNATION OF MY CONSERVATOR OF THE PERSON FOR MY FUTURE INCAPACITY AND MY DOCUMENT OF ANATOMICAL GIFT.', { center: true, bold: true, after: 240 }),

  p('To any physician or advanced practice registered nurse who is treating me:'),
  p('These are my health care instructions including those concerning the withholding or withdrawal of life support systems, together with the appointment of my health care representative, the designation of my conservator of the person for future incapacity and my document of anatomical gift.'),
  p('As my physician or advanced practice registered nurse, you may rely on these health care instructions and any decision made by my health care representative or conservator of my person, if I am incapacitated to the point when I can no longer actively take part in decisions for my own life, and am unable to direct my physician or advanced practice registered nurse as to my own medical care.'),

  p('I, {{client_name}}, born {{client_dob}}, the author of this document, request that, if my condition is deemed terminal or if I am determined to be permanently unconscious, I be allowed to die and not be kept alive through life support systems.'),
  p('By terminal condition, I mean that I have an incurable or irreversible medical condition which, without the administration of life support systems, will, in the opinion of my attending physician or advanced practice registered nurse, result in death within a relatively short time.'),
  p('By permanently unconscious I mean that I am in a permanent coma or persistent vegetative state which is an irreversible condition in which I am at no time aware of myself or the environment and show no behavioral response to the environment.'),
  p('The life support systems, which I do not want include, but are not limited to:'),
  p('Artificial respiration, cardiopulmonary resuscitation and artificial means of providing nutrition and hydration.'),
  p('I do want sufficient pain medication to maintain my physical comfort.'),
  p('{{comfort_statement}}', { after: 200 }),

  // HCA appointment
  p('I appoint {{hca_name}}, born {{hca_dob}}, to be my health care representative.'),
  p('If my attending physician or advanced practice registered nurse determines that I am unable to understand and appreciate the nature and consequences of health care decisions and unable to reach and communicate an informed decision regarding treatment, my health care representative is authorized to make any and all health care decisions for me, including (1) the decision to accept or refuse any treatment, service or procedure used to diagnose or treat my physical or mental condition, except as otherwise provided by law such as for psychosurgery or shock therapy, as defined in section 17a-540, and (2) the decision to provide, withhold or withdraw life support systems.'),
  p('I direct my health care representative to make decisions on my behalf in accordance with my wishes, as stated in this document or as otherwise known to my health care representative. In the event my wishes are not clear or a situation arises that I did not anticipate, my health care representative may make a decision in my best interests, based upon what is known of my wishes.'),

  // Variant B: single alternate HCA
  tag('{{#has_single_alt}}'),
  p('If {{hca_name}} is unwilling or unable to serve as my health care representative, I appoint, {{alt_hca_1_name}}, born {{alt_hca_1_dob}} to be my alternative health care representative.'),
  tag('{{/has_single_alt}}'),

  // Variant C: multiple alternate HCAs
  tag('{{#has_multiple_alts}}'),
  p('If {{hca_name}} is unwilling or unable to serve as my health care representative, I appoint the following individuals to be my alternative health care representatives to serve in the order listed:'),
  tag('{{#alt_hcas}}'),
  p('{{name}}, born {{dob}}', { after: 40 }),
  tag('{{/alt_hcas}}'),
  tag('{{/has_multiple_alts}}'),

  // Conservator designation — primary (all variants)
  p('If a conservator of my person should need to be appointed, I designate {{hca_name}}, born {{hca_dob}}, be appointed my conservator.'),

  // Conservator alternate — Variant B
  tag('{{#has_single_alt}}'),
  p('If {{hca_name}} is unwilling or unable to serve as my conservator, I designate {{alt_hca_1_name}}, born {{alt_hca_1_dob}}'),
  tag('{{/has_single_alt}}'),

  // Conservator alternates — Variant C
  tag('{{#has_multiple_alts}}'),
  p('If {{hca_name}} is unwilling or unable to serve as my conservator, I designate the following individuals to serve in the order listed:'),
  tag('{{#alt_hcas}}'),
  p('{{name}}, born {{dob}}', { after: 40 }),
  tag('{{/alt_hcas}}'),
  tag('{{/has_multiple_alts}}'),

  p('No bond shall be required of either of them in any jurisdiction.', { after: 200 }),

  // Organ donation
  p('I hereby make this anatomical gift, if medically acceptable, to take effect upon my death. I give: {{organ_gift_text}}'),
  tag('{{#donate_specific}}'),
  p('to be donated for: {{organ_purpose_text}}'),
  tag('{{/donate_specific}}'),

  p('These requests, appointments, and designations are made after careful reflection, while I am of sound mind.'),
  p('Any party receiving a duly executed copy or facsimile of this document may rely upon it unless such party has received actual notice of my revocation of it.', { after: 200 }),

  p('Dated: {{signing_date}}', { after: 200 }),
  p('_______________________________________', { after: 40 }),
  p('{{client_name}}', { after: 200 }),

  p('This document was signed in our presence by {{client_name}}, the author of this document, who appeared to be eighteen years of age or older, of sound mind and able to understand the nature and consequences of health care decisions at the time this document was signed.'),
  p('The author appeared to be under no improper influence.'),
  p('We have subscribed this document in the author\'s presence and at the author\'s request and in the presence of each other.', { after: 200 }),

  p('___________________________________ ___________________________________', { after: 40 }),
  p('{{witness1_name}}                     {{witness2_name}}', { after: 40 }),
  p('Ansonia, Connecticut 06401           North Haven, Connecticut 06473', { after: 200 }),

  p('STATE OF CONNECTICUT ) ss.:', { after: 40 }),
  p('{{signing_date}} COUNTY OF {{signing_county}}', { after: 160 }),
  p('We, the subscribing witnesses, being duly sworn, say that we witnessed the execution of these health care instructions, the appointments of a health care representative, the designation of a conservator for future incapacity and a document of anatomical gift by the author of this document; that the author subscribed, published and declared the same to be the author\'s instructions, appointments and designation in our presence; that we thereafter subscribed the document as witnesses in the author\'s presence, at the author\'s request, and in the presence of each other; that at the time of the execution of said document the author appeared to us to be eighteen years of age or older, of sound mind, able to understand the nature and consequences of said document, and under no improper influence, and we make this affidavit at the request of {{client_name}} on {{signing_date}}'),

  p('___________________________________ ___________________________________', { after: 40 }),
  p('{{witness1_name}}                     {{witness2_name}}', { after: 200 }),

  p('Subscribed and sworn to before me on {{signing_date}}', { after: 160 }),
  p('___________________________________', { after: 40 }),
  p('{{notary_name}}', { after: 40 }),
  p('Notary Public', { after: 40 }),
  p('State of Connecticut', { after: 40 }),
  p('My Commission Expires: {{notary_commission_expiration}}'),
].join('\n'));

// ── 5. Health Care Instructions — Custom body ─────────────────────────────────

const HCI_CUSTOM_XML = wrap([
  p('THESE ARE MY HEALTH CARE INSTRUCTIONS, MY APPOINTMENT OF A HEALTH CARE REPRESENTATIVE, THE DESIGNATION OF MY CONSERVATOR OF THE PERSON FOR MY FUTURE INCAPACITY AND MY DOCUMENT OF ANATOMICAL GIFT.', { center: true, bold: true, after: 240 }),
  p('{{custom_body}}', { after: 280 }),
  p('_______________________________________', { after: 40 }),
  p('{{client_name}}', { after: 200 }),
  p('Dated: {{signing_date}}'),
].join('\n'));

// ── Write files ───────────────────────────────────────────────────────────────

const docs = [
  ['Designation_of_Conservator_Tagged.docx', CONSERVATOR_XML],
  ['Revocation_of_POA_Tagged.docx',          REVOCATION_XML],
  ['Disposition_of_Remains_Tagged.docx',     DISPOSITION_XML],
  ['Health_Care_Instructions_Tagged.docx',   HCI_XML],
  ['Health_Care_Instructions_Custom_Tagged.docx', HCI_CUSTOM_XML],
];

docs.forEach(([filename, xml]) => {
  const outPath = path.join(OUT, filename);
  fs.writeFileSync(outPath, makeDocx(xml));
  console.log('wrote', filename);
});

console.log('\nAll ancillary templates built successfully.');
