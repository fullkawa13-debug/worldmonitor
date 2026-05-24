# FX 7-Currency Dashboard 導入手順

**対象リポジトリ**: `world-monitor`（AGPL-3.0, github.com/fullkawa13-debug/worldmonitor）  
**バリアント名**: `fx-7ccy`  
**対象通貨**: NZD / CHF / GBP / USD / JPY / EUR / CAD  

---

## 概要

Finance variantをベースにFX専用パネルを追加したダッシュボード。

| パネル | データ源 | 更新周期 |
|--------|---------|---------|
| 政策金利 (7通貨) | BIS統計 API | 1時間 |
| FX 経済カレンダー | FOMC/ECB/Eurostat | 1時間 |
| FX COT ポジション | CFTC COT（先物） | 1時間 |
| FX ボラティリティ＆レンジ | CBOE IV / ECB RV | 1時間 |
| FX AI インサイト | Gemini 2.5 Flash + ルールベース | 10分キャッシュ |

---

## 前提条件

- Node.js 18以上
- リポジトリのクローン済み・依存関係インストール済み（`npm install`）
- Upstash Redisアカウント（無料プランで可）

---

## セットアップ手順

### 1. 変更ファイルの確認

このダッシュボードは以下のファイルを追加・変更しています。  
**別PCに移す場合はこれらを git 経由で取得するだけで完了**（git管理済みであれば）。

#### 新規追加ファイル（7ファイル）

```
src/config/variants/fx-7ccy.ts       ← バリアント設定（パネル・マップレイヤー・フィード）
src/components/FxPolicyRatesPanel.ts  ← 政策金利パネル
src/components/FxCalendarPanel.ts     ← 経済カレンダーパネル
src/components/FxPositioningPanel.ts  ← COTポジションパネル
src/components/FxVolatilityPanel.ts   ← FXボラティリティ + レンジ推定パネル
api/market/cot-enhanced.ts           ← COTデータ配信 Edge Function
api/market/fx-vol.ts                 ← FXボラデータ配信 Edge Function
```

#### 変更ファイル（8ファイル）

```
src/components/index.ts       ← 4パネルのexport追加
src/app/panel-layout.ts       ← 4パネルのcreatePanelとimport追加
src/config/panels.ts          ← FX_7CCY_PANELS定義・ALL_PANELS/VARIANT_DEFAULTS追加
src/config/variant-meta.ts    ← fx-7ccy のメタ情報（タイトル等）追加
src/config/variant.ts         ← fx-7ccy のlocalhost/Tauri許可リスト追加
src/App.ts                    ← fetchData()のprime/scheduleRefresh登録追加（4パネル分）
scripts/seed-cot.mjs          ← GBP/CHF/CAD/NZD追加・52週ヒストリー取得・limit拡張
package.json                  ← dev:fx スクリプト追加
```

---

### 2. Upstash Redis の設定

#### 2-1. Redisインスタンス作成

