const $=id=>document.getElementById(id);
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

// Highlight every occurrence of q in text (accent- and case-insensitive).
// Matches are found by index, not by regex, so special characters in q are safe.
function hi(text,q){
  text=String(text??""); const nq=norm(q).trim(); if(!nq) return esc(text);
  let n="",map=[];
  for(let i=0;i<text.length;i++){const c=norm(text[i]);n+=c;for(let k=0;k<c.length;k++)map.push(i)}
  let out="",pos=0,from=0,idx;
  while((idx=n.indexOf(nq,from))>-1){
    const s=map[idx],e=map[idx+nq.length-1]+1;
    if(s>=pos){out+=esc(text.slice(pos,s))+"<mark class='mark'>"+esc(text.slice(s,e))+"</mark>";pos=e}
    from=idx+nq.length;
  }
  return out+esc(text.slice(pos));
}

function tagHTML(a=[]){return a.map(x=>`<a class="tag" href="#tags/${encodeURIComponent(String(x).trim())}">${esc(x)}</a>`).join("")}
function turnHTML(t,q="",cls="",id=""){return `<div class="turn ${cls}"${id?` id="${id}"`:""}><div class="speaker">${esc(speakerName(t))}</div><div class="quote${isAction(t)?" action":""}">${hi(turnContent(t),q)}</div></div>`}
function copyBtn(text,label="Copy quote"){return `<button type="button" class="button secondary copy-btn" data-copy="${esc(text)}">${label}</button>`}
function conversationText(ts,e,c){return ts.map(t=>`${speakerName(t)}: ${turnContent(t)}`).join("\n")+`\n— ${episodeLabel(e)}, ${c.title||""}`}
function quoteText(t,i){return `“${turnContent(t)}” — ${speakerName(t)||"Unknown"}, ${episodeLabel(i.episode)}`}
function starsHTML(n){return `<div class="stars" role="img" aria-label="Importance ${Math.max(0,Math.min(5,Number(n)||0))} of 5">${stars(n)}</div>`}
function statHTML(label,val){return `<div class="stat"><div class="number">${val}</div><div class="label">${esc(label)}</div></div>`}
// line: index of a turn in the full dialogue; the conversation page scrolls to it and highlights it.
function convLink(c,text,cls="button secondary",line=-1){return `<a class="${cls}" href="#conversation/${encodeURIComponent(c.id)}${line>=0?"?line="+line:""}">${text}</a>`}

function card(i,mode="short"){
  const e=i.episode,c=i.conversation,t=allTurns(i,mode);
  return `<article class="card">
<div class="meta">${esc(episodeLabel(e))} · ${esc(e.episode_title||"")}</div><h3>${esc(c.title||"Untitled")}</h3>
${starsHTML(c.importance)}<p>${esc(c.description||"")}</p><div class="tags">${tagHTML(c.tags||[])}</div>
${convLink(c,"View conversation")}
${t.length?`<div>${t.map(x=>turnHTML(x)).join("")}</div>`:""}</article>`;
}

function showPage(id,navId=id){
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
  $(id)?.classList.add("active");
  document.querySelectorAll("header nav a").forEach(a=>{
    const on=a.getAttribute("href")==="#"+navId;
    a.classList.toggle("active",on); on?a.setAttribute("aria-current","page"):a.removeAttribute("aria-current");
  });
}

