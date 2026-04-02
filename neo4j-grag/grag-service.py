import asyncio
import json
import logging
import os
import re
from contextlib import asynccontextmanager
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import httpx
import neo4j
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from google import genai
from neo4j import RoutingControl
from neo4j_graphrag.embeddings.base import Embedder
from neo4j_graphrag.llm.base import LLMInterface
from neo4j_graphrag.llm.types import LLMResponse
from neo4j_graphrag.retrievers import HybridCypherRetriever
from neo4j_graphrag.types import RetrieverResultItem
from pydantic import BaseModel, Field

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("cqc-graphrag")


# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

class Settings(BaseModel):
    neo4j_uri: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    neo4j_username: str = os.getenv("NEO4J_USERNAME", "neo4j")
    neo4j_password: str = os.getenv("NEO4J_PASSWORD", "password")
    neo4j_database: Optional[str] = os.getenv("NEO4J_DATABASE")

    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite-preview")

    embedder_url: str = os.getenv("EMBEDDER_URL", "http://embedder:8001/embed")
    vector_index_name: str = os.getenv("VECTOR_INDEX_NAME", "finding_index")
    fulltext_index_name: str = os.getenv("FULLTEXT_INDEX_NAME", "finding_text")

    hybrid_top_k: int = int(os.getenv("HYBRID_TOP_K", "5"))
    candidate_k: int = int(os.getenv("CANDIDATE_K", "24"))
    rrf_k: int = int(os.getenv("RRF_K", "60"))

    request_timeout_seconds: float = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "20.0"))


settings = Settings()
if not settings.gemini_api_key:
    raise RuntimeError("GEMINI_API_KEY is required")


# -----------------------------------------------------------------------------
# API models
# -----------------------------------------------------------------------------

class SearchRequest(BaseModel):
    query: Optional[str] = None
    locationId: Optional[str] = "all"
    searchQuery: Optional[str] = None
    selectedLocation: Optional[str] = None


class SearchResponse(BaseModel):
    answer: str
    nodes: List[Dict[str, Any]]
    links: List[Dict[str, Any]]


class QueryIntent(str, Enum):
    STRUCTURAL = "STRUCTURAL"
    SEMANTIC = "SEMANTIC"


class FindingFilter(str, Enum):
    RISK = "risk"
    POSITIVE = "positive"
    NONE = "none"


class FilterMode(str, Enum):
    HARD = "hard"
    SOFT = "soft"
    NONE = "none"


class QueryPlan(BaseModel):
    intent: QueryIntent = Field(description="STRUCTURAL or SEMANTIC")
    finding_filter: FindingFilter = Field(description="risk, positive, or none")
    filter_mode: FilterMode = Field(
        description="hard when user explicitly asked for only that class; soft when inferred; none otherwise"
    )
    rationale: str = Field(description="Short internal explanation of the classification")


class CypherGeneration(BaseModel):
    cypher: str


# -----------------------------------------------------------------------------
# Graph schema / prompts
# -----------------------------------------------------------------------------

CQC_SCHEMA = """
Node properties:
Location {location_id: STRING, name: STRING, beds: INTEGER, status: STRING, loc_type: STRING, local_authority: STRING}
KeyQuestionAssessment {kq_name: STRING, rating: STRING, percentage_score: INTEGER, commentary: STRING}
QualityStatementAssessment {qs_name: STRING, qs_score: INTEGER, qs_score_description: STRING, status: STRING}
Finding {finding_id: STRING, type: STRING, description: STRING}
Evidence {commentary: STRING, type: STRING}
Regulation {reg_id: INTEGER, name: STRING}
PolicyBreach {breach_id: STRING, details: STRING, summary: STRING}
Policy {policy_id: STRING, title: STRING, description: STRING}
Provider {provider_id: STRING, name: STRING}
Specialism {name: STRING}
ServiceType {name: STRING}

Relationships:
(Location)-[MANAGED_BY]->(Provider)
(Location)-[HAS_SPECIALISM]->(Specialism)
(Location)-[PROVIDES_SERVICE]->(ServiceType)
(Location)-[HAS_KQ_ASSESSMENT]->(KeyQuestionAssessment)
(KeyQuestionAssessment)-[HAS_QS_ASSESSMENT]->(QualityStatementAssessment)
(QualityStatementAssessment)-[HAS_FINDING]->(Finding)
(QualityStatementAssessment)-[MAPS_TO_REGULATION]->(Regulation)
(Finding)-[FINDING_PROVENANCE]->(Evidence)
(PolicyBreach)-[VIOLATES]->(Policy)
"""

