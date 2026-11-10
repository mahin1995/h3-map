# H3 Airport Geofence

A Node.js / Vite application based on the supplied Bengali HTML workflow. Draw an airport polygon, cover it with H3 hexagons, and place a crew member to check **Present / Absent**.

![H3 airport polygon and attendance interface](docs/screenshot.png)

> Actual browser screenshot from this environment. The polygon, 162 H3 cells, and attendance calculation work. Background tiles were blocked by the cloud network policy, so the screenshot includes the tile warning rather than a loaded street map.

## Run

Requires Node.js **20.19+ or 22.12+** (tested with Node 24).

```sh
npm ci
npm run dev
```

Open the URL printed by Vite in your browser. Serve the app through Node/Vite; do not open `index.html` using `file://`.

```sh
npm run build      # production assets in dist/
npm run preview    # serve the production build
```

The built `dist/` directory can also be hosted on a static web server. No database, backend credentials, or Python installation is required for the web app.

## Workflow

1. The initial polygon surrounds a sample area near Dhaka airport.
2. Select **কোণা আঁকুন** and click the map to add corners. Drag a corner to move it; right-click to remove it. Use Undo or Clear to edit.
3. Adjust resolution (7–13), boundary-cell inclusion, or the approximate buffer (0–200 meters).
4. Select **ক্রু বসান** and click the map, drag the crew marker, or enter latitude/longitude. Attendance uses membership in the displayed H3 cell set.
5. Review cell count, approximate areas, polygon membership, and distance to its boundary. Copy the generated Python code to reproduce attendance for the current cell set with Python `h3>=4,<5`.

The buffer expands vertices away from the polygon's mean center; it is an approximation, not an exact distance buffer. Boundary coverage retains the original neighboring-cell/vertex heuristic and is not guaranteed to include every intersecting cell for arbitrary narrow or complex polygons. High resolutions or large polygons can produce many cells and slow rendering. This is an interactive demonstration, not a validated airport attendance system.

## Why the original map showed “Access blocked”

The original HTML requested tiles from OpenStreetMap's public volunteer tile service. Those tiles can be rejected under the provider's usage/access policies, including requests without acceptable browser identification or referrer context. A Node project alone cannot override a provider's refusal.

This project bundles Leaflet and H3 locally through npm, serves the page over HTTP, and defaults to CARTO's raster basemap with attribution. It does **not** proxy or bypass OpenStreetMap's block. Use a tile provider whose terms and capacity fit your deployment.

To change the provider, copy `.env.example` to `.env.local`, configure its URL and required attribution, then restart Vite (or rebuild for production):

```dotenv
VITE_TILE_URL=https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png
VITE_TILE_ATTRIBUTION=&copy; OpenStreetMap contributors &copy; CARTO
```

`VITE_` variables are public browser configuration; never put private credentials in them. If a provider uses a browser token, follow its origin restrictions. Requests go directly from the browser to the configured provider.

In restricted cloud environments, allow **basemaps.cartocdn.com** for the default map. During setup this destination returned a proxy 403, and the environment settings tool could not save the domain addition. Background map access therefore remains unverified here. A visible warning reports tile failures while local geometry and attendance continue to work.

## Validation

```sh
npm test
```

The Playwright smoke test expects a running app at port 5173 and Chromium at `/usr/bin/chromium`. Override `APP_URL` and `CHROMIUM_PATH` if needed. Alternatively install Chromium with `npx playwright install chromium` and set `CHROMIUM_PATH` to that executable.

The test verifies initial attendance, an outside location, invalid coordinates, drawing a new polygon, crew placement, clear/undo, boundary and buffer controls, Python export, and mobile layout. It writes the current screenshot to `docs/screenshot.png`. It reports loaded tile count separately; passing geometry tests do not establish basemap availability.

## Project files

- `index.html`: Bengali controls and application layout.
- `src/main.js`: Leaflet map, H3 geometry, interactions, and Python export.
- `src/style.css`: responsive desktop/mobile styling.
- `tests/smoke.mjs`: browser interaction checks.
- `docs/screenshot.png`: actual application screenshot.

The supplied notebook uses older H3 Python v3 APIs and an external Denver CSV. Its unrelated analysis is not required by this app; the generated Python export uses H3 v4.