// Season and episode filters (Search and Random). A season option is "Show|season" so that
// seasons of different shows stay apart now that there is no separate Show filter.
const seasonKey=e=>`${e.show||""}|${e.season??""}`;
const seasonLabel=e=>e.show==="The Originals"?e.show:`${e.show||"Unknown show"} · Season ${e.season??"?"}`;
// Shows in chronological order (The Originals came first); unlisted shows follow alphabetically.
const SHOW_ORDER=["The Originals","Legacies"];
function byShow(a,b){
  const r=x=>{const k=SHOW_ORDER.indexOf(x);return k<0?SHOW_ORDER.length:k};
  return r(a)-r(b)||String(a).localeCompare(String(b));
}
function sortedEpisodes(){
  return [...DB.episodes].sort((a,b)=>byShow(a.show,b.show)||(a.season||0)-(b.season||0)||(a.episode||0)-(b.episode||0));
}
function fillSeasons(prefix){
  const seen=new Map();
  sortedEpisodes().forEach(e=>{if(!seen.has(seasonKey(e)))seen.set(seasonKey(e),seasonLabel(e))});
  setOptions(`${prefix}-season`,[...seen]);
  fillEpisodes(prefix);
}
// The episode list follows the selected season; the current choice is kept when it is still listed.
function fillEpisodes(prefix){
  const se=$(`${prefix}-season`).value,sel=$(`${prefix}-episode`).value;
  setOptions(`${prefix}-episode`,sortedEpisodes().filter(e=>!se||seasonKey(e)===se)
    .map(e=>[e.episode_id,`${episodeLabel(e)} · ${e.episode_title||""}`]));
  $(`${prefix}-episode`).value=sel;
  if($(`${prefix}-episode`).value!==sel) $(`${prefix}-episode`).value="";
}
function setOptions(id,pairs){
  const e=$(id),first=e.options[0]?.outerHTML||"";
  e.innerHTML=first+pairs.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join("");
}
function inScope(e,se,ep){return (!se||seasonKey(e)===se)&&(!ep||e.episode_id===ep)}
function filters(prefix){
  const se=$(`${prefix}-season`).value,ep=$(`${prefix}-episode`).value,m=Number($(`${prefix}-importance`).value||0);
  return DB.conversations.filter(i=>inScope(i.episode,se,ep)&&Number(i.conversation.importance||0)>=m);
}

/* ---------- Home ---------- */
function home(){
  const s=charStats();
  $("home-stats").innerHTML=[
    ["Episodes",DB.episodes.length],["Conversations",DB.conversations.length],
    ["Full turns",s.all.turns.toLocaleString()],["Words",s.all.words.toLocaleString()]
  ].map(x=>statHTML(x[0],x[1])).join("");
}

/* ---------- Episodes ---------- */
// Seasons are collapsed until clicked, so a long season does not push the later ones down the page.
const openSeasons=new Set();
function episodes(){
  let b={};DB.episodes.forEach(e=>(b[e.show]??=[]).push(e));let h="";
  Object.keys(b).sort(byShow).forEach(show=>{
    h+=`<div class="show"><h3>${esc(show)}</h3>`;
    let ss={};b[show].forEach(e=>(ss[e.season]??=[]).push(e));
    Object.keys(ss).sort((a,b)=>a-b).forEach(s=>{
      const key=show+"|"+s,n=ss[s].length;
      h+=`<details class="season" data-key="${esc(key)}"${openSeasons.has(key)?" open":""}><summary><h3>${s==="undefined"?"Unknown season":"Season "+esc(s)}</h3><span class="meta">${n} episode${n===1?"":"s"}</span></summary><div class="episode-grid">`;
      ss[s].sort((a,b)=>(a.episode||0)-(b.episode||0)).forEach(e=>h+=`<a class="episode-card" href="#conversation/episode/${encodeURIComponent(e.episode_id)}"><div class="code">${esc(episodeLabel(e))}</div><strong>${esc(e.episode_title||"")}</strong><div class="meta">${(e.conversations||[]).length} conversation${(e.conversations||[]).length===1?"":"s"}</div></a>`);
      h+="</div></details>";
    });
    h+="</div>";
  });
  $("episode-browser").innerHTML=h||'<div class="empty">No episodes loaded.</div>';
  // Remember which seasons are open, so coming back to this page keeps them that way.
  $("episode-browser").querySelectorAll("details.season").forEach(d=>d.addEventListener("toggle",()=>d.open?openSeasons.add(d.dataset.key):openSeasons.delete(d.dataset.key)));
}

