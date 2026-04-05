// ========================================
// Uptime Monitor - Cloudflare Worker
// Uptime Kuma Style UI
// ========================================

// 密码验证中间件
function checkAuth(request, env) {
  const auth = request.headers.get('Authorization');
  if (auth) {
    const token = auth.replace('Bearer ', '');
    return token === env.ADMIN_PASSWORD;
  }
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/auth=([^;]+)/);
  if (match) {
    return match[1] === env.ADMIN_PASSWORD;
  }
  return false;
}

// 检测单个网站
async function checkSite(url) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'UptimeMonitor/1.0' }
    });

    clearTimeout(timeout);
    return {
      status: response.status,
      response_time: Date.now() - start,
      is_up: response.status >= 200 && response.status < 500 ? 1 : 0
    };
  } catch (error) {
    return {
      status: 0,
      response_time: 0,
      is_up: 0
    };
  }
}

// 前端 HTML 页面 - Uptime Kuma 风格
function getHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Uptime Monitor</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐻</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      min-height: 100vh;
      color: #f8fafc;
    }

    /* 动画 */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes heartbeatIn {
      from { transform: scaleY(0); }
      to { transform: scaleY(1); }
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    /* 登录页面 */
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      animation: fadeIn 0.5s ease-out;
    }
    .login-card {
      background: #1e293b;
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
      animation: slideIn 0.4s ease-out;
    }
    .login-logo {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      margin-bottom: 32px;
    }
    .login-logo-icon {
      width: 72px;
      height: 72px;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 40px rgba(34,197,94,0.3);
      transition: transform 0.3s, box-shadow 0.3s;
    }
    .login-logo-icon:hover {
      transform: scale(1.05) rotate(-3deg);
      box-shadow: 0 15px 50px rgba(34,197,94,0.4);
    }
    .login-logo h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .login-logo p { font-size: 14px; color: #64748b; }
    .login-error {
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.3);
      color: #f87171;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      margin-bottom: 20px;
      text-align: center;
      display: none;
      animation: slideIn 0.3s ease-out;
    }
    .form-group { margin-bottom: 20px; }
    .form-group label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    .form-group input {
      width: 100%;
      height: 52px;
      padding: 0 18px;
      background: #0f172a;
      border: 2px solid #334155;
      border-radius: 12px;
      font-size: 16px;
      color: #f8fafc;
      transition: all 0.3s;
    }
    .form-group input:focus {
      outline: none;
      border-color: #22c55e;
      box-shadow: 0 0 0 4px rgba(34,197,94,0.15);
    }
    .form-group input::placeholder { color: #475569; }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .btn:active { transform: scale(0.97); }
    .btn-primary {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
      width: 100%;
      height: 52px;
      font-size: 16px;
      box-shadow: 0 4px 20px rgba(34,197,94,0.3);
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(34,197,94,0.4);
    }
    .btn-small { padding: 8px 14px; font-size: 13px; font-weight: 500; border-radius: 8px; }
    .btn-check { background: rgba(34,197,94,0.15); color: #22c55e; }
    .btn-check:hover { background: rgba(34,197,94,0.25); }
    .btn-delete { background: rgba(239,68,68,0.15); color: #ef4444; }
    .btn-delete:hover { background: rgba(239,68,68,0.25); }
    .btn-edit { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
    .btn-edit:hover { background: rgba(59, 130, 246, 0.25); }
    .btn-add {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
      padding: 12px 20px;
      box-shadow: 0 4px 15px rgba(34,197,94,0.3);
    }
    .btn-add:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(34,197,94,0.4); }
    .btn-cancel { background: #334155; color: #94a3b8; }
    .btn-cancel:hover { background: #475569; }

    /* 主界面 */
    .container { max-width: 1400px; margin: 0 auto; padding: 24px; }

    /* 导航栏 */
    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      animation: fadeIn 0.5s ease-out;
    }
    .nav-title {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .nav-icon {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 15px rgba(34,197,94,0.3);
      transition: transform 0.3s;
    }
    .nav-icon:hover { transform: rotate(-10deg); }
    .nav-text { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }

    /* 状态栏 */
    .status-bar {
      display: flex;
      gap: 20px;
      padding: 16px 20px;
      background: #1e293b;
      border-radius: 12px;
      margin-bottom: 24px;
      animation: fadeIn 0.5s ease-out 0.1s backwards;
    }
    .status-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-right: 20px;
      border-right: 1px solid #334155;
    }
    .status-item:last-child { border-right: none; padding-right: 0; }
    .status-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    .status-dot.up { background: #22c55e; box-shadow: 0 0 10px rgba(34,197,94,0.5); }
    .status-dot.down { background: #ef4444; box-shadow: 0 0 10px rgba(239,68,68,0.5); }
    .status-dot.pending { background: #f59e0b; box-shadow: 0 0 10px rgba(245,158,11,0.5); }
    .status-text { font-size: 14px; color: #94a3b8; }
    .status-count { font-weight: 600; color: #f8fafc; }

    /* 卡片网格 */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 20px;
    }
    @media (max-width: 768px) {
      .cards-grid { grid-template-columns: 1fr; }
    }

    /* 监控卡片 */
    .monitor-card {
      background: #1e293b;
      border-radius: 16px;
      padding: 24px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      animation: slideIn 0.4s ease-out;
      cursor: grab;
    }
    .monitor-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    }
    .monitor-card:active { cursor: grabbing; }
    .monitor-card.dragging {
      opacity: 0.5;
      transform: scale(0.98);
    }
    .monitor-card.drag-over {
      border: 2px dashed #22c55e;
      background: rgba(34, 197, 94, 0.1);
    }
    .monitor-card.loading {
      background: linear-gradient(90deg, #1e293b 25%, #273548 50%, #1e293b 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .card-info h3 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 4px;
      transition: color 0.3s;
    }
    .monitor-card:hover .card-info h3 { color: #22c55e; }
    .card-url {
      font-size: 13px;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .card-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.3s;
    }
    .card-status.up { background: rgba(34,197,94,0.15); color: #22c55e; }
    .card-status.down { background: rgba(239,68,68,0.15); color: #ef4444; }
    .card-status.pending { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .card-status .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }

    /* 统计信息 */
    .card-stats {
      display: flex;
      gap: 32px;
      margin-bottom: 16px;
    }
    .stat-item { }
    .stat-label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
    .stat-value { font-size: 20px; font-weight: 700; }
    .stat-value.up { color: #22c55e; }
    .stat-value.down { color: #ef4444; }
    .stat-value.warning { color: #f59e0b; }

    /* 心跳条 */
    .heartbeat-bar {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      height: 50px;
      margin-bottom: 16px;
      padding: 8px 0;
    }
    .heartbeat {
      flex: 1;
      min-width: 6px;
      max-width: 10px;
      border-radius: 3px;
      transition: all 0.3s;
      transform-origin: bottom;
      animation: heartbeatIn 0.5s ease-out backwards;
    }
    .heartbeat.up { background: linear-gradient(to top, #16a34a, #22c55e); }
    .heartbeat.down { background: linear-gradient(to top, #dc2626, #ef4444); }
    .heartbeat:hover { filter: brightness(1.2); transform: scaleY(1.1); }
    .heartbeat[title] { cursor: pointer; }

    /* 卡片底部 */
    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 16px;
      border-top: 1px solid #334155;
    }
    .last-check {
      font-size: 12px;
      color: #64748b;
    }
    .card-actions {
      display: flex;
      gap: 8px;
    }

    /* 空状态 */
    .empty-state {
      text-align: center;
      padding: 80px 40px;
      color: #64748b;
      animation: fadeIn 0.5s ease-out;
    }
    .empty-state svg {
      width: 80px;
      height: 80px;
      margin-bottom: 20px;
      opacity: 0.4;
    }
    .empty-state h3 { font-size: 20px; margin-bottom: 8px; color: #94a3b8; }
    .empty-state p { font-size: 14px; }

    /* 弹窗 */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(8px);
      align-items: center;
      justify-content: center;
      z-index: 100;
      animation: fadeIn 0.3s ease-out;
    }
    .modal-overlay.show { display: flex; }
    .modal {
      background: #1e293b;
      border-radius: 20px;
      padding: 32px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.5);
      animation: slideIn 0.3s ease-out;
    }
    .modal h3 {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 24px;
    }
    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 28px;
    }

    /* Toast 通知 */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #1e293b;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4);
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 200;
    }
    .toast.show { transform: translateY(0); opacity: 1; }
    .toast.success { border-left: 4px solid #22c55e; }
    .toast.error { border-left: 4px solid #ef4444; }
  </style>
</head>
<body>
  <!-- 登录页面 -->
  <div class="login-container" id="login-view" style="display:none;">
    <div class="login-card">
      <div class="login-logo">
        <div class="login-logo-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        </div>
        <h1>Uptime Monitor</h1>
        <p>请输入管理密码登录</p>
      </div>
      <div class="login-error" id="login-error"></div>
      <form id="login-form">
        <div class="form-group">
          <label>管理密码</label>
          <input type="password" id="password" placeholder="请输入密码" required>
        </div>
        <button type="submit" class="btn btn-primary">登录</button>
      </form>
    </div>
  </div>

  <!-- 主界面 -->
  <div class="container" id="main-view" style="display:none;">
    <nav class="navbar">
      <div class="nav-title">
        <div class="nav-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        </div>
        <span class="nav-text">Uptime Monitor</span>
      </div>
      <button class="btn btn-add" onclick="showAddModal()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        添加监控
      </button>
    </nav>

    <div class="status-bar" id="status-bar"></div>
    <div class="cards-grid" id="cards-grid"></div>
  </div>

  <!-- 添加弹窗 -->
  <div class="modal-overlay" id="add-modal">
    <div class="modal">
      <h3>添加监控目标</h3>
      <div class="form-group">
        <label>网站名称</label>
        <input type="text" id="add-name" placeholder="例如：我的博客">
      </div>
      <div class="form-group">
        <label>网站地址</label>
        <input type="url" id="add-url" placeholder="https://example.com">
      </div>
      <div class="modal-actions">
        <button class="btn btn-small btn-cancel" onclick="hideAddModal()">取消</button>
        <button class="btn btn-small btn-add" onclick="addSite()">添加</button>
      </div>
    </div>
  </div>

  <!-- 编辑弹窗 -->
  <div class="modal-overlay" id="edit-modal">
    <div class="modal">
      <h3>编辑监控目标</h3>
      <div class="form-group">
        <label>网站名称</label>
        <input type="text" id="edit-name" placeholder="例如：我的博客">
      </div>
      <div class="form-group">
        <label>网站地址</label>
        <input type="url" id="edit-url" placeholder="https://example.com">
      </div>
      <input type="hidden" id="edit-id">
      <div class="modal-actions">
        <button class="btn btn-small btn-cancel" onclick="hideEditModal()">取消</button>
        <button class="btn btn-small btn-add" onclick="updateSite()">保存</button>
      </div>
    </div>
  </div>

  <!-- Toast -->
  <div class="toast" id="toast"></div>

  <script>
    const API = '/api';
    let token = '';
    let heartbeatData = {};

    async function checkAuth() {
      const stored = localStorage.getItem('token');
      if (stored) {
        token = stored;
        const res = await fetch(API + '/sites', { headers: { 'Authorization': 'Bearer ' + token } });
        if (res.ok) { showMain(); return; }
      }
      showLogin();
    }

    function showLogin() {
      document.getElementById('login-view').style.display = 'flex';
      document.getElementById('main-view').style.display = 'none';
    }

    function showMain() {
      document.getElementById('login-view').style.display = 'none';
      document.getElementById('main-view').style.display = 'block';
      loadSites();
    }

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = document.getElementById('password').value;
      const res = await fetch(API + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      });
      if (res.ok) {
        token = pwd;
        localStorage.setItem('token', pwd);
        showMain();
      } else {
        const err = document.getElementById('login-error');
        err.textContent = '密码错误，请重试';
        err.style.display = 'block';
      }
    });

    async function loadSites() {
      const res = await fetch(API + '/sites', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();

      // 统计
      const up = data.filter(s => s.is_up === 1).length;
      const down = data.filter(s => s.is_up === 0 && s.last_check).length;
      const pending = data.filter(s => !s.last_check).length;

      document.getElementById('status-bar').innerHTML =
        '<div class="status-item"><div class="status-dot up"></div><span class="status-text"><span class="status-count">' + up + '</span> 正常运行</span></div>' +
        '<div class="status-item"><div class="status-dot down"></div><span class="status-text"><span class="status-count">' + down + '</span> 异常</span></div>' +
        '<div class="status-item"><div class="status-dot pending"></div><span class="status-text"><span class="status-count">' + pending + '</span> 待检测</span></div>';

      const grid = document.getElementById('cards-grid');
      if (data.length === 0) {
        grid.innerHTML = '<div class="empty-state">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
          '<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line>' +
          '<line x1="9" y1="21" x2="9" y2="9"></line></svg>' +
          '<h3>暂无监控目标</h3><p>点击上方"添加监控"按钮开始</p></div>';
        return;
      }

      // 加载每个站点的心跳数据
      for (const site of data) {
        loadHeartbeats(site.id);
      }

      grid.innerHTML = data.map((site, i) => {
        const isUp = site.is_up === 1;
        const statusClass = !site.last_check ? 'pending' : (isUp ? 'up' : 'down');
        const statusText = !site.last_check ? '待检测' : (isUp ? '运行中' : '异常');

        // 计算可用率
        const uptime = site.uptime || 0;

        return '<div class="monitor-card" data-id="' + site.id + '" draggable="true" style="animation-delay: ' + (i * 0.05) + 's">' +
          '<div class="card-header">' +
            '<div class="card-info">' +
              '<h3>' + site.name + '</h3>' +
              '<div class="card-url">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line>' +
                '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>' +
                site.url.replace(/^https?:\\/\\//, '') +
              '</div>' +
            '</div>' +
            '<div class="card-status ' + statusClass + '">' +
              '<div class="dot"></div>' + statusText +
            '</div>' +
          '</div>' +
          '<div class="card-stats">' +
            '<div class="stat-item">' +
              '<div class="stat-label">响应时间</div>' +
              '<div class="stat-value ' + statusClass + '">' + (site.response_time ? site.response_time + 'ms' : '-') + '</div>' +
            '</div>' +
            '<div class="stat-item">' +
              '<div class="stat-label">可用率</div>' +
              '<div class="stat-value ' + (uptime >= 99 ? 'up' : uptime >= 90 ? 'warning' : 'down') + '">' + uptime.toFixed(1) + '%</div>' +
            '</div>' +
          '</div>' +
          '<div class="heartbeat-bar" id="hb-' + site.id + '">' +
            '<div style="color:#64748b;font-size:12px;">加载中...</div>' +
          '</div>' +
          '<div class="card-footer">' +
            '<div class="last-check">最后检测: ' + (site.last_check || '尚未检测') + '</div>' +
            '<div class="card-actions">' +
              '<button class="btn btn-small btn-check" onclick="checkNow(' + site.id + ')">检测</button>' +
              '<button class="btn btn-small btn-edit" onclick="showEditModal(' + site.id + ', \\'' + site.name.replace(/'/g, "\\\\'") + '\\', \\'' + site.url + '\\')">编辑</button>' +
              '<button class="btn btn-small btn-delete" onclick="deleteSite(' + site.id + ')">删除</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    async function loadHeartbeats(siteId) {
      const res = await fetch(API + '/heartbeats/' + siteId, { headers: { 'Authorization': 'Bearer ' + token } });
      if (!res.ok) return;

      const data = await res.json();
      const container = document.getElementById('hb-' + siteId);
      if (!container) return;

      if (data.length === 0) {
        container.innerHTML = '<div style="color:#64748b;font-size:12px;">暂无检测记录</div>';
        return;
      }

      const maxTime = Math.max(...data.map(h => h.response_time || 1));
      container.innerHTML = data.map((h, i) => {
        const height = h.response_time ? Math.max(8, (h.response_time / maxTime) * 40) : 40;
        const cls = h.is_up ? 'up' : 'down';
        return '<div class="heartbeat ' + cls + '" style="height:' + height + 'px;animation-delay:' + (i * 0.02) + 's" title="' + (h.response_time || '超时') + ' - ' + h.checked_at + '"></div>';
      }).join('');
    }

    function showAddModal() { document.getElementById('add-modal').classList.add('show'); }
    function hideAddModal() {
      document.getElementById('add-modal').classList.remove('show');
      document.getElementById('add-name').value = '';
      document.getElementById('add-url').value = '';
    }

    function showToast(msg, type) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.className = 'toast ' + type + ' show';
      setTimeout(() => toast.classList.remove('show'), 3000);
    }

    async function addSite() {
      const name = document.getElementById('add-name').value;
      const url = document.getElementById('add-url').value;
      if (!name || !url) { showToast('请填写完整', 'error'); return; }

      const res = await fetch(API + '/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ name, url })
      });
      if (res.ok) {
        hideAddModal();
        loadSites();
        showToast('添加成功', 'success');
      }
    }

    async function deleteSite(id) {
      if (!confirm('确定删除此监控目标？')) return;
      await fetch(API + '/sites/' + id, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      loadSites();
      showToast('已删除', 'success');
    }

    async function checkNow(id) {
      showToast('正在检测...', 'success');
      await fetch(API + '/check/' + id, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      loadSites();
    }

    let editingId = null;

    function showEditModal(id, name, url) {
      editingId = id;
      document.getElementById('edit-name').value = name;
      document.getElementById('edit-url').value = url;
      document.getElementById('edit-modal').classList.add('show');
    }

    function hideEditModal() {
      document.getElementById('edit-modal').classList.remove('show');
      editingId = null;
    }

    async function updateSite() {
      const name = document.getElementById('edit-name').value;
      const url = document.getElementById('edit-url').value;
      if (!name || !url) { showToast('请填写完整', 'error'); return; }

      const res = await fetch(API + '/sites/' + editingId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ name, url })
      });
      if (res.ok) {
        hideEditModal();
        loadSites();
        showToast('更新成功', 'success');
      }
    }

    // 拖拽排序
    let draggedCard = null;

    document.addEventListener('dragstart', (e) => {
      if (e.target.classList.contains('monitor-card')) {
        draggedCard = e.target;
        e.target.classList.add('dragging');
      }
    });

    document.addEventListener('dragend', (e) => {
      if (e.target.classList.contains('monitor-card')) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.monitor-card').forEach(c => c.classList.remove('drag-over'));
        draggedCard = null;
      }
    });

    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      const card = e.target.closest('.monitor-card');
      if (card && card !== draggedCard) {
        document.querySelectorAll('.monitor-card').forEach(c => c.classList.remove('drag-over'));
        card.classList.add('drag-over');
      }
    });

    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      const targetCard = e.target.closest('.monitor-card');
      if (!targetCard || targetCard === draggedCard) return;

      const cards = Array.from(document.querySelectorAll('.monitor-card'));
      const draggedIdx = cards.indexOf(draggedCard);
      const targetIdx = cards.indexOf(targetCard);

      if (draggedIdx < targetIdx) {
        targetCard.parentNode.insertBefore(draggedCard, targetCard.nextSibling);
      } else {
        targetCard.parentNode.insertBefore(draggedCard, targetCard);
      }

      // 保存排序
      const newOrder = Array.from(document.querySelectorAll('.monitor-card')).map(c => parseInt(c.dataset.id));
      await fetch(API + '/sites/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ order: newOrder })
      });
      showToast('顺序已更新', 'success');
    });

    // 自动刷新
    setInterval(loadSites, 60000);
    checkAuth();
  </script>
</body>
</html>`;
}

// API 路由处理
async function handleApi(request, env, path) {
  const method = request.method;

  // 登录接口
  if (path === '/api/login' && method === 'POST') {
    const body = await request.json();
    if (body.password === env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // 验证
  if (!checkAuth(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // 获取监控列表（含可用率计算）
  if (path === '/api/sites' && method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT s.*,
        c.status, c.response_time, c.is_up, c.checked_at as last_check,
        (SELECT ROUND(COUNT(CASE WHEN is_up = 1 THEN 1 END) * 100.0 / COUNT(*), 1)
         FROM checks WHERE site_id = s.id) as uptime
      FROM sites s
      LEFT JOIN (
        SELECT site_id, status, response_time, is_up, checked_at,
        ROW_NUMBER() OVER (PARTITION BY site_id ORDER BY checked_at DESC) as rn
        FROM checks
      ) c ON s.id = c.site_id AND c.rn = 1
      ORDER BY s.sort_order ASC, s.id DESC
    `).all();
    return new Response(JSON.stringify(result.results), { headers: { 'Content-Type': 'application/json' } });
  }

  // 获取心跳数据
  if (path.match(/^\/api\/heartbeats\/\d+$/) && method === 'GET') {
    const id = path.split('/')[3];
    const result = await env.DB.prepare(`
      SELECT is_up, response_time, checked_at
      FROM checks WHERE site_id = ?
      ORDER BY checked_at DESC LIMIT 24
    `).bind(id).all();
    return new Response(JSON.stringify(result.results.reverse()), { headers: { 'Content-Type': 'application/json' } });
  }

  // 添加监控目标
  if (path === '/api/sites' && method === 'POST') {
    const body = await request.json();
    // 获取当前最大排序值
    const maxOrder = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), 0) as max FROM sites').first();
    const result = await env.DB.prepare(
      'INSERT INTO sites (url, name, sort_order) VALUES (?, ?, ?)'
    ).bind(body.url, body.name, maxOrder.max + 1).run();
    return new Response(JSON.stringify({ id: result.meta.last_row_id }), { headers: { 'Content-Type': 'application/json' } });
  }

  // 更新排序
  if (path === '/api/sites/reorder' && method === 'PUT') {
    const body = await request.json();
    for (let i = 0; i < body.order.length; i++) {
      await env.DB.prepare('UPDATE sites SET sort_order = ? WHERE id = ?').bind(i + 1, body.order[i]).run();
    }
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  // 编辑监控目标
  if (path.match(/^\/api\/sites\/\d+$/) && method === 'PUT') {
    const id = path.split('/')[3];
    const body = await request.json();
    await env.DB.prepare(
      'UPDATE sites SET name = ?, url = ? WHERE id = ?'
    ).bind(body.name, body.url, id).run();
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  // 删除监控目标
  if (path.match(/^\/api\/sites\/\d+$/) && method === 'DELETE') {
    const id = path.split('/')[3];
    await env.DB.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM checks WHERE site_id = ?').bind(id).run();
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  // 立即检测
  if (path.match(/^\/api\/check\/\d+$/) && method === 'POST') {
    const id = path.split('/')[3];
    const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first();
    if (!site) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

    const result = await checkSite(site.url);
    await env.DB.prepare(
      'INSERT INTO checks (site_id, status, response_time, is_up) VALUES (?, ?, ?, ?)'
    ).bind(id, result.status, result.response_time, result.is_up).run();

    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}

// 定时检测所有网站
async function checkAllSites(env) {
  const sites = await env.DB.prepare('SELECT * FROM sites WHERE enabled = 1').all();

  for (const site of sites.results) {
    const result = await checkSite(site.url);
    await env.DB.prepare(
      'INSERT INTO checks (site_id, status, response_time, is_up) VALUES (?, ?, ?, ?)'
    ).bind(site.id, result.status, result.response_time, result.is_up).run();

    // 清理30天前的检测记录
    await env.DB.prepare(
      "DELETE FROM checks WHERE checked_at < datetime('now', '-30 days')"
    ).run();
  }
}

// 主入口
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith('/api/')) {
      return handleApi(request, env, path);
    }

    return new Response(getHtml(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkAllSites(env));
  }
};
