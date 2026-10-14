# Revisión documental de jornada y acuse

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
