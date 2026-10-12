
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
import uuid

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from backend.database import get_connection, initialize_database
import httpx
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Agentic AI Disaster Response System",
    description="Emergency incident registration and coordination prototype",
    version="0.3.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DisasterWorkflowRequest(BaseModel):
    incident: dict
    weather: dict
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    resources: list[dict] = Field(default_factory=list)
    required_resource_type: str = Field(min_length=1)
    quantity: int = Field(default=1, ge=1)

class IncidentCreate(BaseModel):
    disaster_type: str = Field(min_length=2, max_length=50)
    description: str = Field(min_length=5, max_length=1000)
    location: str = Field(min_length=2, max_length=200)
    people_affected: int = Field(ge=0, le=10_000_000)
    urgency: int = Field(ge=1, le=5)
    source: str = Field(min_length=2, max_length=100)



def calculate_severity(people_affected: int, urgency: int) -> dict:
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


# NEW: Emergency Incident Intake Agent
def emergency_incident_intake_agent(data: dict) -> dict:
    """Validate and summarize an incident report for human review."""
    required_fields = [
        "disaster_type",
        "description",
        "location",
        "people_affected",
        "urgency",
    ]

    missing_fields = [
        field
        for field in required_fields
        if data.get(field) is None
        or (
            isinstance(data.get(field), str)
            and not data[field].strip()
        )
    ]

    severity = calculate_severity(
        data["people_affected"],
        data["urgency"],
    )

    return {
        "agent": "Emergency Incident Intake",
        "validation": "Needs Review" if missing_fields else "Passed",
        "missing_fields": missing_fields,
        "severity_assessment": severity,
        "explanation": (
            f"Reported impact: {data['people_affected']} people; "
            f"urgency rating: {data['urgency']}/5. "
            f"Rule-based severity: {severity['level']} "
            f"(score {severity['score']}/100)."
        ),
        "human_review_required": True,
    }

def situation_assessment_agent(
    data: dict,
    intake_assessment: dict,
) -> dict:
    """Assess incident severity and identify response concerns."""
    severity = intake_assessment["severity_assessment"]
    concerns = []

    if severity["level"] == "Critical":
        concerns.append("Critical severity requires urgent human review.")

    if data["people_affected"] >= 100:
        concerns.append("Large number of people reported affected.")

    if data["urgency"] >= 4:
        concerns.append("High urgency reported.")

    return {
        "agent": "Situation Assessment and Severity",
        "severity_level": severity["level"],
        "severity_score": severity["score"],
        "concerns": concerns,
        "recommended_review": (
            "Urgent human review"
            if severity["level"] == "Critical" or data["urgency"] >= 4
            else "Standard human review"
        ),
        "human_decision_required": True,
    }

def weather_environmental_intelligence_agent(
    weather: dict,
) -> dict:
    """Interpret weather data and flag conditions for human review."""
    concerns = []

    temperature = weather.get("temperature_2m")
    precipitation = weather.get("precipitation")
    rain = weather.get("rain")
    wind_speed = weather.get("wind_speed_10m")
    humidity = weather.get("relative_humidity_2m")

    if precipitation is not None and precipitation >= 10:
        concerns.append("Elevated precipitation reported.")

    if rain is not None and rain >= 10:
        concerns.append("Heavy rain may affect response activities.")

    if wind_speed is not None and wind_speed >= 40:
        concerns.append("High wind speed may affect response activities.")

    if temperature is not None and temperature >= 40:
        concerns.append("High temperature may increase heat-related risks.")

    if temperature is not None and temperature <= 5:
        concerns.append("Low temperature may create exposure risks.")

    return {
        "agent": "Weather and Environmental Intelligence",
        "weather_summary": {
            "temperature_c": temperature,
            "humidity_percent": humidity,
            "precipitation_mm": precipitation,
            "rain_mm": rain,
            "wind_speed_kmh": wind_speed,
        },
        "concerns": concerns,
        "assessment": (
            "Weather concerns flagged for human review"
            if concerns
            else "No configured weather thresholds triggered"
        ),
        "human_review_required": True,
        "source": "Open-Meteo",
    }

def geospatial_accessibility_agent(
    latitude: float,
    longitude: float,
    road_accessible: bool | None = None,
) -> dict:
    """Validate incident coordinates and summarize access information."""
    valid_coordinates = (
        -90 <= latitude <= 90
        and -180 <= longitude <= 180
    )

    if not valid_coordinates:
        return {
            "agent": "Geospatial and Accessibility",
            "coordinates_valid": False,
            "location": None,
            "accessibility": "Unknown",
            "human_review_required": True,
            "message": "Coordinates are outside valid geographic ranges.",
        }

    if road_accessible is True:
        accessibility = "Reported accessible; verification required"
    elif road_accessible is False:
        accessibility = "Reported access concern; verification required"
    else:
        accessibility = "Unknown; field verification required"

    return {
        "agent": "Geospatial and Accessibility",
        "coordinates_valid": True,
        "location": {
            "latitude": latitude,
            "longitude": longitude,
        },
        "accessibility": accessibility,
        "human_review_required": True,
        "message": (
            "Coordinates validated. This does not verify road conditions "
            "or physical accessibility."
        ),
    }


