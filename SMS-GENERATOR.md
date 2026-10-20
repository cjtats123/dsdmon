# EMAIL/SMS Generator

Replaces the old per-row **Text** button (which opened the phone's SMS app). Nothing is sent by the website: it prepares the message, and you send it from Outlook, Messenger or your phone.

## Page: `smsgen.html` (nav tab **EMAIL/SMS Generator**)
**1. Generator**
**Unpaid list (no pasting needed):** the left side lists every account with a remaining balance, sorted by name. Type in the search box (name or contract no., e.g. `A Brown`) to narrow it, tick the accounts you want (or **Add all shown**), and they go straight into the email / SMS. Ticks stay when you change the search, so you can add accounts from several searches into one message (many accounts to one number or email). **Remove** in the *Accounts in the message* table or **Clear selection** takes them out. The list shows at most 300 rows at a time; **Refresh** reloads it from Accounts.
Pasting rows from Excel is still available under *Or paste rows from Excel*; pasted rows are added after the ticked ones.

1. Paste the rows copied from the Excel sheet (header row optional), 12 columns: `CUSTOMER NAME, AREA, RATE SCHED, CONTRACT NO., MONTHS UNPAID, DUE DATE, PAYMENT DATE, ARREARS, LATEST BILL AMOUNT, TOTAL BALANCE AMOUNT, PAID AMOUNT, REMAINING BALANCE`
   e.g. `ISON TOWER LTD.INC [tab] 2 [tab] 48 [tab] 5560775 [tab] 1 [tab] 10/20/2026 [tab] [tab] - [tab] 33,688.17 [tab] 33,688.17 [tab] - [tab] 33,688.17`
   The amount used in the message is **REMAINING BALANCE** (shown as 33,688.17). Rows with no remaining balance are skipped with a warning.
2. The preview table shows what was read. Duplicate contract numbers and bad lines are skipped with a warning.
3. **Open SMS app** opens Messages on Android / iPhone with the number and the generated SMS filled in (the message is also copied to the clipboard). The number is filled in automatically when the ticked accounts share one mobile number on file (needs Contact Directory View); otherwise type it, or leave it empty and choose the contact in the SMS app. Use it on the phone you will send from.
3b. **Prep Email** / **Prep SMS** build the message. **Open in Outlook** (uses the CC and subject from Templates), **Copy & open Messenger**, or **Copy**.
4. SMS shows a character / SMS-segment counter (160 per SMS; the peso sign drops it to 70, so templates use `P` / `PHP`).

**2. Templates** (shared, saved on the server)
CC address, subject, Messenger link, email header / per-account loop / footer, SMS header / per-account loop / footer.
Variables: `[NAME] [CONTRACT] [AMOUNT] [MONTHS] [DUEDATE] [BILLING_MONTH] [BILLING_MONTH-1] [BILLING_MONTH+1] [BILLING_MONTH_YEAR] [BILLING_MONTH_YEAR-1] [BILLING_MONTH_YEAR+1]`.
The billing month is taken from the due date of the first pasted row.

## Accounts: "Generated" column
Accounts shows only **how many times an email or SMS was generated** for each account (`Email 2  SMS 1`; hover for the last date and user). It appears in the summary table (sortable by total), and at the far right of the Excel-format grid. It is not part of the Excel export.

### What counts as one generation
- A click on **Prep Email** or **Prep SMS**, or on **Outlook** / **Messenger** when they have to generate first, adds **1** to every pasted account found in Accounts. Email and SMS are counted separately.
- Typing, pasting, saving templates and **Copy** do **not** count.
- Clicking the same button again for the same data and template is **not** counted twice (until the data changes or the page is reloaded).
- Accounts are matched by **contract number**. If several accounts share a contract number, the one with the same customer name is used; if no name matches, all of them are counted.
- Contract numbers not found in Accounts are listed in the confirmation message and are not counted.

## Permissions (Admin > Permissions > **EMAIL/SMS generator**)
- **View**: open the page and generate (this is what records the counts).
- **Edit**: change the shared templates. Without it the Templates tab is read-only.
- Off by default for everyone (including Guest). Admin always has it. Anyone who can view Accounts sees the Generated column.

## What changed
| File | Change |
|---|---|
| `smsgen.html` (new) | The generator page (built from `sms_generator.html`, in the CEPALCO theme, templates on the server instead of the browser) |
| `netlify/functions/api.js` | New actions `gen_get`, `gen_cfg`, `gen_log`; `getdata` also returns the counts; permission `sms` replaced by `gen`; old `sms_get`, `sms_mark`, `sms_cfg` removed |
| `index.html`, `accounts.js`, `theme.css` | Text column and "Invalid number" note removed; Generated column added |
| `admin.html`, `auth.js` | "Text message" card and "Send text" permission removed; "EMAIL/SMS generator" permission added |
| `dnjo.html`, `report.html` | New nav tab |
| `sms.js`, `SMS-FEATURE-STATUS.md` | Deleted |

## Notes
- Old "Texted" stamps and the old text template are no longer used (they stay in storage, harmlessly). The old "Send text" permission is ignored; tick the new one for the users who need it.
- Counts are stored by account ID, so they stay with the account when Excel is not reloaded. **Load Excel** replaces all accounts with new IDs, so counts start again at zero after a reload.
- Two people generating at the exact same moment could, rarely, overwrite each other's +1.

## Spacing
Spacing is applied automatically when the message is built: header, accounts and footer are separated by exactly one blank line, and accounts are on consecutive lines (one-line loop) or separated by one blank line (multi-line loop). Extra blank lines or trailing spaces in the templates are cleaned up.
