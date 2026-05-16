import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';

interface CotInstrumentEnhanced {
  name: string;
  code: string;
  reportDate: string;
  netPct: number;
  managedMoney: { netPct: number; wowNetDelta: number; longPositions: number; shortPositions: number };
  leveragedFundsLong: number;
  leveragedFundsShort: number;
  assetManagerLong: number;
  assetManagerShort: number;
  percentile52w?: number;
  hi52w?: number;
  lo52w?: number;
  crowded?: 'extreme_long' | 'long' | 'neutral' | 'short' | 'extreme_short';
}

const FX_INSTRUMENTS: Array<{ codes: string[]; label: string; flag: string; keywords: string[] }> = [
  { codes: ['EC'], label: 'EUR', flag: '🇪🇺', keywords: ['EURO FX', 'EURO'] },
  { codes: ['JY'], label: 'JPY', flag: '🇯🇵', keywords: ['JAPANESE YEN'] },
  { codes: ['BP'], label: 'GBP', flag: '🇬🇧', keywords: ['BRITISH POUND', 'STERLING'] },
  { codes: ['SF'], label: 'CHF', flag: '🇨🇭', keywords: ['SWISS FRANC'] },
  { codes: ['CD'], label: 'CAD', flag: '🇨🇦', keywords: ['CANADIAN DOLLAR'] },
  { codes: ['NE'], label: 'NZD', flag: '🇳🇿', keywords: ['NEW ZEALAND'] },
];

const CROWDED_META: Record<string, { label: string; color: string; bg: string }> = {
  extreme_long:  { label: '極大買越',    color: '#e74c3c', bg: 'rgba(231,76,60,0.15)' },
  long:          { label: '買越',        color: '#e67e22', bg: 'rgba(230,126,34,0.12)' },
  neutral:       { label: 'ニュートラル', color: 'rgba(255,255,255,0.35)', bg: 'transparent' },
  short:         { label: '売越',        color: '#3498db', bg: 'rgba(52,152,219,0.12)' },
  extreme_short: { label: '極大売越',    color: '#2980b9', bg: 'rgba(41,128,185,0.15)' },
};

function matchCurrency(inst: CotInstrumentEnhanced): typeof FX_INSTRUMENTS[0] | undefined {
  const up = inst.name.toUpperCase();
  return FX_INSTRUMENTS.find(fx => fx.codes.includes(inst.code) || fx.keywords.some(k => up.includes(k)));
}

function renderPercentileBar(pct: number, crowded: string): string {
  const meta = (CROWDED_META[crowded] ?? CROWDED_META['neutral'])!;
  const left = Math.min(Math.max(pct, 0), 100);
  return `
    <div style="margin-top:6px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
        <span style="font-size:9px;color:rgba(255,255,255,0.3)">52週折り込み度</span>
        <span style="font-size:9px;font-weight:700;color:${meta.color};background:${meta.bg};padding:1px 5px;border-radius:2px">${escapeHtml(meta.label)}</span>
        <span style="margin-left:auto;font-size:9px;color:rgba(255,255,255,0.45)">${pct}%</span>
      </div>
      <div style="position:relative;height:5px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden">
        <div style="position:absolute;top:0;bottom:0;left:0;width:35%;background:rgba(41,128,185,0.2)"></div>
        <div style="position:absolute;top:0;bottom:0;right:0;width:35%;background:rgba(231,76,60,0.2)"></div>
        <div style="position:absolute;top:50%;transform:translateY(-50%);left:calc(${left}% - 3px);width:6px;height:6px;border-radius:50%;background:${meta.color}"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:1px;font-size:8px;color:rgba(255,255,255,0.2)">
        <span>売極端</span><span>中立</span><span>買極端</span>
      </div>
    </div>`;
}

