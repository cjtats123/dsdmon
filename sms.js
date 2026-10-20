/* "Text" button: opens the phone's SMS app with the customer's number and a ready message. Nothing is sent by the website.
   Uses globals from index.html (recs, esc) only when a button is drawn or tapped, so admin.html can load it for the preview. */
const SMS = (() => {
  const DEF = { tpl: 'Good day, {name}. Your CEPALCO account (Contract {contract}) has an unpaid balance of PHP {amount}[[, {months_unpaid} unpaid]][[, due {due_date}]].', closing: 'Please settle at your earliest convenience. Thank you.' };
  const st = { tpl: DEF.tpl, closing: DEF.closing, texted: {} };
  const can = () => Auth.can('contacts') && Auth.can('sms');
  /* first valid mobile number in the cell -> +639XXXXXXXXX, or null */
  const norm = v => { for (const p of String(v ?? '').split(/[,;\/]/)) { const d = p.replace(/[\s\-().]/g, ''); if (/^09\d{9}$/.test(d)) return '+63' + d.slice(1); if (/^\+?639\d{9}$/.test(d)) return '+' + d.replace('+', ''); } return null; };
  const owed = r => Number(r['REMAINING BALANCE']) > 0;
  const elig = r => !!r && owed(r) && !!norm(r['PHONE NO.']);
  const money = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dmy = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? m[2] + '/' + m[3] + '/' + m[1] : ''; };
  const mon = n => n > 0 ? n + (n == 1 ? ' month' : ' months') : '';
  const vars = r => ({ name: r['CUSTOMER NAME'] || '', contract: r['CONTRACT NO.'] ?? '', amount: money(r['REMAINING BALANCE']), months_unpaid: mon(Number(r['MONTHS UNPAID'])), due_date: dmy(r['DUE DATE']) });
  /* [[ ... ]] is dropped when a placeholder inside it is empty, so a missing due date never leaves ", due ." behind */
  const fill = (t, v) => t.replace(/\[\[([\s\S]*?)\]\]/g, (_, s) => [...s.matchAll(/\{(\w+)\}/g)].every(m => v[m[1]] !== '' && v[m[1]] != null) ? s : '').replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '').replace(/\s+([,.])/g, '$1').replace(/\s+/g, ' ').trim();
  const clean = s => s.replace(/\u20B1\s?/g, 'PHP ');   // the peso sign would force 70-character SMS segments
  function compose(g, tpl, closing) {
    if (g.length === 1) return clean((fill(tpl, vars(g[0])) + ' ' + closing).trim());
    const items = g.map((r, i) => { const v = vars(r), x = [v.months_unpaid && v.months_unpaid + ' unpaid', v.due_date && 'due ' + v.due_date].filter(Boolean).join(', '); return (i + 1) + ') Contract ' + v.contract + ' - PHP ' + v.amount + (x ? ' (' + x + ')' : ''); });
    const total = money(g.reduce((s, r) => s + Number(r['REMAINING BALANCE']), 0));
    return clean([('Good day, ' + (g[0]['CUSTOMER NAME'] || '')).replace(/\.?$/, '.'), 'Your CEPALCO accounts have unpaid balances:', '', items.join('\n'), '', 'Total: PHP ' + total, '', closing.trim()].join('\n')).trim();
  }
  const group = r => { const p = norm(r['PHONE NO.']); return recs.filter(x => owed(x) && norm(x['PHONE NO.']) === p); };
  const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const link = (num, body) => 'sms:' + num + (ios() ? '&' : '?') + 'body=' + encodeURIComponent(body);
  const stamp = id => { const t = st.texted[id]; return t ? 'Texted ' + new Date(t.t).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) + ' \u00B7 ' + t.u : ''; };
  let _ix, _ir; const byId = id => { if (_ir !== recs) { _ir = recs; _ix = new Map(recs.map(x => [x._id, x])); } return _ix.get(id); };
  const cellInner = id => { const r = byId(id); return elig(r) ? `<button type="button" class="btn txb" data-sms="${esc(id)}">Text</button><span class="txd" data-txd="${esc(id)}">${esc(stamp(id))}</span>` : ''; };
  const paint = () => document.querySelectorAll('[data-txd]').forEach(e => { e.textContent = stamp(e.dataset.txd); });
  function send(id) {
    const r = recs.find(x => x._id === id); if (!can() || !elig(r)) return;
    const g = group(r), ids = g.map(x => x._id), now = Date.now(), u = Auth.ses().u;
    ids.forEach(i => { st.texted[i] = { t: now, u }; }); paint();
    Auth.call('sms_mark', { ids });                       // record it; the page itself opens the SMS app straight after (must stay inside the tap)
    location.href = link(norm(r['PHONE NO.']), compose(g, st.tpl, st.closing));
  }
  async function init() {
    if (!can()) return;
    document.addEventListener('click', e => { const b = e.target.closest('button[data-sms]'); if (b) send(b.dataset.sms); });
    const j = await Auth.call('sms_get'); if (j.e) return;
    st.tpl = j.tpl; st.closing = j.closing; st.texted = j.texted || {}; paint();
  }
  /* admin preview: one sample account, plus how many SMS segments the text will use */
  function preview(tpl, closing) {
    const m = compose([{ 'CUSTOMER NAME': 'Juan Dela Cruz', 'CONTRACT NO.': 123456, 'REMAINING BALANCE': 4520, 'MONTHS UNPAID': 2, 'DUE DATE': '2026-10-06' }], tpl, closing), n = m.length, gsm = !/[^\x20-\x7E\n]/.test(m), per = gsm ? 160 : 70;
    return { text: m, info: n + ' characters, ' + (n <= per ? 1 : Math.ceil(n / (gsm ? 153 : 67))) + ' SMS' + (gsm ? '' : ' (special characters switch to 70 per SMS)') };
  }
  return { DEF, can, norm, cellInner, init, preview, link };
})();
