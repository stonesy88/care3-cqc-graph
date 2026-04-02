import os
import json
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

driver = GraphDatabase.driver(NEO4J_URI, auth=("neo4j", NEO4J_PASSWORD))

UNIQUE_REGULATIONS = [
    {"reg_id": 17, "reg_name": "Good governance"},
    {"reg_id": 12, "reg_name": "Safe care and treatment"},
    {"reg_id": 13, "reg_name": "Safeguarding service users from abuse and improper treatment"},
    {"reg_id": 15, "reg_name": "Premises and equipment"},
    {"reg_id": 18, "reg_name": "Staffing"},
    {"reg_id": 9,  "reg_name": "Person-centred care"},
    {"reg_id": 14, "reg_name": "Meeting nutritional and hydration needs"},
    {"reg_id": 11, "reg_name": "Need for consent"},
    {"reg_id": 10, "reg_name": "Dignity and respect"},
    {"reg_id": 16, "reg_name": "Receiving and acting on complaints"},
    {"reg_id": 5,  "reg_name": "Fit and proper persons: directors"},
    {"reg_id": 20, "reg_name": "Duty of candour"}
]

# Query 1: Build Regulations exclusively
query_1_regulations = """
UNWIND $regulations AS regData
MERGE (reg:Regulation {reg_id: regData.reg_id})
ON CREATE SET reg.name = regData.reg_name
"""

commands = [
    # Vector Indexes
    "CREATE VECTOR INDEX finding_index IF NOT EXISTS FOR (f:Finding) ON (f.embedding) OPTIONS { indexConfig: { `vector.dimensions`: 768, `vector.similarity_function`: 'cosine' } }",
    
    # Full-Text Index
    "CREATE FULLTEXT INDEX finding_text IF NOT EXISTS FOR (f:Finding) ON EACH [f.description]",
    
    # Constraints
    "CREATE CONSTRAINT unique_location_id IF NOT EXISTS FOR (loc:Location) REQUIRE loc.location_id IS UNIQUE",
    "CREATE CONSTRAINT unique_evidence_id IF NOT EXISTS FOR (ev:Evidence) REQUIRE ev.ev_id IS UNIQUE",
    "CREATE CONSTRAINT unique_kq_asmt_id IF NOT EXISTS FOR (kqa:KeyQuestionAssessment) REQUIRE kqa.kq_asmt_id IS UNIQUE",
    "CREATE CONSTRAINT unique_qs_id IF NOT EXISTS FOR (qsa:QualityStatement) REQUIRE qsa.qs_asmt_id IS UNIQUE",
    "CREATE CONSTRAINT unique_provider_id IF NOT EXISTS FOR (prov:Provider) REQUIRE prov.provider_id IS UNIQUE",
    "CREATE CONSTRAINT unique_specialism_name IF NOT EXISTS FOR (spec:Specialism) REQUIRE spec.name IS UNIQUE",
    "CREATE CONSTRAINT unique_service_type_name IF NOT EXISTS FOR (svc:ServiceType) REQUIRE svc.name IS UNIQUE",
    "CREATE CONSTRAINT unique_reg_id IF NOT EXISTS FOR (reg:Regulation) REQUIRE reg.reg_id IS UNIQUE",
    "CREATE CONSTRAINT unique_finding_id IF NOT EXISTS FOR (f:Finding) REQUIRE f.finding_id IS UNIQUE",
    "CREATE CONSTRAINT unique_policy_id IF NOT EXISTS FOR (p:Policy) REQUIRE p.policy_id IS UNIQUE",
    "CREATE CONSTRAINT unique_breach_id IF NOT EXISTS FOR (b:PolicyBreach) REQUIRE b.breach_id IS UNIQUE"
]

def init_db():
    print(f"Connecting to Neo4j at {NEO4J_URI}...")
    with driver.session() as session:
        for i, cmd in enumerate(commands):
            print(f"\n--- Executing Command {i+1} ---")
            try:
                session.run(cmd)
                print("✅ Success!")
            except Exception as e:
                print(f"❌ CRITICAL ERROR: {e}")
                
        print("\n--- Executing Command 11 ---")
        try:
            session.run(query_1_regulations, regulations=UNIQUE_REGULATIONS)
            print("✅ Success!")
        except Exception as e:
            print(f"❌ CRITICAL ERROR: {e}")
                
    print("\n✅ Database initialization complete! Static Regulations perfectly mapped.")

if __name__ == "__main__":
    init_db()
    driver.close()