#!/usr/bin/env node
// ローカルキャッシュ専用シード — Redis不要。公開APIからデータを取得してローカルJSONに保存する。
// 用途: Redis無料枠切れ時やオフライン開発時のフォールバック

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', 'data', 'seed-cache');
mkdirSync(CACHE_DIR, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';

function saveCache(key, data) {
  const filename = key.replace(/[:/]/g, '_') + '.json';
  writeFileSync(join(CACHE_DIR, filename), JSON.stringify(data));
  console.log(`  ✓ ${key} → ${filename}`);
}

// --- FX Volatility (CBOE + ECB) ---
async function seedFxVol() {
  console.log('\n[1/5] FX Volatility...');
  const CBOE = [
    { symbol: '^EVZ', pair: 'EURUSD', label: 'EUR/USD' },
    { symbol: '^JYVIX', pair: 'USDJPY', label: 'USD/JPY' },
    { symbol: '^BPVIX', pair: 'GBPUSD', label: 'GBP/USD' },
  ];
  const FX = [
    { pair: 'EURUSD', label: 'EUR/USD', ccy: 'EUR', inv: true },
    { pair: 'GBPUSD', label: 'GBP/USD', ccy: 'GBP', inv: true },
    { pair: 'USDJPY', label: 'USD/JPY', ccy: 'JPY', inv: false },
    { pair: 'USDCHF', label: 'USD/CHF', ccy: 'CHF', inv: false },
    { pair: 'USDCAD', label: 'USD/CAD', ccy: 'CAD', inv: false },
    { pair: 'NZDUSD', label: 'NZD/USD', ccy: 'NZD', inv: true },
  ];

  const cboeMap = {};
  for (const s of CBOE) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.symbol)}?interval=1d&range=5d`;
      const resp = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
      if (resp.ok) {
        const d = await resp.json();
        const p = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (typeof p === 'number') { cboeMap[s.pair] = p; console.log(`  CBOE ${s.label}: IV=${p.toFixed(2)}%`); }
      }
    } catch {}
  }

  const today = new Date();
  const start = new Date(today); start.setDate(start.getDate() - 45);
  const fmt = d => d.toISOString().slice(0, 10);
  const symbols = FX.map(p => p.ccy).join(',');
  const ecbResp = await fetch(`https://api.frankfurter.app/${fmt(start)}..${fmt(today)}?base=USD&symbols=${symbols}`, {
    headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000),
  });
  const ecbData = await ecbResp.json();
  const ratesByDate = ecbData.rates;
  const latestDate = Object.keys(ratesByDate).sort().at(-1);
  const latestRates = ratesByDate[latestDate] ?? {};

  const pairs = FX.map(p => {
    const spotRaw = latestRates[p.ccy];
    const spot = spotRaw ? (p.inv ? 1 / spotRaw : spotRaw) : null;
    const dates = Object.keys(ratesByDate).sort();
    const values = dates.map(d => { const v = ratesByDate[d]?.[p.ccy]; return v ? (p.inv ? 1 / v : v) : null; }).filter(v => v != null);
    let rv = null;
    if (values.length >= 5) {
      const last30 = values.slice(-31);
      const returns = [];
      for (let i = 1; i < last30.length; i++) returns.push(Math.log(last30[i] / last30[i - 1]));
      if (returns.length >= 4) {
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
        rv = parseFloat((Math.sqrt(variance * 252) * 100).toFixed(2));
      }
    }
    const iv = cboeMap[p.pair] ?? null;
    const vol = iv ?? rv;
    const volSource = iv != null ? 'CBOE-IV' : 'ECB-RV30d';
    let dailyRange = null, weeklyRange = null;
    if (spot && vol) {
      const v = vol / 100;
      dailyRange = parseFloat((spot * v / Math.sqrt(252)).toFixed(spot > 10 ? 2 : 4));
      weeklyRange = parseFloat((spot * v / Math.sqrt(52)).toFixed(spot > 10 ? 2 : 4));
    }
    console.log(`  ${p.label}: spot=${spot?.toFixed(4)} vol=${vol?.toFixed(2)}%(${volSource})`);
    return { pair: p.pair, label: p.label, spot: spot ? parseFloat(spot.toFixed(p.ccy === 'JPY' ? 3 : 5)) : null, impliedVol: iv, realizedVol30d: rv, volUsed: vol, volSource, dailyRange, weeklyRange, rateDate: latestDate };
  });
  saveCache('market:fx-vol:v1', { pairs, updatedAt: new Date().toISOString() });
}

