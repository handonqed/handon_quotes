document.addEventListener("DOMContentLoaded",async()=>{try{await loadDatabase();
let themeBtn = $("theme-toggle");
let applyIcon = () => themeBtn.textContent = document.documentElement.getAttribute("data-theme") === "light" ? "🌙" : "☀️";
applyIcon();
themeBtn.addEventListener("click", () => {
  let isLight = document.documentElement.getAttribute("data-theme") === "light";
  if (isLight) { document.documentElement.removeAttribute("data-theme"); localStorage.setItem("theme","dark"); }
  else { document.documentElement.setAttribute("data-theme","light"); localStorage.setItem("theme","light"); }
  applyIcon();
});                                                          
let shows=unique(DB.episodes.map(e=>e.show).filter(Boolean)),seasons=unique(DB.episodes.map(e=>e.season).filter(v=>v!==undefined));
fill("search-show",shows);
fill("random-show",shows);
fill("search-season",seasons);
fill("random-season",seasons);home();episodes();importance();statistics();
$("importance-filter").addEventListener("change",importance);$("search-input").addEventListener("input",search);["search-show","search-season","search-character","search-importance"].forEach(id=>$(id).addEventListener("change",search));$("random-button").addEventListener("click",randomResult);window.addEventListener("hashchange",route);route()}catch(e){document.getElementById("app").innerHTML=`<section class="page active"><div class="empty"><h2>Could not load database</h2><p>${esc(e.message)}</p><p>Use GitHub Pages or a local web server; do not open index.html directly as file://.</p></div></section>`}})
