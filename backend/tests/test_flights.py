import json

import pytest
from psycopg_pool import PoolTimeout

from app.db import get_conn

URL = "/api/flight-listings"
DATE = "2026-11-01"


def seed(client, **overrides):
    row = {
        "source": "DEL",
        "destination": "BOM",
        "start_time": "09:00",
        "duration_minutes": 130,
        "price": 5000,
        "flight_set": 1,
        "rating": 3,
        **overrides,
    }
    with client.app.state.pool.connection() as conn:
        conn.execute(
            "INSERT INTO flights "
            "(source, destination, start_time, duration_minutes, price, flight_set, rating) "
            "VALUES (%(source)s, %(destination)s, %(start_time)s, "
            "%(duration_minutes)s, %(price)s, %(flight_set)s, %(rating)s)",
            row,
        )


def search_data(**overrides):
    return {
        "first_name": "Asha",
        "last_name": "Rao",
        "email_id": "asha@example.com",
        "phone_no": "9876543210",
        "travel_date": DATE,
        "travel_from": "DEL",
        "travel_to": "BOM",
        **overrides,
    }


def search(client, filters=None, **overrides):
    data = search_data(**overrides)
    if filters is not None:
        data["filters"] = filters
    return client.post(URL, json={"data": data})


def prices(response):
    assert response.status_code == 200, response.text
    return [flight["price"] for flight in response.json()]


@pytest.fixture
def flights(client):
    """Three daily DEL→BOM flights, in start-time order: 3000/2★, 5000/4★, 7000/5★."""
    seed(client, start_time="18:00", price=7000, rating=5)
    seed(client, start_time="06:00", price=3000, rating=2)
    seed(client, start_time="09:00", price=5000, rating=4)
    return client


# --- route scoping and response shape ---------------------------------------


def test_without_filters_returns_every_flight_on_the_route_by_start_time(flights):
    seed(flights, source="BOM", destination="DEL", price=1)
    seed(flights, destination="BLR", price=2)

    assert prices(search(flights)) == [3000, 5000, 7000]


def test_empty_filter_list_behaves_like_no_filters(flights):
    assert prices(search(flights, filters=[])) == [3000, 5000, 7000]


def test_travel_date_does_not_narrow_the_daily_timetable(flights):
    assert prices(search(flights, travel_date="2030-02-28")) == [3000, 5000, 7000]


def test_response_maps_columns_to_api_fields(client):
    seed(client, start_time="09:15", duration_minutes=125, price=4999, flight_set=7, rating=4)

    response = search(client)

    assert response.status_code == 200
    assert response.json() == [
        {"start_time": "09:15", "journey_time": "2h 05m", "price": 4999, "stars": 4, "set": 7}
    ]


@pytest.mark.parametrize(
    ("minutes", "expected"),
    [(1, "1m"), (45, "45m"), (59, "59m"), (60, "1h 00m"), (65, "1h 05m"), (600, "10h 00m")],
)
def test_journey_time_formatting(client, minutes, expected):
    seed(client, duration_minutes=minutes)

    assert search(client).json()[0]["journey_time"] == expected


def test_no_matching_flights_returns_empty_list(flights):
    assert prices(search(flights, travel_to="GOI")) == []


@pytest.mark.parametrize("path", ["/api/flight-listing", "/api/users/flight-listing", "/api/users/flight-listings"])
def test_flight_listings_is_the_only_search_path(flights, path):
    response = flights.post(path, json={"data": search_data()})

    assert response.status_code == 404


# --- price and stars filters ------------------------------------------------


@pytest.mark.parametrize(
    ("op", "expected"),
    [
        ("eq", [5000]),
        ("lt", [3000]),
        ("lte", [3000, 5000]),
        ("gt", [7000]),
        ("gte", [5000, 7000]),
    ],
)
def test_price_operator_boundaries(flights, op, expected):
    response = search(flights, filters=[{"field": "price", "op": op, "value": 5000}])

    assert prices(response) == expected


@pytest.mark.parametrize(
    ("op", "value", "expected"),
    [
        ("eq", 4, [5000]),
        ("lt", 4, [3000]),
        ("lte", 4, [3000, 5000]),
        ("gt", 4, [7000]),
        ("gte", 4, [5000, 7000]),
        ("gte", 3.5, [5000, 7000]),
    ],
)
def test_stars_filter_matches_rating_column(flights, op, value, expected):
    response = search(flights, filters=[{"field": "stars", "op": op, "value": value}])

    assert prices(response) == expected


def test_fractional_price_value_compares_against_integer_prices(flights):
    response = search(flights, filters=[{"field": "price", "op": "lte", "value": 4999.99}])

    assert prices(response) == [3000]


def test_price_and_stars_filters_are_combined_with_and(flights):
    response = search(
        flights,
        filters=[
            {"field": "price", "op": "lte", "value": 5000},
            {"field": "stars", "op": "gte", "value": 4},
        ],
    )

    assert prices(response) == [5000]


def test_two_filters_on_one_field_form_a_range(flights):
    response = search(
        flights,
        filters=[
            {"field": "price", "op": "gte", "value": 4000},
            {"field": "price", "op": "lte", "value": 6000},
        ],
    )

    assert prices(response) == [5000]


