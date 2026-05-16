// FX 7-currency variant — NZD, CHF, GBP, USD, JPY, EUR, CAD focused dashboard
import type { PanelConfig, MapLayers } from '@/types';
import type { VariantConfig } from './base';

export * from './base';
export * from '../finance-geo';

export {
  SOURCE_TIERS,
  getSourceTier,
  SOURCE_TYPES,
  getSourceType,
  getSourcePropagandaRisk,
  type SourceRiskProfile,
  type SourceType,
} from '../feeds';

import type { Feed } from '@/types';
import { rssProxyUrl } from '@/utils';

const rss = rssProxyUrl;

export const FEEDS: Record<string, Feed[]> = {
  forex: [
    { name: 'Forex News', url: rss('https://news.google.com/rss/search?q=("forex"+OR+"currency"+OR+"FX+market")+trading+when:1d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Dollar Watch', url: rss('https://news.google.com/rss/search?q=("dollar+index"+OR+DXY+OR+"US+dollar")+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'NZD News', url: rss('https://news.google.com/rss/search?q=("New+Zealand+dollar"+OR+NZD+OR+RBNZ)+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'CHF News', url: rss('https://news.google.com/rss/search?q=("Swiss+franc"+OR+CHF+OR+SNB)+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'GBP News', url: rss('https://news.google.com/rss/search?q=("British+pound"+OR+GBP+OR+"Bank+of+England")+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'JPY News', url: rss('https://news.google.com/rss/search?q=("Japanese+yen"+OR+JPY+OR+"Bank+of+Japan")+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'EUR News', url: rss('https://news.google.com/rss/search?q=("euro"+OR+EUR+OR+ECB)+monetary+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'CAD News', url: rss('https://news.google.com/rss/search?q=("Canadian+dollar"+OR+CAD+OR+"Bank+of+Canada")+when:3d&hl=en-US&gl=US&ceid=US:en') },
  ],
  centralbanks: [
    { name: 'Federal Reserve', url: rss('https://www.federalreserve.gov/feeds/press_all.xml') },
    { name: 'ECB Watch', url: rss('https://news.google.com/rss/search?q=("European+Central+Bank"+OR+ECB+OR+Lagarde)+monetary+policy+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'BoJ Watch', url: rss('https://news.google.com/rss/search?q=("Bank+of+Japan"+OR+BoJ)+monetary+policy+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'BoE Watch', url: rss('https://news.google.com/rss/search?q=("Bank+of+England"+OR+BoE)+monetary+policy+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'SNB Watch', url: rss('https://news.google.com/rss/search?q=("Swiss+National+Bank"+OR+SNB)+monetary+policy+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'BoC Watch', url: rss('https://news.google.com/rss/search?q=("Bank+of+Canada"+OR+BoC)+monetary+policy+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'RBNZ Watch', url: rss('https://news.google.com/rss/search?q=(RBNZ+OR+"Reserve+Bank+of+New+Zealand")+monetary+when:7d&hl=en-US&gl=US&ceid=US:en') },
  ],
  economic: [
    { name: 'Economic Data', url: rss('https://news.google.com/rss/search?q=(CPI+OR+inflation+OR+GDP+OR+"jobs+report"+OR+PMI)+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Trade & Tariffs', url: rss('https://news.google.com/rss/search?q=(tariff+OR+"trade+war"+OR+"trade+deficit")+when:2d&hl=en-US&gl=US&ceid=US:en') },
  ],
  bonds: [
    { name: 'Bond Market', url: rss('https://news.google.com/rss/search?q=("bond+market"+OR+"treasury+yields"+OR+"yield+curve")+when:2d&hl=en-US&gl=US&ceid=US:en') },
  ],
  analysis: [
    { name: 'FX Analysis', url: rss('https://news.google.com/rss/search?q=("FX+analysis"+OR+"currency+outlook"+OR+"forex+forecast")+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Risk & Volatility', url: rss('https://news.google.com/rss/search?q=(VIX+OR+"implied+volatility"+OR+"currency+volatility")+when:3d&hl=en-US&gl=US&ceid=US:en') },
  ],
};

export const DEFAULT_PANELS: Record<string, PanelConfig> = {
  // 優先度1: FX特化コアパネル
  'fx-policy-rates':    { name: 'Policy Rates (7 CCY)',      enabled: true,  priority: 1 },
  'fx-calendar':        { name: 'FX Economic Calendar',      enabled: true,  priority: 1 },
  'fx-positioning':     { name: 'FX COT Positioning',        enabled: true,  priority: 1 },

  // 優先度1: 既存流用パネル
  map:                  { name: 'Global Markets Map',        enabled: true,  priority: 1 },
  'live-news':          { name: 'FX Headlines',              enabled: true,  priority: 1 },
  forex:                { name: 'Forex & Currencies',        enabled: true,  priority: 1 },
  centralbanks:         { name: 'Central Bank Watch',        enabled: true,  priority: 1 },
  'yield-curve':        { name: 'Yield Curves',              enabled: true,  priority: 1 },
  'macro-signals':      { name: 'Market Radar',              enabled: true,  priority: 1 },
  economic:             { name: 'Economic Data',             enabled: true,  priority: 1 },
  'economic-calendar':  { name: 'Economic Calendar',         enabled: true,  priority: 1 },
  'cot-positioning':    { name: 'COT Positioning',           enabled: true,  priority: 1 },
  'daily-market-brief': { name: 'Daily Market Brief',        enabled: true,  priority: 1 },
  insights:             { name: 'AI Market Insights',        enabled: true,  priority: 1 },

  // 優先度2: 補助パネル
  bonds:                { name: 'Fixed Income',              enabled: true,  priority: 2 },
  'fear-greed':         { name: 'Fear & Greed',              enabled: true,  priority: 2 },
  'market-breadth':     { name: 'Market Breadth',            enabled: true,  priority: 2 },
  derivatives:          { name: 'Derivatives & Options',     enabled: true,  priority: 2 },
  'markets-news':       { name: 'Markets News',              enabled: true,  priority: 2 },
  'economic-news':      { name: 'Economic News',             enabled: true,  priority: 2 },
  monitors:             { name: 'My Monitors',               enabled: true,  priority: 2 },
};

export const DEFAULT_MAP_LAYERS: MapLayers = {
  gpsJamming: false,
  satellites: false,
  conflicts: false,
  bases: false,
  cables: false,
  pipelines: false,
  hotspots: false,
  ais: false,
  nuclear: false,
  irradiators: false,
  sanctions: true,
  weather: false,
  economic: true,
  waterways: false,
  outages: false,
  cyberThreats: false,
  datacenters: false,
  protests: false,
  flights: false,
  military: false,
  natural: false,
  spaceports: false,
  minerals: false,
  fires: false,
  ucdpEvents: false,
  displacement: false,
  climate: false,
  startupHubs: false,
  cloudRegions: false,
  accelerators: false,
  techHQs: false,
  techEvents: false,
  // FX重要レイヤー
  stockExchanges: false,
  financialCenters: true,
  centralBanks: true,
  commodityHubs: false,
  gulfInvestments: false,
  positiveEvents: false,
  kindness: false,
  happiness: false,
  speciesRecovery: false,
  renewableInstallations: false,
  tradeRoutes: true,
  iranAttacks: false,
  ciiChoropleth: false,
  resilienceScore: false,
  dayNight: false,
  miningSites: false,
  processingPlants: false,
  commodityPorts: false,
  webcams: false,
  diseaseOutbreaks: false,
};

export const MOBILE_DEFAULT_MAP_LAYERS: MapLayers = {
  ...DEFAULT_MAP_LAYERS,
  economic: true,
  centralBanks: true,
  financialCenters: false,
  tradeRoutes: false,
};

export const VARIANT_CONFIG: VariantConfig = {
  name: 'fx-7ccy',
  description: 'FX dashboard for NZD, CHF, GBP, USD, JPY, EUR, CAD',
  panels: DEFAULT_PANELS,
  mapLayers: DEFAULT_MAP_LAYERS,
  mobileMapLayers: MOBILE_DEFAULT_MAP_LAYERS,
};
