from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class FlightResultsResponse(BaseModel):
    start_time: str
    journey_time: str
    price: int
    stars: int
    set: int


class FlightFilter(BaseModel):
    field: Literal["price", "stars"]
    op: Literal["eq", "lt", "lte", "gt", "gte"]
    value: float = Field(ge=0, allow_inf_nan=False, strict=True)


class FlightListingData(BaseModel):
    first_name: str
    last_name: str
    email_id: str
    phone_no: str
    travel_date: date
    travel_from: str
    travel_to: str
    filters: list[FlightFilter] = Field(default_factory=list, max_length=10)


class FlightListingRequest(BaseModel):
    data: FlightListingData