1. [Upstash Console](https://console.upstash.com/) でアカウント作成・ログイン
2. 「Create Database」→ リージョン選択（Tokyo推奨）→ 作成
3. 「REST API」タブを開き以下をコピー

```
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXXXXXXXXXXxxx...
```

#### 2-2. 環境変数ファイル作成

リポジトリルートに `.env.local` を作成（gitignore済みなので各PCで手動作成が必要）：

```
UPSTASH_REDIS_REST_URL="https://xxxxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="AXXXXXXXXXXxxx..."
FRED_API_KEY="your_fred_api_key"
GEMINI_API_KEY="your_gemini_api_key"
```

> **GEMINI_API_KEY**: Google AI Studio（https://aistudio.google.com/apikey）で無料取得可。FX AIインサイトパネルで使用。未設定でもルールベースのアラートにフォールバックするため必須ではない。

---

### 3. Redisへのデータ投入（シード）

初回起動前に以下のスクリプトを実行してRedisにデータを投入します。

```powershell
# BIS統計（政策金利・為替・信用）
node scripts/seed-bis-data.mjs

# 経済カレンダー（FOMC/ECB/Eurostat）
node scripts/seed-economic-calendar.mjs

# COTポジショニング（CFTC先物・52週折り込み度含む）
node scripts/seed-cot.mjs

# FXボラティリティ（CBOE IV / ECB実現ボラ）
node scripts/seed-fx-vol.mjs

# 経済指標データ（マーケットレーダー等で使用）
node scripts/seed-economy.mjs

# Fear & Greed指数
node scripts/seed-fear-greed.mjs

# 市場の広がり（Market Breadth）
node scripts/seed-market-breadth.mjs
```

期待される出力例（各スクリプト）：

```
{"event":"seed_complete","domain":"economic","recordCount":11,...,"state":"OK"}
  Verified: data present in Redis
```

> **注意**: `FRED_API_KEY` が未設定の場合、経済カレンダーはFOMC/ECB/Eurostatのみ（FREDデータなし）。  
> FRED APIキーが必要な場合は `.env.local` に `FRED_API_KEY=your_key` を追加する。

---

### 4. 開発サーバー起動・動作確認

```powershell
# PowerShellの場合（&&は使えないので分けて実行）
Set-Location C:\dev\worldmonitor
$env:VITE_VARIANT = "fx-7ccy"
npx vite --port 3000
```

ブラウザで `http://localhost:3000` を開く。

#### 初回表示時の注意（重要）

**localStorageに古いパネル設定が残っていると日本語名や新パネルが反映されない。**  
ブラウザのDevToolsコンソール（F12）で以下を実行してからリロード：

```javascript
localStorage.removeItem('worldmonitor-panels');
localStorage.removeItem('worldmonitor-variant');
location.reload();
```

または、Chromeのシークレットウィンドウで開く。

---

### 5. 動作確認チェックリスト

| 確認項目 | 期待値 |
|---------|-------|
| 政策金利 (7通貨) | USD/EUR/GBP/JPY/CAD/CHF/NZD の金利バーが表示される |
| FX 経済カレンダー | FOMC・ECB等の予定イベントが一覧表示される |
| FX COT ポジション | EC（EUR）・JY（JPY）等の先物ポジションバーと52週折り込み度が表示される |
| FX ボラティリティ＆レンジ | 6通貨ペアのスポット・ボラ・日次レンジが表示される |
| FX AI インサイト | Gemini生成の日本語分析 or ルールベースアラートが表示される |
| マーケットレーダー | 7つのマクロシグナルが表示される |
| 為替・通貨 | FXニュースが流れる |
| 中央銀行ウォッチ | 各中銀のニュースが流れる |
| 債券・金利 | 債券市場のニュースが流れる |
| マップ | 中央銀行・金融センター・貿易ルートのレイヤーが表示される |

---

## 既知の制限事項

| 項目 | 内容 |
|-----|-----|
| NZD の政策金利 | BISがNZ（ニュージーランド）のデータを提供していないため未表示 |
| 経済カレンダー | FRED_API_KEY未設定時はFOMC/ECB/Eurostatの3件のみ（件数が少ない） |
| COTデータ | 毎週金曜更新（CFTC公開タイミング依存）。週明けは前週データを表示 |
| Gemini API | 無料枠は日次/分あたりのリクエスト制限あり。429が続く場合はルールベースにフォールバック |
| Geminiモデル | `gemini-2.5-flash` を使用。`gemini-2.0-flash` は日次クォータが厳しいため非推奨 |

---

## ファイル変更の詳細（差分解説）

### `src/App.ts` の変更箇所

`fetchData()` 呼び出し登録が**必須**。抜けるとパネルが「読み込み中」のまま固まる。

```typescript
// インポート追加（line ~56）
import type { FxPolicyRatesPanel } from '@/components/FxPolicyRatesPanel';
import type { FxCalendarPanel } from '@/components/FxCalendarPanel';
import type { FxPositioningPanel } from '@/components/FxPositioningPanel';

// prime タスク登録（初回ロード時）
if (shouldPrime('fx-policy-rates')) {
  const panel = this.state.panels['fx-policy-rates'] as FxPolicyRatesPanel | undefined;
  if (panel) primeTask('fx-policy-rates', () => panel.fetchData());
}
// ... fx-calendar, fx-positioning も同様

// scheduleRefresh 登録（定期更新）
this.refreshScheduler.scheduleRefresh(
  'fx-policy-rates',
  () => (this.state.panels['fx-policy-rates'] as FxPolicyRatesPanel | undefined)?.fetchData() ?? Promise.resolve(false),
  REFRESH_INTERVALS.cotPositioning,   // 1時間
  () => this.isPanelNearViewport('fx-policy-rates')
);
// ... fx-calendar, fx-positioning も同様
```

### BIS Euro Area の countryCode

BISが返すEuro AreaのcountryCodeは `XM`（`EA` ではない）。  
`FxPolicyRatesPanel.ts` の `COUNTRY_ALIASES` で対応済み：

```typescript
const COUNTRY_ALIASES: Record<string, string[]> = {
  EA: ['XM', 'EA', 'EMU', 'DE'],  // XMを先頭に
};
```

---

## Railway cron（本番運用）

ローカルでは手動シードで動作するが、本番デプロイ時はRailway cronで自動更新。  
設定方法は元リポジトリの `docs/` を参照。

---

## トラブルシューティング

### パネルが「読み込み中」のまま

1. `.env.local` の Redis URL / Token が正しいか確認
2. Redis にデータが入っているか確認：
   ```powershell
   node -e "
   const { Redis } = await import('@upstash/redis');
   const r = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
   console.log(await r.ping());
   " --input-type=module
   ```
3. ブラウザのlocalStorageをクリアしてリロード
4. ブラウザのコンソールでエラーを確認（F12）

### Redis接続タイムアウト

```
[REDIS-TIMEOUT] getCachedJson key=... timeoutMs=1500
```

→ `.env.local` が読み込まれていない可能性。ファイル名・配置場所を確認（リポジトリルート直下）。

### seed スクリプトがエラーになる

```
Error: UPSTASH_REDIS_REST_URL is not set
```

→ PowerShellの場合、`.env.local` は自動では読まれない。以下で明示的に設定：

```powershell
$env:UPSTASH_REDIS_REST_URL = "https://xxxxx.upstash.io"
$env:UPSTASH_REDIS_REST_TOKEN = "AXXXXXXXXXXxxx..."
node scripts/seed-bis-data.mjs
```

### ニュースパネルが「ニュース無し」と表示される

原因: ダイジェストサーバー（本番）がfx-7ccyのフィードカテゴリを持っていないため。  
dev環境では `import.meta.env.DEV` 判定でper-feed fallbackを有効化済み（`data-loader.ts`）。  
それでも表示されない場合：

1. viteのコンソールに `[feed-fetch]` エラーがないか確認
2. RSSプロキシ経由でGoogle Newsフィードが取得できるか確認
3. ブラウザのNetwork tabで `/rss-proxy/` リクエストが200を返しているか確認

### パネル名が英語のまま

原因: localStorageにキャッシュされた古い英語パネル名が優先される。  
解決: DevToolsコンソールで `localStorage.removeItem('worldmonitor-panels'); location.reload();`

App.tsにname同期ロジックを追加済みだが、localStorageに一度も保存されていない初回起動時のみ `DEFAULT_PANELS` から日本語名が適用される。既にlocalStorageがある場合は同期コードが上書きする。

### Gemini APIが429を返し続ける

原因: 無料枠のクォータ超過。ゾンビviteプロセスが複数起動していると短時間に大量リクエストが発生する。

対処:
1. `Get-Process -Name "node" | Stop-Process -Force` でゾンビを全停止
2. viteを1プロセスのみ起動
3. サーバーサイドに10分キャッシュ実装済み（1回成功すれば10分間再呼び出しなし）
4. `gemini-2.0-flash` の日次クォータ超過時は数時間待つか `gemini-2.5-flash`（現在採用済み）を使用

### FXボラティリティが「Vol data unavailable」

原因: Redisの `market:fx-vol:v1` キーが期限切れまたは未投入。

解決: `node scripts/seed-fx-vol.mjs` を再実行

### viteが複数ポートで起動してしまう

PowerShellで `&&` は使えない。`npx vite --port 3000 &` のような書き方もNG。  
正しい起動方法:

```powershell
$env:VITE_VARIANT = "fx-7ccy"
npx vite --port 3000
```

停止は Ctrl+C。別ターミナルで確認: `netstat -ano | Select-String ":3000 "`

---

## アーキテクチャメモ（今回の実装で判明した注意点）

### パネル名の反映経路

```
panels.ts (FX_7CCY_PANELS) → ALL_PANELS → getEffectivePanelConfig()
  → VARIANT_PANEL_OVERRIDES で上書き → DEFAULT_PANELS（export）
    → App.ts で localStorage に保存 → panel-layout.ts がラベルとして使用
```

`fx-7ccy.ts` の `DEFAULT_PANELS` は**直接使われていない**（パネル設定UIの表示用のみ）。  
実際の表示名は `panels.ts` の `FX_7CCY_PANELS` + `VARIANT_PANEL_OVERRIDES` が支配する。

### ニュースフィードの認識経路

```
feeds.ts (FX_7CCY_FEEDS) → FEEDS export（variant分岐）
  → resolveNewsCategories() で isCustom=false として認識
    → ダイジェスト or per-feed fallback でRSSフェッチ
```

fx-7ccyのFEEDSは `feeds.ts` 内に直接定義する（`variants/fx-7ccy.ts` からのインポートは循環依存を起こすため不可）。

### vite.config.ts カスタムプラグイン

| プラグイン | 役割 |
|-----------|------|
| `fxDataPlugin()` | `/api/market/cot-enhanced`, `/api/market/fx-vol` をRedisから直接配信 |
| `fxAiInsightsPlugin()` | `/api/fx/ai-insights` — COT+Vol+Calendar集約→Gemini分析生成 |

両プラグインはsebufApiPlugin()より**前**に登録する必要がある（先にマッチさせるため）。

---

*作成: 2026-05-16 / 更新: 2026-05-24（PC1: ファイルリスト・URL修正 / PC2: AIインサイト・アーキテクチャメモ追記・トラブルシューティング充実）*
