<?php
/**
 * 推箱子玩家关卡上传接口
 *
 * 接收数据后的处理步骤：
 *   1. 请求校验：仅允许 POST。
 *   2. 读取请求体：php://input 原始 JSON，限制 1MB，解析为关联数组。
 *   3. 字段校验：name（1-60）、rows/cols（6-20）、grid（字符/小人/箱子/目标规则）、
 *      solvedSteps（非负整数）、solvedRoute（解题步骤，U/D/L/R 字符序列，必填）。
 *   4. 去重：把 grid 拼成起始布局字符串并计算 md5；读取 list.json，
 *      若 levels 中已有相同 md5 则直接返回「已存在」，不重复写入。
 *   5. 分配编号：新关卡追加到 list.json 的 levels 数组末尾，编号 i = 数组长度 + 1。
 *   6. 写起始布局：纯文本写入 push_box_use_levels/levels/screen.{i}，
 *      格式与 push_box/levels/screen.N 完全一致（每行 join，末尾换行）。
 *   7. 写解题步骤：push_box_use_levels/results/screen.{i}，仅为解题方向序列
 *      （U/D/L/R，每格一步），不保存步数数字，也不保存完成布局。
 *   8. 更新列表：list.json 仅保存详细信息（含 md5），不含任何关卡内容。
 *   9. 返回结果：{ok:true, file:编号, md5:...}。
 *
 * 目录结构：
 *   push_box_use_levels/
 *     list.json                 关卡元信息列表（不含关卡内容）
 *     levels/screen.{i}         起始布局（与 push_box/levels 格式相同）
 *     results/screen.{i}        解题步骤（U/D/L/R 方向序列）
 *
 * 所有错误通过 respond(false, ...) 返回 JSON 并设置 HTTP 400。
 */

header('Content-Type: application/json; charset=utf-8');

function respond($ok, $message, $extra = array()) {
    $data = array_merge(array('ok' => $ok, 'message' => $message), $extra);
    if (!$ok) { http_response_code(400); }
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// 步骤 1：仅接受 POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, '仅支持 POST 请求');
}

// 步骤 2：读取并解析请求体
$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > 1048576) {
    respond(false, '请求数据为空或超过 1MB');
}
$data = json_decode($raw, true);
if (!is_array($data)) {
    respond(false, '无效的 JSON 数据');
}

/** 把二维字符网格转为关卡文本（与 push_box/levels/screen.N 一致） */
function grid_to_text($grid) {
    $lines = array();
    foreach ($grid as $row) { $lines[] = implode('', $row); }
    return rtrim(implode("\n", $lines)) . "\n";
}

/** 校验二维字符网格；$check_loose 表示是否要求至少 1 个箱子不在目标上 */
function validate_grid($grid, $rows, $cols, $label, $check_loose) {
    if (!is_array($grid) || count($grid) !== $rows) {
        respond(false, $label . ' 行数与设定不符');
    }
    $allowed = array(' ', '#', '@', '$', '.', '!', '*');
    $men = 0; $boxes = 0; $targets = 0; $loose = 0;
    foreach ($grid as $row) {
        if (!is_array($row) || count($row) !== $cols) {
            respond(false, $label . ' 列数与设定不符');
        }
        foreach ($row as $ch) {
            if (!is_string($ch) || strlen($ch) !== 1 || !in_array($ch, $allowed, true)) {
                respond(false, $label . ' 包含非法字符');
            }
            if ($ch === '@' || $ch === '!') { $men++; }
            if ($ch === '$' || $ch === '*') { $boxes++; if ($ch === '$') { $loose++; } }
            if ($ch === '.' || $ch === '*' || $ch === '!') { $targets++; }
        }
    }
    if ($men !== 1) { respond(false, $label . ' 必须有且只有 1 个小人'); }
    if ($boxes < 1) { respond(false, $label . ' 至少需要 1 个箱子'); }
    if ($targets !== $boxes) { respond(false, $label . ' 目标数必须等于箱子数'); }
    if ($check_loose && $loose < 1) { respond(false, $label . ' 至少需要 1 个箱子不在目标上'); }
    return true;
}

// 步骤 3：字段校验
$name = isset($data['name']) ? trim((string)$data['name']) : '';
if ($name === '' || mb_strlen($name) > 60) { respond(false, '关卡名称需为 1-60 个字符'); }

$rows = isset($data['rows']) ? (int)$data['rows'] : 0;
$cols = isset($data['cols']) ? (int)$data['cols'] : 0;
if ($rows < 6 || $rows > 20 || $cols < 6 || $cols > 20) { respond(false, '地图宽高必须在 6-20 之间'); }

if (!isset($data['grid'])) { respond(false, '缺少关卡地图数据'); }
validate_grid($data['grid'], $rows, $cols, '关卡地图', true);

$solvedSteps = isset($data['solvedSteps']) ? max(0, (int)$data['solvedSteps']) : 0;

// 解题步骤：U/D/L/R 方向序列，去掉空白与非法字符
$solvedRoute = isset($data['solvedRoute']) ? strtoupper(trim((string)$data['solvedRoute'])) : '';
$solvedRoute = preg_replace('/[^UDLR]/', '', $solvedRoute);
if ($solvedRoute === '') { respond(false, '缺少解题步骤（solvedRoute）'); }

// 步骤 4：计算起始布局 md5 并去重
$gridText = grid_to_text($data['grid']);
$md5 = md5($gridText);

$base = __DIR__ . '/push_box_use_levels';
$listPath = $base . '/list.json';
$levelsDir = $base . '/levels';
$resultsDir = $base . '/results';

$list = array('levels' => array());
if (is_file($listPath)) {
    $decoded = json_decode(file_get_contents($listPath), true);
    if (is_array($decoded) && isset($decoded['levels']) && is_array($decoded['levels'])) {
        $list = $decoded;
    }
}
foreach ($list['levels'] as $item) {
    if (isset($item['md5']) && $item['md5'] === $md5) {
        respond(false, '该关卡已存在（起始布局重复）', array('file' => isset($item['file']) ? $item['file'] : null));
    }
}

// 步骤 5：分配新编号（追加到数组末尾）
$fileNo = count($list['levels']) + 1;
$file = 'screen.' . $fileNo;

// 步骤 6-7：确保子目录存在并写入关卡内容文件
if (!is_dir($levelsDir) && !mkdir($levelsDir, 0755, true)) { respond(false, '无法创建 levels 目录'); }
if (!is_dir($resultsDir) && !mkdir($resultsDir, 0755, true)) { respond(false, '无法创建 results 目录'); }

if (file_put_contents($levelsDir . '/' . $file, $gridText, LOCK_EX) === false) {
    respond(false, '写入起始布局失败');
}
// 解题步骤文件仅保存方向序列（U/D/L/R），不含步数与完成布局
if (file_put_contents($resultsDir . '/' . $file, $solvedRoute, LOCK_EX) === false) {
    respond(false, '写入解题步骤失败');
}

// 步骤 8：更新 list.json（只存详细信息，不存关卡内容）
$list['levels'][] = array(
    'file' => $file,
    'fileNo' => $fileNo,
    'name' => $name,
    'rows' => $rows,
    'cols' => $cols,
    'md5' => $md5,
    'solvedSteps' => $solvedSteps,
    'uploadedAt' => date('c')
);
if (file_put_contents($listPath, json_encode($list, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX) === false) {
    respond(false, '写入关卡列表失败');
}

// 步骤 9：返回结果
respond(true, '上传成功', array('file' => $file, 'md5' => $md5));
