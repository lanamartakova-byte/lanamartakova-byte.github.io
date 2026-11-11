export class AudioFeedback {
  volume=0.35; context=null; active=null; last=0;
  effect(kind='tap') {
    if(Date.now()-this.last<90)return;
    this.last=Date.now();
    try {
      this.context??=new (window.AudioContext||window.webkitAudioContext)();
      const ctx=this.context;ctx.resume().catch(()=>{});
      if(this.active){try{this.active.stop();}catch{}}
      const osc=ctx.createOscillator(),gain=ctx.createGain();this.active=osc;
      osc.type='sine';osc.frequency.setValueAtTime(kind==='correct'?740:kind==='incorrect'?230:460,ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(kind==='correct'?990:kind==='incorrect'?180:520,ctx.currentTime+0.09);
      gain.gain.setValueAtTime(this.volume,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.12);
      osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.13);
    }catch{/* Visual controls remain fully functional without audio. */}
  }
  speak(word,onError) {
    if(!('speechSynthesis' in window)){onError('Pronunciation is unavailable in this browser.');return;}
    speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(word.english);utterance.lang='en-GB';utterance.rate=0.85;
    const voices=speechSynthesis.getVoices();const voice=voices.find(v=>v.lang.toLowerCase()==='en-gb');
    if(voice)utterance.voice=voice;
    utterance.onerror=()=>onError('Pronunciation could not play. Please try again or check your device voice settings.');
    speechSynthesis.speak(utterance);
  }
  stop(){if('speechSynthesis' in window)speechSynthesis.cancel();}
}
