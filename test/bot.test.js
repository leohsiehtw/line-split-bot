import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { createBot } from '../src/bot.js';
import { createLocalD1 } from './d1-shim.js';

function setup() {
  const bot = createBot(new Store(createLocalD1()));
  const say = (text, senderName = '小明', chatId = 'g1') => bot.handle({ chatId, senderName, text });
  return { bot, say };
}

test('一般聊天不回應', async () => {
  const { say } = setup();
  assert.equal(await say('今天好熱'), null);
  assert.equal(await say('記帳很麻煩'), null);
  assert.equal(await say('結算'), null); // 沒加斜線不算指令
  assert.equal(await say('/今天'), null);
});

test('聚餐情境：結算正確', async () => {
  const { say } = setup();
  await say('/成員 小明 小華 小美');
  await say('/記帳 900 晚餐'); // 小明付，三人各 300
  await say('/記帳 小華 600 飲料 分 小華 小美'); // 各 300
  const out = await say('/結算');
  // 小明 +600、小華 0、小美 -600
  assert.match(out, /小美 → 小明　600/);
  assert.equal(out.match(/→/g).length, 1);
});

test('全形斜線也可以', async () => {
  const { say } = setup();
  assert.match(await say('／說明'), /分帳機器人用法/);
});

test('還款後就結清', async () => {
  const { say } = setup();
  await say('/記帳 小明 1000 住宿 分 小明 小華');
  await say('/還款 小華 小明 500');
  assert.match(await say('/結算'), /結清/);
});

test('除了：排除指定成員', async () => {
  const { say } = setup();
  await say('/成員 小明 小華 小美');
  const out = await say('/記帳 小華 1200 計程車 除了 小美');
  assert.match(out, /小明、小華 每人 600|小華、小明 每人 600/);
});

test('刪除與清空', async () => {
  const { say } = setup();
  await say('/記帳 小明 100 a 分 小明 小華');
  await say('/記帳 小明 200 b 分 小明 小華');
  assert.match(await say('/刪除 1'), /已刪除 #1/);
  assert.match(await say('/明細'), /1 筆/);
  assert.match(await say('/清空'), /清空 確認/);
  assert.match(await say('/清空 確認'), /1 筆/);
  assert.match(await say('/明細'), /沒有帳目/);
});

test('不同聊天室帳目分開', async () => {
  const { say } = setup();
  await say('/記帳 小明 100 a 分 小明 小華', '小明', 'g1');
  assert.match(await say('/明細', '小明', 'g2'), /沒有帳目/);
});

test('讀不到名稱時「我」給出提示', async () => {
  const { say } = setup();
  assert.match(await say('/記帳 100 a 分 小華', null), /讀不到你的 LINE 名稱/);
});

test('錯誤的指令不會寫入帳目或新增成員', async () => {
  const { say } = setup();
  assert.match(await say('/記帳 小明 100 x 分 阿貓:200'), /超過總額/);
  assert.match(await say('/成員'), /還沒有成員/);
});
