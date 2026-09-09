'use strict';

// Power definitions — ids and labels only (legal text lives in backend/powersText.js)
const STANDARD_POWERS = [
  { id: 'real_property',               letter: 'A', label: 'Real Property' },
  { id: 'tangible_personal',           letter: 'B', label: 'Tangible Personal Property' },
  { id: 'stocks_bonds',                letter: 'C', label: 'Stocks and Bonds' },
  { id: 'commodities_options',         letter: 'D', label: 'Commodities and Options' },
  { id: 'banks',                       letter: 'E', label: 'Banks and Other Financial Institutions' },
  { id: 'operation_business',          letter: 'F', label: 'Operation of Entity or Business' },
  { id: 'insurance_annuities',         letter: 'G', label: 'Insurance and Annuities' },
  { id: 'estates_trusts',              letter: 'H', label: 'Estates, Trusts and Other Beneficial Interests' },
  { id: 'claims_litigation',           letter: 'I', label: 'Claims and Litigation' },
  { id: 'personal_family_maintenance', letter: 'J', label: 'Personal and Family Maintenance' },
  { id: 'governmental_benefits',       letter: 'K', label: 'Benefits from Governmental Programs or Civil/Military Service' },
  { id: 'retirement_plans',            letter: 'L', label: 'Retirement Plans' },
  { id: 'taxes',                       letter: 'M', label: 'Taxes' },
  { id: 'all_other_matters',           letter: 'N', label: 'All Other Matters' },
];

const ESTATE_POWERS = [
  { id: 'inter_vivos_trust',        letter: 'O', label: 'Create/Amend/Revoke Inter Vivos Trust' },
  { id: 'make_gift',                letter: 'P', label: 'Make a Gift' },
  { id: 'rights_survivorship',      letter: 'Q', label: 'Create or Change Rights of Survivorship' },
  { id: 'beneficiary_designation',  letter: 'R', label: 'Create or Change a Beneficiary Designation' },
  { id: 'waive_survivor_annuity',   letter: 'S', label: 'Waive Survivor Annuity' },
  { id: 'authorize_another',        letter: 'T', label: 'Authorize Another Person' },
  { id: 'disclaim_interest',        letter: 'U', label: 'Disclaim or Refuse an Interest' },
  { id: 'fiduciary_powers',         letter: 'V', label: 'Exercise Fiduciary Powers' },
  { id: 'digital_assets',           letter: 'W', label: 'Digital Assets and Devices' },
  { id: 'intellectual_property',    letter: 'X', label: 'Intellectual Property' },
];

// Human-readable labels for backend field names (used in the error banner)
const FIELD_LABELS = {
  principal_name:                'Principal Full Name',
  principal_dob:                 'Principal Date of Birth',
  principal_street_address:      'Principal Street Address',
  principal_city:                'Principal City',
  principal_zip:                 'Principal ZIP',
  principal_pronoun:             'Principal Pronoun',
  agent1_name:                   'Primary Agent Full Name',
  agent1_dob:                    'Primary Agent Date of Birth',
  agent1_street_address:         'Primary Agent Street Address',
  agent1_city:                   'Primary Agent City',
  agent1_state:                  'Primary Agent State',
  agent1_zip:                    'Primary Agent ZIP',
  agent_authority:               'Co-Agent Authority (Severally or Jointly)',
  signing_date:                  'Date of Signing',
  signing_city:                  'City of Signing',
  signing_county:                'County of Signing',
  witness1_name:                 'Witness 1 Full Name',
  witness2_name:                 'Witness 2 Full Name',
  notary_name:                   'Notary Full Name',
  notary_commission_expiration:  'Notary Commission Expiration',
};

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderPowers();
  wireToggles();
  wireAncillary();
  wireChecklistUpload();
  wireSubmit();
  checkPpStatus();
});

// ── Powers ────────────────────────────────────────────────────────────────────

function renderPowers() {
  const estGrid = document.getElementById('estate-powers-grid');

  ESTATE_POWERS.forEach((p) => estGrid.appendChild(makePowerItem(p, 'estatePowers')));

  document.getElementById('btn-select-all-est').addEventListener('click', () => {
    estGrid.querySelectorAll('.power-cb').forEach((cb) => { cb.checked = true; });
  });
  document.getElementById('btn-clear-est').addEventListener('click', () => {
    estGrid.querySelectorAll('.power-cb').forEach((cb) => { cb.checked = false; });
  });
}

