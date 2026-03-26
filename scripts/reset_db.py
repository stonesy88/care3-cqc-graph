import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

driver = GraphDatabase.driver(NEO4J_URI, auth=("neo4j", NEO4J_PASSWORD))

commands = [
    # 1. Wipe all nodes and relationships
    "MATCH (n) DETACH DELETE n",
    
    # 2. Drop Vector Indexes
    "DROP INDEX risk_index IF EXISTS",
    "DROP INDEX practice_index IF EXISTS",
    
    # 3. Drop Static Ontology Constraints
    "DROP CONSTRAINT unique_kq_name IF EXISTS",
    "DROP CONSTRAINT unique_qs_cqc_id IF EXISTS",
    "DROP CONSTRAINT unique_qs_uuid IF EXISTS",
    "DROP CONSTRAINT unique_qs_name IF EXISTS",
    "DROP CONSTRAINT unique_reg_id IF EXISTS",
    
    # 4. Drop Dynamic Core Constraints
    "DROP CONSTRAINT unique_location_id IF EXISTS",
    "DROP CONSTRAINT unique_evidence_id IF EXISTS",
    
    # 5. Drop Assessment Node Constraints
    "DROP CONSTRAINT unique_kq_asmt_id IF EXISTS",
    "DROP CONSTRAINT unique_qs_asmt_id IF EXISTS",
    
    # 6. Drop True Graph Constraints
    "DROP CONSTRAINT unique_provider_id IF EXISTS",
    "DROP CONSTRAINT unique_specialism_name IF EXISTS",
    "DROP CONSTRAINT unique_service_type_name IF EXISTS"
]

def reset_db():
    print(f"Connecting to Neo4j at {NEO4J_URI} for full reset...")
    with driver.session() as session:
        for cmd in commands:
            # Print a shortened version of the command for clean logs
            print(f"Executing: {cmd.strip().splitlines()[0]} ...")
            try:
                session.run(cmd)
            except Exception as e:
                # It's totally fine if it fails here—it just means it was already deleted
                print(f"  -> Skipped (Likely already deleted): {str(e)[:80]}...")
                
    print("\n💥 DB completely wiped! All nodes, relationships, indexes, and constraints are gone.")

if __name__ == "__main__":
    reset_db()
    driver.close()