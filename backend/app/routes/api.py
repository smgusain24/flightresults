from typing import LiteralString

from fastapi import APIRouter
from psycopg import sql

from app.db import Conn
from app.schemas import FlightListingRequest, FlightResultsResponse

router = APIRouter(prefix="/api", tags=["flights"])

# API filter names -> flights columns, and API operators -> SQL operators.
# FlightFilter's Literal types restrict the request to exactly these keys.
FILTER_COLUMNS = {"price": "price", "stars": "rating"}
FILTER_OPERATORS: dict[str, LiteralString] = {
    "eq": "=",
    "lt": "<",
    "lte": "<=",
    "gt": ">",
    "gte": ">=",
}


def _journey_time(minutes: int) -> str:
    hours, minutes = divmod(minutes, 60)
    return f"{hours}h {minutes:02d}m" if hours else f"{minutes}m"


@router.post("/flight-listings", response_model=list[FlightResultsResponse])
def flight_listing(request: FlightListingRequest, conn: Conn):
    data = request.data
    # travel_date is validated by the schema but not filtered on: flights is a daily timetable.
    travel_from = data.travel_from
    travel_to = data.travel_to
    filters = data.filters

    conditions: list[sql.Composable] = [sql.SQL("source = %s"), sql.SQL("destination = %s")]
    params: list[object] = [travel_from, travel_to]
    for flight_filter in filters:
        conditions.append(
            sql.SQL("{} {} %s").format(
                sql.Identifier(FILTER_COLUMNS[flight_filter.field]),
                sql.SQL(FILTER_OPERATORS[flight_filter.op]),
            )
        )
        params.append(flight_filter.value)

    query = sql.SQL("""
        SELECT start_time, duration_minutes, price, rating, flight_set FROM flights
        WHERE {}
        ORDER BY start_time, id
    """).format(sql.SQL(" AND ").join(conditions))

    rows = conn.execute(query, params).fetchall()
    return [
        FlightResultsResponse(
            start_time=row["start_time"].strftime("%H:%M"),
            journey_time=_journey_time(row["duration_minutes"]),
            price=row["price"],
            stars=row["rating"],
            set=row["flight_set"],
        )
        for row in rows
    ]
