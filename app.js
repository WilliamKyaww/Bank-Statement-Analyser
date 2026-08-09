/* ===========================================================================
   Spendwise
   =========================================================================== */

/* ---------------------------------------------------------------- data --- */

const statements=[
  {key:'January',label:'January 2026',in:688.83,out:1033.32,days:31,categories:{Housing:49.99,Food:365.00,Transport:76.00,Subscriptions:107.92,Shopping:74.41,Transfers:359.00}},
  {key:'February',label:'February 2026',in:2181,out:1010.59,days:28,categories:{Housing:49.99,Food:318.54,Transport:103.00,Subscriptions:107.92,Shopping:71.14,Transfers:360.00}},
  {key:'March',label:'March 2026',in:41.98,out:1215.48,days:31,categories:{Housing:49.99,Food:605.20,Transport:98.50,Subscriptions:129.46,Shopping:112.33,Transfers:220.00}},
  {key:'April',label:'April 2026',in:1200,out:986.36,days:30,categories:{Housing:49.99,Food:202.24,Transport:57.00,Subscriptions:106.95,Shopping:70.18,Transfers:500.00}},
  {key:'May',label:'May 2026',in:920.99,out:1110.56,days:31,categories:{Housing:66.82,Food:236.34,Transport:32.50,Subscriptions:118.95,Shopping:135.96,Transfers:520.00}},
  {key:'June',label:'June 2026',in:1700,out:1568.58,days:30,categories:{Housing:66.82,Food:527.40,Transport:124.75,Subscriptions:131.94,Shopping:177.67,Transfers:540.00}},
  {key:'July',label:'July 2026',in:1700,out:1298.27,days:31,categories:{Housing:66.82,Food:440.00,Transport:108.20,Subscriptions:131.94,Shopping:151.31,Transfers:400.00}},
  {key:'August',label:'August 2026 · MTD',in:400,out:900.41,days:9,categories:{Housing:46.82,Food:222.36,Transport:56.00,Subscriptions:65.98,Shopping:48.84,Transfers:460.41}}
];

const statementFiles={
  January:'LLoyds/2026_January_Statement.pdf',February:'LLoyds/2026_February_Statement.pdf',
  March:'LLoyds/2026_March_Statement.pdf',April:'LLoyds/2026_April_Statement.pdf',
  May:'LLoyds/2026_May_Statement.pdf',June:'LLoyds/2026_June_Statement.pdf',
  July:'LLoyds/2026_July_Statement.pdf',August:'LLoyds/2026_August_Statement.pdf'
};
const natwestStatementFile='Natwest/Natwest Bank Statement.pdf';
const natwestMonthNames={May:'May',Jun:'June',Jul:'July',Aug:'August'};

const defaultCategoryKeywords={
  Charity:['HDFM','HUMANITARIAN','DEVELOPMENT FOUNDATION','DONATION','CHARITY'],
  Accommodation:['MR I RURA','LANDLORD','RENT','ACCOMMODATION','THELIVEN'],
  Subscriptions:['EE LIMITED','SPOTIFY','APPLE.COM/BILL','OPENAI','ANTHROPIC','CLAUDE','DISCORD'],
  Food:['UBER EATS','FOODHUB','ICELAND','CHICKEN','PEPE','PIRI PIRI','STARBUCKS','KINGSTON ROAD FOOD','LONDIS','WASABI','TESCO','ALDI','SAINSBURY','GDK','CAFE','KFC','BUBBLE TEA','SHAKE SHACK','CO-OP','MINI MARKET','TAYLOR NEWS','M&S SIMPLY FOOD','GREGGS','PRET','MCDONALDS'],
  Transport:['TRAINLINE','TFL','UBER *TRIP','UBER TRIP','UBR* PENDING','LIME'],
  Health:['PURE GYM','GYM'],
  Fees:['NON-GBP','FEE','CHARGE'],
  Transfers:['TRANSFER','KYAW W','HTET YAN LINN','VIPUL GUNTAKANDLA','HEIN HTET SOE','WILLIAM','KHINE M','SAMUEL COBB']
};

