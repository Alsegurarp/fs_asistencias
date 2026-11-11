-- Las cifras de cada sede en Configuración: personas activas y terminales activas.
create index employee_active_site_idx on employee (tenant_id, site_id) where status = 'active';
create index device_active_terminal_site_idx on device (tenant_id, site_id) where mode = 'terminal' and status = 'active';
