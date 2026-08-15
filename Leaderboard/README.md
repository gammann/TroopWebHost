# Troop All-Time Leaderboards

This page pulls live and admin-published data straight from your own
TroopWebHost site and renders it as leaderboards (Camping Nights,
Hiking Miles, Service Hours, Backpacking Miles, Cycling Miles,
Paddling Miles, Merit Badges — each with Scout/Adult and
Active/Former/All views).


<img width="421" height="533" alt="image" src="https://github.com/user-attachments/assets/de485f81-6c75-4d15-a3c0-4a85549fcd56" />

The code works by scraping the **Event Participation Summary for Date Range** and the **Export Roster to Excel** reports for the data.  By default only the **Adult Leader** and **Event Planner** roles have access to the **Event Participation Summary for Date Range report**, but you can grant the **View Event Participation Reports** task to other roles, without concern of granting too much access.  The **Export Roster to Excel** report contains more sensitive data, and for that reason, should not be granted to more roles.  By default anyone with the **Rank Advancement** and **Membership** roles should have access to it.

The **Event Participation Summary for Date Range** report contains Total Camping, Total Cabin Camping, Total Service Hours, Total Conservation Hours, Total Hiking Miles, Total Backpacking Miles, Total Cycling Miles, Total Paddling Miles, Total Motor boarding Miles, Total Water Hours, Total Horseback Miles, and Total Skating Miles for anyone who is or has been a member of the Troop.

The **Export Roster to Excel** report contains Camping Nights, Total Hiking Miles, Total Service Hours and Number of Merit Badges for anyone who is or has been a member of the Troop.

With the correct permissions granted to all members, the Active Scout/Adult data, with the exception of Merit Badges is always live, while the Former Scout/Adult and Merit Badge data can be updated by a leader with the correct permissions.  The Former Scout/Adult data can be updated when someone's membership is changed, since their stats will not change once they are a former member or when Active Scouts earn new Merit Badges.

# Setup Guide



You do **not** need any coding tools — everything runs inside
TroopWebHost itself. Setup is mostly pasting the script in and setting
a couple of permissions.

---

## What you'll need

- Admin access to your troop's TroopWebHost site
- Access to Manage Custom Pages
- Someone with the **View Membership Information** and **Web Page
  Editor** tasks (needed to publish former-member and merit-badge
  data — see Step 4)
- A modern browser with DevTools (Chrome, Edge, or Firefox), only
  needed if you set up auto-save (optional) or if something doesn't
  work out of the box


---

## Step 1 — Create the Custom Page

1. In TroopWebHost: **Menu > Home > Manage Custom Pages**, then click
   **Add a New Item.**
2. Give it a name (e.g. Troop Leaderboards), and set the proper Menu
   Sequence for your site.
3. Click **Save & Exit.**
4. Navigate to the new page: **Menu > Home > (your page name, e.g.
   Troop Leaderboards).**
5. In the upper right-hand corner, click the **Gear icon → Edit This
   Page.**
6. Click the **plus sign** to add a new section.
7. Leave the Type as **My Content**, set the other options as you
   wish, and click **OK.**
8. When the editor pops up, don't paste the code here — just hit
   **Save.**
9. Click **Source.**
10. Paste the entire script into the content box.
11. Click **Save.**
12. In the upper right-hand corner, click the **Gear icon → Exit Page
    Edit.**

Open the page and confirm the 6 live categories load with real
numbers. If something's wrong, open the browser console (F12) — error
messages there will point at what failed.

## Step 2 — Set up Auto-Save

Auto-save writes refreshed former-member/merit-badge data directly
back into this Custom Page's saved source, instead of copying and
pasting it in manually. It needs one more site-specific value:
`SELF_SECTION_ID`.

1. Manually edit this Custom Page once (follow Step 1, 4–5).
2. With DevTools Network tab recording, save the page.
3. Find the **POST to `formCustomEdit.aspx`** with
   `Selected_Action=SaveContentEdit` in its form data.
4. Copy the `SelectedSectionID` value from that request into
   `SELF_SECTION_ID` near the top of the script.