// --- COT Positioning (CFTC TFF Report) ---
async function seedCot() {
  console.log('\n[2/5] COT Positioning...');
  try {
    const toNum = v => { const n = parseInt(String(v ?? '').replace(/,/g, ''), 10); return Number.isNaN(n) ? 0 : n; };

    const INSTRUMENTS = [
      { name: 'EUR/USD',           code: 'EC', pattern: /EURO FX - CHICAGO/i },
      { name: 'USD/JPY',           code: 'JY', pattern: /JAPANESE YEN - CHICAGO/i },
      { name: 'GBP/USD',           code: 'BP', pattern: /BRITISH POUND/i },
      { name: 'USD/CHF',           code: 'SF', pattern: /SWISS FRANC/i },
      { name: 'USD/CAD',           code: 'CD', pattern: /CANADIAN DOLLAR/i },
      { name: 'NZD/USD',           code: 'NE', pattern: /NEW ZEALAND/i },
      { name: 'S&P 500 E-Mini',    code: 'ES', pattern: /E-MINI S&P 500 - CHICAGO/i },
      { name: 'Nasdaq 100 E-Mini', code: 'NQ', pattern: /^NASDAQ MINI - CHICAGO/i },
      { name: '10-Year T-Note',    code: 'ZN', pattern: /^UST 10Y NOTE - CHICAGO/i },
      { name: 'Gold',              code: 'GC', pattern: /GOLD/i },
      { name: 'Silver',            code: 'SI', pattern: /SILVER/i },
      { name: 'Crude Oil (WTI)',   code: 'CL', pattern: /CRUDE OIL.*LIGHT/i },
    ];

    // TFF Report (yw9f-hn96) — Combined, with asset_mgr fields
    const url = 'https://publicreporting.cftc.gov/resource/yw9f-hn96.json'
      + '?$limit=400&$order=report_date_as_yyyy_mm_dd%20DESC&$where=futonly_or_combined%3D%27Combined%27';
    const resp = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
    if (!resp.ok) { console.log('  CFTC API failed, skipping'); return; }
    const rows = await resp.json();

    const instruments = [];
    let latestReportDate = '';

    for (const target of INSTRUMENTS) {
      const matches = rows.filter(r => target.pattern.test(r.market_and_exchange_names ?? ''));
      const current = matches[0];
      const prior = matches[1];
      if (!current) continue;

      const reportDate = current.report_date_as_yyyy_mm_dd?.slice(0, 10) ?? '';
      if (!latestReportDate) latestReportDate = reportDate;
      const oi = toNum(current.open_interest_all);
      const amLong = toNum(current.asset_mgr_positions_long);
      const amShort = toNum(current.asset_mgr_positions_short);
      const dlrLong = toNum(current.dealer_positions_long_all);
      const dlrShort = toNum(current.dealer_positions_short_all);
      const levLong = toNum(current.lev_money_positions_long);
      const levShort = toNum(current.lev_money_positions_short);
      const gross = Math.max(amLong + amShort, 1);
      const netPct = parseFloat((((amLong - amShort) / gross) * 100).toFixed(2));
      const oiSharePct = oi > 0 ? parseFloat((((amLong + amShort) / oi) * 100).toFixed(2)) : 0;

      const priorAmLong = prior ? toNum(prior.asset_mgr_positions_long) : amLong;
      const priorAmShort = prior ? toNum(prior.asset_mgr_positions_short) : amShort;
      const wowNetDelta = (amLong - amShort) - (priorAmLong - priorAmShort);

      const dlrGross = Math.max(dlrLong + dlrShort, 1);
      const dlrNetPct = parseFloat((((dlrLong - dlrShort) / dlrGross) * 100).toFixed(2));
      const dlrOiSharePct = oi > 0 ? parseFloat((((dlrLong + dlrShort) / oi) * 100).toFixed(2)) : 0;
      const priorDlrLong = prior ? toNum(prior.dealer_positions_long_all) : dlrLong;
      const priorDlrShort = prior ? toNum(prior.dealer_positions_short_all) : dlrShort;
      const dlrWowDelta = (dlrLong - dlrShort) - (priorDlrLong - priorDlrShort);

      instruments.push({
        name: target.name, code: target.code, reportDate,
        openInterest: oi, assetManagerLong: amLong, assetManagerShort: amShort,
        leveragedFundsLong: levLong, leveragedFundsShort: levShort,
        dealerLong: dlrLong, dealerShort: dlrShort,
        netPct,
        managedMoney: { longPositions: amLong, shortPositions: amShort, netPct, oiSharePct, wowNetDelta },
        producerSwap: { longPositions: dlrLong, shortPositions: dlrShort, netPct: dlrNetPct, oiSharePct: dlrOiSharePct, wowNetDelta: dlrWowDelta },
      });
      console.log(`  ${target.code}: AM net ${netPct}% (L:${amLong} S:${amShort})`);
    }

    console.log(`  ${instruments.length} instruments from ${latestReportDate}`);
    saveCache('market:cot:v1', { instruments, reportDate: latestReportDate });
  } catch (e) { console.log(`  COT failed: ${e.message}`); }
}

