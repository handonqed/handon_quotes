/* ---------- Quiz (#quiz) ----------
   A line is shown; the player guesses who says it (Hope or Landon), which version of them
   (e.g. Hologram Landon) and the episode, depending on the level. Each question is worth 1 point,
   split between the parts the level asks for: episode 1/2, character 1/4, version 1/4, rescaled
   when a level asks fewer parts. */
const QUIZ_LEVELS=[
  {id:"very-easy",name:"Very easy",min:5,parts:{char:1},
    desc:"Lines from the most important conversations (★★★★★). Guess who says it: Hope or Landon."},
  {id:"easy",name:"Easy",min:4,parts:{char:.5,version:.5},
    desc:"Lines from ★★★★ and ★★★★★ conversations. Guess who says it and which version of them, like Hologram Landon or Hopeless Landon."},
  {id:"medium",name:"Medium",min:4,parts:{char:.25,version:.25,episode:.5},
    desc:"Lines from ★★★★ and ★★★★★ conversations. Guess who says it, which version, and the episode."},
  {id:"hard",name:"Hard",min:3,parts:{char:.25,version:.25,episode:.5},
    desc:"Like Medium, but with lines from ★★★ conversations too."},
  {id:"very-hard",name:"Very hard",min:1,parts:{char:.25,version:.25,episode:.5},
    desc:"Lines from every conversation, whatever its importance. Guess who, which version, and the episode."}
];
const QUIZ_COUNTS=[5,10,20];
const QUIZ_MIN_WORDS=5; // shorter lines ("Yeah.", "Hope?") are impossible to guess
// Final message and video by score out of 10; each range runs up to (not including) "below".
const QUIZ_RESULTS=[
  {below:2,video:"answer02.mp4",text:"Fake Handon, need a serious rewatch"},
  {below:4,video:"answer24.mp4",text:"Struggling Handon, need a rewatch"},
  {below:6,video:"answer46.mp4",text:"A beginner Handon"},
  {below:8,video:"answer68.mp4",text:"I believe you like Handon"},
  {below:10,video:"answer810.mp4",text:"A worthy Handon. You know well the best ship."},
  {below:Infinity,video:"answer10.mp4",text:"A real Handon soldier, you are as obsessed as me. Congratulations!"} // a perfect 10 only
];
const QUIZ_PART_NAMES={char:"Hope or Landon",version:"Version",episode:"Episode"};

let quizSettings={level:"very-easy",count:10};
let quiz=null; // {level, questions:[{i,t,k,guess,result}], n, phase:"question"|"done"}
// Answers are only marked at the end: no right/wrong or running score while playing.

const quizLevel=id=>QUIZ_LEVELS.find(l=>l.id===id)||QUIZ_LEVELS[0];
const quizChar=t=>String(t.speaker?.character||"").trim();
const quizVersion=t=>String(t.speaker?.version||"").trim()||quizChar(t);
function versionLabel(char,v){return v.toLowerCase()===char.toLowerCase()?`${char} (regular)`:v}

// Spoken lines by Hope or Landon (not shared "Handon" lines or actions), long enough to guess.
function quizLines(minImportance){
  const out=[],seen=new Set();
  DB.conversations.forEach(i=>{
    if(Number(i.conversation.importance||0)<minImportance) return;
    allTurns(i,"full").forEach((t,k)=>{
      const s=speakerOf(t),text=turnContent(t);
      if((s!=="hope"&&s!=="landon")||isAction(t)) return;
      if(text.split(/\s+/).filter(Boolean).length<QUIZ_MIN_WORDS) return;
      const key=norm(text); if(seen.has(key)) return; seen.add(key); // the same line twice would be unfair
      out.push({i,t,k});
    });
  });
  return out;
}
// Every version each character appears as, regular one first (from all lines, not just the level's).
let _quizVersions=null;
function quizVersions(){
  if(_quizVersions) return _quizVersions;
  const m={Hope:new Set(["Hope"]),Landon:new Set(["Landon"])};
  quizLines(0).forEach(({t})=>{const c=quizChar(t);(m[c]??=new Set([c])).add(quizVersion(t))});
  return _quizVersions=Object.fromEntries(Object.entries(m).map(([c,s])=>[c,[...s].sort((a,b)=>(a===c?-1:b===c?1:a.localeCompare(b)))]));
}
function shuffle(a){for(let k=a.length-1;k>0;k--){const j=Math.floor(Math.random()*(k+1));[a[k],a[j]]=[a[j],a[k]]}return a}