STRUCTURAL_CYPHER_PROMPT = """
You are a Neo4j Cypher expert.

Convert the user request into a single READ-ONLY Cypher query for the schema below.

Schema:
{schema}

Rules:
1. Output valid raw Cypher only.
2. Never use CREATE, MERGE, DELETE, SET, REMOVE, CALL dbms, CALL apoc, LOAD CSV, or any write/admin clause.
3. Use explicit relationship variables everywhere. Never use anonymous relationships.
4. If a location filter is present, apply it with:
   WHERE ($location_id = 'all' OR loc.location_id = $location_id)
5. If a finding filter is present, apply it with:
   AND ($finding_type IS NULL OR f.type = $finding_type)
6. The query MUST return exactly: RETURN nodes, links
7. IMPORTANT: To prevent Neo4j Out-Of-Memory exceptions, you must explicitly isolate string matching and filtering!
   MATCH the specific target node FIRST, applying your WHERE constraints and string matching (CONTAINS).
   Then IMMEDIATELY use a WITH clause to pass those specific nodes forward BEFORE executing the massive hierarchical MATCH patterns (Location, KeyQuestion, etc).
   Example:
   MATCH (f:Finding) WHERE f.description CONTAINS 'hoist'
   WITH f
   MATCH (qs:QualityStatementAssessment)-[:HAS_FINDING]->(f) ...
   ...
8. The result shape must follow this exact pattern:

WITH
  collect(distinct loc) +
  collect(distinct kq) +
  collect(distinct qs) +
  collect(distinct f) +
  collect(distinct ev) +
  collect(distinct reg) +
  collect(distinct pol) +
  collect(distinct prov) AS rawNodes,
  collect(distinct r_loc_kq) +
  collect(distinct r_kq_qs) +
  collect(distinct r_qs_f) +
  collect(distinct r_f_ev) +
  collect(distinct r_qs_reg) +
  collect(distinct r_loc_prov) +
  collect(distinct r_pb_pol) AS rawRels

UNWIND rawNodes AS n
WITH DISTINCT n, rawRels
WHERE n IS NOT NULL
WITH collect({{
  id: elementId(n),
  group: CASE
    WHEN 'Finding' IN labels(n) AND n.type = 'risk' THEN 'RiskFlag'
    WHEN 'Finding' IN labels(n) AND n.type = 'positive' THEN 'PositivePractice'
    ELSE labels(n)[0]
  END,
  name: CASE
    WHEN 'Evidence' IN labels(n) THEN 'Evidence extract (' + coalesce(n.commentary_date, 'Unknown Date') + ')'
    WHEN 'Finding' IN labels(n) THEN substring(coalesce(n.description, 'Finding...'), 0, 50) + '...'
    ELSE coalesce(n.name, n.kq_name, n.qs_name, n.title, n.summary, n.description, 'Unknown')
  END,
  properties: properties(n)
}}) AS nodes, rawRels
UNWIND rawRels AS r
WITH DISTINCT r, nodes
WHERE r IS NOT NULL
WITH nodes, collect({{
  source: elementId(startNode(r)),
  target: elementId(endNode(r)),
  label: type(r)
}}) AS links
RETURN nodes, links

Parameters available:
- location_id = {location_id}
- finding_type = {finding_type}

User query:
{query}
"""

