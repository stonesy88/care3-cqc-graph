# CQC Knowledge Graph Search API - Test Suite

This document contains a series of API requests designed to validate both the **Semantic (Vector)** and **Structural (Text-to-Cypher)** capabilities of the hybrid search route `/api/search`.

> **Note on Windows PowerShell**: The multi-line `curl` commands below contain backslashes `\` for formatting. If you are running these directly in Windows PowerShell, you must run them on a single line, or use `curl.exe` explicitly, or use a Bash emulator like Git Bash/WSL.

---

## Part 1: Semantic (Vector & Full-Text RRF) Search Queries
These queries test the integration with Reciprocal Rank Fusion. The classifier routes these to the `UNION` query block natively ranking both `*_index` (vectors) and `*_text` (keywords) simultaneously.

### 1. Medication & Record Keeping (Risk focus)
```bash
curl -X POST http://localhost:3000/api/search \
-H "Content-Type: application/json" \
-d '{"searchQuery": "medication storage issues and missing records", "locationId": "1-5645167996"}'
```

### 2. Outstanding Care & Community (Practice focus)
```bash
curl -X POST http://localhost:3000/api/search \
-H "Content-Type: application/json" \
-d '{"searchQuery": "excellent community engagement and highly praised compassionate care", "locationId": "all"}'
```

### 3. Patient Isolation & Well-being (Subtle semantic match)
```bash
curl -X POST http://localhost:3000/api/search \
-H "Content-Type: application/json" \
-d '{"searchQuery": "patients feeling isolated, lonely, or not having structured activities", "locationId": "1-5645167996"}'
```

### 4. Hot Water Constraints (Semantic Exact Keyword vs Vector)
```bash
curl -X POST http://localhost:3000/api/search \
-H "Content-Type: application/json" \
-d '{"searchQuery": "hot water window restrictors", "locationId": "all"}'
```

---

## Part 2: Structural (Text-to-Cypher) Search Queries
These queries test the Gemini LLM constraint mapping. The classifier should recognize these as structural, translating natural language into rigid schema aggregations, including explicit RRF hybrid `UNION` sets for fuzzy filtering.

### 5. Counting Identified Risks (Global)
```bash
curl -X POST http://localhost:3000/api/search \
-H "Content-Type: application/json" \
-d '{"searchQuery": "How many total identified risks are there in the database?", "locationId": "all"}'
```

### 6. Hybrid RRF Structural Filter (Count Fuzzy Concept)
```bash
curl -X POST http://localhost:3000/api/search \
-H "Content-Type: application/json" \
-d '{"searchQuery": "How many positive practices exist related to hygiene?", "locationId": "all"}'
```

### 7. Exploring Valid Regulations
```bash
curl -X POST http://localhost:3000/api/search \
-H "Content-Type: application/json" \
-d '{"searchQuery": "List all the Regulations that Quality Statement Assessments map to.", "locationId": "all"}'
```

---

## Part 3: PowerShell Native Equivalents (If avoiding Git Bash / curl)
If you are running tests strictly in native Windows PowerShell without modifying the syntax, use `Invoke-RestMethod`:

```powershell
# Example Semantic Query
$body = @{
    searchQuery = "medication storage issues and missing records"
    locationId = "1-5645167996"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/search" -Method Post -Headers @{"Content-Type"="application/json"} -Body $body
```

```powershell
# Example Structural Query
$body = @{
    searchQuery = "How many positive practices exist related to hygiene?"
    locationId = "all"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/search" -Method Post -Headers @{"Content-Type"="application/json"} -Body $body
```