function renderNetBar(netPct: number): string {
  const c = Math.max(-100, Math.min(100, netPct));
  const hw = Math.abs(c) / 100 * 50;
  const color = c >= 0 ? '#2ecc71' : '#e74c3c';
  const left  = c >= 0 ? 50 : 50 - hw;
  return `
    <div style="position:relative;height:7px;background:rgba(255,255,255,0.06);border-radius:2px;margin:4px 0 2px">
      <div style="position:absolute;top:0;bottom:0;left:50%;width:1px;background:rgba(255,255,255,0.1)"></div>
      <div style="position:absolute;top:0;bottom:0;left:${left.toFixed(1)}%;width:${hw.toFixed(1)}%;background:${color};border-radius:1px;opacity:0.85"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,0.3)">
      <span>売</span>
      <span style="color:${color};font-weight:700">${c >= 0 ? '+' : ''}${netPct.toFixed(1)}%</span>
      <span>買</span>
    </div>`;
}

function renderCard(inst: CotInstrumentEnhanced, fx: typeof FX_INSTRUMENTS[0]): string {
  const mm    = inst.managedMoney ?? { netPct: inst.netPct, wowNetDelta: 0, longPositions: inst.assetManagerLong ?? 0, shortPositions: inst.assetManagerShort ?? 0 };
  const wow   = mm.wowNetDelta ?? 0;
  const wowColor = wow > 0 ? '#2ecc71' : wow < 0 ? '#e74c3c' : 'rgba(255,255,255,0.3)';
  const lfl   = inst.leveragedFundsLong ?? 0;
  const lfs   = inst.leveragedFundsShort ?? 0;
  const lfNet = ((lfl - lfs) / Math.max(lfl + lfs, 1) * 100).toFixed(1);
  const pctBar = (inst.percentile52w != null && inst.crowded) ? renderPercentileBar(inst.percentile52w, inst.crowded) : '';

  return `
    <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="font-size:15px">${fx.flag}</span>
        <span style="font-size:13px;font-weight:700">${escapeHtml(fx.label)}</span>
        <span style="font-size:10px;color:rgba(255,255,255,0.25);flex:1">${escapeHtml(inst.name)}</span>
        <span style="font-size:10px;color:${wowColor}">${wow >= 0 ? '+' : ''}${wow.toLocaleString()} WoW</span>
      </div>
      <div style="font-size:9px;color:rgba(255,255,255,0.35);margin-bottom:2px">Asset Manager net</div>
      ${renderNetBar(mm.netPct)}
      <div style="font-size:9px;color:rgba(255,255,255,0.3);margin-top:3px">LF net: ${lfNet}%　date: ${escapeHtml(inst.reportDate)}</div>
      ${pctBar}
    </div>`;
}

function renderDetailTable(instruments: Array<CotInstrumentEnhanced & { fx?: typeof FX_INSTRUMENTS[0] }>): string {
  const rows = instruments.map(inst => {
    if (!inst.fx) return '';
    const mm   = inst.managedMoney ?? { longPositions: 0, shortPositions: 0, netPct: inst.netPct };
    const amNet = ((mm.longPositions - mm.shortPositions) / Math.max(mm.longPositions + mm.shortPositions, 1) * 100).toFixed(1);
    const lfl  = inst.leveragedFundsLong ?? 0;
    const lfs  = inst.leveragedFundsShort ?? 0;
    const lfNet = ((lfl - lfs) / Math.max(lfl + lfs, 1) * 100).toFixed(1);
    const ac = parseFloat(amNet) >= 0 ? '#2ecc71' : '#e74c3c';
    const lc = parseFloat(lfNet) >= 0 ? '#2ecc71' : '#e74c3c';
    const pctLabel = inst.percentile52w != null ? `${inst.percentile52w}%` : '—';
    const crowdMeta = inst.crowded ? (CROWDED_META[inst.crowded] ?? CROWDED_META['neutral'] ?? null) : null;
    return `<tr>
      <td style="padding:4px 6px;font-size:11px">${inst.fx.flag} ${escapeHtml(inst.fx.label)}</td>
      <td style="padding:4px 6px;text-align:right;color:${ac};font-weight:600;font-size:11px">${amNet}%</td>
      <td style="padding:4px 6px;text-align:right;color:${lc};font-size:11px">${lfNet}%</td>
      <td style="padding:4px 6px;text-align:right;font-size:10px;color:${crowdMeta?.color ?? 'rgba(255,255,255,0.35)'}">
        ${pctLabel}${crowdMeta ? ` <span style="font-size:8px">${escapeHtml(crowdMeta.label)}</span>` : ''}
      </td>
    </tr>`;
  }).join('');
  return `<div style="padding:0 14px 10px;overflow-x:auto">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="font-size:9px;color:rgba(255,255,255,0.25)">
        <th style="padding:3px 6px;text-align:left">通貨</th>
        <th style="padding:3px 6px;text-align:right">AM net</th>
        <th style="padding:3px 6px;text-align:right">LF net</th>
        <th style="padding:3px 6px;text-align:right">52週折り込み度</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:6px;font-size:8px;color:rgba(255,255,255,0.2)">AM=Asset Manager / LF=Leveraged Funds</div>
  </div>`;
}

