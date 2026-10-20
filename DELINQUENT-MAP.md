# Accounts Mapping (`dmap.html`)

Nav tab **Accounts Mapping** (permission key still `dmap`, so existing access is kept). Shows accounts as pins on a map (Street or Satellite).

## Reading the map
- Pin colour = months unpaid: amber 1, orange 2, red 3+, grey not stated. Bigger pin = bigger balance.
- Filters: search, Area, Customer type, Months unpaid, Pinned / Not pinned. Counters above the map follow the filters.
- Click a dot (or an account in the list) for name, contract, area, months unpaid, balance, due date, DN/JO status and a **Directions** link (Google Maps). Phone shows only to users who may see the Contact Directory.
- **Export KML** downloads the pins currently shown (no phone numbers) for Google Earth / My Maps.

## Tabs (replaces the payment status filter)
Four tabs above the filters, each with a count (counts follow the other filters):
- **Delinquent**: balance left, nothing paid. Pins coloured by months unpaid.
- **Partially paid**: paid something, balance left. Yellow pin with a small checklist.
- **Fully paid**: paid something, nothing left. Orange pin with a check mark.
- **Unbilled**: no balance and nothing paid. Blue pin with a dash.
The map, list, counters and KML export show the selected tab only. Months unpaid filter applies to Delinquent / Partially paid only.
- Server: `dmap_get` returns every account with `s` (0 delinquent, 1 partial, 2 fully paid, 3 unbilled), `pa`, `t`, `pd`, and `v: 2`. If the page shows "server part is an old version", deploy `netlify/functions/api.js` (identical to `api.js`).

## Sorting (list on the right)
Sort dropdown + arrow button (Asc / Desc): **Months unpaid** (default, high first), **Customer name**, **Balance**, **DN status**, **JO status**. Sorting only reorders the list; the pins on the map do not change.
- DN order (Asc): no DN, then GEN (generated), then OK (delivered). Same GEN/OK day = earlier day first.
- JO order (Asc): no JO, GEN, TENDER, OK (disconnected). Desc reverses it.
- Ties fall back to months unpaid, then balance, then name. Each list row now shows its DN and JO status chips.

## Speed notes
- Pins are grouped into clusters (Leaflet.markercluster, loaded from cdnjs); the cluster colour is the worst months-unpaid inside it. Zoom in or click a cluster to open it; pins on the exact same spot fan out at max zoom.
- Pin icons are cloned from a few shared templates; no CSS filters on pins.
- Filtering only adds / removes the pins that changed; big batches are added in small slices so the page does not freeze.
- Account data is requested while the map libraries load; the list loads more rows as you scroll; off-screen rows are not painted.
- Phones / tablets: no fade or marker zoom animation, smaller tile buffer, tiles load after the move ends. Map height follows the visible screen (dvh).
- If the cluster library cannot load, the map still works without clustering.

## Getting accounts onto the map
Accounts have no coordinates in the masterlist, so each one needs a pin once.
1. **One by one:** click **Place pin** on an account in the list, then click the map, or paste `8.4772, 124.6460` / a Google Maps link and press Set pin. Popup: **Move pin**, **Remove**.
2. **Many at once:** **Import pins** from a `.kml` / `.kmz` (Google Earth or My Maps export), or a `.csv` / `.xlsx` with a `CONTRACT NO.` and/or `CUSTOMER NAME` column plus `LAT` and `LNG` (or one `COORDINATES` column "lat, lng"). In a KML, the placemark name or description must contain the Contract No. (`Contract No: 123456`, or the name is just the number) or the exact customer name. The result tells you how many were not matched.

Pins are saved by **contract number + customer name**, not by row, so they stay after **Load Excel**. Pins for paid accounts are kept and show again if the account becomes delinquent.

## Permissions (Admin page, new row "Accounts Mapping")
- **View:** see the map and list. **Update:** place, move, remove and import pins. Create/Delete do not apply.
- Existing users and Guest start with no access; tick it in Admin.
- Checked again on the server (`dmap_get`, `dmap_set`). Pin changes appear in the Admin change log (map pin set / removed / import).

## Files changed
`dmap.html` (new; later rewritten for speed + sorting, no server change needed), `netlify/functions/api.js` and `api.js` (same patch in both), `auth.js`, nav link in `index.html`, `dnjo.html`, `smsgen.html`, `report.html`, `admin.html`.

## Not tested
Ran the two new server actions against an in-memory store (27 checks: permissions, validation, import matching, pins surviving Load Excel, audit log) and the KML / CSV / coordinate parsing. The page itself was only syntax-checked, not opened in a real browser: check the map, Place pin, Import pins and Export KML after deploying.
