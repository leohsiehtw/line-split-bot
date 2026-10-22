// 本機模擬器：不用 LINE 也能試指令。
// 用法：npm run cli [-- 你的名字]，輸入「/名字 小華」可以切換發言的人。

import readline from 'node:readline';
import { Store } from './src/store.js';
import { createBot } from './src/bot.js';
import { createLocalD1 } from './test/d1-shim.js';

const bot = createBot(new Store(createLocalD1(process.env.DB_PATH || ':memory:')));
let me = process.argv[2] || '小明';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: `${me}> ` });

console.log('分帳機器人模擬器：輸入「/help」看指令，「/名字 小華」切換發言者，Ctrl+D 離開。\n');
rl.prompt();
// 依序處理每一行，避免非同步回覆順序錯亂。
let queue = Promise.resolve();
rl.on('line', (line) => {
  queue = queue.then(async () => {
    const m = line.match(/^\/名字\s+(\S+)/);
    if (m) {
      me = m[1];
      rl.setPrompt(`${me}> `);
    } else {
      const out = await bot.handle({ chatId: 'local', senderName: me, text: line });
      if (out) console.log(out + '\n');
    }
    rl.prompt();
  });
});
