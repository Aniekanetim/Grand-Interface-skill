(function(root){
const ns='http://www.w3.org/2000/svg';
function prepare(svg,{crop=false,transparent=false,bounds,metadata={}}={}){
 const copy=svg.cloneNode(true);
 copy.querySelector('#selection-overlay')?.remove();copy.removeAttribute('role');copy.removeAttribute('aria-labelledby');
 for(const el of copy.querySelectorAll('[data-ink-stroke],[data-ink-fill]')){el.removeAttribute('data-ink-stroke');el.removeAttribute('data-ink-fill');}
 for(const el of copy.querySelectorAll('[style]')){el.style.removeProperty('--drawing-ink');if(!el.style.length)el.removeAttribute('style');}
 const page=copy.querySelector('#paper');
 let width=420,height=297;
 if(crop){
  const padding=3,x=bounds.x-padding,y=bounds.y-padding;width=bounds.width+padding*2;height=bounds.height+padding*2;
  copy.setAttribute('viewBox',`${x} ${y} ${width} ${height}`);
  page?.setAttribute('x',x);page?.setAttribute('y',y);page?.setAttribute('width',width);page?.setAttribute('height',height);
 }
 copy.setAttribute('width',width+'mm');copy.setAttribute('height',height+'mm');
 if(transparent)page?.remove();
 const record=document.createElementNS(ns,'metadata');record.textContent=JSON.stringify(metadata);copy.insertBefore(record,copy.firstChild);
 return {svg:copy,width,height};
}
function saveBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
async function pngAt300dpi(blob){
 const bytes=new Uint8Array(await blob.arrayBuffer()),chunk=new Uint8Array(21),view=new DataView(chunk.buffer);
 view.setUint32(0,9);chunk.set([112,72,89,115],4);view.setUint32(8,11811);view.setUint32(12,11811);chunk[16]=1;view.setUint32(17,crc32(chunk.subarray(4,17)));
 const slices=[bytes.subarray(0,8)];let offset=8;
 while(offset<bytes.length){const size=new DataView(bytes.buffer,bytes.byteOffset+offset,4).getUint32(0)+12,type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));if(type!=='pHYs')slices.push(bytes.subarray(offset,offset+size));if(type==='IHDR')slices.push(chunk);offset+=size;}
 return new Blob(slices,{type:'image/png'});
}
async function download(snapshot,format,filename){
 const{svg,width,height}=snapshot,source=new XMLSerializer().serializeToString(svg);
 if(format==='svg'){saveBlob(new Blob([source],{type:'image/svg+xml'}),filename+'.svg');return;}
 if(format==='png'){
  const image=new Image(),url=URL.createObjectURL(new Blob([source],{type:'image/svg+xml'}));
  try{image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=Math.round(width/25.4*300);canvas.height=Math.round(height/25.4*300);const context=canvas.getContext('2d');if(svg.querySelector('#paper')){context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);}context.drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not create PNG');saveBlob(await pngAt300dpi(blob),filename+'.png');}finally{URL.revokeObjectURL(url);}
  return;
 }
 if(format==='pdf'){
  const host=document.createElement('div');host.style.cssText=`position:fixed;left:-10000px;top:0;width:${width}mm;height:${height}mm;`;host.append(svg);document.body.append(host);
  try{const pdf=new jspdf.jsPDF({orientation:width>=height?'landscape':'portrait',unit:'mm',format:[width,height],compress:true});pdf.setProperties({title:filename,subject:'Illustrative technical drawing'});await pdf.svg(svg,{x:0,y:0,width,height});saveBlob(pdf.output('blob'),filename+'.pdf');}finally{host.remove();}
  return;
 }
 throw Error('Unknown export format');
}
root.DrawingExport={prepare,download};
})(globalThis);
