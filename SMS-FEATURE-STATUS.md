# SMS "Text" Feature – Status (Section 1 done)

Built from `SMS-FEATURE-PLAN.md`, section 1 only. Sections 2 and 3 are untouched.

## What changed
| File | Change |
|---|---|
| `sms.js` (new) | Phone cleanup, message builder, Android/iPhone link, Text button, "Texted" stamp, admin preview |
| `netlify/functions/api.js` | New permission `sms`; actions `sms_get`, `sms_mark` (need Contact view + Send text), `sms_cfg` (admin) |
| `auth.js` | Adds "Send text" to the permission list |
| `admin.html` | "Send text" row in Permissions; **Text message** card, now moved to EMAIL/SMS Generator > Templates (template, closing line, live preview, SMS count, reset) |
| `index.html`, `accounts.js` | Text column in the summary table, the Excel-format grid and the Contact Directory; "Invalid number" note |
| `theme.css`, `README.md` | Button style (40px tall), docs |

## Plan item -> result
- 1.1 Text button, `sms:` link, Android `?body=` / iPhone `&body=`: done
- 1.2 Only with valid phone and remaining balance above zero: done
- 1.3 Message from row data, "PHP" not the peso sign (any ₱ is auto-replaced): done
- 1.4 Number cleanup (`09…`, `+639…`, `639…`; spaces/dashes/brackets removed; first valid number used if several). Invalid: no button, "Invalid number" note in the Contact Directory: done
- 1.5 Same phone on several unpaid accounts: one combined message with a total; all those accounts get the Texted stamp: done
- 1.6 Admin template with placeholders, closing line, preview: done. Extra: `[[ optional part ]]` is dropped when a value is empty. The combined-message layout is fixed (only the closing line is editable).
- 1.7 Permission **Send text** (tick View) plus Contact Directory View; checked on the server: done
- 1.8 "Texted Oct 12 · username" saved on the server for all users (only records that the SMS app was opened): done
- 1.9 Mobile: button min 40px, placed in a last "Text" column so the sticky name column and sideways scroll are unchanged: done

## Before you use it
1. Deploy, then on Admin > Permissions tick **Send text > View** for each user who should have it (default is off, including Guest). Admin has it automatically.
2. Optional: edit the message on EMAIL/SMS Generator > Templates > section 4 and Save.
3. Test the checklist on a real Android phone and iPhone (not testable here).

## Acceptance checklist
- [ ] Android: Messages opens with number and message
- [ ] iPhone: same
- [ ] No button for rows with no phone or no balance
- [ ] Numbers normalize (tested in code: `0917 123-4567`, `+63 917…`, landline rejected)
- [ ] Combined message for a shared number
- [ ] "PHP", not "₱" (tested)
- [ ] Users without permission see no button
- [ ] "Texted" date shows after tapping

## Known limits
- Users with Contact Directory access but no Collections/Accounts/Report access cannot get the Text button, because the account balances are only sent to those pages. Give them Accounts View as well.
- The page cannot confirm the SMS was sent; the stamp means the SMS app was opened.
- Not built yet: "do not text" flag (see Cautions), section 2 (Text next, templates by situation, text log), section 3.

## Suggested next
Section 2.1 "Text next" (step through the filtered list), then 2.3 text log, with a "do not text" flag.
