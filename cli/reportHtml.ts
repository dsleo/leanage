// Template of the self-contained report written by `leanage report`: the webapp's flow (result of interest, what to detect, answer + closure panel)
// in plain HTML/CSS/JS over the closure of your library. No external requests; the data replaces /*DATA*/null.
// Plain string concatenation inside the script: no template literals, so this file stays a single String.raw.
export const REPORT_HTML = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{TITLE}} · Leanage report</title>
<style>
/*FONTS*/
:root{--ink:#12161f;--muted:#5b6472;--line:#d9dde3;--accent:#2748d8;--wash:#e6ebfc;--paper:#f6f7f9;--panel:#fff;--warn:#a14e37;--warnbg:#faece6;--ok:#2f7a55;--okbg:#e4f1ea;--chip:#eceff3}
@media (prefers-color-scheme:dark){:root{--ink:#e6e9f0;--muted:#9aa3b5;--line:#2a3140;--accent:#7b93ff;--wash:#1c2547;--paper:#0e1116;--panel:#161b24;--warn:#e8885f;--warnbg:#2c1d18;--ok:#6fc596;--okbg:#16281f;--chip:#1d2330}}
*{box-sizing:border-box}
body{margin:0;min-width:320px;background:var(--paper);color:var(--ink);font:15px/1.5 'CMU Sans',system-ui,sans-serif}
button,input{font:inherit;color:inherit}button{cursor:pointer}
code,.mono{font-family:'CMU Typewriter',ui-monospace,Menlo,monospace;font-size:13px}
h1,h2,h3{font-family:'CMU Serif',Georgia,serif;font-weight:400;margin:0}
a,.link{color:var(--accent);cursor:pointer;text-decoration:underline;text-underline-offset:2px;background:none;border:0;padding:0}
.site-header{display:flex;justify-content:center;padding:16px 20px 12px;border-bottom:1px solid var(--muted)}
.brand{display:flex;align-items:center;gap:9px;font:400 24px 'CMU Serif',serif;letter-spacing:-.015em;color:var(--ink);text-decoration:none}
.brand svg{width:30px;height:32px}.brand .lb{stroke:var(--muted);stroke-width:1.8;stroke-linecap:round;fill:none}.brand .lr{stroke:var(--accent);stroke-width:2.2;stroke-linecap:round;fill:none}
.brand circle{fill:var(--paper);stroke:var(--muted);stroke-width:1.7}.brand .sel{fill:var(--accent);stroke:var(--paper)}
.brand small{font:11px 'CMU Sans',sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-left:4px}
main{max-width:900px;margin:0 auto;padding:28px 20px 60px}
.hero{text-align:center;margin:34px 0 22px}.hero h1{font-size:44px;letter-spacing:-.02em}.hero h1 em{color:var(--accent);font-style:normal}
.sub{color:var(--muted);font-size:13px;margin-top:6px}
.search-form{display:flex;align-items:center;gap:10px;border:1px solid var(--muted);background:var(--panel);padding:0 6px 0 14px;min-height:50px}
.search-form:focus-within{outline:2px solid var(--accent)}
.search-form input{flex:1;border:0;background:none;outline:0;min-width:0;padding:12px 0;font-size:16px}
.search-form button{width:38px;height:38px;border:0;background:var(--ink);color:var(--paper);font-size:18px}
.search-form button:hover{background:var(--accent)}
.examples{margin:10px 0 0;font-size:12px;color:var(--muted);text-align:center}.examples .link{margin:0 6px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:26px 0 8px}
.card{background:var(--panel);border:1px solid var(--line);padding:12px 14px;text-align:left}
.card b{display:block;font:400 30px 'CMU Serif',serif;line-height:1.1}.card.bad b{color:var(--warn)}.card.good b{color:var(--ok)}
.card span{font-size:12px;color:var(--muted)}.card.on{outline:2px solid var(--accent)}
.section-h{margin:28px 0 10px;font-size:22px}
.candidate{background:var(--panel);border:1px solid var(--line);padding:14px 16px;margin-bottom:8px;display:flex;gap:14px;align-items:center;justify-content:space-between}
.candidate h3{font:500 15px 'CMU Typewriter',monospace;overflow-wrap:anywhere}.candidate p{margin:3px 0 0;font-size:12px;color:var(--muted)}
.btn{border:1px solid var(--ink);background:transparent;padding:0 16px;min-height:38px;font-size:12px;font-weight:700;white-space:nowrap}.btn:hover{background:var(--ink);color:var(--paper)}
.btn.primary{background:var(--ink);color:var(--paper)}.btn.primary:hover{background:var(--accent);border-color:var(--accent)}
.tag{display:inline-block;padding:1px 7px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;line-height:1.5;vertical-align:middle;margin-left:6px}
.tag.lib{color:var(--accent);border-color:var(--accent)}.tag.w{color:var(--warn);border-color:var(--warn)}
.context-bar{border-bottom:1px solid var(--line);background:var(--panel)}.context-inner{max-width:900px;margin:0 auto;padding:12px 20px}
.context-label{display:block;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.context-id{display:flex;align-items:center;flex-wrap:wrap;gap:4px 0;margin-top:2px}.context-id code{font-size:15px;font-weight:500;overflow-wrap:anywhere}
.context-id .ico{margin-left:8px;font-size:12px}.context-sub{font-size:12px;color:var(--muted);margin-top:2px}
.ask h2{font-size:32px;margin:26px 0 14px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.chip{display:inline-flex;gap:6px;align-items:center;background:var(--wash);padding:5px 9px;font:12px 'CMU Typewriter',monospace}.chip button{border:0;background:none;font-size:14px;line-height:1;padding:0}
.sugg{border:1px solid var(--line);background:var(--panel);margin-top:-1px}.sugg div{padding:7px 14px;cursor:pointer;font:13px 'CMU Typewriter',monospace}.sugg div:hover{background:var(--wash)}
.try{font-size:12px;color:var(--muted);margin-top:12px}.try .link{margin-left:10px}
.answers{display:grid;gap:10px;margin-top:14px}
.answer-card{background:var(--panel);border:1px solid var(--line);padding:22px}
.answer-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.answer-head h3{font-size:24px;line-height:1.15;overflow-wrap:anywhere}
.pill{display:inline-flex;gap:6px;align-items:center;padding:6px 9px;white-space:nowrap;font-size:10px;font-weight:700;letter-spacing:.035em;text-transform:uppercase}
.pill.pos{color:var(--ok);background:var(--okbg)}.pill.neg{color:var(--warn);background:var(--warnbg)}.pill.neu{color:var(--muted);background:var(--chip)}
.note{font:17px/1.4 'CMU Serif',serif;color:var(--muted);margin:14px 0}
.path{list-style:none;margin:16px 0 0;padding:0 0 0 3px}.path li{display:flex;align-items:baseline;gap:10px;min-height:32px;position:relative;padding-left:22px}
.path li+li::before{content:'';position:absolute;left:7px;top:-8px;height:14px;width:1px;background:var(--muted)}
.path li::after{content:'';position:absolute;left:3px;top:11px;width:8px;height:8px;border:1px solid var(--muted);background:var(--panel)}
.path li:last-child::after{background:var(--accent);border-color:var(--accent)}
.path code{overflow-wrap:anywhere}.path small{color:var(--muted);font-size:11px}
.closure{margin-top:30px;border-top:1px solid var(--line);padding-top:20px}
.seg{display:inline-flex}.seg button{border:1px solid var(--muted);background:transparent;padding:0 14px;min-height:36px;font-size:12px;font-weight:700}.seg button+button{border-left:0}
.seg button[aria-pressed=true]{background:var(--ink);color:var(--paper)}.seg button:disabled{opacity:.45;cursor:not-allowed}
details.sec{border-bottom:1px solid var(--line);padding:4px 0 14px}details.sec>summary{cursor:pointer;padding:10px 0;font-weight:700;font-size:13px;min-height:40px}
.help{font-size:12px;color:var(--muted);margin:4px 0 10px}
.ax{padding:8px 0;border-bottom:1px solid var(--line)}.ax .p{margin-top:4px;font-size:12px;color:var(--muted)}.ax .p code{font-size:12px}
.controls{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin:6px 0 10px}
.controls input[type=search]{flex:1;min-width:180px;min-height:38px;padding:0 10px;border:1px solid var(--muted);background:var(--panel);font:13px 'CMU Typewriter',monospace}
.controls label{font-size:12px;display:flex;gap:6px;align-items:center}
.group{font:700 12px 'CMU Typewriter',monospace;margin:14px 0 4px;overflow-wrap:anywhere}.group span{color:var(--muted);font-weight:400}
.rows{border:1px solid var(--line);background:var(--panel)}.rows div{display:flex;justify-content:space-between;gap:12px;padding:3px 10px;border-bottom:1px solid var(--line);font-size:12px}
.rows div:last-child{border-bottom:0}.rows .n{font:12px 'CMU Typewriter',monospace;color:var(--accent);background:none;border:0;padding:4px 0;text-align:left;overflow-wrap:anywhere}.rows .d{color:var(--muted);white-space:nowrap}
.rows details{border-bottom:1px solid var(--line)}.rows summary{cursor:pointer;display:flex;justify-content:space-between;padding:6px 10px;font:12px 'CMU Typewriter',monospace}
.rows details div{padding-left:22px}
.graph svg{width:100%;background:var(--panel);border:1px solid var(--line)}svg text{font:10px 'CMU Typewriter',monospace;fill:var(--ink);pointer-events:none}
svg line{stroke:var(--line);stroke-width:1}svg circle{cursor:pointer;stroke:var(--paper);stroke-width:1.5}
.more{margin-top:10px;font-size:12px;color:var(--muted)}
footer{max-width:900px;margin:0 auto;padding:0 20px 40px;text-align:center;font-size:12px;color:var(--muted)}
@media(max-width:600px){.hero h1{font-size:34px}.candidate{flex-direction:column;align-items:stretch}.answer-head{flex-direction:column}}
</style></head><body>
<header class="site-header"><a class="brand" href="#"><svg viewBox="0 0 32 34" aria-hidden="true"><path class="lb" d="M5 17h10m0 0 10-10M15 17l10 10"/><path class="lr" d="M5 17h10l10-10"/><circle cx="5" cy="17" r="2.4"/><circle cx="15" cy="17" r="2.4"/><circle class="sel" cx="25" cy="7" r="2.7"/><circle cx="25" cy="27" r="2.4"/></svg><span>Leanage</span><small>report</small></a></header>
<div id="ctx"></div>
<main id="main"></main>
<footer id="foot"></footer>
<script>
var D=/*DATA*/null;
var $=function(s){return document.querySelector(s)};
var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};

// ---- the closure of your library: nodes 0..nLib-1 are yours, the rest is Mathlib and core
var N=D.names.length,bin=atob(D.edges),by=new Uint8Array(bin.length),pos=0,i,j;
for(i=0;i<bin.length;i++)by[i]=bin.charCodeAt(i);
function rv(){var r=0,m=1,b;do{b=by[pos++];r+=(b&127)*m;m*=128}while(b&128);return r}
var off=new Uint32Array(N+1),tgt=[],bt=[];
for(i=0;i<N;i++){var c=rv(),prev=0;off[i+1]=off[i]+c;for(j=0;j<c;j++){var v=rv();prev+=Math.floor(v/4);tgt.push(prev);bt.push(v%4)}}
tgt=Int32Array.from(tgt);bt=Uint8Array.from(bt);
var byName={};D.names.forEach(function(n,k){byName[n]=k});
var BP={};D.bp.forEach(function(k){BP[k]=1});
var GEN=/^(_|(match|proof|eq|congr_eq|hcongr|unsafe|unsafe_impl)_\d+$|eq_def$|eq_unfold$)/,PRIV=/^_private\..*?\.0\./;
var isGen=function(n){return n.replace(PRIV,'').split('.').some(function(p){return GEN.test(p)})};
function owner(n){n=n.replace(PRIV,'');var p=n.split('.'),e=p.length;while(e>0&&GEN.test(p[e-1]))e--;return e===0?n:p.slice(0,e).join('.')}
function collapse(a){var o=[];a.forEach(function(n){var w=owner(n);if(o[o.length-1]!==w)o.push(w)});return o}
var isLib=function(k){return k<D.nLib};
function reach(s,statement){
  var order=[s],parent=new Int32Array(N).fill(-1),depth=new Uint16Array(N),seen=new Uint8Array(N),h=0;seen[s]=1;
  while(h<order.length){var u=order[h++];for(var k=off[u];k<off[u+1];k++){var w=tgt[k];if(seen[w])continue;
    if(statement&&!((bt[k]&1)||(u!==s&&(bt[k]&2))))continue;seen[w]=1;parent[w]=u;depth[w]=depth[u]+1;order.push(w)}}
  return{order:order,parent:parent,depth:depth,seen:seen}}
function pathNames(r,t){var p=[t];for(var v=r.parent[t];v>=0;v=r.parent[v])p.push(v);return collapse(p.reverse().map(function(k){return D.names[k]}))}
var AXN=['Classical.choice','Quot.sound','propext','sorryAx'];
for(i=0;i<D.nLib;i++)if(D.kinds[i]==='a'&&AXN.indexOf(D.names[i])<0)AXN.push(D.names[i]);
function axiomsOf(s,statement){var r=reach(s,statement),out=[];AXN.forEach(function(a){var k=byName[a];if(k!==undefined&&r.seen[k])out.push({a:a,p:pathNames(r,k)})});return out}

// ---- tags and links
function tagOf(k){if(isLib(k))return['lib',D.project];var m=D.mods[D.nm[k]],r=m.split('.')[0];
  if(r==='Mathlib'||r==='Archive'||r==='Counterexamples')return['','Mathlib'];if(r==='TauCeti')return['','TauCeti'];if(r==='Init'||r==='Std'||r==='Lean')return['','Lean core'];if(r==='Batteries')return['','Batteries'];return['','']}
function tagHtml(k){var t=tagOf(k);return t[1]?'<span class="tag '+t[0]+'">'+esc(t[1])+'</span>':''}
function docsUrl(k){var m=D.mods[D.nm[k]],t=tagOf(k)[1];if(isLib(k)||!t||t==='Batteries')return null;
  var base=t==='TauCeti'?'https://taucetiproject.github.io/TauCeti/docs':'https://leanprover-community.github.io/mathlib4_docs';
  return base+'/'+m.split('.').map(encodeURIComponent).join('/')+'.html#'+encodeURIComponent(D.names[k])}
function editorUrl(k){var m=D.mods[D.nm[k]],f=D.files[m];if(!f||!D.root)return null;return 'vscode://file/'+encodeURI(D.root.replace(/\/$/,'')+'/'+f)+(D.lines[k]?':'+D.lines[k]:'')}
function where(k){var m=D.mods[D.nm[k]],f=D.files[m];return isLib(k)&&f?f+(D.lines[k]?':'+D.lines[k]:''):m}
var KIND={t:'theorem',d:'definition',i:'inductive type',a:'axiom',o:'opaque declaration'};

// ---- what the library says about itself
var focus=D.focus,ax={},used=new Uint8Array(D.nLib),ownerIdx={};
function own(k){if(ownerIdx[k]===undefined){var o=byName[owner(D.names[k])];ownerIdx[k]=o===undefined?k:o}return ownerIdx[k]}
for(i=0;i<D.nLib;i++){var oi=own(i);for(j=off[i];j<off[i+1];j++){var w=tgt[j];if(w<D.nLib&&own(w)!==oi)used[own(w)]=1}}
focus.forEach(function(k){ax[k]=axiomsOf(k,false).map(function(x){return x.a})});
var has=function(k,a){return ax[k].indexOf(a)>=0};
var sorryL=focus.filter(function(k){return has(k,'sorryAx')}),classL=focus.filter(function(k){return D.kinds[k]==='t'&&has(k,'Classical.choice')}),unusedL=focus.filter(function(k){return !used[k]});
var libMathlib={};focus.forEach(function(k){for(var z=off[k];z<off[k+1];z++){var w=tgt[z];if(w>=D.nLib&&!isGen(D.names[w]))libMathlib[w]=1}});

// ---- state lives in the hash, so Back and Forward move between the stages
var st={scope:'proof',hideGen:true,hideBp:false,filter:'',more:{}};
function go(p){var u=new URLSearchParams();for(var k in p){[].concat(p[k]).forEach(function(v){if(v!==undefined&&v!==null&&v!=='')u.append(k,v)})}location.hash=u.toString()}
function cur(){var u=new URLSearchParams(location.hash.slice(1));return{r:u.get('r'),d:u.getAll('d'),run:u.get('run'),q:u.get('q')||'',f:u.get('f')||''}}
function head(){return '<div class="context-inner"><span class="context-label">Result of interest</span>'}
function ctx(k){
  var doc=docsUrl(k),ed=editorUrl(k);
  $('#ctx').innerHTML='<div class="context-bar">'+head()+'<div class="context-id"><code>'+esc(D.names[k])+'</code>'+tagHtml(k)+(doc?'<a class="ico" href="'+doc+'" target="_blank" rel="noopener" title="Docs">docs</a>':'')+(ed?'<a class="ico" href="'+ed+'" title="Open in your editor">open in editor</a>':'')+' <a class="ico" href="#" title="Change">change</a></div><div class="context-sub">'+(KIND[D.kinds[k]]||'declaration')+' · '+esc(where(k))+'</div></div></div>'}
$('#foot').textContent='Built locally from your Lake project, nothing uploaded · Mathlib '+(D.mathlib?D.mathlib.slice(0,7):'?')+' · generated '+D.built;

// ---- stage 1: search and confirm a result of interest
function candidates(q,f){
  var pool=f==='sorry'?sorryL:f==='classical'?classL:f==='unused'?unusedL:focus;q=q.toLowerCase();
  var hit=pool.filter(function(k){return !q||D.names[k].toLowerCase().indexOf(q)>=0});
  hit.sort(function(a,b){var x=D.names[a].toLowerCase().indexOf(q),y=D.names[b].toLowerCase().indexOf(q);return x-y||(D.names[a]<D.names[b]?-1:1)});return hit}
function renderSearch(p){
  $('#ctx').innerHTML='';
  var list=candidates(p.q,p.f),shown=st.more.search||6;
  var card=function(cls,n,t,f){return '<button class="card '+cls+(p.f===f?' on':'')+'" data-f="'+f+'"><b>'+n+'</b><span>'+t+'</span></button>'};
  var h='<div class="hero"><h1>Leanage <em>report</em></h1><div class="sub">'+esc(D.project)+' · '+focus.length+' declarations of interest · '+D.nLib+' in the library · '+Object.keys(libMathlib).length+' distinct Mathlib/core declarations used directly</div></div>'+
   '<form class="search-form" id="sf"><span>&#9906;</span><input id="q" aria-label="Declaration of your library" value="'+esc(p.q)+'" placeholder="e.g. main_theorem, or part of a name" autocomplete="off"><button type="submit" aria-label="Search">&rarr;</button></form>'+
   '<div class="cards">'+card(sorryL.length?'bad':'good',sorryL.length,'reach sorryAx (unfinished)','sorry')+card('',classL.length,'theorems reach Classical.choice','classical')+card('',unusedL.length,'not used by the library','unused')+'</div>'+
   '<h2 class="section-h" id="candidate-title">'+(p.f?{sorry:'Unfinished results',classical:'Results using Classical.choice',unused:'Results nothing else uses'}[p.f]:'Results of interest')+' <span class="sub">('+list.length+')</span></h2>';
  if(!list.length)h+='<div class="sub">No declaration matches.</div>';
  list.slice(0,shown).forEach(function(k){h+='<div class="candidate"><div><h3>'+esc(D.names[k])+tagHtml(k)+(has(k,'sorryAx')?'<span class="tag w">sorry</span>':'')+'</h3><p>'+(KIND[D.kinds[k]]||'')+' · '+esc(where(k))+'</p></div><button class="btn" data-k="'+k+'">Confirm this result</button></div>'});
  if(list.length>shown)h+='<button class="btn" id="more">Show more ('+(list.length-shown)+')</button>';
  $('#main').innerHTML=h;
  $('#sf').onsubmit=function(e){e.preventDefault();st.more.search=0;go({q:$('#q').value})};
  document.querySelectorAll('.card').forEach(function(b){b.onclick=function(){go({f:p.f===b.dataset.f?'':b.dataset.f,q:p.q})}});
  document.querySelectorAll('.candidate .btn').forEach(function(b){b.onclick=function(){go({r:D.names[+b.dataset.k]})}});
  var m=$('#more');if(m)m.onclick=function(){st.more.search=shown+10;renderSearch(p)}}

// ---- stage 2: what would you like to detect?
function renderAsk(p,k){
  ctx(k);
  var h='<section class="ask"><h2>What would you like to detect?</h2><form class="search-form" id="tf"><span>&#9906;</span><input id="t" aria-label="Name a result it should depend on" placeholder="e.g. uses Classical.choice, or depends on Nat.add_comm" autocomplete="off"><button type="submit" aria-label="Add" title="Add">+</button></form><div id="sg"></div>'+
   '<div class="chips" id="chips">'+p.d.map(function(t){return '<span class="chip">'+esc(t)+'<button data-t="'+esc(t)+'" aria-label="Remove">&times;</button></span>'}).join('')+'</div>'+
   '<div class="try">Try this on <a class="link" data-add="Classical.choice">Axiom of choice</a><a class="link" data-add="sorryAx">Unfinished proof (sorry)</a><a class="link" data-add="propext">Propositional extensionality</a></div>'+
   '<p style="margin-top:22px"><button class="btn primary" id="run">'+(p.d.length?'Find it':'Show axioms and closure')+'</button></p><p class="help">Without a target you get the axioms the result depends on and its whole closure; with targets you also get one witness path for each.</p></section>';
  $('#main').innerHTML=h;
  var add=function(t){t=t.trim();if(!t)return;if(byName[t]===undefined){var s=suggest(t);if(!s.length)return;t=s[0]}if(p.d.indexOf(t)<0)go({r:p.r,d:p.d.concat([t])})};
  $('#tf').onsubmit=function(e){e.preventDefault();add($('#t').value)};
  $('#t').oninput=function(){var s=suggest($('#t').value);$('#sg').innerHTML=s.length?'<div class="sugg">'+s.map(function(x){return '<div data-s="'+esc(x)+'">'+esc(x)+'</div>'}).join('')+'</div>':''};
  $('#sg').onclick=function(e){var t=e.target.closest('[data-s]');if(t)add(t.dataset.s)};
  document.querySelectorAll('[data-add]').forEach(function(a){a.onclick=function(){add(a.dataset.add)}});
  document.querySelectorAll('.chip button').forEach(function(b){b.onclick=function(){go({r:p.r,d:p.d.filter(function(x){return x!==b.dataset.t})})}});
  $('#run').onclick=function(){go({r:p.r,d:p.d,run:1})}}
function suggest(t){t=t.trim().toLowerCase();if(t.length<2)return[];var a=[],b=[];
  for(var z=0;z<N&&a.length+b.length<40;z++){var n=D.names[z];if(isGen(n)||BP[z])continue;var l=n.toLowerCase();if(l.indexOf(t)===0)a.push(n);else if(l.indexOf(t)>0)b.push(n)}
  return a.concat(b).slice(0,8)}

// ---- stage 3: the answer and the closure panel
function pathHtml(names){return '<ol class="path">'+names.map(function(n){var k=byName[n];return '<li><code>'+esc(n)+'</code>'+(k!==undefined?'<small>'+esc(tagOf(k)[1])+' · '+esc(D.mods[D.nm[k]])+'</small>':'')+'</li>'}).join('')+'</ol>'}
function card(title,pill,body){return '<article class="answer-card"><div class="answer-head"><h3>'+title+'</h3>'+pill+'</div>'+body+'</article>'}
function renderResults(p,k){
  ctx(k);
  var statement=st.scope==='statement',r=reach(k,statement),h='<section><h2 id="results-title" style="font-size:32px;margin:26px 0 4px">Answer</h2><div class="answers">';
  if(!p.d.length){
    var a=axiomsOf(k,statement);
    h+=card('Axioms',a.length?'<span class="pill '+(a.some(function(x){return x.a==='sorryAx'})?'neg':'neu')+'">uses '+a.length+(a.length>1?' axioms':' axiom')+'</span>':'<span class="pill pos">no axioms</span>',
      '<p class="note">'+(a.length?'Following every dependency '+(statement?'of the statement':'of the proof')+', '+esc(D.names[k])+' reaches '+a.map(function(x){return '<code>'+esc(x.a)+'</code>'}).join(', ')+'.':esc(D.names[k])+' reaches no axiom.')+'</p>'+a.map(function(x){return '<div class="ax"><code>'+esc(x.a)+'</code>'+pathHtml(x.p)+'</div>'}).join(''))}
  p.d.forEach(function(t){var tk=byName[t],hit=tk!==undefined&&r.seen[tk];
    h+=card('Depends on <code>'+esc(t)+'</code>?',hit?'<span class="pill pos">yes</span>':'<span class="pill neg">no</span>',
      hit?'<p class="note">One witness path'+(statement?' through the statement':'')+':</p>'+pathHtml(pathNames(r,tk)):'<p class="note">'+esc(D.names[k])+(tk===undefined?' never reaches a declaration called ':' does not reach ')+'<code>'+esc(t)+'</code>'+(statement?' through its statement':'')+'. The closure is complete, so this is a definite absence.</p>')});
  h+='</div></section>'+closurePanel(k,r,statement)+graphPanel(k);
  $('#main').innerHTML=h;wire(p,k,r)}
function closurePanel(k,r,statement){
  var a=axiomsOf(k,statement);
  var h='<section class="closure"><h2 style="font-size:24px;margin-bottom:10px">Closure</h2><div class="controls"><div class="seg"><button data-sc="proof" aria-pressed="'+(!statement)+'">Whole proof</button><button data-sc="statement" aria-pressed="'+statement+'"'+(D.scope?'':' disabled')+'>Statement only</button></div></div><p class="help">'+(statement?'What the statement alone depends on: its type, and through any definition it mentions, that definition.':'Every declaration the proof depends on, directly or not.')+'</p>';
  h+='<details class="sec" open><summary>Axioms ('+a.length+')</summary>'+(a.length?a.map(function(x){return '<div class="ax"><code>'+esc(x.a)+'</code><div class="p">'+x.p.map(function(n){return '<code>'+esc(n)+'</code>'}).join(' &rarr; ')+'</div></div>'}).join(''):'<p class="help">None.</p>')+'</details>';
  var rows=r.order.slice(1).filter(function(z){var n=D.names[z];return !(st.hideGen&&isGen(n))&&!(st.hideBp&&BP[z])&&(!st.filter||n.toLowerCase().indexOf(st.filter.toLowerCase())>=0)});
  var mine=rows.filter(isLib),theirs=rows.filter(function(z){return !isLib(z)});
  h+='<details class="sec" open><summary>Dependencies ('+rows.length+')</summary><div class="controls"><input type="search" id="flt" placeholder="Filter by name" value="'+esc(st.filter)+'"><label><input type="checkbox" id="hg"'+(st.hideGen?' checked':'')+'> Hide generated names</label><label><input type="checkbox" id="hb"'+(st.hideBp?' checked':'')+'> Hide instances and coercions</label><button class="btn" id="csv">Export CSV</button></div>';
  h+='<div class="group">In your library <span>'+mine.length+'</span></div>'+rowsHtml(mine,r,function(z){return D.mods[D.nm[z]]},'lib');
  h+='<div class="group">From Mathlib and Lean core <span>'+theirs.length+'</span></div>'+rowsHtml(theirs,r,function(z){return D.mods[D.nm[z]].split('.').slice(0,2).join('.')},'ext');
  return h+'</details></section>'}
function rowsHtml(rows,r,key,id){
  if(!rows.length)return '<p class="help">None.</p>';var g={},o=[];rows.forEach(function(z){var m=key(z);if(!g[m]){g[m]=[];o.push(m)}g[m].push(z)});
  o.sort(function(a,b){return g[b].length-g[a].length||(a<b?-1:1)});
  return '<div class="rows">'+o.map(function(m){var cap=st.more[id+m]||80,l=g[m].slice(0,cap);
    return '<details><summary><span>'+esc(m)+'</span><span class="d">'+g[m].length+'</span></summary>'+l.map(function(z){return '<div><button class="n" data-k="'+z+'">'+esc(D.names[z])+'</button><span class="d">'+r.depth[z]+'</span></div>'}).join('')+(g[m].length>cap?'<div><button class="link" data-more="'+esc(id+m)+'" data-cap="'+cap+'">Show more</button></div>':'')+'</details>'}).join('')+'</div>'}
function graphPanel(k){
  var seen={},ids=[k];seen[k]=1;
  (function look(u,depth){for(var z=off[u];z<off[u+1];z++){var w=tgt[z];if(seen[w])continue;if(isGen(D.names[w])&&depth<3){seen[w]=1;look(w,depth+1);continue}if(BP[w])continue;seen[w]=1;if(ids.length<30)ids.push(w)}})(k,0);
  var ix={};ids.forEach(function(z,n){ix[z]=n});var edges=[];ids.forEach(function(u){for(var z=off[u];z<off[u+1];z++)if(ix[tgt[z]]!==undefined&&u!==tgt[z])edges.push([ix[u],ix[tgt[z]]])});
  var nodes=ids.map(function(z){return{id:z,label:D.names[z],c:z===k?'var(--accent)':isLib(z)?'#8a5bd6':'var(--muted)',r:z===k?10:6}});
  return '<section class="closure graph"><h2 style="font-size:24px;margin-bottom:10px">Direct dependencies</h2><p class="help">Purple nodes are your library, grey ones Mathlib and core. Click a node to make it the result of interest.</p>'+drawGraph(nodes,edges,820,420)+'</section>'}
function layout(n,edges,w,h){
  var p=[],i,j,k;for(i=0;i<n;i++){var a=i/n*6.283;p.push({x:w/2+Math.cos(a)*w/3,y:h/2+Math.sin(a)*h/3,vx:0,vy:0})}
  for(k=0;k<250;k++){
    for(i=0;i<n;i++)for(j=i+1;j<n;j++){var dx=p[i].x-p[j].x,dy=p[i].y-p[j].y,d2=dx*dx+dy*dy+.01,f=2600/d2,d=Math.sqrt(d2);p[i].vx+=dx/d*f;p[i].vy+=dy/d*f;p[j].vx-=dx/d*f;p[j].vy-=dy/d*f}
    edges.forEach(function(e){var a=p[e[0]],b=p[e[1]],dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)+.01,f=(d-60)*.02;a.vx+=dx/d*f;a.vy+=dy/d*f;b.vx-=dx/d*f;b.vy-=dy/d*f});
    p.forEach(function(q){q.vx+=(w/2-q.x)*.005;q.vy+=(h/2-q.y)*.005;q.x=Math.max(20,Math.min(w-20,q.x+q.vx*.5));q.y=Math.max(14,Math.min(h-14,q.y+q.vy*.5));q.vx*=.6;q.vy*=.6})}
  return p}
function drawGraph(nodes,edges,w,h){
  var p=layout(nodes.length,edges,w,h),s='<svg viewBox="0 0 '+w+' '+h+'">';
  edges.forEach(function(e){s+='<line x1="'+p[e[0]].x+'" y1="'+p[e[0]].y+'" x2="'+p[e[1]].x+'" y2="'+p[e[1]].y+'"/>'});
  nodes.forEach(function(n,i){var l=n.label.length>28?'…'+n.label.slice(-27):n.label;s+='<circle data-k="'+n.id+'" cx="'+p[i].x+'" cy="'+p[i].y+'" r="'+n.r+'" fill="'+n.c+'"><title>'+esc(n.label)+'</title></circle><text x="'+(p[i].x+n.r+3)+'" y="'+(p[i].y+3)+'">'+esc(l)+'</text>'});
  return s+'</svg>'}
function wire(p,k,r){
  var again=function(){renderResults(p,k)};
  document.querySelectorAll('[data-sc]').forEach(function(b){b.onclick=function(){st.scope=b.dataset.sc;again()}});
  var f=$('#flt');f.oninput=function(){st.filter=f.value;var pos=f.selectionStart;again();var g=$('#flt');g.focus();g.setSelectionRange(pos,pos)};
  $('#hg').onchange=function(){st.hideGen=this.checked;again()};$('#hb').onchange=function(){st.hideBp=this.checked;again()};
  document.querySelectorAll('[data-k]').forEach(function(b){b.onclick=function(){go({r:D.names[+b.dataset.k]})}});
  document.querySelectorAll('[data-more]').forEach(function(b){b.onclick=function(e){e.preventDefault();st.more[b.dataset.more]=+b.dataset.cap+200;var open=[].map.call(document.querySelectorAll('.rows details[open] summary span:first-child'),function(s){return s.textContent});again();document.querySelectorAll('.rows details').forEach(function(d){if(open.indexOf(d.querySelector('summary span').textContent)>=0)d.open=true})}});
  $('#csv').onclick=function(){var rows=['name,module,depth'];r.order.slice(1).forEach(function(z){var n=D.names[z];if(st.hideGen&&isGen(n))return;if(st.hideBp&&BP[z])return;rows.push('"'+n.replace(/"/g,'""')+'",'+D.mods[D.nm[z]]+','+r.depth[z])});
    var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.join('\n')+'\n'],{type:'text/csv'}));a.download=D.names[k]+'.csv';a.click()}}

function render(){
  var p=cur();window.scrollTo(0,0);
  var k=p.r?byName[p.r]:undefined;
  if(k===undefined)return renderSearch(p);
  p.r=D.names[k];
  if(p.run)renderResults(p,k);else renderAsk(p,k)}
window.onhashchange=render;render();
</script></body></html>`
