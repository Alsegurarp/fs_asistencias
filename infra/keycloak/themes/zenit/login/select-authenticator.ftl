<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=false; section>
<!-- template: select-authenticator.ftl (zenit) -->
    <#if section = "header">
        ${msg("loginChooseAuthenticator")}
    <#elseif section = "form">
        <div class="za-col">
            <p class="za-sub">${msg("zenitFormaSub")}</p>
            <#list auth.authenticationSelections as authenticationSelection>
                <form class="za-forma" action="${url.loginAction}" method="post">
                    <input type="hidden" name="authenticationExecution" value="${authenticationSelection.authExecId}">
                    <button class="za-opt" type="submit">
                        <span class="za-opt-icono" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><#if authenticationSelection.displayName?contains("recovery")><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"></path><#else><rect x="7" y="2.8" width="10" height="18.4" rx="2.2"></rect><path d="M11 18h2"></path></#if></svg></span>
                        <span><strong>${msg('${authenticationSelection.displayName}')}</strong><span class="za-opt-detalle">${msg('${authenticationSelection.helpText}')}</span></span>
                    </button>
                </form>
            </#list>
            <a class="za-enlace" href="${url.loginRestartFlowUrl}">${msg("zenitAyudaVolver")}</a>
        </div>
    </#if>
</@layout.registrationLayout>
