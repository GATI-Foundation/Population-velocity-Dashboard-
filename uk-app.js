/* ==========================================================================
   GATI United Kingdom Country Dashboard — logic
   Reads DATASETS/UK/uk_data.json (one list per workbook sheet), renders KPIs,
   charts and auto-generated insights. Uses Chart.js 4.x.
   Rows are found by their exact "Metric ID" (e.g. FLOW_IN_ARR), so renaming a
   Metric Name in the workbook is safe; changing a Metric ID is not.
   ========================================================================== */

/* ---- Global data store ---- */
var UK = {
  annual: [],        // Master_Annual: population stock, ONS migration flows
  visaAnnual: [],    // Visa_Annual: Home Office visas by route, calendar year
  visaQuarterly: [], // Master_Quarterly: same visas by quarter
  employment: [],    // Employment: work visas, main applicants and dependants
  healthcare: [],    // Healthcare: OECD/NMC nurse and doctor stocks, NMC joiners, H&CW visas
  eurostat: [],      // Eurostat_Permits: valid residence permits (UK in EU data until 2018)
  nursingRegister: [], // top_nursing_register: NMC top countries of education
  dictionary: [],    // Data_Dictionary
  sources: []        // Sources
};

/* ---- Color palette (same as the Germany page) ---- */
const PALETTE = {
  teal: '#006B76', tealDark: '#00333A', tealLight: '#84D2E2',
  gold: '#E5A812', goldLight: '#FFCC4E', goldDark: '#8C6A1F',
  gray: '#839097', green: '#2E7D32', red: '#C62828',
  blue: '#2979FF', orange: '#E07B54', purple: '#7B6BA1',
  series: ['#006B76','#E5A812','#84D2E2','#00333A','#FFCC4E','#8C6A1F',
           '#839097','#2E8B94','#C98A1D','#4A5A61','#5B9A8B','#D4763E']
};

/* ---- Utilities ---- */
function fmtNum(n) {
  if (n === null || n === undefined) return '—';
  return Math.round(n).toLocaleString('en-US');
}
function fmtPct(n, dp) {
  if (n === null || n === undefined) return '—';
  return n.toFixed(dp === undefined ? 1 : dp) + '%';
}
function fmtPctSigned(n) {
  if (n === null || n === undefined) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}
function calcCAGR(startVal, endVal, years) {
  if (!startVal || startVal <= 0 || !endVal || endVal <= 0 || years <= 0) return null;
  return (Math.pow(endVal / startVal, 1 / years) - 1) * 100;
}
function parseVal(v) {
  if (v === null || v === undefined || v === '' || v === 'N/A') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
/* Financial year label: data stored under the year it ends (2025 -> "2024-25") */
function fyLabel(y) { return (y - 1) + '-' + String(y).slice(2); }

/* ---- Extract year-keyed data from a row: {"2021": 150000, ...} -> {2021: 150000} ---- */
function extractYearData(row) {
  const data = {};
  if (!row) return data;
  for (const key of Object.keys(row)) {
    if (!/^\d{4}$/.test(key)) continue;
    const y = parseInt(key, 10);
    const val = parseVal(row[key]);
    if (val !== null) data[y] = val;
  }
  return data;
}
/* Quarterly columns look like "2024-Q3" */
function extractQuarterData(row) {
  const out = [];
  if (!row) return out;
  for (const key of Object.keys(row)) {
    if (!/^\d{4}-Q[1-4]$/.test(key)) continue;
    const val = parseVal(row[key]);
    if (val !== null) out.push({ label: key, value: val });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}
function yearsOf(data) { return Object.keys(data).map(Number).sort((a, b) => a - b); }

/* ---- Find a row by its exact Metric ID ---- */
function byId(arr, id) {
  return arr.find(r => (r['Metric ID'] || '').trim() === id);
}
function series(arr, id) { return extractYearData(byId(arr, id)); }

/* Share of two year-series, in %, only for years present in both */
function shareSeries(num, den) {
  const out = {};
  for (const y of yearsOf(num)) if (den[y]) out[y] = num[y] / den[y] * 100;
  return out;
}
/* Union of years across several series, optionally limited to a start year */
function unionYears(list, fromYear) {
  const s = new Set();
  list.forEach(d => yearsOf(d).forEach(y => { if (!fromYear || y >= fromYear) s.add(y); }));
  return [...s].sort((a, b) => a - b);
}

/* ================================================================
   DATA PROCESSING
   ================================================================ */
function processUKData(json) {
  UK.annual = json.Master_Annual || [];
  UK.visaAnnual = json.Visa_Annual || [];
  UK.visaQuarterly = json.Master_Quarterly || [];
  UK.employment = json.Employment || [];
  UK.healthcare = json.Healthcare || [];
  UK.eurostat = json.Eurostat_Permits || [];
  UK.nursingRegister = json.top_nursing_register || [];
  UK.dictionary = json.Data_Dictionary || [];
  UK.sources = json.Sources || [];
}

/* ================================================================
   CHART.JS HELPERS
   ================================================================ */
const chartInstances = {};
function baseFont() { return { family: "'Poppins', sans-serif", size: 12 }; }

function renderOrUpdate(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  chartInstances[canvasId] = new Chart(ctx, config);
}
function legendOpts() {
  return { position: 'bottom', labels: { font: baseFont(), usePointStyle: true, boxWidth: 8, padding: 12 } };
}
function tooltipOpts(isPct) {
  return {
    titleFont: baseFont(), bodyFont: baseFont(),
    callbacks: {
      label: c => {
        const v = c.parsed.y !== undefined && c.chart.options.indexAxis !== 'y' ? c.parsed.y : c.parsed.x;
        const pct = isPct || (c.dataset.yAxisID === 'y1');
        return ' ' + c.dataset.label + ': ' + (v === null ? 'n/a' : pct ? fmtPct(v) : fmtNum(v));
      }
    }
  };
}
function lineOpts(yCallback, isPct) {
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: legendOpts(), tooltip: tooltipOpts(isPct) },
    scales: {
      x: { grid: { color: '#EEF2F3' }, ticks: { font: baseFont() } },
      y: { grid: { color: '#EEF2F3' }, ticks: { font: baseFont(), callback: yCallback || (v => fmtNum(v)) }, beginAtZero: true }
    }
  };
}
function barOpts(yCallback, stacked) {
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: legendOpts(), tooltip: tooltipOpts(false) },
    scales: {
      x: { stacked: !!stacked, grid: { color: '#EEF2F3' }, ticks: { font: baseFont() } },
      y: { stacked: !!stacked, grid: { color: '#EEF2F3' }, ticks: { font: baseFont(), callback: yCallback || (v => fmtNum(v)) }, beginAtZero: true }
    }
  };
}
/* Bars on the left axis plus a % line on a right axis */
function comboOpts(stacked) {
  const o = barOpts(null, stacked);
  o.scales.y1 = { position: 'right', grid: { drawOnChartArea: false }, beginAtZero: true,
                  ticks: { font: baseFont(), callback: v => v + '%' } };
  return o;
}
function hBarOpts() {
  return {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: tooltipOpts(false) },
    scales: {
      x: { grid: { color: '#EEF2F3' }, ticks: { font: baseFont(), callback: v => fmtNum(v) }, beginAtZero: true },
      y: { grid: { display: false }, ticks: { font: baseFont() } }
    }
  };
}
function lineDataset(label, years, data, color, extra) {
  return Object.assign({
    label, data: years.map(y => data[y] !== undefined ? data[y] : null),
    borderColor: color, backgroundColor: color + '20', fill: false, tension: 0.3,
    pointRadius: 3.5, pointHoverRadius: 6, borderWidth: 2.5, spanGaps: false
  }, extra || {});
}
function barDataset(label, years, data, color, extra) {
  return Object.assign({
    label, data: years.map(y => data[y] !== undefined ? data[y] : null),
    backgroundColor: color, borderRadius: 4
  }, extra || {});
}
function setNote(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text.replace(/\s*Sources?:[^]*$/, '').trim();
}
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ================================================================
   EXECUTIVE KPI STRIP
   ================================================================ */
