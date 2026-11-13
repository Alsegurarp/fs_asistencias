// Pantallas de acceso de Zenit: ver la contraseña, elegir la app del código
// y marcar los requisitos de la contraseña mientras se escribe. Sin esto las
// pantallas funcionan igual; sólo pierden esas ayudas.
document.addEventListener('DOMContentLoaded', () => {
  for (const boton of document.querySelectorAll('[data-za-ver]')) {
    const campo = document.getElementById(boton.dataset.zaVer)
    boton.addEventListener('click', () => {
      const ver = campo.type === 'password'
      campo.type = ver ? 'text' : 'password'
      boton.setAttribute('aria-pressed', String(ver))
      boton.setAttribute('aria-label', ver ? boton.dataset.ocultar : boton.dataset.ver)
    })
  }

  // ACC-06: volver a la página del portal desde la que se pidió el expediente.
  for (const boton of document.querySelectorAll('[data-za-atras]')) boton.addEventListener('click', () => history.back())

  const elegida = document.getElementById('selectedCredentialId')
  for (const boton of document.querySelectorAll('[data-za-credencial]')) {
    boton.addEventListener('click', () => {
      elegida.value = boton.dataset.zaCredencial
      for (const otro of document.querySelectorAll('[data-za-credencial]')) otro.classList.toggle('za-app-activa', otro === boton)
    })
  }

  // Sólo dígitos en el código, también al pegarlo con espacios.
  const codigo = document.getElementById('otp')
  codigo?.addEventListener('input', () => { codigo.value = codigo.value.replace(/\D/g, '').slice(0, 6) })

  const reglas = document.getElementById('za-reglas')
  const nueva = document.getElementById('password-new')
  if (reglas && nueva) {
    const revisar = () => {
      const valor = nueva.value
      for (const regla of reglas.querySelectorAll('[data-za-regla]')) {
        const dato = regla.dataset.valor
        const cumple = regla.dataset.zaRegla === 'largo'
          ? [...valor].length >= Number(dato)
          : valor !== '' && (!dato || valor.toLowerCase() !== dato.toLowerCase())
        regla.classList.toggle('za-cumple', cumple)
        regla.querySelector('.za-estado').textContent = valor === '' ? '' : cumple ? reglas.dataset.cumple : reglas.dataset.falta
      }
    }
    nueva.addEventListener('input', revisar)
    revisar()
  }
})
