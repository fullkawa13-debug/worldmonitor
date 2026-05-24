import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';

interface FxAiInsightsData {
  analysis: string;
  alerts: string[];
  newsHeadlines?: string[];
  source: 'gemini' | 'rule-based';
  reportDate: string;
  generatedAt: string;
}

export class FxAiInsightsPanel extends Panel {
  private _data: FxAiInsightsData | null = null;
  private _hasData = false;

  constructor() {
    super({
      id: 'fx-ai-insights',
      title: 'FX AI インサイト',
      showCount: false,
      infoTooltip: 'COTポジション・ボラティリティ・経済カレンダーを基にAIが為替相場の分析とアラートを日本語で自動生成',
    });
  }

  public async fetchData(): Promise<boolean> {
    this.showLoading('AI分析を生成中...');
    try {
      const resp = await fetch('/api/fx/ai-insights');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as FxAiInsightsData;
      if (!data.analysis && !data.alerts?.length) {
        if (!this._hasData) this.showError('データ不足のためAI分析を生成できません。', () => void this.fetchData());
        return false;
      }
      this._data = data;
      this._hasData = true;
      this._render();
      return true;
    } catch (err) {
      if (this.isAbortError(err)) return false;
      if (!this._hasData) this.showError('AI分析の取得に失敗しました。', () => void this.fetchData());
      return false;
    }
  }

  private _render(): void {
    if (!this._data) {
      this.showError('データなし', () => void this.fetchData());
      return;
    }

    const d = this._data;
    const sourceLabel = d.source === 'gemini'
      ? '<span style="background:rgba(66,133,244,0.15);color:#4285f4;padding:2px 6px;border-radius:3px;font-size:9px;font-weight:600">Gemini AI</span>'
      : '<span style="background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.4);padding:2px 6px;border-radius:3px;font-size:9px">ルールベース</span>';

    const timestamp = d.generatedAt
      ? new Date(d.generatedAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';

    const alertsHtml = d.alerts.map(a => {
      const isWarning = a.includes('要警戒');
      const bgColor = isWarning ? 'rgba(231,76,60,0.1)' : 'rgba(255,255,255,0.03)';
      const borderColor = isWarning ? 'rgba(231,76,60,0.3)' : 'rgba(255,255,255,0.06)';
      return `<div style="padding:8px 12px;background:${bgColor};border-left:3px solid ${borderColor};border-radius:0 4px 4px 0;margin-bottom:6px;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.85)">
        ${escapeHtml(a)}
      </div>`;
    }).join('');

    const analysisText = d.analysis || '';
    const newsMarker = analysisText.indexOf('【通貨別ニュース】');
    let mainAnalysis: string;
    let currencyNews: string;
    if (newsMarker >= 0) {
      mainAnalysis = analysisText.substring(0, newsMarker).trim();
      currencyNews = analysisText.substring(newsMarker + '【通貨別ニュース】'.length).trim();
    } else {
      mainAnalysis = analysisText;
      currencyNews = '';
    }

    const mainLines = mainAnalysis.split('\n').filter(l => l.trim() && !l.includes('【相場分析】'));
    const mainHtml = d.source === 'gemini' && mainLines.length > 0
      ? `<div style="padding:12px 14px;font-size:12px;line-height:1.8;color:rgba(255,255,255,0.8)">
          ${mainLines.map(line => `<div style="margin-bottom:4px">${escapeHtml(line)}</div>`).join('')}
        </div>`
      : '';

    const newsLines = currencyNews.split('\n').filter(l => l.trim());
    const currencyNewsHtml = newsLines.length > 0
      ? `<div style="padding:10px 14px;border-top:1px solid rgba(255,255,255,0.05)">
          <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-bottom:8px;font-weight:600">通貨別ニュース</div>
          ${newsLines.map(line => {
            const ccyMatch = line.match(/^[・\-\*]?\s*(USD|EUR|JPY|GBP|CHF|CAD|NZD)\s*[:：]/i);
            const ccyTag = ccyMatch
              ? `<span style="display:inline-block;background:rgba(66,133,244,0.15);color:#4285f4;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:600;margin-right:6px">${escapeHtml(ccyMatch[1].toUpperCase())}</span>`
              : '';
            const text = ccyMatch ? line.substring(ccyMatch[0].length).trim() : line.replace(/^[・\-\*]\s*/, '');
            return `<div style="padding:5px 0;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.8);border-bottom:1px solid rgba(255,255,255,0.03)">
              ${ccyTag}${escapeHtml(text)}
            </div>`;
          }).join('')}
        </div>`
      : '';

    const headlinesHtml = d.newsHeadlines && d.newsHeadlines.length > 0
      ? `<div style="padding:0 14px 10px">
          <details style="cursor:pointer">
            <summary style="font-size:10px;color:rgba(255,255,255,0.25);padding:6px 0;user-select:none">ソースヘッドライン (${d.newsHeadlines.length}件)</summary>
            <div style="padding:6px 0;max-height:200px;overflow-y:auto">
              ${d.newsHeadlines.map(h => {
                const tagMatch = h.match(/^\[(.+?)\]\s*/);
                const tag = tagMatch ? tagMatch[1] : '';
                const title = tagMatch ? h.substring(tagMatch[0].length) : h;
                return `<div style="padding:3px 0;font-size:10px;line-height:1.5;color:rgba(255,255,255,0.45)">
                  ${tag ? `<span style="color:rgba(255,255,255,0.25);margin-right:4px">[${escapeHtml(tag)}]</span>` : ''}${escapeHtml(title)}
                </div>`;
              }).join('')}
            </div>
          </details>
        </div>`
      : '';

    this.setContent(`
      <div style="padding:8px 14px 4px;display:flex;align-items:center;gap:8px">
        ${sourceLabel}
        <span style="font-size:9px;color:rgba(255,255,255,0.2);margin-left:auto">${escapeHtml(timestamp)}</span>
      </div>
      ${mainHtml ? `<div style="border-bottom:1px solid rgba(255,255,255,0.05)">${mainHtml}</div>` : ''}
      ${currencyNewsHtml}
      <div style="padding:10px 14px">
        <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-bottom:8px;font-weight:600">アラート</div>
        ${alertsHtml}
      </div>
      ${headlinesHtml}
      <div style="padding:4px 14px 10px;display:flex;align-items:center;gap:8px">
        <button data-action="refresh" style="padding:4px 12px;font-size:10px;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);border:none;border-radius:3px;cursor:pointer">
          🔄 再分析
        </button>
        ${d.reportDate ? `<span style="font-size:9px;color:rgba(255,255,255,0.2)">COT: ${escapeHtml(d.reportDate)}</span>` : ''}
      </div>
    `);

    this.content.querySelector('button[data-action="refresh"]')?.addEventListener('click', () => {
      void this.fetchData();
    });
  }
}
