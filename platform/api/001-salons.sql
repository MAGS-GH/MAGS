CREATE TABLE salons (
    id uuid PRIMARY KEY,
    slug text UNIQUE NOT NULL,
    name text NOT NULL,
    address text NOT NULL DEFAULT '',
    phone text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','paused')),
    accent text NOT NULL DEFAULT '#664439',
    logo_url text NOT NULL DEFAULT '',
    cover_url text NOT NULL DEFAULT '',
    slot_minutes int NOT NULL DEFAULT 15 CHECK (slot_minutes IN (5,10,15,20,30,60)),
    horizon_days int NOT NULL DEFAULT 60 CHECK (horizon_days BETWEEN 1 AND 365),
    notice_hours int NOT NULL DEFAULT 2 CHECK (notice_hours BETWEEN 0 AND 168),
    change_hours int NOT NULL DEFAULT 24 CHECK (change_hours BETWEEN 0 AND 168),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE services (
    id uuid PRIMARY KEY, salon_id uuid NOT NULL REFERENCES salons(id),
    name text NOT NULL, description text NOT NULL DEFAULT '', price_ore int NOT NULL CHECK (price_ore >= 0),
    duration_minutes int NOT NULL CHECK(duration_minutes > 0),
    cleanup_minutes int NOT NULL DEFAULT 0 CHECK(cleanup_minutes >= 0 AND duration_minutes + cleanup_minutes <= 1440),
    photo_url text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true,
    UNIQUE(salon_id,id)
);
CREATE TABLE staff (
    id uuid PRIMARY KEY, salon_id uuid NOT NULL REFERENCES salons(id),
    name text NOT NULL, photo_url text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true,
    UNIQUE(salon_id,id)
);
CREATE TABLE staff_services (
    salon_id uuid NOT NULL, staff_id uuid NOT NULL, service_id uuid NOT NULL,
    PRIMARY KEY(salon_id,staff_id,service_id),
    FOREIGN KEY(salon_id,staff_id) REFERENCES staff(salon_id,id),
    FOREIGN KEY(salon_id,service_id) REFERENCES services(salon_id,id)
);
CREATE TABLE shifts (
    salon_id uuid NOT NULL, staff_id uuid NOT NULL,
    weekday int NOT NULL CHECK(weekday BETWEEN 1 AND 7),
    start_min int NOT NULL, end_min int NOT NULL CHECK(0 <= start_min AND start_min < end_min AND end_min <= 1440),
    PRIMARY KEY(salon_id,staff_id,weekday,start_min),
    FOREIGN KEY(salon_id,staff_id) REFERENCES staff(salon_id,id)
);
CREATE TABLE shift_exceptions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, salon_id uuid NOT NULL, staff_id uuid NOT NULL,
    date date NOT NULL, start_min int, end_min int,
    CHECK((start_min IS NULL AND end_min IS NULL) OR (start_min IS NOT NULL AND end_min IS NOT NULL AND 0 <= start_min AND start_min < end_min AND end_min <= 1440)),
    FOREIGN KEY(salon_id,staff_id) REFERENCES staff(salon_id,id)
);
CREATE INDEX shift_exceptions_by_date ON shift_exceptions(salon_id,staff_id,date);
CREATE TABLE members (
    salon_id uuid REFERENCES salons(id) NOT NULL, sub uuid NOT NULL,
    role text NOT NULL CHECK(role IN ('owner','reception','staff')), staff_id uuid,
    CHECK ((role = 'staff' AND staff_id IS NOT NULL) OR (role <> 'staff' AND staff_id IS NULL)),
    PRIMARY KEY(salon_id,sub), UNIQUE(salon_id,staff_id),
    FOREIGN KEY(salon_id,staff_id) REFERENCES staff(salon_id,id)
);
CREATE TABLE invitations (
    id uuid PRIMARY KEY, salon_id uuid NOT NULL REFERENCES salons(id),
    role text NOT NULL CHECK(role IN ('owner','reception','staff')), staff_id uuid,
    token_hash bytea NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
    consumed_at timestamptz, created_by uuid NOT NULL,
    FOREIGN KEY(salon_id,staff_id) REFERENCES staff(salon_id,id)
);
CREATE INDEX invitations_by_salon ON invitations(salon_id);
CREATE TABLE media (
    id uuid PRIMARY KEY, salon_id uuid NOT NULL REFERENCES salons(id),
    mime text NOT NULL, contents bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX media_by_salon ON media(salon_id);
CREATE TABLE audit_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, salon_id uuid NOT NULL REFERENCES salons(id),
    actor_sub text, action text NOT NULL, entity_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_newest ON audit_events (salon_id, id DESC);