/* Fills one exec card: latest Indian value, CAGR over `window` years (or from first year),
   total and share for the same latest year. */
function fillExecCard(key, ind, tot, opts) {
  const yrs = yearsOf(ind).filter(y => tot[y]);
  if (!yrs.length) return;
  const latest = yrs[yrs.length - 1];
  let first = opts.from && ind[opts.from] ? opts.from : yrs[0];
  if (opts.window) {
    const cand = yrs.filter(y => y >= latest - opts.window);
    first = cand[0];
  }
  setText('exec-' + key + '-period', opts.period(latest));
  setText('exec-' + key + '-indian', fmtNum(ind[latest]));
  setText('exec-' + key + '-total', fmtNum(tot[latest]));
  setText('exec-' + key + '-share', fmtPct(ind[latest] / tot[latest] * 100));
  const cagr = calcCAGR(ind[first], ind[latest], latest - first);
  const cagrEl = document.getElementById('exec-' + key + '-cagr');
  if (cagr !== null && cagrEl) {
    cagrEl.textContent = 'CAGR ' + fmtPctSigned(cagr);
    cagrEl.classList.toggle('negative', cagr < 0);
  }
  setText('exec-' + key + '-cagr-period', '(' + first + '–' + latest + ')');
  const b = document.getElementById('exec-' + key + '-basis');
  if (b) b.innerHTML = opts.basis + ' · ' + sourceLinks(opts.src);
}

function renderExecKPIs() {
  fillExecCard('pop', series(UK.annual, 'POP_IN_OECD'), series(UK.annual, 'POP_ALL_OECD'), {
    window: 5, period: y => String(y), src: ['OECD_MIG'],
    basis: 'Survey estimate, rounded. Census 2021 count: 369,000'
  });
  fillExecCard('arr', series(UK.annual, 'FLOW_IN_ARR'), series(UK.annual, 'FLOW_ALL_ARR'), {
    period: y => 'Jan–Dec ' + y,
    src: ['ONS_LTIM'], basis: 'Moved for 12+ months'
  });
  fillExecCard('work', series(UK.employment, 'EMP_IN_MAIN'), series(UK.employment, 'EMP_ALL_MAIN'), {
    from: 2021, period: y => 'Jan–Dec ' + y,
    src: ['HO_VISA'], basis: 'Workers only, family excluded'
  });
  fillExecCard('nurse', series(UK.healthcare, 'HC_NUR_IN'), series(UK.healthcare, 'HC_NUR_FT'), {
    window: 5, period: y => String(y),
    src: ['OECD_HW'], basis: 'By country of training'
  });
}

/* ================================================================
   POPULATION TAB
   ================================================================ */
function renderPopulationCharts() {
  const ind = series(UK.annual, 'POP_IN_OECD');
  const all = series(UK.annual, 'POP_ALL_OECD');
  const yrs = unionYears([ind, all]);
  const latest = yearsOf(ind).pop();

  const callout = document.getElementById('pop-callout');
  if (callout) callout.innerHTML =
    '<b>Read with care:</b> the UK has no population register, so these yearly numbers are a <b>survey estimate</b>. ' +
    'Recent years repeat 370,000 and 2020 is missing, so treat them as approximate. The 2021 Census count (<b>369,000</b> Indian passport holders in England &amp; Wales) agrees closely.';

  setNote('note-uk-indian-stock', 'Indian nationals living in the UK, annual estimate. Gaps mean no figure was published. Source: OECD International Migration Database (UK source: ONS Annual Population Survey).');
  renderOrUpdate('chart-uk-indian-stock', {
    type: 'line',
    data: { labels: yrs.map(String), datasets: [lineDataset('Indian nationals', yrs, ind, PALETTE.teal, { fill: true })] },
    options: lineOpts()
  });

  setNote('note-uk-foreign-stock', 'All non-British nationals living in the UK, same survey and years as the Indian series. Source: OECD International Migration Database.');
  renderOrUpdate('chart-uk-foreign-stock', {
    type: 'line',
    data: { labels: yrs.map(String), datasets: [lineDataset('All foreign nationals', yrs, all, PALETTE.gold, { fill: true })] },
    options: lineOpts()
  });

  const share = shareSeries(ind, all);
  setNote('note-uk-share-stock', "Indian nationals ÷ all foreign nationals × 100, same source and year on both sides. Source: OECD International Migration Database.");
  renderOrUpdate('chart-uk-share-stock', {
    type: 'line',
    data: { labels: yrs.map(String), datasets: [lineDataset("India's share", yrs, share, PALETTE.tealDark)] },
    options: lineOpts(v => v + '%', true)
  });

  // Census: passport vs country of birth
  const pass = series(UK.annual, 'POP_IN_CENSUS');
  const born = series(UK.annual, 'POP_IN_BORN');
  const cy = [2011, 2021];
  setNote('note-uk-census', 'England & Wales only. Passport = Indian nationals. Country of birth also counts people born in India who are now British, so it is much larger; do not compare it with the nationality figures. 2011 passport figure not in the dataset. Source: ONS Census 2021, International migration bulletin.');
  renderOrUpdate('chart-uk-census', {
    type: 'bar',
    data: { labels: cy.map(y => 'Census ' + y), datasets: [
      barDataset('Holds an Indian passport', cy, pass, PALETTE.teal),
      barDataset('Born in India', cy, born, PALETTE.gold)
    ] },
    options: barOpts()
  });

  // Eurostat valid permits (UK reported until it left the EU)
  const eu = desc => extractYearData(UK.eurostat.find(r => (r.Description || '').trim() === desc));
  const inAll = eu('Indian Citizens with Valid Residence Permits (All Reasons)');
  const inEmp = eu('Indian Citizens with Valid Employment Residence Permits');
  const neAll = eu('All Non-EU Citizens with Valid Residence Permits (All Reasons)');
  const neEmp = eu('All Non-EU Citizens with Valid Employment Residence Permits');
  const py = unionYears([inAll, inEmp, neAll, neEmp]);
  setNote('note-uk-permits-indian', 'Indian citizens holding a valid UK residence permit on 31 Dec. Eurostat has no UK figures after 2018 (the UK left the EU in 2020), so this is history, not a current count. Source: Eurostat migr_resvalid.');
  renderOrUpdate('chart-uk-permits-indian', {
    type: 'bar',
    data: { labels: py.map(String), datasets: [
      barDataset('All reasons', py, inAll, PALETTE.teal),
      barDataset('Employment reasons', py, inEmp, PALETTE.gold)
    ] },
    options: barOpts()
  });
  setNote('note-uk-permits-noneu', 'All non-EU citizens holding a valid UK residence permit on 31 Dec, same table as the Indian chart. Source: Eurostat migr_resvalid.');
  renderOrUpdate('chart-uk-permits-noneu', {
    type: 'bar',
    data: { labels: py.map(String), datasets: [
      barDataset('All reasons', py, neAll, PALETTE.tealDark),
      barDataset('Employment reasons', py, neEmp, PALETTE.goldDark)
    ] },
    options: barOpts()
  });
}

