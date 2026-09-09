/*
 * giftClauses.js — Item 8 (gifting) variants for Special Provisions.
 *
 * Single source of truth for the five gifting-clause texts.  Text is
 * reproduced VERBATIM from firm documents — never alter it here.
 *
 * The only logic here is substituting the correct item 8 into the
 * DEFAULT_SPECIAL_PROVISIONS string; all other items are left untouched.
 *
 * Variants keyed by the checklist "Gifting" field value:
 *   'spouse' — gifts to my spouse and issue (no gift-splitting paragraph)
 *   'si'     — gifts to my spouse and issue + Section 2513 gift-splitting
 *   'issue'  — gifts to issue + Section 2513 paragraph (excess of exclusion)
 *   'other'  — gifts to my issue and a named third party (name required)
 *   'none'   — no gifting authority; item 8 removed entirely
 */
'use strict';

const { DEFAULT_SPECIAL_PROVISIONS } = require('./defaultSpecialProvisions');

// ── Verbatim item 8 texts ─────────────────────────────────────────────────────

const ITEM8_COMMON_BODY = (recipients) =>
  `8)\tTo make gifts in addition to or in excess of gifts authorized by and transfer property to ${recipients}, in any amounts, proportions and manner, including by way of signing and delivering on my behalf any deed or other instrument of conveyance covering any or all of my personal or real property in which I may from time to time have an interest, including, without limitation, the following actions: (1) transfer by gift in advancement of a bequest or devise; (2) release of any life interest, or waiver, renunciation, or declination of any gift to me by will or deed; (3) changing the ownership or beneficiary designations on any annuity, I.R.A., 401 (k) plan, or any other retirement or savings plan; (4) execution of revocable and irrevocable inter vivos trusts on my behalf, and/or amendment of any trust established by me, and transfer of any property of mine to any such trust; and (5) forgiveness of debts. This power includes the ability of the attorney in fact to make gifts to himself/herself, as my attorney-in-fact shall deem appropriate. Such gifts to himself/herself shall not constitute self-dealing or breach of fiduciary duty.`;

const SECTION_2513 =
  `If I become married, my Agent may make, join, and consent to gifts by my spouse pursuant to Section 2513 of the Internal Revenue Code, even if such gifts exceed my aggregate annual gift tax exclusion amount under Section 2503(b) of the Internal Revenue Code.`;

// Spouse: "my spouse and issue", no Section 2513 paragraph
const ITEM8_SPOUSE = ITEM8_COMMON_BODY('my spouse and issue');

// Issue: "to issue", with Section 2513 paragraph (issue in excess of exclusion)
const ITEM8_ISSUE = ITEM8_COMMON_BODY('issue') + '\n\n' + SECTION_2513;

// Other: "my issue and [NAMED PERSON IN CAPS]", no Section 2513 paragraph
function buildItem8Other(otherName) {
  const name = (otherName || '').trim().toUpperCase() || '[OTHER PERSON NAME — PLEASE COMPLETE]';
  return ITEM8_COMMON_BODY(`my issue and ${name}`);
}

// ── Replacement logic ─────────────────────────────────────────────────────────

// Matches item 8 in DEFAULT_SPECIAL_PROVISIONS (from \n8) through to just
// before \n9)).  The lazy [\s\S]*? ensures we capture only item 8.
const ITEM8_PATTERN = /\n8\)\t[\s\S]*?(?=\n9\)\t)/;

/**
 * Build the full Special Provisions string for a given gifting variant.
 * Reads DEFAULT_SPECIAL_PROVISIONS and substitutes item 8 as needed.
 * Does NOT modify defaultSpecialProvisions.js.
 *
 * @param {'spouse'|'si'|'issue'|'other'|'none'|null} variant
 * @param {string} [otherName]  Required when variant === 'other'
 * @returns {string}  Complete Special Provisions text
 */
function buildSpecialProvisions(variant, otherName) {
  // S&I is the firm default — no substitution needed
  if (!variant || variant === 'si') {
    return DEFAULT_SPECIAL_PROVISIONS;
  }

  if (variant === 'none') {
    const result = DEFAULT_SPECIAL_PROVISIONS.replace(ITEM8_PATTERN, '');
    if (result === DEFAULT_SPECIAL_PROVISIONS) {
      console.warn('[giftClauses] Could not locate item 8 in DEFAULT_SPECIAL_PROVISIONS; returning default unchanged');
    }
    return result;
  }

  let item8;
  switch (variant) {
    case 'spouse': item8 = ITEM8_SPOUSE; break;
    case 'issue':  item8 = ITEM8_ISSUE;  break;
    case 'other':  item8 = buildItem8Other(otherName); break;
    default:
      console.warn('[giftClauses] Unknown gifting variant "%s"; returning default', variant);
      return DEFAULT_SPECIAL_PROVISIONS;
  }

  const result = DEFAULT_SPECIAL_PROVISIONS.replace(ITEM8_PATTERN, '\n' + item8);
  if (result === DEFAULT_SPECIAL_PROVISIONS) {
    console.warn('[giftClauses] Could not locate item 8 in DEFAULT_SPECIAL_PROVISIONS; returning default unchanged');
  }
  return result;
}

module.exports = { buildSpecialProvisions, buildItem8Other, ITEM8_SPOUSE, ITEM8_ISSUE, SECTION_2513 };
