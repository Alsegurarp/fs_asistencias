param([string]$CredentialsPath = 'secrets/demo-users.json')
$ErrorActionPreference = 'Stop'
$rootPath = Split-Path $PSScriptRoot -Parent
Push-Location $rootPath
try {
    $users = Get-Content -LiteralPath $CredentialsPath -Raw | ConvertFrom-Json
    $adminPassword = (Get-Content secrets/keycloak_admin_password -Raw).Trim()
    $token = Invoke-RestMethod -Method Post -Uri 'http://localhost:8082/realms/master/protocol/openid-connect/token' -Body @{
        client_id = 'admin-cli'; grant_type = 'password'; username = 'arranque'; password = $adminPassword
    }
    $headers = @{Authorization = "Bearer $($token.access_token)"}
    $adminBase = 'http://localhost:8082/admin/realms/zenit'
    foreach ($user in $users) {
        if ($user.email -notmatch '^demo\.[a-z_]+@zenit\.example$' -or $user.role -notin @('admin_empresa','rh','supervisor','auditor')) {
            throw 'Sólo se admiten las cuentas ficticias de esta demo local.'
        }
        $existing = Invoke-RestMethod -Headers $headers -Uri "$adminBase/users?exact=true&username=$([uri]::EscapeDataString($user.email))"
        if (@($existing).Count -eq 0) {
            $body = @{
                username = $user.email; email = $user.email; emailVerified = $true; enabled = $true
                firstName = 'Demo'; lastName = $user.role
                credentials = @(@{type='password'; value=$user.password; temporary=$false})
            } | ConvertTo-Json -Depth 6
            Invoke-RestMethod -Method Post -Headers $headers -Uri "$adminBase/users" -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($body)) | Out-Null
            Write-Host "Cuenta creada: $($user.email)"
        } else {
            Write-Host "Cuenta existente conservada: $($user.email)"
        }
    }
    $sql = @'
BEGIN;
INSERT INTO tenant (id, slug, name, status, time_zone, week_starts_on, break_policy)
VALUES ('daa00000-0000-4000-8000-000000000001', 'demo-local', 'Empresa Demo Local', 'active', 'America/Mexico_City', 'monday', 'not_considered')
ON CONFLICT (slug) DO NOTHING;
DO $$
DECLARE company uuid;
DECLARE account record;
DECLARE person uuid;
BEGIN
SELECT id INTO STRICT company FROM tenant WHERE slug = 'demo-local';
FOR account IN SELECT * FROM (VALUES
 ('demo.admin_empresa@zenit.example', 'admin_empresa'),
 ('demo.rh@zenit.example', 'rh'),
 ('demo.supervisor@zenit.example', 'supervisor'),
 ('demo.auditor@zenit.example', 'auditor')
) AS demo(email, role)
LOOP
 IF EXISTS (SELECT 1 FROM tenant_user WHERE email = account.email AND tenant_id <> company) THEN
  RAISE EXCEPTION 'Demo account belongs to another tenant';
 END IF;
 INSERT INTO tenant_user (tenant_id, id, email, display_name, status)
 VALUES (company, gen_random_uuid(), account.email, 'Demo ' || account.role, 'invited')
 ON CONFLICT (email) DO NOTHING;
 SELECT id INTO STRICT person FROM tenant_user WHERE email = account.email AND tenant_id = company;
 INSERT INTO tenant_user_role (tenant_id, user_id, role, granted_by)
 VALUES (company, person, account.role, 'local-demo-bootstrap') ON CONFLICT DO NOTHING;
END LOOP;
INSERT INTO audit_log (id, tenant_id, actor_type, actor_id, action, target_type, target_id, correlation_id)
VALUES (gen_random_uuid(), company, 'system', 'local-demo-bootstrap', 'local_demo.initialized', 'tenant', company::text, gen_random_uuid());
END $$;
COMMIT;
'@
    $sql | docker compose exec -T db sh -c 'PGPASSWORD="$(cat /run/secrets/db_migrator_password)" psql -h 127.0.0.1 -U zenit_migrator -d zenit -v ON_ERROR_STOP=1'
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron asignar los roles de la demo local.' }
    Write-Host 'Demo local preparada. El segundo factor del realm sigue vigente.'
} finally { Pop-Location }