function makePowerItem(power, groupName) {
  const wrap = document.createElement('label');
  wrap.className = 'power-item';

  const cb = document.createElement('input');
  cb.type      = 'checkbox';
  cb.className = 'power-cb';
  cb.name      = groupName;
  cb.value     = power.id;
  cb.id        = 'pw-' + power.id;

  const lbl = document.createElement('span');
  lbl.className = 'power-lbl';
  lbl.innerHTML = `<span class="power-letter">${power.letter}.</span>${power.label}`;

  wrap.appendChild(cb);
  wrap.appendChild(lbl);
  return wrap;
}

// ── Ancillary documents ───────────────────────────────────────────────────────

function wireAncillary() {
  // Show/hide each ancillary block when its checkbox is toggled
  document.querySelectorAll('.anc-toggle').forEach((cb) => {
    const blockId = 'block-' + cb.id.replace('anc-', '');
    cb.addEventListener('change', () => {
      const block = document.getElementById(blockId);
      if (block) block.hidden = !cb.checked;
      updateAncillarySubmitRow();
    });
  });

  // Disposition backup agent toggle
  document.getElementById('toggle-disposition-agent2').addEventListener('change', (e) => {
    document.getElementById('block-disposition-agent2').hidden = !e.target.checked;
  });

  // HCI: standard vs custom mode
  document.querySelectorAll('input[name="hci_mode"]').forEach((r) => {
    r.addEventListener('change', () => {
      const isCustom = document.querySelector('input[name="hci_mode"]:checked').value === 'custom';
      document.getElementById('hci-standard').hidden = isCustom;
      document.getElementById('hci-custom').hidden   = !isCustom;
    });
  });

  // HCI: show alt row 2 when alt 1 has a name; show row 3 when alt 2 has a name
  document.getElementById('alt_hca_1_name').addEventListener('input', syncAltHcaRows);
  document.getElementById('alt_hca_2_name').addEventListener('input', syncAltHcaRows);
  document.getElementById('alt_hca_3_name').addEventListener('input', syncAltHcaRows);

  // Organ donation: show specific organ fields when "specific" selected
  document.querySelectorAll('input[name="hci_donate"]').forEach((r) => {
    r.addEventListener('change', () => {
      const specific = document.querySelector('input[name="hci_donate"]:checked').value === 'specific';
      document.getElementById('hci-specific-organs-block').hidden = !specific;
    });
  });

  // Purpose: show limited purpose text when "limited" selected
  document.querySelectorAll('input[name="hci_purpose"]').forEach((r) => {
    r.addEventListener('change', () => {
      const limited = document.querySelector('input[name="hci_purpose"]:checked').value === 'limited';
      document.getElementById('hci-limited-purpose-block').hidden = !limited;
    });
  });

  // Generate ancillary button
  document.getElementById('btn-generate-ancillary').addEventListener('click', handleGenerateAncillary);
}

function syncAltHcaRows() {
  const v1 = document.getElementById('alt_hca_1_name').value.trim();
  const v2 = document.getElementById('alt_hca_2_name').value.trim();
  const v3 = document.getElementById('alt_hca_3_name').value.trim();

  document.getElementById('alt-hca-row-2').hidden = !v1;
  document.getElementById('alt-hca-row-3').hidden = !(v1 && v2);

  // Update variant badge
  const numAlts = [v1, v2, v3].filter(Boolean).length;
  const badge = document.getElementById('hci-variant-badge');
  if (numAlts === 0)      badge.textContent = 'Variant A — no alternates';
  else if (numAlts === 1) badge.textContent = 'Variant B — 1 alternate HCA';
  else                    badge.textContent = `Variant C — ${numAlts} alternate HCAs`;
}

function updateAncillarySubmitRow() {
  const anyChecked = Array.from(document.querySelectorAll('.anc-toggle')).some((cb) => cb.checked);
  document.getElementById('ancillary-submit-row').hidden = !anyChecked;
}