// --- BIS Policy Rates ---
async function seedBisRates() {
  console.log('\n[3/5] BIS Policy Rates...');
  try {
    const COUNTRIES = 'US+XM+GB+JP+CA+CH';
    const url = `https://stats.bis.org/api/v1/data/WS_CBPOL/M.${COUNTRIES}?format=csv`;
    const resp = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/csv' }, signal: AbortSignal.timeout(30000) });
    if (!resp.ok) { console.log(`  BIS HTTP ${resp.status}, skipping`); return; }
    const csv = await resp.text();
    const lines = csv.split('\n').filter(l => l.trim());
    if (lines.length < 2) { console.log('  BIS: no data'); return; }

    // BIS CSVは引用符内にカンマを含むため専用パーサーが必要
    function parseCSVLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
        else { current += ch; }
      }
      result.push(current.trim());
      return result;
    }

    const header = parseCSVLine(lines[0]);
    const refAreaIdx = header.indexOf('REF_AREA');
    const periodIdx = header.indexOf('TIME_PERIOD');
    const valueIdx = header.indexOf('OBS_VALUE');

    const rates = {};
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const country = cols[refAreaIdx];
      const period = cols[periodIdx];
      const value = parseFloat(cols[valueIdx]);
      if (!country || !period || isNaN(value)) continue;
      if (!rates[country]) rates[country] = [];
      rates[country].push({ period, value });
    }

    for (const c of Object.keys(rates)) {
      rates[c].sort((a, b) => b.period.localeCompare(a.period));
    }

    const BIS_COUNTRIES = {
      US: { name: 'United States', centralBank: 'Federal Reserve' },
      XM: { name: 'Euro Area', centralBank: 'ECB' },
      GB: { name: 'United Kingdom', centralBank: 'Bank of England' },
      JP: { name: 'Japan', centralBank: 'Bank of Japan' },
      CA: { name: 'Canada', centralBank: 'Bank of Canada' },
      CH: { name: 'Switzerland', centralBank: 'Swiss National Bank' },
    };
    const policyRates = [];
    for (const [code, info] of Object.entries(BIS_COUNTRIES)) {
      const obs = rates[code];
      if (!obs || obs.length === 0) continue;
      const latest = obs[0];
      const previous = obs.length >= 2 ? obs[1] : undefined;
      policyRates.push({
        countryCode: code, countryName: info.name,
        rate: latest.value, previousRate: previous?.value ?? latest.value,
        date: latest.period, centralBank: info.centralBank,
      });
      console.log(`  ${code}: ${latest.value}% (${latest.period})`);
    }
    saveCache('economic:bis:policy:v1', { rates: policyRates });
  } catch (e) { console.log(`  BIS failed: ${e.message}`); }
}

