# Revisión documental de jornada y acuse

## Actualización del 23 de octubre de 2026: conservación y uso de datos

El usuario indica resolver retención y reglas tomando como base la LFT y la
reducción gradual de jornada. Se consultaron de nuevo fuentes oficiales:

| Materia | Fuente y regla comprobada | Aplicación al proyecto |
| --- | --- | --- |
| Calendario | [DOF, 1 de mayo de 2026](https://dof.gob.mx/nota_detalle_popup.php?codigo=5786537), transitorios segundo y cuarto: 2027 tiene 46 horas ordinarias y 9 extraordinarias; 2028, 44/10; 2029, 42/11; 2030, 40/12 | V005 ya contiene estos valores y `WorkdayIT` comprueba su vigencia. No se sustituye 2027 por 40 horas ni se reescriben cierres históricos |
| Registro y exhibición | El mismo decreto, artículo 132 XXXIV: inicio/fin de jornada, entrega a la autoridad y acuerdo de ambas partes para la condición probatoria indicada | Preservar registro, versiones y trazabilidad. El clic de acuse actual no acredita por sí solo todo ese acuerdo |
| Conservación laboral | [LFT](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf), artículo 804, fracción III y penúltimo párrafo: controles del último año y un año después de extinguirse la relación | Conservar el último año de asistencia y, al terminar la relación, mantener ese conjunto hasta completar el año posterior; no borrar cada fila al cumplir 365 días. Verificar impedimentos legales antes de eliminar |
| Registros de seguridad social | [LSS](https://www.diputados.gob.mx/LeyesBiblio/pdf/LSS.pdf), artículo 15 II: cinco años para los registros allí descritos, como nóminas/listas de raya con días trabajados y salarios | Si el documento pertenece a esa categoría, aplicar también ese plazo. No convertirlo en una regla universal de cinco años para cada coordenada, sobre o copia Android |
| Finalidad, protección y supresión | [LFPDPPP](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf), artículos 10–14, 18, 20 y 24–25: finalidad y proporcionalidad, seguridad/confidencialidad, bloqueo y supresión con sus excepciones | Acceso por funciones, aviso de privacidad y conservación justificada; no uso ajeno a la finalidad ni retención indefinida por comodidad. Una obligación o actuación pendiente puede impedir cancelar datos |

Ejemplo de interpretación técnica del artículo 804, no plazo nuevo: si la
relación termina el 30 de junio de 2027, los controles del último año laboral
no se eliminan sólo porque sean antiguos; deben seguir disponibles durante
el año posterior a la terminación. Se revisan las demás obligaciones y
actuaciones pendientes antes de determinar su liberación.

La obligación documental del empleador no fija un plazo independiente para
cada caché del teléfono. Retirar una copia local requiere identificar dónde
queda el registro completo, íntegro y exhibible. Hoy no están cubiertos todos
los rechazos y acuses históricos: se conserva esa evidencia local hasta
resolver su archivo/recuperación. No se habilita una purga por antigüedad.
La rotación diaria/30 días de respaldos tampoco sustituye conservar el
archivo laboral durante su plazo aplicable.

La búsqueda del 23 en DOF/STPS no localizó las disposiciones generales del
registro de jornada; no demuestra que no existan. Se mantiene su revisión
antes de publicar y de enero de 2027; no se inventan requisitos de NFC,
biometría, formato o caducidad atribuyéndolos a lineamientos no localizados.

La ley exige resultados y protección, pero no elige por sí sola la política
comercial de suspensión del SaaS, la revocación de tarjetas al dar baja, las
sedes de un supervisor ni la interacción para declarar el tipo de marcaje.
Los límites y opciones concretas se distinguen en
[Decisiones de negocio](decisiones-de-negocio.md#criterio-legal-recibido-el-23-de-octubre).
Esta actualización no cierra las brechas del cálculo identificadas abajo.

## Recuperación por el empleador y servicios de terceros

El usuario confirma el cumplimiento de la ley como criterio rector del
desarrollo. «Archivo recuperable de toda la evidencia» describe un objetivo
técnico de preservación; no es una categoría textual de la LFT ni exige
guardar indefinidamente todos los datos técnicos del sistema.

- La LFT, artículos 804 y 836-A a 836-D, exige conservar/exhibir los
  documentos aplicables y aportar medios para apreciar, localizar y valorar
  la prueba electrónica. El artículo 836-D IV obliga al tercero que tenga el
  documento a ponerlo a disposición del Tribunal. No establece que un
  certificador externo deba habilitar cada recuperación del empleador.
- El [Reglamento de la LFPDPPP](https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LFPDPPP.pdf),
  artículo 52 II d), para servicios en nube contratados bajo las condiciones
  allí descritas, exige mecanismos de supresión al concluir el servicio una
  vez que el responsable haya podido recuperar sus datos. Los artículos
  49–51 delimitan al encargado, sus instrucciones, seguridad,
  confidencialidad y relación contractual; se preservan las excepciones de
  conservación legal. Es una base directa para entrega/recuperación al
  terminar el SaaS, no un requisito de contratar otro custodio.
- La [NOM-151-SCFI-2016](https://sidof.segob.gob.mx/notas/docFuente/5478024)
  tiene un ámbito de conservación/digitalización mercantil propio. Sus
  numerales 6.2 y 6.3 distinguen las constancias de un prestador de servicios
  de certificación acreditado del almacenamiento bajo control del usuario,
  que puede contratar a terceros. No extender automáticamente ese régimen
  a cada marcaje laboral ni confundir una constancia con un respaldo.

Aplicación de diseño propuesta para Zenit: el empleador normalmente actúa
como responsable del tratamiento laboral y fastSolution como encargado, según
el servicio y contrato efectivos. El rol `owner` o administrador de la app
no convierte a una persona en propietaria absoluta de los datos personales;
las personas trabajadoras conservan sus derechos.

El empleador autorizado debe disponer de una entrega por empresa que pueda
conservar y consultar: registros y periodos aplicables, versiones/ajustes y
evidencias necesarias para reproducirlos. Para ese propósito, **no se entrega
el respaldo completo multiempresa ni el realm de identidad**. Formato,
cifrado, verificación de contenido y procedimiento de recuperación son
decisiones técnicas; no se atribuyen a la ley como un formato obligatorio.
Se deben comprobar acceso, integridad, legibilidad y recuperación antes de
suprimir la copia del proveedor conforme al régimen aplicable.

Hoy el respaldo/restauración probado recupera la instalación; los exportes
actuales no constituyen un expediente completo por empresa. La entrega del
expediente, la salida del SaaS y las reglas contractuales correspondientes
siguen pendientes de implementación/aceptación. No se anuncia esa capacidad
como disponible ni se habilita por ello un borrado automático.

## Revisión inicial del 14 de octubre

Fecha de consulta: 14 de octubre de 2026. Ámbito: relaciones sujetas al
apartado A del artículo 123 y a la Ley Federal del Trabajo de México.
Es una revisión documental y técnica; no es un dictamen profesional ni una
autorización para usar el cálculo como liquidación de nómina.

## Fuentes oficiales

- [Decreto del DOF de 1 de mayo de 2026](https://dof.gob.mx/nota_detalle_popup.php?codigo=5786537).
  En vigor desde esa fecha. Sus transitorios mantienen los topes ordinarios
  de 48, 46, 44, 42 y 40 horas para 2026–2030, y extraordinarios de 9, 9, 10,
  11 y 12. El artículo 66 limita además la distribución extraordinaria a
  cuatro horas diarias y cuatro días semanales. El artículo 68 regula cuatro
  horas semanales adicionales y doce horas combinadas al día. El artículo
  132, fracción XXXIV, condiciona la eficacia probatoria plena del registro
  a acreditar acuerdo entre trabajador y empleador. Las disposiciones
  generales previstas entrarán en vigor el 1 de enero de 2027.
- [LFT, texto de la Cámara de Diputados](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf),
  última reforma indicada: 14 de mayo de 2026. Artículos 60–64: clasificación
  diurna, nocturna y mixta, máximos de 8, 7 y 7.5 horas, descanso mínimo y
  cómputo del descanso cuando no se puede salir. Artículos 5 y 33: no cabe
  renunciar a derechos laborales. Artículos 776 y 836-A–D: prueba electrónica
  y su valoración. Artículo 804: conservar controles de asistencia durante
  el último año y un año después del término de la relación; revisar también
  obligaciones adicionales y litigios antes de fijar la retención.

La búsqueda realizada no localizó las disposiciones generales de registro
electrónico. No acredita su inexistencia: comprobar el DOF otra vez antes
de publicar y de la entrada en vigor de 2027.

## Comparación con el código

| Prioridad | Hallazgo técnico | Consecuencia y acción |
| --- | --- | --- |
| Crítica | `WeekCalculator` define extraordinario sólo como exceso sobre el máximo semanal | Una semana de 45 horas con un día de 10 horas puede producir cero extraordinarias en 2026. No usar ese total para pagar nómina. Definir con asesoría el cálculo diario y semanal, el horario pactado y su distribución, sin duplicar minutos |
| Crítica | Los límites diarios ordinarios están en `rule_set`, pero `RuleLimits` no los recibe ni se clasifica la jornada | El límite combinado de 12 horas no sustituye los controles ordinarios. Agregar clasificación y alertas tras acordar cómo se identifica un turno y cómo se trata la parte nocturna |
| Crítica | Todo tramo `break` se descuenta | Una pausa puede ser tiempo efectivo. Hace falta distinguir descansos computables y no computables; no se deduce de la lectura NFC ni de estar dentro de la geocerca |
| Alta | No se controla el máximo de horas extraordinarias por día ni el número de días con ellas | Los topes semanales coinciden con el calendario, pero sus alertas no cubren todas las restricciones. No presentan conformidad laboral completa |
| Alta | `weeklyExcessOvertimeMaxMinutes` existe en la base, pero no se utiliza | No hay separación de las categorías extraordinarias ni cálculo de remuneración. Una alerta de exceso no debe ocultar minutos trabajados ni clasificarlos automáticamente como impagables |
| Alta | Cada tramo pertenece a la semana y fecha en que comienza; dos tramos de un turno con descanso pueden caer en fechas distintas | Probar cruces de medianoche y de semana antes de definir el cómputo diario. Decidir si la unidad es turno o día civil y cómo se agrupan los tramos |
| Alta | `Weeks.compute` elige las reglas del último día de la semana | Una semana que cruza el 1 de enero recibe un solo tope. El decreto no resuelve aquí esa atribución; pedir criterio documentado y crear casos de aceptación |
| Alta | V005 registra reglas desde enero de 2026; el decreto entró en vigor en mayo | No afirmar que las reglas nuevas validan retrospectivamente los meses previos. Revisar qué régimen debe aplicarse a periodos históricos; no editar una migración aplicada |
| Alta | Quien no marcó puede cerrar con cero; las alertas críticas no impiden necesariamente cerrar | Un cierre técnico no certifica legalidad ni equivale a falta injustificada. Definir revisión humana, vacaciones, incapacidades y evidencias faltantes |

Casos mínimos para la siguiente implementación: jornada diurna, nocturna y
mixta; 3.5 horas nocturnas; extraordinario diario sin exceso semanal; cinco
días con extraordinario; pausa computable; turno dividido por descanso que
cruza medianoche; transición anual; ausencia sin marcajes. Los resultados
esperados deben quedar aprobados por escrito antes de cambiar el algoritmo.

## Acuse: evidencia disponible y lo que falta

`Closures.acknowledge` verifica pertenencia, cierre vigente y unicidad por
versión. Conserva conformidad u objeción, nota, hora UTC, actor y huella ligada
al cierre; reabrir conserva la versión anterior. Estos controles ayudan a
rastrear la operación.

La huella la calcula el servidor. No es una firma del documento por parte
del trabajador, ni certifica por sí sola su identidad o que leyó el detalle.
El acceso por dispositivo personal usa la identidad vinculada al dispositivo;
hay que demostrar cómo se acredita la persona que opera ese teléfono.

**Conclusión técnica:** el acuse actual es una manifestación registrada sobre
una versión de resumen. No basta para afirmar que cumple automáticamente las
condiciones probatorias del artículo 132 ni que es una firma electrónica avanzada.

Antes de ofrecerlo como evidencia de acuerdo, resolver con asesoría:

1. Qué documento se presenta: periodo, zona, entradas y salidas, descansos,
   ajustes y totales; el resumen semanal no reemplaza el detalle.
2. Cómo se documentan identidad, acuerdo del empleador y vínculo con el
   contenido exacto mostrado. Conservar el texto y su versión, sin modificar
   evidencia anterior.
3. Cómo se entrega una copia reproducible al trabajador y se conserva el
   historial de objeciones y sus respuestas. Una objeción no se resuelve
   automáticamente ni impide reclamar diferencias.
4. Texto de interfaz propuesto, sujeto a aprobación jurídica: «He revisado el
   registro de esta semana. Puedo expresar conformidad u objeción. Mi respuesta
   no implica renunciar a derechos ni confirma el pago de salarios».

No se implementó ese texto ni se cambió el acuse con esta revisión.

## Qué se puede dar por cerrado

Se comprobó la procedencia documental del calendario de topes y se
identificaron las brechas del código. No se revisaron contratos individuales,
convenios colectivos, regímenes especiales ni criterios jurisprudenciales
aplicables a un cliente concreto. El cálculo y el acuse siguen pendientes de
dictamen y de los cambios que éste determine. No se modificaron cálculos,
cierres congelados, migraciones ni el contrato del API.

La retención documental no se cumple simplemente conservando una copia de
respaldo. El sistema debe conservar los registros necesarios, sus versiones
y la capacidad de exhibirlos; el respaldo cifrado es parte de su recuperación.