/* ---------- Importance (minimum level, highest first) ---------- */
function importance(){
  const m=Number($("importance-filter").value);
  const a=DB.conversations.filter(i=>Number(i.conversation.importance||0)>=m)
    .sort((x,y)=>(y.conversation.importance||0)-(x.conversation.importance||0));
  $("importance-results").innerHTML=a.length
    ?`<p class="muted">${a.length} conversation${a.length===1?"":"s"}</p>`+a.map(i=>card(i)).join("")
    :'<div class="empty">No conversations match.</div>';
}

/* ---------- Search (state lives in the URL: #search?q=...&season=...&ep=...) ---------- */
const SEARCH_LIMIT=100;
function syncSearchUrl(p){
  const u=new URLSearchParams();Object.entries(p).forEach(([k,v])=>{if(v)u.set(k,v)});
  history.replaceState(null,"","#search"+(u.toString()?"?"+u:""));
}
function applySearchParams(p){
  $("search-input").value=p.get("q")||"";
  [["search-season","season"],["search-episode","ep"],["search-character","char"],["search-importance","imp"]]
    .forEach(([id,k])=>{
      if(id==="search-episode") fillEpisodes("search"); // after the season is set, before the episode
      const def=id==="search-importance"?"0":"",want=p.get(k)||def;
      $(id).value=want;
      if($(id).value!==want) $(id).value=def; // ignore values that are not an option
    });
}
let searchTimer=null,searchHits=[],searchQuery="",searchShown=SEARCH_LIMIT;
function searchSoon(){clearTimeout(searchTimer);searchTimer=setTimeout(search,150)}
function renderSearch(){
  const a=searchHits,shown=a.slice(0,searchShown);
  $("search-count").textContent=`${a.length} matching line${a.length===1?"":"s"}`+(a.length>shown.length?` (showing the first ${shown.length})`:"");
  $("search-results").innerHTML=(a.length?shown.map(x=>`<article class="card">
<div class="meta">${esc(episodeLabel(x.i.episode))} · ${esc(x.i.episode.episode_title||"")}</div><h3>${esc(x.i.conversation.title||"")}</h3>
${x.prev?turnHTML(x.prev,"","context"):""}${turnHTML(x.t,searchQuery)}${x.next?turnHTML(x.next,"","context"):""}
<p>${convLink(x.i.conversation,"View in conversation","button secondary",x.k)} ${copyBtn(quoteText(x.t,x.i))}</p></article>`).join(""):'<div class="empty">No matching lines. Try fewer words or clear a filter.</div>')
    +(a.length>shown.length?`<p><button type="button" class="button secondary" id="search-more">Show ${Math.min(SEARCH_LIMIT,a.length-shown.length)} more</button></p>`:"");
}
function searchMore(){searchShown+=SEARCH_LIMIT;renderSearch()}
function search(){
  clearTimeout(searchTimer);
  // A debounced call can fire after the user has already left the page; it must not rewrite the URL then.
  if(!$("search").classList.contains("active")) return;
  const q=$("search-input").value.trim(),se=$("search-season").value,ep=$("search-episode").value,
    ch=$("search-character").value,m=Number($("search-importance").value)||0;
  syncSearchUrl({q,season:se,ep,char:ch,imp:m||""});
  if(!q){searchHits=[];$("search-count").textContent="";$("search-results").innerHTML='<div class="empty">Type a word or phrase to search.</div>';return}
  const nq=norm(q),a=[];
  DB.conversations.forEach(i=>{
    const e=i.episode,c=i.conversation;
    if(!inScope(e,se,ep)||Number(c.importance||0)<m) return;
    const ts=allTurns(i,"full");
    ts.forEach((t,k)=>{
      if(ch&&!matchesChar(t,ch)) return;
      if(normTurn(t).includes(nq)) a.push({i,t,k,prev:ts[k-1],next:ts[k+1]});
    });
  });
  searchHits=a;searchQuery=q;searchShown=SEARCH_LIMIT;
  renderSearch();
}

