<#-- Piezas que comparten las pantallas de acceso de Zenit. -->

<#macro ojo>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"></path><circle cx="12" cy="12" r="2.8"></circle></svg>
</#macro>

<#macro palomita tam=12>
<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 12.5 4 4 8-9"></path></svg>
</#macro>

<#-- Mensaje de error bajo un campo. -->
<#macro falla campo id>
  <#if messagesPerField.existsError(campo)>
    <span id="${id}" class="za-falla" aria-live="polite">${kcSanitize(messagesPerField.get(campo))?no_esc}</span>
  </#if>
</#macro>

<#-- Contraseña con el botón para verla dentro del campo. -->
<#macro clave id etiqueta autocomplete="current-password" campo=id autofocus=false conError=true>
  <label class="za-lab" for="${id}">${etiqueta}
    <span class="za-clave">
      <input class="za-in" id="${id}" name="${id}" type="password" autocomplete="${autocomplete}" <#if autofocus>autofocus</#if>
             aria-invalid="<#if conError && messagesPerField.existsError(campo)>true</#if>"/>
      <button class="za-ojo" type="button" aria-label="${msg('showPassword')}" aria-controls="${id}" aria-pressed="false"
              data-za-ver="${id}" data-ver="${msg('showPassword')}" data-ocultar="${msg('hidePassword')}"><@ojo/></button>
    </span>
    <#if conError><@falla campo=campo id="input-error-${id}"/></#if>
  </label>
</#macro>
