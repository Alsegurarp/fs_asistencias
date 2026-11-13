<#import "template.ftl" as layout>
<#import "zenit.ftl" as zenit>
<#-- ACC-02 al entrar y ACC-06 al confirmar la descarga del expediente, que usa
     su propio cliente y pide un código nuevo aunque la sesión siga abierta. -->
<#assign expediente = (client?? && client.clientId == "zenit-dossier")>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('totp'); section>
<!-- template: login-otp.ftl (zenit) -->
    <#if section="header">
        <#if expediente><span class="za-chip">${msg("zenitExpedienteChip")}</span>${msg("zenitExpedienteTitulo")}<#else>${msg("zenitCodigoTitulo")}</#if>
    <#elseif section="form">
        <div class="za-col">
            <p class="za-sub">${msg(expediente?then("zenitExpedienteSub", "zenitCodigoSub"))}</p>
            <#if expediente && (auth.attemptedUsername)?has_content>
                <div class="za-cuenta">
                    <span class="za-avatar" aria-hidden="true">${auth.attemptedUsername[0]?upper_case}</span>
                    <span><strong>${msg("zenitExpedienteCuenta")}</strong><span class="za-tenue za-chico">${auth.attemptedUsername}</span></span>
                </div>
            </#if>
            <form id="kc-otp-login-form" class="za-form za-form-codigo" aria-label="${msg(expediente?then('zenitExpedienteForm', 'zenitCodigoForm'))}" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
                <input id="selectedCredentialId" type="hidden" name="selectedCredentialId" value="${otpLogin.selectedCredentialId!''}">
                <#if otpLogin.userOtpCredentials?size gt 1>
                    <div class="za-apps" role="group" aria-label="${msg('zenitCodigoApps')}">
                        <#list otpLogin.userOtpCredentials as otpCredential>
                            <button type="button" id="kc-otp-credential-${otpCredential?index}" data-za-credencial="${otpCredential.id}"
                                    class="za-app<#if otpCredential.id == (otpLogin.selectedCredentialId!'')> za-app-activa</#if>">${otpCredential.userLabel}</button>
                        </#list>
                    </div>
                </#if>
                <#if expediente>
                    <label class="za-lab" for="otp">${msg("zenitCodigoCampo")}
                        <input class="za-in" id="otp" name="otp" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" autofocus placeholder="000000"
                               aria-invalid="<#if messagesPerField.existsError('totp')>true</#if>"/>
                        <@zenit.falla campo="totp" id="input-error-otp"/>
                    </label>
                    <button class="za-btn" id="kc-login" name="login" type="submit">${msg("zenitExpedienteBoton")}</button>
                    <button class="za-btn2" type="button" data-za-atras>${msg("zenitExpedienteCancelar")}</button>
                <#else>
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
                </#if>
            </form>
            <#if !expediente>
                <div class="za-fila">
                    <a href="${url.loginRestartFlowUrl}">${msg("zenitVolver")}</a>
                    <#if auth?has_content && auth.showTryAnotherWayLink()>
                        <a id="za-otra-forma" href="javascript:document.forms['kc-select-try-another-way-form'].requestSubmit()">${msg("doTryAnotherWay")}</a>
                    </#if>
                </div>
                <p class="za-small za-dentro">${msg("zenitCodigoNota")}</p>
            </#if>
        </div>
    </#if>
</@layout.registrationLayout>