/* ================================================================
   MIGRATION FLOWS TAB
   ================================================================ */
function renderMigrationCharts() {
  const flowChart = (canvas, note, arr, dep, net, noteText) => {
    const yrs = unionYears([arr, dep, net]);
    setNote(note, noteText);
    renderOrUpdate(canvas, {
      type: 'bar',
      data: { labels: yrs.map(String), datasets: [
        barDataset('Arrivals', yrs, arr, PALETTE.teal),
        barDataset('Departures', yrs, dep, PALETTE.gold),
        lineDataset('Net migration', yrs, net, PALETTE.green, { type: 'line' })
      ] },
      options: barOpts()
    });
  };
  flowChart('chart-uk-indian-flows', 'note-uk-indian-flows',
    series(UK.annual, 'FLOW_IN_ARR'), series(UK.annual, 'FLOW_IN_DEP'), series(UK.annual, 'FLOW_IN_NET'),
    'Indian nationals moving to or from the UK for 12+ months, year ending December. Net = arrivals − departures. Source: ONS long-term international migration, provisional (21 May 2026), Tables 3e and 3f.');
  flowChart('chart-uk-all-flows', 'note-uk-all-flows',
    series(UK.annual, 'FLOW_ALL_ARR'), series(UK.annual, 'FLOW_ALL_DEP'), series(UK.annual, 'FLOW_ALL_NET'),
    'Everyone moving to or from the UK for 12+ months, including British nationals. Source: ONS long-term international migration, provisional (21 May 2026), Table 1.');

  const work = series(UK.annual, 'FLOW_IN_ARR_WORK');
  const study = series(UK.annual, 'FLOW_IN_ARR_STUDY');
  const other = series(UK.annual, 'FLOW_IN_ARR_OTHER');
  const ry = unionYears([work, study, other]);
  setNote('note-uk-arr-reason', 'Main reason for coming, based on the visa held. Family members are counted under the reason of the person they came with. Other = family, asylum and other. Source: ONS, Table 3e.');
  renderOrUpdate('chart-uk-arr-reason', {
    type: 'bar',
    data: { labels: ry.map(String), datasets: [
      barDataset('Work', ry, work, PALETTE.teal),
      barDataset('Study', ry, study, PALETTE.gold),
      barDataset('Other', ry, other, PALETTE.gray)
    ] },
    options: barOpts(null, true)
  });

  const sArr = shareSeries(series(UK.annual, 'FLOW_IN_ARR'), series(UK.annual, 'FLOW_ALL_ARR'));
  const sDep = shareSeries(series(UK.annual, 'FLOW_IN_DEP'), series(UK.annual, 'FLOW_ALL_DEP'));
  const sy = unionYears([sArr, sDep]);
  setNote('note-uk-flow-share', 'Indian arrivals ÷ all arrivals, and Indian departures ÷ all departures, same ONS release and year. Source: ONS long-term international migration, provisional.');
  renderOrUpdate('chart-uk-flow-share', {
    type: 'line',
    data: { labels: sy.map(String), datasets: [
      lineDataset('Share of arrivals', sy, sArr, PALETTE.teal),
      lineDataset('Share of departures', sy, sDep, PALETTE.gold)
    ] },
    options: lineOpts(v => v + '%', true)
  });
}

/* ================================================================
   VISAS TAB
   ================================================================ */
