<?php
// timeline.php
// CRUD API + minimal UI for data/OperationalTimeline.json
// Added session-based auth + login API (action=login)

declare(strict_types=1);
header('X-Content-Type-Options: nosniff');

const FILE_PATH = __DIR__ . '/data/OperationalTimeline.json';

// ---------- HELPER FUNCTIONS ----------

function respond_json($code, $payload) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function read_json_file(): array {
    if (!file_exists(FILE_PATH)) return [];
    $raw = file_get_contents(FILE_PATH);
    if ($raw === false || $raw === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function write_json_file(array $data): void {
    $dir = dirname(FILE_PATH);
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        respond_json(500, ['ok'=>false, 'error'=>'Cannot create data directory']);
    }

    $tmp = tempnam(sys_get_temp_dir(), 'timeline_');
    if ($tmp === false) respond_json(500, ['ok'=>false, 'error'=>'Cannot create temp file']);

    $pretty = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($pretty === false) {
        @unlink($tmp);
        respond_json(500, ['ok'=>false, 'error'=>'Cannot encode JSON']);
    }

    if (file_put_contents($tmp, $pretty, LOCK_EX) === false) {
        @unlink($tmp);
        respond_json(500, ['ok'=>false, 'error'=>'Cannot write temp file']);
    }

    if (file_exists(FILE_PATH)) @copy(FILE_PATH, FILE_PATH . '.' . date('Ymd_His') . '.bak');

    if (!@rename($tmp, FILE_PATH)) {
        @unlink($tmp);
        respond_json(500, ['ok'=>false, 'error'=>'Atomic rename failed']);
    }
}

function read_json_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false) $raw = '';
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') !== false) {
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }
    if (!empty($_POST)) return $_POST;
    parse_str($raw, $parsed);
    return is_array($parsed) ? $parsed : [];
}

function validate_item(array $item): array {
    $date = trim((string)($item['date'] ?? ''));
    $title = trim((string)($item['title'] ?? ''));
    $description = trim((string)($item['description'] ?? ''));

    if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        respond_json(422, ['ok'=>false, 'error'=>'Field "date" must be YYYY-MM-DD']);
    }
    if ($title === '') respond_json(422, ['ok'=>false, 'error'=>'Field "title" is required']);
    if ($description === '') respond_json(422, ['ok'=>false, 'error'=>'Field "description" is required']);
    return ['date'=>$date, 'title'=>$title, 'description'=>$description];
}

function get_index_from_params(array $params): int {
    $idx = $params['index'] ?? ($_GET['index'] ?? null);
    if ($idx === null || $idx === '') respond_json(400, ['ok'=>false, 'error'=>'Missing "index"']);
    if (!is_numeric($idx)) respond_json(400, ['ok'=>false, 'error'=>'"index" must be numeric']);
    return (int)$idx;
}

// ---------- REQUEST META ----------
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? null;

// ---------- SESSION / AUTH PROTECTION ----------
session_start();

// If the user is not authenticated, allow only the login API (action=login POST).
// For any other API action return 403.
if (empty($_SESSION['auth'])) {
    if ($action === 'login' && $method === 'POST') {
        $payload = read_json_body();
        // fixed password check (server-side authoritative)
        if (($payload['password'] ?? '') === '4f&bIQ') {
            $_SESSION['auth'] = true;
            respond_json(200, ['ok' => true]);
        } else {
            respond_json(403, ['ok' => false, 'error' => 'Invalid password']);
        }
    }
    // If the request is an API action (anything besides the initial HTML view), deny.
    if ($action !== null) {
        respond_json(403, ['ok' => false, 'error' => 'Unauthorized']);
    }
}

