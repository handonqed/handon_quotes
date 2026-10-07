from pathlib import Path
import json

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

with (DATA / "index.json").open("w", encoding="utf-8") as f:
    json.dump(
        {"episodes": files},
        f,
        ensure_ascii=False,
        indent=2
    )

print(f"Indexed {len(files)} JSON files.")