function renderVisaCharts() {
  const V = id => series(UK.visaAnnual, id);
  const routes = [
    ['Work', 'A_WORK_IN_ALLAPP', PALETTE.teal],
    ['Study', 'A_STUDY_IN_ALLAPP', PALETTE.gold],
    ['Family', 'A_FAMILY_IN_ALLAPP', PALETTE.purple],
    ['Visitor', 'A_VISITOR_IN_ALLAPP', PALETTE.tealLight],
    ['Other', 'A_OTHER_IN_ALLAPP', PALETTE.gray]
  ];
  const rData = routes.map(r => V(r[1]));
  const ry = unionYears(rData);
  setNote('note-uk-visa-routes', 'Entry clearance visas issued to Indian nationals each calendar year, all applicants (workers, students and their family members). Visitor visas are short stays and are not migration. 2020 is low because of COVID-19 travel limits. Source: Home Office immigration statistics, table Vis_D02.');
  renderOrUpdate('chart-uk-visa-routes', {
    type: 'bar',
    data: { labels: ry.map(String), datasets: routes.map((r, i) => barDataset(r[0], ry, rData[i], r[2])) },
    options: barOpts(null, true)
  });

  const apps = V('A_DECISIONS_IN_ALLAPP');
  const issued = V('A_ISSUED_IN_ALLAPP');
  const refused = V('A_REFUSED_IN_ALLAPP');
  const refRate = shareSeries(refused, apps);
  const dy = unionYears([apps, issued], 2015);
  setNote('note-uk-visa-decisions', 'Applications decided, visas issued, and the refusal rate (refused ÷ all decisions). Decisions also include withdrawn and lapsed applications, so issued + refused is a little less than decisions. Source: Home Office, Vis_D02.');
  renderOrUpdate('chart-uk-visa-decisions', {
    type: 'bar',
    data: { labels: dy.map(String), datasets: [
      barDataset('Applications decided', dy, apps, PALETTE.tealLight),
      barDataset('Visas issued', dy, issued, PALETTE.teal),
      lineDataset('Refusal rate (%)', dy, refRate, PALETTE.red, { type: 'line', yAxisID: 'y1' })
    ] },
    options: comboOpts(false)
  });

  const shAll = shareSeries(issued, V('A_ISSUED_ALL_ALLAPP'));
  const shMain = shareSeries(V('A_ISSUED_IN_MAIN'), V('A_ISSUED_ALL_MAIN'));
  const shy = unionYears([shAll, shMain], 2015);
  setNote('note-uk-visa-share', "Visas issued to Indian nationals ÷ visas issued to all nationalities, same table and year. 'Main applicants' leaves out visitors and family members, so it shows India's share of people coming to work or study. Source: Home Office, Vis_D02.");
  renderOrUpdate('chart-uk-visa-share', {
    type: 'line',
    data: { labels: shy.map(String), datasets: [
      lineDataset('All visas (incl. visitors)', shy, shAll, PALETTE.gold),
      lineDataset('Main applicants', shy, shMain, PALETTE.teal)
    ] },
    options: lineOpts(v => v + '%', true)
  });

  const qWork = extractQuarterData(byId(UK.visaQuarterly, 'Q_WORK_IN_MAIN'));
  const qStudy = extractQuarterData(byId(UK.visaQuarterly, 'Q_STUDY_IN_ALLAPP'));
  const start = '2019-Q1';
  const qLabels = [...new Set(qWork.concat(qStudy).map(q => q.label))].filter(l => l >= start).sort();
  const qMap = arr => Object.fromEntries(arr.map(q => [q.label, q.value]));
  const w = qMap(qWork), s = qMap(qStudy);
  setNote('note-uk-visa-quarterly', 'Work visas to the worker (main applicant) and all study visas, by calendar quarter. Study visas peak in Jul–Sep each year, before the academic year. Source: Home Office, Vis_D02.');
  renderOrUpdate('chart-uk-visa-quarterly', {
    type: 'line',
    data: { labels: qLabels, datasets: [
      { label: 'Work (main applicants)', data: qLabels.map(l => w[l] ?? null), borderColor: PALETTE.teal, backgroundColor: PALETTE.teal + '20', tension: 0.25, pointRadius: 2.5, borderWidth: 2.5 },
      { label: 'Study (all applicants)', data: qLabels.map(l => s[l] ?? null), borderColor: PALETTE.gold, backgroundColor: PALETTE.gold + '20', tension: 0.25, pointRadius: 2.5, borderWidth: 2.5 }
    ] },
    options: lineOpts()
  });
}

/* ================================================================
   EMPLOYMENT TAB
   ================================================================ */
function renderEmploymentCharts() {
  const inMain = series(UK.employment, 'EMP_IN_MAIN');
  const allMain = series(UK.employment, 'EMP_ALL_MAIN');
  const yrs = unionYears([inMain, allMain]);

  setNote('note-uk-work-indian', 'Work visas granted to Indian nationals, main applicants only (one per worker). 2020 is low because of COVID-19. Source: Home Office, Vis_D02.');
  renderOrUpdate('chart-uk-work-indian', {
    type: 'line',
    data: { labels: yrs.map(String), datasets: [lineDataset('Indian work visas', yrs, inMain, PALETTE.teal, { fill: true })] },
    options: lineOpts()
  });
  setNote('note-uk-work-all', 'Work visas granted to all nationalities, main applicants. EU citizens needed no UK visa before 2021, so the jump in 2021 partly reflects EU workers entering the visa system. Source: Home Office, Vis_D02.');
  renderOrUpdate('chart-uk-work-all', {
    type: 'line',
    data: { labels: yrs.map(String), datasets: [lineDataset('All work visas', yrs, allMain, PALETTE.gold, { fill: true })] },
    options: lineOpts()
  });

  const shMain = shareSeries(inMain, allMain);
  const shAll = shareSeries(series(UK.employment, 'EMP_IN_ALLAPP'), series(UK.employment, 'EMP_ALL_ALLAPP'));
  setNote('note-uk-work-share', "Indian ÷ all-nationality work visas, same table and year. 'Including family' counts dependants on both sides. Source: Home Office, Vis_D02.");
  renderOrUpdate('chart-uk-work-share', {
    type: 'line',
    data: { labels: yrs.map(String), datasets: [
      lineDataset('Workers only (main applicants)', yrs, shMain, PALETTE.teal),
      lineDataset('Including family members', yrs, shAll, PALETTE.gold)
    ] },
    options: lineOpts(v => v + '%', true)
  });

  const V = id => series(UK.visaAnnual, id);
  const routes = [
    ['Worker route (Skilled, Health & Care, ICT…)', 'A_WORKER_IN_MAIN', PALETTE.teal],
    ['Temporary Worker', 'A_TEMPW_IN_MAIN', PALETTE.gold],
    ['Investor, business & talent', 'A_INVEST_IN_MAIN', PALETTE.purple],
    ['Other work routes', 'A_OTHWORK_IN_MAIN', PALETTE.gray]
  ];
  const rData = routes.map(r => V(r[1]));
  const ry = unionYears(rData, 2015);
  setNote('note-uk-work-routes', 'Indian work visas (main applicants) split by route; the routes add up to the total. The Worker route holds the long-term skilled routes. Source: Home Office, Vis_D02.');
  renderOrUpdate('chart-uk-work-routes', {
    type: 'bar',
    data: { labels: ry.map(String), datasets: routes.map((r, i) => barDataset(r[0], ry, rData[i], r[2])) },
    options: barOpts(null, true)
  });

  const dep = V('A_WORK_IN_DEP');
  const fy = unionYears([inMain, dep], 2015);
  setNote('note-uk-work-family', 'Indian work visas split into the worker (main applicant) and family members who came with them (dependants). Source: Home Office, Vis_D02.');
  renderOrUpdate('chart-uk-work-family', {
    type: 'bar',
    data: { labels: fy.map(String), datasets: [
      barDataset('Workers (main applicants)', fy, inMain, PALETTE.teal),
      barDataset('Family members (dependants)', fy, dep, PALETTE.tealLight)
    ] },
    options: barOpts(null, true)
  });

  const arrWork = series(UK.annual, 'FLOW_IN_ARR_WORK');
  const allApp = series(UK.employment, 'EMP_IN_ALLAPP');
  const ay = unionYears([arrWork]);
  setNote('note-uk-work-arrivals', 'Two ways of counting Indians coming for work. Visas = permission granted that year (workers and families). ONS arrivals = people who actually moved for 12+ months with work as the main reason (also includes families; rounded to thousands). They differ because some visa holders never travel or travel the next year. Sources: Home Office Vis_D02; ONS Table 3e.');
  renderOrUpdate('chart-uk-work-arrivals', {
    type: 'bar',
    data: { labels: ay.map(String), datasets: [
      barDataset('Work visas issued (incl. family)', ay, allApp, PALETTE.gold),
      barDataset('Work-related arrivals (ONS)', ay, arrWork, PALETTE.teal)
    ] },
    options: barOpts()
  });
}

