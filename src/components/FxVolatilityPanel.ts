import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';

interface FxVolPair {
  pair: string;
  label: string;
  spot: number | null;
  impliedVol: number | null;
  realizedVol30d: number | null;
  volUsed: number | null;
  volSource: string;
  dailyRange: number | null;
  weeklyRange: number | null;
  dailyPct: number | null;
  weeklyPct: number | null;
  rateDate: string;
}

interface FxVolData {
  pairs: FxVolPair[];
  updatedAt: string;
  unavailable?: boolean;
}

// 通貨ペアのフラグ・色
const PAIR_META: Record<string, { flags: string; color: string }> = {
  EURUSD: { flags: '🇪🇺🇺🇸', color: '#2ecc71' },
  GBPUSD: { flags: '🇬🇧🇺🇸', color: '#9b59b6' },
  USDJPY: { flags: '🇺🇸🇯🇵', color: '#e74c3c' },
  USDCHF: { flags: '🇺🇸🇨🇭', color: '#1abc9c' },
  USDCAD: { flags: '🇺🇸🇨🇦', color: '#e67e22' },
  NZDUSD: { flags: '🇳🇿🇺🇸', color: '#f39c12' },
};

// vol レベルに応じた色
function volColor(vol: number): string {
  if (vol >= 15) return '#e74c3c';
  if (vol >= 10) return '#e67e22';
  if (vol >= 7)  return '#f1c40f';
  return '#2ecc71';
}

function renderVolBar(vol: number, maxVol: number, color: string): string {
  const pct = maxVol > 0 ? Math.min(100, (vol / maxVol) * 100) : 0;
  return `<div style="flex:1;background:rgba(255,255,255,0.06);border-radius:2px;height:6px;overflow:hidden">
    <div style="height:100%;width:${pct.toFixed(1)}%;background:${color};border-radius:2px;transition:width 0.4s"></div>
  </div>`;
}

function renderCard(p: FxVolPair, maxVol: number): string {
  const meta   = PAIR_META[p.pair] ?? { flags: '💱', color: '#95a5a6' };
  const vol    = p.volUsed;
  const color  = vol != null ? volColor(vol) : 'rgba(255,255,255,0.3)';
  const srcTag = p.volSource === 'CBOE-IV'
    ? `<span style="font-size:8px;background:rgba(46,204,113,0.15);color:#2ecc71;padding:1px 4px;border-radius:2px">IV</span>`
    : `<span style="font-size:8px;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.3);padding:1px 4px;border-radius:2px">RV30d</span>`;

  const spotFmt = p.spot != null
    ? (p.spot > 10 ? p.spot.toFixed(3) : p.spot.toFixed(5))
    : '—';
  const dailyFmt  = p.dailyRange != null  ? `±${p.dailyRange}` : '—';
  const weeklyFmt = p.weeklyRange != null ? `±${p.weeklyRange}` : '—';

  return `
    <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <span style="font-size:14px">${meta.flags}</span>
        <span style="font-size:12px;font-weight:700">${escapeHtml(p.label)}</span>
        ${srcTag}
        <span style="margin-left:auto;font-size:11px;color:rgba(255,255,255,0.4)">spot ${escapeHtml(spotFmt)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="font-size:18px;font-weight:800;color:${color};font-variant-numeric:tabular-nums">
          ${vol != null ? vol.toFixed(1) + '%' : '—'}
        </span>
        <span style="font-size:10px;color:rgba(255,255,255,0.3)">年率ボラ</span>
        ${vol != null ? renderVolBar(vol, maxVol, color) : ''}
      </div>
      <div style="display:flex;gap:16px;font-size:10px;color:rgba(255,255,255,0.4)">
        <span>日次 <strong style="color:rgba(255,255,255,0.75)">${escapeHtml(dailyFmt)}</strong></span>
        <span>週次 <strong style="color:rgba(255,255,255,0.75)">${escapeHtml(weeklyFmt)}</strong></span>
        ${p.dailyPct != null ? `<span style="color:rgba(255,255,255,0.25)">(${p.dailyPct.toFixed(2)}% / 日)</span>` : ''}
      </div>
    </div>`;
}

