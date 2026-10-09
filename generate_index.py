from datetime import datetime, timezone
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"

files = sorted(
    p.relative_to(DATA).as_posix()
    for p in DATA.rglob("*.json")
    if p.name != "index.json"
)

# Always put The Originals S05E12 first
featured = "TO/S5EP12.json"

if featured in files:
    files.remove(featured)
    files.insert(0, featured)

errors = []
warnings = []
seen_ids = {}
episodes_by_show = {}

for rel in files:
    try:
        with (DATA / rel).open(encoding="utf-8") as f:
            ep = json.load(f)
    except (OSError, ValueError) as e:
        errors.append(f"{rel}: not valid JSON ({e})")
        continue

    for key in ("show", "season", "episode", "episode_id", "episode_title"):
        if ep.get(key) in (None, ""):
            errors.append(f"{rel}: missing '{key}'")

    if isinstance(ep.get("season"), int) and isinstance(ep.get("episode"), int):
        episodes_by_show.setdefault((ep.get("show"), ep["season"]), set()).add(ep["episode"])

    for c in ep.get("conversations", []):
        cid = c.get("id")
        if not cid:
            errors.append(f"{rel}: conversation without an 'id' ({c.get('title', '?')})")
            continue
        if cid in seen_ids:
            errors.append(f"{rel}: duplicate conversation id {cid} (also in {seen_ids[cid]})")
        seen_ids[cid] = rel

        imp = c.get("importance")
        if not isinstance(imp, int) or isinstance(imp, bool) or not 1 <= imp <= 5:
            errors.append(f"{rel}: {cid} importance must be an integer 1-5 (got {imp!r})")

        for mode in ("full", "short"):
            turns = c.get(mode, {}).get("turns", [])
            if not any((t.get("text") or t.get("action")) for t in turns):
                warnings.append(f"{rel}: {cid} has no usable '{mode}' turns")
            for t in turns:
                if t and not (t.get("text") or t.get("action")):
                    warnings.append(f"{rel}: {cid} has a turn without text or action")

# Gaps in episode numbering (e.g. S1 has 1-9 and 11, so 10 is missing)
for (show, season), nums in sorted(episodes_by_show.items(), key=lambda x: (str(x[0][0]), x[0][1])):
    missing = [n for n in range(1, max(nums) + 1) if n not in nums]
    if missing:
        warnings.append(f"{show} S{season}: no file for episode(s) {', '.join(map(str, missing))}")

for w in warnings:
    print("warning:", w)
for e in errors:
    print("ERROR:", e)
if errors:
    print(f"\n{len(errors)} error(s); index.json was NOT updated.")
    sys.exit(1)

# "version" changes on every run; the site appends it to episode URLs so browsers
# and the GitHub Pages cache never serve a stale copy after a push.
version = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

with (DATA / "index.json").open("w", encoding="utf-8") as f:
    json.dump(
        {"version": version, "episodes": files},
        f,
        ensure_ascii=False,
        indent=2
    )

print(f"Indexed {len(files)} JSON files (version {version}).")
