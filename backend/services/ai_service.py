"""
AI Service — Enhanced prompt engineering, few-shot examples,
semantic schema understanding, and self-healing SQL.
"""

import httpx
import re
import logging
from core.config import settings

logger = logging.getLogger(__name__)

FEW_SHOT_EXAMPLES = """
-- Example 1
-- Question: Show the top 5 customers by total order amount
-- SQL: SELECT customer_name, SUM(order_amount) AS total FROM orders GROUP BY customer_name ORDER BY total DESC LIMIT 5;

-- Example 2
-- Question: How many employees are in each department?
-- SQL: SELECT department, COUNT(*) AS employee_count FROM employees GROUP BY department ORDER BY employee_count DESC;

-- Example 3
-- Question: What is the average salary by job title?
-- SQL: SELECT job_title, ROUND(AVG(salary), 2) AS avg_salary FROM employees GROUP BY job_title ORDER BY avg_salary DESC;

-- Example 4
-- Question: List all products that have never been ordered
-- SQL: SELECT p.product_name FROM products p LEFT JOIN order_items oi ON p.id = oi.product_id WHERE oi.product_id IS NULL;

-- Example 5
-- Question: Show monthly sales trend for the current year
-- SQL: SELECT strftime('%Y-%m', order_date) AS month, SUM(amount) AS revenue FROM orders WHERE strftime('%Y', order_date) = strftime('%Y', 'now') GROUP BY month ORDER BY month;
"""

SYSTEM_PROMPT = """You are SmartQuery AI — an expert SQL generation assistant embedded in an enterprise analytics platform.

Your ONLY job is to write correct, efficient SQL SELECT queries.

STRICT RULES:
1. Output ONLY raw SQL — no markdown, no backticks, no explanations, no preamble
2. Only use tables and columns that appear in the provided schema
3. Only generate SELECT queries — never INSERT, UPDATE, DELETE, DROP, ALTER, CREATE
4. Use proper aliases for aggregated columns (e.g., COUNT(*) AS total_count)
5. Always add LIMIT 500 if no limit is specified by the user
6. Use appropriate GROUP BY when using aggregate functions
7. Use table aliases for joins to improve readability
8. If a question is ambiguous, make the most reasonable SQL interpretation"""


def _clean_sql(raw: str) -> str:
    """Strip markdown fences, extra whitespace, trailing semicolons."""
    sql = re.sub(r"```sql|```", "", raw, flags=re.IGNORECASE).strip()
    sql = re.sub(r"\s+", " ", sql)
    if not sql.endswith(";"):
        sql += ";"
    return sql


async def _call_ollama(messages: list[dict], temperature: float = 0.0) -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.OLLAMA_BASE_URL}/api/chat",
            json={
                "model": settings.OLLAMA_MODEL,
                "messages": messages,
                "stream": False,
                "options": {"temperature": temperature, "top_p": 0.9},
            },
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"]


async def generate_sql(schema: str, question: str, conversation_history: list[dict] = None) -> str:
    """
    Generate SQL from a natural language question.
    Supports multi-turn conversation context.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Multi-turn: inject conversation history (last 4 turns max)
    if conversation_history:
        for turn in conversation_history[-4:]:
            messages.append({"role": turn["role"], "content": turn["content"]})

    user_prompt = f"""Database Schema:
{schema}

Reference Examples (for style only, do not copy table names):
{FEW_SHOT_EXAMPLES}

User Question: {question}

Write the SQL query:"""

    messages.append({"role": "user", "content": user_prompt})
    raw = await _call_ollama(messages)
    return _clean_sql(raw)


async def fix_sql(schema: str, failed_sql: str, error_message: str, attempt: int = 1) -> str:
    """
    Self-healing: auto-correct SQL given the error from the DB engine.
    """
    prompt = f"""The following SQL query failed with a database error.
Fix it strictly based on the schema below.

Schema:
{schema}

Failed SQL:
{failed_sql}

Error (attempt {attempt}):
{error_message}

Rules:
- Return ONLY corrected SQL
- No markdown, no explanation
- Only SELECT queries
- Use exact table/column names from schema

Corrected SQL:"""

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]
    raw = await _call_ollama(messages, temperature=0.1)
    return _clean_sql(raw)


async def explain_sql(question: str, sql: str, schema: str) -> str:
    """
    Generate a plain-English explanation of what the SQL does.
    """
    prompt = f"""Explain in simple terms how this SQL answers the user's question.
Write 3-5 short bullet points. Be specific and mention the tables/columns used.

Schema context:
{schema}

User question: {question}

SQL:
{sql}

Explanation:"""

    messages = [{"role": "user", "content": prompt}]
    return (await _call_ollama(messages, temperature=0.2)).strip()


async def suggest_insights(schema: str, question: str, results_preview: str) -> str:
    """
    Generate follow-up question suggestions and data insights.
    """
    prompt = f"""You are a data analyst assistant. Given the schema, question, and result preview,
suggest 3 follow-up analytical questions the user might want to explore next.
Format as a simple numbered list.

Schema summary: {schema[:600]}
Original question: {question}
Result preview: {results_preview[:300]}

Suggested next questions:"""

    messages = [{"role": "user", "content": prompt}]
    return (await _call_ollama(messages, temperature=0.4)).strip()
