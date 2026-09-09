/*
 * checklistParser.js — Parse a client intake checklist PDF via the Claude API.
 *
 * Sends the PDF as a native document to claude-opus-4-8 (vision-capable),
 * extracts structured data, and returns a prefill payload shaped to match
 * what buildData() / POST /api/generate-poa already expects.
 *
 * Security rules enforced here:
 *  - PDF buffer is never written to disk (caller passes in-memory buffer).
 *  - SSN is returned in the API response for staff reference but is NEVER
 *    written to the generation log or to any form field.
 *  - Stack traces / raw Claude output are never forwarded to the client.
 */
'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { buildSpecialProvisions } = require('./giftClauses');

const ALL_STANDARD_POWER_IDS = [
  'real_property', 'tangible_personal', 'stocks_bonds', 'commodities_options',
  'banks', 'operation_business', 'insurance_annuities', 'estates_trusts',
  'claims_litigation', 'personal_family_maintenance', 'governmental_benefits',
  'retirement_plans', 'taxes', 'all_other_matters',
];

// ── Extraction prompt ─────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a legal data-extraction assistant for Drazen Rubin Law in Milford, CT. You will receive a Connecticut Power of Attorney intake checklist (which may be typed or handwritten/hand-marked — checkboxes may be circled, initialled, or ticked by hand).

Extract the information below and return ONLY a valid JSON object. No preamble, no explanation, no markdown code fences. Every field listed must be present in your output; use null when the value is not clearly visible or legible.

Return this exact JSON structure:
{
  "clients": [
    {
      "label": "<string — e.g. 'Jane Smith' or 'Client 1'>",
      "poaType": "<'durable' | 'contingent' | 'als' | null>",
      "ssn": "<string | null — extract if visible; format exactly as written>",
      "principal": {
        "name": "<string | null — from 'Name(s) as to appear on documents'>",
        "dob": "<string | null — date of birth, format as written on checklist>",
        "streetAddress": "<string | null>",
        "city": "<string | null — city/town only>",
        "zip": "<string | null>",
        "pronoun": "<'he' | 'she' | 'they' | null — infer from gender if indicated>"
      },
      "agents": [
        {
          "name": "<string | null>",
          "role": "<'primary' | 'co-agent'>",
          "dob": "<string | null — extract if present; format as written>",
          "streetAddress": "<string | null>",
          "city": "<string | null>",
          "state": "<string | null>",
          "zip": "<string | null>"
        }
      ],
      "agentAuthority": "<'severally' | 'jointly' | null — only meaningful when 2+ agents>",
      "successorAgents": [
        { "name": "<string | null>", "address": null }
      ],
      "gifting": "<'spouse' | 'si' | 'issue' | 'other' | 'none' | null>",
      "giftingOtherName": "<string | null — the named individual when gifting is 'other'>",
      "estatePowers": {
        "inter_vivos_trust": "<boolean | null>",
        "make_gift": "<boolean | null>",
        "rights_survivorship": "<boolean | null>",
        "beneficiary_designation": "<boolean | null>",
        "waive_survivor_annuity": "<boolean | null>",
        "authorize_another": "<boolean | null>",
        "disclaim_interest": "<boolean | null>",
        "fiduciary_powers": "<boolean | null>",
        "digital_assets": "<boolean | null>",
        "intellectual_property": "<boolean | null>"
      },
      "hotPowers": "<boolean | null — true if 'Hot Powers: Y' is checked/circled on the checklist>",
      "ancillaryDocs": {
        "conservator": "<boolean | null — true if Designation of Conservator is indicated on the checklist>",
        "revocation": "<boolean | null — true if Revocation of Prior POA is indicated on the checklist>",
        "disposition": "<boolean | null — true if Disposition of Remains is indicated on the checklist>",
        "hci": "<boolean | null — true if Health Care Instructions / HCA is indicated on the checklist>"
      },
      "additionalPowersNotes": "<string | null — raw text from 'Additional Powers' or handwritten notes>",
      "specialProvisionsNotes": "<string | null — any SP-specific items noted on checklist>",
      "conservatorDesignees": [
        { "name": "<string | null>", "dob": "<string | null>" }
      ],
      "healthCareAgent": { "name": "<string | null>", "dob": "<string | null>" },
      "alternateHCAs": [
        { "name": "<string | null>", "dob": "<string | null>" }
      ],
      "dispositionAgents": [
        { "name": "<string | null>", "addressPhone": "<string | null>" }
      ],
      "priorPOA": { "date": "<string | null>", "agentName": "<string | null>" }
    }
  ],
  "confidence": {
    "overall": "<'high' | 'medium' | 'low'>",
    "notes": "<string — briefly note anything ambiguous, illegible, or unusual>"
  }
}