function renderMatrix(pairs: FxVolPair[]): string {
  const sorted = [...pairs].sort((a, b) => (b.volUsed ?? 0) - (a.volUsed ?? 0));
  const rows = sorted.map(p => {
    const meta  = PAIR_META[p.pair] ?? { flags: '💱', color: '#95a5a6' };
    const vol   = p.volUsed;
    const color = vol != null ? volColor(vol) : 'rgba(255,255,255,0.3)';
    return `<tr>
      <td style="padding:4px 6px;font-size:11px">${meta.flags} ${escapeHtml(p.label)}</td>
      <td style="padding:4px 6px;text-align:right;font-size:12px;font-weight:700;color:${color}">${vol?.toFixed(1) ?? '—'}%</td>
      <td style="padding:4px 6px;text-align:right;font-size:10px;color:rgba(255,255,255,0.5)">±${p.dailyRange ?? '—'}</td>
      <td style="padding:4px 6px;text-align:right;font-size:10px;color:rgba(255,255,255,0.5)">±${p.weeklyRange ?? '—'}</td>
      <td style="padding:4px 6px;text-align:right;font-size:9px;color:rgba(255,255,255,0.25)">${p.volSource === 'CBOE-IV' ? 'IV' : 'RV'}</td>
    </tr>`;
  }).join('');
  return `<div style="padding:0 14px 10px;overflow-x:auto">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="font-size:9px;color:rgba(255,255,255,0.25)">
        <th style="padding:3px 6px;text-align:left">ペア</th>
        <th style="padding:3px 6px;text-align:right">年率ボラ</th>
        <th style="padding:3px 6px;text-align:right">日次レンジ</th>
        <th style="padding:3px 6px;text-align:right">週次レンジ</th>
        <th style="padding:3px 6px;text-align:right">種別</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:8px;font-size:9px;color:rgba(255,255,255,0.2);line-height:1.5">
      IV = CBOE インプライドボラ（EUR/USD: ^EVZ）<br>
      RV = ECBレートから計算した30日実現ボラ<br>
      レンジ = 年率ボラ ÷ √252（日次）または √52（週次） × spot（1σ想定）<br>
      ※ 25ΔリスクリバーサルにはBloomberg/Refinitivが必要
    </div>
  </div>`;
}

type TabKey = 'cards' | 'matrix';

export class FxVolatilityPanel extends Panel {
  private _data: FxVolData | null = null;
  private _hasData = false;
  private _tab: TabKey = 'cards';

  constructor() {
    super({ id: 'fx-volatility', title: 'FX Volatility & Range', showCount: false, infoTooltip: 'EUR/USDはCBOE EVZ（インプライドボラ）、他はECB実現ボラ30日から日次・週次想定レンジを算出' });
    this.content.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-tab]');
      if (!btn) return;
      const tab = btn.dataset.tab as TabKey;
      if (tab && tab !== this._tab) { this._tab = tab; this._render(); }
    });
  }

  public async fetchData(): Promise<boolean> {
    this.showLoading('Loading FX volatility...');
    try {
      const resp = await fetch('/api/market/fx-vol');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = await resp.json() as FxVolData;
      if (raw.unavailable || !raw.pairs?.length) {
        if (!this._hasData) this.showError('Vol data unavailable. Run: node scripts/seed-fx-vol.mjs', () => void this.fetchData());
        return false;
      }
      this._data = raw;
      this._hasData = true;
      this._render();
      return true;
    } catch (err) {
      if (this.isAbortError(err)) return false;
      if (!this._hasData) this.showError('Failed to load vol data.', () => void this.fetchData());
      return false;
    }
  }

  private _renderTabs(): string {
    const tabs: { key: TabKey; label: string }[] = [
      { key: 'cards',  label: 'ボラ + レンジ' },
      { key: 'matrix', label: 'ランキング' },
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
    if (!this._hasData || !this._data) { this.showError('No vol data.', () => void this.fetchData()); return; }
    const pairs = this._data.pairs;
    const maxVol = Math.max(...pairs.map(p => p.volUsed ?? 0), 1);
    const updated = this._data.updatedAt
      ? `<div style="padding:4px 14px 0;font-size:9px;color:rgba(255,255,255,0.2)">更新: ${escapeHtml(this._data.updatedAt.slice(0, 16).replace('T', ' '))} UTC</div>`
      : '';
    const body = this._tab === 'cards'
      ? pairs.map(p => renderCard(p, maxVol)).join('')
      : renderMatrix(pairs);
    this.setContent(updated + this._renderTabs() + body);
  }
}
