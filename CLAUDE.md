# CLAUDE.md — Drazen Rubin Law POA Document Assembly Tool

Guidance for anyone (human or AI) working on this project.

## Firm details
- **Firm name:** Drazen Rubin Law
- **Location:** 230 Woodmont Road, Milford, CT
- **Document:** Connecticut Statutory Durable Power of Attorney — Long Form
- **Output:** Microsoft Word (`.docx`) — attorneys must be able to edit before sending
- **Users:** Legal support staff (data entry) and attorneys (review/finalize)

## Non-negotiable rules
1. **Never modify the legal language** in the template or in any power's description.
2. **All powers text is reproduced verbatim** from the firm's original document.
   The single source of truth is `backend/powersText.js`. Never hard-code power
   text inline in the engine — always reference the constants there, so a future
   legal update happens in exactly one place.
3. **The document engine must not alter formatting, fonts, or paragraph structure**
   of the output beyond inserting the merged data.
4. **Every generated document is a DRAFT.** The attorney always reviews before it
   goes to a client. The tool assists; it does not give legal advice.

## Tech constraints
- **Frontend:** vanilla HTML/CSS/JavaScript only — no framework, no jQuery, no React.
- **Backend:** Node.js + Express.
- **Document generation:** `docxtemplater` + `pizzip`. Template delimiters are
  `{{ }}` (configured in `documentEngine.js`), with paragraph loops and linebreaks enabled.
- **No database, no authentication** in v1 (internal network use).

## Document assembly rules
- **Power N ("All other matters")** is included ONLY if all of Powers A–M are
  selected; otherwise it is automatically eliminated.
- **Powers keep their fixed statutory letters** (A–N, O–X) even when some are
  omitted — gaps are expected. (Pending confirmation: keep fixed vs. re-letter.)
- **Optional Estate Planning Powers section** (header + full CAUTION notice) appears
  only when at least one estate power is selected; otherwise the whole section is omitted.
- **Special Provisions:** the text submitted from the form is what goes into the
  document; if blank, the firm default in `backend/defaultSpecialProvisions.js` is used.
- **Optional blocks:** Agent 2 is removed from the opening sentence when blank (and
  `agent_authority` blanks out); successor lines are removed when blank.
- **Output filename:** `POA_[PrincipalLastName]_[YYYY-MM-DD].docx`.

## Error handling
- Missing required fields → the form highlights them and blocks submission; the API
  also returns `400` with the list of missing fields.
- Generation failures → clean JSON error to the client; **never expose stack traces**.
- Missing template file → logged with the expected path.

## File map
```
frontend/                       Data-entry form (Step 5+; not built yet)
backend/server.js               Express API (POST /api/generate-poa)
backend/documentEngine.js       Merge logic — decides what's included; never rewrites law
backend/powersText.js           All 24 powers, VERBATIM (single source of truth)
backend/defaultSpecialProvisions.js   Firm's standard Special Provisions default
templates/POA_Tagged_Template.docx    The tagged Word template
```

## Conversation/build order is fixed
Follow the 10-step build order in the project spec (see README "Build status").
Do not reorder steps without explicit instruction.
