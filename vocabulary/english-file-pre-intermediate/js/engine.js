export const normalize = value => value.trim().toLocaleLowerCase('en-GB');
export const shuffle = (items, random = Math.random) => {
  const result = [...items];
  for (let i=result.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
  return result;
};
export function validateUnits(units) {
  const ids=new Set(), en=new Map(), ru=new Map(), errors=[], warnings=[];
  const numbers=new Set();
  for(const unit of units) {
    if(!Number.isInteger(unit.unit)||unit.unit<1||numbers.has(unit.unit)) errors.push('Invalid/duplicate unit number');
    numbers.add(unit.unit);
    for(const word of unit.words??[]) {
      if(!word.id||ids.has(word.id)) errors.push(`Missing/duplicate ID: ${word.id??word.english}`);
      ids.add(word.id);
      if(!word.english?.trim()||!word.russian?.trim()) {errors.push(`Empty label: ${word.id}`);continue;}
      const e=normalize(word.english), r=normalize(word.russian);
      if(en.has(e)&&en.get(e)!==r) errors.push(`Inconsistent English mapping: ${e}`);
      if(ru.has(r)&&ru.get(r)!==e) warnings.push(`Ambiguous translation: ${r}`);
      if(en.has(e)) warnings.push(`Repeated entry retained: ${e}`);
      en.set(e,r);ru.set(r,e);
      if(word.alternatives && (!Array.isArray(word.alternatives)||word.alternatives.some(x=>typeof x!=='string'||!x.trim()))) errors.push(`Invalid alternatives: ${word.id}`);
    }
  }
  return {errors,warnings};
}
export function reviewGroups(units) {
  const available=new Map(units.filter(u=>u.words?.length).map(u=>[u.unit,u]));
  const groups=[];
  for(const number of [...available.keys()].sort((a,b)=>a-b)) if(number%3===1&&available.has(number+1)&&available.has(number+2)) {
    groups.push({start:number,end:number+2,words:[...available.get(number).words,...available.get(number+1).words,...available.get(number+2).words]});
  }
  return groups;
}
export function compatible(a,b,groups=[]) {
  return normalize(a.english)!==normalize(b.english)&&normalize(a.russian)!==normalize(b.russian)&&!groups.some(g=>g.includes(a.english)&&g.includes(b.english));
}
export function choices(word,pool,direction,groups=[],random=Math.random) {
  const candidates=shuffle(pool.filter(w=>compatible(word,w,groups)),random), picked=[word];
  for(const w of candidates) if(picked.every(p=>compatible(w,p,groups))) {picked.push(w);if(picked.length===4)break;}
  return picked.length===4?shuffle(picked,random):null;
}
export function matchingSets(words,groups=[]) {
  const pending=[...words],sets=[];
  while(pending.length) {
    const set=[pending.shift()];
    for(let i=0;i<pending.length&&set.length<4;) {
      if(set.every(w=>compatible(w,pending[i],groups))) set.push(...pending.splice(i,1)); else i++;
    }
    sets.push({type:'Matching',words:set,right:shuffle(set)});
  }
  return sets;
}
export function planSession(mode,words,groups=[]) {
  if(mode==='Flashcards')return words.map(word=>({type:mode,word}));
  if(mode==='Matching')return matchingSets(words,groups);
  if(mode==='Mixed Practice'||mode==='Review') {
    const order=shuffle(words),plan=[];let index=0,cycle=0;
    const types=['Listening','Matching','Spelling','Quiz','Quiz'];
    while(index<order.length) {
      const type=types[cycle%5],direction=cycle%5===4?'ru-en':'en-ru';
      if(type==='Matching') {
        // Compatibility-aware grouping prevents ambiguous matching prompts.
        const batch=order.slice(index,index+4);plan.push(...matchingSets(batch,groups));index+=batch.length;
      } else {
        const word=order[index++],options=choices(word,words,direction,groups);
        plan.push({type:type!=='Spelling'&&!options?'Spelling':type,word,direction,options,fallback:type!=='Spelling'&&!options});
      }
      cycle++;
    }
    return plan;
  }
  return words.map((word,i)=>{
    const direction=i%2?'ru-en':'en-ru', options=choices(word,words,direction,groups);
    return {type:mode!=='Spelling'&&!options?'Spelling':mode,word,direction,options,fallback:mode!=='Spelling'&&!options};
  });
}
export const denominator = plan => plan.reduce((sum,t)=>sum+(t.words?.length??1),0);
export const accepts = (word,answer) => [word.english,...(word.alternatives??[])].some(a=>normalize(a)===normalize(answer));
export function newResponse() {return {selected:null,pairs:{},active:null,text:'',attempts:0,done:false,credit:0,feedback:'',revealed:false};}
export function resetResponse(r) {if(r.done)return; r.selected=null;r.pairs={};r.active=null;r.text='';r.feedback=r.attempts?'Try again!':'';}
export function connect(r,left,right) {
  if(r.done)return;
  for(const id of Object.keys(r.pairs))if(r.pairs[id]===right)delete r.pairs[id];
  r.pairs[left]=right;r.active=null;
}
export function check(task,r) {
  if(r.done)return;
  if(task.type==='Spelling') {
    if(!r.text.trim()||r.attempts>=2)return;
    r.attempts++;
    if(accepts(task.word,r.text)){r.done=true;r.credit=1;r.feedback='Correct!';}
    else r.feedback=r.attempts===1?'Try again!':'Two attempts used. Tap Show Answer to continue.';
  } else if(task.type==='Matching') {
    if(Object.keys(r.pairs).length!==task.words.length)return;
    r.credit=task.words.filter(w=>r.pairs[w.id]===w.id).length;r.done=true;r.feedback=`${r.credit} / ${task.words.length} pairs correct.`;
  } else {
    if(!r.selected)return;
    r.credit=Number(r.selected===task.word.id);r.done=true;
    r.feedback=r.credit?'Correct!':`Incorrect. ${task.word.english} — ${task.word.russian}`;
  }
}
export function reveal(task,r) {if(task.type==='Spelling'&&r.attempts===2&&!r.done){r.done=true;r.revealed=true;r.feedback=`Answer: ${task.word.english}`;}}
export function resultMessage(percent) {return percent>=90?'Excellent!':percent>=70?'Great job!':percent>=50?'Good effort!':'Keep practising!';}
