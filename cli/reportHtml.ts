// Template of the self-contained report written by `leanage report`. No external requests; the data replaces /*DATA*/null.
// Plain string concatenation inside the script: no template literals, so this file stays a single String.raw.
export const REPORT_HTML = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{TITLE}} · Leanage report</title>
<style>
:root{--bg:#faf8f3;--panel:#fff;--ink:#1d1b16;--mute:#6b665b;--line:#e4dfd2;--accent:#6b3fa0;--warn:#b3471d;--ok:#2d7a4f;--chip:#f0ece1}
@media (prefers-color-scheme:dark){:root{--bg:#16150f;--panel:#1e1d16;--ink:#ece8da;--mute:#9a9585;--line:#34322a;--accent:#b99be0;--warn:#e8885f;--ok:#6fc596;--chip:#2a2820}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 ui-serif,Georgia,serif}
header{padding:20px 24px 8px;border-bottom:1px solid var(--line)}h1{margin:0;font-size:22px}h2{font-size:15px;margin:0 0 8px;font-variant:small-caps;letter-spacing:.04em}
.sub{color:var(--mute);font-size:13px;margin-top:2px}
.wrap{display:grid;grid-template-columns:320px 1fr;min-height:calc(100vh - 80px)}
aside{border-right:1px solid var(--line);padding:12px;overflow:auto;max-height:calc(100vh - 80px);position:sticky;top:0}
main{padding:20px 24px;min-width:0}
input{width:100%;padding:7px 9px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:6px;font:inherit}
.mod{margin:12px 0 2px;font:600 12px ui-monospace,Menlo,monospace;color:var(--mute);cursor:pointer}
.item{padding:3px 6px;border-radius:5px;cursor:pointer;font:13px ui-monospace,Menlo,monospace;word-break:break-all}.item:hover,.item.on{background:var(--chip)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:18px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;cursor:pointer}.card b{font-size:26px;display:block}
.card.bad b{color:var(--warn)}.card.good b{color:var(--ok)}
.box{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;margin-bottom:16px}
.tag{display:inline-block;font:11px ui-monospace,Menlo,monospace;padding:1px 6px;border-radius:9px;background:var(--chip);margin-left:4px}.tag.w{color:var(--warn)}.tag.l{color:var(--accent)}
code,.mono{font:13px ui-monospace,Menlo,monospace}a,.link{color:var(--accent);cursor:pointer}
.path div{padding:1px 0}.path .lib{color:var(--accent)}
svg{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:10px}svg text{font:10px ui-monospace,Menlo,monospace;fill:var(--ink);pointer-events:none}
svg line{stroke:var(--line);stroke-width:1}svg circle{cursor:pointer;stroke:var(--bg);stroke-width:1.5}
ul.plain{margin:0;padding-left:18px}
@media(max-width:800px){.wrap{grid-template-columns:1fr}aside{position:static;max-height:260px;border-right:0;border-bottom:1px solid var(--line)}}
</style></head><body>
<header><h1 id="title"></h1><div class="sub" id="sub"></div></header>
<div class="wrap"><aside><input id="q" placeholder="Search declarations" autocomplete="off"><div id="list"></div></aside><main id="main"></main></div>
<script>
var D=/*DATA*/null;
var $=function(s){return document.querySelector(s)};
var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var byName={};D.decls.forEach(function(d,i){byName[d.n]=i});
var users=D.decls.map(function(){return[]});D.decls.forEach(function(d,i){d.d.forEach(function(t){users[t].push(i)})});
var focus=D.decls.map(function(d,i){return i}).filter(function(i){return D.decls[i].f});
var hasAx=function(d,a){return d.ax.some(function(x){return x.a===a})};
var sorry=focus.filter(function(i){return hasAx(D.decls[i],'sorryAx')});
var classical=focus.filter(function(i){var d=D.decls[i];return d.k==='t'&&hasAx(d,'Classical.choice')});
var unused=focus.filter(function(i){return D.decls[i].u===0});
var color=function(m){var h=0;for(var i=0;i<m.length;i++)h=(h*31+m.charCodeAt(i))%360;return 'hsl('+h+',55%,55%)'};
var short=function(n){return n.length>28?'…'+n.slice(-27):n};
$('#title').textContent=D.project;
$('#sub').textContent=focus.length+' declarations of interest, '+D.decls.length+' in the library · Mathlib '+(D.mathlib?D.mathlib.slice(0,7):'?')+' · generated '+D.built+' · built locally, nothing uploaded';

function badges(d){var s='';if(hasAx(d,'sorryAx'))s+='<span class="tag w">sorry</span>';if(d.k==='t'&&hasAx(d,'Classical.choice'))s+='<span class="tag">classical</span>';return s}
function renderList(){
  var q=$('#q').value.toLowerCase(),html='',last=-1;
  focus.slice().sort(function(a,b){var x=D.decls[a],y=D.decls[b];return D.mods[x.m]<D.mods[y.m]?-1:D.mods[x.m]>D.mods[y.m]?1:x.n<y.n?-1:1}).forEach(function(i){
    var d=D.decls[i];if(q&&d.n.toLowerCase().indexOf(q)<0)return;
    if(d.m!==last){html+='<div class="mod" data-m="'+d.m+'">'+esc(D.mods[d.m])+'</div>';last=d.m}
    html+='<div class="item" data-i="'+i+'">'+esc(d.n)+badges(d)+'</div>'});
  $('#list').innerHTML=html||'<div class="sub">No match</div>'}
$('#q').oninput=renderList;
$('#list').onclick=function(e){var t=e.target.closest('.item');if(t)show(+t.dataset.i)};

function layout(n,edges,w,h){
  var p=[],i,j,k;for(i=0;i<n;i++){var a=i/n*6.283;p.push({x:w/2+Math.cos(a)*w/3,y:h/2+Math.sin(a)*h/3,vx:0,vy:0})}
  for(k=0;k<250;k++){
    for(i=0;i<n;i++)for(j=i+1;j<n;j++){var dx=p[i].x-p[j].x,dy=p[i].y-p[j].y,d2=dx*dx+dy*dy+.01,f=2600/d2,d=Math.sqrt(d2);p[i].vx+=dx/d*f;p[i].vy+=dy/d*f;p[j].vx-=dx/d*f;p[j].vy-=dy/d*f}
    edges.forEach(function(e){var a=p[e[0]],b=p[e[1]],dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)+.01,f=(d-60)*.02;a.vx+=dx/d*f;a.vy+=dy/d*f;b.vx-=dx/d*f;b.vy-=dy/d*f});
    p.forEach(function(q){q.vx+=(w/2-q.x)*.005;q.vy+=(h/2-q.y)*.005;q.x=Math.max(20,Math.min(w-20,q.x+q.vx*.5));q.y=Math.max(14,Math.min(h-14,q.y+q.vy*.5));q.vx*=.6;q.vy*=.6})}
  return p}
function graph(nodes,edges,onclick,w,h){
  var p=layout(nodes.length,edges,w,h),s='<svg viewBox="0 0 '+w+' '+h+'">';
  edges.forEach(function(e){s+='<line x1="'+p[e[0]].x+'" y1="'+p[e[0]].y+'" x2="'+p[e[1]].x+'" y2="'+p[e[1]].y+'"/>'});
  nodes.forEach(function(n,i){s+='<circle data-k="'+n.id+'" cx="'+p[i].x+'" cy="'+p[i].y+'" r="'+(n.r||7)+'" fill="'+n.c+'"><title>'+esc(n.label)+'</title></circle><text x="'+(p[i].x+(n.r||7)+3)+'" y="'+(p[i].y+3)+'">'+esc(short(n.label))+'</text>'});
  return s+'</svg>'}

function overview(){
  var list=function(ids){return ids.slice(0,60).map(function(i){return '<div class="item" data-i="'+i+'">'+esc(D.decls[i].n)+'</div>'}).join('')+(ids.length>60?'<div class="sub">and '+(ids.length-60)+' more</div>':'')};
  var uses={};focus.forEach(function(i){D.decls[i].ml.forEach(function(n){uses[n]=(uses[n]||0)+1})});
  var top=Object.keys(uses).sort(function(a,b){return uses[b]-uses[a]}).slice(0,15);
  var me={},ed={};D.decls.forEach(function(d,i){d.d.forEach(function(t){var a=d.m,b=D.decls[t].m;if(a!==b){var k=a+'>'+b;ed[k]=(ed[k]||0)+1}})});
  var mods=D.mods.map(function(m,i){return i}).filter(function(i){return focus.some(function(f){return D.decls[f].m===i})});
  var pos={};mods.forEach(function(m,i){pos[m]=i});
  var edges=Object.keys(ed).map(function(k){var a=k.split('>');return[pos[+a[0]],pos[+a[1]]]}).filter(function(e){return e[0]!==undefined&&e[1]!==undefined});
  var nodes=mods.map(function(m){return{id:m,label:D.mods[m],c:color(D.mods[m]),r:9+Math.min(12,Math.sqrt(D.decls.filter(function(d){return d.m===m}).length))}});
  $('#main').innerHTML='<div class="cards">'+
   '<div class="card '+(sorry.length?'bad':'good')+'" data-show="sorry"><b>'+sorry.length+'</b>reach sorryAx (unfinished)</div>'+
   '<div class="card" data-show="classical"><b>'+classical.length+'</b>theorems reach Classical.choice</div>'+
   '<div class="card" data-show="unused"><b>'+unused.length+'</b>not used by the library</div>'+
   '<div class="card"><b>'+Object.keys(uses).length+'</b>distinct Mathlib/core declarations used directly</div></div>'+
   '<div class="box" id="detail" style="display:none"></div>'+
   '<div class="box"><h2>Modules</h2><div class="sub">Edges: a declaration of one module uses one of another. Click a module to filter the list.</div>'+(nodes.length>1?graph(nodes,edges,null,700,360):'<div class="sub">One module.</div>')+'</div>'+
   '<div class="box"><h2>Most used Mathlib declarations</h2><ul class="plain">'+top.map(function(n){return '<li class="mono">'+esc(n)+' <span class="tag">'+uses[n]+'</span></li>'}).join('')+'</ul></div>';
  $('#main').onclick=function(e){
    var c=e.target.closest('[data-show]');
    if(c){var m={sorry:sorry,classical:classical,unused:unused}[c.dataset.show];var t={sorry:'Reach sorryAx',classical:'Theorems reaching Classical.choice',unused:'Not used by anything else in the library (results, or dead code)'}[c.dataset.show];if(m){var b=$('#detail');b.style.display='block';b.innerHTML='<h2>'+t+'</h2>'+list(m)}return}
    var i=e.target.closest('.item');if(i){show(+i.dataset.i);return}
    var n=e.target.closest('circle');if(n){$('#q').value='';renderList();var el=document.querySelector('.mod[data-m="'+n.dataset.k+'"]');if(el)el.scrollIntoView()}}}

function pathHtml(p){return '<div class="path">'+p.map(function(n,i){var lib=byName[n]!==undefined;return '<div class="'+(lib?'lib':'')+'">'+(i?'→ ':'')+(lib?'<span class="link" data-i="'+byName[n]+'">'+esc(n)+'</span>':esc(n))+' <span class="tag'+(lib?' l':'')+'">'+(lib?'library':'Mathlib')+'</span></div>'}).join('')+'</div>'}
function show(i){
  var d=D.decls[i],kinds={t:'theorem',d:'definition',i:'inductive',a:'axiom',o:'opaque'};
  var near=[i].concat(d.d.slice(0,25),users[i].slice(0,25)).filter(function(x,k,a){return a.indexOf(x)===k});
  var at={};near.forEach(function(x,k){at[x]=k});
  var edges=[];near.forEach(function(x){D.decls[x].d.forEach(function(t){if(at[t]!==undefined)edges.push([at[x],at[t]])})});
  var nodes=near.map(function(x){return{id:x,label:D.decls[x].n,c:x===i?'var(--accent)':color(D.mods[D.decls[x].m]),r:x===i?10:6}});
  $('#main').innerHTML='<div class="box"><h2 class="mono" style="font-size:16px;font-variant:normal">'+esc(d.n)+badges(d)+'</h2><div class="sub">'+kinds[d.k]+' · '+esc(D.mods[d.m])+' · used by '+d.u+' declaration'+(d.u===1?'':'s')+' of the library</div></div>'+
  '<div class="box"><h2>Axioms</h2>'+(d.ax.length?d.ax.map(function(a){return '<div><b>'+esc(a.a)+(a.a==='sorryAx'?' — unfinished proof':'')+'</b>'+pathHtml(a.p)+'</div>'}).join('<br>'):'<div class="sub">None.</div>')+'</div>'+
  '<div class="box"><h2>Neighbourhood</h2><div class="sub">Library declarations it uses and those that use it. Click to move.</div>'+(near.length>1?graph(nodes,edges,null,700,320):'<div class="sub">Isolated in the library.</div>')+'</div>'+
  '<div class="box"><h2>Uses in the library ('+d.d.length+')</h2><ul class="plain">'+d.d.slice(0,80).map(function(t){return '<li class="mono link" data-i="'+t+'">'+esc(D.decls[t].n)+'</li>'}).join('')+'</ul></div>'+
  '<div class="box"><h2>Uses from Mathlib and core ('+d.mc+')</h2><div class="mono">'+d.ml.map(esc).join('<br>')+(d.mc>d.ml.length?'<br>…':'')+'</div></div>';
  $('#main').onclick=function(e){var n=e.target.closest('[data-i]');if(n){show(+n.dataset.i);return}var c=e.target.closest('circle');if(c)show(+c.dataset.k)};
  document.querySelectorAll('.item').forEach(function(x){x.classList.toggle('on',+x.dataset.i===i)});
  window.scrollTo(0,0)}
$('#title').onclick=function(){overview()};$('#title').style.cursor='pointer';
renderList();overview();
</script></body></html>`