// --- Economic Calendar ---
async function seedCalendar() {
  console.log('\n[4/5] Economic Calendar...');
  const events = [];
  // FOMC dates (hardcoded — updated annually)
  const fomcDates = [
    { event: 'FOMC Rate Decision', country: 'US', date: '2026-06-17', impact: 'high', actual: '', estimate: '', previous: '', unit: '%' },
    { event: 'FOMC Rate Decision', country: 'US', date: '2026-07-29', impact: 'high', actual: '', estimate: '', previous: '', unit: '%' },
    { event: 'FOMC Rate Decision', country: 'US', date: '2026-09-16', impact: 'high', actual: '', estimate: '', previous: '', unit: '%' },
    { event: 'FOMC Rate Decision', country: 'US', date: '2026-11-04', impact: 'high', actual: '', estimate: '', previous: '', unit: '%' },
    { event: 'FOMC Rate Decision', country: 'US', date: '2026-12-16', impact: 'high', actual: '', estimate: '', previous: '', unit: '%' },
  ];
  const ecbDates = [
    { event: 'ECB Rate Decision', country: 'EU', date: '2026-06-05', impact: 'high', actual: '', estimate: '', previous: '', unit: '%' },
    { event: 'ECB Rate Decision', country: 'EU', date: '2026-07-17', impact: 'high', actual: '', estimate: '', previous: '', unit: '%' },
    { event: 'ECB Rate Decision', country: 'EU', date: '2026-09-11', impact: 'high', actual: '', estimate: '', previous: '', unit: '%' },
    { event: 'ECB Rate Decision', country: 'EU', date: '2026-10-23', impact: 'high', actual: '', estimate: '', previous: '', unit: '%' },
    { event: 'ECB Rate Decision', country: 'EU', date: '2026-12-11', impact: 'high', actual: '', estimate: '', previous: '', unit: '%' },
  ];
  events.push(...fomcDates, ...ecbDates);
  events.sort((a, b) => a.date.localeCompare(b.date));
  const fromDate = events[0]?.date ?? '';
  const toDate = events[events.length - 1]?.date ?? '';
  console.log(`  ${events.length} events`);
  saveCache('economic:econ-calendar:v1', { events, fromDate, toDate, total: events.length, unavailable: false });
}

// --- Macro Signals (simplified) ---
async function seedMacroSignals() {
  console.log('\n[5/5] Macro Signals (simplified)...');
  try {
    // VIX
    let vix = null;
    try {
      const resp = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=30d', {
        headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const d = await resp.json();
        vix = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
        console.log(`  VIX: ${vix?.toFixed(2)}`);
      }
    } catch {}

    // QQQ sparkline
    let qqqSparkline = [];
    try {
      const resp = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/QQQ?interval=1d&range=30d', {
        headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const d = await resp.json();
        qqqSparkline = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(v => v != null) ?? [];
      }
    } catch {}

    const vixScore = vix ? (vix < 15 ? 'BULLISH' : vix < 20 ? 'NEUTRAL' : vix < 30 ? 'BEARISH' : 'EXTREME_BEARISH') : 'UNKNOWN';
    const result = {
      timestamp: new Date().toISOString(),
      verdict: vixScore === 'BULLISH' ? 'BULLISH' : vixScore === 'NEUTRAL' ? 'NEUTRAL' : 'BEARISH',
      bullishCount: vixScore === 'BULLISH' ? 5 : vixScore === 'NEUTRAL' ? 3 : 1,
      totalCount: 7,
      signals: {
        liquidity: { status: vixScore, sparkline: [] },
        flowStructure: { status: 'NEUTRAL' },
        macroRegime: { status: 'NEUTRAL' },
        technicalTrend: { status: 'NEUTRAL', sparkline: qqqSparkline.slice(-20) },
        hashRate: { status: 'UNKNOWN' },
        priceMomentum: { status: vixScore === 'BULLISH' ? 'BULLISH' : 'NEUTRAL' },
        fearGreed: { status: vixScore, history: [] },
      },
      meta: { qqqSparkline: qqqSparkline.slice(-20) },
      unavailable: false,
    };
    console.log(`  Verdict: ${result.verdict} (${result.bullishCount}/${result.totalCount})`);
    saveCache('economic:macro-signals:v1', result);
  } catch (e) { console.log(`  Macro signals failed: ${e.message}`); }
}

// --- 実行 ---
console.log('=== ローカルキャッシュシード（Redis不要） ===');
console.log(`Output: ${CACHE_DIR}`);
try {
  await seedFxVol();
  await seedCot();
  await seedBisRates();
  await seedCalendar();
  await seedMacroSignals();
  console.log('\n=== 完了 ===');
} catch (e) {
  console.error('Fatal:', e);
  process.exit(1);
}
