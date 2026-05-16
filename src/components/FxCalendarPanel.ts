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

// 7通貨とその国コードのマッピング
const CCY_COUNTRY_MAP: Record<string, Set<string>> = {
  USD: new Set(['US']),
  EUR: new Set(['EA', 'EMU', 'EU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'FI', 'IE', 'GR']),
  GBP: new Set(['GB', 'UK']),
  JPY: new Set(['JP']),
  CHF: new Set(['CH']),
  CAD: new Set(['CA']),
  NZD: new Set(['NZ']),
};

const ALL_7CCY_COUNTRIES = new Set(Object.values(CCY_COUNTRY_MAP).flatMap(s => [...s]));

const CCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', CHF: '🇨🇭', CAD: '🇨🇦', NZD: '🇳🇿',
};

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', UK: '🇬🇧', EU: '🇪🇺', EA: '🇪🇺', EMU: '🇪🇺',
  DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', JP: '🇯🇵',
  CH: '🇨🇭', CA: '🇨🇦', NZ: '🇳🇿',
};

const IMPACT_COLORS: Record<string, string> = {
  high:   '#e74c3c',
  medium: '#f39c12',
  low:    'rgba(255,255,255,0.3)',
};

type FilterKey = 'all' | 'high' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'CAD' | 'NZD';

interface EconomicEvent {
  event: string;
  country: string;
  date: string;
  impact: string;
  actual: string;
  estimate: string;
  previous: string;
  unit: string;
}

