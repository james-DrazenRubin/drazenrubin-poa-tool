# Drazen Rubin Law — Power of Attorney Document Assembly Tool

An internal web tool for the firm's legal support staff. Staff enter client/agent
data into a form; the backend merges it into the firm's **Connecticut Statutory
Durable Power of Attorney (Long Form)** Word template and returns a completed,
**editable `.docx`** for an attorney to review and finalize.

- **Frontend:** vanilla HTML/CSS/JS (no framework)
- **Backend:** Node.js + Express
- **Document engine:** `docxtemplater` + `pizzip`
- **No database, no auth** (v1 — internal use)
- **Live deployment:** https://drazenrubin-poa-tool-production.up.railway.app

Every generated document is a **DRAFT** — the attorney always reviews before it
goes to a client. See [`CLAUDE.md`](./CLAUDE.md) for the firm-wide rules (never
alter legal language, powers reproduced verbatim, fixed step order).

---

## Build status

| Step | Item | Status |
|------|------|--------|
| 1 | Project scaffold + tagged template | ✅ Done |
| 2 | Backend document engine — placeholder replacement | ✅ Done & verified |
| 3 | Dynamic powers tables (standard + estate) | ✅ Done & verified |
| 4 | Special Provisions handling (default + override) | ✅ Done & verified |
| 5 | Frontend form — structure & sections | ✅ Done |
| PP | Practice Panther OAuth + contact search integration | ✅ Live (re-auth after deploys) |
| 6 | Frontend — powers UI (standard A–N always included; estate O–X selectable) | ✅ Done |
| CL | Checklist upload & parse — PDF → Claude API → prefill form | ✅ Done & verified |
| AN | Ancillary documents — Conservator, Revocation, Disposition, HCI (3 variants + custom) | ✅ Done |
| CT | Contingent POA — second template, shared engine, type selector in form | ✅ Done & verified |
| DE | Railway deployment via GitHub — live, env vars set, PP authorized | ✅ Done |
| 7 | Frontend — presets (common power combinations) | ⏭️ Pending |
| 8 | End-to-end test | ⏭️ Pending |
| 9 | File download + output naming | ⏭️ Pending (naming already in engine) |
| 10 | Polish, validation, error handling | ⏭️ Pending |

---

## Project structure

```
drazenrubin-poa-tool/
  frontend/
    index.html                      Form UI + checklist upload card
    style.css   app.js
  backend/
    server.js                       Express API
    documentEngine.js               Merge logic — do not alter legal text
    ancillaryEngine.js              Ancillary doc generation (zip)
    checklistParser.js              Claude API: PDF → structured prefill JSON
    giftClauses.js                  Item 8 gift-clause variants, verbatim
    powersText.js                   All 24 powers, verbatim (single source of truth)
    defaultSpecialProvisions.js     Firm's standard Special Provisions
    practicePanther.js              PP OAuth + contact search
    package.json   .env.example   railway.toml
    public/                         Frontend files served by the backend (Railway)
    templates/
      POA_Tagged_Template.docx            Main durable POA template
      Contingent_POA_Tagged_Template.docx Contingent POA template
      ancillary/                          Five tagged ancillary templates
      _src_contingent/                    Build script for contingent template
      _source_ancillary/                  Source .doc files (reference only)
    test/
      sample-generate.js            Engine test — writes to test-output/
      sample-parse-checklist.js     Parser test — prints JSON + flagged fields
  CLAUDE.md   README.md   .gitignore
```

---

## Setup & run (local)

Requires **Node.js 18+**.

```powershell
cd backend
npm install
Copy-Item .env.example .env      # add ANTHROPIC_API_KEY at minimum
npm start                        # serves form + API on http://localhost:4000
```

### Test the engine directly (no server)
```powershell
cd backend
node test/sample-generate.js
```
Generates sample `.docx` files into `backend/test-output/`.

### Test the checklist parser (no server)
```powershell
cd backend
node test/sample-parse-checklist.js path\to\checklist.pdf
```
Requires `ANTHROPIC_API_KEY` in `backend/.env`.

### Rebuild templates
```powershell
# Contingent POA template
node backend/templates/_src_contingent/build-contingent-template.js

# Ancillary templates
node backend/templates/ancillary/_build/build-templates.js
```

---

## Deployment (Railway)

The app is deployed at **https://drazenrubin-poa-tool-production.up.railway.app**.

- Linked to GitHub `main` — auto-deploys on push
- Railway root directory: `backend/`
- Config: `backend/railway.toml`
- Environment variables set in Railway: `ANTHROPIC_API_KEY`, `PP_CLIENT_ID`, `PP_CLIENT_SECRET`, `PP_REDIRECT_URI`

### Health check
```
GET https://drazenrubin-poa-tool-production.up.railway.app/api/health
```

### Practice Panther re-authorization (after each deploy)

PP tokens are stored in-process only — they are lost when Railway restarts the container.
After any deploy, re-authorize by visiting:

