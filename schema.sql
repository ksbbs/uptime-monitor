-- 监控目标表
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 检测记录表
CREATE TABLE IF NOT EXISTS checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  status INTEGER,
  response_time INTEGER,
  is_up INTEGER,
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

-- 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_checks_site_id ON checks(site_id);
CREATE INDEX IF NOT EXISTS idx_checks_checked_at ON checks(checked_at);
