<#-- En teléfono la nota de cada pantalla va debajo de la tarjeta, como en el
     lienzo; en escritorio va dentro de la columna y ésta se oculta. -->
<#macro content>
  <#if pageId?? && pageId == "login">
    <p class="za-small za-centro za-pie">${msg("zenitIngresoNotaCorta")}</p>
  <#elseif pageId?? && pageId == "login-otp">
    <p class="za-small za-centro za-pie">${msg("zenitCodigoNota")}</p>
  </#if>
</#macro>
