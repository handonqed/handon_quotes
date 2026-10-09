document.addEventListener("DOMContentLoaded",async()=>{
  // Theme and mobile menu are set up first so they still work if the data fails to load.
  const themeBtn=$("theme-toggle"),root=document.documentElement;
  // localStorage can throw (private mode, blocked site data); the toggle must still work.
  const saveTheme=v=>{try{localStorage.setItem("theme",v)}catch{}};
  const applyIcon=()=>{
    const light=root.getAttribute("data-theme")==="light";
    themeBtn.textContent=light?"🌙":"☀️";
    themeBtn.setAttribute("aria-label",light?"Switch to dark mode":"Switch to light mode");
    themeBtn.title=light?"Switch to dark mode":"Switch to light mode";
  };
  applyIcon();
  themeBtn.addEventListener("click",()=>{
    if(root.getAttribute("data-theme")==="light"){root.removeAttribute("data-theme");saveTheme("dark")}
    else{root.setAttribute("data-theme","light");saveTheme("light")}
    applyIcon();
  });
  $("nav-toggle").addEventListener("click",()=>{
    const open=document.body.classList.toggle("nav-open");
    $("nav-toggle").setAttribute("aria-expanded",String(open));
  });

  // "Skip to content": a plain #app link would be read by the router as a page, so move focus by hand.
  $("skip-link").addEventListener("click",ev=>{ev.preventDefault();$("app").focus();$("app").scrollIntoView()});

  // "/" opens Search with the cursor in the box (ignored while typing in a field).
  document.addEventListener("keydown",ev=>{
    if(ev.key!=="/"||ev.ctrlKey||ev.metaKey||ev.altKey||!DB.loaded) return;
    if(ev.target.closest?.("input,textarea,select,[contenteditable]")) return;
    ev.preventDefault();focusSearch();
  });

  // The header videos are decoration: keep them still for visitors who ask for reduced motion.
  const calm=window.matchMedia?matchMedia("(prefers-reduced-motion: reduce)"):null;
  const applyMotion=()=>document.querySelectorAll("video").forEach(v=>{
    if(calm.matches){v.autoplay=false;v.pause()}else{v.autoplay=true;v.play().catch(()=>{})}
  });
  if(calm){if(calm.matches) applyMotion();calm.addEventListener?.("change",applyMotion)}

  // One delegated handler for every "Copy" button.
  document.addEventListener("click",async ev=>{
    if(ev.target.closest("#search-more")){searchMore();return}
    const b=ev.target.closest("[data-copy]"); if(!b) return;
    const text=b.dataset.copy,label=b.dataset.label||b.textContent;
    b.dataset.label=label;
    let ok=true;
    try{await navigator.clipboard.writeText(text)}
    catch{
      try{const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();ok=document.execCommand("copy");ta.remove()}
      catch{ok=false}
    }
    b.textContent=ok?"Copied":"Copy failed";setTimeout(()=>{b.textContent=label},1500);
  });

  try{
    await loadDatabase();
    if(DB.errors.length) $("app").insertAdjacentHTML("afterbegin",`<div class="empty warn" role="alert">${DB.errors.length} episode file${DB.errors.length===1?"":"s"} could not be loaded and ${DB.errors.length===1?"is":"are"} missing from the results: ${esc(DB.errors.join(", "))}</div>`);

    fillSeasons("search");fillSeasons("random");

    $("search-input").addEventListener("input",()=>{searchSoon()});
    ["search-episode","search-character","search-importance"].forEach(id=>$(id).addEventListener("change",search));
    // Changing the season narrows the episode list.
    $("search-season").addEventListener("change",()=>{fillEpisodes("search");search()});
    $("random-season").addEventListener("change",()=>fillEpisodes("random"));
    $("importance-filter").addEventListener("change",importance);
    $("random-button").addEventListener("click",randomResult);

    // Tag buttons change the URL (#tags/Name); clicking the active tag clears it.
    $("tag-browser").addEventListener("click",ev=>{
      const b=ev.target.closest("[data-tag]"); if(!b) return;
      location.hash=b.classList.contains("active")?"tags":"tags/"+encodeURIComponent(b.dataset.tag);
    });

    window.addEventListener("hashchange",route);
    route();
  }catch(e){
    $("app").innerHTML=`<section class="page active"><div class="empty"><h2>Could not load database</h2><p>${esc(e.message)}</p><p>Use GitHub Pages or a local web server; do not open index.html directly as file://.</p></div></section>`;
  }
});
