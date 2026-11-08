import {loadUnits} from './catalog.js?v=0c8318f38e9b';
import {validateUnits,reviewGroups,planSession,denominator,newResponse,resetResponse,connect,check,reveal,resultMessage} from './engine.js?v=df084b53c91b';
import {AudioFeedback} from './audio.js?v=f26b033aad17';
const app=document.querySelector('#app'),audio=new AudioFeedback();
const modes=['Flashcards','Listening','Matching','Spelling','Quiz','Mixed Practice'];
const paths={back:'M20 12H4m7-7-7 7 7 7',previous:'m15 5-7 7 7 7',next:'m9 5 7 7-7 7',play:'m8 4 12 8-12 8Z',book:'M3 5q5-3 9 0 4-3 9 0v15q-5-3-9 0-4-3-9 0Zm9 0v15',Flashcards:'m4 7 12-3 4 14-12 3ZM3 11l3 11 13-3',Listening:'M4 15v-3a8 8 0 0 1 16 0v3M4 13H2v7h5v-7Zm16 0h2v7h-5v-7',Matching:'M3 7h6m6 0h6M3 17h6m6 0h6M9 7l6 10M9 17l6-10',Spelling:'m4 16 12-12 4 4L8 20H4Zm10-10 4 4',Quiz:'M7 7a5 5 0 0 1 10 0c0 4-5 3-5 7m0 4v1M4 3h16v19H4Z','Mixed Practice':'M3 6h4c5 0 5 12 10 12h4m-4-4 4 4-4 4M3 18h4c5 0 5-12 10-12h4m-4-4 4 4-4 4',Review:'M20 8a8 8 0 1 0 0 9M20 3v6h-6',Results:'M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3q0 5 5 5m9-8h4v3q0 5-5 5m-4 2v5m-4 1h8',speaker:'m3 9 5 0 5-5v16l-5-5H3Zm14-2q6 5 0 10m-1-7q2 2 0 4'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.book}"/></svg>`;
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,extra='')=>`<button data-action="${action}" ${extra}>${label}</button>`;
let book,units,unit,review=null,mode,plan=[],position=0,response=newResponse(),score=0,flipped=false,screen='home';
let resizeObserver;
let fullViewportHeight=window.innerHeight,viewportWidth=window.innerWidth;
function updateViewport(){
 const viewport=window.visualViewport;
 if(Math.abs(window.innerWidth-viewportWidth)>100){fullViewportHeight=window.innerHeight;viewportWidth=window.innerWidth;}
 fullViewportHeight=Math.max(fullViewportHeight,window.innerHeight);
 const visibleHeight=viewport?.height??window.innerHeight;
 if(viewport&&viewport.scale===1)document.documentElement.style.setProperty('--viewport-height',`${Math.round(viewport.height)}px`);
 else document.documentElement.style.removeProperty('--viewport-height');
 document.body.classList.toggle('keyboard-open',app.dataset.screen==='exercise'&&app.dataset.task==='Spelling'&&(!viewport||viewport.scale===1)&&visibleHeight<fullViewportHeight*0.78);
}
window.visualViewport?.addEventListener('resize',updateViewport);
window.addEventListener('resize',()=>{updateViewport();if(app.dataset.task==='Matching')requestAnimationFrame(drawLines);});
const label=()=>review?`Review: Units ${review.start}–${review.end}`:`Unit ${unit.unit}`;
function header(title,back='menu',symbol=mode){return `<header class="heading">${button(icon('back'),back,'class="back" aria-label="Back"')}<h1>${icon(symbol)}<span>${esc(title)}</span></h1></header>`;}
function mount(html,focus=true){resizeObserver?.disconnect();document.body.dataset.screen=screen;app.dataset.screen=screen;app.innerHTML=html;updateViewport();if(focus){app.focus({preventScroll:true});window.scrollTo(0,0);} }
function home(){screen='home';audio.stop();review=null;let grid='';const reviews=reviewGroups(units);
 for(const u of units) {
 grid+=button(`${icon('book')}<span>Unit ${u.unit}</span><b aria-hidden="true">›</b>`,'unit',`class="unit" data-unit="${u.unit}" ${u.words.length?'':`disabled aria-label="Unit ${u.unit}: vocabulary not available yet" title="Vocabulary not available yet"`}`);
 const group=reviews.find(g=>g.end===u.unit);if(u.unit%3===0)grid+=button(`${icon('Review')}<span>Review: Units ${u.unit-2}–${u.unit}</span><b aria-hidden="true">›</b>`,'review',`class="review" data-start="${u.unit-2}" ${group?'':`disabled aria-label="Review: Units ${u.unit-2}–${u.unit}: vocabulary not available yet" title="Available when all three units contain vocabulary"`}`);
 }
 mount(`<section class="book-header">${icon('book')}<div><h1>${esc(book.title)}</h1><p>${esc(book.level)}</p></div></section><h2 class="choose">Choose a unit</h2><div class="unit-grid">${grid}</div>`);
}
function menu(){screen='menu';audio.stop();review=null;mount(`${header(`${book.title} · ${book.level}`,'home','book')}<h2 class="unit-title">${icon('book')}Unit ${unit.unit}</h2><div class="mode-list">${modes.map(m=>button(`${icon(m)}<span>${m}</span><b aria-hidden="true">›</b>`,'start',`data-mode="${m}"`)).join('')}</div>`);}
function start(selected){mode=selected;const words=review?review.words:unit.words;plan=planSession(mode,words,book.confusableGroups);position=0;score=0;response=newResponse();flipped=false;screen='exercise';renderTask();}
function renderTask(focus=true){audio.stop();const t=plan[position],r=response;app.dataset.task=t.type;app.dataset.mode=mode;
 let content='',instruction='',controls='';
 if(mode==='Flashcards') {
 content=`<div class="flash-row">${button(icon('previous'),'previous','class="arrow" aria-label="Previous card"'+(position===0?' disabled':''))}<div class="flash-panel" data-card="true"><button class="card-word" data-action="flip" aria-label="Flip card"><span lang="${flipped?'ru':'en'}">${esc(flipped?t.word.russian:t.word.english)}</span></button><div class="speaker-slot">${flipped?'':button(icon('speaker'),'speak','class="play" aria-label="Pronounce English word"')}</div></div>${button(icon('next'),'card-next','class="arrow" aria-label="Next card"')}</div>${button('↻ Flip','flip','class="flip"')}`;
 } else {
 if(t.type==='Spelling') {
 instruction='Type the English word for the Russian translation.';
 content=`<div class="prompt" lang="ru">${esc(t.word.russian)}</div><label class="sr-only" for="answer">English word or phrase</label><input id="answer" lang="en" type="text" placeholder="Type the word in English…" autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="none" value="${esc(r.text)}" ${r.done||r.attempts>=2?'disabled':''}>`;
 } else if(t.type==='Matching') {
 instruction='Match the English words with their translations.';
 const item=(w,side)=>{
 const linked=side==='left'?r.pairs[w.id]:Object.values(r.pairs).includes(w.id);
 const owner=side==='left'?w.id:Object.keys(r.pairs).find(k=>r.pairs[k]===w.id);
 const state=r.done?(owner=== (side==='left'?r.pairs[w.id]:w.id)?'correct':'incorrect'):r.active===w.id&&side==='left'?'selected':linked?'linked':'';
 return button(`<span lang="${side==='left'?'en':'ru'}">${esc(side==='left'?w.english:w.russian)}${r.done?(state==='correct'?' ✓':' ×'):''}</span><i aria-hidden="true"></i>`,'pair',`class="match-item ${state}" data-side="${side}" data-id="${w.id}" aria-pressed="${!!(linked||r.active===w.id)}" ${r.done?'disabled':''} aria-label="${esc(side==='left'?w.english:w.russian)}${linked?', connected':''}${r.done?`, ${state}`:''}"`);
 };
 content=`<div class="matching" style="--pair-count:${t.words.length}"><svg class="connections" aria-hidden="true"></svg><div class="match-column">${t.words.map(w=>item(w,'left')).join('')}</div><div class="match-column">${t.right.map(w=>item(w,'right')).join('')}</div></div><p class="match-help">Tap English, then Russian. Tap again to reassign.</p>`;
 } else {
 instruction=t.type==='Listening'?'Listen and choose the correct translation.':'Choose the correct translation of the word.';
 const direction=t.type==='Listening'?'en-ru':t.direction;
 content=(t.type==='Listening'?`<div class="listening-play"><span aria-hidden="true">ııΙıı</span>${button(icon('play'),'speak','class="play" aria-label="Play English word"')}<span aria-hidden="true">ııΙıı</span></div>`:`<div class="prompt" lang="${direction==='ru-en'?'ru':'en'}">${esc(direction==='ru-en'?t.word.russian:t.word.english)}</div>`)+`<div class="options" role="group" aria-label="Answer choices">${t.options.map(w=>button(`<span class="radio" aria-hidden="true"></span><span lang="${direction==='ru-en'?'en':'ru'}">${esc(direction==='ru-en'?w.english:w.russian)}</span>${r.done?(w.id===t.word.id?' <span aria-label="correct answer">✓</span>':w.id===r.selected?' <span aria-label="incorrect answer">×</span>':''):''}`,'option',`class="option ${r.done&&w.id===t.word.id?'correct':r.done&&w.id===r.selected?'incorrect':r.selected===w.id?'selected':''}" data-id="${w.id}" aria-pressed="${r.selected===w.id}" ${r.done?'disabled':''}`)).join('')}</div>`;
 }
 const enabled=t.type==='Spelling'?!!r.text.trim():t.type==='Matching'?Object.keys(r.pairs).length===t.words.length:!!r.selected;
 controls=`<p id="feedback" class="feedback ${r.done?(r.credit?'success':'failure'):''}" role="status">${esc(r.feedback)}</p><div class="actions">${button('↶ Reset','reset',r.done?'disabled':'')}${r.done?button(`Next ${icon('next')}`,'next','class="primary"'):t.type==='Spelling'&&r.attempts>=2?button('Show Answer','reveal','class="primary"'):button('✓ Check','check',`id="check" class="primary" ${enabled?'':'disabled'}`)}</div>`;
 }
 mount(`${header(`${label()} · ${mode}`,review?'home':'menu')}
 <div class="counter" aria-label="${mode==='Matching'?'Set':mode==='Flashcards'?'Card':'Task'} ${position+1} of ${plan.length}">${position+1} / ${plan.length}</div>${mode==='Mixed Practice'||mode==='Review'?`<p class="task-kind">${t.type}${t.type==='Quiz'?` · ${t.direction==='ru-en'?'Russian → English':'English → Russian'}`:''}</p>`:''}${mode!=='Spelling'&&mode!=='Flashcards'&&plan.some(q=>q.fallback)?`<p class="availability-note">Where four unambiguous choices are unavailable, this session uses Spelling.</p>`:''}${instruction?`<p class="instruction">${instruction}</p>`:''}${content}${controls}<p id="audio-status" class="audio-status" role="status"></p>`,focus);
 if(t.type==='Matching') {resizeObserver=new ResizeObserver(drawLines);resizeObserver.observe(document.querySelector('.matching'));requestAnimationFrame(drawLines);}
 const input=document.querySelector('#answer');if(input){input.oninput=()=>{r.text=input.value;const checkButton=document.querySelector('#check');if(checkButton)checkButton.disabled=!r.text.trim();};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();act('check');}};input.onfocus=()=>updateViewport();input.onblur=()=>updateViewport();}
 if(mode==='Flashcards'){const card=document.querySelector('.flash-panel');let x,y;card.addEventListener('touchstart',e=>{x=e.changedTouches[0].clientX;y=e.changedTouches[0].clientY;},{passive:true});card.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-x,dy=e.changedTouches[0].clientY-y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)){act(dx<0?'card-next':'previous');}},{passive:true});}
}
function drawLines(){const container=document.querySelector('.matching');if(!container)return;const svg=container.querySelector('svg'),base=container.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${base.width} ${base.height}`);svg.innerHTML=Object.entries(response.pairs).map(([left,right])=>{const a=container.querySelector(`[data-side="left"][data-id="${left}"] i`).getBoundingClientRect(),b=container.querySelector(`[data-side="right"][data-id="${right}"] i`).getBoundingClientRect();return `<line x1="${a.x+a.width/2-base.x}" y1="${a.y+a.height/2-base.y}" x2="${b.x+b.width/2-base.x}" y2="${b.y+b.height/2-base.y}" stroke="${response.done?(left===right?'#11834f':'#b73545'):'#08bde9'}" stroke-width="3"/>`;}).join('');}
function results(){screen='results';audio.stop();const total=denominator(plan),pct=Math.round(score/total*100);mount(`${header(`${label()} · Results`,review?'home':'menu','Results')}<div class="result-art" aria-hidden="true">${pct>=90?'🏆':icon('Results')}</div><section class="score-panel"><h2>Your score:</h2><p class="score">${score} / ${total}</p><p>correct answers${mode==='Matching'?' · scored per word pair':''}</p></section><p class="percentage">${pct}%</p><h2 class="message">${resultMessage(pct)}</h2><div class="result-actions">${button('↶ Try Again','retry','class="primary"')}${button(`← ${review?'Back to Units':'Back to Unit'}`,review?'home':'menu')}</div>`);}
function act(action,element){
 const t=plan[position],r=response;
 if(action==='home')return home();if(action==='menu')return menu();
 if(action==='unit'){const chosen=units.find(u=>u.unit===Number(element.dataset.unit));if(!chosen?.words.length)return;unit=chosen;return menu();}
 if(action==='review'){const chosen=reviewGroups(units).find(g=>g.start===Number(element.dataset.start));if(!chosen)return;review=chosen;return start('Review');}
 if(action==='start')return start(element.dataset.mode);if(action==='retry')return start(mode);
 if(action==='speak'){audio.speak(t.word,msg=>{const node=document.querySelector('#audio-status');if(node)node.textContent=msg;});return;}
 if(action==='flip'){flipped=!flipped;return renderTask(false);}
 if(action==='previous'){if(position>0){position--;flipped=false;renderTask();}return;}
 if(action==='card-next'){if(position<plan.length-1){position++;flipped=false;renderTask();}else{screen='complete';mount(`${header(`${label()} · Flashcards`, 'menu','Flashcards')}<section class="score-panel"><h2>All ${plan.length} cards practised</h2><p>Flashcards are for study and are not scored.</p></section><div class="result-actions">${button('Try Again','retry')}${button('Back to Unit','menu')}</div>`);}return;}
 if(action==='option'&&!r.done){r.selected=element.dataset.id;renderTask(false);document.querySelector(`[data-action="option"][data-id="${r.selected}"]`)?.focus({preventScroll:true});return;}
 if(action==='pair'&&!r.done){if(element.dataset.side==='left')r.active=element.dataset.id;else if(r.active)connect(r,r.active,element.dataset.id);renderTask(false);document.querySelector(`[data-side="${element.dataset.side}"][data-id="${element.dataset.id}"]`)?.focus({preventScroll:true});return;}
 if(action==='reset'){resetResponse(r);renderTask(false);document.querySelector('#answer')?.focus();return;}
 if(action==='check'){check(t,r);audio.effect(r.done&&r.credit?'correct':'incorrect');renderTask(false);if(t.type==='Spelling'&&!r.done&&r.attempts<2)document.querySelector('#answer')?.focus();else document.querySelector('[data-action="next"], [data-action="reveal"]')?.focus({preventScroll:true});return;}
 if(action==='reveal'){reveal(t,r);renderTask(false);return;}
 if(action==='next'&&r.done){score+=r.credit;position++;response=newResponse();if(position===plan.length)results();else renderTask();}
}
app.onclick=e=>{const element=e.target.closest('button[data-action]');if(!element){if(mode==='Flashcards'&&e.target.closest('[data-card]')){audio.effect();act('flip');}return;}if(element.disabled)return;if(element.dataset.action!=='check')audio.effect();act(element.dataset.action,element);};
window.addEventListener('hashchange',()=>home());
try {
 const fetchJSON=async url=>{const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw Error(`Unable to load ${url} (${res.status})`);return res.json();};
 book=await fetchJSON('./data/book.json');units=await loadUnits(book,fetch);
 const validation=validateUnits(units);if(validation.errors.length)throw Error(validation.errors.join('; '));if(validation.warnings.length)console.warn(`${validation.warnings.length} vocabulary warnings: ${validation.warnings.slice(0,8).join('; ')}${validation.warnings.length>8?'; … see data validation for the remaining entries.':''}`);
 home();
}catch(error){mount(`<h1>Vocabulary could not load</h1><p>${esc(error.message)}</p><p>Please refresh the page or check the vocabulary files.</p>`);}
