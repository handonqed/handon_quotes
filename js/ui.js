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
function sortConversations(a, b) {
    let ea = a.episode || {};
    let eb = b.episode || {};

    // Custom show order
    const showOrder = {
        "The Originals": 1,
        "Legacies": 2
    };

    let showA = showOrder[ea.show] || 99;
    let showB = showOrder[eb.show] || 99;

    // 1. Show
    if (showA !== showB) {
        return showA - showB;
    }

    // 2. Season
    let seasonCompare =
        Number(ea.season || 0) - Number(eb.season || 0);

    if (seasonCompare !== 0) return seasonCompare;

    // 3. Episode
    let episodeCompare =
        Number(ea.episode || 0) - Number(eb.episode || 0);

    if (episodeCompare !== 0) return episodeCompare;

    // 4. Conversation title
    return String(a.conversation?.title || "").localeCompare(
        String(b.conversation?.title || ""),
        undefined,
        { numeric: true }
    );
}

function home() {
    let e = DB.episodes.length;
    let c = DB.conversations.length;

    let hopeTurns = 0;
    let landonTurns = 0;
    let hopeWords = 0;
    let landonWords = 0;

    DB.conversations.forEach(i => {
        allTurns(i, "full").forEach(t => {
            let character = String(t.speaker?.character || "").toLowerCase();
            let words = String(t.text || "")
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .length;

            if (character === "hope") {
                hopeTurns++;
                hopeWords += words;
            }

            if (character === "landon") {
                landonTurns++;
                landonWords += words;
            }
        });
    });

    let totalWords = hopeWords + landonWords;

    $("home-stats").innerHTML = [
        ["Episodes", e],
        ["Conversations", c],
        ["Full turns", hopeTurns + landonTurns],
        ["Words", totalWords.toLocaleString()]
    ]
    .map(x =>
        `<div class="stat">
            <div class="number">${x[1]}</div>
            <div class="label">${x[0]}</div>
        </div>`
    )
    .join("");
}
function episodes() {
    let groups = {};

    DB.episodes.forEach(e => {
        let show = e.show || "Unknown";
        let season = Number(e.season || 0);

        if (!groups[show]) {
            groups[show] = {};
        }

        if (!groups[show][season]) {
            groups[show][season] = [];
        }

        groups[show][season].push(e);
    });

    const showOrder = {
        "The Originals": 1,
        "The Vampire Diaries": 2,
        "Legacies": 3
    };

    let shows = Object.keys(groups).sort((a, b) => {
        let orderA = showOrder[a] || 99;
        let orderB = showOrder[b] || 99;

        if (orderA !== orderB) {
            return orderA - orderB;
        }

        return a.localeCompare(b);
    });

    $("episodes-results").innerHTML = shows.map(show => {
        let seasons = Object.keys(groups[show])
            .sort((a, b) => Number(a) - Number(b));

        return `
            <div class="show-group">
                <h2>${esc(show)}</h2>

                ${seasons.map(season => {
                    let eps = groups[show][season];

                    eps.sort((a, b) =>
                        Number(a.episode || 0) -
                        Number(b.episode || 0)
                    );

                    return `
                        <div class="season-group">
                            <h3>Season ${esc(season)}</h3>

                            ${eps.map(e => `
                                <div class="episode-item">
                                    <a href="#conversation/episode/${encodeURIComponent(e.id)}">
                                        ${esc(episodeLabel(e))}
                                    </a>
                                </div>
                            `).join("")}
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    }).join("");
}
function importance() {
    let m = Number($("importance-filter").value);

    let a = DB.conversations
        .filter(i => Number(i.conversation.importance || 0) === m)
        .sort(sortConversations);

    $("importance-results").innerHTML = a.length
        ? a.map(i => card(i)).join("")
        : '<div class="empty">No conversations match this importance level.</div>';
}
function search() {
    let q = String($("search-input").value || "").trim().toLowerCase();

    if (!q) {
        $("search-results").innerHTML =
            '<div class="empty">Enter something to search.</div>';
        return;
    }

    let a = [];

    DB.conversations.forEach(i => {
        let turns = allTurns(i, "full");

        turns.forEach(t => {
            let text = turnContent(t);

            if (text.toLowerCase().includes(q)) {
                a.push({
                    i: i,
                    turn: t
                });
            }
        });
    });

    // Sort by show → season → episode
    a.sort((x, y) => {
        return sortConversations(x.i, y.i);
    });

    $("search-results").innerHTML = a.length
        ? a.map(x => {
            return `
                <div class="search-result">
                    ${card(x.i)}
                    <div class="search-match">
                        ${esc(turnContent(x.turn))}
                    </div>
                </div>
            `;
        }).join("")
        : '<div class="empty">No results found.</div>';
}
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
function tagsPage() {
    let tagSet = new Set();

    DB.conversations.forEach(i => {
        (i.conversation.tags || []).forEach(tag => {
            if (String(tag).trim()) {
                tagSet.add(String(tag).trim());
            }
        });
    });

    let tags = [...tagSet].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
    );

    $("tag-browser").innerHTML = tags.length
        ? tags.map(tag => `
            <button
                class="tag tag-button"
                data-tag="${esc(tag)}"
                onclick="showTag('${esc(tag).replace(/'/g, "\\'")}')"
            >
                ${esc(tag)}
            </button>
        `).join("")
        : '<div class="empty">No tags found.</div>';

    $("tag-results").innerHTML =
        '<div class="empty">Select a tag to see its conversations.</div>';
}


