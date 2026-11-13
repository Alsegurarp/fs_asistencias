<#import "template.ftl" as layout>
<#import "zenit.ftl" as zenit>
<#import "passkeys.ftl" as passkeys>
<#-- ACC-06: antes de descargar el expediente, su cliente pide la contraseña y
     después un código nuevo, aunque la sesión del portal siga abierta. -->
<#assign expediente = (client?? && client.clientId == "zenit-dossier")>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password') displayInfo=false; section>
<!-- template: login.ftl (zenit) -->
    <#if section = "header">
        <#if expediente><span class="za-chip">${msg("zenitExpedienteChip")}</span>${msg("zenitExpedienteTitulo")}<#else>${msg("loginAccountTitle")}</#if>
    <#elseif section = "form">
        <div id="za-ingreso" class="za-col">
            <p class="za-sub">${msg(expediente?then("zenitExpedienteSub", "zenitIngresoSub"))}</p>
            <#if usernameHidden?? && (auth.attemptedUsername)?has_content>
                <div class="za-cuenta">
                    <span class="za-avatar" aria-hidden="true">${auth.attemptedUsername[0]?upper_case}</span>
                    <span class="za-crece"><strong>${msg("zenitExpedienteCuenta")}</strong><span class="za-tenue za-chico">${auth.attemptedUsername}</span></span>
                    <a class="za-chico" href="${url.loginRestartFlowUrl}">${msg("zenitOtraCuenta")}</a>
                </div>
            </#if>
            <#if realm.password>
                <form id="kc-form-login" class="za-form" aria-label="${msg('zenitIngresoForm')}" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post" novalidate="novalidate">
                    <#if !usernameHidden??>
                        <label class="za-lab" for="username">${msg("email")}
                            <input class="za-in" id="username" name="username" type="text" inputmode="email" value="${(login.username!'')}" autofocus
                                   autocomplete="${(enableWebAuthnConditionalUI?has_content)?then('username webauthn', 'username')}"
                                   aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"/>
                            <#if messagesPerField.existsError('username','password')>
                                <span id="input-error-username" class="za-falla" aria-live="polite">${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}</span>
                            </#if>
                        </label>
                    </#if>
                    <@zenit.clave id="password" etiqueta=msg("password") autofocus=usernameHidden?? conError=usernameHidden??/>
                    <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
                    <button class="za-btn" id="kc-login" name="login" type="submit">${msg(expediente?then("zenitExpedienteSeguir", "doLogIn"))}</button>
                    <#if expediente><button class="za-btn2" type="button" data-za-atras>${msg("zenitExpedienteCancelar")}</button></#if>
                </form>
            </#if>
            <#if expediente>
                <p class="za-small">${msg("zenitExpedienteNota")}</p>
            <#else>
                <a class="za-enlace" href="#za-ayuda">${msg("zenitAyudaTitulo")}</a>
                <p class="za-small za-centro za-dentro">${msg("zenitIngresoNota")}</p>
            </#if>
        </div>

        <#-- ACC-05: se abre con el enlace de arriba, sin salir de la página. -->
        <section id="za-ayuda" class="za-col" aria-labelledby="za-ayuda-titulo">
            <div>
                <h2 id="za-ayuda-titulo" class="za-h1">${msg("zenitAyudaTitulo")}</h2>
                <p class="za-sub">${msg("zenitAyudaSub")}</p>
            </div>
            <a class="za-opt" href="#">
                <span class="za-opt-icono" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.8" width="10" height="18.4" rx="2.2"></rect><path d="M11 18h2"></path></svg></span>
                <span><strong>${msg("zenitAyudaAppTitulo")}</strong><span class="za-opt-detalle">${msg("zenitAyudaAppDetalle")}</span></span>
            </a>
            <#if realm.resetPasswordAllowed>
                <a class="za-opt" href="${url.loginResetCredentialsUrl}">
                    <span class="za-opt-icono" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2"></rect><path d="m3.5 7 8.5 6 8.5-6"></path></svg></span>
                    <span><strong>${msg("zenitAyudaClaveTitulo")}</strong><span class="za-opt-detalle">${msg("zenitAyudaClaveCorreo")}</span></span>
                </a>
            <#else>
                <div class="za-opt">
                    <span class="za-opt-icono" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2"></rect><path d="m3.5 7 8.5 6 8.5-6"></path></svg></span>
                    <span><strong>${msg("zenitAyudaClaveTitulo")}</strong><span class="za-opt-detalle">${msg("zenitAyudaClaveAdmin")}</span></span>
                </div>
            </#if>
            <p class="za-aviso">${msg("zenitAyudaNada")}</p>
            <a class="za-enlace" href="#">${msg("zenitAyudaVolver")}</a>
        </section>
        <@passkeys.conditionalUIData />
    </#if>
</@layout.registrationLayout>
