const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function viewerBoundary() {
  const workers = [];
  class ControlledWorker {
    constructor() { this.sent = []; workers.push(this); }
    postMessage(message) { this.sent.push(structuredClone(message)); }
    complete(index, result) { this.onmessage({data:{request:this.sent[index].request,result}}); }
    failModel(index) { this.onmessage({data:{request:this.sent[index].request,error:'Invalid geometry'}}); }
  }
  const context = vm.createContext({Worker:ControlledWorker,Blob,URL,structuredClone,requestId:0,$:()=>({textContent:'"worker source"'})});
  const assets = path.resolve(__dirname, '../assets');
  const queuePath = path.join(assets, 'render-queue.js');
  if (fs.existsSync(queuePath)) vm.runInContext(fs.readFileSync(queuePath, 'utf8'), context);
  const source = fs.readFileSync(path.join(assets, 'viewer.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('const workerUrl='), source.indexOf('function colors()')), context);
  return {context,source,worker:workers[0], request:context.requestGeometry, cancel:()=>vm.runInContext('renderer.cancelPreview()', context)};
}
const target = length => ({params:{length},explosion:0,isolated:null});
const outcome = promise => promise.then(value=>({value}),error=>({error}));

async function run() {
  const {worker,request} = viewerBoundary();
  const first = outcome(request('fixture',target(1),true));
  const stale = outcome(request('fixture',target(2),true));
  const latest = outcome(request('fixture',target(3),true));
  assert.equal(worker.sent.length,1,'A busy worker must not receive queued obsolete previews');
  assert.equal((await stale).error.name,'AbortError');
  worker.complete(0,{markup:'first'});
  assert.deepEqual(worker.sent.map(job=>job.parameters.length),[1,3]);
  worker.complete(1,{markup:'latest'});
  assert.equal((await first).value.markup,'first');
  assert.equal((await latest).value.markup,'latest');

  const ui = viewerBoundary(), timers = new Map(), mounted = [], notices = [];
  let timerId = 0, busy;
  Object.assign(ui.context,{
    selected:{id:'fixture'},states:new Map([['fixture',target(1)]]),renderTimer:null,
    snapshot:()=>structuredClone(ui.context.states.get('fixture')),
    setTimeout:callback=>{timers.set(++timerId,callback);return timerId;},
    clearTimeout:id=>timers.delete(id),updateAvailability:()=>{},
    viewport:{setAttribute:(name,value)=>{if(name==='aria-busy')busy=value;}},
    $:()=>({textContent:''}),document:{},console,
    mountGeometry:(result,subject,settings)=>({node:settings.params.length,group:{}}),
    drawing:{replaceChildren:node=>mounted.push(node)},fitGeometry:()=>1,
    styleGeometry:()=>{},updateSelection:()=>{},renderZoom:()=>{},announce:message=>notices.push(message)
  });
  vm.runInContext(ui.source.slice(ui.source.indexOf('let revision=0;'),ui.source.indexOf('function updateAvailability()')),ui.context);
  function input(length,fire=true){
    ui.context.states.set('fixture',target(length));ui.context.scheduleRender();
    if(fire){const callbacks=[...timers.values()];timers.clear();for(const callback of callbacks)callback();}
  }
  input(1);input(2);input(3);
  assert.equal(ui.worker.sent.length,1);
  ui.worker.complete(0,{markup:'old'});
  await Promise.resolve();await Promise.resolve();
  assert.deepEqual(mounted,[],'Stale results must not mount or enable exports');
  assert.equal(busy,'true');
  assert.equal(ui.worker.sent[1].parameters.length,3);
  ui.worker.complete(1,{markup:'latest'});
  await Promise.resolve();await Promise.resolve();
  assert.deepEqual(mounted,[3]);assert.equal(busy,'false');assert.deepEqual(notices,[]);
  input(4);input(5);input(6,false);
  ui.worker.complete(2,{markup:'old'});
  await Promise.resolve();await Promise.resolve();
  assert.equal(ui.worker.sent.length,3,'Debouncing input must invalidate the previous queued preview immediately');
  assert.equal(busy,'true');
  input(6);ui.worker.complete(3,{markup:'newest'});
  await Promise.resolve();await Promise.resolve();
  assert.deepEqual(mounted,[3,6]);assert.equal(busy,'false');assert.deepEqual(notices,[]);

  const exporting = viewerBoundary();
  const preview = outcome(exporting.request('old-drawing',target(1),true));
  const queued = outcome(exporting.request('old-drawing',target(2),true));
  const saved = target(7); saved.isolated = 'part-a';
  const download = outcome(exporting.request('old-drawing',saved));
  saved.params.length = 99;
  const newSubject = outcome(exporting.request('new-drawing',target(4),true));
  assert.equal((await queued).error.name,'AbortError');
  exporting.worker.complete(0,{markup:'old preview'});
  assert.equal(exporting.worker.sent[1].parameters.length,7,'An export must retain its captured dimensions');
  assert.equal(exporting.worker.sent[1].isolated,'part-a');
  assert.equal(exporting.worker.sent[1].id,'old-drawing');
  exporting.worker.complete(1,{markup:'export'});
  assert.equal(exporting.worker.sent[2].id,'new-drawing');
  exporting.worker.complete(2,{markup:'new preview'});
  assert.equal((await download).value.markup,'export');
  await preview; await newSubject;

  const debouncing = viewerBoundary();
  const active = outcome(debouncing.request('fixture',target(1),true));
  const obsolete = outcome(debouncing.request('fixture',target(2),true));
  debouncing.cancel();
  assert.equal((await obsolete).error.name,'AbortError');
  debouncing.worker.complete(0,{markup:'active'});
  assert.equal(debouncing.worker.sent.length,1,'The previous queued state must not start during a newer debounce');
  await active;

  const errors = viewerBoundary();
  const failed = outcome(errors.request('fixture',target(1),true));
  const next = outcome(errors.request('fixture',target(2),true));
  errors.worker.failModel(0);
  assert.match((await failed).error.message,/Invalid geometry/);
  errors.worker.complete(1,{markup:'recovered'});
  assert.equal((await next).value.markup,'recovered');
  const crash = outcome(errors.request('fixture',target(3),true));
  const waiting = outcome(errors.request('fixture',target(4),true));
  errors.worker.onerror({message:'Worker crashed'});
  assert.match((await crash).error.message,/Worker crashed/);
  assert.match((await waiting).error.message,/Worker crashed/);
  assert.match((await outcome(errors.request('fixture',target(5),true))).error.message,/Worker crashed/);
  console.log('Passed preview coalescing, export snapshots, debounce cancellation, model errors and worker failure.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