// ---------- HTML UI ----------
if ($action === null && $method === 'GET' && empty($_GET)) {
    header('Content-Type: text/html; charset=utf-8'); ?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Operational Timeline — Editor</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root{--bg:#121514;--fg:#fff;--fg2:rgba(255,255,255,.75);--acc:#5afc27;}
    body{margin:0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,sans-serif;background:var(--bg);color:var(--fg);}
    h1{font-size:20px;margin:0 0 16px}
    .bar{display:flex;gap:8px;align-items:center;margin-bottom:16px}
    button,.btn{background:var(--acc);border:none;border-radius:8px;padding:10px 14px;font-weight:600;cursor:pointer}
    table{width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden}
    th,td{padding:10px 8px;border-bottom:1px solid #2a2f35;vertical-align:top}
    th{color:var(--fg2);text-align:left;font-weight:600;background:#181c1b}
    tr:hover{background:#161a19}
    input[type="text"], textarea{width:100%;box-sizing:border-box;background:#0f1211;border:1px solid #2a2f35;color:var(--fg);border-radius:8px;padding:8px}
    textarea{min-height:72px;resize:vertical}
    .muted{color:var(--fg2)}
    .row-actions{display:flex;gap:8px}
    .pill{font-size:12px;padding:2px 8px;border-radius:999px;background:#1e2422;border:1px solid #2a2f35}
    .footer{margin-top:16px;color:var(--fg2);font-size:12px}

    /* --- Modal styles --- */
    #login-modal { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; z-index: 9999; }
    #login-modal.show { display: flex; }
    #login-modal .overlay { position:absolute; inset:0; background: rgba(0,0,0,0.7); backdrop-filter: blur(2px); }
    #login-modal .panel {
      position: relative; z-index: 10;
      width: 100%; max-width: 420px;
      background: linear-gradient(180deg,#0b0d0c,#0f1211);
      border: 1px solid rgba(90,252,39,0.12);
      padding: 20px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);
    }
    #login-modal h2 { margin:0 0 10px; font-size:18px; color:var(--acc) }
    #login-modal p { margin:0 0 14px; color:var(--fg2); font-size:13px; }
    #login-modal label{display:block;font-size:13px;margin-bottom:6px;color:var(--fg2)}
    #login-modal input[type="password"]{
      width:100%; padding:10px;border-radius:8px;border:1px solid #24302a;background:#081009;color:var(--fg);
      box-sizing:border-box;margin-bottom:10px;font-size:14px;
    }
    #login-modal .actions{display:flex;gap:8px;align-items:center;justify-content:space-between}
    #login-modal .remember{display:flex;gap:8px;align-items:center;color:var(--fg2);font-size:13px}
    #login-modal .error{color:#ff6b6b;font-size:13px;margin-top:8px;display:none}
    #login-modal .hint{font-size:12px;color:var(--fg2);margin-top:8px}
    #login-modal .btn-login{background:var(--acc);padding:10px 14px;border-radius:8px;font-weight:700}
  </style>
</head>
<body>
  <h1>Operational Timeline — Editor</h1>
  <div class="bar">
    <button id="btn-reload">Refresh List</button>
    <span class="muted pill" id="status">—</span>
  </div>

  <table id="tbl">
    <thead>
      <tr>
        <th style="width:130px">Date (YYYY-MM-DD)</th>
        <th style="width:260px">Title</th>
        <th>Description</th>
        <th style="width:140px">Actions</th>
      </tr>
      <tr>
        <td><input type="text" id="new-date" placeholder="2024-09-01"></td>
        <td><input type="text" id="new-title" placeholder="New milestone"></td>
        <td><textarea id="new-desc" placeholder="Brief description"></textarea></td>
        <td><button id="btn-create">Add</button></td>
      </tr>
    </thead>
    <tbody id="tbody"></tbody>
  </table>

  <div class="footer">File: <code>data/OperationalTimeline.json</code>. Changes are written atomically with a backup.</div>

  <!-- Login Modal -->
  <div id="login-modal" aria-hidden="true" role="dialog" aria-labelledby="login-title">
    <div class="overlay" tabindex="-1"></div>
    <div class="panel" role="document">
      <h2 id="login-title">Login</h2>

      <label for="login-password">Password</label>
      <input id="login-password" type="password" autocomplete="current-password" placeholder="Enter password">

      <div class="actions">
        <div class="remember">
          <input id="remember" type="checkbox" />
          <label for="remember" style="margin:0;font-size:13px;color:var(--fg2)">Remember on this device</label>
        </div>
        <div style="margin-left:auto">
          <button id="btn-login" class="btn-login">Sign in</button>
        </div>
      </div>

      <div class="error" id="login-error">Invalid password</div>
    </div>
  </div>

<script>
const API = location.pathname + '?action=';

function setStatus(msg){ document.getElementById('status').textContent = msg; }

/* --------------------------
   Modal / Auth UI handling
   -------------------------- */
const modal = document.getElementById('login-modal');
const passwordInput = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const rememberCheckbox = document.getElementById('remember');
const btnLogin = document.getElementById('btn-login');

function showModal() {
  loginError.style.display = 'none';
  passwordInput.value = '';
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(()=> passwordInput.focus(), 50);
}

function hideModal() {
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
}

/* storage helpers */
function setLoggedIn(useLocal) {
  if (useLocal) {
    localStorage.setItem('isLoggedIn', 'true');
    sessionStorage.removeItem('isLoggedIn');
  } else {
    sessionStorage.setItem('isLoggedIn', 'true');
    localStorage.removeItem('isLoggedIn');
  }
}
function clearLoggedIn() {
  sessionStorage.removeItem('isLoggedIn');
  localStorage.removeItem('isLoggedIn');
}
function isClientLoggedIn() {
  return sessionStorage.getItem('isLoggedIn') === 'true' || localStorage.getItem('isLoggedIn') === 'true';
}

/* --------------------------
   API wrappers (include credentials)
   -------------------------- */
async function fetchJson(url, opts = {}) {
  opts.credentials = opts.credentials || 'same-origin';
  if (!opts.headers) opts.headers = {};
  const res = await fetch(url, opts);
  let body;
  try { body = await res.json(); } catch(e){ throw new Error(res.statusText || 'Invalid JSON'); }
  if (!res.ok) {
    const err = body && body.error ? body.error : (res.statusText || 'Error');
    throw new Error(err);
  }
  return body;
}

async function apiList() {
  return await fetchJson(API+'list', { method: 'GET' });
}

async function apiCreate(item) {
  return await fetchJson(API+'create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
}

async function apiUpdate(index, item) {
  return await fetchJson(API+'update', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index, ...item })
  });
}

async function apiDelete(index) {
  return await fetchJson(API+'delete&index='+encodeURIComponent(index), { method: 'DELETE' });
}

/* --------------------------
   Render & event wiring
   -------------------------- */

function escapeHtml(s) {
  return (''+s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}

async function render() {
  setStatus('Loading…');
  try {
    const list = await apiList();
    const tbody = document.getElementById('tbody');
    tbody.innerHTML = list.map(item => `
      <tr data-index="${item.index}">
        <td><input type="text" value="${escapeHtml(item.date||'')}" class="i-date"></td>
        <td><input type="text" value="${escapeHtml(item.title||'')}" class="i-title"></td>
        <td><textarea class="i-desc">${escapeHtml(item.description||'')}</textarea></td>
        <td class="row-actions">
          <button class="btn-save btn">Save</button>
          <button class="btn-del" style="background:#ff5c5c">Delete</button>
        </td>
      </tr>
    `).join('');
    setStatus(`Items: ${list.length}`);
  } catch(e) {
    // if server says Unauthorized -> clear client flag and show modal
    if (e.message && e.message.toLowerCase().includes('unauthorized')) {
      clearLoggedIn();
      showModal();
      setStatus('Unauthorized');
      return;
    }
    setStatus('Error: '+e.message);
  }
}

document.getElementById('btn-reload').addEventListener('click', render);

document.getElementById('btn-create').addEventListener('click', async () => {
  const date = document.getElementById('new-date').value.trim();
  const title = document.getElementById('new-title').value.trim();
  const description = document.getElementById('new-desc').value.trim();
  if (!date || !title || !description) { setStatus('Fill all fields'); return; }
  try {
    await apiCreate({ date, title, description });
    document.getElementById('new-date').value = '';
    document.getElementById('new-title').value = '';
    document.getElementById('new-desc').value = '';
    await render();
    setStatus('Created');
  } catch(e) {
    if (e.message && e.message.toLowerCase().includes('unauthorized')) {
      clearLoggedIn();
      showModal();
      setStatus('Unauthorized');
      return;
    }
    setStatus('Error: '+e.message);
  }
});

document.getElementById('tbody').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const tr = e.target.closest('tr');
  const index = parseInt(tr.dataset.index, 10);
  if (btn.classList.contains('btn-save')) {
    const date = tr.querySelector('.i-date').value.trim();
    const title = tr.querySelector('.i-title').value.trim();
    const description = tr.querySelector('.i-desc').value.trim();
    if (!date || !title || !description) { setStatus('Fill all fields'); return; }
    try {
      await apiUpdate(index, { date, title, description });
      await render();
      setStatus('Saved');
    } catch(err) {
      if (err.message && err.message.toLowerCase().includes('unauthorized')) {
        clearLoggedIn();
        showModal();
        setStatus('Unauthorized');
        return;
      }
      setStatus('Error: '+err.message);
    }
  }
  if (btn.classList.contains('btn-del')) {
    if (!confirm('Delete this item?')) return;
    try {
      await apiDelete(index);
      await render();
      setStatus('Deleted');
    } catch(err) {
      if (err.message && err.message.toLowerCase().includes('unauthorized')) {
        clearLoggedIn();
        showModal();
        setStatus('Unauthorized');
        return;
      }
      setStatus('Error: '+err.message);
    }
  }
});

/* --------------------------
   Login flow
   -------------------------- */

async function doLogin(password) {
  // POST to action=login - server sets $_SESSION['auth']=true on success
  const res = await fetch(API + 'login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ password })
  });
  let body;
  try { body = await res.json(); } catch(e) { throw new Error('Invalid response'); }
  if (!res.ok) {
    const err = body && body.error ? body.error : (res.statusText || 'Login failed');
    throw new Error(err);
  }
  return body;
}

btnLogin.addEventListener('click', async () => {
  loginError.style.display = 'none';
  const pwd = passwordInput.value || '';
  const remember = rememberCheckbox.checked;
  if (!pwd) {
    loginError.textContent = 'Please enter password';
    loginError.style.display = 'block';
    return;
  }
  try {
    await doLogin(pwd);
    // server accepted — set client-side flag (only a boolean), do NOT store password
    setLoggedIn(remember);
    hideModal();
    await render();
    setStatus('Logged in');
  } catch(err) {
    loginError.textContent = err.message || 'Invalid password';
    loginError.style.display = 'block';
  }
});

passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnLogin.click();
});

