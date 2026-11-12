/** Cómo se llama cada rol en pantalla. */
const roleNames: Record<string, string> = {
  admin_empresa: 'Administración', rh: 'RH', supervisor: 'Supervisión', auditor: 'Auditoría',
  trabajador: 'Trabajador', operador_saas: 'Operación del servicio',
}

export function roleLabel(role: string) { return roleNames[role] || role }
