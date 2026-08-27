# OA Tracker

A single-file custom page for TroopWebHost that automatically pulls five reports, cross-references them, and sorts every scout and adult leader into one of five buckets for Order of the Arrow eligibility and First Class advancement — no manual exports, no spreadsheet wrangling.

## What it shows

1. **Eligible now** — rank (scouts only) and both camping-night minimums are already met.
2. **Within reach** — camping nights are short, but the campouts already on the calendar between today and your target date supply enough nights to close the gap. Scouts need First Class or higher to land here; adults have no rank gate.
3. **Camping nights met — needs First Class** — scouts only. Camping requirement is satisfied (or reachable), rank is the only blocker. Shows how many Tenderfoot + Second Class + First Class requirements are still open.
4. **Awaiting Ordeal** — anyone with an OA Election date but no Ordeal date yet, youth and adults alike. Sorted most-urgent first, since **elections expire 18 months after the election date** if the Ordeal isn't completed — past that, the member needs to be elected again. Overdue members are flagged accordingly.
5. **Already in the Order of the Arrow** — fully inducted members, with their OA Honor (Ordeal, Brotherhood, or Vigil — whichever is highest on file) and the date of that most recent honor. Anyone whose current honor is Ordeal-only and at least 6 months old is flagged eligible for Brotherhood.

**A member appears in exactly one section.** Anyone in Awaiting Ordeal — overdue or not — is excluded from every other section; that's their one home until their Ordeal is resolved (or their election expires).

## Installation

1. Open the file and copy its entire contents.
2. In TroopWebHost, go to **Manage Custom Pages**.
3. Create a new Custom Page (or edit an existing one) and paste the whole block into the HTML editor.
4. Save, then open the page.

This only works pasted directly into TroopWebHost's own site (same-origin) — it relies on your logged-in session to fetch reports. It will not work copied into an external site or previewed elsewhere.

## How to use it

1. On load, the page does one read-only check of the OA Eligibility screen and shows you whatever date is currently saved there, pre-filling the date field with it.
2. Change the date if needed — this is the "Compute Eligibility As Of This Date" you want to evaluate against.
3. Click **Pull Reports Automatically**.

## ⚠️ Important: this is not entirely read-only

Clicking **Pull Reports Automatically** re-submits TroopWebHost's own Order of the Arrow Eligibility form to set "Compute Eligibility As Of This Date" to whatever you entered. **This is a real save**, identical to a leader typing that date into the field by hand — it will overwrite that value for anyone else who opens that screen. The Events, Uncompleted Requirements, and Active Roster pulls are plain read-only report links with no side effects.

## What's confirmed vs. inferred

Every report URL below was reverse-engineered from captured network requests, not from official documentation, since TroopWebHost has no public API. Most are confirmed against a real response; one is not:

| Report | Menu_Item_ID | Status |
|---|---|---|
| Scout OA Eligibility | 53654 (Form_ID 8400, BUTTON6) | Confirmed — form fields verified against live page HTML and its client-side JS |
| Adult OA Eligibility | 53654 (Form_ID 8400, BUTTON7) | Confirmed — response columns verified against a real export |
| Uncompleted Requirements | 46046 | Confirmed — response's file name matched exactly |
| Active Roster | 53747 | Confirmed — response's file name matched exactly |
| **Events export** | **53104** | **Not independently confirmed for this troop's account** — carried over from an earlier session's menu HTML. If Sections 2 or 4's "available nights" numbers look wrong, this is the first thing to check. |

If something needs correcting, the values live in one place — search this file for `CONFIG` near the top of the `<script>` block.

## Troubleshooting

- **A pull comes back empty with no error message**: open Tools → Reporting Options on TroopWebHost. If it's set to "PDF only," these report links may return a PDF instead of data, which the parser can't read.
- **Adults come back empty**: the Adult OA Eligibility report's columns were verified once against a real export, but if TroopWebHost changes that report's layout, re-check `ADULT_OA_EXPECTED_COLS` in CONFIG.
- **Events/nights numbers look off**: see the Events export caveat above — verify Menu_Item_ID 53104 is correct for your account by opening "Export Events To Excel" from your own menu and comparing the URL.
- **The date field looks wrong on load**: that's the value *currently saved* on the live OA Eligibility screen, not necessarily your intended target date — it's a starting point, not a recommendation. Change it before pulling.
- **Someone in "Already in the Order of the Arrow" shows "no honor date on file"**: their roster record has `OA Member = Y` but no date in Ordeal, Brotherhood, or Vigil — a real data gap on TroopWebHost, not a bug here. Worth fixing at the source.

## Business rules encoded here (not TroopWebHost defaults)

These were specified during development, not pulled from any report — if BSA or your council changes them, update the code:

- Long-term camping = 5+ nights in a single trip; short-term = 1–4 nights. Eligibility needs at least one qualifying long-term trip and 10+ short-term nights within the window TroopWebHost itself computes for your chosen date.
- Adults: camping requirement only, no rank requirement.
- Ordeal window: 18 months from the OA Election date (`OATRK_ORDEAL_WINDOW_MONTHS` in CONFIG).
- Brotherhood eligibility: 6 full months since the Ordeal date, and no higher honor (Brotherhood or Vigil) already earned (`OATRK_BROTHERHOOD_WAIT_MONTHS` in CONFIG).
