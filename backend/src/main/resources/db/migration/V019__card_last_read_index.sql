-- La última lectura de una tarjeta (detalle de la tarjeta en el portal):
-- el marcaje más reciente con esa tarjeta, sin recorrer los de la empresa.
CREATE INDEX attendance_event_card_idx ON attendance_event (tenant_id, card_id, observed_at DESC);