function buildAncillaryPayload() {
  const form = document.getElementById('poa-form');
  const data = {};

  // Shared fields from the main form (already present in POA payload)
  [
    'principal_name', 'principal_dob', 'principal_city', 'principal_pronoun',
    'signing_date', 'signing_city', 'signing_county',
    'witness1_name', 'witness2_name', 'notary_name', 'notary_commission_expiration',
  ].forEach((f) => {
    const el = document.getElementById(f);
    if (el) data[f] = el.value.trim();
  });

  // Format signing_date if it's in YYYY-MM-DD (date input format)
  if (data.signing_date && data.signing_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y, m, d] = data.signing_date.split('-').map(Number);
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    data.signing_date = `${months[m - 1]} ${d}, ${y}`;
  }

  // Ancillary-specific fields
  const ancFields = [
    'conservator1_name','conservator1_dob','conservator2_name','conservator2_dob',
    'conservator3_name','conservator3_dob',
    'prior_poa_date','prior_agent_name',
    'disposition_directions','disposition_agent1_name','disposition_agent1_address_phone',
    'disposition_agent2_name','disposition_agent2_address_phone',
    'hca_name','hca_dob',
    'alt_hca_1_name','alt_hca_1_dob','alt_hca_2_name','alt_hca_2_dob',
    'alt_hca_3_name','alt_hca_3_dob',
    'hci_specific_organs','hci_limited_purpose','hci_custom_body',
  ];
  ancFields.forEach((f) => {
    const el = document.getElementById(f);
    if (el) data[f] = el.value.trim();
  });

  // Booleans / radios
  const homeCareEl = document.getElementById('hci_home_care_preference');
  data.hci_home_care_preference = homeCareEl ? homeCareEl.checked : true;

  const donateEl = document.querySelector('input[name="hci_donate"]:checked');
  data.hci_donate = donateEl ? donateEl.value : 'all';

  const purposeEl = document.querySelector('input[name="hci_purpose"]:checked');
  data.hci_purpose = purposeEl ? purposeEl.value : 'general';

  const modeEl = document.querySelector('input[name="hci_mode"]:checked');
  data.hci_custom = modeEl ? modeEl.value === 'custom' : false;

  return data;
}

async function handleGenerateAncillary() {
  const btn = document.getElementById('btn-generate-ancillary');
  const docs = Array.from(document.querySelectorAll('.anc-toggle'))
    .filter((cb) => cb.checked)
    .map((cb) => cb.id.replace('anc-', ''));

  if (!docs.length) return;

  btn.disabled = true;
  const overlay = showOverlay();
  try {
    const res = await fetch('/api/generate-ancillary', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ docs, form: buildAncillaryPayload() }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error.' }));
      alert(err.error || 'Could not generate ancillary documents. Please try again.');
      return;
    }

    const blob        = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match       = disposition.match(/filename="([^"]+)"/);
    const filename    = match ? match[1] : 'AncillaryDocs.zip';
    const url         = URL.createObjectURL(blob);
    const a           = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    alert('Network error — please check your connection and try again.');
  } finally {
    overlay.remove();
    btn.disabled = false;
  }
}

// ── Checklist upload & prefill ────────────────────────────────────────────────

function wireChecklistUpload() {
  const fileInput  = document.getElementById('checklist-file');
  const fileNameEl = document.getElementById('checklist-file-name');
  const parseBtn   = document.getElementById('btn-parse-checklist');

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileNameEl.textContent = file ? file.name : 'No file chosen';
    parseBtn.disabled = !file;
    setChecklistStatus('', '');
    document.getElementById('client-select').hidden = true;
    document.getElementById('parse-info').hidden = true;
  });

  parseBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    parseBtn.disabled = true;
    setChecklistStatus('loading', 'Parsing checklist…');

    const formData = new FormData();
    formData.append('checklist', file);

    try {
      const res = await fetch('/api/parse-checklist', { method: 'POST', body: formData });
      const json = await res.json().catch(() => ({ ok: false, error: 'Unexpected server response.' }));

      if (!json.ok) {
        setChecklistStatus('error', json.error || 'Could not parse the checklist.');
        parseBtn.disabled = false;
        return;
      }

      if (json.clients.length === 1) {
        applyPrefill(json.clients[0]);
        setChecklistStatus('success', 'Form prefilled from checklist. Review highlighted fields before generating.');
      } else {
        // Two clients — show selection UI
        setChecklistStatus('success', 'Two clients found. Select one to prefill:');
        showClientSelect(json.clients);
      }
    } catch {
      setChecklistStatus('error', 'Network error — please try again.');
      parseBtn.disabled = false;
    }
  });
}

function setChecklistStatus(type, message) {
  const el = document.getElementById('checklist-status');
  if (!type || !message) { el.hidden = true; el.className = 'checklist-status'; el.innerHTML = ''; return; }
  el.hidden = false;
  el.className = 'checklist-status checklist-status--' + type;
  if (type === 'loading') {
    el.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div><span>' + message + '</span>';
  } else {
    el.textContent = message;
  }
}

