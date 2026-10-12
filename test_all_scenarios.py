"""
ResQAI — Comprehensive Automated Test Suite
Validates all eight required test scenarios (TC-01 through TC-08)
against the FastAPI backend and database.
"""

import sys
import json
from starlette.testclient import TestClient
from backend.main import app
from backend.database import get_connection, seed_demo_dataset

client = TestClient(app)

def reset_test_data():
    with get_connection() as conn:
        seed_demo_dataset(conn)

def run_tests():
    print("=" * 80)
    print("RESQAI: EXECUTING VERIFICATION TEST SUITE (TC-01 THROUGH TC-08)")
    print("=" * 80)
    reset_test_data()

    results = {}

    # --------------------------------------------------------------------------
    # TC-01: New Flood Incident Reported -> Incident Created and Assessed
    # --------------------------------------------------------------------------
    print("\n[TC-01] Testing New Flood Incident Intake & Assessment...")
    payload_tc01 = {
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
    resp01 = client.post("/incidents", json=payload_tc01)
    data01 = resp01.json()

    pass_tc01 = (
        resp01.status_code == 201
        and data01["incident"]["severity_level"] in ("High", "Critical")
        and data01["intake_assessment"]["validation"] == "Passed"
        and data01["incident"]["people_affected"] == 40
    )
    results["TC-01"] = {
        "scenario": "New flood incident reported",
        "status": "PASS" if pass_tc01 else "FAIL",
        "incident_id": data01["incident"]["incident_id"],
        "severity": data01["incident"]["severity_level"],
        "score": data01["incident"]["severity_score"],
    }
    print(f"  Result: {'PASS' if pass_tc01 else 'FAIL'} (HTTP {resp01.status_code}, Severity: {data01['incident']['severity_level']}, Score: {data01['incident']['severity_score']})")

    # --------------------------------------------------------------------------
    # TC-02: Same Incident Reported by Two Sources -> Potential Duplicate Identified
    # --------------------------------------------------------------------------
    print("\n[TC-02] Testing Multi-Source Duplicate Detection...")
    payload_tc02 = {
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
    resp02 = client.post("/incidents", json=payload_tc02)
    data02 = resp02.json()

    pass_tc02 = (
        resp02.status_code == 201
        and data02["incident"]["possible_duplicate"] is True
        and data02["duplicate_detection"]["duplicate_detected"] is True
        and data02["incident"]["duplicate_of"] is not None
    )
    results["TC-02"] = {
        "scenario": "Same incident reported by two sources",
        "status": "PASS" if pass_tc02 else "FAIL",
        "duplicate_detected": data02["duplicate_detection"]["duplicate_detected"],
        "linked_to": data02["incident"]["duplicate_of"],
        "reason": data02["duplicate_detection"]["reason"]
    }
    print(f"  Result: {'PASS' if pass_tc02 else 'FAIL'} (Duplicate Detected: {data02['duplicate_detection']['duplicate_detected']}, Linked ID: {data02['incident']['duplicate_of']})")

    # --------------------------------------------------------------------------
    # TC-03: Critical Incident with Available Resources -> Allocation Recommendation Generated
    # --------------------------------------------------------------------------
    print("\n[TC-03] Testing 8-Agent LangGraph Workflow Resource Allocation...")
    resources_list = client.get("/resources").json()["resources"]
    payload_tc03 = {
        "incident": {
            "incident_id": "INC-003",
            "disaster_type": "Flood",
            "location": "Zone C Village",
            "people_affected": 75,
            "urgency": 5,
            "severity_level": "Critical",
            "infrastructure_issue": "road_closed"
        },
        "weather": {
            "temperature_2m": 25.0,
            "precipitation": 15.0,
            "rain": 15.0,
            "wind_speed_10m": 42.0,
            "source": "Open-Meteo"
        },
        "latitude": 16.4910,
        "longitude": 80.6590,
        "resources": resources_list,
        "required_resource_type": "Rescue Boat",
        "quantity": 2,
        "road_accessible": False
    }
    resp03 = client.post("/workflow/run", json=payload_tc03)
    data03 = resp03.json()

    pass_tc03 = (
        resp03.status_code == 200
        and data03["resource_plan"]["recommended_quantity"] == 2
        and data03["automatic_dispatch"] is False
        and data03["human_approval_required"] is True
        and data03["review"]["review_status"] == "Ready for Human Review"
    )
    results["TC-03"] = {
        "scenario": "Critical incident resource recommendation via LangGraph",
        "status": "PASS" if pass_tc03 else "FAIL",
        "recommended_units": data03["resource_plan"]["recommended_quantity"],
        "human_approval_required": data03["human_approval_required"],
        "review_status": data03["review"]["review_status"]
    }
    print(f"  Result: {'PASS' if pass_tc03 else 'FAIL'} (Recommended: {data03['resource_plan']['recommended_quantity']} boats, Review: {data03['review']['review_status']}, Dispatch: {data03['automatic_dispatch']})")

    # --------------------------------------------------------------------------
    # TC-04: Required Resources Exceed Availability -> Resource Shortage Identified
    # --------------------------------------------------------------------------
    print("\n[TC-04] Testing Resource Shortage Detection & Deficit Calculation...")
    payload_tc04 = {
        "incident_id": "INC-003",
        "required_resources": {
            "Rescue Boat": 8  # 5 available in baseline
        }
    }
    resp04 = client.post("/resources/check-shortage", json=payload_tc04)
    data04 = resp04.json()
    boat_check = data04["resources"].get("Rescue Boat", {})

    pass_tc04 = (
        resp04.status_code == 200
        and data04["shortage_detected"] is True
        and boat_check.get("required") == 8
        and boat_check.get("available") == 5
        and boat_check.get("deficit") == 3
    )
    results["TC-04"] = {
        "scenario": "Resource shortage detection",
        "status": "PASS" if pass_tc04 else "FAIL",
        "shortage_detected": data04["shortage_detected"],
        "required": boat_check.get("required"),
        "available": boat_check.get("available"),
        "deficit": boat_check.get("deficit")
    }
    print(f"  Result: {'PASS' if pass_tc04 else 'FAIL'} (Shortage Detected: {data04['shortage_detected']}, Required: 8, Available: 5, Deficit: {boat_check.get('deficit')})")

    # --------------------------------------------------------------------------
    # TC-05: Assigned Road Becomes Blocked -> Dynamic Replanning Triggered
    # --------------------------------------------------------------------------
    print("\n[TC-05] Testing Dynamic Replanning upon Road Blockage...")
    # First allocate an ambulance to Zone A
    res_amb = [r for r in resources_list if r["resource_type"] == "Ambulance" and r["status"] == "Available"][0]
    client.post("/allocations", json={"incident_id": "INC-001", "resource_id": res_amb["resource_id"]})

    # Now simulate road blockage on Road to Zone A
    payload_tc05 = {
        "status": "Closed",
        "closure_type": "Known Road Closure",
        "reason": "Sudden breach in flood canal embankment. Main route submerged."
    }
    resp05 = client.patch("/roads/ROAD-ZONE-A/status", json=payload_tc05)
    data05 = resp05.json()

    pass_tc05 = (
        resp05.status_code == 200
        and data05["dynamic_replanning_triggered"] is True
        and data05["current_status"] == "Closed"
        and data05["coordinator_action_required"] is True
        and "INC-001" in data05["affected_incidents"]
    )
    results["TC-05"] = {
        "scenario": "Dynamic replanning on road blockage",
        "status": "PASS" if pass_tc05 else "FAIL",
        "replanning_triggered": data05["dynamic_replanning_triggered"],
        "affected_incidents": data05["affected_incidents"],
        "affected_deployments_count": len(data05["affected_deployments"])
    }
    print(f"  Result: {'PASS' if pass_tc05 else 'FAIL'} (Replanning Triggered: {data05['dynamic_replanning_triggered']}, Affected Incidents: {data05['affected_incidents']})")

    # --------------------------------------------------------------------------
    # TC-06: Shelter Approaches Full Capacity -> Capacity Alert Generated
    # --------------------------------------------------------------------------
    print("\n[TC-06] Testing Shelter Capacity Saturation Alerts...")
    # Shelter A total capacity is 200. Setting occupied to 185 (92.5%) -> NEAR_FULL
    resp06_near = client.patch("/shelters/SHELTER-A/occupancy", json={"occupied": 185})
    data06_near = resp06_near.json()

    # Setting occupied to 200 (100%) -> FULL
    resp06_full = client.patch("/shelters/SHELTER-A/occupancy", json={"occupied": 200})
    data06_full = resp06_full.json()

    alerts_list = client.get("/alerts").json()["alerts"]
    has_shelter_alert = any(a["alert_type"] in ("SHELTER_NEAR_FULL", "SHELTER_FULL") for a in alerts_list)

    pass_tc06 = (
        resp06_near.status_code == 200
        and data06_near["alert"] == "NEAR_FULL"
        and resp06_full.status_code == 200
        and data06_full["alert"] == "FULL"
        and has_shelter_alert
    )
    results["TC-06"] = {
        "scenario": "Shelter approaches capacity & triggers alerts",
        "status": "PASS" if pass_tc06 else "FAIL",
        "near_full_alert": data06_near["alert"],
        "full_alert": data06_full["alert"],
        "alert_recorded": has_shelter_alert
    }
    print(f"  Result: {'PASS' if pass_tc06 else 'FAIL'} (185/200: {data06_near['alert']}, 200/200: {data06_full['alert']}, Alert Logged: {has_shelter_alert})")

    # --------------------------------------------------------------------------
    # TC-07: Weather Forecast Worsens -> Relevant Incidents Reassessed
    # --------------------------------------------------------------------------
    print("\n[TC-07] Testing Severe Weather Reassessment & Alerting...")
    payload_tc07 = {
        "incident_id": "INC-002",
        "precipitation": 22.5,
        "wind_speed": 55.0,
        "weather_code": 65
    }
    resp07 = client.post("/weather/assessments/simulate", json=payload_tc07)
    data07 = resp07.json()

    # Verify incident status was updated to Needs Reassessment
    inc_after = client.get("/incidents/INC-002").json()

    pass_tc07 = (
        resp07.status_code == 200
        and data07["severe_weather_detected"] is True
        and data07["reassessment_recommended"] is True
        and inc_after["status"] == "Needs Reassessment"
    )
    results["TC-07"] = {
        "scenario": "Worsening weather incident reassessment",
        "status": "PASS" if pass_tc07 else "FAIL",
        "severe_weather_detected": data07["severe_weather_detected"],
        "incident_new_status": inc_after["status"],
        "reassessment_recommended": data07["reassessment_recommended"]
    }
    print(f"  Result: {'PASS' if pass_tc07 else 'FAIL'} (Severe Weather: {data07['severe_weather_detected']}, New Status: {inc_after['status']})")

    # --------------------------------------------------------------------------
    # TC-08: Same Rescue Resource Considered for Two Incidents -> Double Allocation Prevented
    # --------------------------------------------------------------------------
    print("\n[TC-08] Testing Double Allocation Prevention & Serialized Concurrency...")
    # Reset baseline to ensure clean resource state
    reset_test_data()

    # Request 1: Allocate BOAT-001 to INC-001
    resp08_a = client.post("/allocations", json={"incident_id": "INC-001", "resource_id": "BOAT-001"})
    # Request 2: Attempt to allocate same BOAT-001 to INC-002
    resp08_b = client.post("/allocations", json={"incident_id": "INC-002", "resource_id": "BOAT-001"})

    pass_tc08 = (
        resp08_a.status_code == 201
        and resp08_b.status_code == 409
    )
    results["TC-08"] = {
        "scenario": "Double allocation prevention",
        "status": "PASS" if pass_tc08 else "FAIL",
        "request_1_status": resp08_a.status_code,
        "request_2_status": resp08_b.status_code,
        "conflict_message": resp08_b.json().get("detail")
    }
    print(f"  Result: {'PASS' if pass_tc08 else 'FAIL'} (Request 1: HTTP {resp08_a.status_code}, Request 2: HTTP {resp08_b.status_code} Conflict)")

    print("\n" + "=" * 80)
    print("SUMMARY OF TEST RESULTS")
    print("=" * 80)
    all_passed = True
    for test_id, res in results.items():
        status = res["status"]
        if status != "PASS":
            all_passed = False
        print(f"  {test_id}: {res['scenario']} --> [{status}]")

    print("=" * 80)
    if all_passed:
        print("ALL 8 ACCEPTANCE TESTS (TC-01 TO TC-08) PASSED SUCCESSFULLY!")
    else:
        print("SOME TESTS FAILED! PLEASE REVIEW LOGS ABOVE.")
    print("=" * 80)

    return all_passed

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
