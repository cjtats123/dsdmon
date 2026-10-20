# DN / Job Order menu

New page `dnjo.html` (nav tab **DN / Job Order**). It reads and writes the existing **DN/ODAA** (DN status) and **JOB-ORDER** (JO status) columns, so the Excel export/import and the Accounts grid stay in sync.

## Status format
| Column | Code | Meaning |
|---|---|---|
| DN | `GEN 18` | DN generated on the 18th |
| DN | `OK 18` | DN delivered on the 18th |
| JO | `GEN 18` | JO generated on the 18th |
| JO | `OK 18` | JO accomplished (disconnected) on the 18th |
| JO | `TENDER 18` | Payment tendered on the 18th |

The number is the day of the month; the month is the one chosen at the top of the page (defaults to the current month). If a cell holds several codes, the last one counts.

## Tender rule
When JO = `TENDER d`, the JO gets **one more working day** as allowance and is **redelivered**: the page shows "Redeliver JO" on the next working day (Mon-Fri) after the tender date (Friday tender -> Monday). Holidays are not accounted for. After the JO is redelivered, update the cell (e.g. `OK 20` once disconnected, or Clear).

## What the page offers
- Month, search, Area and status filters (no DN yet, DN generated/delivered, JO generated/disconnected, tendered, for redelivery).
- Counters: DN generated, DN delivered, JO generated, JO disconnected, Tendered.
- "JO next step" column: For DN / Deliver DN / Ready for JO / For disconnection / Disconnected / Redeliver date.
- Click a DN or JO cell -> pick GEN / OK / TENDER (TENDER only for JO) + day -> Save or Clear.

## Permissions
New feature **DN / Job Order** in Admin: View = see the page, Update = change DN/JO status. Create/Delete do not apply. Admin has everything; existing users and guest start with no access, so tick it in Admin. Server action `dnjo_set` re-checks permission and only accepts `GEN|OK|TENDER` + day 1-31 (TENDER not allowed for DN), touching only those two columns.

## Files changed
`dnjo.html` (new), `netlify/functions/api.js`, `auth.js`, `index.html`, `admin.html`, `report.html` (nav + permission), `README.md`.
