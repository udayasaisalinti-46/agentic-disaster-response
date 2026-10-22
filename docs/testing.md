# ResQAI — Verification Test Suite & Acceptance Scenarios

This document outlines the 8 required verification scenarios (**TC-01 through TC-08**) specified in the academic requirements, detailing the test objectives, execution commands, and verified results.

---

## 1. Test Suite Summary Matrix

| Test ID | Scenario | Agents Involved | Expected Behavior | Actual Status |
|---|---|---|---|---|
| **TC-01** | New flood incident reported | Agents 1, 2 | Clean intake, calculate severity ($0-100$), store record | **PASS (HTTP 201, Score: 63)** |
| **TC-02** | Same incident reported by two sources | Agent 1 (Deduplication) | Detect spatial & token duplicate ($\ge 0.72$), link to master ID | **PASS (Duplicate: True, Linked)** |
| **TC-03** | Critical incident resource recommendation via LangGraph | Agents 1-8 + Critic | 8-agent pipeline run, critic safety audit passed, autonomous dispatch blocked | **PASS (8/8 Agents Ran, Dispatch: False)** |
| **TC-04** | Resource shortage detection | Agent 5 (Resource Mgmt) | Detect inventory deficit (Req: 8, Avail: 5, Deficit: 3), propose mutual aid | **PASS (Shortage: True, Deficit: 3)** |
| **TC-05** | Assigned road becomes blocked | Agent 4 (Geospatial) | Trigger dynamic replanning, identify alternative corridor | **PASS (Replanning Triggered: True)** |
| **TC-06** | Shelter approaches full capacity | Agent 5 (Shelter Mgmt) | Log alerts at $\ge 85\%$ (`NEAR_FULL`) and $100\%$ (`FULL`) | **PASS (NEAR_FULL & FULL Logged)** |
| **TC-07** | Weather forecast worsens | Agents 2, 3 | Simulated squall triggers auto-reassessment (`Needs Reassessment`) | **PASS (Reassessment Triggered)** |
| **TC-08** | Double allocation prevention | Agent 5, Concurrency Lock | Reject simultaneous second allocation with **HTTP 409 Conflict** | **PASS (Req 1: 201, Req 2: 409)** |

---

## 2. Automated Test Execution

### Running All Acceptance Tests via CLI
```bash
# Activate Python virtual environment
.\.venv\Scripts\python.exe test_all_scenarios.py
```

### Running Concurrency Double-Allocation Test
```bash
.\.venv\Scripts\python.exe test_concurrency.py
```

### Running Via Browser / API
- Open the web application and navigate to the **Acceptance Tests** tab (`#tests`).
- Click **"Run Acceptance Suite"** to execute all 8 test cases against the live backend API.
- Direct API endpoint:
  ```bash
  curl http://localhost:8000/tests/run-all
  ```

---

## 3. Detailed Acceptance Scenario Specifications

### TC-01: New Flood Incident Intake & Assessment
- **Input**: Incident in Zone A Residential Sector, 40 affected, urgency 4.
- **Verification**: Database record created with `status: "New"`, `severity_score >= 50` ("High").

### TC-02: Multi-Source Duplicate Detection
- **Input**: Incident in Zone A Residential Sector from 911 call after citizen report already recorded at identical location.
- **Verification**: `duplicate_detected: true`, links to master incident ID, prevents phantom double deployments.

### TC-03: LangGraph 8-Agent StateGraph Workflow
- **Input**: Critical flood scenario requiring 2 rescue boats and road navigation.
- **Verification**:
  - Full StateGraph executes sequentially through all 8 nodes.
  - Reviewer/Critic verifies plan sanity and enforces constitutional safety policy: `autonomous_dispatch = False` and `human_approval_required = True`.

### TC-04: Resource Shortage Detection
- **Input**: Requirement for 8 rescue boats when only 5 are in `Available` status.
- **Verification**: Deficit of 3 units reported, mutual-aid alert triggered.

### TC-05: Dynamic Replanning upon Road Obstruction
- **Input**: Primary arterial road `RD-001` marked as `Closed` due to flash flood debris.
- **Verification**: System automatically evaluates all missions utilizing `RD-001` and recalculates travel routes.

### TC-06: Shelter Capacity Saturation
- **Input**: Shelter occupancy updated to 185/200 (92.5%) and 200/200 (100%).
- **Verification**: System issues `NEAR_FULL` alert at 185 and `FULL` alert at 200, recommending traffic redirection to secondary facilities.

### TC-07: Worsening Meteorological Conditions
- **Input**: Simulated severe weather event (wind 65 km/h, precipitation 28 mm/h).
- **Verification**: Active incident status automatically transitions to `Needs Reassessment`.

### TC-08: Double Allocation Concurrency Lock
- **Input**: Two simultaneous requests attempting to reserve the exact same rescue asset for different missions.
- **Verification**: The first transaction successfully reserves the unit (`HTTP 201`); the second is rejected with `HTTP 409 Conflict`.