def test_contradictory_filters_return_empty_list(flights):
    response = search(
        flights,
        filters=[
            {"field": "price", "op": "lt", "value": 3000},
            {"field": "price", "op": "gt", "value": 7000},
        ],
    )

    assert prices(response) == []


def test_zero_is_an_accepted_filter_value(flights):
    assert prices(search(flights, filters=[{"field": "price", "op": "gte", "value": 0}])) == [
        3000,
        5000,
        7000,
    ]


def test_ten_filters_is_the_maximum_accepted(flights):
    filters = [{"field": "price", "op": "gte", "value": 0}] * 10

    assert search(flights, filters=filters).status_code == 200


# --- invalid filters --------------------------------------------------------


@pytest.mark.parametrize(
    "bad_filter",
    [
        {"field": "duration_minutes", "op": "eq", "value": 1},
        {"field": "rating", "op": "eq", "value": 1},
        {"field": "PRICE", "op": "eq", "value": 1},
        {"field": "price; DROP TABLE flights; --", "op": "eq", "value": 1},
        {"field": "price", "op": "like", "value": 1},
        {"field": "price", "op": "<=", "value": 1},
        {"field": "price", "op": "lte", "value": -1},
        {"field": "price", "op": "lte", "value": "5000"},
        {"field": "price", "op": "lte", "value": "cheap"},
        {"field": "stars", "op": "gte", "value": True},
        {"field": "price", "op": "lte", "value": None},
        {"field": "price", "op": "lte", "value": [5000]},
        {"field": "price", "op": "lte"},
        {"op": "lte", "value": 1},
        {"field": "price", "value": 1},
        {},
        None,
        "price<=5000",
    ],
)
def test_invalid_filter_returns_422(flights, bad_filter):
    response = search(flights, filters=[bad_filter])

    assert response.status_code == 422


@pytest.mark.parametrize("value", ["inf", "-inf", "nan"])
def test_non_finite_filter_value_returns_422(flights, value):
    # json.dumps writes these as the non-standard tokens Infinity / -Infinity / NaN.
    filters = [{"field": "price", "op": "lte", "value": float(value)}]
    body = json.dumps({"data": search_data(filters=filters)})

    response = flights.post(URL, content=body, headers={"Content-Type": "application/json"})

    assert response.status_code == 422
    assert response.json()["detail"][0]["input"] == value


def test_non_finite_number_elsewhere_in_an_invalid_body_returns_422(flights):
    data = search_data(stray=float("nan"))
    del data["travel_to"]

    response = flights.post(
        URL, content=json.dumps({"data": data}), headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 422
    assert response.json()["detail"][0]["input"]["stray"] == "nan"


def test_validation_error_detail_keeps_fastapi_shape(flights):
    response = search(flights, filters=[{"field": "duration_minutes", "op": "eq", "value": 1}])

    error = response.json()["detail"][0]
    assert error["loc"] == ["body", "data", "filters", 0, "field"]
    assert error["type"] == "literal_error"
    assert error["input"] == "duration_minutes"


@pytest.mark.parametrize("filters", [None, {"field": "price", "op": "lte", "value": 1}, "price"])
def test_filters_that_are_not_a_list_return_422(flights, filters):
    response = flights.post(URL, json={"data": search_data(filters=filters)})

    assert response.status_code == 422


def test_more_than_ten_filters_returns_422(flights):
    filters = [{"field": "price", "op": "gte", "value": 0}] * 11

    assert search(flights, filters=filters).status_code == 422


# --- invalid request body ---------------------------------------------------


@pytest.mark.parametrize("travel_date", ["01-11-2026", "2026-13-01", "", "tomorrow", None])
def test_invalid_travel_date_returns_422(flights, travel_date):
    assert search(flights, travel_date=travel_date).status_code == 422


@pytest.mark.parametrize("missing", ["travel_date", "travel_from", "travel_to"])
def test_missing_search_field_returns_422(flights, missing):
    data = search_data()
    del data[missing]

    response = flights.post(URL, json={"data": data})

    assert response.status_code == 422


def test_body_without_data_envelope_returns_422(flights):
    response = flights.post(URL, json=search_data(filters=[]))

    assert response.status_code == 422


def test_missing_body_returns_422(flights):
    assert flights.post(URL).status_code == 422


def test_malformed_json_returns_422(flights):
    response = flights.post(URL, content=b"{not json", headers={"Content-Type": "application/json"})

    assert response.status_code == 422


def test_sql_in_route_fields_is_treated_as_data(flights):
    hostile = "DEL' OR '1'='1"

    assert prices(search(flights, travel_from=hostile)) == []
    assert prices(search(flights)) == [3000, 5000, 7000]


# --- dependency failure -----------------------------------------------------


def test_returns_503_when_pool_is_closed(flights):
    flights.app.state.pool.close()

    response = search(flights)

    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}


def test_returns_503_when_pool_times_out(flights):
    def timed_out():
        raise PoolTimeout("couldn't get a connection after 2.00 sec")
        yield  # pragma: no cover

    flights.app.dependency_overrides[get_conn] = timed_out

    assert search(flights).status_code == 503
