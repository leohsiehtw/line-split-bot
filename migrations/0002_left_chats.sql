-- 機器人被踢出或退出的聊天室，left_at 起算 30 天後由排程刪除資料；重新加入就取消。
CREATE TABLE IF NOT EXISTS left_chats (
  chat_id TEXT PRIMARY KEY,
  left_at TEXT NOT NULL
);
