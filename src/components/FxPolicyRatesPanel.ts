import type { EconomicServiceClient } from '@/generated/client/worldmonitor/economic/v1/service_client';
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';

let _client: EconomicServiceClient | null = null;
async function getEconomicClient(): Promise<EconomicServiceClient> {
  if (!_client) {
    const { EconomicServiceClient } = await import('@/generated/client/worldmonitor/economic/v1/service_client');
    const { getRpcBaseUrl } = await import('@/services/rpc-client');
    _client = new EconomicServiceClient(getRpcBaseUrl(), { fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) });
  }
  return _client;
}

// 対象7通貨の定義（BIS countryCode → 通貨情報）
const FX7_CURRENCIES: Array<{ code: string; currency: string; flag: string; color: string }> = [
  { code: 'US', currency: 'USD', flag: '🇺🇸', color: '#3498db' },
  { code: 'EA', currency: 'EUR', flag: '🇪🇺', color: '#2ecc71' },
  { code: 'GB', currency: 'GBP', flag: '🇬🇧', color: '#9b59b6' },
  { code: 'JP', currency: 'JPY', flag: '🇯🇵', color: '#e74c3c' },
  { code: 'CA', currency: 'CAD', flag: '🇨🇦', color: '#e67e22' },
  { code: 'CH', currency: 'CHF', flag: '🇨🇭', color: '#1abc9c' },
  { code: 'NZ', currency: 'NZD', flag: '🇳🇿', color: '#f39c12' },
];

// BIS countryCode の別名（EuroAreaはXM / EA / EMU / DEの順で探す）
const COUNTRY_ALIASES: Record<string, string[]> = {
  EA: ['XM', 'EA', 'EMU', 'DE'],
};

interface RateEntry {
  currency: string;
  flag: string;
  color: string;
  rate: number;
  previousRate: number;
  date: string;
  centralBank: string;
}

function resolveRate(rates: Array<{ countryCode: string; rate: number; previousRate: number; date: string; centralBank: string }>, code: string): typeof rates[0] | undefined {
  const aliases = COUNTRY_ALIASES[code] ?? [code];
  for (const alias of aliases) {
    const found = rates.find(r => r.countryCode === alias);
    if (found) return found;
  }
  return undefined;
}

function buildEntries(rates: Array<{ countryCode: string; rate: number; previousRate: number; date: string; centralBank: string }>): RateEntry[] {
  const entries: RateEntry[] = [];
  for (const def of FX7_CURRENCIES) {
    const r = resolveRate(rates, def.code);
    if (r) {
      entries.push({ currency: def.currency, flag: def.flag, color: def.color, rate: r.rate, previousRate: r.previousRate, date: r.date, centralBank: r.centralBank });
    }
  }
  return entries;
}

function renderBar(rate: number, maxRate: number, color: string): string {
  const pct = maxRate > 0 ? Math.min(100, (rate / maxRate) * 100) : 0;
  return `<div style="flex:1;background:rgba(255,255,255,0.06);border-radius:2px;height:8px;overflow:hidden">
    <div style="height:100%;width:${pct.toFixed(1)}%;background:${color};border-radius:2px;transition:width 0.4s"></div>
  </div>`;
}

function renderArrow(rate: number, prev: number): string {
  if (rate === prev) return `<span style="color:rgba(255,255,255,0.3)">→</span>`;
  if (rate > prev)   return `<span style="color:#2ecc71">▲</span>`;
  return `<span style="color:#e74c3c">▼</span>`;
}

