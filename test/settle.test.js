import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, formatAmount } from '../src/money.js';
import { splitExpense, computeBalances, settle } from '../src/settle.js';

test('parseAmount 接受常見寫法', () => {
  assert.equal(parseAmount('900'), 90000);
  assert.equal(parseAmount('1,200'), 120000);
  assert.equal(parseAmount('$45.5'), 4550);
  assert.equal(parseAmount('300元'), 30000);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('1,20'), null);
});

test('formatAmount', () => {
  assert.equal(formatAmount(120000), '1,200');
  assert.equal(formatAmount(-4550), '-45.50');
});

test('整數金額以元為單位平分，總和不變', () => {
  const shares = splitExpense(100000, [{ name: 'a' }, { name: 'b' }, { name: 'c' }]);
  assert.deepEqual(shares.map((s) => s.cents), [33400, 33300, 33300]);
});

test('有小數時以分為單位平分', () => {
  const shares = splitExpense(1001, [{ name: 'a' }, { name: 'b' }, { name: 'c' }]);
  assert.deepEqual(shares.map((s) => s.cents), [334, 334, 333]);
});

test('指定金額 + 其餘平分', () => {
  const shares = splitExpense(100000, [{ name: 'a', fixed: 60000 }, { name: 'b' }, { name: 'c' }]);
  assert.deepEqual(shares.map((s) => s.cents), [60000, 20000, 20000]);
  assert.throws(() => splitExpense(100, [{ name: 'a', fixed: 200 }]));
  assert.throws(() => splitExpense(100, [{ name: 'a', fixed: 50 }]));
  assert.throws(() => splitExpense(100, [{ name: 'a' }, { name: 'a' }]));
});

test('結算後每個人都歸零，且轉帳筆數不超過 n-1', () => {
  // 隨機產生帳目，檢查轉帳完全抵銷淨額
  for (let round = 0; round < 200; round++) {
    const people = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, 2 + (round % 5));
    const expenses = [];
    for (let i = 0; i < 10; i++) {
      const payer = people[Math.floor(Math.random() * people.length)];
      const amount = (1 + Math.floor(Math.random() * 5000)) * (i % 2 ? 1 : 100);
      const parts = people.filter(() => Math.random() < 0.7);
      if (parts.length === 0) continue;
      expenses.push({ payer, amount, shares: splitExpense(amount, parts.map((name) => ({ name }))) });
    }
    const bal = computeBalances(expenses);
    const transfers = settle(bal);
    const nonZero = [...bal.values()].filter((v) => v !== 0).length;
    assert.ok(transfers.length <= Math.max(0, nonZero - 1));
    for (const t of transfers) {
      bal.set(t.from, bal.get(t.from) + t.cents);
      bal.set(t.to, bal.get(t.to) - t.cents);
      assert.ok(t.cents > 0);
    }
    assert.ok([...bal.values()].every((v) => v === 0));
  }
});
