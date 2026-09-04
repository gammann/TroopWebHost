# Troop All-Time Leaderboards

A self-contained page for TroopWebHost troop sites that shows
leaderboards for Camping Nights, Hiking Miles, Service Hours, Conservation Hours
Backpacking Miles, Cycling Miles, Paddling Miles, and Merit Badges —
split by Scout/Adult and Active/Former/All.

It runs entirely inside TroopWebHost as a Custom Page. Seven categories
update live on every page load; Merit Badges and former-member data
are published periodically by a leader through a built-in admin panel
(no addresses, medical info, or other sensitive fields ever leave
that action — just names and totals).

<p align="center">
<img width="421" height="533" alt="image" src="https://github.com/user-attachments/assets/de485f81-6c75-4d15-a3c0-4a85549fcd56" />
</p>


The code works by scraping the **Event Participation Summary for Date Range** and the **Export Roster to Excel** reports for the data.  By default only the **Adult Leader** and **Event Planner** roles have access to the **Event Participation Summary for Date Range report**, but you can grant the **View Event Participation Reports** task to other roles, without concern of granting too much access.  The **Export Roster to Excel** report contains more sensitive data, and for that reason, should not be granted to more roles.  By default anyone with the **Rank Advancement** and **Membership** roles should have access to it.

The **Event Participation Summary for Date Range** report contains Total Camping, Total Cabin Camping, Total Service Hours, Total Conservation Hours, Total Conservation Hours, Total Hiking Miles, Total Backpacking Miles, Total Cycling Miles, Total Paddling Miles, Total Motor boarding Miles, Total Water Hours, Total Horseback Miles, and Total Skating Miles for anyone who is or has been a member of the Troop.

The **Export Roster to Excel** report contains Camping Nights, Total Hiking Miles, Total Service Hours and Number of Merit Badges for anyone who is or has been a member of the Troop.  This also has date that someone left the troop, thus being able to determine who is a current and who is a former member.

With the correct permissions granted to all members, the Active Scout/Adult data, with the exception of Merit Badges is always live, while the Former Scout/Adult and Merit Badge data is updated when a leader with the correct permissions loads the page.  The Former Scout/Adult data only needs to be updated when someone's membership is changed, since their stats will not change once they are a former member, or when Active Scouts earn new Merit Badges.

This code uses [SheetJS](https://sheetjs.com/) to parse Excel reports exported from TroopWebHost.

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
pasting it in manually. It needs one site-specific value:
`SELF_SECTION_ID`.  Each section on every custom page has a unique id called the `SelectedSectionID`.  You will need to find this for the section you have pasted the Leaderboard code in, so that the Auto-Save function can update it.

1. Manually edit the Leaderboard Page once.
2. Navigate to the new page: **Menu > Home > (your page name, e.g.
   Troop Leaderboards).**
3. In the upper right-hand corner, click the **Gear icon → Edit This
   Page.**
4. Click **Source** for Leaderboard section.
5. Open the Developer Tools for your browser (Edge/Chrome/Firefox **Ctrl+Shift+I**, Safari **Cmd + Option + I**).
6. Select the Network tab in Developer Tools, ensure it's recording, click **Save** on the Leaderboard section.
7. Find the **POST to `formCustomEdit.aspx`** with
   `Selected_Action=SaveContentEdit` in its form data.
8. Find the `SelectedSectionID` value from that request, typical a 3 digit number (depending on the number of custom sections on your site).

    <img width="749" height="506" alt="image" src="https://github.com/user-attachments/assets/14df8a94-445b-4745-9b24-0b4857db6427" />
    
9. Click **Source** for Leaderboard section.
10. Find `SELF_SECTION_ID` near the top of the script, and enter the number from Step 8.
11. Save the page.




If you'd rather skip this, that's fine — the manual copy/paste flow
in Step 4 always works as a fallback regardless.

## Step 3 — Grant permission for live data

Everyone who should see the live (Active) leaderboard data needs the
**View Event Participation Reports** task:

**Menu > Administration > Security Configuration > Assign Tasks to
Roles**

Assign the **View Event Participation Reports** task to both the
**Adult** and **Scout** roles (or whichever roles you want to have
access).

## Step 4 — Publish former-member and merit-badge data

When anyone with **View Membership Information** and **Web Page Editor** tasks opens the page, it will automatically update the former member and merit badge data provided you followed **Step 2 — Set up Auto-Save**.  You only need to do the below steps, if you do not do **Step 2 — Set up Auto-Save** and you want to update the leaderboard manually for former members.  Do do that you can follow these steps:

1. Open the Leaderboard page, scroll down, and open **Admin: Publish former
   member data.**
   
<img width="404" height="172" alt="image" src="https://github.com/user-attachments/assets/f89f8002-3121-4d08-8d80-29329bbe6987" />

2. Click **Generate.**
   
<img width="398" height="161" alt="image" src="https://github.com/user-attachments/assets/872889fd-927d-490d-a0ca-a96491d92b66" />

3. Either click **Save this to the page now** to publish
   automatically, or copy the code shown and paste it over the
   `FORMER_SNAPSHOT_DATE` / `FORMER_SNAPSHOT_DATA` lines near the top
   of the script yourself, then save.

 <img width="386" height="290" alt="image" src="https://github.com/user-attachments/assets/5e940e8c-c542-4e63-955b-e488ee674a07" />



Repeat this periodically (whenever membership changes) — there's no
automatic refresh schedule.





---

## Quick troubleshooting

| Symptom | Likely cause |
|---|---|
| Everything blank, error shown | The viewer lacks the View Event Participation Reports permission (Step 3), or one of the Known site-wide values doesn't match your site — see below |
| Former tab always empty | Nobody's published former-member data yet (Step 4) |
| Merit Badges tab always empty | Same as above — Merit Badges is published only, not live |
| Auto-save button fails | `SELF_SECTION_ID` or `SELF_FORM_ID` is wrong, or the page was recreated since you found it — use the manual copy/paste fallback instead |
| Admin panel doesn't appear at all | Your account doesn't have the tasks listed in Step 4 — this is intentional, only permitted accounts see it |


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


If live data doesn't load, that's the first thing
to check — see Troubleshooting  for how to verify these on
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