function showTag(tag) {
    let a = DB.conversations
        .filter(i =>
            (i.conversation.tags || [])
                .some(t => String(t).toLowerCase() === tag.toLowerCase())
        )
        .sort(sortConversations);

    $("tag-results").innerHTML = a.length
        ? a.map(i => card(i)).join("")
        : '<div class="empty">No conversations have this tag.</div>';
}



function statistics() {
    let hopeTurns = 0;
    let landonTurns = 0;
    let hopeWords = 0;
    let landonWords = 0;

    DB.conversations.forEach(i => {
        allTurns(i, "full").forEach(t => {
            let character = String(t.speaker?.character || "").toLowerCase();

            // Ignore Handon/shared lines for the individual totals
            if (character === "hope") {
                hopeTurns++;

                hopeWords += String(t.text || "")
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .length;
            }

            if (character === "landon") {
                landonTurns++;

                landonWords += String(t.text || "")
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .length;
            }
        });
    });

    $("statistics-content").innerHTML = [
        ["Episodes", DB.episodes.length],
        ["Conversations", DB.conversations.length],
        ["Hope turns", hopeTurns],
        ["Hope words", hopeWords.toLocaleString()],
        ["Landon turns", landonTurns],
        ["Landon words", landonWords.toLocaleString()]
    ]
    .map(x =>
        `<div class="stat">
            <div class="number">${x[1]}</div>
            <div class="label">${x[0]}</div>
        </div>`
    )
    .join("");
}
function conversation(id){let i=DB.conversations.find(x=>x.conversation.id===id);if(!i){$("conversation-content").innerHTML='<div class="empty">Conversation not found.</div>';return}let e=i.episode,c=i.conversation;$("conversation-content").innerHTML=`<div class="full"><a class="back" href="#episodes">← Back to episodes</a><div class="conversation-header"><div class="eyebrow">${esc(episodeLabel(e))}</div><h2>${esc(c.title||"Untitled")}</h2><p>${esc(e.episode_title||"")}</p><div class="stars">${stars(c.importance)}</div><p>${esc(c.description||"")}</p><div class="tags">${tagHTML(c.tags||[])}</div></div><div class="conversation-body">${allTurns(i,"full").map(t=>`<div class="turn"><div class="speaker">${esc(t.speaker?.character||"")}</div><div class="quote">${esc(turnContent(t))}</div></div>`).join("")||'<div class="empty">No full dialogue is stored.</div>'}</div></div>`}
function episodePage(id) {
    let e = DB.episodes.find(x => x.episode_id === id);

    if (!e) {
        $("conversation-content").innerHTML =
            '<div class="empty">Episode not found.</div>';
        return;
    }

    let conversations = e.conversations || [];

    $("conversation-content").innerHTML = `
        <div class="full">
            <a class="back" href="#episodes">← Back to episodes</a>

            <div class="conversation-header">
                <div class="eyebrow">${esc(episodeLabel(e))}</div>
                <h2>${esc(e.episode_title || "")}</h2>
                <p>${conversations.length} conversation${conversations.length === 1 ? "" : "s"}</p>
            </div>

            <div class="list">
                ${
                    conversations.length
                        ? conversations
                            .map(c => card({
                                episode: e,
                                conversation: c
                            }))
                            .join("")
                        : '<div class="empty">No conversations stored for this episode.</div>'
                }
            </div>
        </div>
    `;
}
function route() {
    let h = location.hash.slice(1);

    if (h.startsWith("conversation/episode/")) {
        showPage("conversation");

        const prefix = "conversation/episode/";
        const id = decodeURIComponent(h.slice(prefix.length));

        episodePage(id);

    } else if (h.startsWith("conversation/")) {
        showPage("conversation");

        const prefix = "conversation/";
        const id = decodeURIComponent(h.slice(prefix.length));

        conversation(id);

    } else {
        let p = h || "home";

        showPage(
            ["home", "episodes", "importance", "tags", "search", "random", "statistics"]
                .includes(p) ? p : "home"
        );

        if (p === "home") home();
        if (p === "episodes") episodes();
        if (p === "importance") importance();
        if (p === "tags") tagsPage();
        if (p === "search") search();
        if (p === "random") randomResult();
        if (p === "statistics") statistics();
    }
}
