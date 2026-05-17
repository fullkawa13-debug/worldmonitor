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
  'fx-policy-rates':    { name: '政策金利 (7通貨)',            enabled: true,  priority: 1 },
  'fx-calendar':        { name: 'FX 経済カレンダー',          enabled: true,  priority: 1 },
  'fx-positioning':     { name: 'FX COT ポジション',         enabled: true,  priority: 1 },
  'fx-volatility':      { name: 'FX ボラティリティ＆レンジ',  enabled: true,  priority: 1 },
  'fx-ai-insights':     { name: 'FX AI インサイト',           enabled: true,  priority: 1 },

  // 優先度1: 既存流用パネル
  map:                  { name: 'グローバルマーケットマップ',  enabled: true,  priority: 1 },
  'live-news':          { name: 'FX ヘッドライン',            enabled: true,  priority: 1 },
  forex:                { name: '為替・通貨',                 enabled: true,  priority: 1 },
  centralbanks:         { name: '中央銀行ウォッチ',           enabled: true,  priority: 1 },
  'yield-curve':        { name: 'イールドカーブ',             enabled: true,  priority: 1 },
  'macro-signals':      { name: 'マーケットレーダー',         enabled: true,  priority: 1 },
  economic:             { name: '経済指標',                   enabled: true,  priority: 1 },
  'economic-calendar':  { name: '経済カレンダー',             enabled: true,  priority: 1 },
  'cot-positioning':    { name: 'COT ポジション',            enabled: true,  priority: 1 },

  // 優先度2: 補助パネル
  bonds:                { name: '債券・金利',                 enabled: true,  priority: 2 },
  'fear-greed':         { name: '恐怖＆貪欲指数',            enabled: true,  priority: 2 },
  'market-breadth':     { name: '市場の広がり',              enabled: true,  priority: 2 },
  derivatives:          { name: 'デリバティブ・オプション',   enabled: true,  priority: 2 },
  'markets-news':       { name: 'マーケットニュース',         enabled: true,  priority: 2 },
  'economic-news':      { name: '経済ニュース',              enabled: true,  priority: 2 },
  monitors:             { name: 'マイモニター',              enabled: true,  priority: 2 },
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
