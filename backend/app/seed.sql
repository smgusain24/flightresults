-- Daily timetable used by the flight search. Safe to run more than once.
INSERT INTO flights (source, destination, start_time, duration_minutes, price, flight_set, rating) VALUES
    ('Hyderabad', 'Chennai', '07:00', 45, 4800, 1, 4),
    ('Chennai', 'Hyderabad', '07:30', 45, 5000, 1, 4),
    ('Hyderabad', 'Bengaluru', '08:00', 55, 5200, 1, 4),
    ('Bengaluru', 'Hyderabad', '08:10', 55, 5300, 1, 4),
    ('Bengaluru', 'Chennai', '08:30', 40, 4200, 1, 4),
    ('Chennai', 'Bengaluru', '09:00', 40, 4400, 1, 4),
    ('Hyderabad', 'Chennai', '08:00', 45, 5300, 2, 5),
    ('Chennai', 'Hyderabad', '08:30', 45, 5500, 2, 5),
    ('Hyderabad', 'Bengaluru', '09:00', 55, 5700, 2, 5),
    ('Bengaluru', 'Hyderabad', '09:10', 55, 5800, 2, 5),
    ('Bengaluru', 'Chennai', '09:30', 40, 4700, 2, 5),
    ('Chennai', 'Bengaluru', '10:00', 40, 4900, 2, 5)
ON CONFLICT (source, destination, start_time) DO NOTHING;
