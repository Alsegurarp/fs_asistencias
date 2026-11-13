<#import "template.ftl" as layout>
<#import "zenit.ftl" as zenit>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('password','password-confirm'); section>
<!-- template: login-update-password.ftl (zenit) -->
    <#if section = "header">
        ${msg("updatePasswordTitle")}
    <#elseif section = "form">
        <#assign largo = (passwordPolicies.length)!0>
        <#assign historia = (passwordPolicies.passwordHistory)!0>
        <div class="za-col">
            <p class="za-sub">${msg("zenitClaveSub")}</p>
            <form id="kc-passwd-update-form" class="za-form" aria-label="${msg('zenitClaveForm')}" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post" novalidate="novalidate">
                <@zenit.clave id="password-new" etiqueta=msg("passwordNew") autocomplete="new-password" campo="password" autofocus=true/>
                <@zenit.clave id="password-confirm" etiqueta=msg("passwordConfirm") autocomplete="new-password"/>
                <ul class="za-reglas" id="za-reglas" data-cumple="${msg('zenitClaveCumple')}" data-falta="${msg('zenitClaveFalta')}">
                    <#if largo gt 0>
                        <li data-za-regla="largo" data-valor="${largo?c}"><span class="za-marca" aria-hidden="true"><@zenit.palomita/></span>${msg("zenitClaveLargo", largo)}<span class="za-estado" aria-live="polite"></span></li>
                    </#if>
                    <li data-za-regla="cuenta" data-valor="${(username!'')}"><span class="za-marca" aria-hidden="true"><@zenit.palomita/></span>${msg("zenitClaveCuenta")}<span class="za-estado" aria-live="polite"></span></li>
                    <#if historia gt 0>
                        <li><span class="za-marca" aria-hidden="true"></span>${msg("zenitClaveHistoria", historia)}<span class="za-estado">${msg("zenitClaveAlGuardar")}</span></li>
                    </#if>
                </ul>
                <button class="za-btn" id="kc-submit" name="login" type="submit">${msg("zenitClaveBoton")}</button>
                <#if isAppInitiatedAction??>
                    <button class="za-btn2" id="kc-cancel" name="cancel-aia" value="true" type="submit">${msg("doCancel")}</button>
                </#if>
            </form>
            <p class="za-small">${msg("zenitClaveNota")}</p>
        </div>
    </#if>
</@layout.registrationLayout>
