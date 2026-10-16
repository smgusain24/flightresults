CREATE TABLE IF NOT EXISTS users (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name  TEXT        NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 100),
    last_name   TEXT        NOT NULL CHECK (char_length(last_name) BETWEEN 1 AND 100),
    email_id    TEXT        NOT NULL CHECK (char_length(email_id) BETWEEN 1 AND 100),
    phone_no    TEXT        NOT NULL CHECK (char_length(phone_no) = 10),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flights (
    id               BIGINT  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source           TEXT    NOT NULL CHECK (char_length(source) BETWEEN 1 AND 100),
    destination      TEXT    NOT NULL CHECK (char_length(destination) BETWEEN 1 AND 100),
    start_time       TIME    NOT NULL,
    duration_minutes INT     NOT NULL CHECK (duration_minutes > 0),
    price            INT     NOT NULL CHECK (price > 0),
    flight_set       INT     NOT NULL,
    rating           INT     NOT NULL,
    UNIQUE (source, destination, start_time)
);
