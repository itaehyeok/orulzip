/* The accepted map, now fed by a development-only, authenticated API. */
(async()=>{
const source=document.getElementById('lab-source'),select=document.getElementById('lab-dataset');
const mode=new URLSearchParams(location.search).get('dataset')==='development'?'development':'validated';
select.value=mode;select.addEventListener('change',()=>location.assign('/neighborhood-lab?dataset='+encodeURIComponent(select.value)));
const fmtMonth=m=>String(m).slice(0,4)+'.'+String(m).slice(4),monthLabel=m=>String(m).slice(0,4)+'년 '+Number(String(m).slice(4))+'월';
function shiftMonth(value,k){const s=String(value),d=new Date(Date.UTC(+s.slice(0,4),+s.slice(4)-1+k,1));return String(d.getUTCFullYear())+String(d.getUTCMonth()+1).padStart(2,'0');}
try {
const response=await fetch('/api/neighborhood-lab?dataset='+mode,{cache:'no-store'});
if(!response.ok)throw new Error(response.status===401?'개인 확인 링크로 다시 접속해 주세요.':'자료를 읽지 못했습니다.');
const data=await response.json();if(data.environment!=='development'||!data.timeline?.months?.length)throw new Error('개발 자료 형식을 확인할 수 없습니다.');
const geometryResponse=await fetch('/assets/neighborhood-lab-geometry.json',{cache:'no-store'});if(!geometryResponse.ok)throw new Error('지도 자료를 읽지 못했습니다.');
const geo=await geometryResponse.json(),timeline=data.timeline.months,baseMonth=timeline[0],endMonth=timeline.at(-1),priorMonth=shiftMonth(baseMonth,-12);
for(const a of [data.benchmark,...data.current_peers]){const original=a.monthly_prices,byMonth=new Map(original.values.map((v,i)=>[shiftMonth(original.start,i),v]));const start=shiftMonth(baseMonth,-24);a.monthly_prices={start,end:endMonth,values:Array.from({length:31},(_,i)=>byMonth.get(shiftMonth(start,i))??null)};}
source.textContent=data.source+' · 기준 '+monthLabel(data.asOf)+(mode==='validated'?' · 실시간 자료가 아닌 검증용 발췌 자료':' · 단지별 공통 관측월');
document.querySelector('[data-date-start]').textContent=fmtMonth(baseMonth);document.querySelector('[data-date-mid]').textContent=fmtMonth(timeline[3]);document.querySelector('[data-date-end]').textContent=fmtMonth(endMonth);
document.getElementById('lab-content').hidden=false;

(()=>{
const root=document.getElementById('orulzip-gap-scene');
const all=[data.benchmark,...data.current_peers],get=id=>all.find(a=>a.apt_id===id),short=a=>a.name.replace('송파파인타운','');
const models=data.models,range=root.querySelector('#ng-month');
const state={selected:get('kb:15663')?'kb:15663':all[0].apt_id,month:6};
const design={columns:false,intensity:.6};
const reduced=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
const ret=(a,k)=>a&&a.monthly_prices.values[24]&&a.monthly_prices.values[24+k]?(a.monthly_prices.values[24+k]/a.monthly_prices.values[24]-1)*100:NaN;
const gapSignal=(a,k)=>{const m=models[a.apt_id];if(!m||!k)return false;const lead=ret(get(m.leader_id),k),own=ret(a,k),expected=Math.expm1(m.alpha*k+m.beta*Math.log1p(lead/100))*100;return lead>=5&&lead-own>=5&&expected-own>=3;};
const finalMax=d3.max(all,a=>ret(a,6)),heat=d3.scaleLinear().domain([0,finalMax*.4,finalMax]).range([0,.5,1]).clamp(true);
const tintLight=d3.scaleLinear().domain([0,.5,1]).range(['#65b6ca','#e9d8b1','#dd7e4c']).clamp(true);
const tintDark=d3.scaleLinear().domain([0,.5,1]).range(['#4297b1','#7c8170','#dc945f']).clamp(true);
const dark=()=>getComputedStyle(root).colorScheme==='dark'||(getComputedStyle(root).colorScheme.includes('dark')&&window.matchMedia('(prefers-color-scheme:dark)').matches);
for(const f of geo.features)if(f.geometry.type==='Polygon'&&d3.geoArea(f)>2*Math.PI)f.geometry.coordinates.forEach(r=>r.reverse());
geo.features.sort((a,b)=>Number(b.properties.park)-Number(a.properties.park));
function save(){}
function updateReading(){
 const selected=get(state.selected),model=models[selected.apt_id],rate=ret(selected,state.month),node=root.querySelector('[data-status]');
 range.value=state.month;root.querySelector('#ng-date').textContent=monthLabel(timeline[state.month]);
 root.querySelector('[data-name]').textContent=selected.name;
 let reading='',status='',evidence='';
 const fmt=n=>!Number.isFinite(n)?'자료 없음':(n>=0?'+':'')+n.toFixed(1)+'%';
 if(state.month===0){status='같은 시점에서 출발';reading=`${fmtMonth(baseMonth)}의 시세를 출발점으로, 이후 동네의 움직임을 비교합니다.`;evidence=`시간을 ${fmtMonth(endMonth)}로 옮기면 실제 시세의 움직임을 볼 수 있습니다.`;}
 else if(model){
  const peer=get(model.leader_id),peerRate=ret(peer,state.month),gap=peerRate-rate;
  status=gap>=3?'이웃보다 덜 움직인 곳':'이웃과의 움직임 비교';
  reading=gap>=3?`과거 가격 흐름이 닮았던 ${short(peer)}는 먼저 올랐고, 이곳은 상대적으로 덜 움직였습니다.`:`${short(peer)}와의 가격 흐름을 함께 비교하고 있습니다.`;
  evidence=`<div class="ng-evidence-row"><span>${short(selected)} · ${fmtMonth(baseMonth)} 이후</span><span>${fmt(rate)}</span></div><div class="ng-evidence-row"><span>${short(peer)} · 같은 기간</span><span>${fmt(peerRate)}</span></div><div class="ng-evidence-row"><span>상승률 차이</span><span>${Math.abs(gap).toFixed(1)}%p</span></div><div class="ng-evidence-row"><span>단지 사이 직선거리</span><span>${Math.round(model.distance_m)}m</span></div><div class="ng-evidence-row"><span>과거 월별 변화 상관 · ${model.training_n}개월</span><span>${model.corr.toFixed(2)}</span></div><div style="margin-top:9px">과거 시세의 차이입니다. 현재 자료로 향후 회복 가능성은 확정하지 않습니다.</div>`;
 }else{
  const med=d3.median(all,a=>ret(a,state.month));status=rate>=med?'주변에서 먼저 움직인 단지':'주변 가격 흐름 관찰';reading='주변 단지와 같은 출발점에서 시세가 얼마나 움직였는지 보여줍니다.';
  evidence=`<div class="ng-evidence-row"><span>${fmtMonth(baseMonth)} 이후 상승률</span><span>${fmt(rate)}</span></div><div class="ng-evidence-row"><span>비교 면적</span><span>${selected.area_m2}㎡</span></div><div style="margin-top:9px">이 단지의 향후 상승 가능성을 판정한 표시는 아닙니다.</div>`;
 }
 node.textContent=status;root.querySelector('[data-reading]').textContent=reading;root.querySelector('[data-evidence]').innerHTML=evidence;
}
function render(animate=false){
 updateReading();const container=root.querySelector('.ng-drawing'),w=container.clientWidth,h=container.clientHeight;if(w<50)return;
 const narrow=w<600,selected=get(state.selected),model=models[selected.apt_id],peer=model?get(model.leader_id):null;
 const projection=d3.geoMercator().fitExtent([[narrow?55:110,narrow?175:130],[w-(narrow?55:150),h-(narrow?245:205)]],{type:'MultiPoint',coordinates:all.map(a=>[a.lng,a.lat])});
 const path=d3.geoPath(projection),pts=all.map(a=>{const [x,y]=projection([a.lng,a.lat]);return {...a,x,y,value:ret(a,state.month)}});
 container.replaceChildren();const svg=d3.select(container).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('role','img').attr('aria-label','장지동의 실제 과거 시세 변화 지도. 따뜻한 색은 이미 상승한 흐름, 빈 원은 상대적으로 뒤처진 단지입니다.');
 const defs=svg.append('defs');defs.append('clipPath').attr('id','ng-scene-clip').append('rect').attr('width',w).attr('height',h);
 const layers=svg.append('g').attr('clip-path','url(#ng-scene-clip)');
 for(const f of geo.features){const p=f.properties;if(p.park||p.waterway)layers.append('path').datum(f).attr('d',path).attr('fill',p.park&&f.geometry.type==='Polygon'?'var(--ng-park)':'none').attr('stroke',p.waterway?'var(--ng-water)':'var(--ng-park)').attr('stroke-width',p.waterway?9:1)}
 // A small, fixed-bandwidth spatial interpolation of observed apartment changes.
 // It is descriptive map shading, not a forecast or an administrative boundary.
 if(state.month>0){
  const cell=narrow?8:9,nx=Math.ceil(w/cell),ny=Math.ceil(h/cell),values=new Array(nx*ny),presence=new Array(nx*ny);
  const p0=projection([data.benchmark.lng,data.benchmark.lat]),p1=projection([data.benchmark.lng+120/(111195*Math.cos(data.benchmark.lat*Math.PI/180)),data.benchmark.lat]);
  const sigma=Math.max(28,Math.abs(p1[0]-p0[0]));
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
   let num=0,den=0;for(const p of pts){const d2=(x*cell-p.x)**2+(y*cell-p.y)**2,weight=Math.exp(-d2/(2*sigma*sigma));num+=weight*(Number.isFinite(p.value)?p.value:0);den+=Number.isFinite(p.value)?weight:0;}
   const index=y*nx+x;values[index]=den>.12?num/den:-1;presence[index]=den;
  }
  const shade=layers.append('g').attr('opacity',design.intensity);
  const contours=d3.contours().size([nx,ny]).thresholds([0,3,6,9,12,15])(values),contourPath=d3.geoPath(d3.geoIdentity().scale(cell));
  for(const c of contours)shade.append('path').attr('d',contourPath(c)).attr('fill',(dark()?tintDark:tintLight)(heat(c.value))).attr('fill-opacity',.72).attr('stroke','none');
  // Preserve each observed location so a low-change apartment stays visible
  // even where nearby faster changes blend in the interpolated field.
  for(const p of pts){const id='ng-glow-'+p.apt_id.replace(':','-'),color=(dark()?tintDark:tintLight)(heat(p.value));const g=defs.append('radialGradient').attr('id',id);g.append('stop').attr('offset','0%').attr('stop-color',color).attr('stop-opacity',.7);g.append('stop').attr('offset','100%').attr('stop-color',color).attr('stop-opacity',0);layers.append('circle').attr('cx',p.x).attr('cy',p.y).attr('r',Math.max(34,sigma*.8)).attr('fill',`url(#${id})`);}
 }
 for(const f of geo.features){const p=f.properties;if(p.highway)layers.append('path').datum(f).attr('d',path).attr('fill','none').attr('stroke','var(--ng-road)').attr('stroke-width',['primary','secondary','tertiary'].includes(p.highway)?2:0.7).attr('opacity',p.highway==='service'?.55:.8)}
 const labeled=new Set();
 for(const f of geo.features){if(!['충민로','송파대로','충민로2길'].includes(f.properties.name)||labeled.has(f.properties.name))continue;const [x,y]=path.centroid(f);if(x>20&&x<w-70&&y>110&&y<h-65){labeled.add(f.properties.name);layers.append('text').attr('x',x).attr('y',y).attr('fill','var(--ng-sub)').attr('font-size',11).text(f.properties.name)}}
 if(peer){const a=projection([selected.lng,selected.lat]),b=projection([peer.lng,peer.lat]);layers.append('path').attr('d',`M${a[0]},${a[1]} Q${(a[0]+b[0])/2+40},${(a[1]+b[1])/2} ${b[0]},${b[1]}`).attr('fill','none').attr('stroke','var(--ng-cold)').attr('stroke-width',1.5).attr('stroke-dasharray','4 5').attr('opacity',.8)}
 if(design.columns){const height=d3.scaleLinear().domain([0,finalMax]).range([0,narrow?58:90]);for(const p of pts){const hh=height(p.value),c=(dark()?tintDark:tintLight)(heat(p.value));layers.append('rect').attr('x',p.x-5).attr('y',p.y-hh).attr('width',10).attr('height',hh).attr('rx',5).attr('fill',c);}}
 const pins=root.querySelector('.ng-pins');pins.replaceChildren();
 for(const p of pts){const candidate=gapSignal(p,state.month);const b=document.createElement('button'),isPeer=peer?.apt_id===p.apt_id; b.type='button';b.className='ng-node cursor-interaction';b.dataset.candidate=String(candidate);b.dataset.apt=p.apt_id;b.dataset.peer=String(isPeer);b.setAttribute('aria-pressed',String(p.apt_id===selected.apt_id));b.setAttribute('aria-label',p.name+(candidate?', 이웃보다 덜 움직인 단지':''));b.style.left=p.x+'px';b.style.top=p.y+'px';b.style.setProperty('--ng-mark',state.month===0?'var(--ng-sub)':(dark()?tintDark:tintLight)(heat(p.value)));b.innerHTML=`<span class="ng-node-mark"></span><span class="ng-node-name">${short(p)}</span>`;b.onclick=()=>{state.selected=p.apt_id;render();save()};pins.append(b);}
 const callout=root.querySelector('.ng-focus-label'),xy=projection([selected.lng,selected.lat]);callout.hidden=!gapSignal(selected,state.month);
 callout.style.left=Math.max(narrow?105:130,Math.min(w-(narrow?105:130),xy[0]))+'px';callout.style.top=(xy[1]-32)+'px';
}
range.addEventListener('input',()=>{state.month=+range.value;render(true)});range.addEventListener('change',save);
new ResizeObserver(()=>render()).observe(root.querySelector('.ng-map'));
window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>render());
render();
})();

(()=>{
 const root=document.getElementById('orulzip-gap-scene'),all=[data.benchmark,...data.current_peers],get=id=>all.find(a=>a.apt_id===id);
 const panel=root.querySelector('.ng-inspector'),body=root.querySelector('.ng-inspector-body'),tip=root.querySelector('.ng-hover-card'),range=root.querySelector('#ng-month');
 const short=a=>a.name.replace('송파파인타운',''),pct=n=>!Number.isFinite(n)?'자료 없음':(n>=0?'+':'')+n.toFixed(1)+'%',money=n=>!Number.isFinite(n)||!n?'자료 없음':(n/10000).toFixed(2)+'억',esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const r=(a,k)=>a.monthly_prices.values[24]&&a.monthly_prices.values[24+k]?(a.monthly_prices.values[24+k]/a.monthly_prices.values[24]-1)*100:NaN,prior=a=>a.monthly_prices.values[12]?(a.monthly_prices.values[24]/a.monthly_prices.values[12]-1)*100:NaN;
 const context=()=>({a:get(root.querySelector('.ng-node[aria-pressed="true"]')?.dataset.apt)||get('kb:15663'),k:+range.value});
 const reduced=()=>window.matchMedia('(prefers-reduced-motion:reduce)').matches;
 let lastContext='',lineVisible=[true,true];
 function persist(){}
 function hideTip(){tip.hidden=true;root.querySelectorAll('[aria-describedby="ng-hover-card"]').forEach(n=>n.removeAttribute('aria-describedby'))}
 function placeTip(html,clientX,clientY){
  tip.innerHTML=html;tip.hidden=false;const b=root.getBoundingClientRect();const x=Math.max(10,Math.min(root.clientWidth-tip.offsetWidth-10,clientX-b.left+14));let y=clientY-b.top-tip.offsetHeight-16;if(y<65)y=clientY-b.top+25;y=Math.max(5,Math.min(root.clientHeight-tip.offsetHeight-5,y));tip.style.left=x+'px';tip.style.top=y+'px';
 }
 function hoverNode(button){
  const a=get(button.dataset.apt);if(!a)return;const k=+range.value,m=data.models[a.apt_id],peer=m?get(m.leader_id):null,change=r(a,k);
  let message=peer?`${esc(short(peer))}는 ${pct(r(peer,k))}. ${esc(short(a))}는 같은 기간 ${Math.abs(r(peer,k)-change).toFixed(1)}%p ${r(peer,k)>=change?'덜':'더'} 올랐습니다.`:'지도 색은 이 단지의 실제 과거 시세 변화입니다.';
  if(!k)message=`${fmtMonth(baseMonth)} 시세를 같은 출발점으로 놓고 이후 움직임을 비교합니다.`;
  const rect=button.getBoundingClientRect();placeTip(`<div class="ng-hover-title">${esc(a.name)}</div><div class="ng-hover-date">${fmtMonth(baseMonth)} → ${fmtMonth(timeline[k])}</div><div>선택 기간 상승률 <strong>${pct(change)}</strong></div><div class="ng-hover-result">${message}</div><div class="ng-hover-hint">클릭하면 비교 근거와 반대 근거를 함께 봅니다.</div>`,rect.left+rect.width/2,rect.top);
  button.setAttribute('aria-describedby','ng-hover-card');
 }
 function refreshSummary(){
  const {a,k}=context(),m=data.models[a.apt_id];if(m&&k){const b=get(m.leader_id),gap=r(b,k)-r(a,k);root.querySelector('[data-reading]').textContent=gap>=3?`선택 기간에는 ${short(b)}의 상승폭이 더 컸습니다. 그전에는 어느 쪽이 먼저 올랐는지도 함께 확인해보세요.`:`${short(b)}와의 실제 시세 변화를 비교하고 있습니다.`;}
 }
 function tradeHTML(){return '<p class="ng-detail-small">실거래 교차 확인 미완료. 이 개발 화면은 KB 시세를 비교하며, 이 자료에 맞춘 실거래 대조 결과는 아직 연결하지 않았습니다.</p>';}
 function drawChart(){
  if(panel.hidden)return;const {a,k}=context(),m=data.models[a.apt_id];if(!m)return;const b=get(m.leader_id),box=body.querySelector('.ng-detail-chart');if(!box||box.clientWidth<30)return;
  const w=box.clientWidth,h=box.clientHeight,margin={left:64,right:16,top:30,bottom:47},end=12+k;
  const series=[a,b].map((z,i)=>({name:short(z),values:z.monthly_prices.values.slice(12,25+k).map(v=>v/z.monthly_prices.values[12]*100),color:i?'var(--ng-warm)':'var(--ng-cold)'}));
  const extent=d3.extent(series.flatMap(s=>s.values)),pad=Math.max(3,(extent[1]-extent[0])*.12),x=d3.scaleLinear().domain([0,end]).range([margin.left,w-margin.right]),y=d3.scaleLinear().domain([extent[0]-pad,extent[1]+pad]).nice(4).range([h-margin.bottom,margin.top]);
  box.replaceChildren();const svg=d3.select(box).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('role','img').attr('aria-label',`${fmtMonth(priorMonth)}을 100으로 맞춘 두 단지의 실제 KB 시세 흐름. 점선 오른쪽이 이번 비교 기간입니다.`);
  svg.append('defs').append('clipPath').attr('id','ng-detail-clip').append('rect').attr('x',margin.left).attr('y',margin.top).attr('width',w-margin.left-margin.right).attr('height',h-margin.top-margin.bottom);
  svg.append('rect').attr('data-chart-frame','').attr('x',margin.left).attr('y',margin.top).attr('width',w-margin.left-margin.right).attr('height',h-margin.top-margin.bottom).attr('fill','none').attr('stroke','var(--ng-line)');
  if(k)svg.append('rect').attr('x',x(12)).attr('y',margin.top).attr('width',x(end)-x(12)).attr('height',h-margin.top-margin.bottom).attr('fill','var(--ng-cold-soft)').attr('opacity',.35);
  for(const v of y.ticks(4)){svg.append('line').attr('x1',margin.left).attr('x2',w-margin.right).attr('y1',y(v)).attr('y2',y(v)).attr('stroke','var(--ng-line)').attr('opacity',.55);svg.append('text').attr('x',margin.left-8).attr('y',y(v)+4).attr('text-anchor','end').text(Math.round(v));}
  const ticks=w<360?[0,end]:[0,12,...(k?[end]:[])];for(const v of ticks)svg.append('text').attr('x',x(v)).attr('y',h-margin.bottom+19).attr('text-anchor',v===0?'start':v===end?'end':'middle').text(fmtMonth(shiftMonth(priorMonth,v)));
  svg.append('text').attr('class','axis-title').attr('data-axis','y').attr('x',margin.left).attr('y',14).text(`KB 시세 지수 · ${fmtMonth(priorMonth)}=100`);
  svg.append('text').attr('class','axis-title').attr('data-axis','x').attr('x',(margin.left+w-margin.right)/2).attr('y',h-4).attr('text-anchor','middle').text('관측 월');
  svg.append('line').attr('x1',x(12)).attr('x2',x(12)).attr('y1',margin.top).attr('y2',h-margin.bottom).attr('stroke','var(--ng-sub)').attr('stroke-dasharray','4 4').attr('opacity',.8);
  const line=d3.line().defined(Number.isFinite).x((v,i)=>x(i)).y(v=>y(v));series.forEach((s,i)=>{if(lineVisible[i])svg.append('path').datum(s.values).attr('d',line).attr('clip-path','url(#ng-detail-clip)').attr('fill','none').attr('stroke',s.color).attr('stroke-width',2.3).attr('stroke-dasharray',i?'5 4':null)});
  const guide=svg.append('line').attr('data-chart-hover-guide','').attr('y1',margin.top).attr('y2',h-margin.bottom).attr('stroke','var(--ng-sub)').attr('opacity',0),marks=series.map(s=>svg.append('circle').attr('data-chart-hover-marker','').attr('r',4).attr('fill',s.color).attr('opacity',0));
  svg.append('rect').attr('data-chart-hit','').attr('data-chart-hover-overlay','cross-series').attr('x',margin.left).attr('y',margin.top).attr('width',w-margin.left-margin.right).attr('height',h-margin.top-margin.bottom).attr('fill','transparent').on('pointermove',function(e){const [cx]=d3.pointer(e,this),f=Math.max(0,Math.min(end,x.invert(cx))),lo=Math.floor(f),hi=Math.min(end,lo+1),weight=f-lo;guide.attr('x1',x(f)).attr('x2',x(f)).attr('opacity',.7);const rows=[];series.forEach((s,i)=>{const value=s.values[lo]*(1-weight)+s.values[hi]*weight;marks[i].attr('cx',x(f)).attr('cy',y(value)).attr('opacity',lineVisible[i]?1:0);if(lineVisible[i])rows.push(`<div>${esc(s.name)} ${value.toFixed(1)}</div>`)});const dateText=fmtMonth(shiftMonth(priorMonth,Math.round(f)));placeTip(`<div class="ng-hover-title">${dateText} · 시세 지수</div>${rows.join('')}<div class="ng-hover-hint">월 관측점 사이에서는 지수를 보간한 값입니다.</div>`,e.clientX,e.clientY)}).on('pointerleave',()=>{hideTip();guide.attr('opacity',0);marks.forEach(p=>p.attr('opacity',0))});
  const legend=body.querySelector('.ng-detail-legend');legend.replaceChildren();series.forEach((s,i)=>{const button=document.createElement('button');button.type='button';button.className='ng-line-toggle cursor-interaction';button.setAttribute('aria-pressed',String(lineVisible[i]));button.innerHTML=`<span class="ng-line-swatch" style="color:${s.color};${i?'border-top-style:dashed':''}"></span>${esc(s.name)}`;button.onclick=()=>{if(lineVisible.filter(Boolean).length===1&&lineVisible[i])return;lineVisible[i]=!lineVisible[i];drawChart()};legend.append(button)});
 }
 function renderDetail(){
  if(panel.hidden)return;const {a,k}=context(),m=data.models[a.apt_id];panel.querySelector('[data-detail-name]').textContent=a.name;
  if(!m){body.innerHTML=`<p class="ng-detail-summary">이 단지는 주변 시세 흐름을 보여주는 관측점입니다.</p><ol class="ng-reasons"><li><div class="ng-reason-label">선택 기간</div><div class="ng-reason-value">${fmtMonth(baseMonth)} → ${fmtMonth(timeline[k])}</div><div class="ng-reason-note">같은 출발점으로 가격 변화를 비교</div></li><li><div class="ng-reason-label">실제 KB 시세 변화</div><div class="ng-reason-value">${pct(r(a,k))}</div><div class="ng-reason-note">${money(a.monthly_prices.values[24])} → ${money(a.monthly_prices.values[24+k])}</div></li><li><div class="ng-reason-label">비교 면적·연식</div><div class="ng-reason-value">${a.area_m2}㎡ · ${a.built_year}년</div><div class="ng-reason-note">${a.households}세대</div></li></ol><p class="ng-detail-small">이 화면에는 이 단지의 별도 동행 관계가 선정되어 있지 않습니다. 지도 색만으로 상승 여력이나 미래 가격을 판정하지 않습니다.</p><div class="ng-detail-source">지도 색은 관측 단지의 ${fmtMonth(baseMonth)} 대비 상승률을 주변에 부드럽게 연결한 표현입니다. 표시하지 않은 위치에 실제 거래가 있다는 뜻은 아닙니다.</div>`;return;}
  const b=get(m.leader_id),own=r(a,k),lead=r(b,k),gap=lead-own,pa=prior(a),pb=prior(b),endA=(a.monthly_prices.values[24+k]/a.monthly_prices.values[12]-1)*100,endB=(b.monthly_prices.values[24+k]/b.monthly_prices.values[12]-1)*100;
  const expected=Math.expm1(m.alpha*k+m.beta*Math.log1p(lead/100))*100,betaGap=expected-own;
  body.innerHTML=`<p class="ng-detail-summary">${esc(short(b))}와 비교하면, 선택 기간에 ${Math.abs(gap).toFixed(1)}%p ${gap>=0?'덜':'더'} 올랐습니다.</p>
   <ol class="ng-reasons"><li><div class="ng-reason-label">비교 상대를 고른 이유</div><div class="ng-reason-value">같은 동네 · ${Math.round(m.distance_m)}m</div><div class="ng-reason-note">${esc(short(a))} ${a.area_m2}㎡ / ${esc(short(b))} ${b.area_m2}㎡<br>${a.built_year}년 / ${b.built_year}년 준공</div></li><li><div class="ng-reason-label">비교 시작 전의 가격 관계</div><div class="ng-reason-value">월 변화 상관 ${m.corr.toFixed(2)}</div><div class="ng-reason-note">${fmtMonth(baseMonth)}까지 ${m.training_n}개 월 변화율 비교. 과거 흐름의 유사성이며 인과관계는 아닙니다.</div></li><li><div class="ng-reason-label">이번 기간의 실제 차이</div><div class="ng-reason-value">${esc(short(a))} ${pct(own)} / ${esc(short(b))} ${pct(lead)}</div><div class="ng-reason-note">${fmtMonth(baseMonth)} → ${fmtMonth(timeline[k])}<br>${money(a.monthly_prices.values[24])} → ${money(a.monthly_prices.values[24+k])} / ${money(b.monthly_prices.values[24])} → ${money(b.monthly_prices.values[24+k])}</div></li></ol>
   <div class="ng-context-grid"><section><h3 class="ng-detail-heading">조금 더 긴 기간도 함께 보기</h3><div class="ng-detail-small">점선 오른쪽이 이번 비교 기간입니다.</div><div class="ng-detail-chart"></div><div class="ng-detail-legend"></div><div class="ng-detail-small">${fmtMonth(priorMonth)} → 선택 시점 누적: ${esc(short(a))} ${pct(endA)}, ${esc(short(b))} ${pct(endB)}</div></section><section><div class="ng-counter"><strong>함께 봐야 할 반대 근거</strong><p>직전 1년(${fmtMonth(priorMonth)}~${fmtMonth(baseMonth)})에는 ${esc(short(a))}가 ${pct(pa)}, ${esc(short(b))}가 ${pct(pb)}였습니다. ${pa>pb?'선택 단지가 먼저 더 올랐던 기간도 있습니다.':'최근의 상대 부진이 여러 기간에서도 유지되는지 확인해야 합니다.'}</p><p>최근 몇 개월의 차이가 기간을 바꾸면 작아지거나 반대로 보일 수 있습니다.</p></div><h3 class="ng-detail-heading">실거래로도 확인됐나요?</h3>${tradeHTML(a,b,k)}</section></div>
   <details class="ng-method"><summary class="cursor-interaction">빈 원의 계산 기준과 자료 범위</summary><p>비교 상대는 이번 기간이 시작되기 전의 가격·면적·연식·거리로 고릅니다. 같은 법정동, 직선 500m 이내, 준공연도 차이 5년 이내, 면적이 비슷한 단지를 비교합니다.</p><p>가격 관계는 비교 시작 시점까지 최대 36개월의 월별 변화로 계산했습니다. ${esc(short(a))} 시세가 바뀐 월은 ${m.changed_target}/${m.training_n}개, ${esc(short(b))}는 ${m.changed_peer}/${m.training_n}개입니다. KB 시세의 반영 시차가 격차처럼 보일 수 있습니다.</p><p>빈 원은 선택 기간에 비교 상대 상승률 5% 이상, 두 단지의 상승률 차이 5%p 이상, 과거 동행 관계를 반영한 격차 3%p 이상일 때 표시합니다. 현재 동행 관계 조정 격차는 ${betaGap.toFixed(1)}%p입니다. 이는 미래 상승률이 아니라 과거 관계와의 차이입니다.</p><p>이 화면은 ${fmtMonth(endMonth)} 기준으로 선정한 비교 관계의 과거 움직임을 되돌려 봅니다. 월마다 당시 공개된 자료만으로 다시 선정한 백테스트 화면은 아닙니다.</p></details>
   <div class="ng-detail-source">지도 색: 관측 단지의 ${fmtMonth(baseMonth)} 대비 KB 월 시세 변화와 그 주변 보간. 빈 원: 비교 관계에서 나타난 상대 부진. 어느 것도 개별 단지의 향후 회복 확률을 뜻하지 않습니다.</div>`;
  drawChart();
 }
 function openDetail(scroll=true){hideTip();panel.hidden=false;lineVisible=[true,true];renderDetail();persist();if(scroll){panel.querySelector('.ng-close-detail').focus({preventScroll:true});panel.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});}}
 function closeDetail(){panel.hidden=true;hideTip();persist();root.querySelector('.ng-map').scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});root.querySelector('.ng-node[aria-pressed="true"]')?.focus({preventScroll:true});}
 root.addEventListener('pointerover',e=>{const node=e.target.closest('.ng-node');if(node&&e.pointerType!=='touch'&&window.matchMedia('(hover:hover)').matches&&(!e.relatedTarget||!node.contains(e.relatedTarget)))hoverNode(node)});
 root.addEventListener('pointerout',e=>{const node=e.target.closest('.ng-node');if(node&&(!e.relatedTarget||!node.contains(e.relatedTarget)))hideTip()});
 root.addEventListener('focusin',e=>{const node=e.target.closest('.ng-node');if(node&&node.matches(':focus-visible'))hoverNode(node)});
 root.addEventListener('focusout',e=>{if(e.target.closest('.ng-node'))hideTip()});
 root.addEventListener('click',e=>{if(e.target.closest('.ng-node')||e.target.closest('.ng-open-detail'))openDetail(true)});
 panel.querySelector('.ng-close-detail').addEventListener('click',closeDetail);
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){hideTip();if(!panel.hidden)closeDetail()}});
 range.addEventListener('input',()=>{hideTip();refreshSummary();renderDetail()});range.addEventListener('change',persist);
 new MutationObserver(()=>{refreshSummary();const {a,k}=context(),key=a.apt_id+'-'+k;if(key!==lastContext){lastContext=key;lineVisible=[true,true];hideTip();renderDetail()}}).observe(root.querySelector('.ng-pins'),{childList:true});
 new ResizeObserver(()=>{hideTip();drawChart()}).observe(panel);
 let lastWidth=root.clientWidth;new ResizeObserver(()=>{if(root.clientWidth!==lastWidth){lastWidth=root.clientWidth;hideTip()}}).observe(root);
 refreshSummary();
})();

}catch(error){source.textContent='화면을 불러오지 못했습니다. '+error.message;source.setAttribute('role','alert');}
})();
