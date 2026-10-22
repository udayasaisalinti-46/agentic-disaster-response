# ResQAI — REST API Reference Manual

The ResQAI backend provides 20+ REST endpoints adhering to standard OpenAPI / JSON conventions.

Base URL: `http://localhost:8000` (Local) / `/api` (Production reverse proxy)

---

## 1. System & Health

### `GET /health`
Returns system liveness, active database engine, and timestamp.
- **Response**: `200 OK`
```json
{
  "status": "healthy",
  "database": "sqlite_hybrid",
  "agents_online": 8
}
```

### `GET /system/config`
Retrieves operational jurisdiction, commander on duty, and safety thresholds.
- **Response**: `200 OK`
```json
{
  "jurisdiction": "Vijayawada / Krishna Basin, AP",
  "commander_on_duty": "Maj. EOC Auth-01",
  "autonomous_dispatch": false,
  "double_allocation_lock": true,
  "shelter_saturation_threshold": 0.85,
  "weather_reassessment_auto": true,
  "alert_gateway": "Twilio / Gov SIM Active",
  "db_backend": "SQLite / PostgreSQL Hybrid",
  "active_agents": 8
}
```

### `PATCH /system/config`
Updates operational parameters in real time.
- **Request Body**: Partial `SystemConfigUpdate`
- **Response**: `200 OK` with updated configuration.

---

## 2. Emergency Incidents

### `GET /incidents`
Lists all active incidents with priority scores and verification statuses.
- **Response**: `200 OK`
```json
{
  "incidents": [
    {
      "incident_id": "INC-001",
      "disaster_type": "Flood",
      "location": "Zone A Residential",
      "urgency": 4,
      "severity_score": 63,
      "status": "Under Response",
      "latitude": 16.512,
      "longitude": 80.641
    }
  ]
}
```

### `POST /incidents`
Ingests a new emergency report, executes duplicate detection, computes severity, and saves to database.
- **Request Body**:
```json
{
  "incident_id": "INC-TEST-01",
  "disaster_type": "Flood",
  "location": "Zone C Riverside Village",
  "description": "Rising water threatening 50 homes.",
  "people_affected": 50,
  "urgency": 5,
  "source": "Emergency Call 911",
  "latitude": 16.491,
  "longitude": 80.659
}
```
- **Response**: `201 Created`

### `GET /incidents/{incident_id}`
Returns granular lifecycle data, timeline history, and connected resource assignments.

---

## 3. Resource Fleet & Shelters

### `GET /resources`
Returns fleet inventory, operational capabilities, locations, and status (`Available`, `Reserved`, `Deployed`, `Returning`).

### `POST /resources/{resource_id}/reserve`
Reserves a resource with atomic concurrency locking.
- **Response**:
  - `201 Created`: Successfully reserved.
  - `409 Conflict`: Resource already reserved or deployed by another incident.

### `POST /resources/check-shortage`
Calculates equipment deficits and mutual-aid recommendations.
- **Request Body**:
```json
{
  "incident_id": "INC-003",
  "required_resources": { "Rescue Boat": 8 }
}
```
- **Response**: `200 OK` with deficit counts and alternative dispatch options.

### `GET /shelters`
Returns shelter registry, current occupancy, total capacity, and status (`Active`, `Near Full`, `Full`).

### `POST /shelters/{shelter_id}/update-occupancy`
Updates shelter occupancy count. Automatically logs alerts if $\ge 85\%$ (`NEAR_FULL`) or $= 100\%$ (`FULL`).

---

## 4. Roads & Routing

### `GET /roads`
Returns road segment network, operational status (`Open`, `Partially Blocked`, `Closed`), and reported hazards.

### `POST /roads/{road_id}/status`
Updates road segment status.

### `POST /roads/reassess-routes`
Triggers global route reassessment across active missions when road closures occur.
- **Response**: `200 OK` with list of affected incidents and alternative route corridors.

---

## 5. LangGraph 8-Agent Workflow

### `POST /workflow/run`
Executes end-to-end multi-agent orchestration for a specific incident.
- **Response**: `200 OK` containing all 8 agent outputs, critic review certification, and mandatory `human_approval_required: true`.

---

## 6. Approvals & Actions

### `GET /approvals`
Lists pending and historical commander authorization requests.

### `POST /approvals/{request_id}/decide`
Commander approval decision (`Approved`, `Rejected`, `Modified`).

### `GET /actions`
Returns chronological audit log of physical response actions.

---

## 7. Weather & Alerts

### `GET /weather/telemetry`
Retrieves live meteorological conditions from Open-Meteo.

### `POST /weather/assessments/simulate`
Simulates adverse weather squall, triggering auto-reassessment of active incidents.

### `GET /alerts`
Lists real-time operational notifications and warning broadcasts.

### `POST /alerts/{alert_id}/acknowledge`
Marks an alert as acknowledged by the commander.

---

## 8. Reports & Testing

### `GET /reports/situation`
Generates and downloads a publication-grade PDF Situation Report with incident tables and commander sign-off blocks.

### `GET /tests/run-all`
Runs the complete automated test suite (TC-01 through TC-08) and returns JSON test pass/fail metrics.