HYBRID_RETRIEVAL_QUERY = """
MATCH (qs:QualityStatementAssessment)-[r_qs_f:HAS_FINDING]->(node)
MATCH (kq:KeyQuestionAssessment)-[r_kq_qs:HAS_QS_ASSESSMENT]->(qs)
MATCH (loc:Location)-[r_loc_kq:HAS_KQ_ASSESSMENT]->(kq)
OPTIONAL MATCH (node)-[r_f_ev:FINDING_PROVENANCE]->(ev:Evidence)
OPTIONAL MATCH (qs)-[r_qs_reg:MAPS_TO_REGULATION]->(reg:Regulation)
OPTIONAL MATCH (loc)-[r_loc_prov:MANAGED_BY]->(prov:Provider)
OPTIONAL MATCH (node:PolicyBreach)-[r_pb_pol:VIOLATES]->(pol:Policy)
WITH
  collect(distinct loc) +
  collect(distinct kq) +
  collect(distinct qs) +
  collect(distinct node) +
  collect(distinct ev) +
  collect(distinct reg) +
  collect(distinct pol) +
  collect(distinct prov) AS rawNodes,
  collect(distinct r_loc_kq) +
  collect(distinct r_kq_qs) +
  collect(distinct r_qs_f) +
  collect(distinct r_f_ev) +
  collect(distinct r_qs_reg) +
  collect(distinct r_loc_prov) +
  collect(distinct r_pb_pol) AS rawRels
UNWIND rawNodes AS n
WITH DISTINCT n, rawRels
WHERE n IS NOT NULL
WITH collect({
  id: elementId(n),
  group: CASE
    WHEN 'Finding' IN labels(n) AND n.type = 'risk' THEN 'RiskFlag'
    WHEN 'Finding' IN labels(n) AND n.type = 'positive' THEN 'PositivePractice'
    ELSE labels(n)[0]
  END,
  name: CASE
    WHEN 'Evidence' IN labels(n) THEN 'Evidence extract (' + coalesce(n.commentary_date, 'Unknown Date') + ')'
    WHEN 'Finding' IN labels(n) THEN substring(coalesce(n.description, 'Finding...'), 0, 50) + '...'
    ELSE coalesce(n.name, n.kq_name, n.qs_name, n.title, n.summary, n.description, 'Unknown')
  END,
  properties: properties(n)
}) AS nodes, rawRels
UNWIND rawRels AS r
WITH DISTINCT r, nodes
WHERE r IS NOT NULL
WITH nodes, collect({
  source: elementId(startNode(r)),
  target: elementId(endNode(r)),
  label: type(r)
}) AS links
RETURN nodes, links
"""


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

def normalize_query(req: SearchRequest) -> Tuple[str, str]:
    query = (req.query or req.searchQuery or "").strip()
    location = (req.locationId or req.selectedLocation or "all").strip() or "all"
    return query, location


def is_blank_or_all(value: Optional[str]) -> bool:
    return value is None or value.strip() == "" or value.strip().lower() == "all"


