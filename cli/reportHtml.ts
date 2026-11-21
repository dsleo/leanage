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
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.answer-stage{margin-top:6px}
.answer-card{padding:24px}.answer-head h3{font:500 25px/1.1 'CMU Serif',serif;letter-spacing:-.02em;margin:8px 0 0}
.status-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;white-space:nowrap;font-size:10px;font-weight:700;letter-spacing:.035em}
.status-pill.positive{color:var(--ok);background:var(--okbg)}.status-pill.pending{color:var(--accent);background:var(--wash)}.status-pill.neutral{color:var(--muted);background:var(--chip)}.status-pill.negative{color:var(--warn);background:var(--warnbg)}
.answer-note{font:17px/1.4 'CMU Serif',serif;color:var(--muted);margin:18px 0}
.witness{margin-top:14px;border-left:3px solid var(--accent);background:var(--chip);padding:14px}
.story-headline{font:500 19px/1.35 'CMU Serif',serif;margin:0 0 4px;max-width:60ch}
.story-step{display:grid;gap:2px;padding:4px 0;min-width:0}.story-statement{margin-left:23px;color:var(--muted);font-size:12px}
.path-node{margin-left:0;font:12px 'CMU Typewriter',monospace;overflow-wrap:anywhere}.edge-type{margin-right:8px;color:var(--muted);font:12px 'CMU Typewriter',monospace}
.fine-print{font-size:12px;color:var(--muted);margin:14px 0 0}
.full-detail{margin-top:24px;border:1px solid var(--line);background:var(--panel)}
.full-detail>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:14px;padding:14px 16px;min-height:56px}
.full-detail>summary::-webkit-details-marker{display:none}.full-detail>summary:hover{background:var(--wash)}
.full-detail-text{display:grid;gap:2px;min-width:0;flex:1}.full-detail-text strong{font-size:14px}.full-detail-text small{font-size:12px;color:var(--muted)}
.full-detail-chevron{color:var(--muted);transition:transform .2s}.full-detail:not([open]) .full-detail-chevron{transform:rotate(-90deg)}
.full-detail .closure{margin:0;padding:16px;border-top:1px solid var(--line)}.full-detail .closure h2{font-size:24px;margin-bottom:10px}
#gx{padding:16px 16px 0}
.graph-explorer{border:1px solid #2c2f36;background:#101319;color:#dadce1;min-width:0;box-shadow:5px 5px 0 var(--line)}
.graph-explorer.expanded{position:fixed;inset:18px;z-index:50;display:flex;flex-direction:column;box-shadow:0 16px 60px #101114b3}
.graph-toolbar{min-height:54px;padding:8px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #383d46}
.graph-toolbar-title{display:flex;align-items:baseline;gap:12px;min-width:0;flex:1}.graph-toolbar-title strong{color:#d8def1;font-size:11px}
.graph-toolbar-actions{display:flex;align-items:center;gap:3px}
.graph-toolbar-actions button{min-height:40px;min-width:40px;padding:0 9px;display:inline-flex;align-items:center;justify-content:center;background:transparent;border:1px solid transparent;color:#577ae4}
.graph-toolbar-actions button:hover{border-color:#2f4a9d;background:#202328}
.graph-search{display:flex;align-items:center;gap:7px;color:#6e7789;flex:1;min-width:0;padding:0 4px}.graph-search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#e1e3e7;font-size:11px}
.graph-search:focus-within{outline:2px solid #2b4eb7;outline-offset:3px}
.graph-matches{padding:8px 13px;display:flex;flex-wrap:wrap;gap:5px;max-height:100px;overflow:auto;border-bottom:1px solid #383d46;font-size:11px;color:#9198a6}
.graph-matches[hidden]{display:none}.graph-matches button{color:#577ae4;background:#202328;border:1px solid #3e434d;padding:3px 6px;font:10px 'CMU Typewriter',monospace}
.graph-layout{display:grid;grid-template-columns:minmax(0,1fr) 210px;min-height:420px}.graph-layout:not(.with-inspector){grid-template-columns:minmax(0,1fr)}
.graph-explorer.expanded .graph-layout{min-height:0;flex:1}
.graph-viewport{height:420px;overflow:auto;overscroll-behavior:contain;background-color:#111316;background-image:radial-gradient(#565d6b .7px,transparent .7px);background-size:18px 18px}
.graph-explorer.expanded .graph-viewport,.graph-explorer.expanded .graph-inspector{height:100%}
.graph-viewport svg{display:block;touch-action:pan-x pan-y;cursor:grab;background:none;border:0}.graph-viewport svg:active{cursor:grabbing}
.graph-edges path{fill:none;stroke:#697284;stroke-width:1.2;opacity:.7;pointer-events:stroke}.graph-edges path.highlight{stroke:#6686e6;stroke-width:2;opacity:1}
.graph-nodes g{cursor:pointer;outline:none}.graph-nodes rect{fill:#1f2227;stroke:#717b8e;stroke-width:1}.graph-nodes circle{fill:#949baa;stroke:none;cursor:pointer}
.graph-nodes text{font:10px 'CMU Typewriter',monospace;fill:#e1e3e7;pointer-events:none}
.graph-nodes g.on-path rect{stroke:#476ad2;stroke-width:1.5}
.graph-nodes g.evidence-target:not(.selected) rect{fill:#272a31;stroke:#4e73e2;stroke-width:2}.graph-nodes g.evidence-target:not(.selected) circle{fill:#4e73e2}
.graph-nodes g.selected rect{fill:#4e73e2;stroke:#97adee;stroke-width:2}.graph-nodes g.selected text,.graph-nodes g.selected circle{fill:#14161a}
.graph-nodes g.match:not(.selected) rect{stroke:#6686e6;stroke-width:2.5}.graph-nodes g:focus-visible rect{stroke:#6686e6;stroke-width:2.5}
.graph-inspector{border-left:1px solid #383d46;height:420px;overflow:auto;padding:18px 13px;background:#15171b}
.graph-inspector .eyebrow{margin:0;font-size:10px;font-weight:700;letter-spacing:.14em;color:#9198a6}
.graph-inspector h3{font:600 13px/1.35 'CMU Typewriter',monospace;color:#d4dbf1;overflow-wrap:anywhere;margin:10px 0}
.graph-node-meta{display:flex;flex-wrap:wrap;gap:5px 10px;color:#949baa;font-size:11px}
.graph-relations,.graph-path{border-top:1px solid #383d46;padding-top:11px;margin-top:15px}
.graph-relations strong,.graph-path strong{display:block;color:#9198a6;text-transform:uppercase;letter-spacing:.08em;font-size:10px;margin-bottom:8px}
.graph-relations button{display:flex;align-items:baseline;gap:5px;width:100%;padding:5px 0;background:none;border:0;text-align:left;color:#577ae4;font:10px 'CMU Typewriter',monospace}
.graph-relations button span:nth-child(2){overflow-wrap:anywhere;min-width:0;flex:1}.graph-relations small{color:#9198a6;font-size:11px}
.graph-path ol{margin:0;padding-left:16px}.graph-path li{margin:5px 0;color:#9198a6;font-size:10px}
.graph-path button{border:0;background:none;color:#577ae4;font:10px 'CMU Typewriter',monospace;text-align:left;overflow-wrap:anywhere;padding:0}
.graph-inspector>a{display:block;color:#577ae4;font-size:10px;margin-top:18px;text-decoration:none}
.graph-caption{color:#9198a6;font-size:11px;line-height:1.5;padding:10px 13px;margin:0;border-top:1px solid #383d46}
.graph-explorer.witness-mode .graph-layout{min-height:260px}.graph-explorer.witness-mode .graph-viewport,.graph-explorer.witness-mode .graph-inspector{height:260px}
.graph-explorer.witness-mode .graph-viewport{background-image:none}.graph-explorer.witness-long .graph-layout{min-height:420px}
.graph-explorer.witness-long .graph-viewport,.graph-explorer.witness-long .graph-inspector{height:420px}
.graph-explorer.expanded.witness-mode .graph-viewport,.graph-explorer.expanded.witness-mode .graph-inspector{height:100%}
@media(max-width:600px){.graph-layout{display:flex;flex-direction:column}.graph-viewport{height:340px}.graph-inspector{height:auto;max-height:300px;border-left:0;border-top:1px solid #383d46}}
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


// ---- plain-English search, like the webapp: the one online feature, off until you click it (only the text you typed leaves this page)
var TG='https://leanage.vercel.app/tg/graph/embedding';
function semantic(q,done){
  fetch(TG+'?'+new URLSearchParams({query:q,n_results:'24',formality:'formal'})).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(function(j){
    var seen={},out=[];(j.results||[]).forEach(function(x){var l=x.external_id||x.title||'';if(!/^Mathlib/i.test(l)||!x.name||seen[x.name])return;seen[x.name]=1;out.push({name:x.name,slogan:x.slogan||''})});done(null,out.slice(0,8))}).catch(function(e){done(e)})}
function semHtml(list){return list.length?'<div class="sugg">'+list.map(function(x){return '<div data-n="'+esc(x.name)+'"><code>'+esc(x.name)+'</code>'+(byName[x.name]===undefined?' <span class="sub">not reached by your library</span>':'')+'<br><span class="sub">'+esc(x.slogan)+'</span></div>'}).join('')+'</div>':'<p class="help">No Mathlib statement matches.</p>'}
function semRun(btn,box,q,pick){
  if(!q.trim())return;box.innerHTML='<p class="help">Searching TheoremGraph…</p>';
  semantic(q,function(e,list){if(e){box.innerHTML='<p class="help">Plain-English search is unavailable right now ('+esc(e.message)+'). Search by Lean name works offline.</p>';return}
    box.innerHTML=semHtml(list);box.onclick=function(ev){var t=ev.target.closest('[data-n]');if(t)pick(t.dataset.n)}})}

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
   '<p class="examples"><button class="link" id="sem" type="button">Search Mathlib in plain English</button> · sends the text you typed to TheoremGraph, nothing from your code</p><div id="semres"></div><div class="cards">'+card(sorryL.length?'bad':'good',sorryL.length,'reach sorryAx (unfinished)','sorry')+card('',classL.length,'theorems reach Classical.choice','classical')+card('',unusedL.length,'not used by the library','unused')+'</div>'+
   '<h2 class="section-h" id="candidate-title">'+(p.f?{sorry:'Unfinished results',classical:'Results using Classical.choice',unused:'Results nothing else uses'}[p.f]:'Results of interest')+' <span class="sub">('+list.length+')</span></h2>';
  if(!list.length)h+='<div class="sub">No declaration matches.</div>';
  list.slice(0,shown).forEach(function(k){h+='<div class="candidate"><div><h3>'+esc(D.names[k])+tagHtml(k)+(has(k,'sorryAx')?'<span class="tag w">sorry</span>':'')+'</h3><p>'+(KIND[D.kinds[k]]||'')+' · '+esc(where(k))+'</p></div><button class="btn" data-k="'+k+'">Confirm this result</button></div>'});
  if(list.length>shown)h+='<button class="btn" id="more">Show more ('+(list.length-shown)+')</button>';
  $('#main').innerHTML=h;
  $('#sem').onclick=function(){semRun(this,$('#semres'),$('#q').value,function(n){if(byName[n]!==undefined)go({r:n})})};
  $('#sf').onsubmit=function(e){e.preventDefault();st.more.search=0;go({q:$('#q').value})};
  document.querySelectorAll('.card').forEach(function(b){b.onclick=function(){go({f:p.f===b.dataset.f?'':b.dataset.f,q:p.q})}});
  document.querySelectorAll('.candidate .btn').forEach(function(b){b.onclick=function(){go({r:D.names[+b.dataset.k]})}});
  var m=$('#more');if(m)m.onclick=function(){st.more.search=shown+10;renderSearch(p)}}

// ---- stage 2: what would you like to detect?
function renderAsk(p,k){
  ctx(k);
  var h='<section class="ask"><h2>What would you like to detect?</h2><form class="search-form" id="tf"><span>&#9906;</span><input id="t" aria-label="Name a result it should depend on" placeholder="e.g. induction, Classical.choice, or Nat.add_comm" autocomplete="off"><button type="submit" aria-label="Add" title="Add">+</button></form><div id="sg"></div>'+
   '<div class="chips" id="chips">'+p.d.map(function(t){return '<span class="chip">'+esc(METHODS[t]?METHODS[t].label:t)+'<button data-t="'+esc(t)+'" aria-label="Remove">&times;</button></span>'}).join('')+'</div>'+
   '<p class="try"><button class="link" id="tsem" type="button">Search Mathlib in plain English</button> · sends the text you typed to TheoremGraph</p><div id="tsemres"></div><div class="try">Try this on <a class="link" data-add="Classical.choice">Axiom of choice</a><a class="link" data-add="induction">Induction</a><a class="link" data-add="cases">Case analysis</a><a class="link" data-add="absurd">Contradiction</a><a class="link" data-add="sorryAx">Unfinished proof (sorry)</a><a class="link" data-add="propext">Propositional extensionality</a></div>'+
   '<p style="margin-top:22px"><button class="btn primary" id="run">'+(p.d.length?'Find it':'Show axioms and closure')+'</button></p><p class="help">Without a target you get the axioms the result depends on and its whole closure; with targets you also get one witness path for each.</p></section>';
  $('#main').innerHTML=h;
  var add=function(t){t=t.trim();if(!t)return;if(SYN[t.toLowerCase()])t=SYN[t.toLowerCase()];if(!METHODS[t]&&byName[t]===undefined){var s=suggest(t);if(!s.length)return;t=s[0]}if(p.d.indexOf(t)<0)go({r:p.r,d:p.d.concat([t])})};
  $('#tf').onsubmit=function(e){e.preventDefault();add($('#t').value)};
  $('#t').oninput=function(){var s=suggest($('#t').value);$('#sg').innerHTML=s.length?'<div class="sugg">'+s.map(function(x){return '<div data-s="'+esc(x)+'">'+esc(x)+'</div>'}).join('')+'</div>':''};
  $('#sg').onclick=function(e){var t=e.target.closest('[data-s]');if(t)add(t.dataset.s)};
  document.querySelectorAll('[data-add]').forEach(function(a){a.onclick=function(){add(a.dataset.add)}});
  document.querySelectorAll('.chip button').forEach(function(b){b.onclick=function(){go({r:p.r,d:p.d.filter(function(x){return x!==b.dataset.t})})}});
  $('#tsem').onclick=function(){semRun(this,$('#tsemres'),$('#t').value,function(n){if(p.d.indexOf(n)<0)go({r:p.r,d:p.d.concat([n])})})};
  $('#run').onclick=function(){go({r:p.r,d:p.d,run:1})}}
function suggest(t){t=t.trim().toLowerCase();if(t.length<2)return[];var a=[],b=[];
  for(var z=0;z<N&&a.length+b.length<40;z++){var n=D.names[z];if(isGen(n)||BP[z])continue;var l=n.toLowerCase();if(l.indexOf(t)===0)a.push(n);else if(l.indexOf(t)>0)b.push(n)}
  return a.concat(b).slice(0,8)}


// ---- method questions (induction, case analysis, contradiction): structural markers in the closure, and tactics read from your own source
var METHODS={
  induction:{label:'Induction',obs:['induction'],rel:[],rules:[{n:'Nat.rec',g:'observed',x:'Nat.rec is Lean’s built-in rule for induction on natural numbers, and this proof is built from it. That shows the argument runs by induction or recursion, but not that the author typed the induction tactic.'},{n:'Nat.recAux',g:'observed',x:'Nat.recAux is induction on natural numbers where the successor case receives the previous case as its hypothesis. That shows the argument runs by induction, but not that the author typed the induction tactic.'}]},
  cases:{label:'Case analysis',obs:['cases','by_cases','split_ifs','fin_cases'],rel:['rcases','obtain','rintro','match'],rules:[{n:'Or.elim',g:'observed',x:'Reference to disjunction elimination, which splits an Or proof into alternatives.'},{n:'Nat.casesAuxOn',g:'observed',x:'Reference to Nat.casesAuxOn, which has separate zero and successor branches.'}]},
  absurd:{label:'Proof by contradiction',obs:['by_contra','contrapose'],rel:['exfalso'],rules:[{n:'Decidable.byContradiction',g:'observed',x:'Reference to the named contradiction principle.'},{n:'False.elim',g:'related',x:'Reference to False elimination (ex falso). This alone does not establish proof by contradiction.'}]}};
var SYN={'induction':'induction','case analysis':'cases','cases':'cases','contradiction':'absurd','by contradiction':'absurd','proof by contradiction':'absurd','absurd':'absurd'};
function methodEvidence(k,r,m){
  var M=METHODS[m],ev=[],ord={observed:0,related:1};
  r.order.forEach(function(z){var n=D.names[z];
    if(z!==k)M.rules.forEach(function(ru){if(n===ru.n)ev.push({z:z,g:ru.g,src:false,tok:ru.n,x:ru.x})});
    var tc=z<D.nLib&&D.tac[z];if(tc)tc.split(',').forEach(function(t){
      if(M.obs.indexOf(t)>=0)ev.push({z:z,g:'observed',src:true,tok:t,x:'The '+t+' tactic is written in the source of this declaration (read from your Lean file).'});
      else if(M.rel.indexOf(t)>=0)ev.push({z:z,g:'related',src:true,tok:t,x:t+' appears in the source of this declaration. It is related to the question but does not by itself show the method.'})})});
  ev.sort(function(a,b){return ord[a.g]-ord[b.g]||r.depth[a.z]-r.depth[b.z]||(D.names[a.z]<D.names[b.z]?-1:1)});return ev}

// ---- stage 3: the answer (cards, like the webapp), then the dependency graph and the closure panel in one disclosure
var INFORMAL={'Nat.rec':'the induction principle on ℕ','Nat.recAux':'induction on ℕ with the previous case as hypothesis','Or.elim':'case analysis on a disjunction','Decidable.byContradiction':'proof by contradiction','False.elim':'ex falso (from a contradiction, anything)','Classical.choice':'the axiom of choice','Classical.em':'the law of excluded middle','propext':'propositional extensionality','Quot.sound':'quotient soundness','funext':'function extensionality','sorryAx':'an unfinished proof (sorry)'};
function collapseSteps(names){var o=[];names.forEach(function(n,i){var w=owner(n),last=i===names.length-1;if(!last&&o.length&&owner(o[o.length-1])===w)return;o.push(last||w===n?n:w)});return o}
function pathIds(r,t){var p=[t];for(var v=r.parent[t];v>=0;v=r.parent[v])p.push(v);return p.reverse()}
function pathNames(r,t){return collapseSteps(pathIds(r,t).map(function(k){return D.names[k]}))}
function pathHtml(names){return '<ol class="path">'+names.map(function(n,i){var k=byName[n],d=k!==undefined?docsUrl(k):null;
  return '<li><div class="story-step"><span class="path-node">'+(i>0?'<span class="edge-type">uses</span>':'')+esc(n)+(d?' <a class="ico" href="'+d+'" target="_blank" rel="noopener" title="Docs">docs</a>':'')+'</span>'+(k!==undefined?'<span class="story-statement">'+esc(tagOf(k)[1])+' · '+esc(D.mods[D.nm[k]])+'</span>':'')+'</div></li>'}).join('')+'</ol>'}
function card(title,pill,body){return '<article class="answer-card"><div class="answer-head"><h3>'+title+'</h3>'+pill+'</div>'+body+'</article>'}
function headline(root,t,steps){var via=INFORMAL[t];return 'A reference to '+esc(t)+' enters through '+esc(via||t)+', '+(steps===0?'in the selected proof itself':steps+(steps===1?' step':' steps')+' down')+'.'}
function renderResults(p,k){
  ctx(k);
  var statement=st.scope==='statement',r=reach(k,statement),ev=[],h='<section class="answer-stage"><h2 id="results-title" class="sr-only">Answer</h2><div class="answers">';
  if(!p.d.length){
    var a=axiomsOf(k,statement);a.forEach(function(x){ev.push(pathIds(r,byName[x.a]))});
    h+=card('Axioms',a.length?'<span class="status-pill '+(a.some(function(x){return x.a==='sorryAx'})?'negative':'pending')+'">Uses '+a.length+(a.length>1?' axioms':' axiom')+'</span>':'<span class="status-pill positive">No axioms</span>',
      '<p class="answer-note">'+(a.length?esc(D.names[k])+' '+(statement?'states something that':'depends on')+' '+a.map(function(x){return esc(INFORMAL[x.a]||x.a)}).join(', ')+'.':esc(D.names[k])+' reaches no axiom, '+(statement?'in its statement':'in its proof')+'.')+'</p>'+a.map(function(x){return '<div class="witness"><p class="story-headline">'+esc(x.a)+'</p>'+pathHtml(x.p)+'</div>'}).join(''))}
  p.d.forEach(function(t){
    if(METHODS[t]){var me=methodEvidence(k,r,t),pr=me.filter(function(e){return e.g==='observed'})[0]||me[0];
      me.slice(0,7).forEach(function(e){ev.push(pathIds(r,e.z))});
      var steps=pr?pathNames(r,pr.z).length-1:0,where=steps===0?'in the selected proof itself':steps+(steps===1?' step':' steps')+' down';
      h+=card(METHODS[t].label,!pr?'<span class="status-pill neutral">Not found</span>':pr.g==='related'?'<span class="status-pill pending">Related only</span>':'<span class="status-pill positive">'+(pr.src?'Written in the proof':'Found in dependencies')+'</span>',
        pr?'<div class="witness"><p class="story-headline">'+(pr.src?esc(METHODS[t].label)+' is written in the proof of '+esc(D.names[pr.z])+', '+where+'.':esc(METHODS[t].label)+' enters through '+esc(INFORMAL[D.names[pr.z]]||D.names[pr.z])+', '+where+'.')+'</p>'+pathHtml(pathNames(r,pr.z))+'<p class="fine-print">'+esc(pr.x)+'</p></div>'
          :'<p class="answer-note">No evidence of '+esc(METHODS[t].label.toLowerCase())+' appeared among the '+r.order.length.toLocaleString()+' declarations reachable from this result. For methods this is not proof of absence: tactics are read from your library’s source only, and Mathlib declarations count only through structural markers such as Nat.rec.</p>');return}
    var tk=byName[t],hit=tk!==undefined&&r.seen[tk];if(hit)ev.push(pathIds(r,tk));
    var nm=t.charAt(0).toUpperCase()+t.slice(1);
    h+=card('Depends on '+esc(t),hit?'<span class="status-pill positive">Found in dependencies</span>':'<span class="status-pill neutral">Never reached</span>',
      hit?'<div class="witness"><p class="story-headline">'+headline(D.names[k],t,pathNames(r,tk).length-1)+'</p>'+pathHtml(pathNames(r,tk))+'<p class="fine-print">One shortest path'+(statement?', following the statement only':'')+'. Others may exist.</p></div>'
         :'<p class="answer-note">Complete closure: none of the '+r.order.length.toLocaleString()+' declarations reachable from this result is '+esc(t)+(statement?' (following the statement only)':'')+'. This holds for the pinned Mathlib commit only; the closure includes compiler-generated declarations.</p>')});
  h+='</div><details class="full-detail" open><summary><span class="full-detail-text"><strong>Dependency graph</strong><small>'+r.order.length.toLocaleString()+' declarations in the closure, and the axioms they use</small></span><span class="full-detail-chevron">&#9662;</span></summary><div id="gx"></div><div id="cp"></div></details></section>';
  $('#main').innerHTML=h;
  mountGraph($('#gx'),k,r,ev,statement);
  paintPanel(p,k,r,statement)}
function paintPanel(p,k,r,statement){
  $('#cp').innerHTML=closurePanel(k,r,statement);wirePanel(p,k,r,statement)}
function closurePanel(k,r,statement){
  var a=axiomsOf(k,statement);
  var h='<section class="closure"><h2>Closure</h2><div class="controls"><div class="seg"><button data-sc="proof" aria-pressed="'+(!statement)+'">Whole proof</button><button data-sc="statement" aria-pressed="'+statement+'"'+(D.scope?'':' disabled')+'>Statement only</button></div></div><p class="help">'+(statement?'What the statement alone depends on: its type, and through any definition it mentions, that definition.':'Every declaration the proof depends on, directly or not.')+'</p>';
  h+='<details class="sec"><summary>Axioms ('+a.length+')</summary>'+(a.length?a.map(function(x){return '<div class="ax"><code>'+esc(x.a)+'</code><div class="p">'+x.p.map(function(n){return '<code>'+esc(n)+'</code>'}).join(' &rarr; ')+'</div></div>'}).join(''):'<p class="help">None.</p>')+'</details>';
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
function exportCsv(k,r){var rows=['name,module,depth'];r.order.slice(1).forEach(function(z){var n=D.names[z];if(st.hideGen&&isGen(n))return;if(st.hideBp&&BP[z])return;rows.push('"'+n.replace(/"/g,'""')+'",'+D.mods[D.nm[z]]+','+r.depth[z])});
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.join('\n')+'\n'],{type:'text/csv'}));a.download=D.names[k]+'.csv';a.click()}
function wirePanel(p,k,r,statement){
  document.querySelectorAll('[data-sc]').forEach(function(b){b.onclick=function(){st.scope=b.dataset.sc;renderResults(p,k)}});
  var f=$('#flt');f.oninput=function(){st.filter=f.value;var pos=f.selectionStart;paintPanel(p,k,r,statement);var g=$('#flt');g.focus();g.setSelectionRange(pos,pos)};
  $('#hg').onchange=function(){st.hideGen=this.checked;paintPanel(p,k,r,statement)};$('#hb').onchange=function(){st.hideBp=this.checked;paintPanel(p,k,r,statement)};
  document.querySelectorAll('#cp [data-k]').forEach(function(b){b.onclick=function(){go({r:D.names[+b.dataset.k]})}});
  document.querySelectorAll('[data-more]').forEach(function(b){b.onclick=function(e){e.preventDefault();st.more[b.dataset.more]=+b.dataset.cap+200;var open=[].map.call(document.querySelectorAll('.rows details[open] summary span:first-child'),function(s){return s.textContent});paintPanel(p,k,r,statement);document.querySelectorAll('.rows details').forEach(function(d){if(open.indexOf(d.querySelector('summary span').textContent)>=0)d.open=true})}});
  $('#csv').onclick=function(){exportCsv(k,r)}}

// ---- the graph explorer of the webapp: columns by depth, witness path view, search, inspector, pan and pinch zoom
var NW=225,NH=32,CG=92,RG=22,MG=54;
function ico(p){return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>'}
var ICON={eye:ico('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),net:ico('<rect x="9" y="2" width="6" height="6"/><rect x="2" y="16" width="6" height="6"/><rect x="16" y="16" width="6" height="6"/><path d="M12 8v4M5 16v-4h14v4"/>'),focus:ico('<circle cx="12" cy="12" r="3"/><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>'),max:ico('<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>'),x:ico('<path d="M18 6 6 18M6 6l12 12"/>'),dl:ico('<path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16"/>'),search:ico('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>')};
var shortName=function(v){return v.length>32?'…'+v.slice(-31):v};
function mountGraph(box,k,r,ev,statement){
  var allowed=function(u,z){return !statement||(bt[z]&1)||(u!==k&&(bt[z]&2))};
  var view={},vl=[];
  var grow=function(z){for(var c=z;c>=0&&!view[c];c=r.parent[c]){view[c]=1;vl.push(c)}};
  grow(k);ev.forEach(function(pa){pa.forEach(grow)});
  for(var z=off[k];z<off[k+1]&&vl.length<140;z++){var w=tgt[z];if(r.seen[w]&&allowed(k,z))grow(w)}
  var edges=[];vl.forEach(function(u){for(var z=off[u];z<off[u+1];z++){var w=tgt[z];if(view[w]&&r.seen[u]&&allowed(u,z))edges.push([u,w])}});
  var first=ev.length?ev[0]:null;
  var G={sel:null,q:'',zoom:1,full:true,big:false,narrow:window.matchMedia('(max-width:600px)').matches};
  var evEdges={},evNodes={},evTargets={};ev.forEach(function(pa){pa.forEach(function(x,i){evNodes[x]=1;if(i)evEdges[pa[i-1]+'>'+x]=1});evTargets[pa[pa.length-1]]=1});
  function fullLayout(){
    var by={},maxD=0;vl.forEach(function(u){var d=r.depth[u];(by[d]=by[d]||[]).push(u);if(d>maxD)maxD=d});
    var rows=0;for(var d in by){by[d].sort(function(a,b){return D.names[a]<D.names[b]?-1:1});rows=Math.max(rows,by[d].length)}
    var height=Math.max(450,rows*(NH+RG)+MG*2),width=Math.max(660,(maxD+1)*(NW+CG)+MG*2),pos={};
    for(var d2 in by){var g=by[d2],gh=g.length*(NH+RG)-RG;g.forEach(function(u,i){pos[u]={x:MG+(+d2)*(NW+CG),y:Math.max(MG,(height-gh)/2)+i*(NH+RG),depth:+d2}})}
    return{pos:pos,width:width,height:height}}
  function witnessLayout(vertical){var pos={};first.forEach(function(u,d){pos[u]={depth:d,x:vertical?(660-NW)/2:MG+d*(NW+CG),y:vertical?43+d*72:112}});
    return{pos:pos,width:vertical?660:Math.max(660,first.length*(NW+CG)-CG+MG*2),height:vertical?Math.max(320,first.length*72+28):260}}
  var FL=fullLayout();
  box.innerHTML='<div class="graph-explorer"><div class="graph-toolbar"><div class="graph-toolbar-title"><label class="graph-search" id="gs">'+ICON.search+'<span class="sr-only">Search declarations in the graph</span><input id="gq" placeholder="Search observed nodes…"></label><strong id="gt">Witness path</strong></div><div class="graph-toolbar-actions"><button type="button" id="gw" title="Show witness path"></button><button type="button" id="gr" title="Reset view (double-click the background)">'+ICON.focus+'</button><button type="button" id="ge" title="Export the closure as CSV">'+ICON.dl+'</button><button type="button" id="gf" title="View graph full screen">'+ICON.max+'</button></div></div><div class="graph-matches" id="gm" hidden></div><div class="graph-layout" id="gl"></div><p class="graph-caption" id="gc"></p></div>';
  var X=box.querySelector('.graph-explorer');
  function cur(){var full=G.full||!first,vert=!full&&(first.length>2||G.narrow);return{full:full,vert:vert,L:full?FL:witnessLayout(vert)}}
  function pathOf(id){return pathIds(r,id)}
  function paint(keep){
    var c=cur(),L=c.L,sel=G.sel!==null&&L.pos[G.sel]?G.sel:null,vp=X.querySelector('.graph-viewport'),sl=vp?vp.scrollLeft:0,stp=vp?vp.scrollTop:0;
    X.className='graph-explorer '+(G.big?'expanded ':'')+(c.full?'full':'witness-mode')+(c.vert?' witness-long':'');
    X.querySelector('#gs').style.display=c.full?'flex':'none';X.querySelector('#gt').style.display=c.full?'none':'block';
    var gw=X.querySelector('#gw');gw.style.display=first?'':'none';gw.innerHTML=G.full?ICON.eye:ICON.net;gw.title=G.full?'Show witness path':'Show full graph';
    X.querySelector('#gf').innerHTML=G.big?ICON.x:ICON.max;
    var q=G.q.trim().toLowerCase(),match=function(u){return q&&D.names[u].toLowerCase().indexOf(q)>=0};
    var ms=q?Object.keys(L.pos).filter(function(u){return match(+u)}):[],gm=X.querySelector('#gm');gm.hidden=!q;
    gm.innerHTML=q?(ms.length?ms.slice(0,12).map(function(u){return '<button type="button" data-f="'+u+'">'+esc(D.names[u])+'</button>'}).join('')+(ms.length>12?'<span>+ '+(ms.length-12)+' more</span>':''):'<span>No observed declaration matches.</span>'):'';
    var path=sel!==null?pathOf(sel):[],pe={},pn={};path.forEach(function(x,i){pn[x]=1;if(i)pe[path[i-1]+'>'+x]=1});
    var s='<div class="graph-viewport" aria-label="Dependency graph, scroll to navigate"><svg width="'+L.width*G.zoom+'" height="'+L.height*G.zoom+'" viewBox="0 0 '+L.width+' '+L.height+'"><defs><marker id="wa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7b93ff"/></marker></defs><g class="graph-edges">';
    edges.forEach(function(e){var a=L.pos[e[0]],b=L.pos[e[1]];if(!a||!b)return;var hl=pe[e[0]+'>'+e[1]]||evEdges[e[0]+'>'+e[1]];
      var sx=c.vert?a.x+NW/2:a.x+NW,ex=c.vert?b.x+NW/2:b.x,sy=c.vert?a.y+NH:a.y+NH/2,ey=c.vert?b.y:b.y+NH/2,dl=Math.max(20,(c.vert?ey-sy:ex-sx)/2);
      s+='<path class="'+(hl?'highlight':'')+'"'+(c.full?'':' marker-end="url(#wa)"')+' d="'+(c.vert?'M '+sx+' '+sy+' C '+sx+' '+(sy+dl)+', '+ex+' '+(ey-dl)+', '+ex+' '+ey:'M '+sx+' '+sy+' C '+(sx+dl)+' '+sy+', '+(ex-dl)+' '+ey+', '+ex+' '+ey)+'"><title>'+esc(D.names[e[0]]+' → '+D.names[e[1]])+'</title></path>'});
    s+='</g><g class="graph-nodes">';
    Object.keys(L.pos).forEach(function(u){u=+u;var n=L.pos[u];s+='<g role="button" tabindex="0" data-id="'+u+'" class="'+(u===sel?'selected ':'')+(pn[u]||evNodes[u]?'on-path ':'')+(evTargets[u]?'evidence-target ':'')+(match(u)?'match':'')+'" transform="translate('+n.x+', '+n.y+')"><rect width="'+NW+'" height="'+NH+'" rx="3"/><circle cx="13" cy="'+NH/2+'" r="3"/><text x="23" y="20">'+esc(shortName(D.names[u]))+'</text><title>'+esc(D.names[u])+'</title></g>'});
    s+='</g></svg></div>';
    if(sel!==null){var inc=edges.filter(function(e){return e[1]===sel}),out=edges.filter(function(e){return e[0]===sel}),doc=docsUrl(sel),ed=editorUrl(sel);
      s+='<aside class="graph-inspector"><p class="eyebrow">SELECTED DECLARATION</p><h3>'+esc(D.names[sel])+tagHtml(sel)+'</h3>'+
        (c.full?'<div class="graph-node-meta"><span>Depth '+r.depth[sel]+'</span><span>'+esc(where(sel))+'</span></div>'+
        '<div class="graph-relations"><strong>'+inc.length+' incoming</strong>'+inc.slice(0,9).map(function(e){return '<button data-f="'+e[0]+'"><span>&#8601;</span><span>'+esc(D.names[e[0]])+'</span></button>'}).join('')+(inc.length>9?'<small>+ '+(inc.length-9)+' more</small>':'')+'</div>'+
        '<div class="graph-relations"><strong>'+out.length+' outgoing</strong>'+out.slice(0,9).map(function(e){return '<button data-f="'+e[1]+'"><span>&#8599;</span><span>'+esc(D.names[e[1]])+'</span></button>'}).join('')+(out.length>9?'<small>+ '+(out.length-9)+' more</small>':'')+'</div>'+
        (path.length>1?'<div class="graph-path"><strong>Path from the theorem</strong><ol>'+path.map(function(x){return '<li><button data-f="'+x+'">'+esc(D.names[x])+'</button></li>'}).join('')+'</ol></div>':''):'')+
        (doc?'<a href="'+doc+'" target="_blank" rel="noopener">View docs &#8599;</a>':'')+(ed?'<a href="'+ed+'">Open in your editor &#8599;</a>':'')+'<a href="#" data-r="'+sel+'">Make it the result of interest &#8594;</a></aside>'}
    var gl=X.querySelector('#gl');gl.className='graph-layout'+(sel!==null?' with-inspector':'');gl.innerHTML=s;
    X.querySelector('#gc').innerHTML=c.full?'Showing '+Object.keys(FL.pos).length+' of '+r.order.length.toLocaleString()+' declarations of the closure: the witness paths and the direct dependencies of the result. Click a node to inspect it; pinch or ctrl+scroll to zoom; double-click the background to reset.':'One witness path from the result of interest to what you asked about.';
    var nv=gl.querySelector('.graph-viewport');if(keep){nv.scrollLeft=sl;nv.scrollTop=stp}
    wireGraph(nv)}
  function center(u,smooth){var c=cur(),n=c.L.pos[u],a=X.querySelector('.graph-viewport');if(!n||!a)return;a.scrollTo({left:(n.x+NW/2)*G.zoom-a.clientWidth/2,top:(n.y+NH/2)*G.zoom-a.clientHeight/2,behavior:smooth?'smooth':'auto'})}
  function focusNode(u){G.sel=u;if(!cur().L.pos[u]){G.full=true}paint(false);requestAnimationFrame(function(){center(u,true)})}
  function fitWitness(){if(!first)return;var c=cur(),a=X.querySelector('.graph-viewport');
    var ns=(c.full?first.slice(-3):first).map(function(u){return c.L.pos[u]}).filter(Boolean);if(!ns.length||!a)return;
    var x0=Math.min.apply(0,ns.map(function(n){return n.x})),x1=Math.max.apply(0,ns.map(function(n){return n.x+NW})),y0=Math.min.apply(0,ns.map(function(n){return n.y})),y1=Math.max.apply(0,ns.map(function(n){return n.y+NH}));
    var nz=c.full?Math.max(.3,Math.min(1.3,(a.clientWidth-140)/(x1-x0),(a.clientHeight-140)/(y1-y0))):1;G.zoom=nz;paint(false);
    requestAnimationFrame(function(){var b=X.querySelector('.graph-viewport');b.scrollTo({left:(x0+x1)/2*nz-b.clientWidth/2,top:(y0+y1)/2*nz-b.clientHeight/2,behavior:'smooth'})})}
  function reset(){G.sel=null;if(first){fitWitness();return}G.zoom=1;paint(false)}
  function wireGraph(vp){
    X.querySelectorAll('[data-id]').forEach(function(g){g.onclick=function(){focusNode(+g.dataset.id)};g.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();focusNode(+g.dataset.id)}}});
    X.querySelectorAll('[data-f]').forEach(function(b){b.onclick=function(){focusNode(+b.dataset.f)}});
    X.querySelectorAll('[data-r]').forEach(function(a){a.onclick=function(e){e.preventDefault();go({r:D.names[+a.dataset.r]})}});
    var svg=vp.querySelector('svg'),drag=null;
    svg.onpointerdown=function(e){if(e.target!==svg)return;drag={x:e.clientX,y:e.clientY,l:vp.scrollLeft,t:vp.scrollTop};svg.setPointerCapture(e.pointerId)};
    svg.onpointermove=function(e){if(!drag)return;vp.scrollLeft=drag.l-(e.clientX-drag.x);vp.scrollTop=drag.t-(e.clientY-drag.y)};
    svg.onpointerup=svg.onpointercancel=function(){drag=null};svg.ondblclick=function(e){if(e.target===svg)reset()};
    vp.addEventListener('wheel',function(e){if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();var rc=vp.getBoundingClientRect(),px=e.clientX-rc.left,py=e.clientY-rc.top,b=G.zoom,n=Math.max(.25,Math.min(2.5,b*Math.exp(-e.deltaY*.01)));G.zoom=n;paint(true);var v2=X.querySelector('.graph-viewport');v2.scrollLeft=(vp.scrollLeft+px)*(n/b)-px;v2.scrollTop=(vp.scrollTop+py)*(n/b)-py},{passive:false})}
  X.querySelector('#gq').oninput=function(){G.q=this.value;paint(true)};
  X.querySelector('#gm').onclick=function(e){var b=e.target.closest('[data-f]');if(b)focusNode(+b.dataset.f)};
  X.querySelector('#gw').onclick=function(){G.full=!G.full;G.zoom=1;paint(false);requestAnimationFrame(function(){if(G.full&&G.sel!==null)center(G.sel,true);else fitWitness()})};
  X.querySelector('#gr').onclick=reset;X.querySelector('#ge').onclick=function(){exportCsv(k,r)};
  X.querySelector('#gf').onclick=function(){G.big=!G.big;paint(true)};
  paint(false);if(first)requestAnimationFrame(fitWitness)}

function render(){
  var p=cur();window.scrollTo(0,0);
  var k=p.r?byName[p.r]:undefined;
  if(k===undefined)return renderSearch(p);
  p.r=D.names[k];
  if(p.run)renderResults(p,k);else renderAsk(p,k)}
window.onhashchange=render;render();
</script></body></html>`
