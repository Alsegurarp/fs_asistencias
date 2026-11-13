<#import "template.ftl" as layout>
<#import "zenit.ftl" as zenit>
<@layout.registrationLayout displayRequiredFields=false displayMessage=!messagesPerField.existsError('totp','userLabel'); section>
<!-- template: login-config-totp.ftl (zenit) -->
    <#if section = "header">
        <#if !isAppInitiatedAction??><span class="za-chip">${msg("zenitFactorChip")}</span></#if>${msg("loginTotpTitle")}
    <#elseif section = "form">
        <#assign normal = totp.policy.type = "totp" && totp.policy.getAlgorithmKey() = "SHA1" && totp.policy.digits = 6 && totp.policy.period = 30>
        <div class="za-col">
            <p class="za-sub">${msg("zenitFactorSub")}</p>
            <form action="${url.loginAction}" class="za-form" id="kc-totp-settings-form" method="post" novalidate="novalidate">
                <ol id="kc-totp-settings" class="za-pasos">
                    <li>
                        <span class="za-num" aria-hidden="true">1</span>
                        <span><strong>${msg("zenitFactorPaso1")}</strong>
                            <span id="kc-totp-supported-apps" class="za-tenue">${msg("zenitFactorEjemplos")} <#list totp.supportedApplications as app>${msg(app)}<#sep><#if app?index == totp.supportedApplications?size - 2> ${msg("zenitO")} <#else>, </#if></#sep></#list>.</span>
                        </span>
                    </li>
                    <li>
                        <span class="za-num" aria-hidden="true">2</span>
                        <span class="za-crece"><strong>${msg("zenitFactorPaso2")}</strong>
                            <span class="za-qr">
                                <img id="kc-totp-secret-qr-code" src="data:image/png;base64, ${totp.totpSecretQrCode}" alt="${msg('zenitFactorQr')}">
                                <span class="za-tenue za-chico">${msg("zenitFactorClave")}<br>
                                    <code id="kc-totp-secret-key">${totp.totpSecretEncoded}</code>
                                    <#if !normal>
                                        <span id="kc-totp-detalle" class="za-detalle">${msg("loginTotpManualStep3")}
                                            <span id="kc-totp-type">${msg("loginTotpType")}: ${msg("loginTotp." + totp.policy.type)}</span>;
                                            <span id="kc-totp-algorithm">${msg("loginTotpAlgorithm")}: ${totp.policy.getAlgorithmKey()}</span>;
                                            <span id="kc-totp-digits">${msg("loginTotpDigits")}: ${totp.policy.digits}</span><#if totp.policy.type = "totp">;
                                            <span id="kc-totp-period">${msg("loginTotpInterval")}: ${totp.policy.period}</span></#if>
                                        </span>
                                    </#if>
                                </span>
                            </span>
                        </span>
                    </li>
                    <li>
                        <span class="za-num" aria-hidden="true">3</span>
                        <span class="za-crece"><label for="totp"><strong>${msg("zenitFactorPaso3")}</strong></label>
                            <input class="za-in" type="text" required id="totp" name="totp" autocomplete="one-time-code" inputmode="numeric" maxlength="${totp.policy.digits}"
                                   placeholder="${msg('zenitFactorCampo')}" aria-invalid="<#if messagesPerField.existsError('totp')>true</#if>"/>
                            <@zenit.falla campo="totp" id="input-error-otp-code"/>
                        </span>
                    </li>
                </ol>
                <input type="hidden" id="totpSecret" name="totpSecret" value="${totp.totpSecret}" />
                <#if mode??><input type="hidden" id="mode" name="mode" value="${mode}"/></#if>
                <#-- Keycloak sólo exige el nombre cuando la cuenta ya tiene otra app ligada. -->
                <#if totp.otpCredentials?size gte 1 || messagesPerField.existsError('userLabel')>
                    <label class="za-lab" for="userLabel">${msg("loginTotpDeviceName")}
                        <input class="za-in" type="text" id="userLabel" name="userLabel" autocomplete="off"
                               aria-invalid="<#if messagesPerField.existsError('userLabel')>true</#if>"/>
                        <@zenit.falla campo="userLabel" id="input-error-otp-label"/>
                    </label>
                </#if>
                <button class="za-btn" id="saveTOTPBtn" type="submit">${msg("zenitFactorBoton")}</button>
                <#if isAppInitiatedAction??>
                    <button class="za-btn2" id="cancelTOTPBtn" name="cancel-aia" value="true" type="submit">${msg("doCancel")}</button>
                </#if>
            </form>
            <p class="za-small"><#if !isAppInitiatedAction??>${msg("zenitFactorNotaPrimera")} </#if>${msg("zenitFactorNota")}</p>
        </div>
    </#if>
</@layout.registrationLayout>
