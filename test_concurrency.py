import json
import threading
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from uuid import uuid4

from backend.database import get_connection
from backend.main import app
from starlette.testclient import TestClient

BASE_URL = "http://127.0.0.1:8000"

token = uuid4().hex
incident_id = f"ctest-incident-{token}"
resource_id = f"ctest-resource-{token}"
created_at = datetime.now(timezone.utc).isoformat()


def is_server_running():
    try:
        with urllib.request.urlopen(f"{BASE_URL}/health", timeout=1) as resp:
            return resp.status == 200
    except Exception:
        return False


def send_allocation_urllib(barrier):
    payload = json.dumps({
        "incident_id": incident_id,
        "resource_id": resource_id,
    }).encode("utf-8")

    request = urllib.request.Request(
        f"{BASE_URL}/allocations",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        barrier.wait(timeout=10)
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()
    except Exception as error:
        return "ERROR", str(error)


def send_allocation_testclient(client, barrier):
    barrier.wait(timeout=10)
    resp = client.post("/allocations", json={"incident_id": incident_id, "resource_id": resource_id})
    return resp.status_code, resp.text


def main():
    print("Creating temporary test records...")

    with get_connection() as connection:
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
                incident_id, "Test", "Temporary concurrency test",
                "Test Location", 1, 1, "Automated Test", 10,
                "Low", "Reported", "Unverified", 0, None, created_at,
            ),
        )

        connection.execute(
            """
            INSERT INTO resources (
                resource_id, resource_type, name, location,
                capacity, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                resource_id, "Ambulance", "Temporary Concurrency Test",
                "Test Location", 1, "Available", created_at,
            ),
        )
        connection.commit()

    print("Sending two simultaneous allocation requests...")
    barrier = threading.Barrier(2)

    server_active = is_server_running()
    if server_active:
        print(f"Connecting to live server at {BASE_URL}...")
        worker_fn = lambda: send_allocation_urllib(barrier)
    else:
        print("Live uvicorn server not detected on port 8000; executing via serialized TestClient...")
        client = TestClient(app)
        worker_fn = lambda: send_allocation_testclient(client, barrier)

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(worker_fn),
                executor.submit(worker_fn),
            ]
            results = [future.result() for future in futures]

        for index, (status, body) in enumerate(results, start=1):
            print(f"\nRequest {index}: HTTP {status}")
            print(body)

        with get_connection() as connection:
            resource = connection.execute(
                "SELECT status FROM resources WHERE resource_id = ?",
                (resource_id,),
            ).fetchone()

            allocations = connection.execute(
                """
                SELECT allocation_id, status
                FROM allocations
                WHERE incident_id = ? AND resource_id = ?
                """,
                (incident_id, resource_id),
            ).fetchall()

        print("\nFinal resource status:", resource["status"])
        print("Allocation records:", len(allocations))

        successes = sum(status == 201 for status, _ in results)
        conflicts = sum(status == 409 for status, _ in results)

        if successes == 1 and conflicts == 1 and len(allocations) == 1:
            print("PASS: only one request allocated the resource. Double allocation prevented.")
        else:
            print("CHECK: results differ from the expected 201/409 outcome.")

    finally:
        print("\nCleaning up temporary test records...")
        with get_connection() as connection:
            connection.execute(
                """
                DELETE FROM approval_requests
                WHERE incident_id = ?
                """,
                (incident_id,),
            )
            connection.execute(
                """
                DELETE FROM allocations
                WHERE incident_id = ? AND resource_id = ?
                """,
                (incident_id, resource_id),
            )
            connection.execute(
                "DELETE FROM resources WHERE resource_id = ?",
                (resource_id,),
            )
            connection.execute(
                "DELETE FROM incidents WHERE incident_id = ?",
                (incident_id,),
            )
            connection.commit()
        print("Cleanup completed.")


if __name__ == "__main__":
    main()