def emergency_resource_management_agent(
    resources: list[dict],
    required_resource_type: str,
    required_quantity: int = 1,
) -> dict:
    """Assess whether enough matching resources are available."""
    matching_resources = [
        resource
        for resource in resources
        if str(resource.get("resource_type", "")).strip().casefold()
        == required_resource_type.strip().casefold()
    ]

    available = [
        resource
        for resource in matching_resources
        if str(resource.get("status", "")).strip().casefold()
        == "available"
    ]

    shortage = len(available) < required_quantity

    return {
        "agent": "Emergency Resource Management",
        "requested_resource_type": required_resource_type,
        "requested_quantity": required_quantity,
        "matching_resources": len(matching_resources),
        "available_resources": len(available),
        "shortage_detected": shortage,
        "recommendation": (
            "Human coordinator should identify alternative resources."
            if shortage
            else "Sufficient resources identified for coordinator review."
        ),
        "human_approval_required": True,
    }


def resource_allocation_planning_agent(
    resources: list[dict],
    required_resource_type: str,
    quantity: int = 1,
) -> dict:
    """Recommend matching available resources for human approval."""
    if quantity < 1:
        return {
            "agent": "Resource Allocation and Response Planning",
            "error": "Quantity must be at least 1.",
            "human_approval_required": True,
        }

    matching = [
        resource
        for resource in resources
        if str(resource.get("resource_type", "")).strip().casefold()
        == required_resource_type.strip().casefold()
        and str(resource.get("status", "")).strip().casefold()
        == "available"
    ]

    recommendations = matching[:quantity]

    return {
        "agent": "Resource Allocation and Response Planning",
        "requested_resource_type": required_resource_type,
        "requested_quantity": quantity,
        "recommended_quantity": len(recommendations),
        "recommended_resources": [
            {
                "resource_id": resource.get("resource_id"),
                "resource_type": resource.get("resource_type"),
            }
            for resource in recommendations
        ],
        "shortage": len(recommendations) < quantity,
        "status": "Recommendation Only",
        "human_approval_required": True,
    }

def emergency_coordination_action_agent(
    incident: dict,
    resource_plan: dict,
) -> dict:
    """Draft response steps for review by an emergency coordinator."""
    severity = incident.get("severity_level", "Unknown")
    steps = []

    if severity == "Critical":
        steps.append("Request urgent human review of the incident.")
    else:
        steps.append("Review incident details and confirm priority.")

    if resource_plan.get("shortage", False):
        steps.append("Identify alternative resources and nearby support.")
    elif resource_plan.get("recommended_quantity", 0) > 0:
        steps.append("Review the proposed resource recommendations.")

    steps.append("Confirm incident details and local conditions.")
    steps.append("Obtain authorized human approval before taking action.")

    return {
        "agent": "Emergency Coordination and Action",
        "incident_severity": severity,
        "proposed_steps": steps,
        "status": "Draft - Awaiting Human Review",
        "automatic_dispatch": False,
        "human_approval_required": True,
    }

def reviewer_critic_agent(
    incident: dict,
    resource_plan: dict,
    action_plan: dict,
) -> dict:
    """Review a proposed response plan before human approval."""
    issues = []

    if not incident.get("location"):
        issues.append("Incident location is missing.")

    if resource_plan.get("shortage", False):
        issues.append("Requested resources exceed available resources.")

    if not action_plan.get("human_approval_required", False):
        issues.append("Human approval requirement is missing.")

    if action_plan.get("automatic_dispatch", False):
        issues.append("Automatic dispatch must not occur in this prototype.")

    if not action_plan.get("proposed_steps"):
        issues.append("Response plan contains no proposed steps.")

    return {
        "agent": "Reviewer and Critic",
        "review_status": "Needs Revision" if issues else "Ready for Human Review",
        "issues": issues,
        "recommendation": (
            "Address the identified issues before submitting the plan."
            if issues
            else "Submit the plan to an authorized human reviewer."
        ),
        "final_authority": "Human Reviewer",
        "automatic_execution_allowed": False,
    }

def run_disaster_response_workflow(
    incident: dict,
    weather: dict,
    latitude: float,
    longitude: float,
    resources: list[dict],
    required_resource_type: str,
    quantity: int = 1,
) -> dict:
    """Coordinate the eight agents without executing emergency actions."""

    # Agent 1: Incident intake
    intake = emergency_incident_intake_agent(incident)

    # Agent 2: Situation assessment
    situation = situation_assessment_agent(incident, intake)

    # Agent 3: Weather intelligence
    weather_assessment = weather_environmental_intelligence_agent(weather)

    # Agent 4: Geospatial and accessibility
    geospatial = geospatial_accessibility_agent(latitude, longitude)

    # Agent 5: Resource management
    resource_assessment = emergency_resource_management_agent(
    resources, required_resource_type, quantity
)

    # Agent 6: Resource allocation planning
    resource_plan = resource_allocation_planning_agent(
        resources, required_resource_type, quantity
    )

    # Agent 7: Coordination and action planning
    action_plan = emergency_coordination_action_agent(
        {"severity_level": situation["severity_level"]},
        resource_plan,
    )

    # Agent 8: Reviewer and critic
    review = reviewer_critic_agent(
        incident,
        resource_plan,
        action_plan,
    )

    return {
        "workflow": "Agentic AI Disaster Response",
        "incident_intake": intake,
        "situation_assessment": situation,
        "weather_assessment": weather_assessment,
        "geospatial_assessment": geospatial,
        "resource_assessment": resource_assessment,
        "resource_plan": resource_plan,
        "action_plan": action_plan,
        "review": review,
        "automatic_dispatch": False,
        "human_approval_required": True,
    }