function quizStart(){
  const level=quizLevel(quizSettings.level);
  const qs=shuffle(quizLines(level.min)).slice(0,quizSettings.count).map(q=>({...q,guess:{},result:null}));
  quiz={level,questions:qs,n:0,phase:qs.length?"question":"done"};
  quizRender(true);
}

/* ---------- Rendering ---------- */
function quizPage(){quizRender(false)}
function quizRender(focus){
  const box=$("quiz-content");
  if(!quiz) box.innerHTML=quizSetupHTML();
  else if(quiz.phase==="done") box.innerHTML=quizResultsHTML();
  else box.innerHTML=quizQuestionHTML();
  syncVideos();
  if(focus){
    const h=box.querySelector("h3");if(h){h.setAttribute("tabindex","-1");h.focus({preventScroll:true})}
    if(box.getBoundingClientRect().top<0) box.scrollIntoView();
  }
}

function quizSetupHTML(){
  const lvl=QUIZ_LEVELS.map(l=>`<label class="quiz-option${quizSettings.level===l.id?" selected":""}">
<input type="radio" name="quiz-level" value="${l.id}"${quizSettings.level===l.id?" checked":""}>
<span class="quiz-option-name">${esc(l.name)}</span><span class="quiz-option-desc">${esc(l.desc)}</span>
<span class="quiz-option-meta">${quizLines(l.min).length} lines</span></label>`).join("");
  const cnt=QUIZ_COUNTS.map(n=>`<label class="quiz-chip${quizSettings.count===n?" selected":""}"><input type="radio" name="quiz-count" value="${n}"${quizSettings.count===n?" checked":""}>${n}</label>`).join("");
  return `<fieldset class="quiz-fieldset"><legend>Level</legend><div class="quiz-levels">${lvl}</div></fieldset>
<fieldset class="quiz-fieldset"><legend>Questions</legend><div class="quiz-chips">${cnt}</div></fieldset>
<p class="muted">Each question is worth 1 point: the episode counts for half, Hope or Landon for a quarter and the version for a quarter. Levels that ask fewer things share the point between them.</p>
<button type="button" class="button" data-quiz="start">Start the quiz</button>`;
}

// The options of the dependent dropdowns; they are refilled in place when the choice above changes.
function quizVersionOptions(g){
  const vs=g.char?quizVersions()[g.char]||[g.char]:[];
  return `<option value="">${g.char?"Choose a version":"Pick Hope or Landon first"}</option>`
    +vs.map(v=>`<option value="${esc(v)}"${g.version===v?" selected":""}>${esc(versionLabel(g.char,v))}</option>`).join("");
}
const quizEpisodeList=()=>sortedEpisodes().filter(e=>(e.conversations||[]).length);
function quizEpisodeOptions(g){
  const inSeason=g.season?quizEpisodeList().filter(e=>seasonKey(e)===g.season):[];
  return `<option value="">${g.season?"Choose an episode":"Pick a season first"}</option>`
    +inSeason.map(e=>`<option value="${esc(e.episode_id)}"${g.episode===e.episode_id?" selected":""}>${esc(episodeLabel(e))} · ${esc(e.episode_title||"")}</option>`).join("");
}