def dedupe_graph(
    nodes: List[Dict[str, Any]],
    links: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    seen_nodes = set()
    dedup_nodes: List[Dict[str, Any]] = []
    for node in nodes:
        node_id = node.get("id")
        if node_id and node_id not in seen_nodes:
            seen_nodes.add(node_id)
            props = node.get("properties") or {}
            props.pop("embedding", None)
            node["properties"] = props
            dedup_nodes.append(node)

    seen_links = set()
    dedup_links: List[Dict[str, Any]] = []
    for link in links:
        key = (link.get("source"), link.get("label"), link.get("target"))
        if key not in seen_links:
            seen_links.add(key)
            dedup_links.append(link)

    return dedup_nodes, dedup_links


def extract_primary_findings(nodes: List[Dict[str, Any]]) -> List[str]:
    finding_groups = {"Finding", "RiskFlag", "PositivePractice"}
    findings: List[str] = []
    for node in nodes:
        if node.get("group") in finding_groups:
            name = (node.get("name") or "").strip()
            if name:
                findings.append(name)
    return findings[:20]


FORBIDDEN_CYPHER = re.compile(
    r"\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|LOAD\s+CSV|CALL\s+dbms|CALL\s+apoc)\b",
    re.IGNORECASE,
)


def validate_structural_cypher(cypher: str) -> str:
    cleaned = cypher.strip().strip("`")
    if FORBIDDEN_CYPHER.search(cleaned):
        raise ValueError("Generated Cypher contains forbidden clauses")
    if "RETURN nodes, links" not in cleaned:
        raise ValueError("Generated Cypher must end with RETURN nodes, links")
    if not re.search(r"\bMATCH\b", cleaned, re.IGNORECASE):
        raise ValueError("Generated Cypher must contain MATCH")
    return cleaned


# -----------------------------------------------------------------------------
# Gemini services
# -----------------------------------------------------------------------------

class GeminiService:
    def __init__(self, api_key: str, model: str):
        self.client = genai.Client(api_key=api_key)
        self.model = model

    async def classify(self, query_text: str) -> QueryPlan:
        prompt = f"""
Classify this CQC graph search request.

Return:
- intent: STRUCTURAL or SEMANTIC
- finding_filter: risk, positive, or none
- filter_mode:
  - hard = the user explicitly requested only that class
  - soft = the class is inferred but not strictly explicit
  - none = no class filter
- rationale: short explanation

Guidance:
- STRUCTURAL: counting, aggregations, rankings, direct factual graph traversal, specific location lookup, "how many", "which location", "list all", etc.
- SEMANTIC: fuzzy themes, evidence, concerns, sentiment-like intent, yes/no about evidence, pattern discovery.
- If the user literally asks for risks/issues/failures only, finding_filter=risk and filter_mode=hard.
- If the user literally asks for positives/good practice only, finding_filter=positive and filter_mode=hard.
- If the wording only implies the class, use soft.

User query:
{query_text}
""".strip()

        response = await asyncio.to_thread(
            self.client.models.generate_content,
            model=self.model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_json_schema": QueryPlan.model_json_schema(),
            },
        )
        return QueryPlan.model_validate_json(response.text)

    async def generate_structural_cypher(
        self,
        query_text: str,
        location_id: str,
        finding_type: Optional[str],
    ) -> str:
        prompt = STRUCTURAL_CYPHER_PROMPT.format(
            schema=CQC_SCHEMA,
            location_id=location_id,
            finding_type=finding_type,
            query=query_text,
        )

        response = await asyncio.to_thread(
            self.client.models.generate_content,
            model=self.model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_json_schema": CypherGeneration.model_json_schema(),
            },
        )
        payload = CypherGeneration.model_validate_json(response.text)
        return validate_structural_cypher(payload.cypher)

    async def summarize(
        self,
        query_text: str,
        nodes: List[Dict[str, Any]],
    ) -> str:
        if not nodes:
            return "No exact records or supporting evidence were found for that query."

        findings = extract_primary_findings(nodes)
        compact_nodes = json.dumps(nodes[:80], ensure_ascii=False)

        prompt = f"""
You are summarising a graph retrieval result for a CQC search UI.

User query:
{query_text}

Primary findings:
{json.dumps(findings, ensure_ascii=False)}

Graph nodes:
{compact_nodes}

Write 1-2 plain sentences.
Be direct.
Do not use markdown.
Do not hallucinate counts not present in the graph.
""".strip()

        response = await asyncio.to_thread(
            self.client.models.generate_content,
            model=self.model,
            contents=prompt,
        )
        return (response.text or "").strip() or "Relevant graph evidence was found."


# -----------------------------------------------------------------------------
# Custom GraphRAG adapters
# -----------------------------------------------------------------------------