type TabKey = 'net' | 'detail';

export class FxPositioningPanel extends Panel {
  private _instruments: Array<CotInstrumentEnhanced & { fx?: typeof FX_INSTRUMENTS[0] }> = [];
  private _hasData = false;
  private _tab: TabKey = 'net';
  private _reportDate = '';

  constructor() {
    super({ id: 'fx-positioning', title: 'FX COT Positioning', showCount: false, infoTooltip: 'CFTC先物：投機筋ネットポジション + 52週パーセンタイル（折り込み度）' });
    this.content.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-tab]');
      if (!btn) return;
      const tab = btn.dataset.tab as TabKey;
      if (tab && tab !== this._tab) { this._tab = tab; this._render(); }
    });
  }

  public async fetchData(): Promise<boolean> {
    this.showLoading('Loading COT positioning...');
    try {
      const resp = await fetch('/api/market/cot-enhanced');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = await resp.json() as { instruments?: CotInstrumentEnhanced[]; reportDate?: string; unavailable?: boolean };
      if (raw.unavailable || !raw.instruments?.length) {
        if (!this._hasData) this.showError('COT data unavailable.', () => void this.fetchData());
        return false;
      }
      this._instruments = raw.instruments
        .map(inst => ({ ...inst, fx: matchCurrency(inst) }))
        .filter(inst => inst.fx != null);
      this._reportDate = raw.reportDate ?? '';
      this._hasData = true;
      this._render();
      return true;
    } catch (err) {
      if (this.isAbortError(err)) return false;
      if (!this._hasData) this.showError('Failed to load COT data.', () => void this.fetchData());
      return false;
    }
  }

  private _renderTabs(): string {
    const tabs: { key: TabKey; label: string }[] = [
      { key: 'net',    label: 'ネットポジ + 折り込み度' },
      { key: 'detail', label: 'AM / LF 詳細' },
    ];
    return `<div style="display:flex;gap:4px;padding:0 14px 10px">` +
      tabs.map(({ key, label }) => {
        const active = this._tab === key;
        return `<button data-tab="${key}" style="padding:3px 10px;font-size:10px;font-weight:600;
          border-radius:3px;border:none;cursor:pointer;
          background:${active ? 'rgba(255,255,255,0.15)' : 'transparent'};
          color:${active ? 'var(--text)' : 'rgba(255,255,255,0.35)'}">
          ${escapeHtml(label)}</button>`;
      }).join('') + `</div>`;
  }

  private _render(): void {
    if (!this._hasData) { this.showError('No COT data.', () => void this.fetchData()); return; }
    const footer = this._reportDate
      ? `<div style="padding:4px 14px 0;font-size:9px;color:rgba(255,255,255,0.2)">CFTC report: ${escapeHtml(this._reportDate)}</div>`
      : '';
    const body = this._tab === 'net'
      ? this._instruments.map(i => i.fx ? renderCard(i, i.fx) : '').join('')
      : renderDetailTable(this._instruments);
    this.setContent(footer + this._renderTabs() + body);
  }
}