function quizQuestionHTML(){
  const q=quiz.questions[quiz.n],p=quiz.level.parts,g=q.guess;
  let form=`<div class="quiz-field"><span class="quiz-label">Who says it?</span><div class="quiz-chips">${["Hope","Landon"].map(c=>
    `<label class="quiz-chip${g.char===c?" selected":""}"><input type="radio" name="quiz-char" value="${c}"${g.char===c?" checked":""}>${c}</label>`).join("")}</div></div>`;
  if(p.version){
    form+=`<label class="quiz-field"><span class="quiz-label">Which version?</span><select name="quiz-version"${g.char?"":" disabled"}>${quizVersionOptions(g)}</select></label>`;
  }
  if(p.episode){
    // Season first, then only that season's episodes, so the list stays short.
    const seasons=new Map();
    quizEpisodeList().forEach(e=>seasons.set(seasonKey(e),seasonLabel(e)));
    form+=`<label class="quiz-field"><span class="quiz-label">Which season?</span><select name="quiz-season"><option value="">Choose a season</option>
${[...seasons].map(([k,l])=>`<option value="${esc(k)}"${g.season===k?" selected":""}>${esc(l)}</option>`).join("")}</select></label>
<label class="quiz-field"><span class="quiz-label">Which episode?</span><select name="quiz-episode"${g.season?"":" disabled"}>${quizEpisodeOptions(g)}</select></label>`;
  }
  const ready=Object.keys(p).every(k=>g[k]),last=quiz.n===quiz.questions.length-1;
  return `<div class="quiz-progress"><span>Question ${quiz.n+1} of ${quiz.questions.length} · ${esc(quiz.level.name)}</span></div>
<div class="quote-card quiz-card"><h3 class="visually-hidden">Question ${quiz.n+1}</h3><div class="quote">“${esc(turnContent(q.t))}”</div>
<div class="quiz-form">${form}</div>
<p class="quiz-actions"><button type="button" class="button" data-quiz="answer"${ready?"":" disabled"}>${last?"See my score":"Next question"}</button>
<button type="button" class="button secondary" data-quiz="quit">Quit</button></p></div>`;
}

function quizPoints(q){return q.result?Object.entries(quiz.level.parts).reduce((s,[k,w])=>s+(q.result[k]?w:0),0):0}
function quizScoreSoFar(){return quiz.questions.reduce((s,q)=>s+quizPoints(q),0)}

// What the player picked, for the wrong parts in the results (the episode without its title).
function quizGuessText(q,part){
  const g=q.guess;
  if(part==="char") return g.char||"nothing";
  if(part==="version") return g.version?versionLabel(g.char,g.version):"nothing";
  const e=DB.episodes.find(x=>x.episode_id===g.episode);
  return e?episodeLabel(e):"nothing";
}

function quizResultsHTML(){
  const qs=quiz.questions,n=qs.length;
  if(!n) return `<div class="empty">There are no lines for this level yet.</div><p><button type="button" class="button" data-quiz="setup">Choose another level</button></p>`;
  const pts=quizScoreSoFar(),pct=Math.round(pts/n*100);
  const parts=Object.keys(quiz.level.parts).map(k=>statHTML(QUIZ_PART_NAMES[k],`${qs.filter(q=>q.result[k]).length}/${n}`)).join("");
  // Rounded to one decimal first, so the message always matches the number shown (7.95 shows 8 and counts as 8).
  const out10=Math.round(pts/n*100)/10,result=QUIZ_RESULTS.find(r=>out10<r.below)||QUIZ_RESULTS.at(-1);
  // "Show the conversation" opens it right here; its lines are only built when first opened.
  const rows=qs.map((q,k)=>`<li class="quiz-review"><div class="quote">“${esc(turnContent(q.t))}”</div>
<div class="meta">${esc(speakerName(q.t))} · ${esc(episodeLabel(q.i.episode))} · ${esc(q.i.episode.episode_title||"")} · ${quizPoints(q).toFixed(2).replace(/\.?0+$/,"")} / 1</div>
<div class="quiz-review-marks">${Object.keys(quiz.level.parts).map(p=>`<span class="quiz-mark ${q.result[p]?"ok":"bad"}">${q.result[p]?"✓":"✗"} ${QUIZ_PART_NAMES[p]}${q.result[p]?"":`<span class="quiz-guess"> · you said ${esc(quizGuessText(q,p))}</span>`}</span>`).join("")}</div>
<details class="quiz-conv" data-q="${k}"><summary>Show the conversation</summary><div class="quiz-conv-body"></div></details></li>`).join("");
  return `<div class="quote-card quiz-card quiz-score"><h3>Your score</h3>
<video class="quiz-result-video" data-src="assets/media/${result.video}" autoplay loop muted playsinline disablepictureinpicture aria-hidden="true"></video>
<div class="quiz-score-number">${out10.toFixed(1).replace(/\.0$/,"")}<span>/10</span></div>
<p class="quiz-verdict">${esc(result.text)}</p>
<p class="muted">${pct}% · ${pts.toFixed(2).replace(/\.?0+$/,"")} of ${n} points · ${esc(quiz.level.name)}</p></div>
<div class="stats quiz-parts">${parts}</div>
<p class="quiz-actions"><button type="button" class="button" data-quiz="again">Play again</button>
<button type="button" class="button secondary" data-quiz="setup">Change level</button></p>
<h3>Your answers</h3><ol class="quiz-review-list">${rows}</ol>`;
}