```
https://drazenrubin-poa-tool-production.up.railway.app/api/pp-auth
```

Log in to Practice Panther when prompted. The redirect URI registered in PP's OAuth app
must be `https://drazenrubin-poa-tool-production.up.railway.app/api/pp-callback`.

---

## API

### `POST /api/generate-poa`
Body: JSON form data. On success, responds with `.docx` as an attachment named
`POA_Durable_[LastName]_[YYYY-MM-DD].docx` or `POA_Contingent_...`. On failure:
`400` with `{ ok:false, error, fields:[...missing] }`.

**Key fields:**
- `poa_type`: `"durable"` | `"contingent"`
- `selectedPowers`: array of power ids (standard A–N always sent; estate O–X optional)
- `agent_authority`: `"severally"` | `"jointly"` (required if co-agent named)
- `specialProvisions`: string (blank → firm default used)

Power ids defined in `backend/powersText.js`.

### `POST /api/generate-ancillary`
Body: `{ docs: ["conservator","revocation","disposition","hci"], form: {...} }`.
Returns a `.zip` containing one `.docx` per requested document type.

### `POST /api/parse-checklist`
Multipart form with a `checklist` PDF field. Sends PDF to Claude API
(`claude-opus-4-8`) and returns structured prefill JSON + flagged fields list.
Requires `ANTHROPIC_API_KEY`.

### `GET /api/pp-status`
Returns `{ ok, configured, authorized }`.

### `GET /api/pp-auth`
Redirects to Practice Panther OAuth login page.

---

## How generation works

**Optional first step — checklist parse:**
0. Staff uploads the client's intake checklist PDF via the "Start from Intake
   Checklist" card. The PDF is sent to Claude (`claude-opus-4-8`) which extracts
   client/agent data and returns it as structured JSON with a `flagged` list of
   fields needing staff review (amber-highlighted in the UI). If the checklist
   has two clients, staff pick one. SSN is surfaced for reference only — never
   logged or written to the form.

**Checklist parser rules (12 active rules):**
- Rule 6a: Hot Powers = Y → all estate powers O–X pre-checked
- Rule 7: Extract agent DOB and address when present
- Rule 9: Prefer full names from anywhere in doc over first-name-only
- Rule 10: "Spouse" as agent + two-client checklist → resolve to co-client's name
- Rule 11: Firm abbreviation lookup — "SLR"/"Steve Rubin" → Steven Rubin (245 Cherry St, Milford CT 06460); "AM"/"Anne M" → Anne Mailhot. Single-initial resolution via cross-document name matching.
- Rule 11a: Extract conservator designees, HCA/alternates, disposition agents, prior POA
- Rule 12: Extract `ancillaryDocs: { conservator, revocation, disposition, hci }` booleans

**POA type selection:**
Staff select Durable or Contingent at the top of the form. The checklist parser
pre-selects the type automatically. ALS POA is out of scope — parser flags it.

**Ancillary documents:**
Staff check any of four ancillary doc types in Section 8 and click "Generate Ancillary Docs."
The HCI variant (A/B/C) is selected automatically based on the number of alternate HCA entries.

**Main generation flow:**
1. Staff review/complete the form and click Generate.
2. `server.js` validates required fields.
3. `documentEngine.buildData()` resolves optional blocks (`has_agent2`, `has_estate_powers`,
   successors), applies the **Power N rule** (N included only if all A–M selected), and
   selects Special Provisions text (submitted or default).
4. `docxtemplater` renders the `.docx` template (delimiters `{{ }}`) into a buffer.
5. Streamed back as a download; generation logged (timestamp + principal name only).

---

## Known gaps & open items

1. **PP tokens not persistent** — lost on Railway container restart; requires `/api/pp-auth` re-auth after each deploy. Long-term fix: store tokens as Railway env vars.
2. **PP contact search coverage** — fetches all accounts via `/api/account`; clients with no active matter may not appear. PP has no standalone contacts endpoint confirmed.
3. **Successor agent addresses** — always flagged; checklist has name-only lines.
4. **More than 2 successor agents** — third is silently dropped.
5. **ALS POA** — not supported; parser flags it for attorney handling.
6. **Ancillary docs browser test** — engine tested; full browser flow pending.
7. **HCI "quality of life" phrase** — unified text used across all variants with home-care opted in; attorney should review on first use.
8. **Handwritten legibility** — amber flags ensure staff review; not perfect on scanned handwriting.
9. **Gift clause "Other" variant** — requires named person's full name in ALL CAPS; flagged if not found.

---

## Verified checklists

| Checklist | Result |
|---|---|
| MWormley Checklist 052226.pdf | ✅ Browser-verified |
| Culligan Checklist 051326.pdf | ✅ Browser-verified (two-client, spouse→agent resolved) |
| Checklist (1).pdf — Susan W. Hames | ✅ Browser-verified (Hot Powers Y, Contingent, SLR→Steven Rubin, M→Anne Mailhot, HCI) |
