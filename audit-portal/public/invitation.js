const invitation = /^#invitacion=([A-Za-z0-9_-]{43})$/.exec(location.hash)
if (invitation) {
    history.replaceState(null, '', location.pathname)
    const form = document.createElement('form')
    form.method = 'post'
    form.action = '?action=invite'
    const token = document.createElement('input')
    token.type = 'hidden'
    token.name = 'token'
    token.value = invitation[1]
    form.append(token)
    document.body.append(form)
    form.submit()
}
