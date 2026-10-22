CREATE TABLE IF NOT EXISTS members (
  chat_id TEXT NOT NULL,
  name    TEXT NOT NULL,
  PRIMARY KEY (chat_id, name)
);

CREATE TABLE IF NOT EXISTS expenses (
  chat_id    TEXT NOT NULL,
  no         INTEGER NOT NULL,
  payer      TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  note       TEXT NOT NULL,
  shares     TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (chat_id, no)
);
