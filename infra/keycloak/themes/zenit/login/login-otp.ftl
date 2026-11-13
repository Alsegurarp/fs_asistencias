<#import "template.ftl" as layout>
<#import "zenit.ftl" as zenit>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('totp'); section>
<!-- template: login-otp.ftl (zenit) -->
    <#if section="header">
        ${msg("zenitCodigoTitulo")}
    <#elseif section="form">
        <div class="za-col">
            <p class="za-sub">${msg("zenitCodigoSub")}</p>
            <form id="kc-otp-login-form" class="za-form za-form-codigo" aria-label="${msg('zenitCodigoForm')}" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
                <input id="selectedCredentialId" type="hidden" name="selectedCredentialId" value="${otpLogin.selectedCredentialId!''}">
                <#if otpLogin.userOtpCredentials?size gt 1>
                    <div class="za-apps" role="group" aria-label="${msg('zenitCodigoApps')}">
                        <#list otpLogin.userOtpCredentials as otpCredential>
                            <button type="button" id="kc-otp-credential-${otpCredential?index}" data-za-credencial="${otpCredential.id}"
                                    class="za-app<#if otpCredential.id == (otpLogin.selectedCredentialId!'')> za-app-activa</#if>">${otpCredential.userLabel}</button>
                        </#list>
                    </div>
                </#if>
                <#-- Un solo campo que se ve como seis casillas: se puede pegar y lo
                     llena el teléfono, que seis campos sueltos no permiten. -->
                <div class="za-lab">
                    <label for="otp">${msg("zenitCodigoCampo")}</label>
                    <span class="za-codigo">
                        <span class="za-casillas" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span></span>
                        <input id="otp" name="otp" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" autofocus
                               aria-invalid="<#if messagesPerField.existsError('totp')>true</#if>"/>
                    </span>
                    <@zenit.falla campo="totp" id="input-error-otp"/>
                </div>
                <button class="za-btn" id="kc-login" name="login" type="submit">${msg("zenitCodigoBoton")}</button>
            </form>
            <div class="za-fila">
                <a href="${url.loginRestartFlowUrl}">${msg("zenitVolver")}</a>
                <#if auth?has_content && auth.showTryAnotherWayLink()>
                    <a id="za-otra-forma" href="javascript:document.forms['kc-select-try-another-way-form'].requestSubmit()">${msg("doTryAnotherWay")}</a>
                </#if>
            </div>
            <p class="za-small za-dentro">${msg("zenitCodigoNota")}</p>
        </div>
    </#if>
</@layout.registrationLayout>
