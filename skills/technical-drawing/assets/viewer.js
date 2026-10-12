const drawings=JSON.parse(document.getElementById('drawing-data').textContent);
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const viewport=$('viewport'),stage=$('stage'),drawing=$('drawing');
const palette=[['Graphite','#202020'],['Blue','#3568b0'],['Green','#397362'],['Terracotta','#b25940'],['Ochre','#99752b'],['Violet','#805699']];
const presets={technical:{outline:.35,edge:.22,detail:.13,texture:.09},patent:{outline:.24,edge:.15,detail:.10,texture:.065},service:{outline:.5,edge:.28,detail:.16,texture:0}};
const storageKey='object-studies-colors-v2';
let preferences={};try{preferences=JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{}
const states=new Map(drawings.map(d=>[d.id,{params:Object.fromEntries(d.parameters.map(p=>[p.key,p.default])),explosion:(d.initialView??(d.parts.length===1?'assembled':'exploded'))==='assembled'?0:1,preset:'technical',selectedPart:'all',isolated:null}]));
let selected=drawings.find(d=>d.id===location.hash.slice(1))||drawings[0],zoom=1,svg,geometry,geometryScale=1,messageTimer,renderTimer,requestId=0,renderBusy=false,exportBusy=false;
let renderedState=null;
const workerUrl=URL.createObjectURL(new Blob([JSON.parse($('drawing-worker').textContent)],{type:'text/javascript'}));
const renderer=new Worker(workerUrl);URL.revokeObjectURL(workerUrl);
const state=()=>states.get(selected.id);
const pending=new Map();
function requestGeometry(id,snapshot){return new Promise((resolve,reject)=>{const request=++requestId;pending.set(request,{resolve,reject});renderer.postMessage({request,id,parameters:snapshot.params,explosion:snapshot.explosion,isolated:snapshot.isolated});});}
renderer.onmessage=({data})=>{const job=pending.get(data.request);if(!job)return;pending.delete(data.request);if(data.error)job.reject(Error(data.error));else job.resolve(data.result);};
renderer.onerror=event=>{for(const job of pending.values())job.reject(Error(event.message||'Drawing worker failed'));pending.clear();};
function colors(){return preferences[selected.id]||(preferences[selected.id]={base:'#202020',parts:{}});}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(preferences));}catch{}}
function announce(text,persistent=false){clearTimeout(messageTimer);$('message').textContent=text;if(!persistent)messageTimer=setTimeout(()=>{$('message').textContent='';},5000);}
function createSvg(name,attributes={}){const node=document.createElementNS(ns,name);for(const[key,value]of Object.entries(attributes))node.setAttribute(key,value);return node;}
function snapshot(){return structuredClone(state());}
function mountGeometry(result,subject,target){
 const node=createSvg('svg',{xmlns:ns,width:'420mm',height:'297mm',viewBox:'0 0 420 297',role:'img','aria-labelledby':'art-title art-description'});
 const part=subject.parts.find(p=>String(p.id)===String(target.isolated));
 const title=createSvg('title',{id:'art-title'});title.textContent=subject.title+' · '+(part?part.name:(target.explosion?'exploded':'assembled')+' view');
 const desc=createSvg('desc',{id:'art-description'});desc.textContent=subject.description+(part?' Isolated component: '+part.name+'.':'');
 node.append(title,desc,createSvg('rect',{id:'paper',width:420,height:297,fill:'white'}));
 const group=createSvg('g',{id:'geometry'});group.innerHTML=result.markup;node.append(group);
 return{node,group};
}
function fitGeometry(group){
 const box=group.getBBox(),scale=Math.min(364/(box.width||1),241/(box.height||1));
 group.setAttribute('transform',`translate(${(420-box.width*scale)/2-box.x*scale} ${(297-box.height*scale)/2-box.y*scale}) scale(${scale})`);
 return scale;
}
function styleGeometry(group,scale,subject,options,colorSnapshot=null){
 const ink=colorSnapshot||preferences[subject.id]||{base:'#202020',parts:{}},weights=presets[options.preset];
 group.style.setProperty('--drawing-ink',ink.base);
 for(const part of group.querySelectorAll('[data-item]'))part.style.setProperty('--drawing-ink',ink.parts[part.dataset.item]||ink.base);
 for(const el of group.querySelectorAll('[data-ink-fill]')){
  const part=el.closest('[data-item]')?.dataset.item;
  el.style.removeProperty('fill');el.setAttribute('fill',ink.parts[part]||ink.base);
 }
 for(const el of group.querySelectorAll('[data-line-role]')){
  const part=el.closest('[data-item]')?.dataset.item,weight=weights[el.dataset.lineRole]??weights.detail;
  el.style.removeProperty('stroke');el.setAttribute('stroke',ink.parts[part]||ink.base);el.setAttribute('stroke-width',weight/scale);el.setAttribute('stroke-linecap','butt');el.setAttribute('stroke-linejoin','round');
  el.style.display=weight?'':'none';
 }
}
let revision=0;
async function renderGeometry(){
 const version=++revision,subject=selected,target=snapshot();renderBusy=true;updateAvailability();viewport.setAttribute('aria-busy','true');$('render-status').textContent='Updating drawing';
 try{
  const result=await requestGeometry(subject.id,target);if(version!==revision)return;
  const mounted=mountGeometry(result,subject,target);svg=mounted.node;geometry=mounted.group;drawing.replaceChildren(svg);geometryScale=fitGeometry(geometry);
  styleGeometry(geometry,geometryScale,subject,state());renderedState={subject:subject.id,...target};updateSelection();renderZoom();
  document.title=subject.title+' · Technical drawing';$('render-status').textContent='Drawing updated';
 }catch(error){if(version===revision){console.error(error);announce('Could not update the drawing. Restore the settings and try again.',true);renderedState=null;}}
 finally{if(version===revision){renderBusy=false;viewport.setAttribute('aria-busy','false');updateAvailability();}}
}
function scheduleRender(){
 clearTimeout(renderTimer);++revision;renderBusy=true;updateAvailability();viewport.setAttribute('aria-busy','true');renderTimer=setTimeout(renderGeometry,120);
}
function renderNow(){clearTimeout(renderTimer);return renderGeometry();}
function updateAvailability(){
 const unavailable=renderBusy||exportBusy||!renderedState;
 for(const button of document.querySelectorAll('.export-choice[data-format]'))button.disabled=unavailable;
 const noPart=state().selectedPart==='all';$('download-part').disabled=unavailable||noPart;$('isolate-part').disabled=noPart||exportBusy;$('color-part').disabled=noPart;
}
function applyStyle(){if(geometry)styleGeometry(geometry,geometryScale,selected,state());updateSelection();updateColorControls();}
function updateColorControls(){
 const target=$('color-target').value,c=colors(),ink=target==='all'?c.base:(c.parts[target]||c.base),mixed=target==='all'&&Object.values(c.parts).some(value=>value!==c.base);
 $('custom-color').value=ink;$('hex-color').value=mixed?'':ink.toUpperCase();$('hex-color').placeholder=mixed?'Mixed colors':'#202020';$('hex-color').setAttribute('aria-invalid','false');
 for(const button of $('swatches').children)button.setAttribute('aria-pressed',String(!mixed&&button.dataset.color.toLowerCase()===ink.toLowerCase()));
 $('color-dot').style.background=Object.keys(c.parts).length?'conic-gradient('+palette.slice(1).map(p=>p[1]).join(',')+')':c.base;
}
function setColor(value){
 if(!/^#[0-9a-f]{6}$/i.test(value)){$('hex-color').setAttribute('aria-invalid','true');return;}
 const c=colors(),target=$('color-target').value;
 if(target==='all'){c.base=value;c.parts={};}else c.parts[target]=value;
 applyStyle();save();
}
function updateSelection(){
 svg?.querySelector('#selection-overlay')?.remove();
 const s=state(),part=geometry?.querySelector(`[data-item="${s.selectedPart}"]`);
 if(part&&s.isolated===null){
  const box=paperBounds(part),overlay=createSvg('rect',{id:'selection-overlay',x:box.x-2,y:box.y-2,width:box.width+4,height:box.height+4,rx:1,fill:'none',stroke:'#8b9abd','stroke-width':.2,'stroke-dasharray':'1 1'});svg.append(overlay);
 }
 $('part-target').value=s.selectedPart;$('isolate-part').setAttribute('aria-pressed',String(s.isolated!==null));$('isolate-part').textContent=s.isolated!==null?'Isolated':'Isolate';
 $('parts-toggle').setAttribute('aria-pressed',String(s.selectedPart!=='all'));updateAvailability();
}
function choosePart(id){
 const s=state();s.selectedPart=id;
 if(s.isolated!==null){s.isolated=id==='all'?null:id;renderNow();}else updateSelection();
}
function buildParameterControls(){
 $('parameters').replaceChildren();
 for(const id of ['parameter-divider','reset-parameters','parameter-note'])$(id).hidden=!selected.parameters.length;
 $('parameter-note').textContent=selected.parameterNote||'Concept dimensions. Changes update matching parts in every view.';
 for(const p of selected.parameters){
  const field=document.createElement('div');field.className='field';
  const row=document.createElement('div');row.className='field-title';
  const label=document.createElement('label');label.htmlFor='parameter-'+p.key;label.textContent=p.label;
  const value=document.createElement('output');value.id='value-'+p.key;value.htmlFor='parameter-'+p.key;
  const input=document.createElement('input');input.type='range';input.id='parameter-'+p.key;input.min=p.min;input.max=p.max;input.step=p.step||1;input.value=state().params[p.key];
  const show=()=>{value.textContent=input.value+(p.unit?' '+p.unit:'');};show();
  input.addEventListener('input',()=>{state().params[p.key]=Number(input.value);show();scheduleRender();});
  row.append(label,value);field.append(row,input);$('parameters').append(field);
 }
}
function syncControls(){
 $('linework').value=state().preset;$('explosion').value=state().explosion*100;$('explosion-value').value=Math.round(state().explosion*100)+'%';$('view').value=state().explosion===0?'assembled':'exploded';
}
function selectDrawing(id){
 selected=drawings.find(d=>d.id===id)||drawings[0];zoom=1;$('subject').value=selected.id;
 for(const control of[$('color-target'),$('part-target')]){control.replaceChildren(new Option('All parts','all'));for(const p of selected.parts)control.append(new Option(p.name,p.id));}
 const assembly=selected.parts.length>1;$('view').hidden=!assembly;$('view-label').hidden=!assembly;$('spacing-field').hidden=!assembly;
 syncControls();buildParameterControls();updateColorControls();renderNow();history.replaceState(null,'','#'+selected.id);
}
function renderZoom(reset=false){
 const pad=innerWidth<=740?12:24,bar=$('controls').getBoundingClientRect();viewport.style.height=Math.max(100,bar.top-20)+'px';
 document.documentElement.style.setProperty('--popup-bottom',(innerHeight-bar.top+12)+'px');
 const fit=Math.min((viewport.clientWidth-pad*2)/420,(viewport.clientHeight-pad*2)/297),w=420*fit*zoom,h=297*fit*zoom;
 drawing.style.width=w+'px';drawing.style.height=h+'px';stage.style.width=Math.max(viewport.clientWidth,w+pad*2)+'px';stage.style.height=Math.max(viewport.clientHeight,h+pad*2)+'px';
 $('zoom-level').value=Math.round(zoom*100)+'%';$('zoom-out').disabled=zoom<=.25;$('zoom-in').disabled=zoom>=4;
 if(reset){viewport.scrollLeft=0;viewport.scrollTop=0;}
}
function setZoom(value){const center=[(viewport.scrollLeft+viewport.clientWidth/2)/stage.offsetWidth,(viewport.scrollTop+viewport.clientHeight/2)/stage.offsetHeight];zoom=Math.max(.25,Math.min(4,value));renderZoom();viewport.scrollLeft=center[0]*stage.offsetWidth-viewport.clientWidth/2;viewport.scrollTop=center[1]*stage.offsetHeight-viewport.clientHeight/2;}
function paperBounds(group){
 const box=group.getBBox(),matrix=svg.getCTM().inverse().multiply(group.getCTM()),corners=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
 const x=Math.min(...corners.map(p=>p.x)),y=Math.min(...corners.map(p=>p.y));return{x,y,width:Math.max(...corners.map(p=>p.x))-x,height:Math.max(...corners.map(p=>p.y))-y};
}
async function download(format,partOnly=false){
 if(renderBusy||exportBusy||!renderedState)return;
 exportBusy=true;updateAvailability();
 const subject=selected,target=snapshot(),ink=structuredClone(colors()),crop=partOnly||$('tight-crop').checked,transparent=$('transparent').checked;
 let host;
 try{
  let source=svg,bounds=paperBounds(geometry);
  if(partOnly){
   target.isolated=target.selectedPart;const result=await requestGeometry(subject.id,target),mounted=mountGeometry(result,subject,target);
   host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;width:420mm;height:297mm;';host.append(mounted.node);document.body.append(host);
   const scale=fitGeometry(mounted.group);styleGeometry(mounted.group,scale,subject,target,ink);
   const b=mounted.group.getBBox(),m=mounted.group.transform.baseVal.consolidate().matrix;bounds={x:b.x*m.a+m.e,y:b.y*m.d+m.f,width:b.width*m.a,height:b.height*m.d};source=mounted.node;
  }
  const metadata={subject:subject.id,concept:subject.concept!==false,parameters:target.params,explosion:target.explosion,linework:target.preset,isolated:target.isolated,colors:ink};
  const prepared=DrawingExport.prepare(source,{crop,transparent,bounds,metadata}),part=target.isolated!==null?subject.parts.find(p=>String(p.id)===String(target.isolated)):null;
  const filename=[subject.id,part?part.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'):(target.explosion?'exploded':'assembled'),target.preset,crop?'cropped':null,transparent?'transparent':null].filter(Boolean).join('-');
  await DrawingExport.download(prepared,format,filename);announce(format.toUpperCase()+' saved');
 }catch(error){console.error(error);announce('The '+format.toUpperCase()+' export failed. Please try again.',true);}
 finally{host?.remove();exportBusy=false;updateAvailability();}
}
for(const[name,color]of palette){const button=document.createElement('button');button.className='swatch';button.style.setProperty('--swatch',color);button.dataset.color=color;button.setAttribute('aria-label',name);button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>setColor(color));$('swatches').append(button);}
$('subject').addEventListener('change',event=>selectDrawing(event.target.value));
$('view').addEventListener('change',event=>{state().explosion=event.target.value==='assembled'?0:1;syncControls();renderNow();});
$('linework').addEventListener('change',event=>{state().preset=event.target.value;applyStyle();});
$('explosion').addEventListener('input',event=>{state().explosion=Number(event.target.value)/100;syncControls();scheduleRender();});
$('reset-parameters').addEventListener('click',()=>{state().params=Object.fromEntries(selected.parameters.map(p=>[p.key,p.default]));buildParameterControls();renderNow();});
$('part-target').addEventListener('change',event=>choosePart(event.target.value));
$('isolate-part').addEventListener('click',()=>{state().isolated=state().selectedPart==='all'?null:state().selectedPart;renderNow();});
$('show-all').addEventListener('click',()=>{state().isolated=null;state().selectedPart='all';renderNow();});
$('color-part').addEventListener('click',()=>{$('color-target').value=state().selectedPart;updateColorControls();$('color-panel').showPopover();});
$('download-part').addEventListener('click',()=>download('svg',true));
drawing.addEventListener('click',event=>{if(renderBusy)return;const part=event.target.closest('[data-item]');if(part){choosePart(part.dataset.item);$('parts-panel').showPopover();}});
$('color-target').addEventListener('change',updateColorControls);
$('custom-color').addEventListener('input',event=>setColor(event.target.value));$('hex-color').addEventListener('change',event=>setColor(event.target.value));
$('hex-color').addEventListener('keydown',event=>{if(event.key==='Enter'){setColor(event.target.value);event.target.blur();}});
$('color-parts').addEventListener('click',()=>{selected.parts.forEach((p,i)=>colors().parts[p.id]=palette[1+i%(palette.length-1)][1]);applyStyle();save();});
$('reset-colors').addEventListener('click',()=>{preferences[selected.id]={base:'#202020',parts:{}};applyStyle();save();});
$('zoom-in').addEventListener('click',()=>setZoom(zoom*1.25));$('zoom-out').addEventListener('click',()=>setZoom(zoom/1.25));$('fit').addEventListener('click',()=>{zoom=1;renderZoom(true);});
viewport.addEventListener('keydown',event=>{if(['+','=','-','0'].includes(event.key)){event.preventDefault();if(event.key==='0'){zoom=1;renderZoom(true);}else setZoom(event.key==='-'?zoom/1.25:zoom*1.25);}});
for(const panel of document.querySelectorAll('[popover]'))panel.addEventListener('toggle',()=>{if(!panel.matches(':popover-open'))return;const trigger=$(panel.id.replace('-panel','-toggle')),r=trigger.getBoundingClientRect();panel.style.left=Math.max(12,Math.min(innerWidth-panel.offsetWidth-12,r.right-panel.offsetWidth))+'px';panel.style.right='auto';});
new ResizeObserver(()=>renderZoom()).observe($('controls'));window.addEventListener('resize',()=>renderZoom());
$('tight-crop').addEventListener('change',()=>{$('pdf-size').textContent=$('tight-crop').checked?'Cropped vector':'A3 vector';});
for(const button of document.querySelectorAll('.export-choice[data-format]'))button.addEventListener('click',()=>download(button.dataset.format));
$('subject').replaceChildren(...drawings.map(d=>new Option(d.title,d.id)));
 DrawingTheme.subscribe((mode,theme)=>{
  $('appearance').value=mode;
  $('theme-toggle').setAttribute('aria-pressed',String(theme==='dark'));
  $('theme-toggle').title=theme==='dark'?'Switch to light mode':'Switch to dark mode';
 });
 $('theme-toggle').addEventListener('click',()=>DrawingTheme.set(DrawingTheme.theme==='dark'?'light':'dark'));
 $('appearance').addEventListener('change',event=>DrawingTheme.set(event.target.value));
selectDrawing(selected.id);