class CustomGeminiLLM(LLMInterface):
    supports_structured_output: bool = False

    def __init__(self, gemini: GeminiService):
        super().__init__(model_name=gemini.model)
        self.gemini = gemini

    def invoke(
        self,
        input: str,
        message_history=None,
        system_instruction=None,
        **kwargs,
    ) -> LLMResponse:
        prompt = ""
        if system_instruction:
            prompt += system_instruction + "\n\n"
        prompt += input

        response = self.gemini.client.models.generate_content(
            model=self.gemini.model,
            contents=prompt,
        )
        return LLMResponse(content=response.text or "")

    async def ainvoke(
        self,
        input: str,
        message_history=None,
        system_instruction=None,
        **kwargs,
    ) -> LLMResponse:
        return await asyncio.to_thread(
            self.invoke,
            input,
            message_history,
            system_instruction,
            **kwargs,
        )


class HttpEmbedder(Embedder):
    def __init__(self, embedder_url: str, timeout_seconds: float):
        self.embedder_url = embedder_url
        self.timeout_seconds = timeout_seconds

    def embed_query(self, text: str) -> List[float]:
        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.post(self.embedder_url, json={"text": text})
            response.raise_for_status()
            payload = response.json()
            vector = payload.get("vector")
            if not isinstance(vector, list) or not vector:
                raise ValueError("Embedder returned an invalid vector")
            return vector

    async def aembed_query(self, text: str) -> List[float]:
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(self.embedder_url, json={"text": text})
            response.raise_for_status()
            payload = response.json()
            vector = payload.get("vector")
            if not isinstance(vector, list) or not vector:
                raise ValueError("Embedder returned an invalid vector")
            return vector


# -----------------------------------------------------------------------------
# Core search service
# -----------------------------------------------------------------------------

