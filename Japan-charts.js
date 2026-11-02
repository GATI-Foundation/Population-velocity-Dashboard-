/* ==========================================================================
   Japan page — chart text, sources and "last updated" date
   Read by chart-tools.js. Edit the words inside the quotes freely.
   The keys on the left (e.g. 'chart-jp-indian-trend') are the chart ids in
   japan.html: do not change them.
   ========================================================================== */
ChartTools.init({
  page: 'Japan',
  updated: '23 Oct 2026',      // change this date whenever you upload new Japan data

  sources: {
    ISA:      { name: 'Immigration Services Agency of Japan, Statistics on Foreign Residents', url: 'https://www.e-stat.go.jp/en/statistics/00250012' },
    ISA_CALC: { name: 'Calculated from Immigration Services Agency of Japan, Statistics on Foreign Residents', url: 'https://www.e-stat.go.jp/en/statistics/00250012' }
  },

  charts: {
    /* ---- Population ---- */
    'chart-jp-indian-trend': { sub: 'How many Indian citizens live in Japan, counted each June.', src: ['ISA'],
      about: 'Mid- to long-term residents and special permanent residents with Indian citizenship, as of end of June, for any reason: work, study, family or other.' },
    'chart-jp-foreign-trend': { sub: 'All foreign citizens living in Japan, for comparison.', src: ['ISA'],
      about: 'Mid- to long-term residents and special permanent residents of all foreign nationalities, as of end of June, from the same table as the Indian chart.' },
    'chart-jp-share-trend': { sub: 'Out of every 100 foreign residents in Japan, how many are Indian.', src: ['ISA_CALC'], pct: true,
      about: 'Indian residents divided by all foreign residents, both from the same table and date.' },
    'chart-jp-top-categories': { sub: 'The residence statuses Indian citizens hold most often.', src: ['ISA'], labelHead: 'Residence status',
      about: 'Each person in Japan holds one residence status, such as Engineer/Specialist, Dependent or Student. The bars show the largest ones for Indian citizens.' },

    /* ---- Employment ---- */
    'chart-jp-distribution': { sub: 'How Indian citizens holding a work-related residence status are split across those statuses.', src: ['ISA_CALC'], labelHead: 'Residence status',
      about: 'Only residence statuses granted for work are included. A residence status is permission to work, not a job count. Permanent residents, family members and students can also work in Japan but are not in this chart.' },
    'chart-jp-cagr-rank': { sub: 'Which work-related residence statuses grew fastest for Indian citizens.', src: ['ISA_CALC'], pct: true, labelHead: 'Residence status',
      about: 'CAGR is the steady yearly growth rate that takes the first year\'s count to the last year\'s count. A status that started from a very small count can show a very high rate, so read it next to the counts.' },
    'chart-jp-share-cats': { sub: 'Out of every 100 foreign residents holding each work-related status, how many are Indian.', src: ['ISA_CALC'], pct: true, labelHead: 'Residence status',
      about: 'For each work-related residence status: Indian holders divided by all foreign holders of that status, same table and date.' },
    'chart-jp-emp-trend': { sub: 'The five largest work-related residence statuses for Indian citizens, year by year.', src: ['ISA'],
      about: 'The five statuses with the most Indian holders in the latest year, followed back to earlier years.' },

    /* ---- Healthcare ---- */
    'chart-jp-health-indian': { sub: 'Indian citizens holding the Medical Services or Nursing Care residence status.', src: ['ISA'],
      about: 'Counts two residence statuses: Medical Services (licensed doctors, nurses and other health professionals) and Nursing Care (certified care workers). Other care workers, such as Specified Skilled Workers in nursing care, are not included.' },
    'chart-jp-health-foreign': { sub: 'All foreign citizens holding the same two residence statuses, for comparison.', src: ['ISA'],
      about: 'All foreign holders of the Medical Services and Nursing Care residence statuses, as of end of June. Other care workers, such as Specified Skilled Workers in nursing care, are not included.' }
  }
});