@app.post("/workflow/run")
def run_disaster_workflow_api(request: DisasterWorkflowRequest):
    try:
        return run_disaster_response_workflow(
            incident=request.incident,
            weather=request.weather,
            latitude=request.latitude,
            longitude=request.longitude,
            resources=request.resources,
            required_resource_type=request.required_resource_type,
            quantity=request.quantity,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Unable to process workflow input: {exc}",
        ) from exc


def row_to_dict(row):
    item = dict(row)
    item["possible_duplicate"] = bool(item["possible_duplicate"])
    item["severity"] = {
        "score": item.pop("severity_score"),
        "level": item.pop("severity_level"),
        "rule": "min(100, people_affected // 10 + urgency * 15)",
    }
    return item



@app.on_event("startup")
def startup():
    initialize_database()


@app.get("/api-info")
def home():
    return {
        "project": "Agentic AI Disaster Response System",
        "status": "running",
        "message": "Backend is connected to SQLite",
    }


@app.get("/health")
def health_check():
    with get_connection() as connection:
        connection.execute("SELECT 1").fetchone()

    return {
        "status": "healthy",
        "database": "connected",
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
        "note": "These roles will be implemented incrementally.",
    }


@app.post("/incidents", status_code=201)
def create_incident(incident: IncidentCreate):
    data = incident.model_dump()
    intake_assessment = emergency_incident_intake_agent(data)
    severity = intake_assessment["severity_assessment"]

    with get_connection() as connection:
        existing_rows = connection.execute(
            "SELECT * FROM incidents ORDER BY created_at"
        ).fetchall()

        duplicate = None
        for row in existing_rows:
            existing = dict(row)
            if (
                existing["disaster_type"].strip().casefold()
                == data["disaster_type"].strip().casefold()
                and existing["location"].strip().casefold()
                == data["location"].strip().casefold()
            ):
                duplicate = existing
                break

        incident_id = str(uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        status = "Reported"
        verification_status = "Verification Required"

        connection.execute(
            """
            INSERT INTO incidents (
                incident_id, disaster_type, description, location,
                people_affected, urgency, source, severity_score,
                severity_level, status, verification_status,
                possible_duplicate, duplicate_of, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                incident_id,
                data["disaster_type"],
                data["description"],
                data["location"],
                data["people_affected"],
                data["urgency"],
                data["source"],
                severity["score"],
                severity["level"],
                status,
                verification_status,
                1 if duplicate else 0,
                duplicate["incident_id"] if duplicate else None,
                created_at,
            ),
        )

        saved = connection.execute(
            "SELECT * FROM incidents WHERE incident_id = ?",
            (incident_id,),
        ).fetchone()

    
    return {
        "message": (
            "Possible duplicate detected; verification required"
            if duplicate
            else "Incident registered"
        ),
        "incident": row_to_dict(saved),
        "intake_assessment": intake_assessment,
    }



@app.get("/incidents")
def get_incidents():
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM incidents ORDER BY created_at"
        ).fetchall()

    return {
        "count": len(rows),
        "incidents": [row_to_dict(row) for row in rows],
    }


@app.get("/incidents/{incident_id}")
def get_incident(incident_id: str):
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM incidents WHERE incident_id = ?",
            (incident_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    return row_to_dict(row)

from typing import Literal

from pydantic import BaseModel, Field


class ResourceCreate(BaseModel):
    resource_type: Literal[
        "Ambulance",
        "Rescue Team",
        "Medical Kit",
        "Food Supply",
        "Boat",
        "Other"
    ]
    name: str = Field(min_length=2, max_length=100)
    location: str = Field(min_length=2, max_length=200)
    capacity: int = Field(ge=1, le=100000)


@app.post("/resources", status_code=201)
def create_resource(resource: ResourceCreate):
    resource_id = str(uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO resources (
                resource_id, resource_type, name,
                location, capacity, status, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                resource_id,
                resource.resource_type,
                resource.name,
                resource.location,
                resource.capacity,
                "Available",
                created_at,
            ),
        )

    return {
        "message": "Resource registered successfully",
        "resource": {
            "resource_id": resource_id,
            "resource_type": resource.resource_type,
            "name": resource.name,
            "location": resource.location,
            "capacity": resource.capacity,
            "status": "Available",
            "created_at": created_at,
        },
    }


@app.get("/resources")
def list_resources():
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM resources ORDER BY created_at DESC"
        ).fetchall()

    return {
        "count": len(rows),
        "resources": [dict(row) for row in rows],
    }

class ResourceStatusUpdate(BaseModel):
    status: Literal[
        "Available",
        "Reserved",
        "Deployed",
        "Returning"
    ]


@app.patch("/resources/{resource_id}/status")
def update_resource_status(
    resource_id: str,
    update: ResourceStatusUpdate
):
    allowed_transitions = {
        "Available": ["Reserved"],
        "Reserved": ["Deployed", "Available"],
        "Deployed": ["Returning"],
        "Returning": ["Available"]
    }

    with get_connection() as connection:
        resource = connection.execute(
            "SELECT * FROM resources WHERE resource_id = ?",
            (resource_id,)
        ).fetchone()

        if resource is None:
            raise HTTPException(
                status_code=404,
                detail="Resource not found"
            )

        current_status = resource["status"]
        new_status = update.status

        if new_status not in allowed_transitions[current_status]:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Cannot change status from {current_status} "
                    f"to {new_status}"
                )
            )

        result = connection.execute(
            """
            UPDATE resources
            SET status = ?
            WHERE resource_id = ? AND status = ?
            """,
            (new_status, resource_id, current_status)
        )

        if result.rowcount != 1:
            raise HTTPException(
                status_code=409,
                detail="Resource status changed; please try again"
            )

    return {
        "message": "Resource status updated successfully",
        "resource_id": resource_id,
        "previous_status": current_status,
        "current_status": new_status
    }

class AllocationCreate(BaseModel):
    incident_id: str
    resource_id: str


@app.post("/allocations", status_code=201)
def create_allocation(allocation: AllocationCreate):
    allocation_id = str(uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        # Ensure concurrent allocation attempts are serialized.
        connection.execute("BEGIN IMMEDIATE")

        incident = connection.execute(
            "SELECT incident_id FROM incidents WHERE incident_id = ?",
            (allocation.incident_id,)
        ).fetchone()

        if incident is None:
            raise HTTPException(
                status_code=404,
                detail="Incident not found"
            )

        resource = connection.execute(
            "SELECT * FROM resources WHERE resource_id = ?",
            (allocation.resource_id,)
        ).fetchone()

        if resource is None:
            raise HTTPException(
                status_code=404,
                detail="Resource not found"
            )

        if resource["status"] != "Available":
            raise HTTPException(
                status_code=409,
                detail=(
                    "Resource is not available. Current status: "
                    + resource["status"]
                )
            )

        connection.execute(
            """
            UPDATE resources
            SET status = 'Reserved'
            WHERE resource_id = ? AND status = 'Available'
            """,
            (allocation.resource_id,)
        )

        updated_resource = connection.execute(
            "SELECT status FROM resources WHERE resource_id = ?",
            (allocation.resource_id,)
        ).fetchone()

        if updated_resource["status"] != "Reserved":
            raise HTTPException(
                status_code=409,
                detail="Resource reservation failed"
            )

        connection.execute(
            """
            INSERT INTO allocations (
                allocation_id, incident_id, resource_id,
                status, created_at
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                allocation_id,
                allocation.incident_id,
                allocation.resource_id,
                "Reserved",
                created_at
            )
        )

    return {
        "message": "Resource allocated successfully",
        "allocation_id": allocation_id,
        "incident_id": allocation.incident_id,
        "resource_id": allocation.resource_id,
        "status": "Reserved",
        "created_at": created_at
    }


@app.get("/allocations")
def list_allocations():
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM allocations ORDER BY created_at DESC"
        ).fetchall()

    return {
        "count": len(rows),
        "allocations": [dict(row) for row in rows]
    }

class ShelterCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    location: str = Field(min_length=2, max_length=200)
    total_capacity: int = Field(ge=1, le=100000)


@app.post("/shelters", status_code=201)
def create_shelter(shelter: ShelterCreate):
    shelter_id = str(uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO shelters (
                shelter_id, name, location,
                total_capacity, occupied, status, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                shelter_id,
                shelter.name,
                shelter.location,
                shelter.total_capacity,
                0,
                "Open",
                created_at,
            ),
        )

    return {
        "message": "Shelter registered successfully",
        "shelter": {
            "shelter_id": shelter_id,
            "name": shelter.name,
            "location": shelter.location,
            "total_capacity": shelter.total_capacity,
            "occupied": 0,
            "available_capacity": shelter.total_capacity,
            "status": "Open",
            "created_at": created_at,
        },
    }


@app.get("/shelters")
def list_shelters():
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM shelters ORDER BY created_at DESC"
        ).fetchall()

    shelters = []

    for row in rows:
        item = dict(row)
        item["available_capacity"] = (
            item["total_capacity"] - item["occupied"]
        )
        shelters.append(item)

    return {
        "count": len(shelters),
        "shelters": shelters,
    }

class ShelterOccupancyUpdate(BaseModel):
    occupied: int = Field(ge=0, le=100000)


