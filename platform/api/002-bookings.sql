CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id uuid NOT NULL REFERENCES salons(id),
    name text NOT NULL,
    phone text NOT NULL,
    phone_key text NOT NULL,
    anonymized boolean NOT NULL DEFAULT false,
    UNIQUE (salon_id,id)
);
CREATE INDEX customers_lookup ON customers(salon_id,phone_key) WHERE NOT anonymized;

CREATE TABLE appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id uuid NOT NULL REFERENCES salons(id),
    customer_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    service_id uuid NOT NULL,
    service_name text NOT NULL,
    price_ore integer NOT NULL CHECK (price_ore >= 0),
    duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
    cleanup_minutes integer NOT NULL CHECK (cleanup_minutes >= 0),
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
    busy_until timestamptz NOT NULL CHECK (busy_until >= ends_at),
    status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','cancelled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    request_id uuid NOT NULL,
    request_hash text NOT NULL,
    token_hash text UNIQUE,
    UNIQUE (salon_id,request_id),
    FOREIGN KEY(salon_id,customer_id) REFERENCES customers(salon_id,id),
    FOREIGN KEY(salon_id,staff_id) REFERENCES staff(salon_id,id),
    FOREIGN KEY(salon_id,service_id) REFERENCES services(salon_id,id)
);
CREATE INDEX appointments_day ON appointments(salon_id,starts_at);
CREATE INDEX appointments_customer ON appointments(salon_id,customer_id,starts_at);

CREATE TABLE blocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id uuid NOT NULL REFERENCES salons(id),
    staff_id uuid NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
    reason text NOT NULL,
    FOREIGN KEY(salon_id,staff_id) REFERENCES staff(salon_id,id)
);
-- Both appointment cleanup and calendar blocks reserve the same physical employee time.
CREATE TABLE occupied_time (
    id uuid PRIMARY KEY,
    salon_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    span tstzrange NOT NULL,
    FOREIGN KEY(salon_id,staff_id) REFERENCES staff(salon_id,id),
    EXCLUDE USING gist (salon_id WITH =, staff_id WITH =, span WITH &&)
);
CREATE FUNCTION sync_occupied_time() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE until_at timestamptz;
BEGIN
  IF TG_OP <> 'INSERT' THEN DELETE FROM occupied_time WHERE id=OLD.id; END IF;
  IF TG_OP <> 'DELETE' THEN
    IF TG_TABLE_NAME='appointments' THEN
      IF NEW.status <> 'booked' THEN RETURN NEW; END IF;
      until_at := NEW.busy_until;
    ELSE
      until_at := NEW.ends_at;
    END IF;
    INSERT INTO occupied_time(id,salon_id,staff_id,span)
      VALUES(NEW.id,NEW.salon_id,NEW.staff_id,tstzrange(NEW.starts_at,until_at,'[)'));
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER occupied_appointments AFTER INSERT OR DELETE OR UPDATE OF starts_at,busy_until,staff_id,status
    ON appointments FOR EACH ROW EXECUTE FUNCTION sync_occupied_time();
CREATE TRIGGER occupied_blocks AFTER INSERT OR DELETE OR UPDATE OF starts_at,ends_at,staff_id
    ON blocks FOR EACH ROW EXECUTE FUNCTION sync_occupied_time();