/* ---------- Events (one delegated listener each) ---------- */
function setupQuiz(){
  const box=$("quiz-content");
  // Results: fill an answer's conversation the first time it is opened, with the quiz line highlighted.
  box.addEventListener("toggle",ev=>{
    const d=ev.target; if(!d.matches?.("details.quiz-conv")||!d.open) return;
    const body=d.querySelector(".quiz-conv-body"); if(body.childElementCount) return;
    const q=quiz.questions[Number(d.dataset.q)],c=q.i.conversation;
    body.innerHTML=`<div class="meta">${esc(c.title||"Untitled")}</div>`
      +allTurns(q.i,"full").map((t,k)=>turnHTML(t,"",k===q.k?"target":"")).join("")
      +`<p>${convLink(c,"Open the conversation page","",q.k)}</p>`;
    const tgt=body.querySelector(".turn.target"); // scroll inside the box, not the page
    if(tgt) body.scrollTop=tgt.offsetTop-body.clientHeight/3;
  },true); // toggle does not bubble, so listen while it travels down
  box.addEventListener("change",ev=>{
    const el=ev.target;
    // Only the parts that depend on the choice are updated; redrawing the whole form made phones
    // reopen the dropdown just used and jump the page.
    const mark=name=>box.querySelectorAll(`[name="${name}"]`).forEach(r=>r.closest("label").classList.toggle("selected",r.checked));
    if(el.name==="quiz-level"){quizSettings.level=el.value;mark("quiz-level");return}
    if(el.name==="quiz-count"){quizSettings.count=Number(el.value);mark("quiz-count");return}
    if(!quiz||quiz.phase!=="question") return;
    const g=quiz.questions[quiz.n].guess,fill=(name,html,on)=>{const s=box.querySelector(`[name="${name}"]`);if(s){s.innerHTML=html;s.disabled=!on}};
    if(el.name==="quiz-char"){
      if(g.char!==el.value){g.char=el.value;delete g.version;fill("quiz-version",quizVersionOptions(g),true)}
      mark("quiz-char");
    }
    else if(el.name==="quiz-version") g.version=el.value;
    else if(el.name==="quiz-season"){
      if(g.season!==el.value){g.season=el.value||undefined;delete g.episode;fill("quiz-episode",quizEpisodeOptions(g),!!g.season)}
    }
    else if(el.name==="quiz-episode") g.episode=el.value;
    else return;
    const btn=box.querySelector('[data-quiz="answer"]');
    if(btn) btn.disabled=!Object.keys(quiz.level.parts).every(k=>g[k]);
  });
  box.addEventListener("click",ev=>{
    const b=ev.target.closest("[data-quiz]"); if(!b) return;
    const a=b.dataset.quiz;
    if(a==="start"||a==="again") quizStart();
    else if(a==="setup"||a==="quit"){quiz=null;quizRender(true)}
    else if(a==="answer"){
      const q=quiz.questions[quiz.n],g=q.guess;
      q.result={char:g.char===quizChar(q.t),version:g.version===quizVersion(q.t),episode:g.episode===q.i.episode.episode_id};
      if(quiz.n<quiz.questions.length-1) quiz.n++; else quiz.phase="done";
      quizRender(true);
    }
  });
}
