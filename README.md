# LINE 分帳機器人

聚餐、旅遊時在 LINE 群組裡記下誰先付了錢，機器人自動算出「誰要轉多少給誰」，而且轉帳筆數盡量少。

## 指令

把機器人拉進群組後輸入「說明」就會看到這份清單。「我」代表發訊息的人自己的 LINE 名稱。

| 指令 | 意思 |
|---|---|
| `成員 小明 小華 小美` | 新增成員（只輸入 `成員` 是查看） |
| `記帳 小明 900 晚餐` | 小明付 900，所有成員平分 |
| `記帳 900 晚餐` | 我付的，所有成員平分 |
| `記帳 小明 900 晚餐 分 小明 小華` | 只有指定的人平分 |
| `記帳 小明 1000 住宿 分 小華:600 小美` | 小華固定 600，剩下的小美負擔 |
| `記帳 小明 1200 計程車 除了 小美` | 小美以外的成員平分 |
| `還款 小華 小明 300` | 小華已經還小明 300 |
| `明細` | 列出所有帳目和編號 |
| `刪除 3` | 刪除第 3 筆 |
| `結算` | 算出誰要轉多少給誰 |
| `清空 確認` | 結清後清空帳目（成員保留） |
| `移除 小美` | 移除沒有出現在帳目裡的成員 |

不是指令開頭的訊息機器人不會回應，不會干擾群組聊天。每個群組各自一本帳。

金額可以寫 `1,200`、`$300`、`45.5`、`300元`。整數金額平分時以「元」為單位，除不盡的 1 元會分給前面幾個人，不會出現 333.33 這種零頭。

## 先在電腦上試玩（不需要 LINE）

需要 Node.js 22.13 以上。

```bash
npm install
npm run cli        # 互動模擬器，輸入「/名字 小華」可以切換發言的人
npm test
```

## 部署到 Cloudflare（免費）

跑在 Cloudflare Workers 上，帳目存在 Cloudflare D1 資料庫。免費額度是每天 10 萬次請求、5 GB 資料庫，一般群組分帳用不完。以下全部在網頁上完成，不用在電腦上裝任何東西。

### 1. 建立 LINE 機器人

1. 到 [LINE Developers Console](https://developers.line.biz/console/) 建立 Provider，再建立一個 **Messaging API** channel。
2. **Basic settings** 頁籤：複製 **Channel secret**。
3. **Messaging API** 頁籤：發行並複製 **Channel access token (long-lived)**，再打開 **Allow bot to join group chats**。
4. 在 LINE Official Account Manager 的「回應設定」把「自動回應訊息」關掉，「Webhook」打開。

### 2. 建立資料庫

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)，左側選 **Storage & Databases → D1 SQL Database → Create**，名稱填 `line-split-bot`。
2. 建好後複製畫面上的 **Database ID**，貼到這個 repo 的 `wrangler.toml` 取代 `REPLACE_WITH_YOUR_DATABASE_ID`，commit 到 GitHub。

資料表不用手動建，部署時會自動建立（`migrations/` 資料夾）。

### 3. 從 GitHub 部署 Worker

1. Cloudflare Dashboard 左側選 **Compute (Workers) → Workers & Pages → Create → Import a repository**，連結 GitHub 並選這個 repo。
2. **Deploy command** 填 `npm run deploy`，其餘用預設值，按 Deploy。
3. 部署完成後，到這個 Worker 的 **Settings → Variables and Secrets**，新增兩個 **Secret**：
   - `CHANNEL_SECRET`：步驟 1 的 Channel secret
   - `CHANNEL_ACCESS_TOKEN`：步驟 1 的 access token
4. 記下 Worker 的網址，例如 `https://line-split-bot.你的帳號.workers.dev`。

之後只要推新的程式到 GitHub，Cloudflare 就會自動重新部署。

### 4. 接上 LINE

1. 回到 LINE Developers 的 **Messaging API** 頁籤，**Webhook URL** 填 `https://你的Worker網址/webhook`，按 **Verify** 應該會顯示 Success，並打開 **Use webhook**。
2. 用 QR code 加機器人好友，把它拉進群組，輸入「說明」。

### 用指令列部署（選用）

```bash
npx wrangler login
npx wrangler d1 create line-split-bot          # 把 database_id 貼到 wrangler.toml
npx wrangler secret put CHANNEL_SECRET
npx wrangler secret put CHANNEL_ACCESS_TOKEN
npm run deploy
```

本機開發可以建 `.dev.vars`（寫入 `CHANNEL_SECRET=...` 和 `CHANNEL_ACCESS_TOKEN=...`），執行 `npx wrangler d1 migrations apply DB --local` 後再 `npm run dev`。

## 小提醒

- 「我」需要讀取發訊息者的 LINE 名稱。名稱裡的空白會被去掉（`Leo Hsieh` → `LeoHsieh`），用 @提及 也一樣。如果讀不到名稱，直接打名字即可。
- 結算用的是「欠最多的人先付給被欠最多的人」，最多 n-1 筆轉帳，一般情況就是最少筆數。

## 檔案

- `src/index.js`：Cloudflare Worker 入口，驗證 LINE 簽章、回覆訊息
- `src/bot.js`：指令解析與回覆文字（不依賴 LINE，方便測試）
- `src/settle.js`：平分與結算演算法
- `src/store.js`：D1 資料庫存取
- `migrations/`：資料表定義
- `cli.js`：本機模擬器（用 Node 內建 SQLite 模擬 D1）