/* ---------- Random ---------- */
function randomResult(){
  const ch=$("random-character").value||"either",type=$("random-type").value,mode=type==="short"?"short":"full";
  // A short conversation keeps all its lines (other speakers give context); it only has to include the character.
  const pool=filters("random").map(i=>({i,t:allTurns(i,mode)}))
    .filter(x=>x.t.some(t=>matchesChar(t,ch)));
  if(!pool.length){$("random-result").innerHTML='<div class="empty">No results match these filters.</div>';return}
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const {i,t}=pick(pool),e=i.episode,c=i.conversation;
  if(type==="short"){
    const text=conversationText(t,e,c);
    $("random-result").innerHTML=`<div class="quote-card"><div class="meta">${esc(episodeLabel(e))}</div><h3>${esc(c.title||"")}</h3>
${starsHTML(c.importance)}${t.map(x=>turnHTML(x)).join("")}
<p>${convLink(c,"Open conversation")} ${copyBtn(text,"Copy conversation")}</p></div>`;
  }else{
    const mine=t.filter(x=>matchesChar(x,ch)),spoken=mine.filter(x=>!isAction(x)),x=pick(spoken.length?spoken:mine);
    $("random-result").innerHTML=`<div class="quote-card"><div class="meta">${esc(episodeLabel(e))} · ${esc(c.title||"")}</div>
<div class="speaker">${esc(speakerName(x))}</div><div class="quote">“${esc(turnContent(x))}”</div>
${starsHTML(c.importance)}<p>${convLink(c,"Open conversation")} ${copyBtn(quoteText(x,i))}</p></div>`;
  }
}

/* ---------- Tags (URL: #tags/Name) ---------- */
function tagsPage(active=""){
  const set=new Set();
  DB.conversations.forEach(i=>(i.conversation.tags||[]).forEach(t=>{if(String(t).trim())set.add(String(t).trim())}));
  const tags=[...set].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const on=t=>active&&t.toLowerCase()===active.trim().toLowerCase();
  $("tag-browser").innerHTML=tags.length
    ?tags.map(t=>`<button type="button" class="tag tag-button${on(t)?" active":""}" data-tag="${esc(t)}" aria-pressed="${!!on(t)}">${esc(t)}</button>`).join("")
    :'<div class="empty">No tags found.</div>';
  if(active) showTag(active);
  else $("tag-results").innerHTML='<div class="empty">Select a tag to see its conversations.</div>';
}
function showTag(tag){
  const r=DB.conversations.filter(i=>(i.conversation.tags||[]).some(t=>String(t).trim().toLowerCase()===tag.trim().toLowerCase()));
  $("tag-results").innerHTML=`<div class="heading"><h3>${esc(tag)}</h3><p>${r.length} conversation${r.length===1?"":"s"}</p></div>`
    +(r.length?r.map(i=>card(i)).join(""):'<div class="empty">No conversations found for this tag.</div>');
}

/* ---------- Statistics ---------- */
function bars(title,rows){
  const max=Math.max(1,...rows.map(r=>r[1]));
  return `<section class="stat-panel"><h3>${esc(title)}</h3>${rows.map(([l,v])=>`<div class="bar-row"><span class="bar-label">${esc(l)}</span><span class="bar-track"><span class="bar-fill" style="width:${(v/max*100).toFixed(1)}%"></span></span><span class="bar-val">${v.toLocaleString()}</span></div>`).join("")}</section>`;
}
function statistics(){
  const s=charStats(),seasons={},imp=[0,0,0,0,0,0],tagCount={};
  DB.conversations.forEach(i=>{
    const k=`${i.episode.show||""} S${i.episode.season??"?"}`;seasons[k]=(seasons[k]||0)+1;
    const m=Math.max(0,Math.min(5,Number(i.conversation.importance)||0));imp[m]++;
    (i.conversation.tags||[]).forEach(t=>{t=String(t).trim();if(t)tagCount[t]=(tagCount[t]||0)+1});
  });
  $("statistics-content").innerHTML=[
    ["Episodes",DB.episodes.length],["Conversations",DB.conversations.length],
    ["Hope turns",s.hope.turns],["Hope words",s.hope.words.toLocaleString()],
    ["Landon turns",s.landon.turns],["Landon words",s.landon.words.toLocaleString()]
  ].map(x=>statHTML(x[0],x[1])).join("")
  +bars("Words by character",[["Hope",s.hope.words],["Landon",s.landon.words]])
  +bars("Conversations per season",Object.entries(seasons).sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true})))
  +bars("Conversations by importance",[1,2,3,4,5].map(n=>[stars(n),imp[n]]))
  +bars("Most used tags",Object.entries(tagCount).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,10));
}