function groupByDate(events: EconomicEvent[]): Map<string, EconomicEvent[]> {
  const map = new Map<string, EconomicEvent[]>();
  for (const ev of events) {
    const key = ev.date || 'Unknown';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return map;
}

function formatDateGroup(dateStr: string): string {
  if (!dateStr || dateStr === 'Unknown') return 'Unknown';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtVal(val: string, unit: string): string {
  if (!val) return '—';
  return unit ? `${val} ${unit}` : val;
}

function countdown(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 0) return Math.abs(days) < 14 ? `${Math.abs(days)}d ago` : `${Math.round(Math.abs(days) / 7)}w ago`;
  if (days < 14) return `in ${days}d`;
  return `in ${Math.round(days / 7)}w`;
}

export class FxCalendarPanel extends Panel {
  private _hasData = false;
  private _events: EconomicEvent[] = [];
  private _filter: FilterKey = 'all';

  constructor() {
    super({ id: 'fx-calendar', title: 'FX Economic Calendar', showCount: false, infoTooltip: 'NZD・CHF・GBP・USD・JPY・EUR・CADの経済イベントカレンダー。通貨別・重要度別フィルター付き。' });
    this.content.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-fx-filter]');
      if (!btn) return;
      const filter = btn.dataset.fxFilter as FilterKey;
      if (filter && filter !== this._filter) {
        this._filter = filter;
        this._render();
      }
    });
  }

  public async fetchData(): Promise<boolean> {
    this.showLoading('Loading FX calendar...');
    try {
      const client = await getEconomicClient();
      const today = new Date();
      const fromDate = today.toISOString().slice(0, 10);
      const toDate = new Date(today.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
      const resp = await client.getEconomicCalendar({ fromDate, toDate });

      if (resp.unavailable || !resp.events?.length) {
        if (!this._hasData) this.showError('Economic calendar data unavailable.', () => void this.fetchData());
        return false;
      }

      // 7通貨関連イベントのみ保持
      this._events = (resp.events as EconomicEvent[]).filter(ev => ALL_7CCY_COUNTRIES.has(ev.country));
      this._hasData = true;
      this._render();
      return true;
    } catch (err) {
      if (this.isAbortError(err)) return false;
      if (!this._hasData) this.showError('Failed to load FX calendar.', () => void this.fetchData());
      return false;
    }
  }

  private _filterEvents(): EconomicEvent[] {
    const { _filter: f } = this;
    if (f === 'high') return this._events.filter(e => (e.impact || '').toLowerCase() === 'high');
    if (f !== 'all') {
      const countries = CCY_COUNTRY_MAP[f];
      if (countries) return this._events.filter(e => countries.has(e.country));
    }
    return this._events;
  }

  private _renderFilterBar(): string {
    const tabs: { key: FilterKey; label: string }[] = [
      { key: 'all',  label: 'All' },
      { key: 'high', label: '🔴 High' },
      { key: 'USD',  label: `${CCY_FLAGS.USD} USD` },
      { key: 'EUR',  label: `${CCY_FLAGS.EUR} EUR` },
      { key: 'GBP',  label: `${CCY_FLAGS.GBP} GBP` },
      { key: 'JPY',  label: `${CCY_FLAGS.JPY} JPY` },
      { key: 'CHF',  label: `${CCY_FLAGS.CHF} CHF` },
      { key: 'CAD',  label: `${CCY_FLAGS.CAD} CAD` },
      { key: 'NZD',  label: `${CCY_FLAGS.NZD} NZD` },
    ];
    return `<div style="display:flex;flex-wrap:wrap;gap:3px;padding:0 14px 10px">` +
      tabs.map(({ key, label }) => {
        const active = this._filter === key;
        return `<button data-fx-filter="${key}" style="
          padding:3px 8px;font-size:10px;font-weight:600;letter-spacing:0.03em;
          border-radius:3px;border:none;cursor:pointer;
          background:${active ? 'rgba(255,255,255,0.18)' : 'transparent'};
          color:${active ? 'var(--text)' : 'rgba(255,255,255,0.35)'};
        ">${label}</button>`;
      }).join('') +
    `</div>`;
  }

  private _render(): void {
    if (!this._hasData) {
      this.showError('No upcoming economic events.', () => void this.fetchData());
      return;
    }

    const filtered = this._filterEvents();
    const grouped = groupByDate(filtered);
    let bodyRows = '';
    let isFirst = true;

    for (const [date, events] of grouped) {
      const borderTop = isFirst ? '' : 'border-top:1px solid rgba(255,255,255,0.06);';
      isFirst = false;
      bodyRows += `<tr>
        <td colspan="4" style="padding:10px 0 3px;font-size:10px;font-weight:600;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.06em;${borderTop}">
          ${escapeHtml(formatDateGroup(date))}
        </td>
      </tr>`;

      for (const ev of events) {
        const impact = (ev.impact || 'low').toLowerCase();
        const impactColor = IMPACT_COLORS[impact] ?? IMPACT_COLORS.low;
        const flag = COUNTRY_FLAGS[ev.country] ?? escapeHtml(ev.country);
        const isHigh = impact === 'high';

        let rightLabel: string;
        let rightStyle: string;
        if (ev.actual) {
          rightLabel = escapeHtml(fmtVal(ev.actual, ev.unit));
          rightStyle = 'color:var(--text);font-weight:600';
        } else if (ev.estimate) {
          rightLabel = `est. ${escapeHtml(fmtVal(ev.estimate, ev.unit))}`;
          rightStyle = 'color:rgba(255,255,255,0.45);font-style:italic';
        } else {
          rightLabel = escapeHtml(countdown(ev.date));
          rightStyle = 'color:rgba(255,255,255,0.35);font-style:italic';
        }

        // 前回値（prevは小さく表示）
        const prevCell = ev.previous
          ? `<td style="padding:4px 6px;text-align:center;font-size:10px;color:rgba(255,255,255,0.3);white-space:nowrap">${escapeHtml(fmtVal(ev.previous, ev.unit))}</td>`
          : `<td></td>`;

        bodyRows += `<tr style="font-size:12px;line-height:1.2">
          <td style="padding:4px 8px 4px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:0">
            <span style="margin-right:5px">${flag}</span>
            <span style="font-weight:${isHigh ? 600 : 400}">${escapeHtml(ev.event)}</span>
          </td>
          <td style="padding:4px 6px;text-align:center;vertical-align:middle">
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${impactColor};vertical-align:middle"></span>
          </td>
          ${prevCell}
          <td style="padding:4px 0;text-align:right;font-variant-numeric:tabular-nums;${rightStyle};white-space:nowrap">${rightLabel}</td>
        </tr>`;
      }
    }

    const emptyMsg = filtered.length === 0
      ? `<tr><td colspan="4" style="padding:20px 0;text-align:center;color:rgba(255,255,255,0.3);font-size:12px">No events for selected filter</td></tr>`
      : '';

    const html = `${this._renderFilterBar()}
      <div style="padding:0 14px 12px;max-height:440px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;table-layout:fixed">
          <colgroup>
            <col style="width:auto">
            <col style="width:18px">
            <col style="width:56px">
            <col style="width:64px">
          </colgroup>
          <thead>
            <tr style="font-size:9px;font-weight:600;color:rgba(255,255,255,0.25);text-transform:uppercase;letter-spacing:0.06em">
              <th style="text-align:left;padding:0 8px 8px 0;font-weight:600">EVENT</th>
              <th></th>
              <th style="text-align:center;padding:0 6px 8px;font-weight:600">PREV</th>
              <th style="text-align:right;padding:0 0 8px;font-weight:600">ACTUAL/EST</th>
            </tr>
          </thead>
          <tbody>${emptyMsg}${bodyRows}</tbody>
        </table>
      </div>`;

    this.setContent(html);
  }
}
