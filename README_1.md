# TroopWebHost All-Time Leaderboards

A self-contained page for TroopWebHost troop sites that shows
leaderboards for Camping Nights, Hiking Miles, Service Hours,
Backpacking Miles, Cycling Miles, Paddling Miles, and Merit Badges —
split by Scout/Adult and Active/Former/All.

It runs entirely inside TroopWebHost as a Custom Page. Six categories
update live on every page load; Merit Badges and former-member data
are published periodically by a leader through a built-in admin panel
(no addresses, medical info, or other sensitive fields ever leave
that action — just names and totals).

## Setup

See [`leaderboard-setup-guide.md`](./leaderboard-setup-guide.md) for
full install instructions, including the specific TroopWebHost menu
paths and permissions to set up.

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