/* ================================================================
   HEALTHCARE TAB
   ================================================================ */
function renderHealthcareCharts() {
  const nIn = series(UK.healthcare, 'HC_NUR_IN'), nFt = series(UK.healthcare, 'HC_NUR_FT');
  const dIn = series(UK.healthcare, 'HC_DOC_IN'), dFt = series(UK.healthcare, 'HC_DOC_FT');
  const jIn = series(UK.healthcare, 'HC_NMC_JOIN_IN'), jAll = series(UK.healthcare, 'HC_NMC_JOIN_INTL');
  const dPct = series(UK.healthcare, 'HC_DOC_FT_PCT');

  // KPI cards
  const nY = yearsOf(nIn).filter(y => nFt[y]).pop();
  if (nY) {
    setText('hk-nurse-year', String(nY));
    setText('hk-nurse-stock', fmtNum(nIn[nY]));
    setText('hk-nurse-share', fmtPct(nIn[nY] / nFt[nY] * 100));
  }
  const jY = yearsOf(jIn).pop();
  if (jY) setText('hk-nurse-join', fmtNum(jIn[jY]) + ' (' + fyLabel(jY) + ')');
  const dY = yearsOf(dIn).filter(y => dFt[y]).pop();
  if (dY) {
    setText('hk-doc-year', String(dY));
    setText('hk-doc-stock', fmtNum(dIn[dY]));
    setText('hk-doc-share', fmtPct(dIn[dY] / dFt[dY] * 100));
    if (dPct[dY] !== undefined) setText('hk-doc-ftpct', fmtPct(dPct[dY] * 100));
  }

  const ny = unionYears([nIn, nFt]);
  setNote('note-uk-nurse-stock', 'Nurses allowed to practise in the UK who qualified abroad, by country of training. Source: OECD Health Workforce Migration database (UK source: NMC register).');
  renderOrUpdate('chart-uk-nurse-stock', {
    type: 'line',
    data: { labels: ny.map(String), datasets: [
      lineDataset('Trained in India', ny, nIn, PALETTE.teal, { fill: true }),
      lineDataset('All foreign-trained', ny, nFt, PALETTE.gold)
    ] },
    options: lineOpts()
  });

  const sN = shareSeries(nIn, nFt), sD = shareSeries(dIn, dFt);
  const sy = unionYears([sN, sD]);
  setNote('note-uk-health-share', 'India-trained ÷ all foreign-trained, for nurses and for doctors, same source and year. Source: OECD Health Workforce Migration database.');
  renderOrUpdate('chart-uk-health-share', {
    type: 'line',
    data: { labels: sy.map(String), datasets: [
      lineDataset('Nurses', sy, sN, PALETTE.teal),
      lineDataset('Doctors', sy, sD, PALETTE.gold)
    ] },
    options: lineOpts(v => v + '%', true)
  });

  const dy = unionYears([dIn, dFt]);
  setNote('note-uk-doc-stock', 'Doctors whose first medical degree (primary medical qualification) is from abroad. Source: OECD Health Workforce Migration database (UK source: GMC register).');
  renderOrUpdate('chart-uk-doc-stock', {
    type: 'line',
    data: { labels: dy.map(String), datasets: [
      lineDataset('Trained in India', dy, dIn, PALETTE.teal, { fill: true }),
      lineDataset('All foreign-trained', dy, dFt, PALETTE.gold)
    ] },
    options: lineOpts()
  });

  const jy = unionYears([jIn, jAll]);
  setNote('note-uk-nmc-joiners', 'Nurses, midwives and nursing associates trained abroad who joined the NMC register for the first time, April to March. Blank bars = not published. Source: NMC annual data reports.');
  renderOrUpdate('chart-uk-nmc-joiners', {
    type: 'bar',
    data: { labels: jy.map(fyLabel), datasets: [
      barDataset('Trained in India', jy, jIn, PALETTE.teal),
      barDataset('All internationally trained', jy, jAll, PALETTE.gold)
    ] },
    options: barOpts()
  });

  const hMain = series(UK.healthcare, 'HC_HCW_IN_MAIN'), hAll = series(UK.healthcare, 'HC_HCW_IN_ALL');
  const hDep = {};
  yearsOf(hAll).forEach(y => { if (hMain[y] !== undefined) hDep[y] = hAll[y] - hMain[y]; });
  const hShare = shareSeries(hMain, series(UK.healthcare, 'HC_HCW_ALL_MAIN'));
  const hy = unionYears([hAll]);
  setNote('note-uk-hcw-visas', 'Health and Care Worker visas to Indian nationals (route opened August 2020). Includes care workers, not only nurses and doctors. The line is India\'s share of main-applicant grants. Source: Home Office, Vis_D02.');
  renderOrUpdate('chart-uk-hcw-visas', {
    type: 'bar',
    data: { labels: hy.map(String), datasets: [
      barDataset('Workers (main applicants)', hy, hMain, PALETTE.teal, { stack: 's' }),
      barDataset('Family members', hy, hDep, PALETTE.tealLight, { stack: 's' }),
      lineDataset("India's share of workers (%)", hy, hShare, PALETTE.red, { type: 'line', yAxisID: 'y1' })
    ] },
    options: comboOpts(true)
  });

  const reg = UK.nursingRegister.slice().sort((a, b) => (b['30 September 2024'] || 0) - (a['30 September 2024'] || 0));
  setNote('note-uk-nursing-rank', 'Nurses and midwives on the NMC register by country of education, 30 September 2024 (top 5 published). Source: NMC register mid-year update, September 2024.');
  renderOrUpdate('chart-uk-nursing-rank', {
    type: 'bar',
    data: { labels: reg.map(r => r.Country), datasets: [{
      label: 'On the register', data: reg.map(r => r['30 September 2024']),
      backgroundColor: reg.map(r => r.Country === 'India' ? PALETTE.gold : PALETTE.teal), borderRadius: 4
    }] },
    options: hBarOpts()
  });
}