window.transactionData=window.transactionData||[];
window.natwestTransactions=window.natwestTransactions||[];
window.transactionData.forEach(t=>{t.bank='Lloyds';t.year=2026});
window.natwestTransactions.forEach(t=>{t.month=natwestMonthNames[t.month]||t.month});
window.natwestTransactions.forEach(t=>t.year=2026);
window.transactionData.push(...window.natwestTransactions);

/* --------------------------------------------------------------- state --- */

let categoryKeywords=JSON.parse(localStorage.getItem('categoryKeywords')||'null')||defaultCategoryKeywords;
let selected=statements[7];
let selectedDirection='all';
let selectedCategory='all';
let bankFilter='both';
let selectedMonths=['August'];
let currentPage='overview';
let selectedYear=2026;
let hiddenCategories=JSON.parse(localStorage.getItem('hiddenCategories')||'[]');
const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
const uploadedStatements=[];

/* ------------------------------------------------------------- helpers --- */

const el=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n);
const moneyShort=n=>n>=1000?'£'+(n/1000).toFixed(n%1000?1:0)+'k':'£'+Math.round(n);
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const token=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* Categorical colours are assigned per category (never per rank), so a
   category keeps its colour when the filters change the ordering. */
const seriesOrder=['Food','Accommodation','Transfers','Subscriptions','Transport','Health','Charity','Fees'];
function categoryColor(name){
  if(name==='Other')return token('--s-other');
  let slot=seriesOrder.indexOf(name);
  if(slot<0){
    const extras=Object.keys(categoryKeywords).filter(c=>!seriesOrder.includes(c)).sort();
    slot=seriesOrder.length+extras.indexOf(name);
  }
  return slot>=0&&slot<8?token(`--s${slot+1}`):token('--s-other');
}
/* Ring order is fixed so neighbouring wedges are always a validated pair. */
const categoryRank=name=>{const i=seriesOrder.indexOf(name);return i<0?(name==='Other'?99:50):i};

/* --------------------------------------------------------- data queries --- */

const bankMatches=t=>bankFilter==='both'||t.bank.toLowerCase()===bankFilter;
const yearMatches=t=>t.year===selectedYear;

function categoryFor(t){
  if(t.direction==='in')return 'Income';
  const text=t.description.toUpperCase();
  for(const [category,keywords] of Object.entries(categoryKeywords)){
    if(keywords.some(keyword=>text.includes(keyword.toUpperCase())))return category;
  }
  if(t.type==='FPO')return 'Transfers';
  return 'Other';
}

function categoryTotals(){
  const totals={};
  window.transactionData
    .filter(t=>selectedMonths.includes(t.month)&&yearMatches(t)&&bankMatches(t)&&t.direction==='out')
    .forEach(t=>{const category=categoryFor(t);totals[category]=(totals[category]||0)+t.amount});
  return totals;
}

function viewStatements(){
  return selectedMonths.map(key=>{
    const base=statements.find(s=>s.key===key);
    const natwest=window.transactionData.filter(t=>t.bank==='Natwest'&&t.year===selectedYear&&t.month===key);
    const natwestIn=natwest.filter(t=>t.direction==='in').reduce((sum,t)=>sum+t.amount,0);
    const natwestOut=natwest.filter(t=>t.direction==='out').reduce((sum,t)=>sum+t.amount,0);
    const lloydsIn=bankFilter==='natwest'||selectedYear!==2026?0:(base?.in||0);
    const lloydsOut=bankFilter==='natwest'||selectedYear!==2026?0:(base?.out||0);
    return {
      key,label:`${key} ${selectedYear}`,days:base?.days||30,
      in:lloydsIn+(bankFilter==='lloyds'?0:natwestIn),
      out:lloydsOut+(bankFilter==='lloyds'?0:natwestOut)
    };
  });
}

function analysisRecords(){
  return window.transactionData.filter(t=>
    selectedMonths.includes(t.month)&&yearMatches(t)&&bankMatches(t)&&
    (selectedDirection==='all'||t.direction===selectedDirection));
}

/* ------------------------------------------------------------ renderers --- */

