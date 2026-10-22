import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { createBot } from '../src/bot.js';
import { createLocalD1 } from './d1-shim.js';

function setup() {
  const bot = createBot(new Store(createLocalD1()));
  const say = async (text, senderName = '小明', chatId = 'g1') => {
    const out = await bot.handle({ chatId, senderName, text });
    return out?.text ?? out;
  };
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
  await say('/add 小明 小華 小美');
  await say('/pay 900 晚餐'); // 小明付，三人各 300
  await say('/pay 小華 600 飲料 for 小華 小美'); // 各 300
  const out = await say('/settle');
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
  await say('/pay 小明 1000 住宿 for 小明 小華');
  await say('/repay 小華 小明 500');
  assert.match(await say('/settle'), /結清/);
});

test('除了：排除指定成員', async () => {
  const { say } = setup();
  await say('/add 小明 小華 小美');
  const out = await say('/pay 小華 1200 計程車 except 小美');
  assert.match(out, /小明　600/);
  assert.match(out, /小華　600/);
  assert.doesNotMatch(out, /小美/);
});

test('刪除與清空', async () => {
  const { say } = setup();
  await say('/pay 小明 100 a for 小明 小華');
  await say('/pay 小明 200 b for 小明 小華');
  assert.match(await say('/delete 1'), /已刪除 #1/);
  assert.match(await say('/list'), /1 筆/);
  assert.match(await say('/clear'), /clear confirm/);
  assert.match(await say('/clear confirm'), /1 筆/);
  assert.match(await say('/list'), /沒有帳目/);
});

test('不同聊天室帳目分開', async () => {
  const { say } = setup();
  await say('/pay 小明 100 a for 小明 小華', '小明', 'g1');
  assert.match(await say('/list', '小明', 'g2'), /沒有帳目/);
});

test('讀不到名稱時「我」給出提示', async () => {
  const { say } = setup();
  assert.match(await say('/pay 100 a for 小華', null), /讀不到你的 LINE 名稱/);
});

test('錯誤的指令不會寫入帳目或新增成員', async () => {
  const { say } = setup();
  assert.match(await say('/pay 小明 100 x for 阿貓:200'), /超過總額/);
  assert.match(await say('/members'), /還沒有成員/);
});

test('/me 把自己加進成員，/@ 把被提及的人加進成員', async () => {
  const { say } = setup();
  assert.match(await say('/me', '小明'), /新增：小明/);
  assert.match(await say('/ME', '小華'), /新增：小華/);
  assert.match(await say('/@小美 ＠阿貓', '小明'), /新增：小美、阿貓/);
  assert.match(await say('/members'), /小明、小華、小美、阿貓/);
  assert.match(await say('/me', null), /讀不到你的 LINE 名稱/);
});

test('沒寫付款人就是自己付', async () => {
  const { say } = setup();
  await say('/me', '小明');
  await say('/me', '小華');
  const out = await say('/pay 200 住宿', '小華');
  assert.match(out, /住宿　200/);
  assert.match(out, /付款人　小華/);
});

test('舊的中文指令仍可用', async () => {
  const { say } = setup();
  await say('/成員 小明 小華');
  await say('/記帳 小明 600 晚餐 分 小明 小華');
  assert.match(await say('/結算'), /小華 → 小明　300/);
  assert.match(await say('/清空 確認'), /已清空 1 筆/);
});

test('英文指令不分大小寫', async () => {
  const { say } = setup();
  assert.match(await say('/HELP'), /分帳機器人用法/);
  assert.match(await say('/Pay 小明 100 a for 小明 小華'), /#1/);
});

test('卡片可以轉成 Flex bubble', async () => {
  const { toFlex } = await import('../src/card.js');
  const bot = createBot(new Store(createLocalD1()));
  const out = await bot.handle({ chatId: 'g', senderName: '小明', text: '/pay 900 晚餐 for 小明 小華' });
  const bubble = toFlex(out.card);
  assert.equal(bubble.type, 'bubble');
  const json = JSON.stringify(bubble);
  assert.match(json, /已記帳 #1/);
  assert.doesNotMatch(json, /"text":""/); // LINE 不接受空字串
});

test('/deletedata 要確認，刪掉成員與帳目', async () => {
  const { say } = setup();
  await say('/pay 小明 100 a for 小明 小華');
  await say('/pay 小明 100 b for 小明 小華', '小明', 'g2');
  assert.match(await say('/deletedata'), /deletedata confirm/);
  assert.match(await say('/members'), /小明、小華/); // 沒確認就不刪
  assert.match(await say('/刪除資料 確認'), /成員與 1 筆帳目/);
  assert.match(await say('/members'), /還沒有成員/);
  assert.match(await say('/list'), /沒有帳目/);
  assert.match(await say('/list', '小明', 'g2'), /1 筆/); // 其他聊天室不受影響
});

test('說明與 /privacy 附上條款連結', async () => {
  const bot = createBot(new Store(createLocalD1()), { baseUrl: 'https://bot.example' });
  const { toFlex } = await import('../src/card.js');
  for (const text of ['/help', '/privacy']) {
    const out = await bot.handle({ chatId: 'g', senderName: '小明', text });
    assert.match(out.text, /https:\/\/bot\.example\/privacy/);
    const json = JSON.stringify(toFlex(out.card));
    assert.match(json, /"uri":"https:\/\/bot\.example\/terms"/);
  }
  // 本機模擬器沒有網址就不放連結
  assert.doesNotMatch((await createBot(new Store(createLocalD1())).help()).text, /privacy/);
});

test('離開超過 30 天的聊天室會被刪除，重新加入就取消', async () => {
  const store = new Store(createLocalD1());
  const day = 86400_000;
  for (const id of ['old', 'recent', 'back', 'stay']) await store.addMembers(id, ['小明']);
  await store.markLeft('old', new Date(Date.UTC(2026, 0, 1)));
  await store.markLeft('back', new Date(Date.UTC(2026, 0, 1)));
  await store.markLeft('recent', new Date(Date.UTC(2026, 0, 20)));
  await store.unmarkLeft('back');
  const n = await store.purgeLeftChats(new Date(Date.UTC(2026, 0, 31) - 30 * day + day));
  assert.equal(n, 1);
  assert.deepEqual(await store.members('old'), []);
  assert.deepEqual(await store.members('recent'), ['小明']);
  assert.deepEqual(await store.members('back'), ['小明']);
  assert.deepEqual(await store.members('stay'), ['小明']);
});

test('條款頁', async () => {
  const { legalPage } = await import('../src/legal.js');
  assert.match(legalPage('/privacy'), /隱私權政策/);
  assert.match(legalPage('/privacy'), /Cloudflare/);
  assert.match(legalPage('/terms'), /使用條款/);
  assert.equal(legalPage('/other'), null);
});
