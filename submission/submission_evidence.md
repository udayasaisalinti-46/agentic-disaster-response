# ResQAI — Acceptance Test Evidence & Verification Report

This document records the exact inputs, initial state, expected outputs, actual outputs, agents involved, API calls, and pass/fail statuses for all eight mandatory evaluation test scenarios (**TC-01 through TC-08**), verified on **PostgreSQL 18.6** and **FastAPI**.

Automated verification script: `python test_all_scenarios.py`

---

## Acceptance Test Summary

| Test ID | Scenario | Agents Involved | Status | Verified Evidence |
|---|---|---|---|---|
| **TC-01** | New flood incident reported | Agent 1 (Intake), Agent 2 (Severity) | **PASS** | HTTP 201, ID generated, severity calculated (Score: 63, Level: High), factors explained |
| **TC-02** | Same incident reported by two sources | Agent 1 (Intake & Duplicate Detection) | **PASS** | HTTP 201, `possible_duplicate: true`, linked to primary incident, alert generated |
| **TC-03** | Critical incident with available resources | All 8 Agents (LangGraph StateGraph) | **PASS** | HTTP 200, 2 Rescue Boats allocated, Reviewer reports `Ready for Human Review`, `automatic_dispatch: false` |
| **TC-04** | Required resources exceed availability | Agent 5 (Resource Mgmt), Agent 6 (Planning) | **PASS** | HTTP 200, Shortage detected (req: 8, avail: 5, deficit: 3), alert logged, no phantom resources invented |
| **TC-05** | Assigned road becomes blocked | Agent 4 (Geospatial), Agent 6 & 7 (Replanning) | **PASS** | HTTP 200, Dynamic replanning triggered, 3 affected incidents flagged `Needs Reassessment`, coordinator alert logged |
| **TC-06** | Shelter approaches full capacity | Agent 5 (Resource/Shelter Mgmt), Alert Hub | **PASS** | HTTP 200, 92.5% triggers `NEAR_FULL` alert, 100% triggers `FULL` alert; available capacity updated |
| **TC-07** | Weather forecast worsens | Agent 3 (Weather Intelligence), Alert Hub | **PASS** | HTTP 200, Severe rain (22.5mm) & wind (55km/h) detected, incident updated to `Needs Reassessment` |
| **TC-08** | Double allocation prevention | Agent 5 (Resource Mgmt), Concurrency Guard | **PASS** | First request HTTP 201, second concurrent/sequential request HTTP 409 Conflict, 1 allocation record |

---

## Detailed Test Case Records

### TC-01: New Flood Incident Reported
* **Objective:** Ingest an unstructured or structured emergency incident, validate fields, extract metadata, and calculate deterministic priority.
* **Input:**
  ```json
  {
    "disaster_type": "Flood",
    "description": "Flash flooding has submerged residential streets in Zone A. Evacuation needed for families.",
    "location": "Zone A Residential Sector",
    "people_affected": 40,
    "urgency": 4,
    "source": "Citizen Report",
    "latitude": 16.5120,
    "longitude": 80.6410,
    "assistance_requested": "Immediate evacuation and rescue boats",
    "infrastructure_issue": "road_partially_flooded"
  }
  ```
* **Initial System State:** Database initialized; zero prior records for Zone A Residential Sector.
* **Expected Output:** HTTP 201 Created; unique incident ID (e.g. `INC-XXXXXX`); deterministic priority score calculated; intake validation passed.
* **Actual Output:**
  ```json
  {
    "message": "Incident registered successfully",
    "incident": {
      "incident_id": "INC-0633F8",
      "disaster_type": "Flood",
      "location": "Zone A Residential Sector",
      "people_affected": 40,
      "urgency": 4,
      "severity_score": 63,
      "severity_level": "High",
      "status": "Reported",
      "verification_status": "Verified",
      "possible_duplicate": false
    },
    "intake_assessment": {
      "validation": "Passed",
      "severity_assessment": {
        "score": 63,
        "level": "High",
        "factors": [
          "Affected population (40): +16 pts",
          "Reported urgency level (4/5): +32 pts",
          "Critical infrastructure damage reported: +10 pts",
          "Road conditions unverified: +5 pts"
        ]
      }
    }
  }
  ```
* **Agents Involved:** Emergency Incident Intake Agent, Situation Assessment & Severity Agent.
* **API Calls:** `POST /incidents`
* **Final State:** Incident persisted with High priority; zero duplicate flags.
* **Status:** **PASS**

---

### TC-02: Same Incident Reported by Two Sources (Duplicate Detection)
* **Objective:** Detect when multiple callers/sources report the same emergency in the same geographic zone and link them for review without deletion.
* **Input:**
  ```json
  {
    "disaster_type": "Flood",
    "description": "Water overflowing streets into houses in Zone A. Urgent evacuation required.",
    "location": "Zone A Residential Sector",
    "people_affected": 35,
    "urgency": 4,
    "source": "Emergency Call 911",
    "latitude": 16.5120,
    "longitude": 80.6410,
    "assistance_requested": "Evacuation boat",
    "infrastructure_issue": "road_partially_flooded"
  }
  ```