@app.patch("/shelters/{shelter_id}/occupancy")
def update_shelter_occupancy(
    shelter_id: str,
    update: ShelterOccupancyUpdate
):
    with get_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")

        shelter = connection.execute(
            "SELECT * FROM shelters WHERE shelter_id = ?",
            (shelter_id,)
        ).fetchone()

        if shelter is None:
            raise HTTPException(
                status_code=404,
                detail="Shelter not found"
            )

        capacity = shelter["total_capacity"]

        if update.occupied > capacity:
            raise HTTPException(
                status_code=409,
                detail=f"Occupancy cannot exceed capacity ({capacity})"
            )

        connection.execute(
            "UPDATE shelters SET occupied = ? WHERE shelter_id = ?",
            (update.occupied, shelter_id)
        )

    percentage = (update.occupied / capacity) * 100

    if update.occupied >= capacity:
        alert = "FULL"
        message = "Shelter is full. Do not assign additional people."
    elif percentage >= 90:
        alert = "NEAR_FULL"
        message = "Warning: Shelter occupancy has reached 90% or more."
    else:
        alert = "NORMAL"
        message = "Shelter has available capacity."

    return {
        "shelter_id": shelter_id,
        "occupied": update.occupied,
        "total_capacity": capacity,
        "available_capacity": capacity - update.occupied,
        "occupancy_percentage": round(percentage, 2),
        "alert": alert,
        "message": message
    }

@app.get("/weather")
async def get_weather(latitude: float, longitude: float):
    if not -90 <= latitude <= 90:
        raise HTTPException(
            status_code=422,
            detail="Latitude must be between -90 and 90"
        )

    if not -180 <= longitude <= 180:
        raise HTTPException(
            status_code=422,
            detail="Longitude must be between -180 and 180"
        )

    url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": (
            "temperature_2m,"
            "relative_humidity_2m,"
            "precipitation,"
            "rain,"
            "wind_speed_10m,"
            "weather_code"
        ),
        "timezone": "auto"
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Weather service is temporarily unavailable"
        )

    return {
        "source": "Open-Meteo",
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "current_weather": data.get("current")
    }

class WeatherAssessmentRequest(BaseModel):
    incident_id: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


@app.post("/weather/assessments")
async def create_weather_assessment(request: WeatherAssessmentRequest):
    with get_connection() as connection:
        incident = connection.execute(
            "SELECT * FROM incidents WHERE incident_id = ?",
            (request.incident_id,)
        ).fetchone()

    if incident is None:
        raise HTTPException(
            status_code=404,
            detail="Incident not found"
        )

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": request.latitude,
        "longitude": request.longitude,
        "current": (
            "temperature_2m,precipitation,rain,"
            "wind_speed_10m,weather_code"
        ),
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            weather = response.json()["current"]
    except (httpx.HTTPError, KeyError, ValueError):
        raise HTTPException(
            status_code=502,
            detail="Weather provider unavailable or returned invalid data"
        )

    precipitation = float(weather.get("precipitation") or 0)
    wind_speed = float(weather.get("wind_speed_10m") or 0)
    weather_code = int(weather.get("weather_code") or 0)

    concerning = (
        precipitation >= 10
        or wind_speed >= 50
        or weather_code in {65, 67, 75, 82, 95, 96, 99}
    )

    explanation = (
        "Weather conditions require human review."
        if concerning
        else "Prototype thresholds not triggered. Continue monitoring."
    )

    assessment_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO weather_assessments (
                assessment_id, incident_id, temperature,
                precipitation, wind_speed, weather_code,
                reassessment_recommended, explanation, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                assessment_id,
                request.incident_id,
                weather.get("temperature_2m"),
                precipitation,
                wind_speed,
                weather_code,
                int(concerning),
                explanation,
                created_at,
            ),
        )

        if concerning:
            connection.execute(
                """
                UPDATE incidents
                SET status = ?
                WHERE incident_id = ?
                """,
                ("Needs Reassessment", request.incident_id),
            )


    return {
        "assessment_id": assessment_id,
        "incident_id": request.incident_id,
        "weather": weather,
        "reassessment_recommended": concerning,
        "explanation": explanation,
        "human_review_required": True,
        "created_at": created_at,
    }


