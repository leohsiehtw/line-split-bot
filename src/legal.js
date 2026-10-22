// 隱私權政策與使用條款：Worker 在 GET /privacy、/terms 直接回傳的靜態頁。
// 修改內容時記得更新 UPDATED，重大變更要在機器人或官方帳號公告。

const SERVICE = '分帳小幫手';
const OPERATOR = '分帳小幫手（個人開發者經營）';
const CONTACT = 'LINE 官方帳號 @042zvtal（加好友後私訊）';
const UPDATED = '2026 年 10 月 22 日';

// 每頁是一串章節：[標題, 段落或清單...]，清單用陣列表示。
const PRIVACY = {
  title: '隱私權政策',
  intro: `${OPERATOR}（以下稱「我們」）依《個人資料保護法》第 8 條，說明${SERVICE} LINE 機器人（以下稱「本服務」）如何蒐集、處理及利用你的個人資料。`,
  sections: [
    ['蒐集者', `${OPERATOR}。聯絡方式：${CONTACT}。`],
    [
      '蒐集目的',
      '提供群組分帳、記帳與結算服務，以及維持服務正常運作（除錯、防止濫用）。',
      '對應法定特定目的：〇九〇 消費者、客戶管理與服務；一三五 資（通）訊服務。',
    ],
    [
      '蒐集的資料',
      [
        'LINE 群組、多人聊天室或一對一聊天的識別碼，用來區分每個聊天室各自的帳本。',
        '成員名稱：你或其他成員輸入的名字，或你使用「我」「/me」時從 LINE 取得的顯示名稱（去除空白）。',
        '帳目內容：金額、項目說明、付款人、分攤對象與金額、記帳者名稱、記帳時間。',
        '錯誤紀錄：系統發生錯誤時的技術訊息，可能包含上述資料片段。',
      ],
      '我們不會保存你的 LINE 使用者 ID、大頭貼或一般聊天內容。機器人只處理以「/」開頭的指令，其他訊息雖然會由 LINE 傳送到伺服器，但會直接略過、不寫入資料庫。',
    ],
    [
      '利用期間',
      [
        '帳目與成員資料：保存到你刪除為止。',
        '機器人被移出群組或被封鎖後，資料保留 30 天（期間重新加入可繼續使用），30 天後自動刪除。',
        '資料庫備份：刪除後最長 30 天內仍可能存在於系統備份中，之後自動覆蓋。',
        '錯誤紀錄：最長保留 7 天。',
      ],
    ],
    [
      '利用地區',
      '本服務架設在 Cloudflare, Inc.（美國公司）的 Cloudflare Workers 與 D1 資料庫上，資料存放及處理的機房位於中華民國境外。訊息傳遞則經由 LY Corporation（LINE）的伺服器，依 LINE 自己的隱私權政策處理。',
    ],
    [
      '利用對象與方式',
      '資料只用於本服務的功能，以電腦自動處理。同一個聊天室的成員都能看到並修改該聊天室的帳目。除前述雲端服務商代為儲存與傳輸、或依法律規定配合主管機關調查外，我們不會將資料提供、出售或出租給第三人，也不會用於廣告。',
    ],
    [
      '你的權利',
      '依《個人資料保護法》第 3 條，你可以查詢、閱覽、請求製給複本、補充或更正、停止蒐集處理利用，以及刪除你的個人資料：',
      [
        '查詢與閱覽：在聊天室輸入 /list、/members。',
        '更正：/delete 編號 刪除記錯的帳目後重記；/remove 名字 移除成員。',
        '刪除整個聊天室的資料：輸入 /deletedata confirm，立即永久刪除。',
        '其他請求（例如只刪除你自己的名字，或你已不在該群組）：請透過上述聯絡方式提出，我們會在 15 天內處理。',
      ],
    ],
    ['不提供資料的影響', '你可以不提供任何資料，但這樣就無法使用記帳功能；也可以不使用「我」，改由其他成員輸入名字。'],
    [
      '資料安全',
      '我們使用 HTTPS 加密傳輸、驗證每一則 LINE 訊息的簽章，並限制只有營運者能存取資料庫與金鑰。如果發生個人資料外洩，我們會依法通知受影響的使用者。',
    ],
    ['兒童', '本服務不是為未滿 13 歲的兒童設計。如果你未滿 18 歲，請在法定代理人同意下使用。'],
    ['政策變更', '本政策修改時會更新本頁日期；重大變更會在機器人回覆或 LINE 官方帳號公告。'],
  ],
};

