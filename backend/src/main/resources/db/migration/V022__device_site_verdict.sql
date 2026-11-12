-- El lector fijo de una sede cuenta en ella aunque no mande ubicación.
alter table attendance_event drop constraint attendance_event_location_verdict_check;
alter table attendance_event add constraint attendance_event_location_verdict_check
    check (location_verdict in ('inside', 'outside', 'inconclusive', 'not_evaluated', 'device_site'));
