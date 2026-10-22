// 分帳計算：拆分每筆支出、計算每人淨額、產生轉帳清單。

/**
 * 把一筆支出拆給參與者。
 * @param {number} amount 總額（分）
 * @param {{name: string, fixed?: number}[]} participants fixed 為指定金額（分），沒給的人平分剩下的
 * @returns {{name: string, cents: number}[]}
 */
export function splitExpense(amount, participants) {
  if (participants.length === 0) throw new Error('沒有分攤的人');
  const names = participants.map((p) => p.name);
  if (new Set(names).size !== names.length) throw new Error('分攤名單有重複的人');

  const fixedSum = participants.reduce((s, p) => s + (p.fixed ?? 0), 0);
  const equal = participants.filter((p) => p.fixed == null);
  const rest = amount - fixedSum;
  if (rest < 0) throw new Error('指定金額加起來超過總額');
  if (equal.length === 0 && rest !== 0) throw new Error('指定金額加起來不等於總額');

  // 金額都是整數元時以「元」為單位平分，避免出現 333.33 這種零頭。
  const allWhole = amount % 100 === 0 && participants.every((p) => (p.fixed ?? 0) % 100 === 0);
  const unit = allWhole ? 100 : 1;
  const units = rest / unit;
  const base = equal.length ? Math.floor(units / equal.length) : 0;
  let extra = equal.length ? units - base * equal.length : 0;

  return participants.map((p) => {
    if (p.fixed != null) return { name: p.name, cents: p.fixed };
    const cents = (base + (extra > 0 ? 1 : 0)) * unit;
    if (extra > 0) extra -= 1;
    return { name: p.name, cents };
  });
}

/** 每人淨額：正數代表別人欠他，負數代表他欠別人。 */
export function computeBalances(expenses) {
  const bal = new Map();
  const add = (name, v) => bal.set(name, (bal.get(name) ?? 0) + v);
  for (const e of expenses) {
    add(e.payer, e.amount);
    for (const s of e.shares) add(s.name, -s.cents);
  }
  return bal;
}

/**
 * 由淨額產生轉帳清單：每次讓「欠最多的人」付給「被欠最多的人」，
 * 最多 n-1 筆轉帳，實務上通常就是最少筆數。
 * @returns {{from: string, to: string, cents: number}[]}
 */
export function settle(balances) {
  const debtors = [];
  const creditors = [];
  for (const [name, v] of balances) {
    if (v < 0) debtors.push({ name, v: -v });
    else if (v > 0) creditors.push({ name, v });
  }
  const transfers = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.v - a.v);
    creditors.sort((a, b) => b.v - a.v);
    const d = debtors[0];
    const c = creditors[0];
    const pay = Math.min(d.v, c.v);
    transfers.push({ from: d.name, to: c.name, cents: pay });
    d.v -= pay;
    c.v -= pay;
    if (d.v === 0) debtors.shift();
    if (c.v === 0) creditors.shift();
  }
  return transfers;
}
