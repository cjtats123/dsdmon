# Delinquent Accounts Mapping (`dmap.html`)

New nav tab **Delinquent Accounts Mapping**. Shows every account with a remaining balance as a dot on a map (Street or Satellite).

## Reading the map
- Dot colour = months unpaid: amber 1, orange 2, red 3+, grey not stated. Bigger dot = bigger balance.
- Filters: search, Area, Customer type, Months unpaid, Pinned / Not pinned. Counters above the map follow the filters.
- Click a dot (or an account in the list) for name, contract, area, months unpaid, balance, due date, DN/JO status and a **Directions** link (Google Maps). Phone shows only to users who may see the Contact Directory.
- **Export KML** downloads the pins currently shown (no phone numbers) for Google Earth / My Maps.

## Getting accounts onto the map
Accounts have no coordinates in the masterlist, so each one needs a pin once.
1. **One by one:** click **Place pin** on an account in the list, then click the map, or paste `8.4772, 124.6460` / a Google Maps link and press Set pin. Popup: **Move pin**, **Remove**.
2. **Many at once:** **Import pins** from a `.kml` / `.kmz` (Google Earth or My Maps export), or a `.csv` / `.xlsx` with a `CONTRACT NO.` and/or `CUSTOMER NAME` column plus `LAT` and `LNG` (or one `COORDINATES` column "lat, lng"). In a KML, the placemark name or description must contain the Contract No. (`Contract No: 123456`, or the name is just the number) or the exact customer name. The result tells you how many were not matched.

Pins are saved by **contract number + customer name**, not by row, so they stay after **Load Excel**. Pins for paid accounts are kept and show again if the account becomes delinquent.

## Permissions (Admin page, new row "Delinquent Accounts Mapping")
- **View:** see the map and list. **Update:** place, move, remove and import pins. Create/Delete do not apply.
- Existing users and Guest start with no access; tick it in Admin.
- Checked again on the server (`dmap_get`, `dmap_set`). Pin changes appear in the Admin change log (map pin set / removed / import).

## Files changed
`dmap.html` (new), `netlify/functions/api.js` and `api.js` (same patch in both), `auth.js`, nav link in `index.html`, `dnjo.html`, `smsgen.html`, `report.html`, `admin.html`.

## Not tested
Ran the two new server actions against an in-memory store (27 checks: permissions, validation, import matching, pins surviving Load Excel, audit log) and the KML / CSV / coordinate parsing. The page itself was only syntax-checked, not opened in a real browser: check the map, Place pin, Import pins and Export KML after deploying.
