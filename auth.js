/* CEPALCO login. Users, permissions and data live on the server (/api, Netlify Blobs). */
const Auth=(()=>{
const S='cep_session',FEATS={collections:'Collections',accounts:'Accounts',contacts:'Contact Directory',gen:'EMAIL/SMS generator',report:'Generate report',dnjo:'DN / Job Order',sms:'Send text',dmap:'Accounts Mapping'},NA={contacts:['create','delete'],gen:['create','delete'],dnjo:['create','delete'],sms:['create','update','delete'],dmap:['create','delete']},ACTS=['view','create','update','delete'];
const cs=document.currentScript,g=(cs&&cs.dataset)||{},guarded=!!(g.guard||g.admin!==undefined);
if(guarded)document.documentElement.style.visibility='hidden';
const ses=()=>{try{return JSON.parse(sessionStorage.getItem(S))}catch(e){return null}};
const put=r=>sessionStorage.setItem(S,JSON.stringify({t:r.t,u:r.u,role:r.role,perms:r.perms,must:r.must?1:0}));
async function call(a,o){const s=ses();let r;try{r=await fetch('/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({a,t:s&&s.t,...o})})}catch(e){return{e:'Cannot reach the server'}}
let j;try{j=await r.json()}catch(e){j={e:'Server error ('+r.status+')'}}
if(j&&j.must&&!/login\.html/.test(location.pathname))location.replace('login.html?must=1');return j}
const can=(f,a='view')=>{const s=ses();return !!(s&&(s.role==='admin'||(s.perms&&s.perms[f]&&s.perms[f][a])))};
const logout=()=>{const s=ses();if(s&&s.t){try{fetch('/api',{method:'POST',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({a:'logout',t:s.t})})}catch(e){}}sessionStorage.removeItem(S);location.href='login.html'};
async function login(u,p){const r=await call('login',{u,p});if(r.t){put(r);return true}return r.e||'Sign-in failed'}
async function chpw(o,p){const r=await call('chpw',{o,p});if(r.t){put(r);return true}return r.e||'Could not change the password'}
async function guest(){const r=await call('guest');if(r.t){put(r);return true}return r.e||'Could not continue as guest'}
function hydrate(){const s=ses();
document.querySelectorAll('[data-feature]').forEach(e=>e.hidden=!can(e.dataset.feature));
document.querySelectorAll('[data-admin]').forEach(e=>{if(e!==cs)e.hidden=s.role!=='admin'});
const slot=document.getElementById('authSlot');
if(slot){slot.textContent='';const t=document.createElement('span');t.textContent=s.u+' ('+s.role+')';const a=document.createElement('a');a.href='#';a.className='';a.textContent='Logout';a.onclick=e=>{e.preventDefault();logout()};slot.append(t,a)}}
async function guard(){const toLogin=()=>{sessionStorage.removeItem(S);location.replace('login.html?next='+encodeURIComponent(location.pathname.split('/').pop()+location.hash));return false};
if(!ses())return toLogin();
if(ses().must){location.replace('login.html?must=1');return false}
/* show the page at once from the saved session; the server re-checks every action anyway */
const allowed=()=>g.admin!==undefined?ses().role==='admin':(g.guard||'').split(',').some(f=>can(f));
hydrate();document.documentElement.style.visibility='visible';
const ok=allowed();
if(!ok){const m=document.querySelector('main');if(m){m.hidden=true;m.insertAdjacentHTML('beforebegin','<div class="wrap" style="max-width:560px;margin-top:64px"><div class="card empty"><h2 class="nobar" style="justify-content:center">Access restricted</h2><p class="sub">Your account does not have permission to view this page.</p></div></div>')}}
/* confirm in the background; reload only if the server says something changed */
call('me').then(r=>{if(!r.t)return toLogin();const before=JSON.stringify([ses().role,ses().perms]);put(r);if(JSON.stringify([r.role,r.perms])!==before)location.reload()}).catch(()=>{});
return ok}
/* Saved accounts -> plain rows keyed by Excel header, dates as Excel serial numbers (what the report page expects from an uploaded workbook). */
const excelRows=(d,dateFmt)=>d.r.map(x=>{const o={};d.cols.forEach(([k,t])=>{let v=x[k];if(t==='d'&&v&&!dateFmt){const[y,m,dd]=v.split('-').map(Number);v=Date.UTC(y,m-1,dd)/864e5+25569}o[k]=v==null?'':v});return o});
const ready=guarded?new Promise(r=>document.addEventListener('DOMContentLoaded',()=>guard().then(r))):Promise.resolve(false);
return{FEATS,NA,ACTS,excelRows,call,can,ses,logout,login,chpw,guest,ready}})();

/* helpers shared by every page: load a big library only when it is needed, and wait for typing to pause */
const LIB={xlsx:'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',chart:'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',pdf:'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',exceljs:'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'};
const _libs={};
const loadLib=u=>_libs[u]||(_libs[u]=new Promise((ok,no)=>{const e=document.createElement('script');e.src=u;e.async=true;e.onload=ok;e.onerror=()=>{delete _libs[u];no(new Error('Could not load a required library. Check your internet connection.'))};document.head.appendChild(e)}));
const debounce=(f,t=150)=>{let h;return(...a)=>{clearTimeout(h);h=setTimeout(()=>f(...a),t)}};

/* Formatted Excel download of the accounts list (used by the Accounts grid and the Admin page).
   Same sheet name, same column headings and same order, so Load Excel can read it back. d = {r: records, cols: [[name,type],...]} */
async function downloadAccountsXlsx(d){
await loadLib(LIB.exceljs);
const MONEY=new Set(['ARREARS','LATEST BILL AMOUNT','TOTAL BALANCE AMOUNT','PAID AMOUNT','REMAINING BALANCE']),INT=new Set(['CONTRACT NO.','MONTHS UNPAID']),WIDE={'FIELD REMARKS':40,'CUSTOMER NAME':34,'EMAIL ADDRESS':32,'Contact Person':24};
const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('MONITORING FOR CODE',{views:[{state:'frozen',xSplit:7,ySplit:1}]});
const line={style:'thin',color:{argb:'FFD0D0D0'}},box={top:line,left:line,bottom:line,right:line};
ws.columns=d.cols.map(([k,t])=>{
const vals=d.r.slice(0,500).map(x=>x[k]==null?0:String(t==='d'?'00/00/0000':MONEY.has(k)?Number(x[k]).toLocaleString('en-US',{minimumFractionDigits:2}):x[k]).length);
return{header:k,key:k,width:Math.min(WIDE[k]||26,Math.max(10,k.length+3,...vals)+2)}});
d.r.forEach(x=>{const row={};d.cols.forEach(([k,t])=>{let v=x[k];if(v==null||v==='')v=null;else if(t==='d'){const[y,m,dd]=v.split('-').map(Number);v=new Date(Date.UTC(y,m-1,dd))}row[k]=v});ws.addRow(row)});
const hr=ws.getRow(1);hr.height=30;
hr.eachCell(c=>{c.font={bold:true,color:{argb:'FFFFFFFF'},size:10};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE8171A'}};c.alignment={vertical:'middle',horizontal:'center',wrapText:true};c.border=box});
d.cols.forEach(([k,t],i)=>{const col=ws.getColumn(i+1);
col.eachCell({includeEmpty:false},(c,r)=>{if(r===1)return;c.border=box;c.font={size:10};
if(t==='d'){c.numFmt='mm/dd/yyyy';c.alignment={horizontal:'center'}}
else if(MONEY.has(k)){c.numFmt='#,##0.00';c.alignment={horizontal:'right'}}
else if(INT.has(k)){c.numFmt='0';c.alignment={horizontal:'center'}}
else if(k==='FIELD REMARKS')c.alignment={wrapText:true,vertical:'top'}})});
ws.autoFilter={from:{row:1,column:1},to:{row:1,column:d.cols.length}};
ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:1'};
const buf=await wb.xlsx.writeBuffer(),a=document.createElement('a');
a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
a.download='ACCOUNTS_MASTERLIST_'+new Date().toISOString().slice(0,10)+'.xlsx';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
