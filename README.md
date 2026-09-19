# TroopWebHost
Code to enhance TroopWebHost

## Pages
- **Eagle_Scout_Rank_App_Form** - Fills out the Eagle Scout Rank Application
- **Leaderboard** - A leaderboard of camping nights, service hours, hiking miles, merit badges, etc.
- **Med_Form_Date_Upload** - Takes an export from ScoutBoot Plus and uploads Medical Form dates
- **Merit_Badge_Pocket_cert** - Allows you to print Merit Badge Pocket Certificate from MBs not yet awarded
- **OA_Tracker** - Report to show which Scouts are OA eligible and who needs more camping nights and rank requirements before your next election.
- **Rank_Gap** - Shows all the rank requirements needed up to 1st Class needed by your Scouts, allows you to filter on specific campouts.
- **Swim_Classification** - Prints a Swim Classification Record for the Scouts/Adults signed up for a Campout.
- **Troop Stats** - Generates some statistics about your Troop for the past year.
- **vCard** - Creates a vCard Export of contact information for import into your email client of choice.

## Disclaimer

This is an **unofficial, community-built tool** with no affiliation
to, endorsement by, or support from TroopWebHost. It works by
replicating a handful of TroopWebHost's own internal web requests
(the same ones your browser makes when you click "Open in Excel" or
save a Custom Page) — these are not a published or supported API, and
TroopWebHost could change them at any time without notice, which may
break this tool.

You're responsible for confirming this complies with TroopWebHost's
Terms of Service for your own site before deploying it. Use at your
own risk. No warranty of any kind — see [`LICENSE`](./LICENSE).

The admin-publishing feature reads TroopWebHost's roster export,
which contains sensitive personal information (addresses, medical
details, etc.). Only the minimum data needed (names and numeric
totals) is ever extracted from it, and only when explicitly triggered
by someone who already has legitimate access to that report — but you
should still make sure access to that underlying report is
appropriately restricted on your own site.

## License

MIT — see [`LICENSE`](./LICENSE).
