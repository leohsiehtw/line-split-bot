// 指令解析與回覆。這裡不碰 LINE API，只吃文字、回文字，方便測試與本機模擬。

import { parseAmount, formatAmount } from './money.js';
import { splitExpense, computeBalances, settle } from './settle.js';

export const HELP = `💸 分帳機器人用法
（指令前面要加 /，「我」代表你自己）

👥 成員
/me　把自己加進成員
/@小華 @小美　把 @ 到的人加進成員
/add 小明 小華　直接打名字新增成員
/members　看成員
/remove 小美　移除（沒有帳目的）成員

📝 記帳
/pay 900 晚餐
　→ 你付 900，所有成員平分
/pay 小明 900 晚餐
　→ 小明付 900，所有成員平分
/pay 小明 900 晚餐 for 小明 小華
　→ 只有小明、小華平分
/pay 小明 1000 住宿 for 小華:600 小美
　→ 小華 600，剩下的小美負擔
/pay 小明 1200 計程車 except 小美
　→ 小美以外的成員平分

🔁 /repay 小華 小明 300
　→ 小華已經還小明 300

📋 /list　看所有帳目
🗑 /delete 3　刪除第 3 筆
💰 /settle　算出誰要轉多少給誰
🧹 /clear confirm　結清後清空帳目`;

const ME = new Set(['我', '自己', 'me', 'Me', 'ME']);
const SPLIT_ONLY = new Set(['for', 'only', '分', '分給', '平分', '給']);
const SPLIT_EXCEPT = new Set(['except', '除了', '不含', '扣掉']);
const CONFIRM = new Set(['confirm', 'yes', '確認']);
const MAX_LIST = 40;
// 指令以英文為主，舊的中文指令仍然可用。
const ALIASES = {
  help: ['help', '說明', '幫助', '分帳'],
  me: ['me', '加入'],
  add: ['add', '成員'],
  members: ['members'],
  remove: ['remove', '移除'],
  pay: ['pay', '記帳', '記', '+'],
  repay: ['repay', '還款', '還錢'],
  list: ['list', '明細', '帳目'],
  delete: ['delete', 'del', '刪除'],
  settle: ['settle', '結算'],
  clear: ['clear', '清空'],
};
const COMMANDS = new Map(Object.entries(ALIASES).flatMap(([cmd, names]) => names.map((n) => [n, cmd])));

class UserError extends Error {}

/**
 * 「/pay」「／PAY」「/記帳」→「pay」，「/@小華」→「@」（@ 誰就把誰加進成員）。
 * 不是斜線開頭的已知指令就回傳 null。
 */
function commandName(word) {
  const m = /^[/／](.+)$/.exec(word ?? '');
  if (!m) return null;
  if (/^[@＠]./.test(m[1])) return '@';
  return COMMANDS.get(m[1].toLowerCase()) ?? null;
}

function cleanName(raw) {
  return raw.replace(/^[@＠]/, '').trim();
}