* **Initial System State:** Incident `INC-0633F8` registered at Zone A Residential Sector.
* **Expected Output:** HTTP 201; `possible_duplicate: true`; `duplicate_of: "INC-0633F8"`; duplicate alert generated for coordinator review.
* **Actual Output:**
  ```json
  {
    "message": "Potential duplicate linked for review",
    "incident": {
      "incident_id": "INC-7D5104",
      "possible_duplicate": true,
      "duplicate_of": "INC-0633F8",
      "status": "Reported"
    },
    "duplicate_detection": {
      "duplicate_detected": true,
      "linked_incident_id": "INC-0633F8",
      "reason": "Matching disaster type and location proximity with INC-0633F8"
    }
  }
  ```
* **Agents Involved:** Emergency Incident Intake Agent.
* **API Calls:** `POST /incidents`, `GET /alerts`
* **Final State:** Both reports preserved; duplicate relationship linked; coordinator alert queued.
* **Status:** **PASS**

---

### TC-03: Critical Incident with Available Resources
* **Objective:** Run the full 8-agent LangGraph workflow for a critical flood scenario and recommend available rescue boats.
* **Input:**
  ```json
  {
    "incident": {
      "incident_id": "INC-003",
      "disaster_type": "Flood",
      "location": "Zone C Village",
      "people_affected": 75,
      "urgency": 5,
      "severity_level": "Critical"
    },
    "weather": {
      "precipitation": 15.0,
      "wind_speed_10m": 42.0,
      "source": "Open-Meteo"
    },
    "latitude": 16.4910,
    "longitude": 80.6590,
    "required_resource_type": "Rescue Boat",
    "quantity": 2,
    "road_accessible": false
  }
  ```
* **Initial System State:** 5 Rescue Boats marked `Available` in baseline dataset.
* **Expected Output:** HTTP 200; LangGraph executes 8 sequential nodes; 2 boats recommended; automatic dispatch is false; human approval required; Reviewer approves plan.
* **Actual Output:**
  ```json
  {
    "workflow": "Agentic AI Disaster Response & Resource Coordination",
    "resource_plan": {
      "recommended_quantity": 2,
      "recommended_resources": [
        {"resource_id": "BOAT-001", "name": "Rescue Boat 1", "capacity": 8},
        {"resource_id": "BOAT-002", "name": "Rescue Boat 2", "capacity": 8}
      ],
      "shortage": false,
      "status": "Recommendation Only - Awaiting Commander Approval"
    },
    "review": {
      "review_status": "Ready for Human Review",
      "automatic_execution_allowed": false,
      "final_authority": "Authorized Incident Commander"
    },
    "automatic_dispatch": false,
    "human_approval_required": true
  }
  ```
* **Agents Involved:** All 8 Specialized Agents orchestrated via LangGraph StateGraph.
* **API Calls:** `POST /workflow/run`
* **Final State:** Feasible tactical plan produced awaiting human commander signature.
* **Status:** **PASS**

---

### TC-04: Required Resources Exceed Availability (Shortage Detection)
* **Objective:** Detect when requested resources exceed available capacity and calculate exact deficits without hallucinating fictitious assets.
* **Input:** Required: 8 Rescue Boats for Incident `INC-003`.
* **Initial System State:** 5 Rescue Boats currently Available in fleet.
* **Expected Output:** Shortage detected = true; required = 8; available = 5; deficit = 3 boats; alert generated; escalation to mutual aid recommended.
* **Actual Output:**
  ```json
  {
    "incident_id": "INC-003",
    "shortage_detected": true,
    "resources": {
      "Rescue Boat": {
        "required": 8,
        "available": 5,
        "deficit": 3,
        "status": "SHORTAGE"
      }
    },
    "recommendation": "Resource deficit identified. Do not dispatch unverified alternatives; request regional mutual aid."
  }
  ```
* **Agents Involved:** Emergency Resource Management Agent, Real-Time Alert Hub.
* **API Calls:** `POST /resources/check-shortage`
* **Final State:** Deficit of 3 boats logged; system alert `RESOURCE_SHORTAGE` dispatched to dashboard.
* **Status:** **PASS**

---

### TC-05: Assigned Road Becomes Blocked (Dynamic Replanning)
* **Objective:** Detect road status change (e.g. Road to Zone A blocked), identify affected deployments, and trigger automated replanning.
* **Input:**
  ```json
  {
    "status": "Closed",
    "closure_type": "Known Road Closure",
    "reason": "Sudden breach in flood canal embankment. Main route submerged."
  }
  ```
* **Initial System State:** Road `ROAD-ZONE-A` is Open with active deployment for `INC-001`.
* **Expected Output:** Dynamic replanning triggered; affected deployments identified; incident status updated to `Needs Reassessment`; alert logged.
* **Actual Output:**
  ```json
  {
    "road_id": "ROAD-ZONE-A",
    "current_status": "Closed",
    "closure_type": "Known Road Closure",
    "dynamic_replanning_triggered": true,
    "affected_incidents_count": 3,
    "affected_incidents": ["INC-001", "INC-0633F8", "INC-7D5104"],
    "coordinator_action_required": true,
    "recommendation": "Transit route compromised. Re-evaluate vehicle allocations; recommend boat/air extraction or safe perimeter staging."
  }
  ```