/* ---------- Conversation and episode pages ---------- */
function conversation(id){
  const i=DB.conversations.find(x=>x.conversation.id===id);
  if(!i){document.title="Conversation not found · Handon Quotes";$("conversation-content").innerHTML='<div class="empty">Conversation not found. <a href="#episodes">Browse episodes</a></div>';return}
  const e=i.episode,c=i.conversation,list=e.conversations||[],k=list.indexOf(c),p=list[k-1],n=list[k+1],
    ts=allTurns(i,"full"),link=location.href.split("#")[0]+"#conversation/"+encodeURIComponent(c.id);
  document.title=`${c.title||"Conversation"} · Handon Quotes`;
  $("conversation-content").innerHTML=`<div class="full"><a class="back" href="#conversation/episode/${encodeURIComponent(e.episode_id)}">← Back to episode</a>
<div class="conversation-header"><div class="eyebrow">${esc(episodeLabel(e))}</div><h2>${esc(c.title||"Untitled")}</h2><p>${esc(e.episode_title||"")}</p>
${starsHTML(c.importance)}<p>${esc(c.description||"")}</p><div class="tags">${tagHTML(c.tags||[])}</div>
${copyBtn(link,"Copy link")} ${ts.length?copyBtn(conversationText(ts,e,c),"Copy conversation"):""}</div>
<div class="conversation-body">${ts.map((t,k)=>turnHTML(t,"","","line-"+k)).join("")||'<div class="empty">No full dialogue is stored.</div>'}</div>
<div class="conv-nav">${p?convLink(p,"Previous: "+esc(p.title||"Untitled")):"<span></span>"}${n?convLink(n,"Next: "+esc(n.title||"Untitled")):"<span></span>"}</div></div>`;
}
// Previous / next episode buttons. On the full-episode page they stay in the full view.
function episodeNav(e,full=false){
  const eps=sortedEpisodes(),k=eps.indexOf(e),
    link=(x,label)=>x?`<a class="button secondary" href="#conversation/episode/${encodeURIComponent(x.episode_id)}${full?"/full":""}">${label}: ${esc(episodeLabel(x))}</a>`:"<span></span>";
  return `<div class="conv-nav">${link(eps[k-1],"Previous")}${link(eps[k+1],"Next")}</div>`;
}
function episodePage(id){
  const e=DB.episodes.find(x=>x.episode_id===id);
  if(!e){document.title="Episode not found · Handon Quotes";$("conversation-content").innerHTML='<div class="empty">Episode not found. <a href="#episodes">Browse episodes</a></div>';return}
  const cs=e.conversations||[];
  document.title=`${e.episode_title||"Episode"} · Handon Quotes`;
  $("conversation-content").innerHTML=`<div class="full"><a class="back" href="#episodes">← Back to episodes</a>
<div class="conversation-header"><div class="eyebrow">${esc(episodeLabel(e))}</div><h2>${esc(e.episode_title||"")}</h2>
<p>${cs.length} conversation${cs.length===1?"":"s"}</p>
${cs.length?`<a class="button" href="#conversation/episode/${encodeURIComponent(e.episode_id)}/full">Read the full episode</a>`:""}</div>
<div class="list">${cs.length?cs.map(c=>card({episode:e,conversation:c})).join(""):'<div class="empty">No conversations stored for this episode.</div>'}</div>
${episodeNav(e)}</div>`;
}

