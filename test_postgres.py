
import os
from dotenv import load_dotenv
import psycopg

load_dotenv()

try:
    with psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        connect_timeout=5,
    ) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_database(), version()")
            database_name, version = cursor.fetchone()

            print("PostgreSQL connection successful!")
            print("Database:", database_name)
            print("Version:", version.split(",")[0])

except Exception as error:
    print("PostgreSQL connection failed.")
    print("Error:", error)
