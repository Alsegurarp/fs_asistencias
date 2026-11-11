-- La tecnología de cada tarjeta, para mostrarla en el portal.
-- manual: la huella se escribió a mano (tarjeta simulada o sin firma).
-- mifare_classic_signed: tarjeta del piloto preparada por una terminal; son
-- las únicas que hasta hoy guardan versión de clave.
alter table card add column technology text not null default 'manual'
    check (technology in ('manual', 'mifare_classic_signed'));

update card set technology = 'mifare_classic_signed' where key_version is not null;
