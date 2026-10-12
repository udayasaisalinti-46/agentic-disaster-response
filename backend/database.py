import os
import sqlite3
from pathlib import Path
from urllib.parse import urlparse

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

# Load environment variables from the project-root .env file.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")
SQLITE_PATH = PROJECT_ROOT / "data" / "disaster.db"


def get_connection():
    """
    Open a database connection.
    Prioritizes PostgreSQL (via DATABASE_URL or individual DB_* variables),
    and gracefully falls back to SQLite if PostgreSQL is unavailable.
    """
    # 1. Check if SQLite is explicitly requested
    if os.getenv("USE_SQLITE", "").lower() in ("true", "1", "yes"):
        return get_sqlite_connection()

    # 2. Try PostgreSQL
    try:
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            # Handle potential 'postgres://' vs 'postgresql://' URL formatting
            if database_url.startswith("postgres://"):
                database_url = database_url.replace("postgres://", "postgresql://", 1)
            conn = psycopg.connect(database_url, row_factory=dict_row, connect_timeout=5)
            return PostgreSQLConnection(conn)
        else:
            host = os.getenv("DB_HOST", "127.0.0.1")
            port = int(os.getenv("DB_PORT", "5432"))
            dbname = os.getenv("DB_NAME", "disaster_response")
            user = os.getenv("DB_USER", "postgres")
            password = os.getenv("DB_PASSWORD")

            conn = psycopg.connect(
                host=host,
                port=port,
                dbname=dbname,
                user=user,
                password=password,
                row_factory=dict_row,
                connect_timeout=5,
            )
            return PostgreSQLConnection(conn)
    except Exception as pg_err:
        # Fall back to SQLite if PostgreSQL fails
        print(f"[Database] PostgreSQL connection failed ({pg_err}). Falling back to SQLite.")
        return get_sqlite_connection()


def get_sqlite_connection():
    SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return SQLiteConnection(conn)


class PostgreSQLConnection:
    """Wrapper around psycopg connection offering unified cursor and execute methods."""

    def __init__(self, connection):
        self.connection = connection
        self.engine = "postgresql"

    def execute(self, sql, parameters=()):
        # Translate SQLite syntax if encountered
        clean_sql = sql.replace("BEGIN IMMEDIATE", "BEGIN")
        clean_sql = clean_sql.replace("?", "%s")
        return self.connection.execute(clean_sql, parameters)

    def cursor(self):
        return self.connection.cursor()

    def commit(self):
        self.connection.commit()

    def rollback(self):
        self.connection.rollback()

    def __enter__(self):
        self.connection.__enter__()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return self.connection.__exit__(exc_type, exc_value, traceback)

    def close(self):
        self.connection.close()


class SQLiteConnection:
    """Wrapper around sqlite3 connection to emulate PostgreSQL dictionary-row and placeholder behavior."""

    def __init__(self, connection):
        self.connection = connection
        self.engine = "sqlite"

    def execute(self, sql, parameters=()):
        # Translate PostgreSQL '%s' placeholders to SQLite '?'
        clean_sql = sql.replace("%s", "?")
        # Remove FOR UPDATE in SQLite
        clean_sql = clean_sql.replace("FOR UPDATE", "")
        return self.connection.execute(clean_sql, parameters)

    def cursor(self):
        return self.connection.cursor()

    def commit(self):
        self.connection.commit()

    def rollback(self):
        self.connection.rollback()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if exc_type is not None:
            self.connection.rollback()
        else:
            self.connection.commit()

    def close(self):
        self.connection.close()