function showClientSelect(clients) {
  const panel   = document.getElementById('client-select');
  const btnWrap = document.getElementById('client-buttons');
  btnWrap.innerHTML = '';
  clients.forEach((client, i) => {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'btn-client';
    btn.textContent = client.label || `Client ${i + 1}`;
    btn.addEventListener('click', () => {
      btnWrap.querySelectorAll('.btn-client').forEach((b) => b.classList.remove('btn-client--active'));
      btn.classList.add('btn-client--active');
      applyPrefill(client);
      setChecklistStatus('success', `Prefilled for ${client.label}. Review highlighted fields before generating.`);
    });
    btnWrap.appendChild(btn);
  });
  panel.hidden = false;
}

function applyPrefill(client) {
  clearPrefillFlags();
  removePrefillNotice();

  const { data, flagged, poaType, ssn, additionalPowersNotes, suggestedBundles, ancillaryDocs } = client;

  // Pre-select POA type radio
  if (poaType === 'contingent' || poaType === 'durable') {
    const radio = document.querySelector(`input[name="poa_type"][value="${poaType}"]`);
    if (radio) radio.checked = true;
  }

  // Populate text inputs, selects, and textareas
  const skipKeys = new Set(['standardPowers', 'estatePowers', 'specialProvisions', 'agent_authority', 'principal_pronoun']);
  Object.entries(data).forEach(([key, value]) => {
    if (skipKeys.has(key)) return;
    if (typeof value === 'string') setVal(key, value);
  });

  // Pronoun select
  const pronounEl = document.getElementById('principal_pronoun');
  if (pronounEl && data.principal_pronoun) pronounEl.value = data.principal_pronoun;

  // Agent authority radios
  if (data.agent_authority) {
    const radio = document.querySelector(`input[name="agent_authority"][value="${data.agent_authority}"]`);
    if (radio) radio.checked = true;
  }

  // Special provisions textarea
  if (data.specialProvisions) setVal('specialProvisions', data.specialProvisions);

  // Show/hide optional blocks
  if (data.agent2_name) {
    document.getElementById('toggle-agent2').checked = true;
    document.getElementById('block-agent2').hidden = false;
  }
  if (data.successor1_name) {
    document.getElementById('toggle-successors').checked = true;
    document.getElementById('block-successors').hidden = false;
  }

  // Estate powers checkboxes
  const form = document.getElementById('poa-form');
  form.querySelectorAll('input[name="estatePowers"]').forEach((cb) => {
    cb.checked = (data.estatePowers || []).includes(cb.value);
  });

  // Flag uncertain fields with amber highlight
  flagged.forEach((fieldId) => {
    const el = document.getElementById(fieldId);
    if (el) el.classList.add('prefill-flagged');
  });

  // Pre-check ancillary document boxes from checklist
  if (ancillaryDocs) {
    ['conservator', 'revocation', 'disposition', 'hci'].forEach((type) => {
      if (ancillaryDocs[type] === true) {
        const cb = document.getElementById('anc-' + type);
        if (cb && !cb.checked) {
          cb.checked = true;
          const block = document.getElementById('block-' + type);
          if (block) block.hidden = false;
        }
      }
    });
    updateAncillarySubmitRow();
  }

  // Build the parse-info panel
  buildParseInfo(poaType, ssn, additionalPowersNotes, suggestedBundles, flagged);

  // Prefill notice above the form
  const hasWarning = flagged.includes('poaType') || (additionalPowersNotes && suggestedBundles && suggestedBundles.length);
  insertPrefillNotice(flagged.length, hasWarning);

  // Scroll form into view
  document.getElementById('poa-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildParseInfo(poaType, ssn, additionalPowersNotes, suggestedBundles, flagged) {
  const panel = document.getElementById('parse-info');
  panel.innerHTML = '';

  if (poaType && poaType !== 'durable' && poaType !== 'contingent') {
    const item = document.createElement('div');
    item.className = 'parse-info-item parse-info-item--warning';
    item.innerHTML = `<strong>POA Type: ${poaType.toUpperCase()}</strong>This tool generates Durable and Contingent POAs. This checklist indicates an ${poaType.toUpperCase()} POA — please handle this matter separately or consult the attorney.`;
    panel.appendChild(item);
  }

  if (ssn) {
    const item = document.createElement('div');
    item.className = 'parse-info-item parse-info-item--info';
    item.innerHTML = `<strong>SSN (from checklist — for reference only)</strong>${ssn}<br><small>Not included in the generated document or any log.</small>`;
    panel.appendChild(item);
  }

  if (additionalPowersNotes) {
    const bundleText = suggestedBundles && suggestedBundles.length
      ? ` Possible match: <strong>${suggestedBundles.join(', ')}</strong> — confirm with attorney before including.`
      : ' Review with attorney to determine which powers/provisions to include.';
    const item = document.createElement('div');
    item.className = 'parse-info-item parse-info-item--warning';
    item.innerHTML = `<strong>Additional Powers Note (from checklist)</strong>“${additionalPowersNotes}”${bundleText}`;
    panel.appendChild(item);
  }

  if (flagged.includes('poaType') || ssn || additionalPowersNotes) {
    panel.hidden = false;
  }
}

function insertPrefillNotice(flagCount, hasWarning) {
  const notice = document.createElement('div');
  notice.id = 'prefill-notice';
  notice.className = 'prefill-notice' + (hasWarning ? ' prefill-notice--warn' : '');
  notice.innerHTML = flagCount
    ? `Form prefilled from checklist. <strong>${flagCount} field${flagCount !== 1 ? 's' : ''} highlighted in amber</strong> could not be filled automatically — please complete or verify them before generating.`
    : 'Form prefilled from checklist. Please review all fields before generating.';
  const form = document.getElementById('poa-form');
  form.insertAdjacentElement('beforebegin', notice);
}

function removePrefillNotice() {
  const el = document.getElementById('prefill-notice');
  if (el) el.remove();
}

function clearPrefillFlags() {
  document.querySelectorAll('.prefill-flagged').forEach((el) => el.classList.remove('prefill-flagged'));
}

// ── Optional section toggles ──────────────────────────────────────────────────

function wireToggles() {
  [
    ['toggle-agent2',     'block-agent2'],
    ['toggle-successors', 'block-successors'],
  ].forEach(([toggleId, blockId]) => {
    document.getElementById(toggleId).addEventListener('change', (e) => {
      document.getElementById(blockId).hidden = !e.target.checked;
    });
  });
}

// ── Practice Panther ──────────────────────────────────────────────────────────

async function checkPpStatus() {
  try {
    const { configured, authorized } = await fetch('/api/pp-status').then((r) => r.json());
    const banner = document.getElementById('pp-banner');

    if (!configured) { hidePpWidgets(); return; }

    if (!authorized) {
      banner.className = 'pp-banner pp-banner--warning';
      banner.innerHTML = 'Practice Panther is not connected. '
        + '<a href="/api/pp-auth">Connect now</a> to enable client lookup.';
      hidePpWidgets();
      return;
    }

    // Connected — activate search widgets
    wirePpSearch('pp-search-principal-input', 'pp-search-principal-results', fillPrincipal);
    wirePpSearch('pp-search-agent1-input',    'pp-search-agent1-results',    fillAgent1);

    // Show transient success message if redirected back from OAuth
    if (new URLSearchParams(location.search).get('pp') === 'connected') {
      banner.className = 'pp-banner pp-banner--success';
      banner.textContent = 'Practice Panther connected successfully.';
      setTimeout(() => { banner.className = 'pp-banner pp-banner--hidden'; }, 4000);
      history.replaceState({}, '', '/');
    }
  } catch {
    hidePpWidgets();
  }
}

function hidePpWidgets() {
  document.getElementById('pp-search-principal').style.display = 'none';
  document.getElementById('pp-search-agent1').style.display    = 'none';
}

function wirePpSearch(inputId, resultsId, fillFn) {
  const input   = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  let timer;

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { results.style.display = 'none'; results.innerHTML = ''; return; }
    timer = setTimeout(() => doSearch(q, results, fillFn, input), 320);
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.style.display = 'none';
    }
  });
}

