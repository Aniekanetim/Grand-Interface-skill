(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const add = (a, b) => a.map((n, i) => n + b[i]);
  const sub = (a, b) => a.map((n, i) => n - b[i]);
  const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const unit = a => { const length = Math.hypot(...a); if (!length) throw Error('Zero direction'); return a.map(n => n / length); };
  const finite = n => { if (!Number.isFinite(n)) throw Error('Expected a finite number'); return n; };
  const positive = n => { finite(n); if (n <= 0) throw Error('Expected a positive number'); return n; };
  const count = (n, min = 3, max = 512) => { if (!Number.isInteger(n) || n < min || n > max) throw Error(`Count must be ${min}–${max}`); return n; };
  function part(id, name, explosion = [0, 0, 0]) {
    if (!name || !String(id)) throw Error('A part needs a stable ID and name');
    if(!Array.isArray(explosion)||explosion.length!==3)throw Error('Explosion needs three coordinates');
    explosion.forEach(finite);
    return {id, name, explosion, vertices: [], triangles: [], lines: []};
  }
  function line(p, a, b, width = .22, detail = '') {
    [...a, ...b, width].forEach(finite);
    if (Math.hypot(...sub(a,b)) > 1e-9) p.lines.push({a, b, width, detail});
  }
  function ringPoints(center, radius, u, v, {start = 0, end = TAU, tolerance = .008} = {}) {
    positive(radius); positive(tolerance); [...center, ...u, ...v, start, end].forEach(finite);
    if (Math.abs(dot(u,v)) > 1e-6 || Math.abs(Math.hypot(...u)-1) > 1e-6 || Math.abs(Math.hypot(...v)-1) > 1e-6) throw Error('Circle axes must be orthonormal');
    const step = 2 * Math.acos(Math.max(-1, 1-Math.min(tolerance/radius, 1)));
    const segments = Math.max(1, Math.ceil(Math.abs(end-start)/step));
    if (segments > 8192) throw Error('Curve tolerance requires too many segments');
    return Array.from({length:segments+1}, (_,i) => {
      const t = start+(end-start)*i/segments;
      return center.map((n,k) => n+radius*(u[k]*Math.cos(t)+v[k]*Math.sin(t)));
    });
  }
  function hexRadius(r, t) {
    const local = ((t+Math.PI/6)%(Math.PI/3)+Math.PI/3)%(Math.PI/3)-Math.PI/6;
    return r*Math.cos(Math.PI/6)/Math.cos(local);
  }
  function ring(p, x, r, width=.22, kind='c') {
    positive(r);
    const n = 144;
    for (let j=0;j<n;j++) {
      const point=t=>[x,(kind==='h'?hexRadius(r,t):r)*Math.cos(t),(kind==='h'?hexRadius(r,t):r)*Math.sin(t)];
      line(p,point(TAU*j/n),point(TAU*(j+1)/n),width);
    }
  }
  function lathe(p, profile, {segments=144, start=0, end=TAU, omitRings=[], width=.22} = {}) {
    count(segments, 12, 720);
    if(profile.some(p=>p[2]==='h') && segments%12!==0)throw Error('Hex profiles need a segment count divisible by 12');
    if (profile.length < 3) throw Error('A lathe needs a closed radial profile');
    for (const [x,r] of profile) { finite(x); finite(r); if (r<0) throw Error('Negative radius'); }
    if (!(end>start && end-start<=TAU+1e-8)) throw Error('Invalid lathe arc');
    const partial = end-start<TAU-1e-8, n = Math.ceil(segments*(end-start)/TAU), cols=partial?n+1:n;
    const offset=p.vertices.length, idx=(i,j)=>offset+i*cols+j;
    for (const [x,r,kind] of profile) for (let j=0;j<cols;j++) {
      const t=start+(end-start)*j/n, radius=kind==='h'?hexRadius(r,t):r;
      p.vertices.push([x,radius*Math.cos(t),radius*Math.sin(t)]);
    }
    for (let i=0;i<profile.length;i++) {
      const k=(i+1)%profile.length;
      for (let j=0;j<n;j++) {
        const q=partial?j+1:(j+1)%cols,a=idx(i,j),b=idx(k,j),c=idx(k,q),d=idx(i,q);
        p.triangles.push([a,b,c],[a,c,d]);
        if (!omitRings.includes(i)) line(p,p.vertices[a],p.vertices[d],width);
      }
      if (profile[i][2]==='h' && profile[k][2]==='h') for (let j=segments/12;j<cols;j+=segments/6) line(p,p.vertices[idx(i,j)],p.vertices[idx(k,j)],width);
    }
    if (partial) for (const side of [0,cols-1]) {
      for(let i=1;i<profile.length-1;i++) p.triangles.push([idx(0,side),idx(i,side),idx(i+1,side)]);
      for(let i=0;i<profile.length;i++) line(p,p.vertices[idx(i,side)],p.vertices[idx((i+1)%profile.length,side)],width);
    }
    return p;
  }
  function helix(p, {x0,x1,radius,pitch,phase=0,hand=1,width=.13,detail='thread'}) {
    positive(radius); positive(pitch); [x0,x1,phase].forEach(finite);
    if (x1<=x0 || ![-1,1].includes(hand)) throw Error('Invalid helix span or handedness');
    const n=Math.ceil((x1-x0)/pitch*96);
    if (n>100000) throw Error('Helix is too dense');
    let previous;
    for(let i=0;i<=n;i++) {
      const x=x0+(x1-x0)*i/n,t=phase+hand*(x-x0)*TAU/pitch,point=[x,radius*Math.cos(t),radius*Math.sin(t)];
      if(previous)line(p,previous,point,width,detail); previous=point;
    }
    return p;
  }
  function knurl(p, {x0,x1,radius,starts=12,pitch=48,width=.1}) {
    count(starts,3,48);
    for(let i=0;i<starts;i++)for(const hand of[-1,1])helix(p,{x0,x1,radius,pitch,phase:TAU*i/starts,hand,width,detail:'texture'});
    return p;
  }
  function spring(p, {x0,x1,radius,wire,turns=8,stepsPerTurn=128,wireSteps=32}) {
    [radius,wire,turns].forEach(positive);[x0,x1].forEach(finite);count(stepsPerTurn,24,192);count(wireSteps,6,64);
    if (x1<=x0 || wire>=radius || (x1-x0)/turns<=2*wire) throw Error('Spring coils intersect');
    const steps=Math.ceil(turns*stepsPerTurn),base=p.vertices.length;
    if(steps>10000)throw Error('Spring is too dense');
    for(let i=0;i<=steps;i++) {
      const t=i/steps*TAU*turns,x=x0+(x1-x0)*i/steps,radial=[0,Math.cos(t),Math.sin(t)];
      const tangent=unit([(x1-x0)/(TAU*turns),-radius*Math.sin(t),radius*Math.cos(t)]),normal=cross(radial,tangent);
      for(let j=0;j<wireSteps;j++){const a=TAU*j/wireSteps;p.vertices.push([x,radius*Math.cos(t),radius*Math.sin(t)].map((n,k)=>n+wire*(radial[k]*Math.cos(a)+normal[k]*Math.sin(a))));}
    }
    for(let i=0;i<steps;i++)for(let j=0;j<wireSteps;j++) {
      const a=base+i*wireSteps+j,b=base+i*wireSteps+(j+1)%wireSteps,c=b+wireSteps,d=a+wireSteps;
      p.triangles.push([a,b,c],[a,c,d]);
    }
    for(const end of[0,steps]) {
      const center=p.vertices.length, t=end/steps*TAU*turns;
      p.vertices.push([x0+(x1-x0)*end/steps,radius*Math.cos(t),radius*Math.sin(t)]);
      for(let j=0;j<wireSteps;j++){const a=base+end*wireSteps+j,b=base+end*wireSteps+(j+1)%wireSteps;p.triangles.push(end?[center,a,b]:[center,b,a]);line(p,p.vertices[a],p.vertices[b],.13);}
    }
    return p;
  }
  function screw(p, {length=10,radius=1.5,headRadius=3,headHeight=2,pitch=.8}) {
    [length,radius,headRadius,headHeight,pitch].forEach(positive);
    if(headRadius<radius || length<=pitch)throw Error('Invalid screw dimensions');
    lathe(p,[[0,radius],[length,radius],[length,headRadius],[length+headHeight,headRadius],[length+headHeight,0],[0,0]]);
    helix(p,{x0:pitch/2,x1:length-pitch/2,radius:radius+.004,pitch});
    line(p,[length+headHeight,-headRadius*.7,0],[length+headHeight,headRadius*.7,0],.16);
    return p;
  }
  function roundedRectangle(width,height,radius,{x=0,y=0,tolerance=.01}={}) {
    positive(width);positive(height);positive(radius);positive(tolerance);
    if(radius>Math.min(width,height)/2)throw Error('Corner radius exceeds profile');
    const points=[];
    for(const [cx,cy,start]of[[width/2-radius,radius,-Math.PI/2],[width/2-radius,height-radius,0],[-width/2+radius,height-radius,Math.PI/2],[-width/2+radius,radius,Math.PI]]) {
      const arc=ringPoints([cx,cy,0],radius,[1,0,0],[0,1,0],{start,end:start+Math.PI/2,tolerance});
      points.push(...arc.map(p=>[p[0]+x,p[1]+y]));
    }
    return points;
  }
  function transform(p,{origin=[0,0,0],xAxis=[1,0,0],yAxis=[0,1,0],zAxis=[0,0,1]}={}) {
    const vectors=[origin,xAxis,yAxis,zAxis];
    if(vectors.some(v=>!Array.isArray(v)||v.length!==3))throw Error('A frame needs three-coordinate vectors');
    vectors.flat().forEach(finite);
    if([xAxis,yAxis,zAxis].some(v=>Math.abs(Math.hypot(...v)-1)>1e-6)||Math.abs(dot(xAxis,yAxis))>1e-6||Math.hypot(...sub(cross(xAxis,yAxis),zAxis))>1e-6)throw Error('Frame axes must be right-handed and orthonormal');
    const rotate=v=>origin.map((_,i)=>v[0]*xAxis[i]+v[1]*yAxis[i]+v[2]*zAxis[i]),point=v=>add(origin,rotate(v));
    p.vertices=p.vertices.map(point);p.lines=p.lines.map(l=>({...l,a:point(l.a),b:point(l.b)}));p.explosion=rotate(p.explosion);
    return p;
  }
  function merge(target,source) {
    if(target===source)throw Error('Cannot merge a part into itself');
    if(source.explosion.some(n=>n!==0))throw Error('Construction pieces must have zero explosion before merging');
    const base=target.vertices.length;
    for(const v of source.vertices)target.vertices.push([...v]);
    for(const f of source.triangles)target.triangles.push(f.map(i=>base+i));
    for(const l of source.lines)target.lines.push({...l,a:[...l.a],b:[...l.b]});
    return target;
  }
  function extrude(p,profile,{depth,width=.22,creaseAngle=25}={}) {
    positive(depth);positive(width);finite(creaseAngle);
    if(creaseAngle<0||creaseAngle>180)throw Error('Invalid crease angle');
    if(!Array.isArray(profile)||profile.length<3||profile.length>1024)throw Error('Extrusion needs 3–1024 profile points');
    for(const v of profile){if(!Array.isArray(v)||v.length!==2)throw Error('Profile points need two coordinates');v.forEach(finite);}
    const span=Math.max(...[0,1].map(k=>Math.max(...profile.map(p=>p[k]))-Math.min(...profile.map(p=>p[k])))),epsilon=Math.max(span*1e-10,1e-12);
    const same=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<=epsilon;
    const points=profile.filter((v,i)=>!i||!same(v,profile[i-1])).map(v=>[...v]);
    if(points.length>1&&same(points[0],points.at(-1)))points.pop();
    const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),areaTolerance=epsilon*span;
    for(let i=points.length-1;i>=0&&points.length>3;i--){const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length];if(Math.abs(turn(a,b,c))<=areaTolerance&&(b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1])>=0)points.splice(i,1);}
    const onSegment=(a,b,c)=>Math.abs(turn(a,b,c))<=areaTolerance&&c[0]>=Math.min(a[0],b[0])-epsilon&&c[0]<=Math.max(a[0],b[0])+epsilon&&c[1]>=Math.min(a[1],b[1])-epsilon&&c[1]<=Math.max(a[1],b[1])+epsilon;
    for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
      if(j===i+1||(i===0&&j===points.length-1))continue;
      const a=points[i],b=points[(i+1)%points.length],c=points[j],d=points[(j+1)%points.length];
      if((turn(a,b,c)*turn(a,b,d)<0&&turn(c,d,a)*turn(c,d,b)<0)||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b))throw Error('Extrusion profile must not intersect itself');
    }
    let area=points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2;
    if(points.length<3||Math.abs(area)<=areaTolerance)throw Error('Extrusion profile has no area');
    if(area<0)points.reverse();
    const remaining=points.map((_,i)=>i),caps=[];
    while(remaining.length>3){
      const ear=remaining.findIndex((b,i)=>{
        const a=remaining[(i+remaining.length-1)%remaining.length],c=remaining[(i+1)%remaining.length];
        return turn(points[a],points[b],points[c])>areaTolerance&&!remaining.some(v=>v!==a&&v!==b&&v!==c&&turn(points[a],points[b],points[v])>=-areaTolerance&&turn(points[b],points[c],points[v])>=-areaTolerance&&turn(points[c],points[a],points[v])>=-areaTolerance);
      });
      if(ear<0)throw Error('Could not triangulate extrusion profile');
      caps.push([remaining[(ear+remaining.length-1)%remaining.length],remaining[ear],remaining[(ear+1)%remaining.length]]);remaining.splice(ear,1);
    }
    caps.push([...remaining]);
    const base=p.vertices.length,n=points.length;
    for(const z of[0,depth])p.vertices.push(...points.map(([x,y])=>[x,y,z]));
    for(const[a,b,c]of caps)p.triangles.push([base+c,base+b,base+a],[base+n+a,base+n+b,base+n+c]);
    for(let i=0;i<n;i++){
      const j=(i+1)%n,a=base+i,b=base+j,c=base+n+j,d=base+n+i;
      p.triangles.push([a,b,c],[a,c,d]);line(p,p.vertices[a],p.vertices[b],width);line(p,p.vertices[d],p.vertices[c],width);
      const previous=points[(i+n-1)%n],here=points[i],next=points[j],u=unit([here[0]-previous[0],here[1]-previous[1],0]),v=unit([next[0]-here[0],next[1]-here[1],0]);
      if(dot(u,v)<=Math.cos(creaseAngle*Math.PI/180))line(p,p.vertices[a],p.vertices[d],width);
    }
    return p;
  }
  const api={TAU,add,sub,dot,cross,unit,part,line,ringPoints,ring,lathe,helix,knurl,spring,screw,roundedRectangle,extrude,transform,merge};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.TechnicalGeometry=api;
})(globalThis);