function renderDiffMatrix(entries: RateEntry[]): string {
  if (entries.length < 2) return '';
  const cols = entries.map(e => `<th style="padding:3px 5px;text-align:center;font-size:9px;color:rgba(255,255,255,0.4)">${escapeHtml(e.currency)}</th>`).join('');
  const rows = entries.map(row => {
    const cells = entries.map(col => {
      if (row.currency === col.currency) {
        return `<td style="padding:3px 5px;text-align:center;font-size:10px;color:rgba(255,255,255,0.15)">—</td>`;
      }
      const diff = row.rate - col.rate;
      const color = diff > 0 ? '#2ecc71' : '#e74c3c';
      const sign  = diff > 0 ? '+' : '';
      return `<td style="padding:3px 5px;text-align:center;font-size:10px;color:${color};font-variant-numeric:tabular-nums">${sign}${diff.toFixed(2)}</td>`;
    }).join('');
    return `<tr>
      <td style="padding:3px 5px;font-size:10px;font-weight:600;white-space:nowrap">${escapeHtml(row.flag)} ${escapeHtml(row.currency)}</td>
      ${cells}
    </tr>`;
  }).join('');

  return `
    <div style="padding:0 14px 10px">
      <div style="font-size:9px;font-weight:600;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">金利差マトリクス (bps = row − col)</div>
      <div style="overflow-x:auto">
        <table style="border-collapse:collapse;width:100%;font-size:10px">
          <thead><tr><th></th>${cols}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

type TabKey = 'bars' | 'matrix';

export class FxPolicyRatesPanel extends Panel {
  private _entries: RateEntry[] = [];
  private _hasData = false;
  private _tab: TabKey = 'bars';

  constructor() {
    super({ id: 'fx-policy-rates', title: 'Policy Rates (7 CCY)', showCount: false, infoTooltip: '7通貨の主要中央銀行政策金利をBIS統計から表示。前回比変化・金利差マトリクス付き。' });
    this.content.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-tab]');
      if (!btn) return;
      const tab = btn.dataset.tab as TabKey;
      if (tab && tab !== this._tab) {
        this._tab = tab;
        this._render();
      }
    });
  }

  public async fetchData(): Promise<boolean> {
    this.showLoading('Loading policy rates...');
    try {
      const client = await getEconomicClient();
      const resp = await client.getBisPolicyRates({});
      if (!resp.rates?.length) {
        if (!this._hasData) this.showError('Policy rate data unavailable.', () => void this.fetchData());
        return false;
      }
      this._entries = buildEntries(resp.rates);
      this._hasData = true;
      this._render();
      return true;
    } catch (err) {
      if (this.isAbortError(err)) return false;
      if (!this._hasData) this.showError('Failed to load policy rates.', () => void this.fetchData());
      return false;
    }
  }

  private _renderTabs(): string {
    const tabs: { key: TabKey; label: string }[] = [
      { key: 'bars',   label: '金利一覧' },
      { key: 'matrix', label: '金利差' },
    ];
    return `<div style="display:flex;gap:4px;padding:0 14px 10px">` +
      tabs.map(({ key, label }) => {
        const active = this._tab === key;
        return `<button data-tab="${key}" style="
          padding:3px 10px;font-size:10px;font-weight:600;letter-spacing:0.04em;
          border-radius:3px;border:none;cursor:pointer;
          background:${active ? 'rgba(255,255,255,0.15)' : 'transparent'};
          color:${active ? 'var(--text)' : 'rgba(255,255,255,0.35)'};
        ">${escapeHtml(label)}</button>`;
      }).join('') +
    `</div>`;
  }

  private _renderBars(): string {
    if (!this._entries.length) {
      return `<div style="padding:20px 14px;color:rgba(255,255,255,0.3);font-size:12px">データなし</div>`;
    }
    const maxRate = Math.max(...this._entries.map(e => e.rate), 0.01);
    const rows = this._entries.map(e => `
      <div style="margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
          <span style="font-size:13px">${e.flag}</span>
          <span style="font-size:12px;font-weight:600;min-width:38px">${escapeHtml(e.currency)}</span>
          <span style="font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;color:${e.color}">${e.rate.toFixed(2)}%</span>
          <span style="font-size:11px;margin-left:2px">${renderArrow(e.rate, e.previousRate)}</span>
          <span style="font-size:10px;color:rgba(255,255,255,0.3);margin-left:auto">${escapeHtml(e.centralBank)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:38px"></div>
          ${renderBar(e.rate, maxRate, e.color)}
        </div>
      </div>
    `).join('');
    return `<div style="padding:0 14px 10px">${rows}</div>`;
  }

  private _render(): void {
    if (!this._hasData) {
      this.showError('No policy rate data.', () => void this.fetchData());
      return;
    }
    const html = this._renderTabs() +
      (this._tab === 'bars' ? this._renderBars() : renderDiffMatrix(this._entries));
    this.setContent(html);
  }
}
