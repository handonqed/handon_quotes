const $=id=>document.getElementById(id);
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function hi(text,q){let s=esc(text);if(!q)return s;let z=q.replace(/[.*+?^${}()|[\\]\\]/g,"\\$&");return s.replace(new RegExp("("+z+")","ig"),"<mark class='mark'>$1</mark>")}
function tagHTML(a=[]){return a.map(x=>`<span class="tag">${esc(x)}</span>`).join("")}
function card(i,mode="short"){let e=i.episode,c=i.conversation,t=allTurns(i,mode);return `<article class="card">
<div class="meta">${esc(episodeLabel(e))} · ${esc(e.episode_title||"")}</div><h3>${esc(c.title||"Untitled")}</h3>
<div class="stars">${stars(c.importance)}</div><p>${esc(c.description||"")}</p><div class="tags">${tagHTML(c.tags||[])}</div>
<a class="button secondary" href="#conversation/${encodeURIComponent(c.id)}">View conversation</a>
${t.length?`<div>${t.map(x=>`<div class="turn"><div class="speaker">${esc(x.speaker?.character||"")}</div><div class="quote">${esc(turnContent(x))}</div></div>`).join("")}</div>`:""}</article>`}
function showPage(id){document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));$(id)?.classList.add("active")}
function fill(id,vals){let e=$(id),first=e.options[0]?.outerHTML||"";e.innerHTML=first+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("")}
function filters(prefix){let s=$(`${prefix}-show`).value,se=$(`${prefix}-season`).value,m=Number($(`${prefix}-importance`).value||0);return DB.conversations.filter(i=>(!s||i.episode.show===s)&&(!se||String(i.episode.season)===se)&&Number(i.conversation.importance||0)>=m)}
function home(){let e=DB.episodes.length,c=DB.conversations.length,t=DB.conversations.reduce((n,i)=>n+allTurns(i,"full").length,0),w=DB.conversations.reduce((n,i)=>n+allTurns(i,"full").reduce((m,x)=>m+String(x.text).trim().split(/\\s+/).filter(Boolean).length,0),0);$("home-stats").innerHTML=[["Episodes",e],["Conversations",c],["Full turns",t],["Words",w.toLocaleString()]].map(x=>`<div class="stat"><div class="number">${x[1]}</div><div class="label">${x[0]}</div></div>`).join("")}
function episodes(){let b={};DB.episodes.forEach(e=>(b[e.show]??=[]).push(e));let h="";Object.keys(b).sort().forEach(show=>{h+=`<div class="show"><h3>${esc(show)}</h3>`;let ss={};b[show].forEach(e=>(ss[e.season]??=[]).push(e));Object.keys(ss).sort((a,b)=>a-b).forEach(s=>{h+=`<div class="season"><h3>Season ${s}</h3><div class="episode-grid">`;ss[s].sort((a,b)=>(a.episode||0)-(b.episode||0)).forEach(e=>h+=`<a class="episode-card" href="#conversation/episode/${encodeURIComponent(e.episode_id)}"><div class="code">${esc(episodeLabel(e))}</div><strong>${esc(e.episode_title||"")}</strong><div class="meta">${(e.conversations||[]).length} conversations</div></a>`);h+="</div></div>"});h+="</div>"});$("episode-browser").innerHTML=h||'<div class="empty">No episodes loaded.</div>'}
function importance(){let m=Number($("importance-filter").value);let a=DB.conversations.filter(i=>Number(i.conversation.importance||0)>=m).sort((x,y)=>(y.conversation.importance||0)-(x.conversation.importance||0));$("importance-results").innerHTML=a.length?a.map(i=>card(i)).join(""):'<div class="empty">No conversations match.</div>'}
function search(){let q=$("search-input").value.trim(),show=$("search-show").value,se=$("search-season").value,ch=$("search-character").value,m=Number($("search-importance").value);if(!q){$("search-count").textContent="";$("search-results").innerHTML='<div class="empty">Type a word or phrase to search.</div>';return}let a=[];DB.conversations.forEach(i=>{let e=i.episode,c=i.conversation;if(show&&e.show!==show||se&&String(e.season)!==se||Number(c.importance||0)<m)return;allTurns(i,"full").forEach(t=>{if(ch&&String(t.speaker?.character||"").toLowerCase()!==ch.toLowerCase())return;let content = turnContent(t); if(content.toLowerCase().includes(q.toLowerCase())) { a.push({i,t}); }})});$("search-count").textContent=`${a.length} matching line${a.length===1?"":"s"}`;$("search-results").innerHTML=a.length?a.map(x=>`<article class="card"><div class="meta">${esc(episodeLabel(x.i.episode))} · ${esc(x.i.episode.episode_title||"")}</div><h3>${esc(x.i.conversation.title||"")}</h3><div class="speaker">${esc(x.t.speaker?.character||"")}</div><div class="quote">${hi(turnContent(x.t),q)}</div><p><a class="button secondary" href="#conversation/${encodeURIComponent(x.i.conversation.id)}">View conversation</a></p></article>`).join(""):'<div class="empty">No matching lines.</div>'}
function randomResult(){
    let a = filters("random");
    let type = $("random-type").value;

    let character = $("random-character").value || "either";

    let mode = type === "short" ? "short" : "full";

    // Keep only conversations that contain at least one
    // line from the selected character(s).
    a = a.filter(i =>
        allTurns(i, mode).some(t => {
            let speaker = String(t.speaker?.character || "").toLowerCase();

            if (character === "hope") {
                return speaker === "hope" || speaker === "handon";
            }

            if (character === "landon") {
                return speaker === "landon" || speaker === "handon";
            }

            // Default: Hope or Landon
            return speaker === "hope" || speaker === "landon" || speaker === "handon";
        })
    );

    if (!a.length) {
        $("random-result").innerHTML =
            '<div class="empty">No results match these filters.</div>';
        return;
    }

    let i = a[Math.floor(Math.random() * a.length)];
    let e = i.episode;
    let c = i.conversation;

    let t = allTurns(i, mode);

    // ========================================================
    // RANDOM SHORT CONVERSATION
    // ========================================================

    if (type === "short") {

        // Apply the character filter to the displayed lines.
        if (character === "hope") {
            t = t.filter(x => {
                let speaker = String(x.speaker?.character || "").toLowerCase();
                return speaker === "hope" || speaker === "handon";
            });
        }
        else if (character === "landon") {
            t = t.filter(x => {
                let speaker = String(x.speaker?.character || "").toLowerCase();
                return speaker === "landon" || speaker === "handon";
            });
        }
        else {
            t = t.filter(x => {
                let speaker =
                    String(x.speaker?.character || "").toLowerCase();

                return speaker === "hope" || speaker === "landon" || speaker === "handon";
            });
        }

        $("random-result").innerHTML = `
            <div class="quote-card">

                <div class="meta">
                    ${esc(episodeLabel(e))}
                </div>

                <h3>${esc(c.title || "")}</h3>

                <div class="stars">
                    ${stars(c.importance)}
                </div>

                ${t.map(x => `
                    <div class="turn">
                        <div class="speaker">
                            ${esc(x.speaker?.character || "")}
                        </div>

                        <div class="quote">
                            ${esc(turnContent(x))}
                        </div>
                    </div>
                `).join("")}

                <a class="button secondary"
                   href="#conversation/${encodeURIComponent(c.id)}">
                    Open conversation
                </a>

            </div>
        `;
    }

    // ========================================================
    // SINGLE RANDOM QUOTE
    // ========================================================

    else {

        let quotes = t.filter(x => {
            let speaker =
                String(x.speaker?.character || "").toLowerCase();

            if (character === "hope") {
                return speaker === "hope" || speaker === "handon";
            }

            if (character === "landon") {
                return speaker === "landon" || speaker === "handon";
            }

            return speaker === "hope" || speaker === "landon" || speaker === "handon";
        });

        if (!quotes.length) {
            $("random-result").innerHTML =
                '<div class="empty">No quotes match these filters.</div>';
            return;
        }

        let x = quotes[Math.floor(Math.random() * quotes.length)];

        $("random-result").innerHTML = `
            <div class="quote-card">

                <div class="meta">
                    ${esc(episodeLabel(e))} · ${esc(c.title || "")}
                </div>

                <div class="speaker">
                    ${esc(x.speaker?.character || "")}
                </div>

                <div class="quote">
                    “${esc(turnContent(x))}”
                </div>

                <div class="stars">
                    ${stars(c.importance)}
                </div>

                <a class="button secondary"
                   href="#conversation/${encodeURIComponent(c.id)}">
                    Open conversation
                </a>

            </div>
        `;
    }
}
function statistics(){let imp={1:0,2:0,3:0,4:0,5:0};DB.conversations.forEach(i=>imp[i.conversation.importance]=(imp[i.conversation.importance]||0)+1);let v=DB.conversations.filter(i=>i.conversation.verified).length;$("statistics-content").innerHTML=[["Episodes",DB.episodes.length],["Conversations",DB.conversations.length],["Verified",v],["★★★★★",imp[5]||0],["★★★★☆",imp[4]||0],["★★★☆☆",imp[3]||0]].map(x=>`<div class="stat"><div class="number">${x[1]}</div><div class="label">${x[0]}</div></div>`).join("")}
function conversation(id){let i=DB.conversations.find(x=>x.conversation.id===id);if(!i){$("conversation-content").innerHTML='<div class="empty">Conversation not found.</div>';return}let e=i.episode,c=i.conversation;$("conversation-content").innerHTML=`<div class="full"><a class="back" href="#episodes">← Back to episodes</a><div class="conversation-header"><div class="eyebrow">${esc(episodeLabel(e))}</div><h2>${esc(c.title||"Untitled")}</h2><p>${esc(e.episode_title||"")}</p><div class="stars">${stars(c.importance)}</div><p>${esc(c.description||"")}</p><div class="tags">${tagHTML(c.tags||[])}</div></div><div class="conversation-body">${allTurns(i,"full").map(t=>`<div class="turn"><div class="speaker">${esc(t.speaker?.character||"")}</div><div class="quote">${esc(x.text)}</div></div>`).join("")||'<div class="empty">No full dialogue is stored.</div>'}</div></div>`}
function episodePage(id){let e=DB.episodes.find(x=>x.episode_id===id);if(!e)return;$("conversation-content").innerHTML=`<div class="full"><a class="back" href="#episodes">← Back to episodes</a><div class="conversation-header"><div class="eyebrow">${esc(episodeLabel(e))}</div><h2>${esc(e.episode_title||"")}</h2></div><div class="list">${(e.conversations||[]).map(c=>card({episode:e,conversation:c})).join("")}</div></div>`}
function route(){let h=location.hash.slice(1);if(h.startsWith("conversation/episode/")){showPage("conversation");episodePage(decodeURIComponent(h.slice(20)))}else if(h.startsWith("conversation/")){showPage("conversation");conversation(decodeURIComponent(h.slice(13)))}else{let p=h||"home";showPage(["home","episodes","importance","search","random","statistics"].includes(p)?p:"home");if(p==="home")home();if(p==="episodes")episodes();if(p==="importance")importance();if(p==="search")search();if(p==="statistics")statistics()}}