5. `SELF_FORM_ID` is likely the same `"7323"` across all TroopWebHost
   sites (it's part of the platform, not your data) — but confirm
   against the same request just in case.

 <img width="749" height="506" alt="image" src="https://github.com/user-attachments/assets/14df8a94-445b-4745-9b24-0b4857db6427" />



If you'd rather skip this, that's fine — the manual copy/paste flow
in Step 4 always works as a fallback regardless.

## Step 3 — Grant permission for live data

Everyone who should see the live (Active) leaderboard data needs the
**View Event Participation Reports** task:

**Menu > Administration > Security Configuration > Assign Tasks to
Roles**

Add the **View Event Participation Reports** task to both the
**Adult** and **Scout** roles (or whichever roles you want to have
access).

## Step 4 — Publish former-member and merit-badge data

1. Anyone with the **View Membership Information** and **Web Page
   Editor** tasks can do this.
2. Open the page, scroll down, and open **Admin: Publish former
   member data.**
3. Click **Generate.**
4. Either click **Save this to the page now** to publish
   automatically, or copy the code shown and paste it over the
   `FORMER_SNAPSHOT_DATE` / `FORMER_SNAPSHOT_DATA` lines near the top
   of the script yourself, then save.

Repeat this periodically (whenever membership changes) — there's no
automatic refresh schedule.

<img width="392" height="200" alt="image" src="https://github.com/user-attachments/assets/f5491d2a-a531-41ad-90fd-99d30d948abb" />
<img width="367" height="179" alt="image" src="https://github.com/user-attachments/assets/2a0a9217-a6cb-404b-a1c3-dc12d6a256c1" />
<img width="373" height="313" alt="image" src="https://github.com/user-attachments/assets/1138b0eb-ff8b-43f9-a8d0-770a60dc3b78" />


---

## Quick troubleshooting

| Symptom | Likely cause |
|---|---|
| Everything blank, error shown | The viewer lacks the View Event Participation Reports permission (Step 3), or one of the Known site-wide values doesn't match your site — see below |
| Former tab always empty | Nobody's published former-member data yet (Step 4) |
| Merit Badges tab always empty | Same as above — Merit Badges is published only, not live |
| Auto-save button fails | `SELF_SECTION_ID` or `SELF_FORM_ID` is wrong, or the page was recreated since you found it — use the manual copy/paste fallback instead |
| Admin panel doesn't appear at all | Your account doesn't have the tasks listed in Step 4 — this is intentional, only permitted accounts see it |

### If a Known site-wide value doesn't match your site

1. Open your browser's DevTools → Network tab, and make sure it's
   recording.
2. Navigate to the relevant report (see the menu paths above), submit
   a date range if asked, and click **Open in Excel.**
3. For the Event Participation report: find the **POST to
   `FormDetail.aspx`** and check its `Menu_Item_ID`, `Form_ID`, and
   the `ENTRY...` field names for your start/end dates against
   `MENU_ITEM_ID`, `FORM_ID_DATE_SUBMIT`, `DATE_FIELD_START`, and
   `DATE_FIELD_END`. Then find the **GET to
   `FormReportMultiSection.aspx`** and check its `Form_ID` against
   `FORM_ID_REPORT`.
4. For the roster export: check the `Menu_Item_ID` in the
   `FormReport.aspx` URL against `ROSTER_MENU_ITEM_ID`.

---

## Known site-wide values

These report IDs appear to be the same across every TroopWebHost
site, not specific to any one troop — they're already set correctly
in the script, so you shouldn't need to touch them:

| Variable | Value | Report |
|---|---|---|
| MENU_ITEM_ID | 46097 | Event Participation Summary For Date Range |
| FORM_ID_DATE_SUBMIT | 2775 | same report — date-range form |
| FORM_ID_REPORT | 2776 | same report — resulting summary |
| DATE_FIELD_START | 5697516 | same report — start-date field |
| DATE_FIELD_END | 5697616 | same report — end-date field |
| ROSTER_MENU_ITEM_ID | 45897 | Export Roster to Excel |

If live data doesn't load after Step 1 below, that's the first thing
to check — see Troubleshooting at the end for how to verify these on
your own site.

For reference, the two reports these power are always in the same
place in TroopWebHost's menus:

- **Menu > Calendar > Event Reports > Event Participation Summary for
  Date Range**
- **Menu > Membership > Export Membership Data > Export Roster to
  Excel** (not the Active-only version — you want the one that
  includes everyone)

⚠️ **The roster export contains sensitive personal information** —
addresses, medical details, driver's license numbers, etc. Make sure
whoever has access to it on your site is appropriately restricted
(normally just troop leadership). The code only ever extracts name +
a few numeric totals from it, and only when someone with the right
tasks explicitly runs the publish action — but the underlying report
access itself should stay tightly controlled on your end regardless.