function renderStats(){
  const view=viewStatements();
  const totalIn=view.reduce((sum,s)=>sum+s.in,0);
  const totalOut=view.reduce((sum,s)=>sum+s.out,0);
  const totalDays=view.reduce((sum,s)=>sum+s.days,0);
  const previous=statements[Math.max(0,statements.indexOf(selected)-1)];

  el('moneyOut').textContent=money(totalOut);
  el('moneyIn').textContent=money(totalIn);
  el('netMovement').textContent=money(totalIn-totalOut);
  el('dailySpend').textContent=money(totalDays?totalOut/totalDays:0);
  el('outTrend').textContent=view.length===1
    ?`${Math.abs((selected.out-previous.out)/previous.out*100).toFixed(0)}% ${selected.out>previous.out?'up':'down'}`
    :'—';
  el('outTrend').className=`trend ${view.length===1&&selected.out>previous.out?'down':'positive'}`;
  el('netFoot').textContent=totalIn>=totalOut?'Positive movement':'Spend exceeded income';
  el('statementNote').textContent=view.length===1
    ?(selected.days<28?'Month to date':'Average per calendar day')
    :`Across ${view.length} selected months`;
}

function renderCategories(){
  const entries=Object.entries(categoryTotals()).sort((a,b)=>b[1]-a[1]);
  const visible=entries.filter(([name])=>!hiddenCategories.includes(name));
  const total=visible.reduce((sum,item)=>sum+item[1],0);
  el('categoryList').innerHTML=entries.length
    ?entries.map(([name,value])=>`<div class="category-item">
        <label class="category-switch" title="${hiddenCategories.includes(name)?'Show':'Hide'} ${escapeHtml(name)}"><input type="checkbox" data-category-toggle="${escapeHtml(name)}" ${hiddenCategories.includes(name)?'':'checked'}><span></span></label>
        <i class="color" style="background:${categoryColor(name)}"></i>
        <span class="name ${hiddenCategories.includes(name)?'muted-category':''}">${escapeHtml(name)}</span>
        ${hiddenCategories.includes(name)?'<span class="share muted-category">off</span>':`<span class="share">${total?(value/total*100).toFixed(1):'0.0'}%</span>`}
        <span class="value ${hiddenCategories.includes(name)?'muted-category':''}">${money(value)}</span>
      </div>`).join('')
    :'<div class="empty">Select at least one month to see expense categories.</div>';
  el('donutTotal').textContent=money(total).replace('.00','');
}

