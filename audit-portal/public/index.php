<?php
declare(strict_types=1);

require __DIR__ . '/../src/zenit.php';

header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
$issuerHost = parse_url(getenv('ZENIT_ISSUER') ?: '', PHP_URL_HOST);
$issuerPort = parse_url(getenv('ZENIT_ISSUER') ?: '', PHP_URL_PORT);
$identityOrigin = is_string($issuerHost) && preg_match('/^[a-zA-Z0-9.-]+$/D', $issuerHost)
    ? ' https://' . $issuerHost . ($issuerPort ? ':' . $issuerPort : '') : '';
header("Content-Security-Policy: default-src 'none'; style-src 'self'; script-src 'self'; form-action 'self'$identityOrigin; frame-ancestors 'none'; base-uri 'none'");
session_name('__Host-zenit-audit');
session_start([
    'use_strict_mode' => true,
    'cookie_secure' => true,
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax',
    'cookie_path' => '/',
]);

$me = $errorCode = $week = $event = null;
$rows = $filters = [];
$incidents = [];
$dossierUrl = null;
$next = null;
$labels = ['Fecha del marcaje', 'Empleado', 'Sede', 'Terminal', 'Tipo', 'Resultado', 'Recepción', 'ID del evento'];

function records(array $page, DateTimeZone $zone): array
{
    $local = fn (string $instant): string => (new DateTimeImmutable($instant))->setTimezone($zone)->format('Y-m-d H:i:s P');
    return array_map(fn (array $row): array => [
        $local($row['observedAt']), $row['employeeId'], $row['siteId'] ?? '',
        $row['deviceId'], $row['type'], $row['outcome'], $local($row['receivedAt']), $row['id'],
    ], $page['items']);
}

function table(array $labels, array $rows): string
{
    $cells = fn (array $values, string $tag): string => implode('', array_map(
        fn ($value) => "<$tag>" . h($value) . "</$tag>",
        $values,
    ));
    $body = implode('', array_map(fn ($row) => '<tr>' . $cells($row, 'td') . '</tr>', $rows));
    return '<table><thead><tr>' . $cells($labels, 'th') . '</tr></thead><tbody>' . $body . '</tbody></table>';
}

function download(string $format, array $labels, array $rows, array $context): never
{
    if ($format === 'csv') {
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="marcajes.csv"');
        $file = fopen('php://output', 'wb');
        foreach ([$context, $labels, ...$rows] as $row) {
            fputcsv($file, array_map(fn ($value) => preg_match('/^[\x00-\x20]*[=+@-]|^[\t\r\n]/', $value)
                ? "'" . $value : $value, $row), ',', '"', '');
        }
        exit;
    }
    $autoload = __DIR__ . '/../vendor/autoload.php';
    if (!is_file($autoload)) {
        throw new PortalError('La descarga PDF requiere instalar las dependencias del portal.', 503);
    }
    require $autoload;
    $pdf = new Dompdf\Dompdf();
    $pdf->loadHtml('<meta charset="UTF-8"><style>body{font-family:DejaVu Sans;font-size:9pt}'
        . 'table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{overflow-wrap:break-word;'
        . 'border:1px solid #aaa;padding:4px}</style><h1>Marcajes de asistencia</h1><p>'
        . h(implode(' | ', $context)) . '</p>' . table($labels, $rows), 'UTF-8');
    $pdf->setPaper('A4', 'landscape');
    $pdf->render();
    $pdf->stream('marcajes.pdf');
    exit;
}

