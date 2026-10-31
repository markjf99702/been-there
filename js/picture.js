// "Save a picture": your map drawn onto a canvas, with the count, sized for a phone screen or a post.
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export async function picture(kind, data) {
  await document.fonts.ready;
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const col = {
    paper: css('--paper'), card: css('--card'), ink: css('--ink'), ink2: css('--ink-2'), land: css('--land'), edge: css('--edge'),
    sea: css('--sea'), lived: css('--lived'), visited: css('--visited'), passed: css('--passed'), want: css('--want'), wantBg: css('--want-bg'),
  };
  g.fillStyle = col.paper; g.fillRect(0, 0, W, H);

  // The pin and the name, top left.
  g.save(); g.translate(72, 74); g.scale(1.6, 1.6);
  g.fillStyle = col.lived; g.fill(new Path2D('M12 1C6 1 1.5 5.5 1.5 11.4 1.5 19 12 31 12 31s10.5-12 10.5-19.6C22.5 5.5 18 1 12 1z'));
  g.fillStyle = col.paper; g.beginPath(); g.arc(12, 11.2, 4, 0, 7); g.fill();
  g.restore();
  g.fillStyle = col.ink; g.font = '600 46px Fraunces, Georgia, serif'; g.textBaseline = 'alphabetic';
  g.fillText('Been There', 128, 118);
  const who = data.name ? `${data.name}’s map` : '';
  if (who) { g.fillStyle = col.ink2; g.font = '400 30px "Public Sans", system-ui, sans-serif'; g.fillText(who, 130, 160); }

  // The count.
  const d = data[kind];
  const big = String(d.been);
  const noun = kind === 'us' ? (d.been === 1 ? 'state' : 'states') : (d.been === 1 ? 'country' : 'countries');
  g.fillStyle = col.ink; g.font = '700 220px Fraunces, Georgia, serif';
  g.fillText(big, 66, 440);
  const bw = g.measureText(big).width;
  g.font = '600 64px Fraunces, Georgia, serif';
  g.fillText(noun, 66 + bw + 24, 360);
  g.fillStyle = col.ink2; g.font = '400 34px "Public Sans", system-ui, sans-serif';
  g.fillText(kind === 'us' ? `of 50 · ${d.pct}% of the country by area` : `of 195 · ${d.continents} of 7 continents`, 66 + bw + 26, 424);

  // The map.
  const geo = d.geo;
  const shapes = kind === 'us' ? geo.states : geo.places;
  const box = { x: 54, y: 510, w: W - 108, h: kind === 'us' ? 640 : 560 };
  const s = Math.min(box.w / geo.w, box.h / geo.h);
  const ox = box.x + (box.w - geo.w * s) / 2, oy = box.y + (box.h - geo.h * s) / 2;
  const hatch = document.createElement('canvas');
  hatch.width = hatch.height = 12;
  const hg = hatch.getContext('2d');
  hg.fillStyle = col.wantBg; hg.fillRect(0, 0, 12, 12);
  hg.strokeStyle = col.want; hg.lineWidth = 3.4;
  for (const o of [-12, 0, 12]) { hg.beginPath(); hg.moveTo(o, 12); hg.lineTo(o + 12, 0); hg.stroke(); }
  const fillFor = st => st === 'want' ? g.createPattern(hatch, 'repeat') : st ? col[st] : col.land;
  g.save(); g.translate(ox, oy); g.scale(s, s);
  if (kind === 'world') {
    g.fillStyle = col.sea; g.fill(new Path2D(geo.sphere));
    if (geo.other) { g.fillStyle = col.land; g.fill(new Path2D(geo.other)); }
  }
  g.lineJoin = 'round';
  for (const [code, sh] of Object.entries(shapes)) {
    if (!sh.d) continue;
    const p = new Path2D(sh.d);
    const st = d.marks[code];
    g.fillStyle = fillFor(st);
    g.fill(p);
    g.strokeStyle = col.edge; g.lineWidth = (kind === 'us' ? 1.3 : 0.9) / s * 1.4;
    g.stroke(p);
  }
  if (kind === 'world') {
    for (const [code, sh] of Object.entries(shapes)) {
      if (!sh.tiny || !d.marks[code]) continue;
      g.beginPath(); g.arc(sh.x, sh.y, 4 / s, 0, 7);
      g.fillStyle = fillFor(d.marks[code]); g.fill();
      g.strokeStyle = col.edge; g.stroke();
    }
  }
  if (d.boxes) {
    for (const [code, x, y] of d.boxes) {
      g.beginPath(); g.roundRect(x, y, 36, 20, 4);
      g.fillStyle = fillFor(d.marks[code]); g.fill();
      g.strokeStyle = col.edge; g.stroke();
      g.fillStyle = ['lived', 'visited'].includes(d.marks[code]) ? col.paper : col.ink2;
      g.font = '600 11px "Public Sans", sans-serif'; g.textAlign = 'center';
      g.fillText(code, x + 18, y + 14.5);
    }
  }
  g.restore();

  // The key and the address.
  const keys = [['lived', 'Lived'], ['visited', 'Visited'], ['passed', 'Passed through'], ['want', 'Want to go']];
  let x = 66;
  const y = H - 92;
  g.textAlign = 'left'; g.font = '600 28px "Public Sans", system-ui, sans-serif';
  for (const [st, label] of keys) {
    g.beginPath(); g.arc(x + 14, y - 9, 14, 0, 7); g.fillStyle = fillFor(st); g.fill();
    g.strokeStyle = col.edge; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = col.ink; g.fillText(label, x + 36, y);
    x += 36 + g.measureText(label).width + 34;
  }
  g.fillStyle = col.ink2; g.font = '400 26px "Public Sans", system-ui, sans-serif';
  g.fillText('been-there.junkdrawer.works', 66, H - 40);
  return c;
}

export async function savePicture(kind, data) {
  const c = await picture(kind, data);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], kind === 'us' ? 'been-there-states.png' : 'been-there-world.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ files: [file], title: 'Been There' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
