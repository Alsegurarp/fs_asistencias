-- Dos formas de marcar, que se venden por separado: la tarjeta en el lector fijo
-- y el teléfono de la persona en la etiqueta de la sede.
-- El plan de la empresa lo fija la operación del servicio. Las empresas que ya
-- existen quedan con las dos, para no quitarles nada.
alter table tenant add column capture_methods text[] not null default '{card_terminal,phone_tag}'
    check (cardinality(capture_methods) > 0 and capture_methods <@ array['card_terminal', 'phone_tag']);

-- Una sede puede admitir menos de lo que trae el plan; nulo es todo lo del plan.
alter table site add column capture_methods text[]
    check (capture_methods is null or (cardinality(capture_methods) > 0 and capture_methods <@ array['card_terminal', 'phone_tag']));

-- Cada persona marca de una sola forma: con su tarjeta o con su teléfono.
alter table employee add column capture_method text not null default 'card'
    check (capture_method in ('card', 'phone'));

alter table attendance_rejection drop constraint attendance_rejection_code_check;
alter table attendance_rejection add constraint attendance_rejection_code_check check (code in (
    'card_unknown', 'card_revoked', 'card_not_owner', 'signature_invalid', 'session_invalid', 'payload_invalid', 'too_old',
    'method_not_allowed'
));
