/* ==========================================================================
   GATI Velocity Dashboard — shared chart tools
   Used by germany.html, japan.html and index.html (the UK page has its own).
   For every chart listed in a page's settings file (e.g. germany-charts.js) it adds:
     - one plain sentence under the chart title
     - a footer with the source link(s) and two buttons: Image and Data
     - a folded "+ About this data" section with the longer explanation
   It also adds a small "Data last updated" line under the page title.
   The page's own code is not changed: this file only adds to the page.
   ========================================================================== */
(function () {
  const CSS = `
.chart-sub{font-size:12.5px;color:#3B4A50;margin:4px 0 10px;line-height:1.5;}
.chart-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;
  border-top:1px solid #E6ECEE;margin-top:12px;padding-top:10px;}
.chart-src{font-size:11.5px;color:#839097;line-height:1.5;flex:1 1 220px;min-width:0;}
.chart-src a{color:#006B76;font-weight:600;text-decoration:none;}
.chart-src a:hover{text-decoration:underline;}
.dl-row{display:flex;gap:6px;}
.dl-btn{font-family:inherit;font-size:11.5px;font-weight:600;color:#006B76;background:#F2F8F9;
  border:1px solid #D5E6E9;border-radius:6px;padding:5px 10px;cursor:pointer;}
.dl-btn:hover{background:#E3F1F3;}
.chart-more{margin-top:8px;}
.chart-more summary{font-size:11.5px;font-weight:600;color:#006B76;cursor:pointer;list-style:none;}
.chart-more summary::-webkit-details-marker{display:none;}
.chart-more summary::before{content:'+ ';}
.chart-more[open] summary::before{content:'− ';}
.chart-more p{font-size:11.5px;color:#55666C;line-height:1.55;margin-top:6px;}
.section-nav{overflow-x:auto;}
.last-updated{font-size:12px;color:#CFE9EC;opacity:.85;margin-top:6px;}
@media (max-width:600px){ .site-header{height:auto;min-height:68px;padding-top:8px;padding-bottom:8px;} .site-header-title{white-space:normal;font-size:16px;} .site-header-logo{height:38px;} }
`;

  /* Removes "Source: ..." from the end of a note, because the source is now in the footer */
  function stripSource(text) {
    return (text || '').replace(/\s*Sources?:[\s\S]*$/, '').trim();
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function host(url) { return url.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, ''); }
  function today() { return new Date().toISOString().slice(0, 10); }

  let SET = null;   // the page's settings: page name, date, sources, charts

  function srcLinks(keys) {
    return 'Source: ' + (keys || []).filter(k => SET.sources[k]).map(k => {
      const s = SET.sources[k];
      // A source with "tab" opens that tab of this page (e.g. the Data Notes list of sources)
      if (s.tab) return `<a href="#" data-open-tab="${esc(s.tab)}">${esc(s.name)} (list in Data Notes)</a>`;
      return `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`;
    }).join('; ');
  }
  function srcText(keys, short) {
    return 'Source: ' + (keys || []).filter(k => SET.sources[k]).map(k =>
      SET.sources[k].tab ? SET.sources[k].name + ' (see Data Notes on the dashboard)'
        : SET.sources[k].name + ' (' + (short ? host(SET.sources[k].url) : SET.sources[k].url) + ')').join('; ');
  }
  function titleOf(canvas) {
    const card = canvas.closest('.chart-card');
    const h = card && card.querySelector('h3');
    const t = h ? h.textContent.trim() : canvas.id;
    return SET.page && !t.includes(SET.page) ? t + ' — ' + SET.page : t;
  }
  function fileName(canvas, ext) {
    const base = (SET.page ? SET.page + '-' : '') + canvas.id.replace(/^chart-/, '');
    return 'GATI-' + base.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.' + ext;
  }
  function save(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function wrap(ctx, text, maxW) {
    const out = []; let line = '';
    text.split(/\s+/).forEach(w => {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    });
    if (line) out.push(line);
    return out;
  }

  /* Image: title, plain sentence, chart, then source and page link, on white */
  function downloadPNG(canvas) {
    const chart = window.Chart && Chart.getChart(canvas);
    if (!chart) return;
    const meta = SET.charts[canvas.id] || {};
    const src = chart.canvas;
    const k = src.width / (src.clientWidth || src.width);
    const pad = 24 * k, W = src.width + pad * 2, maxW = W - pad * 2;
    const font = (w, px) => `${w} ${px * k}px Poppins, Arial, sans-serif`;
    const credit = 'GATI Foundation · Velocity Dashboard · ' + location.host + location.pathname + ' · downloaded ' + today();
    const m = document.createElement('canvas').getContext('2d');
    const block = (txt, f, lh) => { m.font = f; return { lines: txt ? wrap(m, txt, maxW) : [], f, lh: lh * k }; };
    const top = [block(titleOf(canvas), font(700, 16), 22), block(meta.sub || '', font(400, 12), 17)];
    const bottom = [block(srcText(meta.src, true), font(400, 11), 15), block(credit, font(600, 10.5), 15)];
    const hOf = a => a.reduce((h, b) => h + b.lines.length * b.lh, 0);
    const out = document.createElement('canvas');
    out.width = W; out.height = Math.ceil(pad + hOf(top) + 10 * k + src.height + 14 * k + hOf(bottom) + pad);
    const c = out.getContext('2d');
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, out.height); c.textBaseline = 'top';
    let y = pad;
    const draw = (b, col) => { c.font = b.f; c.fillStyle = col; b.lines.forEach(l => { c.fillText(l, pad, y); y += b.lh; }); };
    draw(top[0], '#00333A'); draw(top[1], '#3B4A50');
    y += 10 * k; c.drawImage(src, pad, y); y += src.height + 14 * k;
    draw(bottom[0], '#55666C'); draw(bottom[1], '#006B76');
    out.toBlob(b => save(b, fileName(canvas, 'png')), 'image/png');
  }

  /* Data: the numbers drawn on the chart, with title and source on top */
  function downloadCSV(canvas) {
    const chart = window.Chart && Chart.getChart(canvas);
    if (!chart) return;
    const meta = SET.charts[canvas.id] || {};
    const q = v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const num = v => {
      if (v !== null && typeof v === 'object') v = (v.y !== undefined ? v.y : v.x);
      if (v === null || v === undefined || v === '' || isNaN(v)) return '';
      v = Number(v); return Number.isInteger(v) ? v : Math.round(v * 100) / 100;
    };
    const ds = chart.data.datasets.filter(d => !d.hidden);
    const rows = [
      [q(titleOf(canvas))], [q(meta.sub || '')], [q(srcText(meta.src))],
      [q('GATI Foundation, Velocity Dashboard: ' + location.href.split('#')[0] + ' (downloaded ' + today() + ')')], [],
      [q(meta.labelHead || 'Period')].concat(ds.map(d => q((d.label || 'Value') + (meta.pct ? ' (%)' : ''))))
    ];
    (chart.data.labels || []).forEach((lab, i) => {
      rows.push([q(Array.isArray(lab) ? lab.join(' ') : lab)].concat(ds.map(d => num(d.data[i]))));
    });
    const csv = '﻿' + rows.map(r => r.join(',')).join('\r\n');
    save(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName(canvas, 'csv'));
  }

  /* Adds sentence, footer and "About this data" to one chart card */
  function decorate(id, meta) {
    const canvas = document.getElementById(id);
    const card = canvas && canvas.closest('.chart-card');
    if (!card || card.dataset.decorated) return;
    card.dataset.decorated = '1';
    const h = card.querySelector('h3');
    if (meta.sub && h) {
      const p = document.createElement('p'); p.className = 'chart-sub'; p.textContent = meta.sub;
      h.insertAdjacentElement('afterend', p);
    }
    const foot = document.createElement('div'); foot.className = 'chart-foot';
    foot.innerHTML = `<div class="chart-src">${srcLinks(meta.src)}</div>
      <div class="dl-row"><button class="dl-btn" type="button" data-kind="png">⬇ Image</button>
      <button class="dl-btn" type="button" data-kind="csv">⬇ Data</button></div>`;
    foot.querySelectorAll('a[data-open-tab]').forEach(a => {
      a.onclick = e => {
        e.preventDefault();
        const t = document.querySelector('.tab-btn[data-tab="' + a.dataset.openTab + '"]');
        if (t) { t.click(); window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 10, behavior: 'smooth' }); }
      };
    });
    foot.querySelectorAll('.dl-btn').forEach(b => {
      b.onclick = () => (b.dataset.kind === 'png' ? downloadPNG : downloadCSV)(canvas);
    });
    card.appendChild(foot);
    const notes = card.querySelectorAll('.chart-note[id]');
    if (meta.about || (SET.moveNotes && notes.length)) {
      const d = document.createElement('details'); d.className = 'chart-more';
      d.innerHTML = '<summary>About this data</summary>';
      // On pages where the grey note is a definition (Germany), it moves inside "About this data"
      if (SET.moveNotes) notes.forEach(n => { n.className = ''; d.appendChild(n); });
      if (meta.about) { const p = document.createElement('p'); p.textContent = meta.about; d.appendChild(p); }
      card.appendChild(d);
    }
    // Notes lose "Source: ..." because the source is in the footer
    notes.forEach(n => {
      const clean = () => { const t = stripSource(n.textContent); if (t !== n.textContent) n.textContent = t; };
      clean();
      new MutationObserver(clean).observe(n, { childList: true, characterData: true, subtree: true });
    });
  }

  function start() {
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    if (SET.updated) {
      const hero = document.querySelector('.hero-text') || document.querySelector('.topbar');
      if (hero && !hero.querySelector('.last-updated')) {
        const p = document.createElement('p'); p.className = 'last-updated';
        p.textContent = 'Data last updated: ' + SET.updated;
        hero.appendChild(p);
      }
    }
    Object.entries(SET.charts).forEach(([id, meta]) => decorate(id, meta));
  }

  /* Called once by the page's settings file */
  window.ChartTools = {
    init(settings) {
      SET = Object.assign({ page: '', updated: '', moveNotes: false, sources: {}, charts: {} }, settings);
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
      else start();
    }
  };
})();