Extraction rules:
1. Return ONLY the JSON object. No markdown, no explanation, no extra text.
2. Use null for any field not clearly present on the checklist. NEVER invent a value.
3. "poaType": map the circled/marked value — "Durable" → "durable", "Contingent" → "contingent", "ALS" → "als".
4. "gifting": map the circled/checked value — "Spouse" → "spouse", "Spouse & Issue" or "S/I" or "S&I" → "si", "Issue" → "issue", "None" → "none", "Other" → "other".
5. "make_gift" in estatePowers: if gifting is "none" → false; if any other gifting value is clearly marked → true; if gifting is ambiguous → null.
6. "inter_vivos_trust" (Power O) and all other estate powers: mark true only if clearly checked, circled, or initialled on the checklist.
6a. "hotPowers": if the checklist has a "Hot Powers" field and "Y" (yes) is checked or circled, set to true. If "N" or blank, set to false or null. When hotPowers is true, all estate powers (O through X) are considered selected — this overrides any individual estate power markings.
12. "ancillaryDocs": for each of the four ancillary documents, set to true if the checklist clearly indicates that document is needed for this client (e.g. a checkbox checked, a "Y" circled, or the section is filled in). Set to false or null if not indicated. Look for sections labelled "Designation of Conservator", "Revocation" or "Revocation of Prior POA", "Disposition of Remains", and "Health Care Instructions" or "HCA".
7. Agent DOB and address: extract if present anywhere in the document (named agents table, client information section, etc.). Return null only if genuinely not found.
8. Successor agent addresses are never on the checklist — always return null for "address".
9. For agent and successor names: if a first name appears in the POA section but the full name (first + last) appears anywhere else in the document (e.g. in a client information section, a named agents table, or elsewhere on the checklist), always use the full name. Never return a first name alone when the full name is visible anywhere on the document.
10. If the POA agent field contains "Spouse" (circled or written) rather than a name, and there are two clients on the checklist, use the other client's full name as the agent. For example, if Client 1's agent is "Spouse" and Client 2 is Deborah A. Tanno, then Client 1's agent1_name should be "Deborah A. Tanno".
11. Firm abbreviation lookup — the following shorthand names/initials are used on Drazen Rubin Law checklists. When you encounter any of these, substitute the full name and address:
    - "SLR" or "S.L.R." or "Steve Rubin" → full name: "Steven Rubin", address: "245 Cherry Street, Milford, CT 06460"
    - "AM" or "Anne M" or "A. Mailhot" → full name: "Anne Mailhot"
    Apply this lookup anywhere a name appears (agents, conservators, HCA, disposition agents, successors).
    Additionally, if a single letter or initial appears where a name is expected (e.g. "M", "J", "K"), check whether any full name found ANYWHERE in the document — including in other roles/sections — has a last name beginning with that letter. A person may appear in multiple roles on the same checklist (e.g. as both HCA and conservator). If exactly one such match exists across the entire document, you MUST resolve the initial to that full name. Only leave the initial unresolved if zero matches or two or more matches exist.
11a. Ancillary document fields — extract from the relevant checklist sections if present:
    - conservatorDesignees: from the "Designation of Conservator" section (names + DOBs in order). Reuse the principal's name/DOB already extracted — do not re-extract from the same field.
    - healthCareAgent + alternateHCAs: from the "Health Care Instructions" / "HCA" section. Use full names as per rule 9.
    - dispositionAgents: from the "Disposition of Remains" section (name + address/phone).
    - priorPOA: from any "Revocation" or "Prior POA" section (date of prior POA + prior agent name).
    If a section is not present or not filled in on the checklist, return null values for those fields.