* **Agents Involved:** Geospatial & Accessibility Agent, Resource Allocation & Response Planning Agent.
* **API Calls:** `PATCH /roads/ROAD-ZONE-A/status`, `GET /incidents`
* **Final State:** Transit route marked Closed; deployments flagged for commander review.
* **Status:** **PASS**

---

### TC-06: Shelter Approaches Full Capacity (Saturation Alert)
* **Objective:** Monitor shelter capacity and generate progressive alerts when occupancy reaches >= 90% (NEAR_FULL) and 100% (FULL).
* **Input:**
  1. Shelter A occupancy updated to 185 / 200 (92.5%).
  2. Shelter A occupancy updated to 200 / 200 (100.0%).
* **Initial System State:** Shelter A total capacity 200, occupancy 160.
* **Expected Output:** First update flags `NEAR_FULL` alert; second update flags `FULL` alert; available capacity accurately computed.
* **Actual Output:**
  * Update 1 (185/200):
    ```json
    {
      "shelter_id": "SHELTER-A",
      "occupied": 185,
      "available_capacity": 15,
      "occupancy_percentage": 92.5,
      "alert": "NEAR_FULL"
    }
    ```
  * Update 2 (200/200):
    ```json
    {
      "shelter_id": "SHELTER-A",
      "occupied": 200,
      "available_capacity": 0,
      "occupancy_percentage": 100.0,
      "alert": "FULL",
      "message": "Shelter is FULL. Redirect evacuees immediately."
    }
    ```
* **Agents Involved:** Emergency Resource Management Agent, Real-Time Alert Hub.
* **API Calls:** `PATCH /shelters/SHELTER-A/occupancy`, `GET /alerts`
* **Final State:** `SHELTER_NEAR_FULL` and `SHELTER_FULL` recorded in active alerts table.
* **Status:** **PASS**

---

### TC-07: Weather Forecast Worsens (Environmental Reassessment)
* **Objective:** Ingest telemetry indicating severe weather worsening and automatically flag affected incidents for human reassessment.
* **Input:**
  ```json
  {
    "incident_id": "INC-002",
    "precipitation": 22.5,
    "wind_speed": 55.0,
    "weather_code": 65
  }
  ```
* **Initial System State:** Incident `INC-002` in status `Reported`.
* **Expected Output:** Severe weather detected; incident status updated to `Needs Reassessment`; alert dispatched.
* **Actual Output:**
  ```json
  {
    "incident_id": "INC-002",
    "severe_weather_detected": true,
    "reassessment_recommended": true,
    "incident_status": "Needs Reassessment",
    "message": "Worsening weather detected. Incident reassessment and coordinator review triggered."
  }
  ```
* **Agents Involved:** Weather & Environmental Intelligence Agent, Real-Time Alert Hub.
* **API Calls:** `POST /weather/assessments/simulate`, `GET /incidents/INC-002`
* **Final State:** Incident `INC-002` status transitioned to `Needs Reassessment`.
* **Status:** **PASS**

---

### TC-08: Double Allocation Prevention (Concurrency Guard)
* **Objective:** Ensure two concurrent or sequential requests attempting to allocate the same emergency resource are serialized, preventing double assignment.
* **Input:** Two identical allocation requests for `BOAT-001` to two different incidents (`INC-001` and `INC-002`).
* **Initial System State:** Resource `BOAT-001` marked `Available`.
* **Expected Output:** Request 1 succeeds (HTTP 201, status `Reserved`). Request 2 fails with HTTP 409 Conflict. Exactly one allocation record in database.
* **Actual Output:**
  * Request 1: HTTP 201 Created — `{"status": "Reserved", "allocation_id": "ALC-XXXX"}`
  * Request 2: HTTP 409 Conflict — `{"detail": "Resource BOAT-001 is not available (current status: Reserved)."}`
  * Database Check: Exactly 1 active allocation record; resource status `Reserved`.
* **Agents Involved:** Emergency Resource Management Agent, PostgreSQL row locking (`FOR UPDATE`).
* **API Calls:** `POST /allocations`, concurrency scripts (`test_concurrency.py`, `test_all_scenarios.py`)
* **Final State:** Single valid reservation; second attempt safely blocked.
* **Status:** **PASS**

---

## Safety and Limitations
1. **Advisory Decision Support:** ResQAI is an academic/operational decision-support system. It does not replace emergency management authorities or dispatch physical personnel autonomously.
2. **Mandatory Human-in-the-Loop:** All tactical resource dispatches, road closures, and shelter redirections require commander sign-off (`automatic_dispatch: false`).
3. **Verified Road Access:** Route candidates generated via OSRM do not guarantee unmapped water clearance. Field verification is required.