function renderTransactions(){
  const categoryOptions=Object.keys(categoryTotals()).sort();
  const select=el('categorySelect');
  select.innerHTML='<option value="all">All categories</option>'+
    categoryOptions.map(category=>`<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  if(selectedCategory!=='all'&&!categoryOptions.includes(selectedCategory))selectedCategory='all';
  select.value=selectedCategory;

  const all=window.transactionData.filter(t=>
    selectedMonths.includes(t.month)&&yearMatches(t)&&bankMatches(t)&&
    (selectedDirection==='all'||t.direction===selectedDirection)&&
    (selectedCategory==='all'||categoryFor(t)===selectedCategory));

  const counts=all.reduce((map,t)=>(map[t.description]=(map[t.description]||0)+1,map),{});
  const seen={};
  const label=selectedMonths.length===1?selectedMonths[0]:'selected months';
  const heading=selectedDirection==='all'?'All':selectedDirection==='in'?'Money in':'Money out';
  el('transactionsHeading').textContent=
    `${heading} transactions${selectedCategory==='all'?'':' · '+selectedCategory} · ${label}`;

  el('transactionsTable').innerHTML=all.map(t=>{
    seen[t.description]=(seen[t.description]||0)+1;
    const repeated=counts[t.description]>1;
    return `<div class="transaction">
      <span class="merchant">${escapeHtml(t.description)}${
        repeated?`<span class="repeat-note">payment ${seen[t.description]} of ${counts[t.description]}</span>`:''
      }${
        /* only worth showing when both accounts are mixed into one list */
        bankFilter==='both'?`<span class="bank-tag">${escapeHtml(t.bank)}</span>`:''
      }</span>
      <span class="date">${escapeHtml(t.date)}</span>
      <span class="type">${escapeHtml(t.type==='FPI'?'Payment in':t.type)}</span>
      <span class="amount ${t.direction==='out'?'out':'in-amount'}">${t.direction==='out'?'−':'+'}${money(t.amount)}</span>
    </div>`;
  }).join('')||'<div class="empty">No transactions match these filters.</div>';
}

function renderAnalysis(){
  const records=analysisRecords();
  const total=records.reduce((sum,t)=>sum+t.amount,0);
  const bankLabel=bankFilter==='both'?'both banks':bankFilter==='lloyds'?'Lloyds':'NatWest';
  const typeLabel=selectedDirection==='all'?'all activity':selectedDirection==='in'?'money in':'money out';

  el('analysisLabel').textContent=
    `${selectedMonths.length} month${selectedMonths.length===1?'':'s'} · ${bankLabel} · ${typeLabel}`;
  el('analysisTotal').textContent=money(total);
  el('analysisCount').textContent=records.length;
  el('analysisAverage').textContent=money(selectedMonths.length?total/selectedMonths.length:0);

  const rows=selectedMonths.map(key=>({
    key,value:records.filter(t=>t.month===key).reduce((sum,t)=>sum+t.amount,0)
  }));
  const peak=Math.max(1,...rows.map(r=>r.value));
  el('analysisBreakdown').innerHTML=rows.length
    ?rows.map(r=>`<div class="breakdown-row">
        <span class="m">${r.key.slice(0,3)}</span>
        <span class="bar"><i style="width:${(r.value/peak*100).toFixed(1)}%"></i></span>
        <span class="v">${money(r.value)}</span>
      </div>`).join('')
    :'<div class="empty">Select at least one month to see a breakdown.</div>';
}

function renderStatement(){
  const isNatwest=bankFilter==='natwest';
  const upload=uploadedStatements.find(s=>s.bank===(isNatwest?'natwest':'lloyds')&&s.year===selectedYear&&s.month===selected.key);
  const file=upload?.url||(isNatwest?natwestStatementFile:statementFiles[selected.key]);
  const available=monthAvailable(selected.key)&&Boolean(file);
  const period=selected.label.replace(' · MTD','');
  el('statementTitle').textContent=isNatwest?'NatWest bank statement':`${period} Lloyds bank statement`;
  el('statementBank').textContent=isNatwest?'NatWest':'Lloyds';
  el('statementPeriod').textContent=isNatwest?'As supplied by NatWest':period;
  el('statementFile').textContent=available?(upload?.name||file.split('/').pop()):'No statement available';
  el('downloadStatement').href=available?file:'#';
  el('downloadStatement').toggleAttribute('aria-disabled',!available);
  el('statementEmpty').hidden=available;
  if(currentPage==='statements'&&available&&el('statementFrame').getAttribute('src')!==file){
    el('statementFrame').src=file;
  }else if(!available)el('statementFrame').removeAttribute('src');
}

function renderKeywordManager(){
  el('keywordManager').innerHTML=Object.entries(categoryKeywords).map(([category,keywords])=>{
    const encoded=encodeURIComponent(category);
    return `<div class="keyword-category">
      <h4>${escapeHtml(category)}</h4>
      <div class="keyword-list">${
        keywords.length
          ?keywords.map((keyword,index)=>`<div class="keyword-row">
              <input data-edit="${encoded}" data-index="${index}" value="${escapeHtml(keyword)}" aria-label="${escapeHtml(category)} keyword">
              <button type="button" data-action="save" data-category="${encoded}" data-index="${index}">Save</button>
              <button type="button" data-action="delete" data-category="${encoded}" data-index="${index}" aria-label="Delete keyword">×</button>
            </div>`).join('')
          :'<div class="keyword-empty">No keywords yet.</div>'
      }</div>
      <div class="keyword-add">
        <input data-add="${encoded}" placeholder="Add keyword">
        <button type="button" data-action="add" data-category="${encoded}">Add</button>
      </div>
    </div>`;
  }).join('');
}

function render(){
  renderStats();
  renderCategories();
  renderTransactions();
  renderAnalysis();
  renderStatement();
  drawCharts();
}

/* --------------------------------------------------------------- charts --- */

function setupCanvas(canvas){
  const ratio=devicePixelRatio||1,w=canvas.clientWidth,h=canvas.clientHeight;
  canvas.width=w*ratio;canvas.height=h*ratio;
  const c=canvas.getContext('2d');
  c.scale(ratio,ratio);
  return [c,w,h];
}

function niceMax(value){
  const power=Math.pow(10,Math.floor(Math.log10(value||1)));
  const n=value/power;
  return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*power;
}

let trendGeom=null,trendHover=-1;

function drawTrend(){
  const canvas=el('trendChart');
  if(!canvas.clientWidth||!canvas.clientHeight)return;
  const visible=viewStatements();
  const [c,w,h]=setupCanvas(canvas);
  const max=niceMax(Math.max(1,...visible.flatMap(s=>[s.in,s.out]))*1.05);
  const left=48,bottom=28,top=10,chartH=h-top-bottom;
  const plotW=Math.max(10,w-left-14);
  const step=visible.length>1?plotW/(visible.length-1):0;
  const x0=visible.length>1?left:left+plotW/2;
  const y=v=>top+chartH*(1-v/max);

  c.font='11px "DM Sans", sans-serif';
  c.textBaseline='middle';

  /* recessive grid + axis labels */
  c.lineWidth=1;
  [0,.25,.5,.75,1].forEach(f=>{
    const gy=Math.round(y(max*f))+.5;
    c.strokeStyle=token('--grid');
    c.beginPath();c.moveTo(left,gy);c.lineTo(w,gy);c.stroke();
    c.fillStyle=token('--muted');
    c.textAlign='right';
    c.fillText(moneyShort(max*f),left-10,gy);
  });

  if(!visible.length){
    c.fillStyle=token('--muted');c.textAlign='center';
    c.fillText('Select at least one month to see cash flow.',left+plotW/2,top+chartH/2);
    trendGeom=null;
    return;
  }

  /* hover crosshair sits under the marks */
  if(trendHover>=0&&trendHover<visible.length){
    const hx=Math.round(x0+trendHover*step)+.5;
    c.strokeStyle=token('--axis');
    c.beginPath();c.moveTo(hx,top);c.lineTo(hx,top+chartH);c.stroke();
  }

  const surface=token('--surface');
  const drawLine=(field,color)=>{
    c.strokeStyle=color;c.lineWidth=2;c.lineJoin='round';c.lineCap='round';
    c.beginPath();
    visible.forEach((s,i)=>{const x=x0+i*step,py=y(s[field]);i?c.lineTo(x,py):c.moveTo(x,py)});
    c.stroke();
    visible.forEach((s,i)=>{
      const x=x0+i*step,py=y(s[field]);
      const focus=s.key===selected.key||i===trendHover;
      c.beginPath();c.arc(x,py,focus?5.5:4,0,Math.PI*2);
      c.fillStyle=color;c.fill();
      c.lineWidth=2;c.strokeStyle=surface;c.stroke();   /* 2px surface ring */
    });
  };
  drawLine('in',token('--s1'));
  drawLine('out',token('--s2'));

  c.fillStyle=token('--muted');c.textAlign='center';
  visible.forEach((s,i)=>c.fillText(s.key.slice(0,3),x0+i*step,h-12));
  c.textAlign='left';

  trendGeom={visible,x0,step,left,plotW,top,chartH,y};
}

let donutSlices=[],donutGeom=null,donutHover=-1;

function drawDonut(){
  const canvas=el('categoryChart');
  if(!canvas.clientWidth||!canvas.clientHeight)return;
  const [c,w,h]=setupCanvas(canvas);
  const entries=Object.entries(categoryTotals()).filter(([name])=>!hiddenCategories.includes(name)).sort((a,b)=>categoryRank(a[0])-categoryRank(b[0])||b[1]-a[1]);
  const total=entries.reduce((sum,item)=>sum+item[1],0);
  const cx=w/2,cy=h/2,rOut=Math.min(w,h)/2-4,thickness=30,rMid=rOut-thickness/2,rIn=rOut-thickness;

  donutSlices=[];donutGeom={cx,cy,rIn,rOut};
  if(!total)return;

  let start=-Math.PI/2;
  entries.forEach(([name,value],i)=>{
    const angle=value/total*Math.PI*2;
    const pad=Math.min(angle/2.5,1/rMid);        /* 2px surface gap between fills */
    const color=categoryColor(name);
    const grow=i===donutHover?3:0;
    c.beginPath();
    c.arc(cx,cy,rMid,start+pad,start+angle-pad);
    c.lineWidth=thickness+grow;c.lineCap='butt';c.strokeStyle=color;
    c.stroke();
    donutSlices.push({name,value,color,start,end:start+angle,share:value/total});
    start+=angle;
  });
}

function drawCharts(){
  if(currentPage==='overview')drawTrend();
  if(currentPage==='categories')drawDonut();
}

/* ------------------------------------------------------------- tooltips --- */

function positionTip(tip,wrap,x,y){
  tip.style.left=Math.max(70,Math.min(wrap.clientWidth-70,x))+'px';
  tip.style.top=Math.max(tip.offsetHeight,y-12)+'px';
}

el('trendChart').addEventListener('mousemove',event=>{
  if(!trendGeom)return;
  const rect=event.currentTarget.getBoundingClientRect();
  const x=event.clientX-rect.left;
  const index=trendGeom.step
    ?Math.max(0,Math.min(trendGeom.visible.length-1,Math.round((x-trendGeom.x0)/trendGeom.step)))
    :0;
  const point=trendGeom.visible[index];
  if(index!==trendHover){trendHover=index;drawTrend()}
  const tip=el('trendTip');
  tip.innerHTML=`<strong>${escapeHtml(point.label.replace(' · MTD',' (MTD)'))}</strong>
    <div class="row"><i class="swatch" style="background:${token('--s1')}"></i>Money in<b>${money(point.in)}</b></div>
    <div class="row"><i class="swatch" style="background:${token('--s2')}"></i>Money out<b>${money(point.out)}</b></div>`;
  tip.classList.add('show');
  positionTip(tip,event.currentTarget.parentElement,trendGeom.x0+index*trendGeom.step,trendGeom.y(Math.max(point.in,point.out)));
});

el('trendChart').addEventListener('mouseleave',()=>{
  trendHover=-1;el('trendTip').classList.remove('show');drawTrend();
});

el('categoryChart').addEventListener('mousemove',event=>{
  if(!donutGeom||!donutSlices.length)return;
  const rect=event.currentTarget.getBoundingClientRect();
  const dx=event.clientX-rect.left-donutGeom.cx,dy=event.clientY-rect.top-donutGeom.cy;
  const distance=Math.hypot(dx,dy);
  let index=-1;
  if(distance>=donutGeom.rIn-4&&distance<=donutGeom.rOut+4){
    let angle=Math.atan2(dy,dx);
    if(angle<-Math.PI/2)angle+=Math.PI*2;
    index=donutSlices.findIndex(s=>angle>=s.start&&angle<s.end);
  }
  const tip=el('donutTip');
  if(index!==donutHover){donutHover=index;drawDonut()}
  if(index<0){tip.classList.remove('show');return}
  const slice=donutSlices[index];
  tip.innerHTML=`<strong>${escapeHtml(slice.name)}</strong>
    <div class="row"><i class="swatch" style="background:${slice.color}"></i>Spend<b>${money(slice.value)}</b></div>
    <div class="row"><i class="swatch" style="background:transparent"></i>Share<b>${(slice.share*100).toFixed(1)}%</b></div>`;
  tip.classList.add('show');
  positionTip(tip,event.currentTarget.parentElement,event.clientX-rect.left,event.clientY-rect.top);
});

el('categoryChart').addEventListener('mouseleave',()=>{
  donutHover=-1;el('donutTip').classList.remove('show');drawDonut();
});

/* --------------------------------------------------------------- router --- */

const pages={
  overview:{title:'Overview',sub:'Here’s how your spending is shaping up.',filters:true},
  analysis:{title:'Analysis',sub:'Totals across the accounts, months and transaction type you’ve selected.',filters:true},
  transactions:{title:'Transactions',sub:'Every line from the selected statements, in one list.',filters:true},
  categories:{title:'Categories',sub:'Where your money goes, grouped by merchant keywords.',filters:true},
  keywords:{title:'Keywords',sub:'Tune how transactions are sorted into categories.',filters:false},
  statements:{title:'Statements',sub:'Read the original PDF your figures come from.',filters:true}
};

function showPage(name){
  if(!pages[name])name='overview';
  currentPage=name;
  document.querySelectorAll('.page').forEach(page=>page.classList.toggle('active',page.dataset.page===name));
  document.querySelectorAll('#navLinks a').forEach(link=>{
    const active=link.dataset.page===name;
    link.classList.toggle('active',active);
    link.setAttribute('aria-current',active?'page':'false');
  });
  el('pageTitle').textContent=pages[name].title;
  el('pageSub').textContent=pages[name].sub;
  el('filterBar').hidden=!pages[name].filters;
  el('sidebar').classList.remove('open');
  document.querySelector('.scrim')?.remove();

  if(name==='statements'){selectedMonths=[selected.key];refreshMonthControls();renderStatement();}
  else el('statementFrame').removeAttribute('src');
  drawCharts();
}

const routeFromHash=()=>showPage((location.hash||'').replace(/^#\/?/,'')||'overview');
addEventListener('hashchange',routeFromHash);

/* --------------------------------------------------------------- inputs --- */

function monthAvailable(month){return window.transactionData.some(t=>t.year===selectedYear&&t.month===month&&bankMatches(t))||uploadedStatements.some(s=>s.year===selectedYear&&s.month===month&&(bankFilter==='both'||s.bank===bankFilter))}
function refreshMonthControls(){
  const picker=el('monthPicker');
  picker.innerHTML=monthNames.map(month=>{const available=monthAvailable(month),checked=selectedMonths.includes(month);return `<label title="${available?'':'No transaction recorded for this month'}"><input type="checkbox" value="${month}" ${checked?'checked':''} ${available?'':'disabled'}><span>${month.slice(0,3)}</span></label>`}).join('');
  el('monthSelect').innerHTML=monthNames.map(month=>{const available=monthAvailable(month);return `<option value="${month}" ${available?'':'disabled'}>${month} ${selectedYear}${month==='August'?' · MTD':''}</option>`}).join('');
  el('monthSelect').value=selectedMonths[0]||'August';
}
function refreshYearSelect(){
  const years=[...new Set([2026,...window.transactionData.map(t=>t.year),...uploadedStatements.map(s=>s.year)])].sort((a,b)=>b-a);
  el('yearSelect').innerHTML=years.map(year=>`<option value="${year}">${year}</option>`).join('');el('yearSelect').value=String(selectedYear);
}
refreshYearSelect();refreshMonthControls();

el('monthSelect').addEventListener('change',event=>{
  selected=statements.find(s=>s.key===event.target.value);
  if(!selected)selected={key:event.target.value,label:`${event.target.value} ${selectedYear}`,days:30,in:0,out:0};
  selectedMonths=[selected.key];
  el('monthPicker').querySelectorAll('input').forEach(input=>input.checked=input.value===selected.key);
  render();
});

el('monthPicker').addEventListener('change',event=>{
  if(currentPage==='statements'){
    selectedMonths=[event.target.value];
    el('monthPicker').querySelectorAll('input').forEach(input=>input.checked=input.value===event.target.value);
    selected=statements.find(s=>s.key===event.target.value)||{key:event.target.value,label:`${event.target.value} ${selectedYear}`,days:30,in:0,out:0};
  }else selectedMonths=[...el('monthPicker').querySelectorAll('input:checked')].map(input=>input.value);
  render();
});

el('yearSelect').addEventListener('change',event=>{
  selectedYear=Number(event.target.value);selectedMonths=[];selected={key:'',label:`${selectedYear}`,days:30,in:0,out:0};refreshMonthControls();render();
});

el('categorySelect').addEventListener('change',event=>{
  selectedCategory=event.target.value;
  renderTransactions();
});

el('categoryList').addEventListener('change',event=>{
  const name=event.target.dataset.categoryToggle;if(!name)return;
  hiddenCategories=event.target.checked?hiddenCategories.filter(category=>category!==name):[...new Set([...hiddenCategories,name])];
  localStorage.setItem('hiddenCategories',JSON.stringify(hiddenCategories));renderCategories();drawDonut();
});

document.querySelectorAll('[data-direction]').forEach(button=>button.addEventListener('click',()=>{
  selectedDirection=button.dataset.direction;
  document.querySelectorAll('[data-direction]').forEach(b=>b.classList.toggle('active',b===button));
  render();
}));

document.querySelectorAll('[data-bank]').forEach(button=>button.addEventListener('click',()=>{
  bankFilter=button.dataset.bank;
  document.querySelectorAll('[data-bank]').forEach(b=>b.classList.toggle('active',b===button));
  refreshMonthControls();
  if(!monthAvailable(selected.key)){selectedMonths=[];}
  render();
}));

el('viewAllTransactions').addEventListener('click',()=>{location.hash='#/statements'});
el('manageKeywords').addEventListener('click',()=>{location.hash='#/keywords'});
el('attachStatement').addEventListener('click',()=>{
  const input=el('statementUpload'),file=input.files[0];
  if(!file){el('uploadStatus').textContent='Choose a PDF first.';return}
  const bank=el('uploadBank').value;
  const yearMatch=file.name.match(/20\d{2}/);const year=yearMatch?Number(yearMatch[0]):selectedYear;
  const month=monthNames.find(name=>file.name.toLowerCase().includes(name.toLowerCase()))||selected.key;
  uploadedStatements.push({bank,year,month,name:file.name,url:URL.createObjectURL(file)});
  selectedYear=year;selectedMonths=[month];selected={key:month,label:`${month} ${year}`,days:30,in:0,out:0};bankFilter=bank;
  document.querySelectorAll('[data-bank]').forEach(button=>button.classList.toggle('active',button.dataset.bank===bank));
  refreshYearSelect();refreshMonthControls();render();
  el('uploadStatus').textContent=`Attached ${file.name}. It is ready to view for ${month} ${year}.`;
  input.value='';
});

el('navToggle').addEventListener('click',()=>{
  const sidebar=el('sidebar');
  const open=sidebar.classList.toggle('open');
  el('navToggle').setAttribute('aria-expanded',String(open));
  document.querySelector('.scrim')?.remove();
  if(open){
    const scrim=document.createElement('div');
    scrim.className='scrim';
    scrim.addEventListener('click',()=>{sidebar.classList.remove('open');scrim.remove()});
    document.body.append(scrim);
  }
});

/* ------------------------------------------------------------- keywords --- */

function saveCategoryKeywords(){
  localStorage.setItem('categoryKeywords',JSON.stringify(categoryKeywords));
  el('keywordSaved').textContent='Saved just now';
  setTimeout(()=>el('keywordSaved').textContent='Saved in this browser',1200);
}

el('keywordManager').addEventListener('click',event=>{
  const button=event.target.closest('button[data-action]');
  if(!button)return;
  const category=decodeURIComponent(button.dataset.category);
  const action=button.dataset.action;
  const index=Number(button.dataset.index);
  if(action==='delete'){
    categoryKeywords[category].splice(index,1);
  }
  if(action==='save'){
    const input=el('keywordManager').querySelector(`input[data-edit="${button.dataset.category}"][data-index="${index}"]`);
    const value=input.value.trim();
    if(value)categoryKeywords[category][index]=value;
  }
  if(action==='add'){
    const input=el('keywordManager').querySelector(`input[data-add="${button.dataset.category}"]`);
    const value=input.value.trim();
    if(value&&!categoryKeywords[category].some(keyword=>keyword.toLowerCase()===value.toLowerCase()))
      categoryKeywords[category].push(value);
  }
  saveCategoryKeywords();
  renderKeywordManager();
  render();
});

el('editKeywords').addEventListener('click',()=>{
  const manager=el('keywordManager'),button=el('editKeywords');
  manager.hidden=false;
  button.setAttribute('aria-expanded','true');
});

/* ----------------------------------------------------------------- boot --- */

renderKeywordManager();
routeFromHash();
render();

addEventListener('resize',drawCharts);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',render);
