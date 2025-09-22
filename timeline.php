<?php
// timeline.php
// CRUD API + минимальный UI для файла data/OperationalTimeline.json

declare(strict_types=1);
header('X-Content-Type-Options: nosniff');

const FILE_PATH = __DIR__ . '/data/OperationalTimeline.json';

// ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ----------

function respond_json($code, $payload) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function read_json_file(): array {
    if (!file_exists(FILE_PATH)) {
        return [];
    }
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
    if ($tmp === false) {
        respond_json(500, ['ok'=>false, 'error'=>'Cannot create temp file']);
    }

    $pretty = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($pretty === false) {
        @unlink($tmp);
        respond_json(500, ['ok'=>false, 'error'=>'Cannot encode JSON']);
    }

    if (file_put_contents($tmp, $pretty, LOCK_EX) === false) {
        @unlink($tmp);
        respond_json(500, ['ok'=>false, 'error'=>'Cannot write temp file']);
    }

    // Бэкап (best-effort)
    if (file_exists(FILE_PATH)) {
        @copy(FILE_PATH, FILE_PATH . '.' . date('Ymd_His') . '.bak');
    }

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
    // поддержка form-urlencoded
    if (!empty($_POST)) return $_POST;
    parse_str($raw, $parsed);
    return is_array($parsed) ? $parsed : [];
}

function validate_item(array $item): array {
    $date = trim((string)($item['date'] ?? ''));
    $title = trim((string)($item['title'] ?? ''));
    $description = trim((string)($item['description'] ?? ''));

    // простая проверка даты YYYY-MM-DD
    if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        respond_json(422, ['ok'=>false, 'error'=>'Field "date" must be YYYY-MM-DD']);
    }
    if ($title === '') {
        respond_json(422, ['ok'=>false, 'error'=>'Field "title" is required']);
    }
    if ($description === '') {
        respond_json(422, ['ok'=>false, 'error'=>'Field "description" is required']);
    }
    return ['date'=>$date, 'title'=>$title, 'description'=>$description];
}

function get_index_from_params(array $params): int {
    // index может приходить в query (?index=) или в теле
    $idx = $params['index'] ?? ($_GET['index'] ?? null);
    if ($idx === null || $idx === '') {
        respond_json(400, ['ok'=>false, 'error'=>'Missing "index"']);
    }
    if (!is_numeric($idx)) {
        respond_json(400, ['ok'=>false, 'error'=>'"index" must be numeric']);
    }
    return (int)$idx;
}

// ---------- API РОУТИНГ ----------

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? null;

// Если явно не просили API (нет action и нет заголовка fetch), отдадим HTML-UI
if ($action === null && $method === 'GET' && empty($_GET)) {
    header('Content-Type: text/html; charset=utf-8'); ?>
<!doctype html>
<html lang="ru">
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
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .card{border:1px solid #2a2f35;background:#0f1211;border-radius:12px;padding:12px}
    .footer{margin-top:16px;color:var(--fg2);font-size:12px}
  </style>
</head>
<body>
  <h1>Operational Timeline — Editor</h1>

  <div class="bar">
    <button id="btn-reload">Обновить список</button>
    <span class="muted pill" id="status">—</span>
  </div>

  <table id="tbl">
    <thead>
      <tr>
        <th style="width:130px">Дата (YYYY-MM-DD)</th>
        <th style="width:260px">Заголовок</th>
        <th>Описание</th>
        <th style="width:140px">Действия</th>
      </tr>
      <tr>
        <td><input type="text" id="new-date" placeholder="2024-09-01"></td>
        <td><input type="text" id="new-title" placeholder="Новый этап"></td>
        <td><textarea id="new-desc" placeholder="Краткое описание"></textarea></td>
        <td><button id="btn-create">Добавить</button></td>
      </tr>
    </thead>
    <tbody id="tbody"></tbody>
  </table>

  <div class="footer">Файл: <code>data/OperationalTimeline.json</code>. Изменения пишутся атомарно, с резервной копией.</div>

<script>
const API = location.pathname + '?action=';

function setStatus(msg){ document.getElementById('status').textContent = msg; }

async function apiList() {
  const res = await fetch(API+'list', { method: 'GET' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function apiCreate(item) {
  const res = await fetch(API+'create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function apiUpdate(index, item) {
  const res = await fetch(API+'update', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index, ...item })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function apiDelete(index) {
  const res = await fetch(API+'delete&index='+encodeURIComponent(index), { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function rowTemplate(item, index) {
  return `
    <tr data-index="${index}">
      <td><input type="text" value="${escapeHtml(item.date||'')}" class="i-date"></td>
      <td><input type="text" value="${escapeHtml(item.title||'')}" class="i-title"></td>
      <td><textarea class="i-desc">${escapeHtml(item.description||'')}</textarea></td>
      <td class="row-actions">
        <button class="btn-save">Сохранить</button>
        <button class="btn-del" style="background:#ff5c5c">Удалить</button>
      </td>
    </tr>
  `;
}

function escapeHtml(s) {
  return (''+s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}

async function render() {
  setStatus('Загрузка…');
  try {
    const list = await apiList();
    const tbody = document.getElementById('tbody');
    tbody.innerHTML = list.map(rowTemplate).join('');
    setStatus(`Записей: ${list.length}`);
  } catch (e) {
    setStatus('Ошибка: '+e.message);
  }
}

document.getElementById('btn-reload').addEventListener('click', render);

document.getElementById('btn-create').addEventListener('click', async () => {
  const date = document.getElementById('new-date').value.trim();
  const title = document.getElementById('new-title').value.trim();
  const description = document.getElementById('new-desc').value.trim();
  if (!date || !title || !description) { setStatus('Заполните все поля'); return; }
  try {
    await apiCreate({ date, title, description });
    document.getElementById('new-date').value = '';
    document.getElementById('new-title').value = '';
    document.getElementById('new-desc').value = '';
    await render();
    setStatus('Создано');
  } catch (e) {
    setStatus('Ошибка: '+e.message);
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
    if (!date || !title || !description) { setStatus('Заполните все поля'); return; }
    try {
      await apiUpdate(index, { date, title, description });
      await render();
      setStatus('Сохранено');
    } catch (err) {
      setStatus('Ошибка: '+err.message);
    }
  }
  if (btn.classList.contains('btn-del')) {
    if (!confirm('Удалить запись?')) return;
    try {
      await apiDelete(index);
      await render();
      setStatus('Удалено');
    } catch (err) {
      setStatus('Ошибка: '+err.message);
    }
  }
});

render();
</script>
</body>
</html>
<?php
    exit;
}

// -------- API (JSON) --------
if ($action === 'list' && $method === 'GET') {
    $data = read_json_file();
    respond_json(200, $data);
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
    if (!array_key_exists($index, $data)) {
        respond_json(404, ['ok'=>false, 'error'=>'Index not found']);
    }
    $data[$index] = $item;
    write_json_file($data);
    respond_json(200, ['ok'=>true, 'index'=>$index]);
}

if ($action === 'delete' && $method === 'DELETE') {
    $index = get_index_from_params($_GET);
    $data = read_json_file();
    if (!array_key_exists($index, $data)) {
        respond_json(404, ['ok'=>false, 'error'=>'Index not found']);
    }
    array_splice($data, $index, 1);
    write_json_file($data);
    respond_json(200, ['ok'=>true]);
}

// Если ничего не сработало:
respond_json(400, ['ok'=>false, 'error'=>'Bad request']);