export function createBot(store) {
  /**
   * @param {{chatId: string, senderName: string | null, text: string}} msg
   * @returns {Promise<string | null>} 要回覆的文字；不是指令就回傳 null（不打擾群組聊天）。
   */
  async function handle({ chatId, senderName, text }) {
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;
    const [first, ...args] = tokens;
    const cmd = commandName(first);
    if (!cmd) return null;

    const resolve = (raw) => {
      const name = cleanName(raw);
      if (ME.has(name)) {
        if (!senderName) throw new UserError('讀不到你的 LINE 名稱，請直接打名字代替「我」。');
        return senderName;
      }
      if (!name) throw new UserError('名字不能是空的。');
      return name;
    };

    try {
      switch (cmd) {
        case 'help':
          return HELP;
        case 'me':
          return await members(['我']);
        case '@':
          return await members([first.slice(1), ...args]);
        case 'add':
          return await members(args);
        case 'members':
          return await members([]);
        case 'remove':
          return await removeMember(args);
        case 'pay':
          return await addExpense(args);
        case 'repay':
          return await repay(args);
        case 'list':
          return await list();
        case 'delete':
          return await remove(args);
        case 'settle':
          return await settlement();
        case 'clear':
          return await clear(args);
        default:
          return null;
      }
    } catch (err) {
      if (err instanceof UserError) return `⚠️ ${err.message}`;
      throw err;
    }

    async function members(names) {
      if (names.length === 0) {
        const all = await store.members(chatId);
        return all.length ? `👥 成員（${all.length} 人）：${all.join('、')}` : '還沒有成員，輸入「/me」加入自己，或「/add 小明 小華」新增。';
      }
      const added = await store.addMembers(chatId, names.map(resolve));
      const all = await store.members(chatId);
      const head = added.length ? `✅ 新增：${added.join('、')}` : '這些人都已經是成員了。';
      return `${head}\n👥 成員（${all.length} 人）：${all.join('、')}`;
    }

    async function removeMember(args) {
      if (args.length !== 1) throw new UserError('用法：/remove 小美');
      const name = resolve(args[0]);
      const used = (await store.expenses(chatId))
        .filter((e) => e.payer === name || e.shares.some((s) => s.name === name))
        .map((e) => `#${e.no}`);
      if (used.length) throw new UserError(`${name} 還在帳目 ${used.join('、')} 裡，先刪除那些帳目才能移除。`);
      return await store.removeMember(chatId, name) ? `✅ 已移除 ${name}` : `${name} 不是成員。`;
    }

    async function addExpense(args) {
      const usage = '用法：/pay 小明 900 晚餐（或「/pay 900 晚餐」代表你付的）';
      let payerRaw;
      let amount = parseAmount(args[0] ?? '');
      let rest;
      if (amount != null) {
        payerRaw = '我';
        rest = args.slice(1);
      } else {
        payerRaw = args[0];
        amount = parseAmount(args[1] ?? '');
        rest = args.slice(2);
      }
      if (!payerRaw || amount == null) throw new UserError(usage);
      if (amount <= 0) throw new UserError('金額要大於 0。');
      const payer = resolve(payerRaw);

      const kwIdx = rest.findIndex((t) => SPLIT_ONLY.has(t) || SPLIT_EXCEPT.has(t));
      const noteTokens = kwIdx === -1 ? rest : rest.slice(0, kwIdx);
      const note = noteTokens.join(' ') || '（未命名）';

      let participants;
      const newMembers = [payer];
      if (kwIdx === -1) {
        const all = await store.members(chatId);
        if (!all.includes(payer)) all.push(payer);
        if (all.length < 2) {
          throw new UserError('目前只有一位成員，請其他人輸入「/me」加入，或在記帳後面加「for 小明 小華」。');
        }
        participants = all.map((name) => ({ name }));
      } else if (SPLIT_EXCEPT.has(rest[kwIdx])) {
        const excluded = new Set(rest.slice(kwIdx + 1).map(resolve));
        if (excluded.size === 0) throw new UserError('「except」後面要接名字。');
        const all = await store.members(chatId);
        if (!all.includes(payer)) all.push(payer);
        const unknown = [...excluded].filter((n) => !all.includes(n));
        if (unknown.length) throw new UserError(`${unknown.join('、')} 不是成員。`);
        participants = all.filter((n) => !excluded.has(n)).map((name) => ({ name }));
        if (participants.length === 0) throw new UserError('全部人都被排除了。');
      } else {
        const specs = rest.slice(kwIdx + 1);
        if (specs.length === 0) throw new UserError('「for」後面要接名字，例如：for 小明 小華');
        participants = specs.map((spec) => {
          const m = spec.match(/^(.+?)[:：=](.+)$/);
          if (!m) return { name: resolve(spec) };
          const fixed = parseAmount(m[2]);
          if (fixed == null) throw new UserError(`看不懂「${spec}」的金額。`);
          return { name: resolve(m[1]), fixed };
        });
        newMembers.push(...participants.map((p) => p.name));
      }

      let shares;
      try {
        shares = splitExpense(amount, participants);
      } catch (err) {
        throw new UserError(err.message);
      }
      const added = await store.addMembers(chatId, newMembers);
      const no = await store.addExpense(chatId, { payer, amount, note, shares, createdBy: senderName ?? '' });

      const lines = [`✅ #${no} ${note} ${formatAmount(amount)}（${payer} 付）`, formatShares(shares)];
      if (added.length) lines.push(`👥 新成員：${added.join('、')}`);
      return lines.join('\n');
    }

    async function repay(args) {
      if (args.length !== 3) throw new UserError('用法：/repay 小華 小明 300（小華還給小明 300）');
      const from = resolve(args[0]);
      const to = resolve(args[1]);
      const amount = parseAmount(args[2]);
      if (amount == null || amount <= 0) throw new UserError('金額看不懂。');
      if (from === to) throw new UserError('不能還錢給自己。');
      // 還款就是「from 幫 to 付了 amount」，記成一筆只有 to 分攤的支出即可抵銷。
      const added = await store.addMembers(chatId, [from, to]);
      const no = await store.addExpense(chatId, {
        payer: from,
        amount,
        note: '還款',
        shares: [{ name: to, cents: amount }],
        createdBy: senderName ?? '',
      });
      const lines = [`✅ #${no} ${from} 還給 ${to} ${formatAmount(amount)}`];
      if (added.length) lines.push(`👥 新成員：${added.join('、')}`);
      return lines.join('\n');
    }

    async function list() {
      const all = await store.expenses(chatId);
      if (all.length === 0) return '📋 目前沒有帳目。';
      const total = all.filter((e) => e.note !== '還款').reduce((s, e) => s + e.amount, 0);
      const shown = all.slice(-MAX_LIST);
      const lines = [`📋 帳目（${all.length} 筆，支出合計 ${formatAmount(total)}）`];
      if (shown.length < all.length) lines.push(`…只顯示最後 ${MAX_LIST} 筆`);
      for (const e of shown) {
        if (e.note === '還款' && e.shares.length === 1) {
          lines.push(`#${e.no} 🔁 ${e.payer} → ${e.shares[0].name} ${formatAmount(e.amount)}`);
        } else {
          lines.push(`#${e.no} ${e.note} ${formatAmount(e.amount)}｜${e.payer} 付｜${e.shares.map((s) => s.name).join('、')}`);
        }
      }
      return lines.join('\n');
    }

    async function remove(args) {
      const no = Number(String(args[0] ?? '').replace(/^#/, ''));
      if (!Number.isInteger(no) || no <= 0) throw new UserError('用法：/delete 3（編號請看「/list」）');
      return await store.deleteExpense(chatId, no) ? `🗑 已刪除 #${no}` : `找不到 #${no}。`;
    }

    async function settlement() {
      const all = await store.expenses(chatId);
      if (all.length === 0) return '💰 目前沒有帳目，不用轉帳。';
      const balances = computeBalances(all);
      const transfers = settle(balances);
      if (transfers.length === 0) return '💰 大家都結清了，不用轉帳 🎉';

      const lines = ['💰 結算結果', ''];
      for (const t of transfers) lines.push(`${t.from} → ${t.to}　${formatAmount(t.cents)}`);
      lines.push('', '各人收支（+ 是應收，- 是應付）：');
      const sorted = [...balances].filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
      for (const [name, v] of sorted) lines.push(`${name} ${v > 0 ? '+' : ''}${formatAmount(v)}`);
      lines.push('', '轉完帳後可輸入「/repay A B 金額」記錄，或「/clear confirm」重新開始。');
      return lines.join('\n');
    }

    async function clear(args) {
      if (!CONFIRM.has(String(args[0]).toLowerCase())) return '⚠️ 這會刪除這個聊天室的所有帳目（成員會保留）。確定的話請輸入「/clear confirm」。';
      const n = await store.clearExpenses(chatId);
      return `🧹 已清空 ${n} 筆帳目。`;
    }
  }

  return { handle, isCommand: (word) => commandName(word) != null };
}

function formatShares(shares) {
  const amounts = new Set(shares.map((s) => s.cents));
  if (amounts.size === 1) {
    return `👥 ${shares.map((s) => s.name).join('、')} 每人 ${formatAmount(shares[0].cents)}`;
  }
  return `👥 ${shares.map((s) => `${s.name} ${formatAmount(s.cents)}`).join('、')}`;
}