/* If client had a flag, try render; otherwise show modal.
   If session on server expired, API will return 403 and we will show modal.
*/
if (isClientLoggedIn()) {
  // attempt to load data — if unauthorized server-side, render() will show modal.
  render();
} else {
  // not flagged locally -> show modal and wait for login
  showModal();
}
</script>
</body>
</html>
<?php
    exit;
}

// -------- API (JSON) --------
if ($action === 'list' && $method === 'GET') {
  $data = read_json_file();
  $list = [];
  foreach ($data as $idx => $item) {
      $list[] = ['index'=>$idx, 'date'=>$item['date'], 'title'=>$item['title'], 'description'=>$item['description']];
  }
  usort($list, fn($a,$b)=>strcmp($b['date'],$a['date']));
  respond_json(200, $list);
}

if ($action === 'create' && $method === 'POST') {
    $payload = read_json_body();
    $item = validate_item($payload);
    $data = read_json_file();
    $data[] = $item;
    write_json_file($data);
    respond_json(200, ['ok'=>true, 'index'=>count($data)-1]);
}

if ($action === 'update' && ($method === 'PUT' || $method === 'POST')) {
    $payload = read_json_body();
    $index = get_index_from_params($payload);
    $item = validate_item($payload);
    $data = read_json_file();
    if (!array_key_exists($index, $data)) respond_json(404, ['ok'=>false,'error'=>'Index not found']);
    $data[$index] = $item;
    write_json_file($data);
    respond_json(200, ['ok'=>true, 'index'=>$index]);
}

if ($action === 'delete' && $method === 'DELETE') {
    $index = get_index_from_params($_GET);
    $data = read_json_file();
    if (!array_key_exists($index, $data)) respond_json(404, ['ok'=>false,'error'=>'Index not found']);
    array_splice($data, $index, 1);
    write_json_file($data);
    respond_json(200, ['ok'=>true]); }

respond_json(400, ['ok'=>false,'error'=>'Bad request']);
