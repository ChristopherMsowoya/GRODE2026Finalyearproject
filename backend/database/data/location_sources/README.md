## Location Area Sources

This folder stores local location-name sources used by the GRODE location search.

- `MW/MW.txt` comes from the GeoNames Malawi country dump.
- The backend loads populated places from GeoNames and assigns them to the 28 Malawi district polygons using point-in-polygon checks.
- HOTOSM populated places and a small curated Lilongwe urban-area supplement are also merged in.

The app does not need Google Places for normal demo search when this file is present.
