"""Request and response contracts for the assistant, report and evidence endpoints."""

from typing import Literal

from pydantic import BaseModel, Field

Profile = Literal["iss", "moon", "mars_transit"]


class DriftItem(BaseModel):
    label: str
    value: float
    bandLo: float
    bandHi: float
    status: str


class RiskItem(BaseModel):
    name: str
    level: str
    why: str
    actions: list[str] = []
    escalate: str = ""


class CrewContext(BaseModel):
    crew_name: str | None = None
    day: int | None = None
    mission_profile: Profile = "mars_transit"
    reading: dict[str, float | int | str | bool | None] = {}
    drift: list[DriftItem] = []
    risks: list[RiskItem] = []


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=2000)


class AssistantRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default=[], max_length=20)
    context: CrewContext | None = None


class ReportRequest(BaseModel):
    context: CrewContext
    complaint: str | None = Field(default=None, max_length=1000)
