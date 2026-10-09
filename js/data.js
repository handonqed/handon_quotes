window.DB={episodes:[],conversations:[],errors:[],loaded:false};

async function loadDatabase(){
  // index.json is always revalidated; its "version" busts the cache of the episode files
  // (GitHub Pages can otherwise serve stale copies for several minutes after a push).
  const r=await fetch("data/index.json",{cache:"no-cache"}); if(!r.ok) throw Error("Could not load data/index.json");
  const index=await r.json();
  const bust=index.version?"?v="+encodeURIComponent(index.version):"";
  // allSettled: one broken episode file no longer takes the whole site down.
  const res=await Promise.allSettled(index.episodes.map(async p=>{
    const x=await fetch("data/"+p+bust); if(!x.ok) throw Error(p); return x.json();
  }));
  DB.episodes=[]; DB.errors=[];
  res.forEach((s,k)=>s.status==="fulfilled"?DB.episodes.push(s.value):DB.errors.push(index.episodes[k]));
  if(!DB.episodes.length) throw Error("No episode files could be loaded");
  DB.conversations=[];
  DB.episodes.forEach(ep=>(ep.conversations||[]).forEach(c=>DB.conversations.push({episode:ep,conversation:c})));
  DB.loaded=true; return DB;
}

function episodeLabel(e){return `${e.show||""} ${e.season?"S"+e.season:""}E${e.episode??""}`}
function stars(n){n=Math.max(0,Math.min(5,Number(n)||0));return "★".repeat(n)+"☆".repeat(5-n)}
function turns(c,mode){return c[mode]&&Array.isArray(c[mode].turns)?c[mode].turns:[]}

// Plain text of a turn. Action lines are flagged with isAction() and styled in CSS.
function turnContent(turn){return String(turn.action||turn.text||"").trim()}
function isAction(turn){return !!String(turn.action||"").trim()}
function allTurns(i,mode){
  return turns(i.conversation,mode||"full").filter(t=>String(t.text||"").trim()||String(t.action||"").trim());
}


// Lowercase and strip accents so "cafe" matches "café".
function norm(s){return String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}

// Normalized text of a turn, computed once per turn (search runs on every keystroke).
const _normCache=new WeakMap();
function normTurn(t){
  let n=_normCache.get(t);
  if(n===undefined){n=norm(turnContent(t));_normCache.set(t,n)}
  return n;
}

function speakerOf(t){return String(t.speaker?.character||"").toLowerCase()}

// Display name: "Landon" normally, "Landon (Hologram Landon)" when the version differs from the character.
function speakerName(t){
  const c=String(t.speaker?.character||"").trim(),v=String(t.speaker?.version||"").trim();
  return v&&c&&v.toLowerCase()!==c.toLowerCase()?`${c} (${v})`:c;
}

// One character filter for Search and Random. Shared "handon" lines count for both Hope and Landon.
// ch: "hope" | "landon" | "either" (Hope/Landon/Handon lines only) | "" (no filtering).
function matchesChar(t,ch){
  const s=speakerOf(t); ch=String(ch||"").toLowerCase();
  if(ch==="hope"||ch==="landon") return s===ch||s==="handon";
  if(ch==="either") return s==="hope"||s==="landon"||s==="handon";
  return true;
}

// Turn and word counts, shared by the home and statistics pages.
// Shared "handon" lines count for both Hope and Landon (same rule as matchesChar);
// "all" covers every speaker, so it is not the sum of the two.
let _charStats=null;
function charStats(){
  if(_charStats) return _charStats;
  const s={hope:{turns:0,words:0},landon:{turns:0,words:0},all:{turns:0,words:0}};
  DB.conversations.forEach(i=>allTurns(i,"full").forEach(t=>{
    const c=speakerOf(t),w=String(t.text||"").trim().split(/\s+/).filter(Boolean).length;
    const who=c==="handon"?["hope","landon"]:s[c]&&c!=="all"?[c]:[];
    who.concat("all").forEach(k=>{s[k].turns++;s[k].words+=w});
  }));
  return _charStats=s;
}