@app.get("/weather/assessments")
def list_weather_assessments():
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT * FROM weather_assessments
            ORDER BY created_at DESC
            """
        ).fetchall()

    return {
        "count": len(rows),
        "assessments": [dict(row) for row in rows],
    }

class WeatherSimulationRequest(BaseModel):
    incident_id: str
    precipitation: float = Field(ge=0)
    wind_speed: float = Field(ge=0)
    weather_code: int = Field(ge=0)


@app.post("/weather/assessments/simulate")
def simulate_worsening_weather(request: WeatherSimulationRequest):
    with get_connection() as connection:
        incident = connection.execute(
            "SELECT * FROM incidents WHERE incident_id = ?",
            (request.incident_id,)
        ).fetchone()

        if incident is None:
            raise HTTPException(
                status_code=404,
                detail="Incident not found"
            )

        concerning = (
            request.precipitation >= 10
            or request.wind_speed >= 50
            or request.weather_code in {65, 67, 75, 82, 95, 96, 99}
        )

        if concerning:
            connection.execute(
                """
                UPDATE incidents
                SET status = ?
                WHERE incident_id = ?
                """,
                ("Needs Reassessment", request.incident_id),
            )

    return {
        "test_mode": True,
        "incident_id": request.incident_id,
        "simulated_weather": {
            "precipitation": request.precipitation,
            "wind_speed": request.wind_speed,
            "weather_code": request.weather_code,
        },
        "reassessment_recommended": concerning,
        "incident_status": (
            "Needs Reassessment" if concerning
            else "Unchanged"
        ),
        "human_review_required": True,
        "message": (
            "Worsening weather detected. Incident flagged "
            "for human reassessment."
            if concerning
            else "Prototype thresholds not triggered."
        ),
        "note": "Simulation only; values are not live weather observations."
    }

class ShortageCheckRequest(BaseModel):
    incident_id: str
    required_resources: dict[str, int]


@app.post("/resources/check-shortage")
def check_resource_shortage(request: ShortageCheckRequest):
    if not request.required_resources:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one required resource type"
        )

    for resource_type, quantity in request.required_resources.items():
        if not resource_type.strip():
            raise HTTPException(
                status_code=400,
                detail="Resource type cannot be empty"
            )
        if quantity < 0:
            raise HTTPException(
                status_code=400,
                detail="Required quantities cannot be negative"
            )

    with get_connection() as connection:
        incident = connection.execute(
            "SELECT * FROM incidents WHERE incident_id = ?",
            (request.incident_id,)
        ).fetchone()

        if incident is None:
            raise HTTPException(
                status_code=404,
                detail="Incident not found"
            )

        shortage_results = {}
        has_shortage = False

        for resource_type, required in request.required_resources.items():
            row = connection.execute(
                """
                SELECT COUNT(*) AS available_count
                FROM resources
                WHERE LOWER(resource_type) = LOWER(?)
                  AND status = 'Available'
                """,
                (resource_type,)
            ).fetchone()

            available = row["available_count"]
            shortage = max(0, required - available)

            if shortage > 0:
                has_shortage = True

            shortage_results[resource_type] = {
                "required": required,
                "available": available,
                "shortage": shortage,
                "status": "SHORTAGE" if shortage else "SUFFICIENT"
            }

    return {
        "incident_id": request.incident_id,
        "shortage_detected": has_shortage,
        "resources": shortage_results,
        "human_review_required": True,
        "message": (
            "Resource shortage detected. Human review and replanning required."
            if has_shortage
            else "Requested resource quantities are currently available."
        )
    }

class ReplanRequest(BaseModel):
    allocation_id: str


@app.post("/allocations/replan")
def replan_allocation(request: ReplanRequest):
    with get_connection() as connection:
        allocation = connection.execute(
            """
            SELECT
                a.allocation_id,
                a.incident_id,
                a.resource_id,
                a.status AS allocation_status,
                r.resource_type,
                r.name AS resource_name,
                r.location AS resource_location,
                r.status AS resource_status
            FROM allocations a
            JOIN resources r ON a.resource_id = r.resource_id
            WHERE a.allocation_id = ?
            """,
            (request.allocation_id,)
        ).fetchone()

        if allocation is None:
            raise HTTPException(
                status_code=404,
                detail="Allocation not found"
            )

        alternatives = connection.execute(
            """
            SELECT resource_id, resource_type, name, location, status
            FROM resources
            WHERE LOWER(resource_type) = LOWER(?)
              AND status = 'Available'
              AND resource_id != ?
            ORDER BY name
            """,
            (
                allocation["resource_type"],
                allocation["resource_id"],
            )
        ).fetchall()

    resource_unavailable = (
        allocation["resource_status"] != "Available"
    )

    return {
        "allocation_id": allocation["allocation_id"],
        "incident_id": allocation["incident_id"],
        "current_resource": {
            "resource_id": allocation["resource_id"],
            "name": allocation["resource_name"],
            "resource_type": allocation["resource_type"],
            "location": allocation["resource_location"],
            "resource_status": allocation["resource_status"],
        },
        "replanning_recommended": resource_unavailable,
        "alternatives_count": len(alternatives),
        "alternatives": [dict(row) for row in alternatives],
        "human_approval_required": True,
        "message": (
            "Current resource is not Available. Review alternatives "
            "and approve any replacement manually."
            if resource_unavailable
            else "Current resource is marked Available. No replacement "
            "is recommended by this check."
        ),
    }

class ApprovalRequestCreate(BaseModel):
    incident_id: str
    allocation_id: Optional[str] = None
    action_type: str = Field(min_length=2, max_length=100)
    proposed_action: str = Field(min_length=5, max_length=1000)


class ApprovalReview(BaseModel):
    decision: Literal["Approved", "Rejected", "Modified"]
    reviewer: str = Field(min_length=2, max_length=100)
    comments: str = Field(min_length=2, max_length=1000)


@app.post("/approvals", status_code=201)
def create_approval_request(request: ApprovalRequestCreate):
    request_id = str(uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        incident = connection.execute(
            "SELECT incident_id FROM incidents WHERE incident_id = ?",
            (request.incident_id,),
        ).fetchone()

        if incident is None:
            raise HTTPException(
                status_code=404,
                detail="Incident not found",
            )

        if request.allocation_id is not None:
            allocation = connection.execute(
                """
                SELECT allocation_id
                FROM allocations
                WHERE allocation_id = ? AND incident_id = ?
                """,
                (request.allocation_id, request.incident_id),
            ).fetchone()

            if allocation is None:
                raise HTTPException(
                    status_code=404,
                    detail="Allocation not found for this incident",
                )

        connection.execute(
            """
            INSERT INTO approval_requests (
                request_id, incident_id, allocation_id,
                action_type, proposed_action, status, created_at
            )
            VALUES (?, ?, ?, ?, ?, 'Pending', ?)
            """,
            (
                request_id,
                request.incident_id,
                request.allocation_id,
                request.action_type,
                request.proposed_action,
                created_at,
            ),
        )

    return {
        "message": "Approval request created; human review required",
        "request_id": request_id,
        "status": "Pending",
        "created_at": created_at,
    }


@app.get("/approvals")
def list_approval_requests():
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT * FROM approval_requests
            ORDER BY created_at DESC
            """
        ).fetchall()

    return {
        "count": len(rows),
        "approvals": [dict(row) for row in rows],
    }


