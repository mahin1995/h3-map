import L from 'leaflet';
import * as h3 from 'h3-js';
import 'leaflet/dist/leaflet.css';
import './style.css';

  const $ = id => document.getElementById(id);
  const map = L.map('map', { doubleClickZoom: false }).setView([23.8433, 90.3978], 15);
  const tiles = L.tileLayer(import.meta.env.VITE_TILE_URL || 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: import.meta.env.VITE_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }).addTo(map);
  tiles.on('tileerror', () => { $('tileWarning').hidden = false; });
  tiles.on('tileload', () => { $('tileWarning').hidden = true; });

  // ---- state ----
  let mode = 'draw';
  let points = [                       // [lat, lng] — নমুনা polygon, নিজেরটা এঁকে নিন
    [23.8520, 90.3900], [23.8520, 90.4050], [23.8440, 90.4080],
    [23.8380, 90.4000], [23.8400, 90.3920]
  ];
  let crew = [23.8450, 90.3990];

  const vertexIcon = () => L.divIcon({ className: '', iconSize: [16, 16], iconAnchor: [8, 8],
    html: '<div style="width:16px;height:16px;border-radius:3px;background:#e8820c;border:2px solid #fff;box-shadow:0 0 0 1px #16222e"></div>' });
  const crewIcon = color => L.divIcon({ className: '', iconSize: [20, 20], iconAnchor: [10, 10],
    html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 1px #16222e"></div>` });

  const hexLayer = L.layerGroup().addTo(map);
  const polyLayer = L.layerGroup().addTo(map);
  const vertexLayer = L.layerGroup().addTo(map);
  const crewMarker = L.marker(crew, { draggable: true, icon: crewIcon('#7a8794'), zIndexOffset: 1000 }).addTo(map);

  // ---- geometry helpers ----
  function pip(pt, poly) {               // ray casting, points are [lat,lng]
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [yi, xi] = poly[i], [yj, xj] = poly[j];
      if (((xi > pt[1]) !== (xj > pt[1])) &&
          (pt[0] < (yj - yi) * (pt[1] - xi) / (xj - xi) + yi)) inside = !inside;
    }
    return inside;
  }
  // polygon বাফার (মিটার): প্রতিটি কোণা কেন্দ্র থেকে বাইরে সরানো — সহজ আনুমানিক পদ্ধতি
  function bufferedPoly(poly, meters) {
    if (!meters || poly.length < 3) return poly;
    const cLat = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const cLng = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    const mLat = 111320, mLng = 111320 * Math.cos(cLat * Math.PI / 180);
    return poly.map(([la, ln]) => {
      const dx = (ln - cLng) * mLng, dy = (la - cLat) * mLat;
      const d = Math.hypot(dx, dy) || 1;
      return [la + (dy / d) * meters / mLat, ln + (dx / d) * meters / mLng];
    });
  }
  function distToPolyM(pt, poly) {       // বিন্দু থেকে polygon-এর কাছের সীমানার দূরত্ব (মিটার)
    const mLat = 111320, mLng = 111320 * Math.cos(pt[0] * Math.PI / 180);
    let best = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ax = (a[1] - pt[1]) * mLng, ay = (a[0] - pt[0]) * mLat;
      const bx = (b[1] - pt[1]) * mLng, by = (b[0] - pt[0]) * mLat;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      let t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
    return best;
  }

  function computeCells(poly, res, includeEdge) {
    if (poly.length < 3) return new Set();
    const core = new Set(h3.polygonToCells(poly, res));
    if (!includeEdge) return core;
    const seeds = new Set(core);
    poly.forEach(p => seeds.add(h3.latLngToCell(p[0], p[1], res)));
    const out = new Set(seeds);
    seeds.forEach(c => h3.gridDisk(c, 1).forEach(n => {
      if (out.has(n)) return;
      const verts = h3.cellToBoundary(n);
      const ctr = h3.cellToLatLng(n);
      if (pip(ctr, poly) || verts.some(v => pip(v, poly))) out.add(n);
    }));
    return out;
  }

  // ---- render ----
  function render() {
    const res = +$('res').value, buf = +$('buf').value, edge = $('edge').checked;
    $('resVal').textContent = res; $('bufVal').textContent = buf;

    const poly = bufferedPoly(points, buf);
    const cells = computeCells(poly, res, edge);

    // polygon
    polyLayer.clearLayers();
    if (points.length >= 2) {
      L.polygon(points, { color: '#e8820c', weight: 3, fill: false, dashArray: '6 4', interactive: false }).addTo(polyLayer);
    }
    if (buf > 0 && points.length >= 3) {
      L.polygon(poly, { color: '#e8820c', weight: 1, fill: false, dashArray: '2 5', interactive: false }).addTo(polyLayer);
    }

    // hexagons
    hexLayer.clearLayers();
    cells.forEach(id => {
      L.polygon(h3.cellToBoundary(id), { color: '#1f6fb2', weight: 1.2, fillColor: '#1f6fb2', fillOpacity: 0.2 })
        .bindTooltip(id).addTo(hexLayer);
    });

    // vertices
    vertexLayer.clearLayers();
    points.forEach((p, i) => {
      const m = L.marker(p, { draggable: true, icon: vertexIcon(), zIndexOffset: 500 }).addTo(vertexLayer);
      m.on('dragend', e => { const ll = e.target.getLatLng(); points[i] = [ll.lat, ll.lng]; render(); });

      m.on('contextmenu', () => { points.splice(i, 1); render(); });
    });

    // crew
    const cll = crewMarker.getLatLng();
    crew = [cll.lat, cll.lng];
    $('uLat').value = crew[0].toFixed(5); $('uLng').value = crew[1].toFixed(5);

    const s = $('status');
    if (cells.size === 0) {
      s.textContent = 'কমপক্ষে ৩টি কোণা দিন'; s.className = 'idle';
      crewMarker.setIcon(crewIcon('#7a8794'));
    } else {
      const crewCell = h3.latLngToCell(crew[0], crew[1], res);
      const present = cells.has(crewCell);
      s.textContent = present ? 'Present' : 'Absent';
      s.className = present ? 'present' : '';
      crewMarker.setIcon(crewIcon(present ? '#1a8f4c' : '#c8372d'));
    }

    // stats
    let html = '';
    if (cells.size) {
      const any = cells.values().next().value;
      const area = h3.cellArea(any, h3.UNITS.m2);
      const hexTotal = area * cells.size;
      let polyArea = 0;
      if (points.length >= 3) {
        const cLat = points.reduce((a, p) => a + p[0], 0) / points.length;
        const mLat = 111320, mLng = 111320 * Math.cos(cLat * Math.PI / 180);
        for (let i = 0; i < points.length; i++) {
          const a = points[i], b = points[(i + 1) % points.length];
          polyArea += (a[1] * mLng) * (b[0] * mLat) - (b[1] * mLng) * (a[0] * mLat);
        }
        polyArea = Math.abs(polyArea) / 2;
      }
      const diff = polyArea ? ((hexTotal - polyArea) / polyArea * 100) : 0;
      const insidePoly = points.length >= 3 && pip(crew, points);
      const dist = points.length >= 3 ? distToPolyM(crew, points) : 0;
      html =
        `হেক্সাগন সংখ্যা: <b>${cells.size}</b> (প্রতিটি ≈ ${Math.round(area).toLocaleString()} m²)<br>` +
        `হেক্সাগনের মোট এলাকা: <b>${(hexTotal / 1e6).toFixed(3)} km²</b><br>` +
        `আপনার polygon: <b>${(polyArea / 1e6).toFixed(3)} km²</b><br>` +
        `পার্থক্য: <b>${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%</b> ${Math.abs(diff) > 15 ? '(resolution বাড়ান)' : ''}<br>` +
        `ক্রু আসল polygon-এর ভেতরে: <b>${insidePoly ? 'হ্যাঁ' : 'না'}</b> (সীমানা থেকে ≈ ${Math.round(dist)} m)`;
    }
    $('stats').innerHTML = html;
    $('code').value = makeCode(res, buf, edge);
  }
  // হালকা আপডেট (কোণা টানার সময়)
  let raf = 0;
  function renderLight() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }

  function makeCode(res, buf, edge) {
    const pts = points.map(p => `    (${p[0].toFixed(6)}, ${p[1].toFixed(6)}),`).join('\n');
    const cells = [...computeCells(bufferedPoly(points, buf), res, edge)];
    return `# pip install "h3>=4,<5"
# Generated from the current polygon, resolution, buffer, and boundary setting.
import h3

RES = ${res}
BUFFER_METERS = ${buf}
INCLUDE_EDGE = ${edge ? 'True' : 'False'}
coords = [  # (latitude, longitude)
${pts}
]
ZONE_CELLS = set(${JSON.stringify(cells)})

def check_attendance(lat, lng):
    return "Present" if h3.latlng_to_cell(lat, lng, RES) in ZONE_CELLS else "Absent"
`;

  }

  // ---- interactions ----
  function setMode(m) {
    mode = m;
    $('modeDraw').classList.toggle('on', m === 'draw');
    $('modeCrew').classList.toggle('on', m === 'crew');
    $('map').classList.toggle('drawing', m === 'draw');
  }
  $('modeDraw').addEventListener('click', () => setMode('draw'));
  $('modeCrew').addEventListener('click', () => setMode('crew'));

  map.on('click', e => {
    if (mode === 'draw') { points.push([e.latlng.lat, e.latlng.lng]); }
    else { crewMarker.setLatLng(e.latlng); }
    render();
  });
  crewMarker.on('drag', renderLight);
  $('undo').addEventListener('click', () => { points.pop(); render(); });
  $('clear').addEventListener('click', () => { points = []; setMode('draw'); render(); });
  ['res', 'buf', 'edge'].forEach(id => $(id).addEventListener('input', render));
  ['uLat', 'uLng'].forEach(id => $(id).addEventListener('change', () => {
    const lat = Number($('uLat').value), lng = Number($('uLng').value);
    if (!$('uLat').value || !$('uLng').value || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      $('status').textContent = 'Invalid coordinates'; $('status').className = 'idle'; return;
    }
    crewMarker.setLatLng([lat, lng]); render();
  }));
  $('copy').addEventListener('click', () => {
    const t = $('code'); t.select();
    (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.resolve(document.execCommand('copy')))
      .then(() => { $('copy').textContent = 'কপি হয়েছে'; setTimeout(() => $('copy').textContent = 'কোড কপি করুন', 1500); });
  });

  render();
  map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
