-- A later change to salon policy must preserve the change deadline offered to each guest.
ALTER TABLE appointments ADD COLUMN change_hours integer;
UPDATE appointments a SET change_hours=s.change_hours FROM salons s WHERE a.salon_id=s.id;
ALTER TABLE appointments ALTER COLUMN change_hours SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN change_hours SET DEFAULT 24;
ALTER TABLE appointments ADD CONSTRAINT appointment_change_hours CHECK (change_hours BETWEEN 0 AND 168);