@app.patch("/approvals/{request_id}")
def review_approval_request(
    request_id: str,
    review: ApprovalReview,
):
    reviewed_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")

        existing = connection.execute(
            """
            SELECT status FROM approval_requests
            WHERE request_id = ?
            """,
            (request_id,),
        ).fetchone()

        if existing is None:
            raise HTTPException(
                status_code=404,
                detail="Approval request not found",
            )

        if existing["status"] != "Pending":
            raise HTTPException(
                status_code=409,
                detail="This approval request has already been reviewed",
            )

        connection.execute(
            """
            UPDATE approval_requests
            SET status = ?, reviewer = ?, comments = ?, reviewed_at = ?
            WHERE request_id = ? AND status = 'Pending'
            """,
            (
                review.decision,
                review.reviewer,
                review.comments,
                reviewed_at,
                request_id,
            ),
        )

    return {
        "message": "Approval request reviewed",
        "request_id": request_id,
        "status": review.decision,
        "reviewer": review.reviewer,
        "comments": review.comments,
        "reviewed_at": reviewed_at,
    }

class ResponseActionCreate(BaseModel):
    incident_id: str
    allocation_id: Optional[str] = None
    title: str = Field(min_length=3, max_length=150)
    description: str = Field(min_length=5, max_length=1000)
    priority: Literal["Low", "Medium", "High", "Critical"]
    assigned_resource_id: Optional[str] = None


class ResponseActionUpdate(BaseModel):
    status: Literal[
        "Open", "In Progress", "Blocked", "Completed", "Cancelled"
    ]
    remarks: str = Field(min_length=2, max_length=1000)


@app.post("/actions", status_code=201)
def create_response_action(action: ResponseActionCreate):
    action_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        incident = connection.execute(
            "SELECT incident_id FROM incidents WHERE incident_id = ?",
            (action.incident_id,),
        ).fetchone()

        if incident is None:
            raise HTTPException(status_code=404, detail="Incident not found")

        if action.allocation_id:
            allocation = connection.execute(
                """
                SELECT allocation_id, resource_id
                FROM allocations
                WHERE allocation_id = ? AND incident_id = ?
                """,
                (action.allocation_id, action.incident_id),
            ).fetchone()

            if allocation is None:
                raise HTTPException(
                    status_code=404,
                    detail="Allocation not found for this incident",
                )

        if action.assigned_resource_id:
            resource = connection.execute(
                "SELECT resource_id FROM resources WHERE resource_id = ?",
                (action.assigned_resource_id,),
            ).fetchone()

            if resource is None:
                raise HTTPException(status_code=404, detail="Resource not found")

        connection.execute(
            """
            INSERT INTO response_actions (
                action_id, incident_id, allocation_id, title, description,
                priority, status, assigned_resource_id, remarks,
                created_at, updated_at, completed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 'Open', ?, '', ?, ?, NULL)
            """,
            (
                action_id,
                action.incident_id,
                action.allocation_id,
                action.title,
                action.description,
                action.priority,
                action.assigned_resource_id,
                now,
                now,
            ),
        )

        saved = connection.execute(
            "SELECT * FROM response_actions WHERE action_id = ?",
            (action_id,),
        ).fetchone()

    return {
        "message": "Response action created",
        "action": dict(saved),
    }


@app.get("/actions")
def list_response_actions():
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM response_actions ORDER BY created_at DESC"
        ).fetchall()

    return {
        "count": len(rows),
        "actions": [dict(row) for row in rows],
    }


@app.patch("/actions/{action_id}")
def update_response_action(
    action_id: str,
    update: ResponseActionUpdate,
):
    now = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")

        existing = connection.execute(
            "SELECT * FROM response_actions WHERE action_id = ?",
            (action_id,),
        ).fetchone()

        if existing is None:
            raise HTTPException(status_code=404, detail="Action not found")

        current_status = existing["status"]
        new_status = update.status

        allowed_transitions = {
            "Open": ["In Progress", "Blocked", "Completed", "Cancelled"],
            "In Progress": ["Blocked", "Completed", "Cancelled"],
            "Blocked": ["Open", "In Progress", "Cancelled"],
            "Completed": [],
            "Cancelled": [],
        }

        if new_status != current_status and new_status not in allowed_transitions[current_status]:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot change action status from {current_status} to {new_status}",
            )

        completed_at = existing["completed_at"]
        if new_status == "Completed":
            completed_at = now

        connection.execute(
            """
            UPDATE response_actions
            SET status = ?, remarks = ?, updated_at = ?, completed_at = ?
            WHERE action_id = ?
            """,
            (new_status, update.remarks, now, completed_at, action_id),
        )

        saved = connection.execute(
            "SELECT * FROM response_actions WHERE action_id = ?",
            (action_id,),
        ).fetchone()

    return {
        "message": "Response action updated",
        "action": dict(saved),
    }

