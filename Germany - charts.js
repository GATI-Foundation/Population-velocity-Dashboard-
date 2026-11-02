/* ==========================================================================
   Germany page — chart text, sources and "last updated" date
   Read by chart-tools.js. Edit the words inside the quotes freely.
   The keys on the left (e.g. 'chart-de-indian-stock') are the chart ids in
   germany.html: do not change them.
   ========================================================================== */
ChartTools.init({
  page: 'Germany',
  updated: '23 Oct 2026',      // change this date whenever you upload new Germany data
  moveNotes: false,            // the grey note under each chart stays where it is now

  sources: {
    DESTATIS_STOCK: { name: 'Destatis, Foreign population by citizenship (Central Register of Foreigners)', url: 'https://www.destatis.de/EN/Themes/Society-Environment/Population/Migration-Integration/Tables/foreigner-citizenship-time-serie.html' },
    DESTATIS_FLOW:  { name: 'Destatis, Migration between Germany and foreign countries (annual)', url: 'https://www.destatis.de/EN/Themes/Society-Environment/Population/Migration/Tables/migration-year-02.html' },
    DESTATIS_MONTH: { name: 'Destatis, Migration between Germany and foreign countries (monthly)', url: 'https://www.destatis.de/EN/Themes/Society-Environment/Population/Migration/Tables/migration-month-02.html' },
    EUROSTAT_VALID: { name: 'Eurostat, Valid residence permits for employment (migr_resvalid)', url: 'https://ec.europa.eu/eurostat/databrowser/view/migr_resvalid/default/table?lang=en' },
    EUROSTAT_FIRST: { name: 'Eurostat, First residence permits for employment (migr_resfirst)', url: 'https://ec.europa.eu/eurostat/databrowser/view/migr_resfirst/default/table?lang=en' },
    BA:             { name: 'Federal Employment Agency (BA), Migration statistics', url: 'https://statistik.arbeitsagentur.de/DE/Navigation/Statistiken/Interaktive-Statistiken/Migration-Zuwanderung-Flucht/Migration-Zuwanderung-Flucht-Nav.html' },
    OECD_HW:        { name: 'OECD Health Workforce Migration', url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_HEALTH_WFMI%40DF_HEALTH_WFMI&df[ag]=OECD.ELS.HD' },
    OECD_HR:        { name: 'OECD Health Statistics, Health workforce', url: 'https://data-explorer.oecd.org/' }
  },

  charts: {
    /* ---- Population ---- */
    'chart-de-indian-stock': { sub: 'How many Indian citizens live in Germany each year.', src: ['DESTATIS_STOCK'],
      about: 'Counts everyone with Indian citizenship registered in Germany on 31 December, for any reason: work, study, family or other.' },
    'chart-de-foreign-stock': { sub: 'All non-German citizens living in Germany, for comparison.', src: ['DESTATIS_STOCK'],
      about: 'Counts everyone without German citizenship registered in Germany on 31 December, from the same register as the Indian chart.' },
    'chart-de-share-stock': { sub: 'Out of every 100 foreign citizens in Germany, how many are Indian.', src: ['DESTATIS_STOCK'], pct: true,
      about: 'Indian citizens divided by all foreign citizens, both from the same Destatis table and date.' },
    'chart-de-euro-permits-indian': { sub: 'Indian citizens holding a valid permit to live in Germany for work.', src: ['EUROSTAT_VALID'],
      about: 'Counts permits valid on 31 December whose reason is employment. Students and family members have other permit types and are not included.' },
    'chart-de-euro-permits-noneu': { sub: 'The same count for all non-EU citizens, for comparison.', src: ['EUROSTAT_VALID'],
      about: 'Counts permits for employment valid on 31 December, held by all citizens of countries outside the EU. EU citizens do not need a permit, so they are not included.' },

    /* ---- Migration flows ---- */
    'chart-de-indian-flows': { sub: 'Indian citizens moving to, and leaving, Germany each year.', src: ['DESTATIS_FLOW'],
      about: 'Net migration is arrivals minus departures. These count moves registered in the year, so one person can be counted more than once.' },
    'chart-de-foreign-flows': { sub: 'All foreign citizens moving to, and leaving, Germany, for comparison.', src: ['DESTATIS_FLOW'],
      about: 'Counts moves of all non-German citizens registered in the year. Net migration is arrivals minus departures.' },
    'chart-de-monthly-indian': { sub: 'Indian arrivals, departures and net migration, month by month.', src: ['DESTATIS_MONTH'],
      about: 'Counts moves of Indian citizens registered in each month. Net migration is arrivals minus departures.' },
    'chart-de-monthly-compare': { sub: 'Monthly net migration: Indian citizens against all foreign citizens.', src: ['DESTATIS_MONTH'],
      about: 'Net migration (arrivals minus departures) each month, for Indian citizens and for all foreign citizens, from the same Destatis table.' },

    /* ---- Employment ---- */
    'chart-de-indian-emp': { sub: 'Indian citizens in work in Germany, counted on 30 June each year.', src: ['BA'],
      about: 'Includes employees paying social security and people in small "mini-jobs" (marginal employment).' },
    'chart-de-foreign-emp': { sub: 'All foreign citizens in work in Germany, for comparison.', src: ['BA'],
      about: 'Counts all foreign citizens in work on 30 June, including employees paying social security and people in mini-jobs (marginal employment).' },
    'chart-de-emp-share': { sub: 'Out of every 100 foreign workers in Germany, how many are Indian.', src: ['BA'], pct: true,
      about: 'Indian employees divided by all foreign employees, both from the same BA table and date.' },
    'chart-de-indian-breakdown': { sub: 'Indian citizens in Germany by job status: employed, job-seeking, unemployed, receiving benefits.', src: ['BA'],
      about: 'Each bar is a separate BA count on 30 June. One person can appear in more than one bar, for example as both a job seeker and a benefit recipient, so the bars do not add up to a total.' },
    'chart-de-euro-permits-flow': { sub: 'New permits to live in Germany for work, given for the first time each year.', src: ['EUROSTAT_FIRST'],
      about: 'The all non-EU bars are divided by 10 so both fit on one scale. The downloaded data uses the same divided numbers.' },

    /* ---- Healthcare ---- */
    'chart-de-phys-stock': { sub: 'Doctors working in Germany who trained in India.', src: ['OECD_HW'],
      about: 'Counted by country of training, not citizenship.' },
    'chart-de-nurse-inflow': { sub: 'Nurses trained in India newly recognised to work in Germany each year.', src: ['OECD_HW'],
      about: 'Counts nurses whose Indian training was newly recognised in Germany that year, not border arrivals. Counted by country of training, not citizenship.' },
    'chart-de-phys-inflow': { sub: 'Doctors trained in India newly recognised to work in Germany each year.', src: ['OECD_HW'],
      about: 'Counts doctors whose Indian medical degree was newly recognised in Germany that year, not border arrivals. Counted by country of training, not citizenship.' },
    'chart-de-nursing-rank': { sub: 'Top 10 foreign nationalities working in hospital nursing in Germany.', src: ['BA'], labelHead: 'Nationality',
      about: 'Counted by citizenship (Indian passport), not by country of training, on 30 June 2023. Includes everyone working in hospital nursing jobs.' },
    'chart-de-nurses-total': { sub: 'All nurses working in Germany, for scale.', src: ['OECD_HR'],
      about: 'All practising nurses in Germany, whatever their nationality or country of training.' },
    'chart-de-phys-total': { sub: 'All doctors working in Germany, for scale.', src: ['OECD_HR'],
      about: 'All practising doctors in Germany, whatever their nationality or country of training.' }
  }
});
