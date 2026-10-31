// An SVG map that can be pinched, dragged and tapped. The shapes come in as path strings; colors are set by CSS
// from each shape's data-s attribute, so marking a state is one attribute change.
const NS = 'http://www.w3.org/2000/svg';
export const el = (name, attrs = {}, parent) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};

export class MapView {
  // opts: { w, h, kind, shapes: {code: {d, x, y, tiny}}, boxes: [[code, x, y]], labels: bool, maxZoom,
  //         onTap(code), label(code) for titles, before(g) to draw under the shapes }
  constructor(host, opts) {
    this.o = opts;
    this.k = 1; this.tx = 0; this.ty = 0;
    this.svg = el('svg', { viewBox: `0 0 ${opts.w} ${opts.h}`, class: `map map-${opts.kind}`, role: 'img', 'aria-label': opts.title || 'Map' });
    const defs = el('defs', {}, this.svg);
    // "Want to go" is hatched, like a planned road on an old map.
    const pat = el('pattern', { id: `hatch-${opts.kind}`, width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: 5, height: 5, class: 'hatch-bg' }, pat);
    el('rect', { width: 2, height: 5, class: 'hatch-fg' }, pat);
    this.pattern = pat;
    this.g = el('g', { class: 'zoom' }, this.svg);
    if (opts.before) opts.before(this.g);
    this.shapes = new Map();
    const land = el('g', { class: 'land' }, this.g);
    for (const [code, s] of Object.entries(opts.shapes)) {
      if (!s.d) continue;
      const p = el('path', { d: s.d, 'data-code': code, class: 'shape' }, land);
      if (opts.label) el('title', {}, p).textContent = opts.label(code);
      this.shapes.set(code, [p]);
    }
    // Places too small to tap get a dot on top, kept the same size on screen at every zoom.
    this.dots = el('g', { class: 'dots' }, this.g);
    for (const [code, s] of Object.entries(opts.shapes)) {
      if (!s.tiny) continue;
      const c = el('circle', { cx: s.x, cy: s.y, r: 3, 'data-code': code, class: 'shape dot' }, this.dots);
      if (opts.label) el('title', {}, c).textContent = opts.label(code);
      (this.shapes.get(code) || this.shapes.set(code, []).get(code)).push(c);
    }
    if (opts.labels) {
      this.labels = el('g', { class: 'labels', 'aria-hidden': 'true' }, this.g);
      const boxed = new Set((opts.boxes || []).map(b => b[0]));
      for (const [code, s] of Object.entries(opts.shapes)) {
        if (boxed.has(code)) continue;
        el('text', { x: s.x, y: s.y, class: 'lbl', 'data-for': code }, this.labels).textContent = code;
      }
    }
    // Small states as labelled boxes out in the ocean, as election maps do.
    if (opts.boxes) {
      const bx = el('g', { class: 'boxes' }, this.svg);
      for (const [code, x, y] of opts.boxes) {
        const g = el('g', { class: 'box', transform: `translate(${x} ${y})` }, bx);
        const r = el('rect', { width: 36, height: 20, rx: 4, 'data-code': code, class: 'shape' }, g);
        if (opts.label) el('title', {}, r).textContent = opts.label(code);
        el('text', { x: 18, y: 14.5, class: 'box-lbl', 'data-for': code }, g).textContent = code;
        (this.shapes.get(code) || this.shapes.set(code, []).get(code)).push(r);
      }
    }
    this.overlay = el('g', { class: 'overlay' }, this.g);
    host.appendChild(this.svg);
    this.#gestures();
    this.#apply();
  }

  // Sets each shape's status (data-s) from fn(code).
  paint(fn) {
    for (const [code, nodes] of this.shapes) {
      const s = fn(code);
      for (const n of nodes) { if (s) n.setAttribute('data-s', s); else n.removeAttribute('data-s'); }
    }
    if (this.labels) for (const t of this.labels.children) {
      const s = fn(t.getAttribute('data-for'));
      if (s) t.setAttribute('data-s', s); else t.removeAttribute('data-s');
    }
    for (const t of this.svg.querySelectorAll('.box-lbl')) {
      const s = fn(t.getAttribute('data-for'));
      if (s) t.setAttribute('data-s', s); else t.removeAttribute('data-s');
    }
  }

  // Fills shapes with explicit colors (for the word maps), fn(code) -> CSS color or null.
  fill(fn) {
    for (const [code, nodes] of this.shapes) for (const n of nodes) n.style.fill = fn(code) || '';
  }

  select(code) {
    for (const [c, nodes] of this.shapes) for (const n of nodes) n.classList.toggle('sel', c === code);
    // The selected shape is drawn last, so its outline isn't hidden under its neighbours'.
    const nodes = this.shapes.get(code);
    if (nodes) for (const n of nodes) if (!n.closest('.box')) n.parentNode.appendChild(n);
  }

