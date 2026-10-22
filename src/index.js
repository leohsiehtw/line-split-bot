// Cloudflare Worker 入口：接收 LINE webhook、驗證簽章、回覆訊息。
// 需要的設定（見 README）：D1 綁定 DB、secret CHANNEL_SECRET、CHANNEL_ACCESS_TOKEN。

import { Store } from './store.js';
import { createBot, HELP } from './bot.js';

const LINE_API = 'https://api.line.me/v2/bot';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET') return new Response('LINE 分帳機器人運作中');
    if (request.method !== 'POST' || url.pathname !== '/webhook') return new Response('Not found', { status: 404 });

    const body = await request.text();
    const ok = await verifySignature(body, request.headers.get('x-line-signature'), (env.CHANNEL_SECRET ?? '').trim());
    if (!ok) return new Response('Bad signature', { status: 401 });

    const { events = [] } = JSON.parse(body);
    const line = lineClient((env.CHANNEL_ACCESS_TOKEN ?? '').trim());
    const bot = createBot(new Store(env.DB));
    // 先回 200 給 LINE，事件在背景處理。
    ctx.waitUntil(
      Promise.all(
        events.map((e) =>
          handleEvent(e, bot, line).catch((err) => console.error(`event failed: ${err.message}`, err.stack)),
        ),
      ),
    );
    return new Response('OK');
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
    reply: (replyToken, text) =>
      call('POST', '/message/reply', {
        replyToken,
        messages: [{ type: 'text', text: text.slice(0, 5000), quickReply: QUICK_REPLY }],
      }),
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

async function handleEvent(event, bot, line) {
  if (event.type === 'join' || event.type === 'follow') return line.reply(event.replyToken, HELP);
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const { source } = event;
  const chatId = source.groupId ?? source.roomId ?? source.userId;
  const text = flattenMentions(event.message);
  if (!bot.isCommand(text.trim().split(/\s+/)[0])) return;

  // 對方沒加好友等情況可能拿不到名稱，這時「我」就無法使用。
  const senderName = source.userId
    ? await line.profile(source).then((p) => normalizeName(p.displayName), () => null)
    : null;
  const out = await bot.handle({ chatId, senderName, text });
  if (out) await line.reply(event.replyToken, out);
}
