# OA Tracker

A single-file custom page for TroopWebHost that automatically pulls five reports, cross-references them, and sorts every scout and adult leader into one of six buckets for Order of the Arrow eligibility and First Class advancement — no manual exports, no spreadsheet wrangling.

Official OA eligibility requirements: [oa-scouting.org/about/membership](https://oa-scouting.org/about/membership) — a link to this also appears near the top of the page itself.

## What it shows

1. **Eligible now** — scouts only. Rank and both camping-night minimums are already met.
2. **Within reach** — scouts already First Class or higher whose camping nights are short, but the campouts already on the calendar between today and your target date supply enough nights to close the gap.
3. **Camping nights met — needs First Class** — scouts only. Camping requirement is satisfied (or reachable), rank is the only blocker. Shows how many Tenderfoot + Second Class + First Class requirements are still open.
4. **Awaiting Ordeal** — anyone with an OA Election date but no Ordeal date yet, youth and adults alike. Sorted most-urgent first, since **elections expire 18 months after the election date** if the Ordeal isn't completed — past that, the member needs to be elected again. Overdue members are flagged accordingly.
5. **Already in the Order of the Arrow** — fully inducted members, with their OA Honor (Ordeal, Brotherhood, or Vigil — whichever is highest on file) and the date of that most recent honor. Anyone whose current honor is Ordeal-only and at least 6 months old is flagged eligible for Brotherhood.
6. **Adults with camping nights in this window** — informational only, not a pass/fail list. Adults no longer have a camping-night threshold under current OA rules, so this just surfaces every adult with any camping nights logged in the 2-year window, most-nights-first, as a starting point for discussion rather than a determination.

**A member appears in exactly one section.** Anyone in Awaiting Ordeal — overdue or not — is excluded from every other section; that's their one home until their Ordeal is resolved (or their election expires). Section 6 also excludes anyone already shown in Section 4 or 5.

<img width="836" height="1123" alt="image" src="https://github.com/user-attachments/assets/0a6c06ce-6571-4829-95d9-b47b6b7a1bad" />



<img width="799" height="870" alt="image" src="https://github.com/user-attachments/assets/e512ce9b-bcd7-43a4-b7fd-8b2af49a2003" />



<img width="808" height="489" alt="image" src="https://github.com/user-attachments/assets/8d72d506-6183-4359-a08d-07f9a63c7dc3" />


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

## Reports Used

Every report URL below was reverse-engineered from captured network requests, not from official documentation, since TroopWebHost has no public API. 

| Report | Menu_Item_ID | 
|---|---|
| Scout OA Eligibility | 53654 (Form_ID 8400, BUTTON6) | 
| Adult OA Eligibility | 53654 (Form_ID 8400, BUTTON7) | 
| Events export | 53104 | 
| Uncompleted Requirements | 46046 | 
| Active Roster | 53747 | 

If something needs correcting, the values live in one place — search this file for `CONFIG` near the top of the `<script>` block.

## Troubleshooting

- **A pull comes back empty with no error message**: open Tools → Reporting Options on TroopWebHost. If it's set to "PDF only," these report links may return a PDF instead of data, which the parser can't read.
- **Adults come back empty**: the Adult OA Eligibility report's columns were verified once against a real export, but if TroopWebHost changes that report's layout, re-check `ADULT_OA_EXPECTED_COLS` in CONFIG.
- **The date field looks wrong on load**: that's the value *currently saved* on the live OA Eligibility screen, not necessarily your intended target date — it's a starting point, not a recommendation. Change it before pulling.
- **Someone in "Already in the Order of the Arrow" shows "no honor date on file"**: their roster record has `OA Member = Y` but no date in Ordeal, Brotherhood, or Vigil — a real data gap on TroopWebHost, not a bug here. Worth fixing at the source.

## OA Eligibility Requirements:


- Long-term camping = 5+ nights in a single trip; short-term = 1–4 nights. Eligibility needs at least one qualifying long-term trip and 10+ short-term nights within the window TroopWebHost itself computes for your chosen date.
- Adults: no camping-night requirement, must be nominated by the unit committee.  The number of adults nominated can be no more than two-thirds of the number of youth candidates elected.
-  Section 6 is informational, not a determination.
- Ordeal window: 18 months from the OA Election date (`OATRK_ORDEAL_WINDOW_MONTHS` in CONFIG).
- Brotherhood eligibility: 6 full months since the Ordeal date, and no higher honor (Brotherhood or Vigil) already earned (`OATRK_BROTHERHOOD_WAIT_MONTHS` in CONFIG).
