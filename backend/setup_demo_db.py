"""
SmartQuery AI — Demo database generator
Creates project_data.db with realistic sample data for testing
"""

import sqlite3
import random
from pathlib import Path

DB_PATH = "project_data.db"


def create_demo_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Students
    cur.execute("""
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            department TEXT NOT NULL,
            semester INTEGER,
            cgpa REAL,
            fees_paid INTEGER DEFAULT 0
        )
    """)

    # Courses
    cur.execute("""
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            department TEXT,
            credits INTEGER,
            instructor TEXT
        )
    """)

    # Enrollments
    cur.execute("""
        CREATE TABLE IF NOT EXISTS enrollments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER REFERENCES students(id),
            course_id INTEGER REFERENCES courses(id),
            grade TEXT,
            marks INTEGER,
            year INTEGER
        )
    """)

    # Sales
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product TEXT NOT NULL,
            category TEXT,
            amount REAL,
            quantity INTEGER,
            sale_date TEXT,
            region TEXT
        )
    """)

    departments = ["Computer Science", "Electronics", "Mechanical", "Civil", "Information Technology"]
    names = ["Aarav", "Priya", "Rohan", "Sneha", "Arjun", "Ananya", "Vikram", "Divya",
             "Kabir", "Pooja", "Rahul", "Meera", "Aditya", "Simran", "Karan", "Nisha"]

    cur.executemany(
        "INSERT INTO students (name, department, semester, cgpa, fees_paid) VALUES (?,?,?,?,?)",
        [(f"{random.choice(names)} {random.choice(['Sharma','Patel','Gupta','Singh','Mehta'])}",
          random.choice(departments),
          random.randint(1, 8),
          round(random.uniform(5.5, 9.8), 2),
          random.choice([0, 1]))
         for _ in range(50)]
    )

    courses_data = [
        ("CS101", "Introduction to Programming", "Computer Science", 4, "Prof. Sharma"),
        ("CS202", "Data Structures", "Computer Science", 4, "Prof. Gupta"),
        ("CS303", "Database Management", "Computer Science", 3, "Prof. Patel"),
        ("CS404", "Machine Learning", "Computer Science", 4, "Prof. Singh"),
        ("EC101", "Digital Electronics", "Electronics", 4, "Prof. Kumar"),
        ("ME101", "Engineering Mechanics", "Mechanical", 4, "Prof. Verma"),
    ]
    cur.executemany("INSERT OR IGNORE INTO courses (code, name, department, credits, instructor) VALUES (?,?,?,?,?)", courses_data)

    grades = ["A+", "A", "B+", "B", "C+", "C", "D", "F"]
    for sid in range(1, 51):
        for cid in range(1, 7):
            if random.random() > 0.4:
                cur.execute(
                    "INSERT INTO enrollments (student_id, course_id, grade, marks, year) VALUES (?,?,?,?,?)",
                    (sid, cid, random.choice(grades), random.randint(35, 100), random.choice([2022, 2023, 2024]))
                )

    products = ["Laptop", "Mouse", "Keyboard", "Monitor", "Headphones", "Webcam", "USB Hub", "SSD"]
    categories = ["Peripherals", "Storage", "Display", "Audio"]
    regions = ["North", "South", "East", "West"]

    import datetime
    base_date = datetime.date(2024, 1, 1)
    for i in range(200):
        d = base_date + datetime.timedelta(days=random.randint(0, 365))
        cur.execute(
            "INSERT INTO sales (product, category, amount, quantity, sale_date, region) VALUES (?,?,?,?,?,?)",
            (random.choice(products), random.choice(categories),
             round(random.uniform(500, 80000), 2), random.randint(1, 20),
             d.isoformat(), random.choice(regions))
        )

    conn.commit()
    conn.close()
    print(f"✓ Demo database created at {DB_PATH}")
    print("  Tables: students, courses, enrollments, sales")
    print("  Try: 'Show top 5 students by CGPA' or 'Total sales by region'")


if __name__ == "__main__":
    create_demo_db()
