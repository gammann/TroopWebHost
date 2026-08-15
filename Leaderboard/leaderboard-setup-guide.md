# Troop All-Time Leaderboards — Setup Guide for Other Sites

This page pulls live and admin-published data straight from your own
TroopWebHost site and renders it as leaderboards (Camping Nights,
Hiking Miles, Service Hours, Backpacking Miles, Cycling Miles,
Paddling Miles, Merit Badges — each with Scout/Adult and
Active/Former/All views).

It was built against one specific troop's TroopWebHost site. **A
handful of values in the script are specific to that site and will
not work on yours until you replace them.** This guide walks through
finding your own values and getting the page installed.

---

## What you'll need

- Admin access to your troop's TroopWebHost site
- Access to **Manage Custom Pages**
- Someone with access to the **"Export Roster to Excel"** report (for
  publishing former-member and merit-badge data — see below)
- A modern browser with DevTools (Chrome, Edge, or Firefox) to capture
  a couple of network requests during setup

You do **not** need any coding tools — everything runs inside
TroopWebHost itself. You're just editing a handful of values near the
top of the script.

---

## Step 1 — Find your report's Menu_Item_ID and Form_IDs

The leaderboard's 6 live categories (everything except Merit Badges)
come from the **"Event Participation Summary For Date Range"**
report. It's always in the same place on every TroopWebHost site
(site administrators can't move or reconfigure it):

**Menu > Calendar > Event Reports > Event Participation Summary for
Date Range**

The report itself is standardized, but the numeric IDs behind it are
specific to your site's install, so you still need to capture them:

1. Open your browser's DevTools → **Network** tab, and make sure
   it's recording.
2. Navigate to the report above, set a date range (any range), submit
   it, then click **"Open in Excel."**
3. In the Network tab, find the **POST request to `FormDetail.aspx`**
   that fired when you submitted the date range. Look at its form
   data (sometimes called "Payload") for these fields:

   | Field in the request | Goes into this variable |
   |---|---|
   | `Menu_Item_ID` | `MENU_ITEM_ID` |
   | `Form_ID` | `FORM_ID_DATE_SUBMIT` |
   | The field name starting with `ENTRY` for your start date (e.g. `ENTRY5697516`) | the numeric suffix goes into `DATE_FIELD_START` |
   | The field name starting with `ENTRY` for your end date | the numeric suffix goes into `DATE_FIELD_END` |

4. Then find the **GET request to `FormReportMultiSection.aspx`**
   that fired when you clicked "Open in Excel." Its URL will look
   like:
   ```
   FormReportMultiSection.aspx?Menu_Item_ID=XXXXX&Form_ID=YYYYY&Stack=2&ID=1&FK=0&ReportFormat=XLS
   ```
   Take the `Form_ID` value from **this** URL — it goes into
   `FORM_ID_REPORT` (it's usually one number higher than
   `FORM_ID_DATE_SUBMIT`, but confirm from the real request).

   `RECORD_ID` and `RECORD_FK` usually stay `"1"` and `"0"` — but
   confirm against the same URL just in case.

## Step 2 — Find your roster export's Menu_Item_ID

This report ("Export Roster to Excel") powers the admin-only
publishing panel — it's what tracks former members and merit badge
counts. Its location is always:

**Menu > Membership > Export Membership Data > Export Roster to
Excel**

(Note: this is different from "Export **Active** Roster to Excel" —
you want the one that includes everyone.)

1. Right-click that link → Copy Link, or check the Network tab when
   you click it.
2. The URL looks like `FormReport.aspx?Menu_Item_ID=XXXXX&Stack=1&ReportFormat=XLS`
   — that `Menu_Item_ID` goes into `ROSTER_MENU_ITEM_ID`.

⚠️ **This report contains sensitive personal information** —
addresses, medical details, driver's license numbers, etc. Make sure
whoever has access to it on your site is appropriately restricted
(normally just troop leadership). The code only ever extracts name +
a few numeric totals from it, and only when an admin explicitly runs
the publish action — but the underlying report access itself should
stay tightly controlled on your end regardless.

## Step 3 — Create the Custom Page

1. In TroopWebHost: **Menu > Home > Manage Custom Pages**, then click
   **"Add a New Item."**
2. Give it a name (e.g. "Troop Leaderboards"), and set the proper
   Menu Sequence for your site.
3. Click **"Save & Exit."**
4. Navigate to the new page: **Menu > Home > (your page name, e.g.
   "Troop Leaderboards").**
5. In the upper right-hand corner, click the **Gear icon → Edit This
   Page.**
6. Click the **plus sign** to add a new section.
7. Leave the Type as **"My Content"**, set the other options as you
   wish, and click **OK.**
8. When the editor pops up, don't paste the code here — just hit
   **Save.**
9. Click **Source.**
10. Paste the entire script into the content box.

## Step 4 — Grant permission for live data

Everyone who should see the live (Active) leaderboard data needs the
**"View Event Participation Reports"** task:

**Menu > Administration > Security Configuration > Assign Tasks to
Roles**

Add the **"View Event Participation Reports"** task to both the
**Adult** and **Scout** roles (or whichever roles you want to have
access).

## Step 5 — Update the config values

Near the top of the script, find the block marked
`// ---- CONFIGURE THIS ------------------------------------------------`
and replace the values with what you found in Steps 1–2:

```js
var MENU_ITEM_ID = "..."; // from Step 1
var FORM_ID_DATE_SUBMIT = "...";
var FORM_ID_REPORT = "...";
var DATE_FIELD_START = "...";
var DATE_FIELD_END = "...";
...
var ROSTER_MENU_ITEM_ID = "..."; // from Step 2
```

Click **Save.** In the upper right-hand corner, click the **Gear icon
→ Exit Page Edit.**

Open the page and confirm the 6 live categories load with real
numbers. If something's wrong, open the browser console (F12) — error
messages there will point at what failed.

## Step 6 — Publish former-member and merit-badge data

1. As someone with roster-export access, open the page.
2. Scroll down, open **"Admin: Publish former member data."**
3. Click **Generate.**
4. Either click **"Save this to the page now"** to publish
   automatically, or copy the code shown and paste it over the
   `FORMER_SNAPSHOT_DATE` / `FORMER_SNAPSHOT_DATA` lines near the top
   of the script yourself, then save.

Repeat this periodically (whenever membership changes) — there's no
automatic refresh schedule.

### If you want auto-save to work

Auto-save writes the refreshed data directly back into this Custom
Page's saved source, instead of you copying and pasting. It needs one
more site-specific value: `SELF_SECTION_ID`.

1. Manually edit this Custom Page once (Manage Custom Pages → open it
   → edit the content section).
2. With DevTools Network tab recording, save the page.
3. Find the **POST to `formCustomEdit.aspx`** with
   `Selected_Action=SaveContentEdit` in its form data.
4. Copy the `SelectedSectionID` value from that request into
   `SELF_SECTION_ID` near the top of the script.
5. `SELF_FORM_ID` is likely the same `"7323"` across all TroopWebHost
   sites (it's part of the platform, not your data) — but confirm
   against the same request just in case.

If you'd rather skip this, that's fine — the manual copy/paste flow
in Step 6 always works as a fallback regardless.

---

## Quick troubleshooting

| Symptom | Likely cause |
|---|---|
| Everything blank, error shown | Wrong `MENU_ITEM_ID`/`FORM_ID` values, or the viewer lacks "View Event Participation Reports" permission (Step 4) |
| Former tab always empty | Nobody's published former-member data yet (Step 6) |
| Merit Badges tab always empty | Same as above — Merit Badges is admin-published only, not live |
| Auto-save button fails | `SELF_SECTION_ID` or `SELF_FORM_ID` is wrong, or the page was recreated since you found it — use the manual copy/paste fallback instead |
| Admin panel doesn't appear at all | Your account doesn't have access to the roster export — this is intentional, only roster-export-permitted accounts see it |
