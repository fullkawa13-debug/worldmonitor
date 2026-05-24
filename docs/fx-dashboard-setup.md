# FX 7-Currency Dashboard 導入手順

**対象リポジトリ**: `world-monitor`（AGPL-3.0, github.com/fullkawa13-debug/worldmonitor）  
**バリアント名**: `fx-7ccy`  
**対象通貨**: NZD / CHF / GBP / USD / JPY / EUR / CAD  

---

## 概要

Finance variantをベースに3つのFX専用パネルを追加したダッシュボード。

| パネル | データ源 | 更新周期 |
|--------|---------|---------|
| Policy Rates (7 CCY) | BIS統計 API | 1時間 |
| FX Economic Calendar | FOMC/ECB/Eurostat | 1時間 |
| FX COT Positioning | CFTC COT（先物） | 1時間 |
| FX Volatility & Range | CBOE FX VIX / ECB実現ボラ | 2時間 |

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
```

---

### 3. Redisへのデータ投入（シード）

初回起動前に以下の3スクリプトを実行してRedisにデータを投入します。

```powershell
# BIS統計（政策金利・為替・信用）
node scripts/seed-bis-data.mjs

# 経済カレンダー（FOMC/ECB/Eurostat）
node scripts/seed-economic-calendar.mjs

# COTポジショニング（CFTC先物・52週折り込み度含む）
node scripts/seed-cot.mjs

# FXボラティリティ（CBOE FX VIX + ECB実現ボラ）
node scripts/seed-fx-vol.mjs
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
npm run dev:fx
```

ブラウザで `http://localhost:3000`（使用中なら3001、3002...）を開く。

#### 初回表示時の注意

**ブラウザのlocalStorageをクリアしてから開く**（別バリアントのキャッシュが残っている場合）：

```
F12（開発者ツール）→ Application → Local Storage → http://localhost:3000 → Clear All
```

または、Chromeのシークレットウィンドウで開く。

---

### 5. 動作確認チェックリスト

| 確認項目 | 期待値 |
|---------|-------|
| Policy Rates (7 CCY) | USD/EUR/GBP/JPY/CAD/CHF/NZD の金利バーが表示される |
| FX Economic Calendar | FOMC・ECB等の予定イベントが一覧表示される |
| FX COT Positioning | EC（EUR）・JY（JPY）等の先物ポジションバーと52週折り込み度が表示される |
| FX Volatility & Range | EUR/JPY/GBP のIV（CBOE）とCHF/CAD/NZDのRV（ECB）が表示される |
| マップ | 中央銀行・金融センター・貿易ルートのレイヤーが表示される |
| FX Headlines | Forex/通貨ニュースが流れる |

---

## 既知の制限事項

| 項目 | 内容 |
|-----|-----|
| NZD の政策金利 | BISがNZ（ニュージーランド）のデータを提供していないため未表示 |
| 経済カレンダー | FRED_API_KEY未設定時はFOMC/ECB/Eurostatの3件のみ（件数が少ない） |
| COTデータ | 毎週金曜更新（CFTC公開タイミング依存）。週明けは前週データを表示 |
| Premium機能 | Daily Market Brief / AI Insightsはサインイン不要だが一部機能はPremiumアカウント必要 |

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

---

*作成: 2026-05-16 / 更新: 2026-05-24（FxVolatilityPanel・seed-fx-vol・APIファイル追記、リポジトリURL修正）*