@app.get("/dashboard")
def get_situation_dashboard():
    with get_connection() as connection:
        incident_summary = connection.execute(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN severity_level = 'Critical' THEN 1 ELSE 0 END)
                    AS critical,
                SUM(CASE WHEN severity_level = 'High' THEN 1 ELSE 0 END)
                    AS high,
                SUM(CASE WHEN possible_duplicate = 1 THEN 1 ELSE 0 END)
                    AS possible_duplicates,
                SUM(CASE WHEN status = 'Needs Reassessment' THEN 1 ELSE 0 END)
                    AS needs_reassessment
            FROM incidents
            """
        ).fetchone()

        resource_rows = connection.execute(
            """
            SELECT status, COUNT(*) AS count
            FROM resources
            GROUP BY status
            """
        ).fetchall()

        shelter_summary = connection.execute(
            """
            SELECT
                COUNT(*) AS total_shelters,
                COALESCE(SUM(total_capacity), 0) AS total_capacity,
                COALESCE(SUM(occupied), 0) AS total_occupied,
                SUM(
                    CASE
                        WHEN occupied >= total_capacity THEN 1
                        ELSE 0
                    END
                ) AS full_shelters,
                SUM(
                    CASE
                        WHEN occupied * 1.0 / total_capacity >= 0.9
                             AND occupied < total_capacity
                        THEN 1
                        ELSE 0
                    END
                ) AS near_full_shelters
            FROM shelters
            """
        ).fetchone()

        pending_approvals = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM approval_requests
            WHERE status = 'Pending'
            """
        ).fetchone()["count"]

        action_rows = connection.execute(
            """
            SELECT status, COUNT(*) AS count
            FROM response_actions
            GROUP BY status
            """
        ).fetchall()

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "incidents": {
            "total": incident_summary["total"] or 0,
            "critical": incident_summary["critical"] or 0,
            "high": incident_summary["high"] or 0,
            "possible_duplicates": incident_summary["possible_duplicates"] or 0,
            "needs_reassessment": incident_summary["needs_reassessment"] or 0,
        },
        "resources_by_status": {
            row["status"]: row["count"] for row in resource_rows
        },
        "shelters": {
            "total": shelter_summary["total_shelters"] or 0,
            "total_capacity": shelter_summary["total_capacity"] or 0,
            "total_occupied": shelter_summary["total_occupied"] or 0,
            "available_capacity": (
                (shelter_summary["total_capacity"] or 0)
                - (shelter_summary["total_occupied"] or 0)
            ),
            "full": shelter_summary["full_shelters"] or 0,
            "near_full": shelter_summary["near_full_shelters"] or 0,
        },
        "pending_approvals": pending_approvals,
        "actions_by_status": {
            row["status"]: row["count"] for row in action_rows
        },
        "note": "Summary of stored prototype data; not a verified live emergency picture."
    }
from io import BytesIO
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
)
@app.get("/reports/situation")
def download_situation_report():
    buffer = BytesIO()

    with get_connection() as connection:
        incidents = connection.execute(
            """
            SELECT incident_id, disaster_type, location,
                   severity_level, status, people_affected
            FROM incidents
            ORDER BY
                CASE severity_level
                    WHEN 'Critical' THEN 1
                    WHEN 'High' THEN 2
                    WHEN 'Medium' THEN 3
                    ELSE 4
                END
            """
        ).fetchall()

        resources = connection.execute(
            """
            SELECT resource_id, resource_type, name, status, capacity
            FROM resources
            ORDER BY resource_type, name
            """
        ).fetchall()

        shelters = connection.execute(
            """
            SELECT name, location, total_capacity, occupied, status
            FROM shelters
            ORDER BY name
            """
        ).fetchall()

        approvals = connection.execute(
            """
            SELECT request_id, action_type, status, reviewer, created_at
            FROM approval_requests
            ORDER BY created_at DESC
            """
        ).fetchall()

        actions = connection.execute(
            """
            SELECT title, priority, status, assigned_resource_id, updated_at
            FROM response_actions
            ORDER BY updated_at DESC
            """
        ).fetchall()

    styles = getSampleStyleSheet()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )

    story = []
    generated_at = datetime.now(timezone.utc).strftime(
        "%d %b %Y, %H:%M UTC"
    )

    story.append(Paragraph(
        "Disaster Response Situation Report", styles["Title"]
    ))
    story.append(Paragraph(
        f"Generated: {generated_at}", styles["Normal"]
    ))
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "<b>Important:</b> This report summarizes stored prototype data. "
        "It is not a verified live emergency picture. All response "
        "decisions require review."
    ))

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                'attachment; filename="disaster_situation_report.pdf"'
        },
    )
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

app.mount(
    "/frontend",
    StaticFiles(directory=FRONTEND_DIR),
    name="frontend"
)

@app.get("/")
def serve_frontend():
    return FileResponse(FRONTEND_DIR / "index.html")

