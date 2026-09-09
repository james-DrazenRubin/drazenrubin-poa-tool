/*
 * powersText.js — Single source of truth for the 24 POA powers.
 *
 * The legal text below is reproduced VERBATIM from the firm's Connecticut
 * Statutory Durable Power of Attorney (Long Form). Do NOT paraphrase, shorten,
 * or reformat any `text` value. Legal updates happen here and nowhere else.
 *
 * `letter` is the statutory subdivision label (A–N standard, O–X estate) and is
 * FIXED per power — the engine keeps a power's original letter even when other
 * powers are omitted, so legal cross-references stay correct.
 *
 * The template renders each selected power as:  ({{letter}})   {{text}}
 * so `text` intentionally does NOT include the leading "(A)" label.
 */
'use strict';

// PART 1 — STANDARD POWERS (A–N)
const STANDARD_POWERS = [
  { id: 'real_property',              letter: 'A', label: 'Real Property',                               text: `Real Property` },
  { id: 'tangible_personal',          letter: 'B', label: 'Tangible Personal Property',                  text: `Tangible personal property;` },
  { id: 'stocks_bonds',               letter: 'C', label: 'Stocks and Bonds',                            text: `Stocks and bonds;` },
  { id: 'commodities_options',        letter: 'D', label: 'Commodities and Options',                     text: `Commodities and options;` },
  { id: 'banks',                      letter: 'E', label: 'Banks and Other Financial Institutions',      text: `Banks and other financial institutions;` },
  { id: 'operation_business',         letter: 'F', label: 'Operation of Entity or Business',             text: `Operation of entity of business;` },
  { id: 'insurance_annuities',        letter: 'G', label: 'Insurance and Annuities',                     text: `Insurance and annuities;` },
  { id: 'estates_trusts',             letter: 'H', label: 'Estates, Trusts and Other Beneficial Interests', text: `Estates, trusts and other beneficial interests` },
  { id: 'claims_litigation',          letter: 'I', label: 'Claims and Litigation',                       text: `Claims and litigation;` },
  { id: 'personal_family_maintenance', letter: 'J', label: 'Personal and Family Maintenance',            text: `Personal and family maintenance;` },
  { id: 'governmental_benefits',      letter: 'K', label: 'Benefits from Governmental Programs or Civil/Military Service', text: `Benefits from governmental programs or civil or military service` },
  { id: 'retirement_plans',           letter: 'L', label: 'Retirement Plans',                            text: `Retirement plans;` },
  { id: 'taxes',                      letter: 'M', label: 'Taxes',                                       text: `Taxes` },
  { id: 'all_other_matters',          letter: 'N', label: 'All Other Matters',                           text: `All other matters;` }
];

// PART 2 — OPTIONAL ESTATE PLANNING POWERS (O–X)
const ESTATE_PLANNING_POWERS = [
  {
    id: 'inter_vivos_trust', letter: 'O',
    label: 'Create/Amend/Revoke Inter Vivos Trust',
    text: `Create, amend, revoke or terminate an inter vivos trust, provided in the case of a trust established for a disabled person pursuant to 42 USC 1396p (d)(4)(A) or 42 USC 1396p (d)(4)(C), the creation of such trust by an agent shall be only as permitted by federal law;`
  },
  {
    id: 'make_gift', letter: 'P',
    label: 'Make a Gift',
    text: `Make a gift, subject to the limitations of the Connecticut Uniform Power of Attorney Act and any special instructions in this power of attorney. Unless otherwise provided in the special instructions, gifts per recipient may not exceed the annual dollar limits of the federal gift tax exclusion under Internal Revenue Code Section 2503(b), or if the principal’s spouse agrees to consent to a split gift pursuant to Internal Revenue Code Section 2513, in an amount per recipient not to exceed twice the annual federal gift tax exclusion limit. In addition, an agent must determine that gifts are consistent with the principal’s objectives if actually known by the agent and, if unknown, as the agent determines is consistent with the principal’s best interest based on all relevant factors;`
  },
  {
    id: 'rights_survivorship', letter: 'Q',
    label: 'Create or Change Rights of Survivorship',
    text: `Create or change rights of survivorship;`
  },
  {
    id: 'beneficiary_designation', letter: 'R',
    label: 'Create or Change a Beneficiary Designation',
    text: `Create or change a beneficiary designation;`
  },
  {
    id: 'waive_survivor_annuity', letter: 'S',
    label: 'Waive Survivor Annuity',
    text: `Waive the principal’s right to be a beneficiary of a joint and survivor annuity, including a survivor benefit under a retirement plan;`
  },
  {
    id: 'authorize_another', letter: 'T',
    label: 'Authorize Another Person',
    text: `Authorize another person to exercise the authority granted under this power of attorney.`
  },
  {
    id: 'disclaim_interest', letter: 'U',
    label: 'Disclaim or Refuse an Interest',
    text: `Disclaim or refuse an interest in property, including a power of appointment;`
  },
  {
    id: 'fiduciary_powers', letter: 'V',
    label: 'Exercise Fiduciary Powers',
    text: `Exercise fiduciary powers that the principal has authority to delegate`
  },
  {
    id: 'digital_assets', letter: 'W',
    label: 'Digital Assets and Devices',
    text: `Exercise all powers I may have over any digital device, digital asset, user account and electronically stored information, including any user account and digital asset that currently exists or may exist as technology develops, whether the same is in my own name or that I own or lawfully use jointly with any other individual; such powers include, but are not limited to, changing and circumventing my username and password to gain access to such user accounts and information; transferring or withdrawing funds or other digital assets among or from such user accounts; opening new user accounts in my name; all as my agent determines is necessary or advisable.  I hereby give my lawful consent and fully authorize my agent to access, manage, control, delete and terminate any electronically stored information and communications of mine to the fullest extent allowable under the federal Electronic Communications Privacy Act of 1986, 18 USC 2510 et seq., as amended from time to time, the Connecticut Revised Uniform Fiduciary Access to Digital Assets Act and any other federal, state or international privacy law or other law and to take any actions I am authorized to take under all applicable terms of service, terms of use, licensing and other account agreements or laws.  To the extent a specific reference to any federal, state, local or international law is required in order to give effect to this provision, I specifically provide that my intention is to so reference such law, whether such law is now in existence or comes into existence or is amended after the date of this document.`
  },
  {
    id: 'intellectual_property', letter: 'X',
    label: 'Intellectual Property',
    text: `With respect to any intellectual property interests of mine, including, without limitation, copyrights, contracts for payments of royalties and trademarks, act in all ways with respect to such interests as if my agent were the owner thereof, including, without limitation, registering ownership, transferring ownership and recording documents to effectuate or memorialize such transfer, granting and revoking licenses, entering, terminating and enforcing agreements, defending ownership and conferring agency upon professionals to represent my interests before governmental agencies, and in general, to exercise all powers with respect to the intellectual property that I could exercise if present.`
  }
];

module.exports = { STANDARD_POWERS, ESTATE_PLANNING_POWERS };
