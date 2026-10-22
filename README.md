# LINE 分帳機器人「分帳小幫手」

聚餐、旅遊時，在 LINE 群組裡記下誰先付了錢，機器人會自動算出「誰要轉多少給誰」，而且轉帳筆數盡量少。

## 使用說明

### 開始使用

1. 掃 QR code 或搜尋 ID `@042zvtal`，把「分帳小幫手」**加為好友**。
2. 在群組裡按「邀請」，從好友名單選「分帳小幫手」。
3. 在群組輸入 `/說明`，就會看到指令清單。

一對一私訊機器人也可以用，適合自己記帳試試看。**每個群組各自一本帳**，互不影響。

### 三個規則

- **指令前面一定要加斜線** `/`（全形 `／` 也可以）。沒有斜線的訊息機器人一律不理，不會吵到大家聊天。
- **「我」代表你自己**，機器人會自動換成你的 LINE 名稱（名稱中間的空白會被去掉，例如 `Leo Hsieh` → `LeoHsieh`）。
- 指令和名字、金額之間**用空白隔開**。

### 指令一覽

| 指令 | 意思 |
|---|---|
| `/成員 小明 小華 小美` | 新增成員 |
| `/成員` | 查看目前成員 |
| `/記帳 900 晚餐` | **我**付了 900，所有成員平分 |
| `/記帳 小明 900 晚餐` | 小明付了 900，所有成員平分 |
| `/記帳 小明 900 晚餐 分 小明 小華` | 只有小明、小華平分 |
| `/記帳 小明 1200 計程車 除了 小美` | 除了小美，其他成員平分 |
| `/記帳 小明 1000 住宿 分 小華:600 小美` | 小華固定出 600，剩下的小美出 |
| `/明細` | 列出所有帳目和編號 |
| `/刪除 3` | 記錯了，刪掉第 3 筆 |
| `/結算` | 算出誰要轉多少給誰 |
| `/還款 小華 小明 300` | 小華已經轉給小明 300 |
| `/清空 確認` | 全部結清後，清空帳目重新開始（成員會保留） |
| `/移除 小美` | 移除成員（只能移除沒出現在帳目裡的人） |
| `/說明` | 顯示指令清單 |

金額可以寫 `1200`、`1,200`、`$300`、`300元` 或 `45.5`。

### 範例：三個人出去玩

先設好成員：

```
/成員 小明 小華 小美
```

邊玩邊記，誰付錢誰就記一筆：

```
/記帳 小明 1,800 晚餐                → 三人各 600
/記帳 小華 1200 住宿 分 小華 小美      → 小明沒住，小華、小美各 600
/記帳 小美 300 飲料 除了 小明          → 小明沒喝，小華、小美各 150
```

回家後輸入 `/結算`，機器人回覆：

```
💰 結算結果

小美 → 小明　1,050
小華 → 小明　150

各人收支（+ 是應收，- 是應付）：
小明 +1,200
小華 -150
小美 -1,050
```

照著轉帳就結清了。如果有人先轉了一部分，可以用 `/還款 小華 小明 150` 記下來，再 `/結算` 就會算出剩下的。全部轉完後輸入 `/清空 確認`，下次出遊重新開始。

### 常見問題

- **記錯了怎麼辦？** 用 `/明細` 找到那筆的編號，`/刪除 編號` 刪掉後重記。
- **錢除不盡怎麼辦？** 整數金額會以 1 元為單位分，多出來的 1 元會給前面幾個人，不會出現 333.33 這種零頭。
- **機器人說讀不到你的名稱？** 對方要先加機器人好友才讀得到。或者不要用「我」，直接打名字。
- **轉帳次數是最少的嗎？** 結算的方法是讓「欠最多的人先付給被欠最多的人」，n 個人最多 n-1 筆轉帳，一般情況就是最少筆數。
- **用 @ 提及可以嗎？** 可以，例如 `/記帳 @小明 900 晚餐`，名字裡的空白會自動去掉。

---

以下是給維護者看的開發與部署說明。

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
4. 在 [LINE Official Account Manager](https://manager.line.biz/) 的「設定 → 回應設定」：「Webhook」打開、「自動回應訊息」關掉、「回應時間」關掉。
5. 「設定 → 帳號設定 → 功能切換」：「加入群組或多人聊天室」改成「接受邀請」。

### 2. 建立資料庫

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)，左側選 **Storage & Databases → D1 SQL Database → Create**，名稱填 `line-split-bot`。
2. 建好後複製畫面上的 **Database ID**，貼到這個 repo 的 `wrangler.toml` 取代 `REPLACE_WITH_YOUR_DATABASE_ID`，commit 到 GitHub。

資料表不用手動建，部署時會自動建立（`migrations/` 資料夾）。

### 3. 從 GitHub 部署 Worker

1. Cloudflare Dashboard 左側選 **Compute (Workers) → Workers & Pages → Create → Import a repository**，連結 GitHub 並選這個 repo。
2. **Build command** 留空，**Deploy command** 填 `npm run deploy`，其餘用預設值，按 Deploy。
3. 部署完成後，到這個 Worker 的 **Settings → Variables and Secrets**，新增兩個 **Secret**：
   - `CHANNEL_SECRET`：步驟 1 的 Channel secret
   - `CHANNEL_ACCESS_TOKEN`：步驟 1 的 access token
4. **Settings → Domains & Routes** 把 workers.dev 的 Production 打開，記下網址，例如 `https://line-split-bot.你的帳號.workers.dev`。

之後只要推新的程式到 GitHub，Cloudflare 就會自動重新部署。

### 4. 接上 LINE

1. 回到 LINE Developers 的 **Messaging API** 頁籤，**Webhook URL** 填 `https://你的Worker網址/webhook`，按 **Verify** 應該會顯示 Success，並打開 **Use webhook**。
2. 用 QR code 加機器人好友，把它拉進群組，輸入「/說明」。

### 用指令列部署（選用）

```bash
npx wrangler login
npx wrangler d1 create line-split-bot          # 把 database_id 貼到 wrangler.toml
npx wrangler secret put CHANNEL_SECRET
npx wrangler secret put CHANNEL_ACCESS_TOKEN
npm run deploy
```

本機開發可以建 `.dev.vars`（寫入 `CHANNEL_SECRET=...` 和 `CHANNEL_ACCESS_TOKEN=...`），執行 `npx wrangler d1 migrations apply DB --local` 後再 `npm run dev`。

## 檔案

- `src/index.js`：Cloudflare Worker 入口，驗證 LINE 簽章、回覆訊息
- `src/bot.js`：指令解析與回覆文字（不依賴 LINE，方便測試）
- `src/settle.js`：平分與結算演算法
- `src/store.js`：D1 資料庫存取
- `migrations/`：資料表定義
- `cli.js`：本機模擬器（用 Node 內建 SQLite 模擬 D1）
