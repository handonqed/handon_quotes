window.DB={episodes:[],conversations:[],loaded:false};
async function loadDatabase(){
  const r=await fetch("data/index.json"); if(!r.ok) throw Error("Could not load data/index.json");
  const index=await r.json();
  DB.episodes=await Promise.all(index.episodes.map(async p=>{
    const x=await fetch("data/"+p); if(!x.ok) throw Error("Could not load "+p); return x.json();
  }));
  DB.conversations=[];
  DB.episodes.forEach(ep=>(ep.conversations||[]).forEach(c=>DB.conversations.push({episode:ep,conversation:c})));
  DB.loaded=true; return DB;
}
function episodeLabel(e){return `${e.show||""} ${e.season?"S"+e.season:""}E${e.episode??""}`}
function stars(n){n=Math.max(0,Math.min(5,Number(n)||0));return "★".repeat(n)+"☆".repeat(5-n)}
function turns(c,mode){return c[mode]&&Array.isArray(c[mode].turns)?c[mode].turns:[]}
function allTurns(i,mode){return turns(i.conversation,mode||"full").filter(t=>String(t.text||"").trim())}
function unique(a){return [...new Set(a)].sort((x,y)=>String(x).localeCompare(String(y),undefined,{numeric:true}))}
