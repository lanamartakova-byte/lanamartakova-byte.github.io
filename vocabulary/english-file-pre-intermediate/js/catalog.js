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