try {
    $action = input('action');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        if ($action === 'invite') {
            $invitation = $_POST['token'] ?? null;
            if (!is_string($invitation) || !preg_match('/^[A-Za-z0-9_-]{43}$/D', $invitation)) {
                throw new PortalError('La invitación no es válida. Pide un enlace nuevo a la empresa.', 404, 713);
            }
            startLogin($invitation);
        }
        $csrf = $_POST['csrf'] ?? null;
        if ($action !== 'logout' || !is_string($csrf) || !isset($_SESSION['logout'])
            || !hash_equals($_SESSION['logout'], $csrf)) {
            throw new PortalError('Solicitud inválida.', 400);
        }
        $_SESSION = [];
        session_destroy();
        redirect(keycloak('logout') . '?' . query([
            'client_id' => setting('ZENIT_CLIENT_ID'),
            'post_logout_redirect_uri' => secureUrl('ZENIT_PORTAL_URL') . '/',
        ]));
    }
    if ($action === 'login') {
        startLogin();
    }
    if ($action === 'callback') {
        completeLogin();
    }
    if (isset($_SESSION['access_token'])) {
        $me = api('/me');
        if (($me['access'] ?? '') !== 'active' || !isset($me['tenant'])
            || !in_array('auditor', $me['roles'] ?? [], true)) {
            throw new PortalError('Esta cuenta requiere un acceso de auditoría vigente.', 403);
        }
        $zone = new DateTimeZone($me['tenant']['timeZone']);
        $today = new DateTimeImmutable('today', $zone);
        $filters = [
            'from' => input('from', $today->modify('-6 days')->format('Y-m-d')),
            'to' => input('to', $today->format('Y-m-d')),
            'employeeId' => identifier(input('employeeId')),
            'siteId' => identifier(input('siteId')),
        ];
        $from = dateFilter($filters['from'], $zone);
        $to = dateFilter($filters['to'], $zone);
        if ($from > $to) {
            throw new PortalError('La fecha final debe ser igual o posterior a la inicial.', 400);
        }
        $params = array_filter([
            ...$filters,
            'from' => $from->format(DATE_ATOM),
            'to' => $to->modify('+1 day')->format(DATE_ATOM),
        ]);
        if ($action === 'week') {
            $employee = identifier(input('employeeId'));
            if ($employee === '') {
                throw new PortalError('Selecciona un empleado.', 400);
            }
            $week = api('/employees/' . $employee . '/attendance', [
                'week' => dateFilter(input('day'), $zone)->format('Y-m-d'),
            ]);
        }
        $export = in_array($action, ['csv', 'pdf'], true);
        $page = api('/attendance-events', [...$params, 'limit' => $export ? 200 : 50,
            'cursor' => $export ? null : input('cursor')]);
        $rows = records($page, $zone);
        $next = $page['nextCursor'];
        if ($action === 'event') {
            $eventId = identifier(input('event'));
            foreach ($page['items'] as $candidate) {
                if ($candidate['id'] === $eventId) {
                    $event = $candidate;
                    break;
                }
            }
            if ($event === null) {
                throw new PortalError('El evento no se encontró en esta página.', 404);
            }
            foreach ($event['incidentIds'] as $incidentId) {
                $incidents[] = api('/incidents/' . identifier($incidentId));
            }
        }
        if ($export) {
            while ($next !== null) {
                if (count($rows) >= 4000) {
                    throw new PortalError('Acota los filtros. El archivo admite hasta 4,000 marcajes.', 400);
                }
                $page = api('/attendance-events', [...$params, 'limit' => 200, 'cursor' => $next]);
                array_push($rows, ...records($page, $zone));
                $next = $page['nextCursor'];
            }
            download($action, $labels, $rows, [$me['tenant']['name'], $zone->getName(),
                'Desde ' . $filters['from'], 'Hasta ' . $filters['to'],
                'Empleado ' . ($filters['employeeId'] ?: 'Todos'), 'Sede ' . ($filters['siteId'] ?: 'Todas')]);
        }
        if (parse_url(secureUrl('ZENIT_PORTAL_URL'), PHP_URL_PATH) === '/auditoria'
            && (api('/me/dossier-permission')['enabled'] ?? false)) {
            $dossierUrl = '/reportes/expediente';
        }
    }
} catch (PortalError $e) {
    http_response_code($e->getCode());
    $errorCode = $e->supportCode;
    if (in_array($e->getCode(), [401, 403], true)) {
        unset($_SESSION['access_token'], $_SESSION['refresh_token'], $_SESSION['expires_at']);
    }
}
?>
<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Zenit · Auditoría</title>
    <link rel="stylesheet" href="./portal.css">
    <script src="./invitation.js" defer></script>
</head>
<body>
<header><strong>Zenit <span>Auditoría</span></strong>
    <?php if (isset($_SESSION['logout'])): ?>
        <form method="post" action="?action=logout">
            <input type="hidden" name="csrf" value="<?= h($_SESSION['logout']) ?>">
            <button type="submit">Cerrar sesión</button>
        </form>
        <?php if ($event): ?>
            <section>
                <h2>Registro de terminal</h2>
                <dl>
                    <dt>ID del evento</dt><dd><?= h($event['id']) ?></dd>
                    <dt>Terminal</dt><dd><?= h($event['deviceId']) ?></dd>
                    <dt>Modo de captura</dt><dd><?= h($event['deviceMode']) ?></dd>
                    <dt>Tipo y resultado</dt><dd><?= h($event['type']) ?> · <?= h($event['outcome']) ?></dd>
                    <dt>Tiempo hasta la recepción</dt><dd><?= h($event['delaySeconds']) ?> s</dd>
                    <dt>Huella del registro</dt><dd><?= h($event['payloadHash']) ?></dd>
                    <dt>Incidencias asociadas</dt>
                    <dd><?= h(implode(', ', $event['incidentIds']) ?: 'Sin incidencias asociadas') ?></dd>
                </dl>
                <?php if ($incidents): ?>
                    <h3>Resoluciones y ajustes</h3>
                    <div class="results">
                        <?= table(['Incidencia', 'Estado', 'Decisión', 'Motivo', 'Responsable', 'Fecha', 'Ajuste'],
                            array_map(function (array $incident): array {
                                $resolution = $incident['resolution'];
                                $adjustment = $resolution['adjustment'] ?? [];
                                return [$incident['type'], $incident['status'], $resolution['decision'] ?? '',
                                    $resolution['reason'] ?? '', $resolution['resolvedByName'] ?? $resolution['resolvedBy'] ?? '',
                                    $resolution['resolvedAt'] ?? '', implode(' · ', array_filter([
                                        $adjustment['kind'] ?? null, $adjustment['eventType'] ?? null, $adjustment['occurredAt'] ?? null,
                                    ]))];
                            }, $incidents)) ?>
                    </div>
                <?php endif; ?>
            </section>
        <?php endif; ?>
    <?php endif; ?>