/* ================================================================
   KEY INSIGHTS (every number is read from the data)
   ================================================================ */
function peakOf(d) {
  let py = null;
  yearsOf(d).forEach(y => { if (py === null || d[y] > d[py]) py = y; });
  return py;
}
function renderInsights() {
  const grid = document.getElementById('insight-grid');
  if (!grid) return;
  const out = [];

  const arr = series(UK.annual, 'FLOW_IN_ARR'), allArr = series(UK.annual, 'FLOW_ALL_ARR');
  const ay = yearsOf(arr), aL = ay[ay.length - 1];
  if (aL && allArr[aL]) {
    const peak = peakOf(arr);
    const change = (arr[aL] / arr[peak] - 1) * 100;
    out.push({ type: 'highlight', title: 'Indian arrivals',
      body: `<b>${fmtNum(arr[aL])}</b> Indian nationals moved to the UK for the long term in ${aL}, <b>${fmtPct(arr[aL] / allArr[aL] * 100)}</b> of all long-term arrivals. ` +
            (peak !== aL ? `Arrivals peaked at <b>${fmtNum(arr[peak])}</b> in ${peak}; ${aL} is <b>${fmtPctSigned(change)}</b> on that peak.` : `This is the highest year in the series.`) +
            ` <span style="color:var(--gray)">(ONS)</span>` });
  }

  const dep = series(UK.annual, 'FLOW_IN_DEP'), net = series(UK.annual, 'FLOW_IN_NET');
  const dy = yearsOf(dep);
  if (dy.length > 1) {
    const f = dy[0], l = dy[dy.length - 1], np = peakOf(net);
    out.push({ type: '', title: 'More Indians are also leaving',
      body: `Departures of Indian nationals went from <b>${fmtNum(dep[f])}</b> (${f}) to <b>${fmtNum(dep[l])}</b> (${l}). ` +
            `Net migration (arrivals minus departures) was <b>${fmtNum(net[np])}</b> in ${np} and <b>${fmtNum(net[l])}</b> in ${l}. <span style="color:var(--gray)">(ONS)</span>` });
  }

  const wIn = series(UK.employment, 'EMP_IN_MAIN'), wAll = series(UK.employment, 'EMP_ALL_MAIN');
  const wy = yearsOf(wIn), wL = wy[wy.length - 1];
  if (wL && wAll[wL]) {
    const wp = peakOf(wIn);
    out.push({ type: 'gold', title: 'Work visas',
      body: `Work visas granted to Indian workers were <b>${fmtNum(wIn[wL])}</b> in ${wL}` +
            (wp !== wL ? `, down from <b>${fmtNum(wIn[wp])}</b> in ${wp}` : '') +
            `. India still received <b>${fmtPct(wIn[wL] / wAll[wL] * 100)}</b> of all UK work visas in ${wL}. <span style="color:var(--gray)">(Home Office, main applicants)</span>` });
  }

  const hMain = series(UK.healthcare, 'HC_HCW_IN_MAIN');
  const hy = yearsOf(hMain);
  if (hy.length) {
    const hp = peakOf(hMain), hL = hy[hy.length - 1];
    out.push({ type: 'gold', title: 'Health and Care Worker visas',
      body: `Health and Care Worker visas to Indian workers peaked at <b>${fmtNum(hMain[hp])}</b> in ${hp} and were <b>${fmtNum(hMain[hL])}</b> in ${hL}. ` +
            `The fall follows Home Office rule changes: care workers could no longer bring family members from March 2024, and the route closed to new overseas care workers in July 2025. <span style="color:var(--gray)">(Home Office)</span>` });
  }

  const nIn = series(UK.healthcare, 'HC_NUR_IN'), nFt = series(UK.healthcare, 'HC_NUR_FT');
  const ny = yearsOf(nIn).filter(y => nFt[y]);
  if (ny.length) {
    const nL = ny[ny.length - 1], nF = ny.filter(y => y >= nL - 5)[0];
    const jIn = series(UK.healthcare, 'HC_NMC_JOIN_IN'); const jy = yearsOf(jIn);
    let joinTxt = '';
    if (jy.length > 1) {
      const jp = peakOf(jIn), jL = jy[jy.length - 1];
      joinTxt = ` New India-trained joiners to the register fell from <b>${fmtNum(jIn[jp])}</b> (${fyLabel(jp)}) to <b>${fmtNum(jIn[jL])}</b> (${fyLabel(jL)}), so growth is likely to slow.`;
    }
    out.push({ type: 'highlight', title: 'India-trained nurses',
      body: `India-trained nurses on the UK register rose from <b>${fmtNum(nIn[nF])}</b> (${nF}) to <b>${fmtNum(nIn[nL])}</b> (${nL}), <b>${fmtPct(nIn[nL] / nFt[nL] * 100)}</b> of all foreign-trained nurses.` + joinTxt +
            ` <span style="color:var(--gray)">(OECD, NMC)</span>` });
  }

  const dIn = series(UK.healthcare, 'HC_DOC_IN'), dFt = series(UK.healthcare, 'HC_DOC_FT');
  const docY = yearsOf(dIn).filter(y => dFt[y]).pop();
  if (docY) {
    out.push({ type: '', title: 'India-trained doctors',
      body: `<b>${fmtNum(dIn[docY])}</b> doctors registered in the UK in ${docY} qualified in India, <b>${fmtPct(dIn[docY] / dFt[docY] * 100)}</b> of all foreign-trained doctors. <span style="color:var(--gray)">(OECD, from the GMC register)</span>` });
  }

  const pIn = series(UK.annual, 'POP_IN_OECD'), pAll = series(UK.annual, 'POP_ALL_OECD');
  const pL = yearsOf(pIn).filter(y => pAll[y]).pop();
  if (pL) {
    out.push({ type: '', title: 'Indian population',
      body: `About <b>${fmtNum(pIn[pL])}</b> Indian nationals live in the UK (${pL}), <b>${fmtPct(pIn[pL] / pAll[pL] * 100)}</b> of foreign nationals. This is a survey estimate; the 2021 Census counted 369,000 Indian passport holders in England &amp; Wales. Far more people were born in India (920,000), partly because many have become British citizens. <span style="color:var(--gray)">(OECD, ONS Census 2021)</span>` });
  }

  grid.innerHTML = out.map(ins => {
    const cls = ins.type === 'gold' ? ' gold' : ins.type === 'highlight' ? ' highlight' : '';
    return `<div class="insight-card${cls}">
      <div class="insight-title">${ins.title}</div>
      <div class="insight-body">${ins.body}</div>
    </div>`;
  }).join('');
}

