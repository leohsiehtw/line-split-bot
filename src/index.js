// Cloudflare Worker 入口：接收 LINE webhook、驗證簽章、回覆訊息。
// 需要的設定（見 README）：D1 綁定 DB、secret CHANNEL_SECRET、CHANNEL_ACCESS_TOKEN。

import { Store } from './store.js';
import { createBot } from './bot.js';
import { toFlex } from './card.js';
import { legalPage } from './legal.js';

const LINE_API = 'https://api.line.me/v2/bot';
// 機器人離開聊天室多久後刪除資料。
const RETENTION_DAYS = 30;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const page = legalPage(url.pathname);
      if (page) return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      return new Response('LINE 分帳機器人運作中');
    }
    if (request.method !== 'POST' || url.pathname !== '/webhook') return new Response('Not found', { status: 404 });

    const body = await request.text();
    const ok = await verifySignature(body, request.headers.get('x-line-signature'), (env.CHANNEL_SECRET ?? '').trim());
    if (!ok) return new Response('Bad signature', { status: 401 });

    const { events = [] } = JSON.parse(body);
    const line = lineClient((env.CHANNEL_ACCESS_TOKEN ?? '').trim());
    const store = new Store(env.DB);
    const bot = createBot(store, { baseUrl: url.origin });
    // 先回 200 給 LINE，事件在背景處理。
    ctx.waitUntil(
      Promise.all(
        events.map((e) =>
          handleEvent(e, { bot, store, line }).catch((err) => console.error(`event failed: ${err.message}`, err.stack)),
        ),
      ),
    );
    return new Response('OK');
  },

  // 每天跑一次（wrangler.toml 的 crons），刪除機器人已離開超過 30 天的聊天室資料。
  async scheduled(controller, env) {
    const before = new Date(controller.scheduledTime - RETENTION_DAYS * 86400_000);
    const n = await new Store(env.DB).purgeLeftChats(before);
    if (n) console.log(`purged ${n} chats left before ${before.toISOString()}`);
  },
};

async function verifySignature(body, signature, secret) {
  if (!signature || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'verify',
  ]);
  let sig;
  try {
    sig = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }
  return crypto.subtle.verify('HMAC', key, sig, enc.encode(body));
}

function lineClient(token) {
  const call = async (method, path, body) => {
    const res = await fetch(`${LINE_API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`LINE API ${path} ${res.status}: ${await res.text()}`);
    return res.json();
  };
  return {
    /** out 是純文字，或 { text, card }（畫成 Flex 卡片，text 當通知預覽）。 */
    reply(replyToken, out) {
      const message =
        typeof out === 'string'
          ? { type: 'text', text: out.slice(0, 5000) }
          : { type: 'flex', altText: out.text.slice(0, 400), contents: toFlex(out.card) };
      return call('POST', '/message/reply', { replyToken, messages: [{ ...message, quickReply: QUICK_REPLY }] });
    },
    profile(source) {
      if (source.type === 'group') return call('GET', `/group/${source.groupId}/member/${source.userId}`);
      if (source.type === 'room') return call('GET', `/room/${source.roomId}/member/${source.userId}`);
      return call('GET', `/profile/${source.userId}`);
    },
  };
}

// 每則回覆下方的快捷按鈕（LINE Quick Reply），點一下就送出對應指令。
const QUICK_REPLY = {
  items: [
    ['💰 結算', '/settle'],
    ['📋 明細', '/list'],
    ['🙋 加入', '/me'],
    ['👥 成員', '/members'],
    ['❓ 說明', '/help'],
  ].map(([label, text]) => ({ type: 'action', action: { type: 'message', label, text } })),
};

// LINE 名稱可能有空白，統一去掉空白，指令才不會被拆開。
const normalizeName = (name) => name.replace(/\s+/g, '');

/** 把 @提及 的那段文字去掉空白，讓「@Leo Hsieh」變成一個名字「@LeoHsieh」。 */
export function flattenMentions(message) {
  let text = message.text;
  const mentionees = [...(message.mention?.mentionees ?? [])].sort((a, b) => b.index - a.index);
  for (const m of mentionees) {
    const span = text.slice(m.index, m.index + m.length);
    text = text.slice(0, m.index) + normalizeName(span) + text.slice(m.index + m.length);
  }
  return text;
}

async function handleEvent(event, { bot, store, line }) {
  const { source } = event;
  const chatId = source.groupId ?? source.roomId ?? source.userId;
  // 被踢出群組或被封鎖：先記下來，30 天後由排程刪除；期間重新加入就取消。
  if (event.type === 'leave' || event.type === 'unfollow') return store.markLeft(chatId);
  if (event.type === 'join' || event.type === 'follow') {
    await store.unmarkLeft(chatId);
    return line.reply(event.replyToken, bot.help());
  }
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const text = flattenMentions(event.message);
  if (!bot.isCommand(text.trim().split(/\s+/)[0])) return;

  // 對方沒加好友等情況可能拿不到名稱，這時「我」就無法使用。
  const senderName = source.userId
    ? await line.profile(source).then((p) => normalizeName(p.displayName), () => null)
    : null;
  const out = await bot.handle({ chatId, senderName, text });
  if (out) await line.reply(event.replyToken, out);
}