</header>
<main>
    <?php if ($errorCode !== null): ?><p role="alert" class="error"><strong>Error <?= h($errorCode) ?></strong></p><?php endif; ?>
    <?php if (!isset($_SESSION['access_token'])): ?>
        <h1>Portal de auditoría</h1>
        <a class="button" href="?action=login">Iniciar sesión con Zenit</a>
    <?php elseif ($filters): ?>
        <h1>Marcajes de asistencia</h1>
        <p><?= h($me['tenant']['name']) ?> · <?= h($zone->getName()) ?></p>
        <form class="filters" method="get" action="./">
            <label>Desde<input type="date" name="from" required value="<?= h($filters['from']) ?>"></label>
            <label>Hasta<input type="date" name="to" required value="<?= h($filters['to']) ?>"></label>
            <label>ID del empleado<input name="employeeId" value="<?= h($filters['employeeId']) ?>"></label>
            <label>ID de la sede<input name="siteId" value="<?= h($filters['siteId']) ?>"></label>
            <button type="submit">Consultar</button>
        </form>
        <?php if ($week): ?>
            <section>
                <h2>Jornada de la semana del <?= h($week['weekStart']) ?></h2>
                <p>Minutos trabajados: <?= h($week['totals']['workedMinutes']) ?> ·
                    Ordinarios: <?= h($week['totals']['ordinaryMinutes']) ?> ·
                    Extra: <?= h($week['totals']['overtimeMinutes']) ?></p>
                <?= table(['Fecha', 'Trabajado (min)', 'Descanso (min)', 'Ordinario (min)', 'Extra (min)'],
                    array_map(fn ($day) => [$day['date'], $day['workedMinutes'], $day['breakMinutes'],
                        $day['ordinaryMinutes'], $day['overtimeMinutes']], $week['days'] ?? [])) ?>
                <p>Incidencias abiertas: <?= count($week['openIncidentIds']) ?></p>
                <div class="results">
                    <?= table(['Tipo de tramo', 'Inicio', 'Fin', 'Marcaje inicial', 'Marcaje final'],
                        array_map(fn ($segment) => [$segment['kind'], $segment['startAt'],
                            $segment['endAt'] ?? 'Incompleto', $segment['startEventId'], $segment['endEventId']],
                            $week['segments'])) ?>
                </div>
            </section>
        <?php endif; ?>
        <?php if (!$error): ?>
            <nav aria-label="Descargas">
                <a href="?<?= h(query([...$filters, 'action' => 'csv'])) ?>">Descargar CSV</a>
                <a href="?<?= h(query([...$filters, 'action' => 'pdf'])) ?>">Descargar PDF</a>
                <?php if ($dossierUrl): ?><a href="<?= h($dossierUrl) ?>">Expediente de la empresa</a><?php endif; ?>
            </nav>
            <?php if ($rows): ?>
                <div class="results">
                    <table>
                        <thead><tr><?php foreach ($labels as $label): ?><th scope="col"><?= h($label) ?></th><?php endforeach; ?><th scope="col">Jornada</th><th scope="col">Evidencia</th></tr></thead>
                        <tbody>
                        <?php foreach ($rows as $row): ?>
                            <tr>
                                <?php foreach ($row as $value): ?><td><?= h($value) ?></td><?php endforeach; ?>
                                <td><a href="?<?= h(query([...$filters, 'action' => 'week',
                                    'employeeId' => $row[1], 'day' => substr($row[0], 0, 10)])) ?>">Ver semana</a></td>
                                <td><a href="?<?= h(query([...$filters, 'action' => 'event', 'event' => $row[7],
                                    'cursor' => input('cursor')])) ?>">Ver evento</a></td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php else: ?><p>No se encontraron marcajes con esos filtros.</p><?php endif; ?>
            <?php if ($next): ?><p><a href="?<?= h(query([...$filters, 'cursor' => $next])) ?>">Página siguiente</a></p><?php endif; ?>
        <?php endif; ?>
    <?php endif; ?>
</main>
</body>
</html>
