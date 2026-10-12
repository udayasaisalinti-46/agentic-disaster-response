
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "disaster.db"


def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    with get_connection() as connection:
        connection.execute("""
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
                created_at TEXT NOT NULL
            )
        """)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS resources (
                resource_id TEXT PRIMARY KEY,
                resource_type TEXT NOT NULL,
                name TEXT NOT NULL,
                location TEXT NOT NULL,
                capacity INTEGER NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        
        connection.execute("""
            CREATE TABLE IF NOT EXISTS allocations (
                allocation_id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                resource_id TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (incident_id)
                    REFERENCES incidents(incident_id),
                FOREIGN KEY (resource_id)
                    REFERENCES resources(resource_id)
            )
        """)
        
        connection.execute("""
            CREATE TABLE IF NOT EXISTS shelters (
                shelter_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                location TEXT NOT NULL,
                total_capacity INTEGER NOT NULL,
                occupied INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                CHECK (total_capacity > 0),
                CHECK (occupied >= 0 AND occupied <= total_capacity)
            )
        """)
        
        connection.execute("""
            CREATE TABLE IF NOT EXISTS weather_assessments (
                assessment_id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                temperature REAL,
                precipitation REAL,
                wind_speed REAL,
                weather_code INTEGER,
                reassessment_recommended INTEGER NOT NULL,
                explanation TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (incident_id)
                    REFERENCES incidents(incident_id)
            )
        """)
        
        connection.execute("""
            CREATE TABLE IF NOT EXISTS approval_requests (
                request_id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                allocation_id TEXT,
                action_type TEXT NOT NULL,
                proposed_action TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending'
                    CHECK (status IN (
                        'Pending', 'Approved', 'Rejected', 'Modified'
                    )),
                reviewer TEXT,
                comments TEXT,
                created_at TEXT NOT NULL,
                reviewed_at TEXT,
                FOREIGN KEY (incident_id)
                    REFERENCES incidents(incident_id),
                FOREIGN KEY (allocation_id)
                    REFERENCES allocations(allocation_id)
            )
        """)
        
        connection.execute("""
            CREATE TABLE IF NOT EXISTS response_actions (
                action_id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                allocation_id TEXT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                priority TEXT NOT NULL
                    CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
                status TEXT NOT NULL DEFAULT 'Open'
                    CHECK (status IN (
                        'Open', 'In Progress', 'Blocked',
                        'Completed', 'Cancelled'
                    )),
                assigned_resource_id TEXT,
                remarks TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT,
                FOREIGN KEY (incident_id)
                    REFERENCES incidents(incident_id),
                FOREIGN KEY (allocation_id)
                    REFERENCES allocations(allocation_id),
                FOREIGN KEY (assigned_resource_id)
                    REFERENCES resources(resource_id)
            )
        """)






