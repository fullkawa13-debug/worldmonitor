#!/usr/bin/env node
// FX ボラティリティシード
// CBOE EVZ（EUR/USD インプライドボラ）+ ECBデータから実現ボラを計算し
// 7通貨ペアの日次・週次の想定レンジを算出して Redis に保存する

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const FX_VOL_KEY = 'market:fx-vol:v1';
const FX_VOL_TTL = 7200; // 2時間

// Yahoo Finance から取得する CBOE FX VIX シンボル
const CBOE_SYMBOLS = [
  { symbol: '^EVZ',   pair: 'EURUSD', label: 'EUR/USD' },
  { symbol: '^JYVIX', pair: 'USDJPY', label: 'USD/JPY' },
  { symbol: '^BPVIX', pair: 'GBPUSD', label: 'GBP/USD' },
];

// ECBデータ（frankfurter.app）で計算する通貨ペア
// base=USD → rates.XXX = USD1あたりのXXX
const FX_PAIRS = [
  { pair: 'EURUSD', label: 'EUR/USD', ccy: 'EUR', quoteInverted: true  }, // 1/rates.EUR
  { pair: 'GBPUSD', label: 'GBP/USD', ccy: 'GBP', quoteInverted: true  },
  { pair: 'USDJPY', label: 'USD/JPY', ccy: 'JPY', quoteInverted: false },
  { pair: 'USDCHF', label: 'USD/CHF', ccy: 'CHF', quoteInverted: false },
  { pair: 'USDCAD', label: 'USD/CAD', ccy: 'CAD', quoteInverted: false },
  { pair: 'NZDUSD', label: 'NZD/USD', ccy: 'NZD', quoteInverted: true  },
];

async function fetchCboeVix(symbol) {
  const encoded = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=5d`;
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const result = data?.chart?.result?.[0];
    const price = result?.meta?.regularMarketPrice;
    return typeof price === 'number' ? price : null;
  } catch {
    return null;
  }
}

// ECB（frankfurter.app）から過去30日のUSDベースレートを取得
async function fetchEcbRates() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 45); // バッファ多めに45日
  const fmt = d => d.toISOString().slice(0, 10);
  const symbols = FX_PAIRS.map(p => p.ccy).join(',');
  const url = `https://api.frankfurter.app/${fmt(start)}..${fmt(today)}?base=USD&symbols=${symbols}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) throw new Error(`Frankfurter HTTP ${resp.status}`);
  const data = await resp.json();
  return data.rates; // { "2026-05-01": { EUR: 0.925, ... }, ... }
}

function calcRealizedVol(ratesByDate, ccy, inverted) {
  const dates = Object.keys(ratesByDate).sort();
  const values = dates.map(d => {
    const v = ratesByDate[d]?.[ccy];
    if (!v) return null;
    return inverted ? 1 / v : v;
  }).filter(v => v != null);
  if (values.length < 5) return null;
  const last30 = values.slice(-31); // 最大30日
  const returns = [];
  for (let i = 1; i < last30.length; i++) {
    returns.push(Math.log(last30[i] / last30[i - 1]));
  }
  if (returns.length < 4) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const annualizedVol = Math.sqrt(variance * 252) * 100;
  return parseFloat(annualizedVol.toFixed(2));
}

function calcRanges(spot, volPct) {
  if (!spot || !volPct) return { dailyRange: null, weeklyRange: null, dailyPct: null, weeklyPct: null };
  const vol = volPct / 100;
  const daily  = spot * vol / Math.sqrt(252);
  const weekly = spot * vol / Math.sqrt(52);
  return {
    dailyRange:  parseFloat(daily.toFixed(spot > 10 ? 2 : 4)),
    weeklyRange: parseFloat(weekly.toFixed(spot > 10 ? 2 : 4)),
    dailyPct:   parseFloat((daily  / spot * 100).toFixed(2)),
    weeklyPct:  parseFloat((weekly / spot * 100).toFixed(2)),
  };
}

async function fetchFxVolData() {
  // 1. CBOE VIX（インプライドボラ）を並列取得
  const cboeResults = await Promise.allSettled(
    CBOE_SYMBOLS.map(async s => ({ ...s, iv: await fetchCboeVix(s.symbol) }))
  );
  const cboeMap = {};
  for (const r of cboeResults) {
    if (r.status === 'fulfilled' && r.value.iv != null) {
      cboeMap[r.value.pair] = r.value.iv;
      console.log(`  CBOE ${r.value.label}: IV=${r.value.iv.toFixed(2)}%`);
    }
  }

  // 2. ECBデータから実現ボラを計算
  let ratesByDate = {};
  try {
    ratesByDate = await fetchEcbRates();
    console.log(`  ECB rates: ${Object.keys(ratesByDate).length} 日分取得`);
  } catch (e) {
    console.warn(`  ECB rates fetch failed: ${e.message}`);
  }

  const latestDate = Object.keys(ratesByDate).sort().at(-1) ?? '';
  const latestRates = ratesByDate[latestDate] ?? {};

  const pairs = FX_PAIRS.map(p => {
    const spotRaw = latestRates[p.ccy];
    const spot = spotRaw ? (p.quoteInverted ? 1 / spotRaw : spotRaw) : null;
    const rv30d = calcRealizedVol(ratesByDate, p.ccy, p.quoteInverted);
    const iv    = cboeMap[p.pair] ?? null;
    const vol   = iv ?? rv30d; // IVがあればIVを優先
    const ranges = calcRanges(spot, vol);
    const volSource = iv != null ? 'CBOE-IV' : 'ECB-RV30d';

    console.log(`  ${p.label}: spot=${spot?.toFixed(p.ccy === 'JPY' ? 2 : 4) ?? 'N/A'} vol=${vol?.toFixed(2) ?? 'N/A'}%(${volSource}) daily±${ranges.dailyRange ?? 'N/A'}`);

    return {
      pair:       p.pair,
      label:      p.label,
      spot:       spot != null ? parseFloat(spot.toFixed(p.ccy === 'JPY' ? 3 : 5)) : null,
      impliedVol: iv,
      realizedVol30d: rv30d,
      volUsed:    vol,
      volSource,
      ...ranges,
      rateDate: latestDate,
    };
  });

  return { pairs, updatedAt: new Date().toISOString() };
}

export function declareRecords(data) {
  return Array.isArray(data?.pairs) ? data.pairs.length : 0;
}

if (process.argv[1]?.endsWith('seed-fx-vol.mjs')) {
  runSeed('market', 'fx-vol', FX_VOL_KEY, fetchFxVolData, {
    ttlSeconds: FX_VOL_TTL,
    validateFn: data => Array.isArray(data?.pairs) && data.pairs.length > 0,
    recordCount: data => data?.pairs?.length ?? 0,
    declareRecords,
    sourceVersion: 'cboe-ecb-v1',
    schemaVersion: 1,
    maxStaleMin: 180,
  }).catch(err => { console.error('FATAL:', err.message || err); process.exit(1); });
}
