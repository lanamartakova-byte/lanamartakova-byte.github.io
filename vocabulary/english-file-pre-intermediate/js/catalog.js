// Textbook structure is independent of which vocabulary files are ready.
export function unitSlots(book) {
  const configured=book.units??[];
  const count=book.totalUnits??Math.max(0,...configured.map(u=>u.number));
  if(!Number.isInteger(count)||count<1)throw Error('Textbook totalUnits must be a positive integer.');
  const seen=new Set();
  for(const u of configured){
    if(!Number.isInteger(u.number)||u.number<1||u.number>count||seen.has(u.number)||!u.file)throw Error('Invalid or duplicate textbook unit configuration.');
    seen.add(u.number);
  }
  return Array.from({length:count},(_,i)=>{
    const number=i+1,entry=configured.find(u=>u.number===number);
    return {number,file:entry?.file??(book.unitFilePattern??'unit-{number}.json').replace('{number}',String(number).padStart(2,'0')),required:!!entry};
  });
}
export async function loadUnits(book,request) {
  return Promise.all(unitSlots(book).map(async slot=>{
    if(!slot.required)return {unit:slot.number,words:[]};
    const response=await request(`./data/${slot.file}`,{cache:'no-store'});
    if(!response.ok)throw Error(`Unable to load ${slot.file} (${response.status})`);
    const unit=await response.json();
    if(unit.unit!==slot.number||!Array.isArray(unit.words))throw Error(`Invalid vocabulary structure or unit number: ${slot.file}`);
    return unit;
  }));
}

// Explicit membership; units without configured parts retain their existing menu.
export function partSelections(unit) {
  if(!unit.parts?.length)return [];
  const words=new Map(unit.words.map(w=>[w.id,w])),seen=new Set(),ids=new Set();
  const parts=unit.parts.map(p=>{
    if(!p.id||p.id==='revision'||ids.has(p.id)||!p.title?.trim()||!Array.isArray(p.wordIds)||!p.wordIds.length)throw Error('Invalid part configuration');
    ids.add(p.id);
    const selected=p.wordIds.map(id=>{
      if(!words.has(id)||seen.has(id))throw Error(`Missing or repeated part vocabulary: ${id}`);
      seen.add(id);return words.get(id);
    });
    return {id:p.id,title:p.title,words:selected};
  });
  if(seen.size!==words.size)throw Error('Parts must cover all unit vocabulary');
  return [...parts,{id:'revision',title:'Revision',words:[...unit.words]}];
}
