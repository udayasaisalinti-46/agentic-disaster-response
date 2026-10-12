
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(
    title="Agentic AI Disaster Response System",
    description="Emergency incident registration and coordination prototype",
    version="0.2.0",
)


class IncidentCreate(BaseModel):
    disaster_type: str = Field(min_length=2, max_length=50)
    description: str = Field(min_length=5, max_length=1000)
    location: str = Field(min_length=2, max_length=200)
    people_affected: int = Field(ge=0, le=10_000_000)
    urgency: int = Field(ge=1, le=5)
    source: str = Field(min_length=2, max_length=100)


incidents = []


def calculate_severity(people_affected: int, urgency: int) -> dict:
    # Transparent prototype rule; not clinical or official emergency triage.
    score = min(100, people_affected // 10 + urgency * 15)

    if score >= 75:
        level = "Critical"
    elif score >= 50:
        level = "High"
    elif score >= 25:
        level = "Medium"
    else:
        level = "Low"

    return {
        "score": score,
        "level": level,
        "rule": "min(100, people_affected // 10 + urgency * 15)",
    }


def find_possible_duplicate(new_incident: dict) -> Optional[dict]:
    for existing in incidents:
        same_type = (
            existing["disaster_type"].strip().casefold()
            == new_incident["disaster_type"].strip().casefold()
        )
        same_location = (
            existing["location"].strip().casefold()
            == new_incident["location"].strip().casefold()
        )

        if same_type and same_location:
            return existing

    return None


@app.get("/")
def home():
    return {
        "project": "Agentic AI Disaster Response System",
        "status": "running",
        "message": "Backend is working successfully",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/agents")
def list_agents():
    return {
        "agents": [
            "Emergency Incident Intake",
            "Situation Assessment and Severity",
            "Weather and Environmental Intelligence",
            "Geospatial and Accessibility",
            "Emergency Resource Management",
            "Resource Allocation and Response Planning",
            "Emergency Coordination and Action",
            "Reviewer and Critic",
        ],
        "note": "Agent roles are planned; full workflows will be implemented incrementally.",
    }


@app.post("/incidents", status_code=201)
def create_incident(incident: IncidentCreate):
    data = incident.model_dump()

    duplicate = find_possible_duplicate(data)
    severity = calculate_severity(
        data["people_affected"], data["urgency"]
    )

    record = {
        "incident_id": str(uuid4()),
        **data,
        "severity": severity,
        "possible_duplicate": duplicate is not None,
        "duplicate_of": (
            duplicate["incident_id"] if duplicate else None
        ),
        "status": "Reported",
        "verification_status": "Verification Required",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    incidents.append(record)

    return {
        "message": "Incident registered",
        "incident": record,
    }


@app.get("/incidents")
def get_incidents():
    return {
        "count": len(incidents),
        "incidents": incidents,
    }


@app.get("/incidents/{incident_id}")
def get_incident(incident_id: str):
    for incident in incidents:
        if incident["incident_id"] == incident_id:
            return incident

    raise HTTPException(status_code=404, detail="Incident not found")