/* ================================================================
   DATA NOTES & SOURCES TABLES
   ================================================================ */
function escapeHtml(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function linkify(s) {
  const e = escapeHtml(s);
  return e.replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" target="_blank" rel="noopener">link</a>');
}
function renderNotes() {
  const dict = document.getElementById('dict-table');
  if (dict) {
    const cols = ['Metric Name', 'Plain-language meaning', 'Basis (who is counted)', 'Reference period', 'Source organisation'];
    dict.innerHTML = '<thead><tr>' + cols.map(c => `<th>${escapeHtml(c === 'Metric Name' ? 'Measure' : c)}</th>`).join('') + '</tr></thead><tbody>' +
      UK.dictionary.map(r => '<tr>' + cols.map(c => `<td>${escapeHtml(r[c])}</td>`).join('') + '</tr>').join('') + '</tbody>';
  }
  const src = document.getElementById('sources-table');
  if (src) {
    src.innerHTML = '<thead><tr><th>Topic</th><th>Organisation</th><th>Dataset / publication</th><th>Used for</th><th>Released</th><th>Link</th></tr></thead><tbody>' +
      UK.sources.map(r => `<tr><td>${escapeHtml(r['Block'])}</td><td>${escapeHtml(r['Organisation'])}</td><td>${escapeHtml(r['Dataset / publication'])}</td><td>${escapeHtml(r['What we use'])}</td><td>${escapeHtml(r['Release date'])}</td><td>${linkify(r['URL'])}</td></tr>`).join('') +
      '</tbody>';
  }
}

/* ================================================================
   CHART TEXT, SOURCES & DOWNLOADS
   Every chart card shows: title, one plain sentence (sub), the chart,
   then a footer with the source link(s) and download buttons.
   Longer methodology sits under "About this data".
   ================================================================ */
const SOURCES = {
  ONS_LTIM:   { name: 'ONS, Long-term international migration (provisional, May 2026)', url: 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/datasets/longterminternationalimmigrationemigrationandnetmigrationflowsprovisional' },
  ONS_CENSUS: { name: 'ONS, Census 2021', url: 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/bulletins/internationalmigrationenglandandwales/census2021' },
  OECD_MIG:   { name: 'OECD International Migration Database', url: 'https://data-explorer.oecd.org/vis?df[ds]=DisseminateFinalDMZ&df[id]=DSD_MIG%40DF_MIG&df[ag]=OECD.ELS.IMD' },
  EUROSTAT:   { name: 'Eurostat (migr_resvalid)', url: 'https://ec.europa.eu/eurostat/databrowser/view/migr_resvalid/default/table?lang=en' },
  HO_VISA:    { name: 'Home Office, Immigration system statistics (Vis_D02)', url: 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables' },
  OECD_HW:    { name: 'OECD Health Workforce Migration', url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_HEALTH_WFMI%40DF_HEALTH_WFMI&df[ag]=OECD.ELS.HD' },
  NMC:        { name: 'NMC register data reports', url: 'https://www.nmc.org.uk/globalassets/sitedocuments/data-reports/2026/0184ca-data-report-uk-web.pdf' },
  NMC_SEP24:  { name: 'NMC register mid-year update, Sept 2024', url: 'https://nmc.org.uk/globalassets/sitedocuments/data-reports/2024/september/the-nmc-register-uk-mid-year-update.pdf' }
};

const CHART_META = {
  'indian-stock':   { sub: 'Roughly how many Indian citizens live in the UK each year.', src: ['OECD_MIG'] },
  'foreign-stock':  { sub: 'All non-British citizens living in the UK, for comparison.', src: ['OECD_MIG'] },
  'share-stock':    { sub: 'Out of every 100 foreign citizens in the UK, how many are Indian.', pct: true, src: ['OECD_MIG'] },
  'census':         { sub: 'Two ways of counting: holding an Indian passport, or being born in India.', src: ['ONS_CENSUS'] },
  'permits-indian': { sub: 'Indian citizens holding a valid UK residence permit at the end of each year (up to 2018).', src: ['EUROSTAT'] },
  'permits-noneu':  { sub: 'The same count for all non-EU citizens, for comparison.', src: ['EUROSTAT'] },
  'indian-flows':   { sub: 'Indian citizens moving to, and leaving, the UK for a year or more.', src: ['ONS_LTIM'] },
  'all-flows':      { sub: 'Everyone moving to, and leaving, the UK for a year or more.', src: ['ONS_LTIM'] },
  'arr-reason':     { sub: 'Why Indian citizens came: work, study or other reasons.', src: ['ONS_LTIM'] },
  'flow-share':     { sub: 'Out of every 100 people arriving (or leaving), how many are Indian.', pct: true, src: ['ONS_LTIM'] },
  'visa-routes':    { sub: 'Visas granted to Indian citizens each year, by purpose.', src: ['HO_VISA'] },
  'visa-decisions': { sub: 'How many Indians applied, how many got a visa, and the share refused.', src: ['HO_VISA'] },
  'visa-share':     { sub: 'Out of every 100 UK visas granted, how many went to Indian citizens.', pct: true, src: ['HO_VISA'] },
  'visa-quarterly': { sub: 'Work and study visas to Indian citizens, every three months.', src: ['HO_VISA'] },
  'work-indian':    { sub: 'Work visas granted to Indian workers each year.', src: ['HO_VISA'] },
  'work-all':       { sub: 'Work visas granted to workers of all nationalities, for comparison.', src: ['HO_VISA'] },
  'work-share':     { sub: 'Out of every 100 UK work visas, how many went to Indian citizens.', pct: true, src: ['HO_VISA'] },
  'work-routes':    { sub: 'Which type of work visa Indian workers received.', src: ['HO_VISA'] },
  'work-family':    { sub: 'Indian workers, and the family members who came with them.', src: ['HO_VISA'] },
  'work-arrivals':  { sub: 'Visas granted vs people who actually moved to the UK for work.', src: ['HO_VISA', 'ONS_LTIM'] },
  'nurse-stock':    { sub: 'Nurses in the UK who trained in India, against all nurses trained abroad.', src: ['OECD_HW'] },
  'health-share':   { sub: 'Out of every 100 foreign-trained nurses (or doctors), how many trained in India.', pct: true, src: ['OECD_HW'] },
  'doc-stock':      { sub: 'Doctors in the UK who qualified in India, against all doctors who qualified abroad.', src: ['OECD_HW'] },
  'nmc-joiners':    { sub: 'Nurses trained abroad who registered to work in the UK for the first time, each year.', src: ['NMC'] },
  'hcw-visas':      { sub: "Health and Care Worker visas to Indian citizens, and India's share of them.", src: ['HO_VISA'] },
  'nursing-rank':   { sub: "Countries where the UK's foreign-trained nurses qualified (top 5).", src: ['NMC_SEP24'] }
};

function sourceLinks(keys) {
  return 'Source: ' + (keys || []).map(k => SOURCES[k])
    .map(s => `<a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.name)}</a>`).join('; ');
}
function sourceText(keys) {
  return 'Source: ' + (keys || []).map(k => SOURCES[k].name + ' (' + SOURCES[k].url + ')').join('; ');
}
function applyChartMeta() {
  Object.entries(CHART_META).forEach(([id, m]) => {
    setText('sub-uk-' + id, m.sub);
    const el = document.getElementById('src-uk-' + id);
    if (el) el.innerHTML = sourceLinks(m.src);
  });
}

function chartTitle(id) {
  const card = document.querySelector(`.chart-card[data-chart="${id}"] h3`);
  return card ? card.textContent.trim() : id;
}
function fileName(id, ext) {
  return 'GATI-UK-' + chartTitle(id).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.' + ext;
}
function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
/* Wraps text onto lines no wider than maxW; returns the lines */
function wrapLines(ctx, text, maxW) {
  const words = text.split(' ').flatMap(w => w.length > 60 ? w.match(/.{1,60}/g) : [w]);
  const lines = []; let line = '';
  words.forEach(w => {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  });
  if (line) lines.push(line);
  return lines;
}
/* Image: white background, title, plain sentence, chart, then source and page link */
function downloadPNG(id) {
  const chart = chartInstances['chart-uk-' + id];
  if (!chart) return;
  const src = chart.canvas;
  const k = src.width / (src.clientWidth || src.width);        // device pixel ratio of the drawn chart
  const pad = 24 * k, W = src.width + pad * 2, maxW = W - pad * 2;
  const meta = CHART_META[id] || {};
  const font = (w, px) => `${w} ${px * k}px Poppins, Arial, sans-serif`;
  const host = u => u.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  const srcLine = 'Source: ' + (meta.src || []).map(key => SOURCES[key].name + ' (' + host(SOURCES[key].url) + ')').join('; ');
  const credit = 'GATI Foundation · Velocity Dashboard · ' + location.host + location.pathname + ' · downloaded ' + new Date().toISOString().slice(0, 10);
  const m = document.createElement('canvas').getContext('2d');
  const block = (txt, f, lh) => { m.font = f; return { lines: wrapLines(m, txt, maxW), f, lh: lh * k }; };
  const parts = [block(chartTitle(id) + ' — United Kingdom', font(700, 16), 22), block(meta.sub || '', font(400, 12), 17)];
  const after = [block(srcLine, font(400, 11), 15), block(credit, font(600, 10.5), 15)];
  const hOf = arr => arr.reduce((h, b) => h + b.lines.length * b.lh, 0);
  const H = pad + hOf(parts) + 10 * k + src.height + 14 * k + hOf(after) + pad;
  const out = document.createElement('canvas'); out.width = W; out.height = Math.ceil(H);
  const c = out.getContext('2d');
  c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, out.height);
  c.textBaseline = 'top';
  let y = pad;
  const draw = (b, color) => { c.font = b.f; c.fillStyle = color; b.lines.forEach(l => { c.fillText(l, pad, y); y += b.lh; }); };
  draw(parts[0], PALETTE.tealDark); draw(parts[1], '#3B4A50');
  y += 10 * k; c.drawImage(src, pad, y); y += src.height + 14 * k;
  draw(after[0], '#55666C'); draw(after[1], PALETTE.teal);
  out.toBlob(b => saveBlob(b, fileName(id, 'png')), 'image/png');
}
/* Data: the exact numbers drawn, with title and source on top */
function downloadCSV(id) {
  const chart = chartInstances['chart-uk-' + id];
  if (!chart) return;
  const q = v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
  const ds = chart.data.datasets;
  const rows = [
    [q(chartTitle(id) + ' — United Kingdom')],
    [q((CHART_META[id] || {}).sub || '')],
    [q(sourceText((CHART_META[id] || {}).src))],
    [q('GATI Foundation, Velocity Dashboard: ' + location.href.split('#')[0] + ' (downloaded ' + new Date().toISOString().slice(0, 10) + ')')],
    [],
    [q('Period')].concat(ds.map(d => q(d.label + ((CHART_META[id] || {}).pct || d.yAxisID === 'y1' ? ' (%)' : ''))))
  ];
  chart.data.labels.forEach((lab, i) => {
    rows.push([q(lab)].concat(ds.map(d => {
      const v = d.data[i];
      return v === null || v === undefined ? '' : (Number.isInteger(v) ? v : Math.round(v * 100) / 100);
    })));
  });
  const csv = '﻿' + rows.map(r => r.join(',')).join('\r\n');
  saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName(id, 'csv'));
}
function bindDownloads() {
  document.querySelectorAll('.dl-btn').forEach(btn => {
    btn.onclick = () => (btn.dataset.dl === 'png' ? downloadPNG : downloadCSV)(btn.dataset.chart);
  });
}

/* ================================================================
   INIT & TAB NAVIGATION
   ================================================================ */
function initUKDashboard() {
  const steps = [renderExecKPIs, renderPopulationCharts, renderMigrationCharts, renderVisaCharts,
                 renderEmploymentCharts, renderHealthcareCharts, renderInsights, renderNotes,
                 applyChartMeta, bindDownloads];
  // One failing section should not blank the whole page
  steps.forEach(fn => { try { fn(); } catch (e) { console.error('UK dashboard: ' + fn.name + ' failed', e); } });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      if (panel) panel.classList.add('active');
      // Chart.js needs a visible canvas to size itself
      requestAnimationFrame(() => {
        Object.values(chartInstances).forEach(c => { try { c.resize(); } catch (e) {} });
      });
    };
  });
}