const TERMS = {
  title: '使用條款',
  intro: `歡迎使用${SERVICE}（以下稱「本服務」）。把機器人加入聊天室或輸入指令，就表示你同意以下條款。`,
  sections: [
    ['服務內容', `本服務由${OPERATOR}提供，幫 LINE 聊天室記錄共同支出，並計算成員間應轉帳的金額。本服務不經手、不保管任何款項，實際轉帳由成員自行完成。`],
    [
      '費用',
      '本服務目前免費。未來若推出付費方案，會在付款前清楚告知價格、內容與退費方式，並另外取得你的同意；不付費的使用者不會被自動收費。',
    ],
    [
      '計算結果僅供參考',
      '結算結果依成員輸入的帳目自動計算，可能因輸入錯誤、四捨五入或系統異常而與實際不符。轉帳前請自行確認金額；成員之間的債務關係與爭議由成員自行處理。',
    ],
    [
      '使用者的責任',
      [
        '聊天室中的每位成員都能新增、修改、刪除帳目與成員，或刪除整個聊天室的資料，請只把機器人加入你信任的聊天室。',
        '請不要在項目說明中輸入身分證字號、帳號密碼、銀行帳號等敏感資料。',
        '不得利用本服務從事違法行為，或以大量請求、攻擊等方式干擾服務運作。違反時我們可以停止對該聊天室提供服務。',
      ],
    ],
    ['個人資料', '我們依隱私權政策處理你的個人資料。'],
    [
      '服務變更、中斷與終止',
      '我們可能因維護、雲端服務商或 LINE 平台異常而暫停服務，會盡量提前公告。若決定終止本服務，會至少提前 30 天在 LINE 官方帳號公告，期間你可以用 /list 留存帳目，終止後所有資料會被刪除。',
    ],
    [
      '責任限制',
      '本服務依現況提供。在法律允許的範圍內，我們不對因使用或無法使用本服務造成的間接損失負責；但因我們的故意或重大過失造成的損害，不在此限。',
    ],
    ['條款修改', '條款修改時會更新本頁日期；重大變更會事先公告，公告後繼續使用即表示同意修改後的條款。'],
    ['準據法', '本條款以中華民國法律為準據法。因本服務產生的爭議，依民事訴訟法規定的管轄法院處理。'],
    ['聯絡我們', `${CONTACT}。`],
  ],
};

const PAGES = { '/privacy': PRIVACY, '/terms': TERMS };

const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function block(part) {
  if (Array.isArray(part)) return `<ul>${part.map((li) => `<li>${escape(li)}</li>`).join('')}</ul>`;
  return `<p>${escape(part)}</p>`;
}

function render(page, other) {
  const sections = page.sections
    .map(([heading, ...parts]) => `<h2>${escape(heading)}</h2>${parts.map(block).join('')}`)
    .join('\n');
  return `<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${SERVICE}｜${page.title}</title>
<style>
  :root { --fg: #1f2328; --muted: #6b7280; --bg: #ffffff; --line: #e5e7eb; --accent: #06c755; }
  @media (prefers-color-scheme: dark) { :root { --fg: #e6e6e6; --muted: #9ca3af; --bg: #16181d; --line: #2d3139; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.75 -apple-system, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 32px 20px 64px; }
  header { border-bottom: 3px solid var(--accent); padding-bottom: 12px; margin-bottom: 24px; }
  h1 { font-size: 1.6rem; margin: 0; }
  .meta { color: var(--muted); font-size: .875rem; margin: 4px 0 0; }
  h2 { font-size: 1.1rem; margin: 28px 0 8px; }
  p, ul { margin: 8px 0; }
  ul { padding-left: 1.3em; }
  nav { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--line); font-size: .9rem; }
  a { color: var(--accent); }
</style>
</head>
<body>
<main>
<header>
<h1>${SERVICE} ${page.title}</h1>
<p class="meta">最後更新：${UPDATED}</p>
</header>
<p>${escape(page.intro)}</p>
${sections}
<nav><a href="${other.path}">${other.title}</a></nav>
</main>
</body>
</html>`;
}

/** 依網址路徑回傳對應的 HTML，不是條款頁就回傳 null。 */
export function legalPage(pathname) {
  const page = PAGES[pathname];
  if (!page) return null;
  const otherPath = pathname === '/privacy' ? '/terms' : '/privacy';
  return render(page, { path: otherPath, title: PAGES[otherPath].title });
}