def initialize_database():
    """
    Ensure all required tables and columns exist in the active database.
    Seeds synthetic baseline data matching the problem statement if tables are empty.
    """
    with get_connection() as conn:
        is_pg = conn.engine == "postgresql"

        # Table definitions
        # 1. Incidents
        conn.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                incident_id TEXT PRIMARY KEY,
                disaster_type TEXT NOT NULL,
                description TEXT NOT NULL,
                location TEXT NOT NULL,
                people_affected INTEGER NOT NULL,
                urgency INTEGER NOT NULL,
                source TEXT NOT NULL,
                severity_score INTEGER NOT NULL,
                severity_level TEXT NOT NULL,
                status TEXT NOT NULL,
                verification_status TEXT NOT NULL,
                possible_duplicate INTEGER NOT NULL DEFAULT 0,
                duplicate_of TEXT,
                latitude REAL,
                longitude REAL,
                assistance_requested TEXT,
                infrastructure_issue TEXT,
                created_at TEXT NOT NULL
            )
        """)

        # 2. Resources
        conn.execute("""
            CREATE TABLE IF NOT EXISTS resources (
                resource_id TEXT PRIMARY KEY,
                resource_type TEXT NOT NULL,
                name TEXT NOT NULL,
                location TEXT NOT NULL,
                capacity INTEGER NOT NULL,
                capability TEXT,
                status TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                created_at TEXT NOT NULL
            )
        """)

        # 3. Shelters
        conn.execute("""
            CREATE TABLE IF NOT EXISTS shelters (
                shelter_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                location TEXT NOT NULL,
                total_capacity INTEGER NOT NULL,
                occupied INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                created_at TEXT NOT NULL
            )
        """)

        # 4. Allocations
        conn.execute("""
            CREATE TABLE IF NOT EXISTS allocations (
                allocation_id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                resource_id TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

        # 5. Weather Assessments
        conn.execute("""
            CREATE TABLE IF NOT EXISTS weather_assessments (
                assessment_id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                temperature REAL,
                precipitation REAL,
                wind_speed REAL,
                weather_code INTEGER,
                reassessment_recommended INTEGER NOT NULL,
                explanation TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

        # 6. Approval Requests
        conn.execute("""
            CREATE TABLE IF NOT EXISTS approval_requests (
                request_id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                allocation_id TEXT,
                action_type TEXT NOT NULL,
                proposed_action TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending',
                reviewer TEXT,
                comments TEXT,
                created_at TEXT NOT NULL,
                reviewed_at TEXT
            )
        """)

        # 7. Response Actions
        conn.execute("""
            CREATE TABLE IF NOT EXISTS response_actions (
                action_id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                allocation_id TEXT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                priority TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Open',
                assigned_resource_id TEXT,
                remarks TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT
            )
        """)

        # 8. Roads (Geospatial & Accessibility tracking)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS roads (
                road_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                origin_location TEXT NOT NULL,
                destination_location TEXT NOT NULL,
                status TEXT NOT NULL,
                closure_type TEXT NOT NULL,
                reason TEXT,
                reported_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        # 9. Alerts (Real-time alert hub)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                alert_id TEXT PRIMARY KEY,
                alert_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                related_id TEXT,
                acknowledged INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)

        # Add missing columns safely if upgrading existing tables
        if is_pg:
            conn.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;")
            conn.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;")
            conn.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assistance_requested TEXT;")
            conn.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS infrastructure_issue TEXT;")
            conn.execute("ALTER TABLE resources ADD COLUMN IF NOT EXISTS capability TEXT;")
            conn.execute("ALTER TABLE resources ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;")
            conn.execute("ALTER TABLE resources ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;")
            conn.execute("ALTER TABLE shelters ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;")
            conn.execute("ALTER TABLE shelters ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;")

        conn.commit()

        # Seed synthetic baseline data if resources or roads are empty
        res_count = conn.execute("SELECT COUNT(*) AS count FROM resources").fetchone()["count"]
        road_count = conn.execute("SELECT COUNT(*) AS count FROM roads").fetchone()["count"]
        if res_count == 0 or road_count == 0:
            seed_demo_dataset(conn)

    print(f"Database verified and initialized on engine: {conn.engine}")


def seed_demo_dataset(conn):
    """
    Populate database with baseline scenario from the problem statement:
    Flood affecting Zone A, Zone B, Zone C, with Rescue Boats, Rescue Teams,
    Ambulances, Emergency Vehicles, Shelters A, B, C, and Roads to Zones A, B, C.
    """
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    # 1. Baseline Roads
    roads = [
        ("ROAD-ZONE-A", "Main Road to Zone A", "District HQ", "Zone A", "Partially Blocked", "Known Road Closure", "Flooding covering one lane near bridge", now, now),
        ("ROAD-ZONE-B", "Main Road to Zone B", "District HQ", "Zone B", "Open", "None", "Clear and passable", now, now),
        ("ROAD-ZONE-C", "Main Road to Zone C", "District HQ", "Zone C", "Closed", "Known Road Closure", "Severe floodwaters overflowing embankment. Route impassable.", now, now),
    ]
    for r in roads:
        conn.execute("""
            INSERT INTO roads (road_id, name, origin_location, destination_location, status, closure_type, reason, reported_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (road_id) DO UPDATE SET
                status = EXCLUDED.status,
                closure_type = EXCLUDED.closure_type,
                reason = EXCLUDED.reason
        """, r)

    # 2. Baseline Resources from Problem Statement:
    # 5 Rescue Boats, 4 Rescue Teams, 6 Ambulances, 8 Emergency Vehicles
    sample_resources = [
        # 5 Rescue Boats
        ("BOAT-001", "Rescue Boat", "Rescue Boat 1", "Response Center 1", 8, "Water evacuation / flood rescue", "Available", 16.5100, 80.6400, now),
        ("BOAT-002", "Rescue Boat", "Rescue Boat 2", "Response Center 1", 8, "Water evacuation / flood rescue", "Available", 16.5100, 80.6400, now),
        ("BOAT-003", "Rescue Boat", "Rescue Boat 3", "Response Center 1", 8, "Water evacuation / flood rescue", "Available", 16.5100, 80.6400, now),
        ("BOAT-004", "Rescue Boat", "Rescue Boat 4", "Response Center 2", 6, "Shallow-water rescue", "Available", 16.5200, 80.6200, now),
        ("BOAT-005", "Rescue Boat", "Rescue Boat 5", "Response Center 2", 6, "Shallow-water rescue", "Available", 16.5200, 80.6200, now),

        # 4 Rescue Teams
        ("TEAM-001", "Rescue Team", "Disaster Response Team Alpha", "Station North", 10, "Rapid extraction / technical rescue", "Available", 16.5300, 80.6300, now),
        ("TEAM-002", "Rescue Team", "Disaster Response Team Bravo", "Station North", 10, "Rapid extraction / technical rescue", "Available", 16.5300, 80.6300, now),
        ("TEAM-003", "Rescue Team", "Disaster Response Team Charlie", "Station South", 10, "Flood operations / logistics", "Available", 16.4900, 80.6100, now),
        ("TEAM-004", "Rescue Team", "Disaster Response Team Delta", "Station South", 10, "Flood operations / logistics", "Available", 16.4900, 80.6100, now),

        # 6 Ambulances
        ("AMB-001", "Ambulance", "Advanced Life Support AMB-01", "General Hospital", 2, "Critical medical triage & transport", "Available", 16.5050, 80.6450, now),
        ("AMB-002", "Ambulance", "Basic Life Support AMB-02", "General Hospital", 3, "Patient transport & triage", "Available", 16.5050, 80.6450, now),
        ("AMB-003", "Ambulance", "Basic Life Support AMB-03", "District Hospital", 3, "Patient transport & triage", "Available", 16.5150, 80.6350, now),
        ("AMB-004", "Ambulance", "Basic Life Support AMB-04", "District Hospital", 3, "Patient transport & triage", "Available", 16.5150, 80.6350, now),
        ("AMB-005", "Ambulance", "Field Ambulance AMB-05", "Response Post West", 2, "Rugged terrain patient transfer", "Available", 16.5000, 80.6000, now),
        ("AMB-006", "Ambulance", "Field Ambulance AMB-06", "Response Post West", 2, "Rugged terrain patient transfer", "Available", 16.5000, 80.6000, now),

        # 8 Emergency Vehicles
        ("VEH-001", "Emergency Vehicle", "4x4 Emergency Truck 1", "Logistics Hub", 5, "All-terrain high-clearance transport", "Available", 16.5100, 80.6500, now),
        ("VEH-002", "Emergency Vehicle", "4x4 Emergency Truck 2", "Logistics Hub", 5, "All-terrain high-clearance transport", "Available", 16.5100, 80.6500, now),
        ("VEH-003", "Emergency Vehicle", "Supply Transport Truck 3", "Logistics Hub", 15, "Food/water & blanket delivery", "Available", 16.5100, 80.6500, now),
        ("VEH-004", "Emergency Vehicle", "Supply Transport Truck 4", "Logistics Hub", 15, "Food/water & blanket delivery", "Available", 16.5100, 80.6500, now),
        ("VEH-005", "Emergency Vehicle", "Utility Vehicle 5", "Fire Station 1", 4, "Debris clearance & winch assist", "Available", 16.5250, 80.6300, now),
        ("VEH-006", "Emergency Vehicle", "Utility Vehicle 6", "Fire Station 1", 4, "Debris clearance & winch assist", "Available", 16.5250, 80.6300, now),
        ("VEH-007", "Emergency Vehicle", "Mobile Command Van 7", "District HQ", 6, "Communications & coordination", "Available", 16.5000, 80.6400, now),
        ("VEH-008", "Emergency Vehicle", "Mobile Triage Unit 8", "District HQ", 4, "On-scene initial casualty assessment", "Available", 16.5000, 80.6400, now),
    ]

    # Clear ephemeral allocations and approvals to ensure fresh baseline
    conn.execute("UPDATE response_actions SET allocation_id = NULL;")
    conn.execute("DELETE FROM approval_requests;")
    conn.execute("DELETE FROM allocations;")

    for item in sample_resources:
        conn.execute("""
            INSERT INTO resources (resource_id, resource_type, name, location, capacity, capability, status, latitude, longitude, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (resource_id) DO UPDATE SET
                status = EXCLUDED.status,
                capability = EXCLUDED.capability,
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude
        """, item)

    # 3. Shelters from Problem Statement:
    # Shelter A: Capacity 200, Occupancy 160
    # Shelter B: Capacity 150, Occupancy 60
    # Shelter C: Capacity 300, Occupancy 110
    sample_shelters = [
        ("SHELTER-A", "Shelter A (Central High School)", "Zone A Perimeter", 200, 160, "Open", 16.5150, 80.6420, now),
        ("SHELTER-B", "Shelter B (Community Center)", "Zone B Safe Ridge", 150, 60, "Open", 16.5320, 80.6280, now),
        ("SHELTER-C", "Shelter C (Sports Complex)", "Zone C North Elevation", 300, 110, "Open", 16.4950, 80.6550, now),
    ]

    for s in sample_shelters:
        conn.execute("""
            INSERT INTO shelters (shelter_id, name, location, total_capacity, occupied, status, latitude, longitude, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (shelter_id) DO UPDATE SET
                total_capacity = EXCLUDED.total_capacity,
                occupied = EXCLUDED.occupied,
                status = EXCLUDED.status
        """, s)

    # 4. Baseline Incidents from Problem Statement:
    # INC-001 | Zone A | 40 affected | Residential flooding
    # INC-002 | Zone B | 12 affected | People stranded
    # INC-003 | Zone C | 75 affected | Village access cut off
    sample_incidents = [
        ("INC-001", "Flood", "Flood water has entered approximately 20 houses in Zone A. Around 40 residents may require evacuation.", "Zone A", 40, 4, "Citizen Report", 64, "High", "Reported", "Verified", 0, None, 16.5120, 80.6410, "Evacuation assistance and temporary shelter", "road_partially_flooded", now),
        ("INC-002", "Flood", "Twelve people stranded on elevated building rooftop surrounded by fast-moving water in Zone B.", "Zone B", 12, 4, "Emergency Call", 61, "High", "Reported", "Verified", 0, None, 16.5290, 80.6290, "Rescue boat extraction", "water_surrounding_building", now),
        ("INC-003", "Flood", "Village access cut off. 75 people affected, water levels rising rapidly. Main road closed due to embankment overflow.", "Zone C", 75, 5, "Field Team", 82, "Critical", "Critical Review Required", "Verification Required", 0, None, 16.4910, 80.6590, "Rescue boats and medical evacuation", "road_closed_embankment_overflow", now),
    ]

    for inc in sample_incidents:
        conn.execute("""
            INSERT INTO incidents (
                incident_id, disaster_type, description, location, people_affected, urgency, source,
                severity_score, severity_level, status, verification_status, possible_duplicate, duplicate_of,
                latitude, longitude, assistance_requested, infrastructure_issue, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (incident_id) DO NOTHING
        """, inc)

    # 5. Baseline Initial Alerts
    sample_alerts = [
        ("ALERT-001", "CRITICAL_INCIDENT", "Critical", "Critical Incident Reported: INC-003", "INC-003 in Zone C reported with 75 people cut off. Immediate coordinator review required.", "INC-003", 0, now),
        ("ALERT-002", "ROUTE_BLOCKED", "Warning", "Main Road to Zone C Closed", "Road access to Zone C is impassable due to embankment flooding. Alternative routing required.", "ROAD-ZONE-C", 0, now),
        ("ALERT-003", "WEATHER_WORSE", "Warning", "Severe Rainfall Forecast", "Heavy rainfall expected for the next 6 hours across Example District.", None, 0, now),
    ]

    for a in sample_alerts:
        conn.execute("""
            INSERT INTO alerts (alert_id, alert_type, severity, title, message, related_id, acknowledged, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (alert_id) DO NOTHING
        """, a)

    conn.commit()
    print("[Database] Successfully seeded baseline synthetic emergency dataset.")