// ========================================
// Uptime Monitor - Cloudflare Worker
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

// 格式化时间
function formatTime(date) {
  return new Date(date).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
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

// 前端 HTML 页面
function getHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Uptime Monitor</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; margin-bottom: 20px; }

    .login-form { max-width: 400px; margin: 100px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .login-form h2 { margin-bottom: 20px; text-align: center; }
    .login-form input { width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; }
    .login-form button { width: 100%; padding: 12px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
    .login-form button:hover { background: #005a87; }
    .error { color: #d32f2f; margin-bottom: 10px; text-align: center; }

    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .btn { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
    .btn-primary { background: #007cba; color: white; }
    .btn-danger { background: #d32f2f; color: white; }
    .btn:hover { opacity: 0.9; }

    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    .stat-card h3 { color: #666; font-size: 14px; margin-bottom: 5px; }
    .stat-card .value { font-size: 32px; font-weight: bold; }
    .stat-card.up .value { color: #4caf50; }
    .stat-card.down .value { color: #f44336; }

    .sites-list { background: white; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    .site-item { display: flex; align-items: center; padding: 15px 20px; border-bottom: 1px solid #eee; }
    .site-item:last-child { border-bottom: none; }
    .site-status { width: 12px; height: 12px; border-radius: 50%; margin-right: 15px; }
    .site-status.up { background: #4caf50; }
    .site-status.down { background: #f44336; }
    .site-info { flex: 1; }
    .site-name { font-weight: 500; color: #333; }
    .site-url { font-size: 13px; color: #666; margin-top: 3px; }
    .site-meta { font-size: 12px; color: #999; margin-top: 5px; }
    .site-actions { display: flex; gap: 10px; }
    .site-actions button { padding: 5px 10px; font-size: 12px; }

    .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; }
    .modal.show { display: flex; }
    .modal-content { background: white; padding: 30px; border-radius: 8px; width: 100%; max-width: 400px; }
    .modal-content h3 { margin-bottom: 20px; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; color: #666; }
    .form-group input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }

    .empty-state { text-align: center; padding: 60px 20px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div id="login-view" style="display:none;">
      <form class="login-form" id="login-form">
        <h2>Uptime Monitor</h2>
        <div class="error" id="login-error"></div>
        <input type="password" id="password" placeholder="输入管理密码" required>
        <button type="submit">登录</button>
      </form>
    </div>

    <div id="main-view" style="display:none;">
      <h1>Uptime Monitor</h1>
      <div class="header">
        <div class="stats" id="stats"></div>
        <button class="btn btn-primary" onclick="showAddModal()">添加监控</button>
      </div>
      <div class="sites-list" id="sites-list"></div>
    </div>
  </div>

  <div class="modal" id="add-modal">
    <div class="modal-content">
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
        <button class="btn" onclick="hideAddModal()">取消</button>
        <button class="btn btn-primary" onclick="addSite()">添加</button>
      </div>
    </div>
  </div>

  <script>
    const API = '/api';
    let token = '';

    // 检查登录状态
    async function checkAuth() {
      const stored = localStorage.getItem('token');
      if (stored) {
        token = stored;
        const res = await fetch(API + '/sites', { headers: { 'Authorization': 'Bearer ' + token } });
        if (res.ok) {
          showMain();
          return;
        }
      }
      showLogin();
    }

    function showLogin() {
      document.getElementById('login-view').style.display = 'block';
      document.getElementById('main-view').style.display = 'none';
    }

    function showMain() {
      document.getElementById('login-view').style.display = 'none';
      document.getElementById('main-view').style.display = 'block';
      loadSites();
    }

    // 登录
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
        document.getElementById('login-error').textContent = '密码错误';
      }
    });

    // 加载监控列表
    async function loadSites() {
      const res = await fetch(API + '/sites', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();

      // 统计
      const up = data.filter(s => s.is_up === 1).length;
      const down = data.filter(s => s.is_up === 0 && s.last_check).length;
      document.getElementById('stats').innerHTML =
        '<div class="stat-card up"><h3>正常运行</h3><div class="value">' + up + '</div></div>' +
        '<div class="stat-card down"><h3>异常</h3><div class="value">' + down + '</div></div>' +
        '<div class="stat-card"><h3>监控总数</h3><div class="value">' + data.length + '</div></div>';

      // 列表
      const list = document.getElementById('sites-list');
      if (data.length === 0) {
        list.innerHTML = '<div class="empty-state">暂无监控目标，点击"添加监控"开始</div>';
        return;
      }

      list.innerHTML = data.map(site =>
        '<div class="site-item">' +
          '<div class="site-status ' + (site.is_up ? 'up' : 'down') + '"></div>' +
          '<div class="site-info">' +
            '<div class="site-name">' + site.name + '</div>' +
            '<div class="site-url">' + site.url + '</div>' +
            '<div class="site-meta">' +
              (site.last_check ?
                '状态: ' + (site.status || 'N/A') + ' | ' +
                '响应: ' + (site.response_time || 0) + 'ms | ' +
                '检测时间: ' + (site.last_check || '-')
                : '尚未检测') +
            '</div>' +
          '</div>' +
          '<div class="site-actions">' +
            '<button class="btn btn-primary" onclick="checkNow(' + site.id + ')">立即检测</button>' +
            '<button class="btn btn-danger" onclick="deleteSite(' + site.id + ')">删除</button>' +
          '</div>' +
        '</div>'
      ).join('');
    }

    function showAddModal() {
      document.getElementById('add-modal').classList.add('show');
    }

    function hideAddModal() {
      document.getElementById('add-modal').classList.remove('show');
    }

    async function addSite() {
      const name = document.getElementById('add-name').value;
      const url = document.getElementById('add-url').value;
      if (!name || !url) return alert('请填写完整');

      const res = await fetch(API + '/sites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ name, url })
      });

      if (res.ok) {
        hideAddModal();
        loadSites();
        document.getElementById('add-name').value = '';
        document.getElementById('add-url').value = '';
      }
    }

    async function deleteSite(id) {
      if (!confirm('确定删除此监控目标？')) return;
      await fetch(API + '/sites/' + id, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      loadSites();
    }

    async function checkNow(id) {
      await fetch(API + '/check/' + id, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      loadSites();
    }

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

  // 登录接口（不需要验证）
  if (path === '/api/login' && method === 'POST') {
    const body = await request.json();
    if (body.password === env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // 其他接口需要验证
  if (!checkAuth(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // 获取监控列表
  if (path === '/api/sites' && method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT s.*,
        c.status, c.response_time, c.is_up, c.checked_at as last_check
      FROM sites s
      LEFT JOIN (
        SELECT site_id, status, response_time, is_up, checked_at,
        ROW_NUMBER() OVER (PARTITION BY site_id ORDER BY checked_at DESC) as rn
        FROM checks
      ) c ON s.id = c.site_id AND c.rn = 1
      ORDER BY s.id DESC
    `).all();
    return new Response(JSON.stringify(result.results), { headers: { 'Content-Type': 'application/json' } });
  }

  // 添加监控目标
  if (path === '/api/sites' && method === 'POST') {
    const body = await request.json();
    const result = await env.DB.prepare(
      'INSERT INTO sites (url, name) VALUES (?, ?)'
    ).bind(body.url, body.name).run();
    return new Response(JSON.stringify({ id: result.meta.last_row_id }), { headers: { 'Content-Type': 'application/json' } });
  }

  // 删除监控目标
  if (path.match(/^\/api\/sites\/\d+$/) && method === 'DELETE') {
    const id = path.split('/')[3];
    await env.DB.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM checks WHERE site_id = ?').bind(id).run();
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  // 立即检测单个站点
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

    // 清理旧记录，只保留最近100条
    await env.DB.prepare(`
      DELETE FROM checks WHERE site_id = ? AND id NOT IN (
        SELECT id FROM checks WHERE site_id = ? ORDER BY checked_at DESC LIMIT 100
      )
    `).bind(site.id, site.id).run();
  }
}

// 主入口
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API 路由
    if (path.startsWith('/api/')) {
      return handleApi(request, env, path);
    }

    // 前端页面
    return new Response(getHtml(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkAllSites(env));
  }
};
