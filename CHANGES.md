# Changes in this update

## Security
- `.gitignore` added (blocks .xlsx / .xlsm / .xls / .csv / .zip / .env / node_modules).
- Default `admin` / `admin` now forces a password change on first sign-in (`chpw`); every other action is blocked until it is changed.
- New and reset passwords: 8+ characters, not obvious.
- Sign-in lock after 5 wrong passwords (15 minutes, per address + username).
- Guest starts with no access (existing guest settings are not changed: untick them in Admin).
- Optional `ADMIN_PASSWORD` environment variable for the very first admin password.

## Text button (was not connected)
- `sms.js` is now loaded by `index.html` and `admin.html`.
- `api.js`: new permission `sms`, actions `sms_get`, `sms_mark` (need Contact Directory view + Send text) and `sms_cfg` (admin).
- `auth.js` / Admin: "Send text" permission row; Admin "Text message" card with live preview.
- Text column added to the summary table, the Excel-format grid and the Contact Directory.

## Change log and backups
- Change log of account edits (Admin page).
- Automatic backup before Load Excel and before a restore; manual Back up now; Restore (Admin page).

## Not changed (still open)
- Two people saving at the same second can still overwrite each other (the account list is saved as one block).
- `netlify/functions/ai.mjs` is unused; delete it or build the AI page.
- One payment per account (no installment history).
- A reset password does not log out sessions that are already open (they expire after 12 hours).

## Tested
- `api.js` run against an in-memory store: 34 checks (forced password change, lockout, guest default, backups/restore, change log, Text permissions and actions, admin-only actions) all passed.
- `sms.js` phone cleanup, eligibility and preview checked; all page scripts pass a syntax check.
- NOT tested: a real phone opening the SMS app, and the pages in a real browser. Test on Android and iPhone after deploying.

## Text message card moved
- The Text button message editor moved from Admin to EMAIL/SMS Generator > Templates (section 4, own Save button).
- `sms_cfg` now needs Edit on EMAIL/SMS generator (admin still always allowed); `gen_get` also returns the Text message.
- `admin.html` no longer has the card or loads `sms.js`; `smsgen.html` loads `sms.js` for the preview.

## Generator input format + spacing + rename
- EMAIL/SMS generator now reads the 12-column Excel row (CUSTOMER NAME … REMAINING BALANCE); amount = REMAINING BALANCE, shown with 2 decimals. Header row optional; tab-separated (empty PAYMENT DATE ok) or space-separated.
- Email and SMS spacing is now applied by the builder (one blank line between header / accounts / footer).
- "SMS Generator" tab and "SMS / Email generator" permission renamed to "EMAIL/SMS Generator" / "EMAIL/SMS generator".

## Unpaid list in the EMAIL/SMS Generator
- New server action `gen_accounts` (needs View on EMAIL/SMS generator): unpaid accounts only, name / contract / months / due date / remaining balance. No contact details are sent.
- `smsgen.html`: searchable Unpaid list sorted by name with tick boxes, Add all shown, Clear selection; selection feeds the email/SMS. Paste-from-Excel kept in a collapsible box.

## Open SMS app button
- EMAIL/SMS Generator: **Open SMS app** opens the Android / iPhone SMS app with number + message prefilled and copies the message. Number auto-fills from ticked accounts when they share one number; `gen_accounts` returns phone numbers only to users with Contact Directory View. `sms.js` now exports `link()`.

## Admin: download Excel
- Admin > Backups now has a **Download Excel** button next to Back up now. It downloads all accounts as ACCOUNTS_MASTERLIST_<date>.xlsx (sheet MONITORING FOR CODE, all 24 columns, same as Export to Excel in the Accounts grid), and the file can be loaded again with Load Excel.
- Only `admin.html` changed. The button is on the Admin page, so it is admin-only (the page itself is admin-only and the server only returns the data to a signed-in user).

## Collections: 2 tabs
- Collections page now has two sub-tabs: **Collection (PHP)** (the existing peso dashboard: billed, collected, uncollected, rate, charts) and **Collection Report** (account counts in the same style as the Generate report page).
- Collection Report: Total accounts monitored, overall % breakdown (Fully paid, Partial, Overpaid, No bill, 1-month, 2+ months), pie chart, stacked bar by segment (Power, Schools, Streetlights, Net Metering) and a per-segment table with totals.
- Same status tags and the same 1-month / 2+ months rule (MONTHS UNPAID) as report.html. Counts include accounts with no bill.
- The Area / Customer type / Rate schedule filters apply to both tabs. The Month paid selector only applies to the PHP tab.
- Files changed: `index.html`, `theme.css`. Not tested in a real browser (syntax-checked only).
