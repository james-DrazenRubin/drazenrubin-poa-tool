# Drazen Rubin Law — Power of Attorney Document Assembly Tool

An internal web tool for the firm's legal support staff. Staff enter client/agent
data into a form; the backend merges it into the firm's **Connecticut Statutory
Durable Power of Attorney (Long Form)** Word template and returns a completed,
**editable `.docx`** for an attorney to review and finalize.

- **Frontend:** vanilla HTML/CSS/JS (no framework) — *not built yet (Step 5+)*
- **Backend:** Node.js + Express
- **Document engine:** `docxtemplater` + `pizzip`
- **No database, no auth** (v1 runs on the firm's internal network)

Every generated document is a **DRAFT** — the attorney always reviews before it
goes to a client. See [`CLAUDE.md`](./CLAUDE.md) for the firm-wide rules (never
alter legal language, powers reproduced verbatim, fixed step order).

---

## Build status

| Step | Item | Status |
|------|------|--------|
| 1 | Project scaffold + tagged template (`templates/POA_Tagged_Template.docx`) | ✅ Done |
| 2 | Backend document engine — placeholder replacement | ✅ Done & verified |
| 3 | Dynamic powers tables (standard + estate) | ✅ Done & verified |
| 4 | Special Provisions handling (default + override) | ✅ Done & verified |
| 5 | Frontend form — structure & sections | ✅ Done |
| PP | Practice Panther OAuth + contact search integration | 🔧 Partial — see open issue below |
| 6 | Frontend — powers UI (standard A–N always included; estate O–X selectable) | ✅ Done |
| CL | Checklist upload & parse — PDF → Claude API → prefill form | ✅ Done |
| AN | Ancillary documents — Conservator, Revocation, Disposition, HCI (3 variants + custom) | ✅ Done |
| CT | Contingent POA — second template, shared engine, type selector in form | ✅ Done |
| 7 | Frontend — presets | ⏭️ Pending |
| 8 | Wire frontend ↔ backend, end-to-end test | ⏭️ Pending |
| 9 | File download + output naming | ⏭️ Pending (naming already in engine) |
| 10 | Polish, validation, error handling | ⏭️ Pending |

**Verified on 2026-07-22:** `node test/sample-generate.js` produces valid `.docx`
files — correct powers per selection, optional blocks omitted, no leftover `{{placeholders}}`.

**Updated 2026-09-02:** Standard Powers A–N are always included in every generated document;
only Estate Planning Powers O–X are selectable by staff.

**Updated 2026-09-04:** Added checklist upload & parse stage (Step CL). See "How generation
works" below for the full flow including the new first step.

**Updated 2026-09-08:** Added Contingent POA (Step CT) — second tagged template, shared engine,
POA type radio selector at top of form. Checklist parser now pre-selects type automatically.
Filenames distinguish type: `POA_Durable_LastName_Date.docx` / `POA_Contingent_LastName_Date.docx`.

**Updated 2026-09-08:** Checklist parser now pre-checks ancillary document boxes (Section 8)
based on checklist sections, and pre-selects all estate powers O–X when Hot Powers = Y.
Firm abbreviation lookup added to prompt (rule 11): "SLR" → Steven Rubin, 245 Cherry Street,
Milford CT 06460; "M" single-initial resolved to Anne Mailhot via cross-document name matching.
Tested against Checklist (1).pdf (Susan W. Hames) — browser-verified.

**Verified 2026-09-04 — live browser test + CLI test against MWormley Checklist 052226.pdf:**
- Principal name, DOB, address, city, ZIP, pronoun all extracted correctly.
- Primary agent and successor agents: full names resolved correctly by cross-referencing
  the named-agents table elsewhere in the document (prompt fix applied same session).
- Gifting = None → Power P correctly excluded; item 8 correctly removed from Special Provisions.
- Additional Powers note "Medicaid planning powers" detected; `medicaid-asset-preservation`
  bundle suggested for attorney confirmation (no auto-selection).
- POA type = Contingent correctly detected and flagged (tool generates Durable only).
- Handwritten/scanned legibility: principal last name read as "Warmley" instead of "Wormley" —
  confirms that staff review of flagged fields (amber highlight) is essential.
- End-to-end browser flow confirmed: upload card → Parse & Prefill → form prefills with
  amber-highlighted fields, POA type warning, and Medicaid bundle notice all displaying correctly.

**Verified 2026-09-04 — Culligan Checklist 051326.pdf (two-client, spouse POA pattern):**
- Two clients correctly split: Francis J. Culligan (Durable) and Deborah A. Tanno (Contingent).
- "Spouse" circled as agent → correctly resolved to co-client's full name (Deborah A. Tanno)
  after prompt update; prompt rule 10 added for this pattern.
- Successor Ashley Tanno resolved to full name from named agents table.
- Gifting and estate powers blank → Special Provisions left empty (firm default used at generation).
- Deborah's address missing from checklist → correctly flagged for staff to complete.
- Contingent POA type for Client 2 correctly flagged.
- Agent DOB and address now extracted when present in the named agents table (prompt + prefill
  assembly updated 2026-09-04); fields are only flagged if genuinely missing, not always.
- Browser-verified with updated server.

### Open questions / known gaps (raised at end of Step 2 and during Step CL)
1. **Powers layout** — currently rendered as a simple list (`(A)   Real Property`),
   not the original two-column initials-box table. Restyle the template table later?
2. ~~**Lettering** — powers keep their fixed statutory letters (gaps appear when powers are skipped).~~ Resolved: Standard Powers A–N are always included so no gaps occur.

**Checklist parser open items (Step CL):**
3. **Agent DOB** — the intake checklist does not capture agent date of birth, but
   the template text includes it inline (e.g. "born October 30, 1965"). Agent DOB
   fields are always flagged for staff to complete manually.
4. **Successor agent addresses** — the checklist has name-only lines for up to 2
   successors; the template requires name + address for each. Successor addresses
   are always flagged. Consider extending the intake checklist to collect addresses.
5. **More than 2 successor agents** — the Wormley checklist listed 3 successors
   (Karen, Regina, Rickelle); the form and template support only 2. The third is
   silently dropped. If 3 successors are needed in practice, the form and template
   will need to be extended.
6. **Gift clause — "Other" gifting** — the "Other" variant requires the named
   person's full name in ALL CAPS (e.g. "LAYLA EVAN HAMES"). If the parser cannot
   extract the name from the checklist, a placeholder appears in Special Provisions
   and the field is flagged. If the intake checklist does not have a dedicated field
   for this name, consider adding one.
7. **Additional Powers / Medicaid bundle** — when a checklist notes "Medicaid
   planning powers" or similar, the parser flags it and suggests the
   `medicaid-asset-preservation` bundle for attorney confirmation. Auto-selection
   of an entire bundle from a fuzzy text match is intentionally NOT implemented.
8. **Handwritten legibility** — OCR/vision accuracy on handwritten names is good
   but not perfect (e.g. "Wormley" read as "Warmley"). Staff must always review
   amber-highlighted fields before generating.

**Ancillary document open items (Step AN):**
9. **HCI "quality of life" phrase** — Variant A in the source omits it; Variants B and C use slightly different wording. The unified template uses "I value quality of life over quantity." for all variants with home-care preference opted in. Attorney should review on first use.
10. **Source documents retained as reference** — originals in `templates/_source_ancillary/` (`.doc` format, never used by the engine). Tagged templates are in `templates/ancillary/`; rebuild with `node templates/ancillary/_build/build-templates.js` after any content change.
11. **Custom HCI path** — staff can paste a fully custom document body (e.g. Jewish AHCD style). The tool wraps it with the standard title, client signature, and date. The sample in `templates/_source_ancillary/Jewish_AHCD_Sample.docx` is the style reference.
12. **ALS POA** — not yet supported. Checklist parser flags it and instructs staff to handle separately.
13. **Contingent template rebuild** — if the Contingent template needs updating, edit `templates/_src_contingent/build-contingent-template.js` and run `node templates/_src_contingent/build-contingent-template.js` from the project root.

---

## Project structure
```
drazenrubin-poa-tool/
  frontend/
    index.html                      Form UI + checklist upload card
    style.css   app.js
  backend/
    server.js                       Express API: POST /api/generate-poa, /api/parse-checklist
    documentEngine.js               Merge logic (docxtemplater + pizzip) — do not alter
    checklistParser.js              Claude API call: PDF → structured prefill JSON
    giftClauses.js                  Item 8 gift-clause variants, verbatim (single source of truth)
    powersText.js                   All 24 powers, verbatim (single source of truth)
    defaultSpecialProvisions.js     Firm's standard Special Provisions (items 1–21)
    package.json   .env.example
    test/sample-generate.js         Engine test harness (writes to test-output/)
    test/sample-parse-checklist.js  Parser test — prints extracted JSON + flagged list
  templates/
    POA_Tagged_Template.docx        The tagged Word template
    sample-checklist.pdf            Sample intake checklist for parser testing
    _src/                           Source XML used to build the .docx (regenerable)
  CLAUDE.md   README.md   .gitignore
```

---

## Setup & run

Requires **Node.js 18+** (installed: v24 LTS).

```powershell
cd backend
npm install
Copy-Item .env.example .env      # adjust if needed
npm start                        # serves API on http://localhost:4000
```

With `SERVE_FRONTEND=true` (default), the backend will also serve the form UI from
`../frontend` once it exists — open `http://localhost:4000/`.

### Test the engine directly (no server)
```powershell
cd backend
node test/sample-generate.js
```
Generates sample documents into `backend/test-output/` you can open in Word.

### Test the checklist parser (no server)
```powershell
cd backend
node test/sample-parse-checklist.js
# or pass a specific PDF:
node test/sample-parse-checklist.js path\to\checklist.pdf
```
Prints extracted JSON and the flagged-field list for eyeball accuracy testing.
Requires `ANTHROPIC_API_KEY` in `backend/.env`.

### Health check
`GET http://localhost:4000/api/health`

---

## API

### `POST /api/generate-poa`
Body: JSON form data (see fields below). On success, responds with the `.docx`
as an attachment named `POA_[PrincipalLastName]_[YYYY-MM-DD].docx`. On validation
failure, responds `400` with `{ ok:false, error, fields:[...missing] }`. Errors are
returned as clean JSON — no stack traces.

**Powers are sent as arrays of ids:**
- `standardPowers`: always the full set A–N (sent automatically by the frontend; not user-selectable)
- `estatePowers`: e.g. `["make_gift","digital_assets"]`
- `specialProvisions`: string (omit/blank → firm default is used)
- `agent_authority`: `"severally"` | `"jointly"` (required only if a co-agent is named)

Power ids are defined in `backend/powersText.js`.

---

## How generation works

**Optional first step — checklist parse:**
0. Staff uploads the client's intake checklist PDF via the "Start from Intake
   Checklist" card at the top of the form.  `POST /api/parse-checklist` sends
   the PDF (in memory, never written to disk) to the Claude API (`claude-opus-4-8`
   native PDF input).  The extracted JSON is mapped to the form schema and
   returned with a `flagged` list of fields that need staff attention (amber
   highlight in the UI).  If the checklist has two clients, staff pick one;
   the other remains available via the selection UI.  SSN is surfaced for
   staff reference only and is never written to the form or the log.

**Checklist parser enhancements (2026-09-08):**
- Hot Powers = Y on checklist → all estate powers O–X pre-checked in the form (rule 6a)
- Ancillary document sections on checklist → corresponding Section 8 checkboxes pre-checked and blocks expanded automatically (rule 12)
- `ancillaryDocs: { conservator, revocation, disposition, hci }` returned in parse response
- Firm abbreviation lookup (rule 11): "SLR" → Steven Rubin, 245 Cherry Street, Milford CT 06460. Add further abbreviations here as they are identified.
- "M" single-initial resolution: rule 11 cross-references all names found anywhere in the document; if exactly one last name begins with the initial, it resolves automatically. Tested: "M" → Anne Mailhot (conservator 2, disposition agent 2) including her address pulled from checklist.
- Firm lookup table in rule 11: SLR → Steven Rubin (245 Cherry Street, Milford CT 06460); AM/Anne M → Anne Mailhot. Add further abbreviations as identified.
- Ancillary pre-check variability: handwritten checklists may not consistently trigger all four doc flags across runs — staff should verify Section 8 selections after every parse. Fields prefill correctly regardless.

**POA type selection (Step CT — new):**
Staff select Durable or Contingent at the top of the form. The checklist parser pre-selects
the type automatically from the circled value. `generateContingentPoa()` in `documentEngine.js`
uses `Contingent_POA_Tagged_Template.docx` (built from `templates/_src_contingent/build-contingent-template.js`);
`buildContingentData()` adds `principal_pronoun_possessive` (his/her/their) for the notary block.
ALS POA is still out of scope — flagged by the parser for attorney handling.

**Optional ancillary documents (Step AN — new):**
Staff check any of the four ancillary documents in Section 8 of the form and click "Generate Ancillary Docs." `POST /api/generate-ancillary` calls `ancillaryEngine.generateAncillaryDocs()` per selected type, bundles the results as a `.zip`, and streams it back. The HCI variant (A/B/C) is selected automatically from the number of alternate HCA entries. Source templates live in `templates/ancillary/`; the build script is `templates/ancillary/_build/build-templates.js`.

**Main generation flow (unchanged):**
1. Staff review/complete the prefilled (or blank) form and click Generate.
2. `server.js` validates required fields.
3. `documentEngine.buildData()` maps the form to template data — resolves optional
   blocks (`has_agent2`, `has_estate_powers`, successors), applies the **Power N**
   rule, and selects Special Provisions text (submitted or default).
4. `docxtemplater` renders `POA_Tagged_Template.docx` (delimiters `{{ }}`, paragraph
   loops, linebreaks) into a completed `.docx` buffer.
5. The server streams it back as a download and logs the generation
   (`backend/logs/generation.log` — timestamp + principal name only).

---

## Regenerating the template
The `.docx` is a ZIP of the XML parts in `templates/_src/`. To rebuild after editing
the XML, re-zip the parts with the exact entry names (`[Content_Types].xml`,
`_rels/.rels`, `word/document.xml`, `word/styles.xml`,
`word/_rels/document.xml.rels`) using forward-slash paths. (The firm will normally
just edit the `.docx` directly in Word instead.)

---

## Resume point (next session)

### 🔧 Open issue — Practice Panther contact search
PP's `/api/account` endpoint returns **matters/cases** only. Clients who exist in
PP but have no active matter are not returned, so the lookup widget misses them.

**What we know about the PP API:**
- `/api/account?$top=500&$skip=N` — paginates matters; `primaryContact` has name,
  `billingAddress` has address (`address1`, `city`, `state`, `postalCode`)
- No server-side name filtering supported — we fetch all and filter client-side
- `/api/contact` (and variants) — all return 404; PP has no standalone contacts endpoint confirmed
- Need to find the correct endpoint for standalone contact/client records
- Suggested next step: check PP Swagger at
  `https://app.practicepanther.com/content/apidocs/index.html` while logged in,
  or contact PP support for the contacts endpoint

**ngrok tunnel** (restart each session):
```powershell
Start-Process -FilePath "ngrok" -ArgumentList "http 4000" -WindowStyle Hidden
# Retrieve URL:
(Invoke-RestMethod http://localhost:4040/api/tunnels).tunnels[0].public_url
```
Current registered redirect URI: `https://slighted-preformed-patriot.ngrok-free.dev/api/pp-callback`
(Free plan — URL changes on restart; re-register in PP and update `backend/.env` each time.)

PP tokens are saved in `backend/.pp-tokens.json` (gitignored). After restarting
the server the token auto-refreshes; only re-authorize if the refresh token
expires (14 days of inactivity).

### Next steps after PP fix
Step 7 — presets, Step 8 — end-to-end test, Step 9 — download, Step 10 — polish.