async function doSearch(q, resultsEl, fillFn, inputEl) {
  resultsEl.innerHTML = '<div class="pp-result-msg">Searching…</div>';
  resultsEl.style.display = 'block';
  try {
    const data = await fetch('/api/search-contact?q=' + encodeURIComponent(q)).then((r) => r.json());
    if (!data.ok || !data.contacts || !data.contacts.length) {
      resultsEl.innerHTML = '<div class="pp-result-msg">No contacts found.</div>';
      return;
    }
    resultsEl.innerHTML = '';
    data.contacts.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'pp-result';
      row.setAttribute('role', 'option');
      const meta = [c.city, c.state].filter(Boolean).join(', ');
      row.innerHTML = `<div>${c.display_name}</div>`
        + (meta ? `<div class="pp-result-meta">${meta}</div>` : '');
      row.addEventListener('click', () => {
        fillFn(c);
        inputEl.value = '';
        resultsEl.style.display = 'none';
      });
      resultsEl.appendChild(row);
    });
  } catch {
    resultsEl.innerHTML = '<div class="pp-result-msg">Search unavailable.</div>';
  }
}

function fillPrincipal(c) {
  setVal('principal_name',           c.display_name);
  setVal('principal_street_address', c.street);
  setVal('principal_city',           c.city);
  setVal('principal_zip',            c.zip);
  if (c.dob) setVal('principal_dob', c.dob);
}