  // Draws a route through the shapes' centres: numbered stops joined by a dashed road.
  route(stops) {
    this.overlay.replaceChildren();
    if (!stops || !stops.length) return;
    const pts = stops.map(c => this.o.shapes[c]).filter(Boolean);
    el('polyline', { points: pts.map(p => `${p.x},${p.y}`).join(' '), class: 'road' }, this.overlay);
    stops.forEach((c, i) => {
      const p = this.o.shapes[c];
      const g = el('g', { class: i === 0 && this.o.routeFromFirst ? 'stop from' : 'stop', transform: `translate(${p.x} ${p.y})` }, this.overlay);
      el('circle', { r: 9 }, g);
      el('text', { y: 3.6 }, g).textContent = i === 0 && this.o.routeFromFirst ? '★' : String(this.o.routeFromFirst ? i : i + 1);
    });
    this.#apply();
  }

  zoomBy(f, cx = this.o.w / 2, cy = this.o.h / 2) {
    const k = Math.min(this.o.maxZoom || 8, Math.max(1, this.k * f));
    const px = (cx - this.tx) / this.k, py = (cy - this.ty) / this.k;
    this.k = k; this.tx = cx - px * k; this.ty = cy - py * k;
    this.#apply();
  }
  reset() { this.k = 1; this.tx = 0; this.ty = 0; this.#apply(); }
  // Zooms to show a shape, for a place picked from the list.
  focus(code, k = 4) {
    const s = this.o.shapes[code];
    if (!s) return;
    this.k = Math.min(this.o.maxZoom || 8, Math.max(this.k, k));
    this.tx = this.o.w / 2 - s.x * this.k; this.ty = this.o.h / 2 - s.y * this.k;
    this.#apply();
  }

  #apply() {
    const { w, h } = this.o;
    this.tx = Math.min(0, Math.max(w - w * this.k, this.tx));
    this.ty = Math.min(0, Math.max(h - h * this.k, this.ty));
    this.g.setAttribute('transform', `translate(${this.tx} ${this.ty}) scale(${this.k})`);
    this.svg.style.setProperty('--k', this.k);
    this.svg.style.touchAction = this.k > 1.01 ? 'none' : 'pan-y';
    this.svg.classList.toggle('zoomed', this.k > 1.01);
    this.pattern.setAttribute('patternTransform', `rotate(45) scale(${1 / this.k})`);
    const r = 2.6 / this.k + 0.5;
    for (const c of this.dots.children) c.setAttribute('r', r);
    for (const c of this.overlay.querySelectorAll('.stop')) {
      const p = c.getAttribute('transform').replace(/ scale\([^)]*\)/, '');
      c.setAttribute('transform', `${p} scale(${1 / Math.sqrt(this.k)})`);
    }
    this.onZoom?.(this.k);
  }

  // Map units per CSS pixel, from the drawn size.
  #unit() { const r = this.svg.getBoundingClientRect(); return { s: this.o.w / r.width, r }; }

  #gestures() {
    const pts = new Map();
    let start = null; // { k, tx, ty, x, y, d, moved, multi }
    const svg = this.svg;
    const snapshot = () => {
      const { s, r } = this.#unit();
      const list = [...pts.values()];
      const mx = list.reduce((a, p) => a + p.x, 0) / list.length, my = list.reduce((a, p) => a + p.y, 0) / list.length;
      const d = list.length > 1 ? Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y) : 0;
      return { s, r, mx, my, d };
    };
    const begin = () => {
      const { mx, my, d } = snapshot();
      start = { k: this.k, tx: this.tx, ty: this.ty, mx, my, d, moved: start?.moved || 0, multi: start?.multi || pts.size > 1, t: start?.t || Date.now() };
    };
    svg.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) start = null;
      begin();
      if (pts.size > 1 || this.k > 1.01) svg.setPointerCapture?.(e.pointerId);
    });
    svg.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId) || !start) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const { s, r, mx, my, d } = snapshot();
      start.moved = Math.max(start.moved, Math.hypot(mx - start.mx, my - start.my));
      if (pts.size > 1 && start.d) {
        const k = Math.min(this.o.maxZoom || 8, Math.max(1, start.k * d / start.d));
        const ox = (start.mx - r.left) * s, oy = (start.my - r.top) * s;
        const px = (ox - start.tx) / start.k, py = (oy - start.ty) / start.k;
        this.k = k;
        this.tx = (mx - r.left) * s - px * k; this.ty = (my - r.top) * s - py * k;
        this.#apply();
      } else if (this.k > 1.01) {
        this.tx = start.tx + (mx - start.mx) * s; this.ty = start.ty + (my - start.my) * s;
        this.#apply();
      }
    });
    const end = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (e.type === 'pointerup' && pts.size === 0 && start && !start.multi && start.moved < 8 && Date.now() - start.t < 800) {
        const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-code]');
        if (hit && this.svg.contains(hit)) this.o.onTap?.(hit.getAttribute('data-code'));
      }
      if (pts.size) begin(); else start = null;
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', e => {
      if (!e.ctrlKey && this.k <= 1.01) return; // let the page scroll past an unzoomed map
      e.preventDefault();
      const { s, r } = this.#unit();
      this.zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), (e.clientX - r.left) * s, (e.clientY - r.top) * s);
    }, { passive: false });
  }
}