9. If only ONE client is on the checklist, return a "clients" array with one entry. If TWO clients are present (e.g. "Client 1" / "Client 2", or husband/wife), return both.
10. "pronoun": "He/His" or male gender indicator → "he"; "She/Her" or female → "she"; "They/Their" or non-binary → "they"; otherwise null.
11. "confidence.overall": "high" if you can read everything clearly; "medium" if some fields are unclear; "low" if the document is largely illegible.`;

// ── Helpers ───────────────────────────────────────────────────────────────────

const ESTATE_POWER_IDS = [
  'inter_vivos_trust', 'make_gift', 'rights_survivorship', 'beneficiary_designation',
  'waive_survivor_annuity', 'authorize_another', 'disclaim_interest',
  'fiduciary_powers', 'digital_assets', 'intellectual_property',
];

function mapEstatePowers(ep, gifting, hotPowers) {
  // Hot Powers Y → all estate powers O–X included regardless of individual markings
  if (hotPowers === true) return [...ESTATE_POWER_IDS];

  if (!ep) return [];
  const ids = [];
  ESTATE_POWER_IDS.forEach((id) => {
    if (id === 'make_gift') {
      // Driven by gifting field: any non-null, non-'none' gifting → include
      if (gifting && gifting !== 'none') ids.push('make_gift');
    } else if (ep[id] === true) {
      ids.push(id);
    }
  });
  return ids;
}

function buildFlaggedList(client) {
  const flagged = new Set();
  const p = client.principal || {};
  const agents = client.agents || [];
  const primary = agents.find((a) => a.role === 'primary') || agents[0];
  const coAgent = agents.find((a) => a.role === 'co-agent');

  if (!p.name)          flagged.add('principal_name');
  if (!p.dob)           flagged.add('principal_dob');
  if (!p.streetAddress) flagged.add('principal_street_address');
  if (!p.city)          flagged.add('principal_city');
  if (!p.zip)           flagged.add('principal_zip');
  if (!p.pronoun)       flagged.add('principal_pronoun');

  // Agent 1 — flag only fields that weren't extracted
  if (!primary || !primary.name)          flagged.add('agent1_name');
  if (!primary || !primary.dob)           flagged.add('agent1_dob');
  if (!primary || !primary.streetAddress) flagged.add('agent1_street_address');
  if (!primary || !primary.city)          flagged.add('agent1_city');
  if (!primary || !primary.state)         flagged.add('agent1_state');
  if (!primary || !primary.zip)           flagged.add('agent1_zip');

  // Agent 2 — only flag fields if a co-agent was found
  if (coAgent && coAgent.name) {
    if (!coAgent.dob)           flagged.add('agent2_dob');
    if (!coAgent.streetAddress) flagged.add('agent2_street_address');
    if (!coAgent.city)          flagged.add('agent2_city');
    if (!coAgent.state)         flagged.add('agent2_state');
    if (!coAgent.zip)           flagged.add('agent2_zip');
  }

  // Successor agent addresses — always missing from checklist
  (client.successorAgents || []).forEach((_, i) => {
    flagged.add(`successor${i + 1}_address`);
  });

  // Gifting "Other" without a resolved name — the specialProvisions will have a placeholder
  if (client.gifting === 'other' && !client.giftingOtherName) {
    flagged.add('specialProvisions');
  }

  // Ancillary: flag missing/partial data so staff can complete before generating
  if ((client.conservatorDesignees || []).length > 0) {
    (client.conservatorDesignees || []).forEach((d, i) => {
      if (!d || !d.dob) flagged.add(`conservator${i + 1}_dob`);
    });
  }
  if (client.healthCareAgent && client.healthCareAgent.name && !client.healthCareAgent.dob) {
    flagged.add('hca_dob');
  }
  (client.alternateHCAs || []).forEach((a, i) => {
    if (a && a.name && !a.dob) flagged.add(`alt_hca_${i + 1}_dob`);
  });
  if ((client.dispositionAgents || []).length > 0) {
    (client.dispositionAgents || []).forEach((a, i) => {
      if (a && !a.addressPhone) flagged.add(`disposition_agent${i + 1}_address_phone`);
    });
  }

  // ALS POA type — not supported by this tool
  if (client.poaType && client.poaType !== 'durable' && client.poaType !== 'contingent') {
    flagged.add('poaType');
  }

  // Execution / witness / notary — never on the intake checklist
  ['signing_date', 'signing_city', 'signing_county', 'witness1_name', 'witness2_name',
    'notary_name', 'notary_commission_expiration'].forEach((f) => flagged.add(f));

  return [...flagged];
}

function buildPrefillData(client) {
  const p = client.principal || {};
  const agents = client.agents || [];
  const primary = agents.find((a) => a.role === 'primary') || agents[0] || {};
  const coAgent  = agents.find((a) => a.role === 'co-agent');
  const successors = client.successorAgents || [];

  const specialProvisions = (client.gifting !== undefined && client.gifting !== null)
    ? buildSpecialProvisions(client.gifting, client.giftingOtherName)
    : ''; // blank → caller's buildData() uses the firm default

  return {
    principal_name:               p.name          || '',
    principal_dob:                p.dob           || '',
    principal_street_address:     p.streetAddress || '',
    principal_city:               p.city          || '',
    principal_zip:                p.zip           || '',
    principal_pronoun:            p.pronoun       || '',

    agent1_name:                  primary.name          || '',
    agent1_dob:                   primary.dob           || '',
    agent1_street_address:        primary.streetAddress || '',
    agent1_city:                  primary.city          || '',
    agent1_state:                 primary.state         || '',
    agent1_zip:                   primary.zip           || '',

    agent2_name:                  coAgent ? (coAgent.name          || '') : '',
    agent2_dob:                   coAgent ? (coAgent.dob           || '') : '',
    agent2_street_address:        coAgent ? (coAgent.streetAddress || '') : '',
    agent2_city:                  coAgent ? (coAgent.city          || '') : '',
    agent2_state:                 coAgent ? (coAgent.state         || '') : '',
    agent2_zip:                   coAgent ? (coAgent.zip           || '') : '',

    agent_authority:              client.agentAuthority || '',

    successor1_name:              successors[0] ? (successors[0].name || '') : '',
    successor1_address:           '',
    successor2_name:              successors[1] ? (successors[1].name || '') : '',
    successor2_address:           '',

    signing_date:                 '',
    signing_city:                 '',
    signing_county:               '',
    witness1_name:                '',
    witness2_name:                '',
    notary_name:                  '',
    notary_commission_expiration: '',

    poa_type:                     client.poaType || 'durable',
    standardPowers:               ALL_STANDARD_POWER_IDS,
    estatePowers:                 mapEstatePowers(client.estatePowers, client.gifting, client.hotPowers),
    specialProvisions,

    // ── Ancillary fields ──────────────────────────────────────────────────────
    ...buildAncillaryPrefill(client),
  };
}

function buildAncillaryPrefill(client) {
  const out = {};

  // Conservator designees
  const designees = client.conservatorDesignees || [];
  for (let i = 0; i < 3; i++) {
    out[`conservator${i + 1}_name`] = designees[i] ? (designees[i].name || '') : '';
    out[`conservator${i + 1}_dob`]  = designees[i] ? (designees[i].dob  || '') : '';
  }

  // Health care agent
  const hca = client.healthCareAgent || {};
  out.hca_name = hca.name || '';
  out.hca_dob  = hca.dob  || '';

  // Alternate HCAs
  const altHcas = client.alternateHCAs || [];
  for (let i = 0; i < 4; i++) {
    out[`alt_hca_${i + 1}_name`] = altHcas[i] ? (altHcas[i].name || '') : '';
    out[`alt_hca_${i + 1}_dob`]  = altHcas[i] ? (altHcas[i].dob  || '') : '';
  }

  // Disposition agents
  const dispAgents = client.dispositionAgents || [];
  out.disposition_agent1_name          = dispAgents[0] ? (dispAgents[0].name        || '') : '';
  out.disposition_agent1_address_phone = dispAgents[0] ? (dispAgents[0].addressPhone || '') : '';
  out.disposition_agent2_name          = dispAgents[1] ? (dispAgents[1].name        || '') : '';
  out.disposition_agent2_address_phone = dispAgents[1] ? (dispAgents[1].addressPhone || '') : '';

  // Prior POA for revocation
  const prior = client.priorPOA || {};
  out.prior_poa_date    = prior.date      || '';
  out.prior_agent_name  = prior.agentName || '';

  return out;
}

const BUNDLE_KEYWORDS = {
  'medicaid-asset-preservation': [
    'medicaid', 'asset preservation', 'medicaid planning',
    'long term care', 'long-term care', 'ltc', 'able account',
    'representative payee', 'spousal refusal',
  ],
};

function suggestBundles(notes) {
  if (!notes) return [];
  const lower = notes.toLowerCase();
  return Object.entries(BUNDLE_KEYWORDS)
    .filter(([, kws]) => kws.some((kw) => lower.includes(kw)))
    .map(([bundle]) => bundle);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Parse a client intake checklist PDF and return prefill data for the form.
 *
 * @param {Buffer} pdfBuffer   In-memory PDF bytes (never written to disk)
 * @returns {Promise<object>}  { ok, clients: [{ label, poaType, ssn, data, flagged, ... }], confidence }
 */
async function parseChecklist(pdfBuffer) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdfBuffer.toString('base64'),
          },
        },
        {
          type: 'text',
          text: EXTRACTION_PROMPT,
        },
      ],
    }],
  });

  const rawText = (message.content[0] && message.content[0].text) ? message.content[0].text.trim() : '';

  // Strip markdown fences if Claude included them despite instructions
  const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

  let extracted;
  try {
    extracted = JSON.parse(jsonText);
  } catch (e) {
    const err = new Error('Checklist parser returned invalid JSON.');
    err.code = 'PARSE_FAILED';
    throw err;
  }

  if (!extracted.clients || !Array.isArray(extracted.clients) || extracted.clients.length === 0) {
    const err = new Error('No client data found in checklist.');
    err.code = 'NO_CLIENTS';
    throw err;
  }

  const clients = extracted.clients.map((c, i) => ({
    label:                 c.label || `Client ${i + 1}`,
    poaType:               c.poaType || null,
    ssn:                   c.ssn    || null,    // for staff reference only — never logged
    data:                  buildPrefillData(c),
    flagged:               buildFlaggedList(c),
    additionalPowersNotes: c.additionalPowersNotes || null,
    suggestedBundles:      suggestBundles(c.additionalPowersNotes),
    ancillaryDocs:         c.ancillaryDocs || {},
  }));

  return {
    ok: true,
    clients,
    confidence: extracted.confidence || { overall: 'medium', notes: '' },
  };
}

module.exports = { parseChecklist };