function fillAgent1(c) {
  setVal('agent1_name',           c.display_name);
  setVal('agent1_street_address', c.street);
  setVal('agent1_city',           c.city);
  setVal('agent1_state',          c.state);
  setVal('agent1_zip',            c.zip);
  if (c.dob) setVal('agent1_dob', c.dob);
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el && value) { el.value = value; el.classList.remove('error'); }
}

// ── Form submission ───────────────────────────────────────────────────────────

function wireSubmit() {
  document.getElementById('poa-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const overlay = showOverlay();
    try {
      const res = await fetch('/api/generate-poa', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(buildPayload()),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error.' }));
        if (err.fields && err.fields.length) {
          showFieldErrors(err.fields);
        } else {
          alert(err.error || 'Could not generate the document. Please try again.');
        }
        return;
      }

      // Trigger browser download
      const blob        = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match       = disposition.match(/filename="([^"]+)"/);
      const filename    = match ? match[1] : 'POA_Draft.docx';
      const url         = URL.createObjectURL(blob);
      const a           = document.createElement('a');
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('Network error — please check your connection and try again.');
    } finally {
      overlay.remove();
    }
  });
}

function buildPayload() {
  const form = document.getElementById('poa-form');
  const data = {};

  // All text inputs, selects, and textareas with a name attribute
  form.querySelectorAll('input[name]:not([type=checkbox]):not([type=radio]), select[name], textarea[name]')
    .forEach((el) => { data[el.name] = el.value.trim(); });

  // Radio: poa_type
  const poaTypeRadio = form.querySelector('input[name="poa_type"]:checked');
  data.poa_type = poaTypeRadio ? poaTypeRadio.value : 'durable';

  // Radio: agent_authority
  const authRadio = form.querySelector('input[name="agent_authority"]:checked');
  data.agent_authority = authRadio ? authRadio.value : '';

  // Format signing_date from YYYY-MM-DD to long form for the document
  if (data.signing_date) {
    const [y, m, d] = data.signing_date.split('-').map(Number);
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    data.signing_date = `${months[m - 1]} ${d}, ${y}`;
  }

  // Standard powers A–N are always included
  data.standardPowers = STANDARD_POWERS.map((p) => p.id);
  data.estatePowers   = Array.from(form.querySelectorAll('input[name="estatePowers"]:checked')).map((cb) => cb.value);

  return data;
}

// ── Error handling ────────────────────────────────────────────────────────────

function showFieldErrors(fields) {
  const banner = document.getElementById('error-banner');
  const list   = document.getElementById('error-list');
  list.innerHTML = '';
  fields.forEach((f) => {
    const li = document.createElement('li');
    li.textContent = FIELD_LABELS[f] || f;
    list.appendChild(li);
    const el = document.getElementById(f);
    if (el) el.classList.add('error');
  });
  banner.hidden = false;
  banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearErrors() {
  document.getElementById('error-banner').hidden = true;
  document.getElementById('error-list').innerHTML = '';
  document.querySelectorAll('.error').forEach((el) => el.classList.remove('error'));
  // Remove amber prefill flags when staff submits — they've reviewed and accepted the values
  clearPrefillFlags();
}

// ── Overlay ───────────────────────────────────────────────────────────────────

function showOverlay() {
  const el = document.createElement('div');
  el.className = 'gen-overlay';
  el.innerHTML = '<div class="gen-box"><div class="spinner"></div><p>Generating document…</p></div>';
  document.body.appendChild(el);
  return el;
}