class SearchService:
    def __init__(self, driver: neo4j.Driver, gemini: GeminiService):
        self.driver = driver
        self.gemini = gemini
        self.embedder = HttpEmbedder(
            embedder_url=settings.embedder_url,
            timeout_seconds=settings.request_timeout_seconds,
        )
        self.graphrag_llm = CustomGeminiLLM(gemini)
        self.hybrid_retriever = HybridCypherRetriever(
            driver=self.driver,
            vector_index_name=settings.vector_index_name,
            fulltext_index_name=settings.fulltext_index_name,
            embedder=self.embedder,
            retrieval_query=HYBRID_RETRIEVAL_QUERY,
            result_formatter=lambda record: RetrieverResultItem(
                content=record.data(),
                metadata={"score": record.get("score")},
            ),
            neo4j_database=settings.neo4j_database,
        )

    async def search(self, query_text: str, location_id: str) -> SearchResponse:
        plan = await self.gemini.classify(query_text)
        logger.info(
            "query_plan intent=%s filter=%s mode=%s location=%s rationale=%s",
            plan.intent,
            plan.finding_filter,
            plan.filter_mode,
            location_id,
            plan.rationale,
        )

        finding_type: Optional[str] = (
            None if plan.finding_filter == FindingFilter.NONE else plan.finding_filter.value
        )

        has_location_constraint = not is_blank_or_all(location_id)
        has_hard_type_constraint = (
            plan.finding_filter in {FindingFilter.RISK, FindingFilter.POSITIVE}
            and plan.filter_mode == FilterMode.HARD
        )

        try:
            if plan.intent == QueryIntent.STRUCTURAL:
                nodes, links = await self._run_structural(
                    query_text=query_text,
                    location_id=location_id,
                    finding_type=finding_type,
                )
            elif has_location_constraint or has_hard_type_constraint:
                nodes, links = await self._run_constrained_semantic_rrf(
                    query_text=query_text,
                    location_id=location_id,
                    finding_type=finding_type if has_hard_type_constraint else None,
                )
            else:
                nodes, links = await self._run_unconstrained_hybrid(
                    query_text=query_text
                )

            nodes, links = dedupe_graph(nodes, links)
            answer = await self.gemini.summarize(query_text=query_text, nodes=nodes)
            return SearchResponse(answer=answer, nodes=nodes, links=links)

        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Search failed")
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    async def _run_structural(
        self,
        query_text: str,
        location_id: str,
        finding_type: Optional[str],
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        cypher = await self.gemini.generate_structural_cypher(
            query_text=query_text,
            location_id=location_id,
            finding_type=finding_type,
        )
        logger.info("structural_cypher=%s", cypher)

        records, _, _ = await asyncio.to_thread(
            self.driver.execute_query,
            cypher,
            {
                "location_id": location_id,
                "finding_type": finding_type,
            },
            database_=settings.neo4j_database,
            routing_=RoutingControl.READ,
        )

        if not records:
            return [], []

        first = records[0]
        return first.get("nodes", []), first.get("links", [])

    async def _run_constrained_semantic_rrf(
        self,
        query_text: str,
        location_id: str,
        finding_type: Optional[str],
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        query_vector = await self.embedder.aembed_query(query_text)

        cypher = """
CALL {
  WITH $query_vector AS qv, $candidate_k AS ck, $location_id AS location_id, $finding_type AS finding_type
  CALL db.index.vector.queryNodes($vector_index_name, ck, qv)
  YIELD node, score
  MATCH (qs:QualityStatementAssessment)-[:HAS_FINDING]->(node)
  MATCH (kq:KeyQuestionAssessment)-[:HAS_QS_ASSESSMENT]->(qs)
  MATCH (loc:Location)-[:HAS_KQ_ASSESSMENT]->(kq)
  WHERE (location_id = 'all' OR loc.location_id = location_id)
    AND (finding_type IS NULL OR node.type = finding_type)
  WITH node, score
  ORDER BY score DESC
  RETURN collect(node) AS vector_nodes
}
CALL {
  WITH $query_text AS qt, $candidate_k AS ck, $location_id AS location_id, $finding_type AS finding_type
  CALL db.index.fulltext.queryNodes($fulltext_index_name, qt, {limit: ck})
  YIELD node, score
  MATCH (qs:QualityStatementAssessment)-[:HAS_FINDING]->(node)
  MATCH (kq:KeyQuestionAssessment)-[:HAS_QS_ASSESSMENT]->(qs)
  MATCH (loc:Location)-[:HAS_KQ_ASSESSMENT]->(kq)
  WHERE (location_id = 'all' OR loc.location_id = location_id)
    AND (finding_type IS NULL OR node.type = finding_type)
  WITH node, score
  ORDER BY score DESC
  RETURN collect(node) AS text_nodes
}
CALL {
  WITH vector_nodes
  UNWIND range(0, size(vector_nodes) - 1) AS i
  RETURN vector_nodes[i] AS node, (1.0 / ($rrf_k + i + 1)) AS partial_score
  UNION ALL
  WITH text_nodes
  UNWIND range(0, size(text_nodes) - 1) AS i
  RETURN text_nodes[i] AS node, (1.0 / ($rrf_k + i + 1)) AS partial_score
}
WITH node, sum(partial_score) AS fused_score
ORDER BY fused_score DESC
LIMIT $top_k
MATCH (qs:QualityStatementAssessment)-[r_qs_f:HAS_FINDING]->(node)
MATCH (kq:KeyQuestionAssessment)-[r_kq_qs:HAS_QS_ASSESSMENT]->(qs)
MATCH (loc:Location)-[r_loc_kq:HAS_KQ_ASSESSMENT]->(kq)
OPTIONAL MATCH (node)-[r_f_ev:FINDING_PROVENANCE]->(ev:Evidence)
OPTIONAL MATCH (qs)-[r_qs_reg:MAPS_TO_REGULATION]->(reg:Regulation)
OPTIONAL MATCH (loc)-[r_loc_prov:MANAGED_BY]->(prov:Provider)
OPTIONAL MATCH (node:PolicyBreach)-[r_pb_pol:VIOLATES]->(pol:Policy)
WITH
  collect(distinct loc) +
  collect(distinct kq) +
  collect(distinct qs) +
  collect(distinct node) +
  collect(distinct ev) +
  collect(distinct reg) +
  collect(distinct pol) +
  collect(distinct prov) AS rawNodes,
  collect(distinct r_loc_kq) +
  collect(distinct r_kq_qs) +
  collect(distinct r_qs_f) +
  collect(distinct r_f_ev) +
  collect(distinct r_qs_reg) +
  collect(distinct r_loc_prov) +
  collect(distinct r_pb_pol) AS rawRels
UNWIND rawNodes AS n
WITH DISTINCT n, rawRels
WHERE n IS NOT NULL
WITH collect({
  id: elementId(n),
  group: CASE
    WHEN 'Finding' IN labels(n) AND n.type = 'risk' THEN 'RiskFlag'
    WHEN 'Finding' IN labels(n) AND n.type = 'positive' THEN 'PositivePractice'
    ELSE labels(n)[0]
  END,
  name: coalesce(n.name, n.kq_name, n.qs_name, n.title, n.summary, n.description, 'Unknown'),
  properties: properties(n)
}) AS nodes, rawRels
UNWIND rawRels AS r
WITH DISTINCT r, nodes
WHERE r IS NOT NULL
WITH nodes, collect({
  source: elementId(startNode(r)),
  target: elementId(endNode(r)),
  label: type(r)
}) AS links
RETURN nodes, links
"""

        params = {
            "query_text": query_text,
            "query_vector": query_vector,
            "vector_index_name": settings.vector_index_name,
            "fulltext_index_name": settings.fulltext_index_name,
            "location_id": location_id or "all",
            "finding_type": finding_type,
            "candidate_k": settings.candidate_k,
            "top_k": settings.hybrid_top_k,
            "rrf_k": settings.rrf_k,
        }

        records, _, _ = await asyncio.to_thread(
            self.driver.execute_query,
            cypher,
            params,
            database_=settings.neo4j_database,
            routing_=RoutingControl.READ,
        )
        if not records:
            return [], []
        first = records[0]
        return first.get("nodes", []), first.get("links", [])

    async def _run_unconstrained_hybrid(
        self,
        query_text: str,
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        result = await asyncio.to_thread(
            self.hybrid_retriever.search,
            query_text=query_text,
            top_k=settings.hybrid_top_k,
            effective_search_ratio=3,
            ranker="linear",
            alpha=0.65,
        )

        nodes: List[Dict[str, Any]] = []
        links: List[Dict[str, Any]] = []

        if result and result.items:
            for item in result.items:
                content = item.content
                if isinstance(content, dict):
                    nodes.extend(content.get("nodes", []))
                    links.extend(content.get("links", []))

        return nodes, links


# -----------------------------------------------------------------------------
# FastAPI app
# -----------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    driver = neo4j.GraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_username, settings.neo4j_password),
    )
    gemini = GeminiService(
        api_key=settings.gemini_api_key,
        model=settings.gemini_model,
    )
    service = SearchService(driver=driver, gemini=gemini)

    app.state.driver = driver
    app.state.search_service = service
    logger.info("Application started")
    try:
        yield
    finally:
        await asyncio.to_thread(driver.close)
        logger.info("Application shut down")


app = FastAPI(title="CQC GraphRAG Semantic AI Engine", lifespan=lifespan)


@app.post("/search", response_model=SearchResponse)
async def search_endpoint(req: SearchRequest):
    query_text, location_id = normalize_query(req)
    if not query_text:
        raise HTTPException(status_code=400, detail="Query is required")

    logger.info("search query=%r location_id=%r", query_text, location_id)
    service: SearchService = app.state.search_service
    return await service.search(query_text=query_text, location_id=location_id)