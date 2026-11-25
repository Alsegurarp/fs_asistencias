<?php
declare(strict_types=1);

final class PortalError extends RuntimeException {}

function setting(string $name): string
{
    $value = getenv($name);
    if ($value === false || $value === '') {
        throw new PortalError('El portal requiere configuración.', 503);
    }
    return $value;
}

function secureUrl(string $name): string
{
    $url = setting($name);
    if (parse_url($url, PHP_URL_SCHEME) !== 'https' || !parse_url($url, PHP_URL_HOST)) {
        throw new PortalError('El portal requiere direcciones HTTPS.', 503);
    }
    return rtrim($url, '/');
}

function query(array $params): string
{
    return http_build_query($params, '', '&', PHP_QUERY_RFC3986);
}

function requestJson(string $url, array $headers, ?array $form = null, bool $json = false): array
{
    if ($form !== null) {
        $headers[] = 'Content-Type: ' . ($json ? 'application/json' : 'application/x-www-form-urlencoded');
    }
    $context = stream_context_create(['http' => [
        'method' => $form === null ? 'GET' : 'POST',
        'header' => implode("\r\n", [...$headers, 'Accept: application/json']),
        'content' => $form === null ? '' : ($json ? json_encode($form, JSON_THROW_ON_ERROR) : query($form)),
        'follow_location' => 0,
        'ignore_errors' => true,
        'timeout' => 10,
    ]]);
    $body = @file_get_contents($url, false, $context, 0, 8 * 1024 * 1024);
    preg_match('/^HTTP\/\S+ (\d{3})/', $http_response_header[0] ?? '', $statusLine);
    $status = (int) ($statusLine[1] ?? 0);
    if (in_array($status, [401, 403], true)) {
        throw new PortalError('La sesión expiró o el acceso ya no está disponible.', $status);
    }
    if ($status === 400 || $status === 422) {
        throw new PortalError('Revisa los datos enviados o vuelve a iniciar sesión.', 400);
    }
    if ($status === 404) {
        throw new PortalError('El registro no está disponible.', 404);
    }
    $data = $body === false ? null : json_decode($body, true);
    if ($status !== 200 || !is_array($data)) {
        throw new PortalError('Zenit no pudo completar la consulta.', 502);
    }
    return $data;
}

function api(string $route, array $params = [], ?array $form = null): array
{
    if (isset($_SESSION['refresh_token'], $_SESSION['expires_at']) && time() >= $_SESSION['expires_at'] - 15) {
        storeTokens(requestJson(keycloak('token'), [], [
            'grant_type' => 'refresh_token',
            'client_id' => setting('ZENIT_CLIENT_ID'),
            'refresh_token' => $_SESSION['refresh_token'],
        ]));
    }
    $token = $_SESSION['access_token'] ?? '';
    if (!is_string($token) || !preg_match('/^[A-Za-z0-9._~-]+$/D', $token)) {
        throw new PortalError('Inicia sesión para continuar.', 401);
    }
    $apiUrl = setting('ZENIT_API_URL') === 'http://backend:8080/api/v1'
        ? 'http://backend:8080/api/v1' : secureUrl('ZENIT_API_URL');
    return requestJson($apiUrl . $route . '?' . query($params), [
        'Authorization: Bearer ' . $token,
    ], $form, true);
}

function storeTokens(array $tokens): void
{
    $_SESSION['access_token'] = $tokens['access_token'] ?? null;
    $_SESSION['refresh_token'] = $tokens['refresh_token'] ?? null;
    $_SESSION['expires_at'] = time() + (int) ($tokens['expires_in'] ?? 0);
}

function keycloak(string $endpoint): string
{
    if ($endpoint === 'token') {
        $internal = 'http://keycloak:8082/realms/zenit/protocol/openid-connect/token';
        if (getenv('ZENIT_TOKEN_URL') === $internal) {
            return $internal;
        }
    }
    return secureUrl('ZENIT_ISSUER') . '/protocol/openid-connect/' . $endpoint;
}

function redirect(string $url): never
{
    header('Location: ' . $url, true, 303);
    exit;
}

function startLogin(?string $invitation = null): never
{
    $verifier = bin2hex(random_bytes(32));
    $state = bin2hex(random_bytes(32));
    $_SESSION['authorization'] = ['state' => $state, 'verifier' => $verifier, 'created' => time(),
        'invitation' => $invitation];
    redirect(keycloak('auth') . '?' . query([
        'client_id' => setting('ZENIT_CLIENT_ID'),
        'redirect_uri' => secureUrl('ZENIT_PORTAL_URL') . '/?action=callback',
        'response_type' => 'code',
        'scope' => 'openid',
        'state' => $state,
        'code_challenge' => rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='),
        'code_challenge_method' => 'S256',
        'prompt' => $invitation === null ? null : 'login',
    ]));
}

function completeLogin(): never
{
    $attempt = $_SESSION['authorization'] ?? null;
    unset($_SESSION['authorization']);
    $code = input('code');
    if (!$attempt || time() - $attempt['created'] > 600 || $code === ''
        || !hash_equals($attempt['state'], input('state'))) {
        throw new PortalError('El inicio de sesión venció. Vuelve a intentarlo.', 400);
    }
    $tokens = requestJson(keycloak('token'), [], [
        'grant_type' => 'authorization_code',
        'client_id' => setting('ZENIT_CLIENT_ID'),
        'redirect_uri' => secureUrl('ZENIT_PORTAL_URL') . '/?action=callback',
        'code' => $code,
        'code_verifier' => $attempt['verifier'],
    ]);
    session_regenerate_id(true);
    $_SESSION = ['logout' => bin2hex(random_bytes(32))];
    storeTokens($tokens);
    if ($attempt['invitation'] !== null) {
        try {
            api('/audit-invitations/accept', [], ['token' => $attempt['invitation']]);
        } catch (PortalError $error) {
            $_SESSION = [];
            if (in_array($error->getCode(), [403, 404], true)) {
                throw new PortalError('La invitación venció, ya se usó o corresponde a otro correo verificado.', 403);
            }
            throw $error;
        }
    }
    redirect(secureUrl('ZENIT_PORTAL_URL') . '/');
}

function input(string $name, string $default = ''): string
{
    $value = $_GET[$name] ?? $default;
    if (!is_string($value)) {
        throw new PortalError('Filtro inválido.', 400);
    }
    return $value;
}

function identifier(string $value): string
{
    if ($value !== '' && !preg_match('/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/iD', $value)) {
        throw new PortalError('Selecciona un identificador válido.', 400);
    }
    return $value;
}

function dateFilter(string $value, DateTimeZone $zone): DateTimeImmutable
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, $zone);
    if (!$date || $date->format('Y-m-d') !== $value) {
        throw new PortalError('Selecciona una fecha válida.', 400);
    }
    return $date;
}

function h(string|int|float|null $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
