import json

with open("backend/database/data/shapefiles/ADM0(country)/geoBoundaries-MWI-ADM0_simplified.geojson", "r", encoding="utf-8") as f:
    d = json.load(f)

# Find largest polygon (to avoid islands like likoma breaking bounds if we just assume coords[0] is the main landmass)
coords = max(d['features'][0]['geometry']['coordinates'], key=lambda p: len(p[0]))[0]

min_x = min(c[0] for c in coords)
max_x = max(c[0] for c in coords)
min_y = min(c[1] for c in coords)
max_y = max(c[1] for c in coords)

w = max_x - min_x
h = max_y - min_y
scale = 100 / h

print(len(coords))

# Decimate coords a bit if it's too huge
step = max(1, len(coords) // 100)
coords = [coords[i] for i in range(0, len(coords), step)]
coords.append(coords[0]) # close it

svg_pts = [f"{(c[0]-min_x)*scale},{(max_y-c[1])*scale}" for c in coords]
print(f'<svg className="h-8 w-11 rounded flex-shrink-0" viewBox="0 0 {w*scale} {h*scale}" xmlns="http://www.w3.org/2000/svg">')
print(f'  <path d="M {" L ".join(svg_pts)} Z" fill="#1F7A63" />')
print(f'</svg>')