// All the full conversations of an episode on one page (#conversation/episode/ID/full).
// Each one is introduced by a small line: title, importance and a link to its own page.
function episodeFullPage(id){
  const e=DB.episodes.find(x=>x.episode_id===id);
  if(!e){document.title="Episode not found · Handon Quotes";$("conversation-content").innerHTML='<div class="empty">Episode not found. <a href="#episodes">Browse episodes</a></div>';return}
  const cs=e.conversations||[];
  document.title=`${e.episode_title||"Episode"} (full) · Handon Quotes`;
  $("conversation-content").innerHTML=`<div class="full"><a class="back" href="#conversation/episode/${encodeURIComponent(e.episode_id)}">← Back to episode</a>
<div class="conversation-header"><div class="eyebrow">${esc(episodeLabel(e))}</div><h2>${esc(e.episode_title||"")}</h2>
<p>${cs.length} conversation${cs.length===1?"":"s"}, full dialogue</p></div>
<div class="conversation-body">${cs.length?cs.map(c=>{
    const ts=allTurns({episode:e,conversation:c},"full");
    return `<div class="conv-sep"><span class="conv-sep-title">${esc(c.title||"Untitled")}</span>${starsHTML(c.importance)}${convLink(c,"Open conversation","conv-sep-link")}</div>
${ts.map(t=>turnHTML(t)).join("")||'<p class="muted">No full dialogue is stored.</p>'}`;
  }).join(""):'<div class="empty">No conversations stored for this episode.</div>'}</div>
${episodeNav(e,true)}</div>`;
}

/* ---------- Router ---------- */
let lastRouteKey=null;
function route(){
  const raw=location.hash.slice(1),qi=raw.indexOf("?"),
    path=qi<0?raw:raw.slice(0,qi),params=new URLSearchParams(qi<0?"":raw.slice(qi+1)),
    dec=s=>{try{return decodeURIComponent(s)}catch{return s}},
    pages=["home","episodes","importance","tags","search","random","statistics"],
    isConv=path.startsWith("conversation/"),root=path.split("/")[0],
    page=isConv?"conversation":pages.includes(root)?root:"home";
  showPage(page,isConv?"episodes":page);
  document.body.classList.remove("nav-open");$("nav-toggle")?.setAttribute("aria-expanded","false");
  document.title=page==="home"?"Handon Quotes":`${page[0].toUpperCase()+page.slice(1)} · Handon Quotes`;
  if(path.startsWith("conversation/episode/")){
    const rest=path.slice("conversation/episode/".length);
    rest.endsWith("/full")?episodeFullPage(dec(rest.slice(0,-5))):episodePage(dec(rest));
  }
  else if(isConv) conversation(dec(path.slice("conversation/".length)));
  else if(page==="episodes") episodes();
  else if(page==="importance") importance();
  else if(page==="tags") tagsPage(path.startsWith("tags/")?dec(path.slice(5)):"");
  else if(page==="search"){applySearchParams(params);search()}
  else if(page==="random"){if(!$("random-result").innerHTML) $("random-result").innerHTML='<div class="empty">Press “Give me one” to get a random quote.</div>'}
  else if(page==="statistics") statistics();
  else home();
  // Scroll to top and move focus only when the page changes, not when a tag is picked.
  const key=isConv?path:page;
  if(lastRouteKey!==null&&key!==lastRouteKey){
    window.scrollTo(0,0);
    const h=$(page)?.querySelector("h1,h2");if(h){h.setAttribute("tabindex","-1");h.focus({preventScroll:true})}
  }
  lastRouteKey=key;
  // #conversation/ID?line=N (from a search result): scroll to that line and highlight it.
  const line=isConv&&params.has("line")?$("line-"+params.get("line")):null;
  if(line){line.classList.add("target");line.scrollIntoView({block:"center"})}
  if(page==="search"&&pendingSearchFocus) $("search-input").focus();
  pendingSearchFocus=false;
}

// "/" from anywhere: open Search with the cursor in the box.
let pendingSearchFocus=false;
function focusSearch(){
  if($("search").classList.contains("active")){$("search-input").focus();return}
  pendingSearchFocus=true;location.hash="search";
}
