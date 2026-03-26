import dataclasses
import os
import uuid
import json
import aiohttp
from typing import AsyncIterator, NamedTuple, Any
from dotenv import load_dotenv
from aiolimiter import AsyncLimiter

import cocoindex
from cocoindex.op import (
    NON_EXISTENCE,
    SourceSpec,
    NO_ORDINAL,
    source_connector,
    PartialSourceRow,
    PartialSourceRowData,
)

# ==========================================
# 1. SETUP & STRICT AUTHORIZATION
# ==========================================
load_dotenv()

CQC_API_KEY = os.getenv("CQC_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
HF_TOKEN = os.getenv("HF_TOKEN")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://127.0.0.1:7687")

if not GEMINI_API_KEY or not HF_TOKEN:
    raise ValueError("CRITICAL: Missing GEMINI or HF API keys in .env file")

conn_spec = cocoindex.add_auth_entry(
    "Neo4jConnection",
    cocoindex.targets.Neo4jConnection(uri=NEO4J_URI, user="neo4j", password=NEO4J_PASSWORD),
)
GraphDbSpec = cocoindex.targets.Neo4j
cqc_rate_limiter = AsyncLimiter(1900, 60)


# ==========================================
# 2. SAF DATA MODELS & TRUE GRAPH MODELS
# ==========================================
QS_ID_TO_REGULATION = {
    '1': 17, '2': 12, '3': 13, '4': 12, '5': 15, '6': 18, '7': 12, '8': 12,
    '9': 9, '10': 9, '11': 12, '12': 14, '13': 17, '14': 11, '15': 10, '16': 10,
    '17': 9, '18': 9, '19': 18, '20': 9, '21': 9, '22': 9, '23': 16, '24': 9,
    '25': 9, '26': 9, '27': 17, '28': 5, '29': 20, '30': 17, '31': 17, '32': 17,
    '33': 17, '34': 15
}

@dataclasses.dataclass
class EvidenceItem:
    html_commentary: str
    evidence_id: str
    commentary_date: str

@dataclasses.dataclass
class QSAssessment:
    qs_asmt_id: str
    qs_id: str
    qs_name: str
    qs_score: int
    qs_score_description: str
    status: str
    evidence: list[EvidenceItem]

@dataclasses.dataclass
class KQAssessment:
    kq_asmt_id: str
    kq_name: str
    rating: str
    percentage_score: str
    commentary: str
    qs_assessments: list[QSAssessment]

@dataclasses.dataclass
class Specialism:
    name: str

@dataclasses.dataclass
class ServiceType:
    name: str
    description: str

@dataclasses.dataclass
class ExtractedFinding:
    description: str  # Kept clean. The text itself will act as the unique ID in the graph.

@dataclasses.dataclass
class CQCGraphExtraction:
    identified_risks: list[ExtractedFinding]
    positive_practices: list[ExtractedFinding]

class _CQCLocationKey(NamedTuple):
    target_id: str

@dataclasses.dataclass
class _CQCLocationValue:
    location_id: str
    name: str
    loc_type: str
    beds: int
    local_authority: str
    region: str
    postal_code: str
    provider_id: str             
    provider_name: str
    registration_status: str     
    phone: str                   
    website: str                 
    specialisms: list[Specialism]   
    service_types: list[ServiceType] 
    kq_assessments: list[KQAssessment] # Pre-parsed to prevent IPC 64KB limits


# ==========================================
# 3. SAF UNWRAPPER (Runs in Connector)
# ==========================================
def unwrap_saf_json(saf_json_str: str) -> list[KQAssessment]:
    assessments = json.loads(saf_json_str)
    if not assessments:
        return []
        
    kq_results = []
    asg_ratings = assessments[0].get("ratings", {}).get("asgRatings", [])
    
    for asg in asg_ratings:
        for kq in asg.get("keyQuestionRatings", []):
            kq_name = str(kq.get("name", "Unknown"))
            
            qs_results = []
            for topic in kq.get("topicareas", []):
                qs_id = topic.get("qualityStatementId")
                if not qs_id:
                    continue
                
                status = str(topic.get("status", "Unknown"))
                score_raw = str(topic.get("qualityStatementscore", "Not Scored"))
                qs_score = 0
                qs_score_description = ""
                if " - " in score_raw:
                    parts = score_raw.split(" - ", 1)
                    if parts[0].strip().isdigit():
                        qs_score = int(parts[0].strip())
                        qs_score_description = parts[1].strip()
                    else:
                        qs_score_description = score_raw
                else:
                    if score_raw.isdigit():
                        qs_score = int(score_raw)
                    else:
                        qs_score_description = score_raw
                        
                qs_name = topic.get("name", "Unknown")
                evidence_list = []
                
                if status.lower() != "not assessed":
                    for evidence in topic.get("evidenceCategory", []):
                        html = evidence.get("commentary")
                        if not html:
                            continue
                        clean_text = html.strip()
                        if not clean_text:
                            continue
                        ignore_phrases = ["not assessed", "no evidence", "n/a", "none", "reviewed"]
                        if clean_text.lower() in ignore_phrases:
                            continue
                        if len(clean_text) < 30:
                            continue

                        evidence_list.append(EvidenceItem(
                            html_commentary=clean_text, 
                            evidence_id=str(uuid.uuid4()),
                            commentary_date=str(evidence.get("commentaryDate", ""))
                        ))
                
                qs_results.append(QSAssessment(
                    qs_asmt_id=str(uuid.uuid4()),
                    qs_id=str(qs_id),
                    qs_name=qs_name,
                    qs_score=qs_score,
                    qs_score_description=qs_score_description,
                    status=status,
                    evidence=evidence_list
                ))
            
            kq_results.append(KQAssessment(
                kq_asmt_id=str(uuid.uuid4()),
                kq_name=kq_name,
                rating=str(kq.get("rating", "Unknown")),
                percentage_score=str(kq.get("percentageScore", "0")),
                commentary=str(kq.get("commentary", "")),
                qs_assessments=qs_results
            ))
                
    return kq_results


# ==========================================
# 4. CUSTOM ASYNC SOURCE CONNECTOR
# ==========================================
class CQCSource(SourceSpec):
    limit: int = 100
    page: int = 1
    care_home_only: bool = True

@source_connector(spec_cls=CQCSource, key_type=_CQCLocationKey, value_type=_CQCLocationValue)
class CQCConnector:
    _spec: CQCSource
    _session: aiohttp.ClientSession

    def __init__(self, spec: CQCSource, session: aiohttp.ClientSession):
        self._spec = spec
        self._session = session
        self._headers = {"Ocp-Apim-Subscription-Key": CQC_API_KEY, "Accept": "application/json"} if CQC_API_KEY else {}

    @staticmethod
    async def create(spec: CQCSource) -> "CQCConnector":
        return CQCConnector(spec, aiohttp.ClientSession())

    async def list(self) -> AsyncIterator[PartialSourceRow[_CQCLocationKey, _CQCLocationValue]]:
        known_saf_ids = ["1-5645167996"] 
        for idx, target_id in enumerate(known_saf_ids):
            yield PartialSourceRow(key=_CQCLocationKey(target_id=target_id), data=PartialSourceRowData(ordinal=idx))

    async def get_value(self, key: _CQCLocationKey) -> PartialSourceRowData[_CQCLocationValue]:
        url = f"https://api.service.cqc.org.uk/public/v1/locations/{key.target_id}"
        async with cqc_rate_limiter:
            print(f"Fetching JSON for {key.target_id}...")
            async with self._session.get(url, headers=self._headers) as response:
                if response.status != 200:
                    return PartialSourceRowData(value=NON_EXISTENCE, ordinal=NO_ORDINAL, content_version_fp=None)
                
                data = await response.json()
                if not data.get("assessment"):
                    print(f"Skipping {key.target_id}: Legacy report format detected.")
                    return PartialSourceRowData(value=NON_EXISTENCE, ordinal=NO_ORDINAL, content_version_fp=None)

                beds_raw = data.get("numberOfBeds")
                raw_specialisms = [Specialism(name=s.get("name", "Unknown")) for s in data.get("specialisms", [])]
                raw_services = [ServiceType(name=st.get("name", "Unknown"), description=st.get("description", "")) for st in data.get("gacServiceTypes", [])]

                provider_id = data.get("providerId", "Unknown")
                provider_name = "Unknown Provider"
                if provider_id and provider_id != "Unknown":
                    prov_url = f"https://api.service.cqc.org.uk/public/v1/providers/{provider_id}"
                    try:
                        async with self._session.get(prov_url, headers=self._headers) as prov_response:
                            if prov_response.status == 200:
                                prov_data = await prov_response.json()
                                provider_name = prov_data.get("name", "Unknown Provider")
                    except Exception as e:
                        print(f"Failed extracting provider data {provider_id}: {e}")

                raw_assessment_data = data.get("assessment", [])
                parsed_kqs = unwrap_saf_json(json.dumps(raw_assessment_data))

                val = _CQCLocationValue(
                    location_id=key.target_id,
                    name=data.get("name", "Unknown Location"),
                    loc_type=data.get("type", "Unknown"),
                    beds=int(beds_raw) if beds_raw is not None else 0,
                    local_authority=data.get("localAuthority", "Unknown"),
                    region=data.get("region", "Unknown"),
                    postal_code=data.get("postalCode", "Unknown"),
                    provider_id=provider_id,
                    provider_name=provider_name,
                    registration_status=data.get("registrationStatus", "Unknown"),
                    phone=data.get("mainPhoneNumber", "Unknown"),
                    website=data.get("website", "Unknown"),
                    specialisms=raw_specialisms,
                    service_types=raw_services,
                    kq_assessments=parsed_kqs
                )
                return PartialSourceRowData(value=val)

    def provides_ordinal(self) -> bool:
        return True


# ==========================================
# 5. UTILS FOR FLOW
# ==========================================
@cocoindex.op.function()
def get_reg_for_qs_id(qs_id: str) -> int:
    return QS_ID_TO_REGULATION.get(str(qs_id), 0)    


# ==========================================
# 6. THE DECLARATIVE GRAPH FLOW
# ==========================================
@cocoindex.flow_def(name="CQC_SAF_Graph_Flow")
def docs_to_kg_flow(flow_builder: cocoindex.FlowBuilder, data_scope: cocoindex.DataScope) -> None:
    
    data_scope["cqc_locations"] = flow_builder.add_source(CQCSource(limit=100, page=5, care_home_only=True))
    
    # Nodes
    location_node = data_scope.add_collector()
    provider_node = data_scope.add_collector()
    specialism_node = data_scope.add_collector()
    service_type_node = data_scope.add_collector()
    kq_asmt_node = data_scope.add_collector() 
    qs_asmt_node = data_scope.add_collector() 
    evidence_node = data_scope.add_collector()
    risk_node = data_scope.add_collector()
    practice_node = data_scope.add_collector()
    
    # Edges
    edge_loc_provider = data_scope.add_collector()
    edge_loc_spec = data_scope.add_collector()
    edge_loc_svc = data_scope.add_collector()
    edge_loc_kq_asmt = data_scope.add_collector()
    edge_kq_asmt_kq = data_scope.add_collector()
    edge_kq_asmt_qs = data_scope.add_collector()
    edge_qs_reg = data_scope.add_collector()
    edge_qs_evidence = data_scope.add_collector()
    edge_evidence_risk = data_scope.add_collector()
    edge_evidence_practice = data_scope.add_collector()
    edge_qs_risk = data_scope.add_collector()
    edge_qs_practice = data_scope.add_collector()

    with data_scope["cqc_locations"].row() as doc:
        
        location_node.collect(
            location_id=doc["location_id"], 
            name=doc["name"], 
            loc_type=doc["loc_type"],
            beds=doc["beds"], 
            local_authority=doc["local_authority"], 
            region=doc["region"], 
            postal_code=doc["postal_code"], 
            status=doc["registration_status"],
            phone=doc["phone"], 
            website=doc["website"]
        )

        provider_node.collect(provider_id=doc["provider_id"], name=doc["provider_name"])
        edge_loc_provider.collect(edge_id=cocoindex.GeneratedField.UUID, loc_id=doc["location_id"], prov_id=doc["provider_id"])
        
        with doc["specialisms"].row() as spec:
            specialism_node.collect(name=spec["name"])
            edge_loc_spec.collect(edge_id=cocoindex.GeneratedField.UUID, loc_id=doc["location_id"], spec_name=spec["name"])

        with doc["service_types"].row() as svc:
            service_type_node.collect(name=svc["name"], description=svc["description"])
            edge_loc_svc.collect(edge_id=cocoindex.GeneratedField.UUID, loc_id=doc["location_id"], svc_name=svc["name"])
        
        with doc["kq_assessments"].row() as kq_asmt:
            
            kq_asmt_node.collect(
                kq_asmt_id=kq_asmt["kq_asmt_id"],
                rating=kq_asmt["rating"],
                percentage_score=kq_asmt["percentage_score"],
                commentary=kq_asmt["commentary"],
                kq_name=kq_asmt["kq_name"]
            )
            
            edge_loc_kq_asmt.collect(edge_id=cocoindex.GeneratedField.UUID, loc_id=doc["location_id"], kq_asmt_id=kq_asmt["kq_asmt_id"])
            edge_kq_asmt_kq.collect(edge_id=cocoindex.GeneratedField.UUID, kq_asmt_id=kq_asmt["kq_asmt_id"], kq_name=kq_asmt["kq_name"])
            
            with kq_asmt["qs_assessments"].row() as qs_asmt:
                
                qs_asmt_node.collect(
                    qs_asmt_id=qs_asmt["qs_asmt_id"],
                    qs_score=qs_asmt["qs_score"],
                    qs_score_description=qs_asmt["qs_score_description"],
                    status=qs_asmt["status"],
                    qs_name=qs_asmt["qs_name"]
                )
                
                edge_kq_asmt_qs.collect(edge_id=cocoindex.GeneratedField.UUID, kq_asmt_id=kq_asmt["kq_asmt_id"], qs_asmt_id=qs_asmt["qs_asmt_id"])
                qs_asmt["mapped_reg_id"] = qs_asmt["qs_id"].transform(get_reg_for_qs_id)
                edge_qs_reg.collect(
                    edge_id=cocoindex.GeneratedField.UUID, 
                    qs_asmt_id=qs_asmt["qs_asmt_id"], 
                    reg_id=qs_asmt["mapped_reg_id"]
                )
                
                with qs_asmt["evidence"].row() as item:
                    
                    evidence_node.collect(ev_id=item["evidence_id"], raw_html=item["html_commentary"], commentary_date=item["commentary_date"])
                    edge_qs_evidence.collect(edge_id=cocoindex.GeneratedField.UUID, qs_asmt_id=qs_asmt["qs_asmt_id"], ev_id=item["evidence_id"])

                    item["extracted_data"] = item["html_commentary"].transform(
                        cocoindex.functions.ExtractByLlm(
                            llm_spec=cocoindex.LlmSpec(
                                api_type=cocoindex.LlmApiType.GEMINI, 
                                model="gemini-2.5-flash"  
                            ),
                            output_type=CQCGraphExtraction,
                            instruction=(
                                "You are an expert Care Quality Commission (CQC) compliance auditor. "
                                "Analyse this inspection commentary and extract two specific categories of findings:\n\n"
                                "1. IDENTIFIED RISKS: Extract explicit operational failures, safety hazards, regulatory breaches, or areas requiring improvement (e.g., 'Medicines were not stored securely.').\n"
                                "2. POSITIVE PRACTICES: Extract explicitly praised operations, effective systems, or areas of outstanding/good care (e.g., 'Staff utilised a highly effective digital auditing system.').\n\n"
                                "CRITICAL RULES:\n"
                                "- BE CONCISE: Each item MUST be a single, standalone sentence.\n"
                                "- NO PRONOUNS: Write for vector database search. Do not start sentences with 'They' or 'It'. Explicitly use nouns like 'The care home', 'Staff', or 'Management'.\n"
                                "- NO INFERENCE: Only extract findings explicitly stated in the text. Do not invent or infer risks.\n"
                                "- ALLOW EMPTY: If the text contains no definitive risks or positive practices, return empty lists."
                            )
                        )
                    )
                    
                    with item["extracted_data"]["identified_risks"].row() as risk:
                        risk["embedding"] = risk["description"].transform(
                            cocoindex.functions.SentenceTransformerEmbed(model="google/embeddinggemma-300m", args={"token": HF_TOKEN})
                        )
                        
                        # Node uses the description as the primary key for intelligent deduplication
                        risk_node.collect(
                            risk_id=risk["description"], 
                            description=risk["description"], 
                            embedding=risk["embedding"]
                        )
                        
                        # Edges rely on CocoIndex to auto-generate a deterministic ID
                        edge_evidence_risk.collect(
                            edge_id=cocoindex.GeneratedField.UUID, 
                            ev_id=item["evidence_id"], 
                            rsk_id=risk["description"]
                        )
                        edge_qs_risk.collect(
                            edge_id=cocoindex.GeneratedField.UUID, 
                            qs_asmt_id=qs_asmt["qs_asmt_id"], 
                            rsk_id=risk["description"]
                        )

                    with item["extracted_data"]["positive_practices"].row() as practice:
                        practice["embedding"] = practice["description"].transform(
                            cocoindex.functions.SentenceTransformerEmbed(model="google/embeddinggemma-300m", args={"token": HF_TOKEN})
                        )
                        
                        practice_node.collect(
                            practice_id=practice["description"], 
                            description=practice["description"], 
                            embedding=practice["embedding"]
                        )
                        
                        edge_evidence_practice.collect(
                            edge_id=cocoindex.GeneratedField.UUID, 
                            ev_id=item["evidence_id"], 
                            prac_id=practice["description"]
                        )
                        edge_qs_practice.collect(
                            edge_id=cocoindex.GeneratedField.UUID, 
                            qs_asmt_id=qs_asmt["qs_asmt_id"], 
                            prac_id=practice["description"]
                        )


    # ---------------------------------------------------------
    # 7. EXPORT CONFIGURATIONS
    # ---------------------------------------------------------
    print("Configuring Declarative Export Targets...")
    
    flow_builder.declare(cocoindex.targets.Neo4jDeclaration(connection=conn_spec, nodes_label="Regulation", primary_key_fields=["reg_id"]))
    flow_builder.declare(cocoindex.targets.Neo4jDeclaration(connection=conn_spec, nodes_label="KeyQuestion", primary_key_fields=["name"]))
    
    location_node.export(
        "exp_loc", 
        GraphDbSpec(
            connection=conn_spec, 
            mapping=cocoindex.targets.Nodes(label="Location")
        ), 
        primary_key_fields=["location_id"]
    )
    provider_node.export("exp_prov", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Nodes(label="Provider")), primary_key_fields=["provider_id"])
    specialism_node.export("exp_spec", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Nodes(label="Specialism")), primary_key_fields=["name"])
    service_type_node.export("exp_svc", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Nodes(label="ServiceType")), primary_key_fields=["name"])
    
    kq_asmt_node.export("exp_kq_asmt", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Nodes(label="KeyQuestionAssessment")), primary_key_fields=["kq_asmt_id"])
    qs_asmt_node.export("exp_qs", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Nodes(label="QualityStatementAssessment")), primary_key_fields=["qs_asmt_id"])
    evidence_node.export("exp_ev", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Nodes(label="Evidence")), primary_key_fields=["ev_id"])
    
    # Risk and Practice primary keys are now the 'risk_id' (description text)
    risk_node.export("exp_risk", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Nodes(label="RiskFlag")), primary_key_fields=["risk_id"])
    practice_node.export("exp_prac", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Nodes(label="PositivePractice")), primary_key_fields=["practice_id"])

    edge_loc_provider.export("exp_loc_prov", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Relationships(rel_type="MANAGED_BY", source=cocoindex.targets.NodeFromFields("Location", [cocoindex.targets.TargetFieldMapping("loc_id", "location_id")]), target=cocoindex.targets.NodeFromFields("Provider", [cocoindex.targets.TargetFieldMapping("prov_id", "provider_id")]))), primary_key_fields=["edge_id"])
    edge_loc_spec.export("exp_loc_spec", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Relationships(rel_type="HAS_SPECIALISM", source=cocoindex.targets.NodeFromFields("Location", [cocoindex.targets.TargetFieldMapping("loc_id", "location_id")]), target=cocoindex.targets.NodeFromFields("Specialism", [cocoindex.targets.TargetFieldMapping("spec_name", "name")]))), primary_key_fields=["edge_id"])
    edge_loc_svc.export("exp_loc_svc", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Relationships(rel_type="PROVIDES_SERVICE", source=cocoindex.targets.NodeFromFields("Location", [cocoindex.targets.TargetFieldMapping("loc_id", "location_id")]), target=cocoindex.targets.NodeFromFields("ServiceType", [cocoindex.targets.TargetFieldMapping("svc_name", "name")]))), primary_key_fields=["edge_id"])

    edge_loc_kq_asmt.export("exp_loc_kq_asmt", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Relationships(rel_type="HAS_KQ_ASSESSMENT", source=cocoindex.targets.NodeFromFields("Location", [cocoindex.targets.TargetFieldMapping("loc_id", "location_id")]), target=cocoindex.targets.NodeFromFields("KeyQuestionAssessment", [cocoindex.targets.TargetFieldMapping("kq_asmt_id", "kq_asmt_id")]))), primary_key_fields=["edge_id"])
    edge_kq_asmt_kq.export("exp_kq_asmt_kq", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Relationships(rel_type="SCORES_ON_KQ", source=cocoindex.targets.NodeFromFields("KeyQuestionAssessment", [cocoindex.targets.TargetFieldMapping("kq_asmt_id", "kq_asmt_id")]), target=cocoindex.targets.NodeFromFields("KeyQuestion", [cocoindex.targets.TargetFieldMapping("kq_name", "name")]))), primary_key_fields=["edge_id"])
    edge_kq_asmt_qs.export("exp_kq_qs", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Relationships(rel_type="HAS_QS_ASSESSMENT", source=cocoindex.targets.NodeFromFields("KeyQuestionAssessment", [cocoindex.targets.TargetFieldMapping("kq_asmt_id", "kq_asmt_id")]), target=cocoindex.targets.NodeFromFields("QualityStatementAssessment", [cocoindex.targets.TargetFieldMapping("qs_asmt_id", "qs_asmt_id")]))), primary_key_fields=["edge_id"])
    edge_qs_reg.export(
        "exp_qs_reg", 
        GraphDbSpec(
            connection=conn_spec, 
            mapping=cocoindex.targets.Relationships(
                rel_type="MAPS_TO_REGULATION", 
                source=cocoindex.targets.NodeFromFields("QualityStatementAssessment", [
                    cocoindex.targets.TargetFieldMapping(source="qs_asmt_id", target="qs_asmt_id")
                ]), 
                target=cocoindex.targets.NodeFromFields("Regulation", [
                    cocoindex.targets.TargetFieldMapping(source="reg_id", target="reg_id")
                ])
            )
        ), 
        primary_key_fields=["edge_id"]
    )
    
    edge_qs_evidence.export("exp_qs_ev", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Relationships(rel_type="HAS_EVIDENCE", source=cocoindex.targets.NodeFromFields("QualityStatementAssessment", [cocoindex.targets.TargetFieldMapping("qs_asmt_id", "qs_asmt_id")]), target=cocoindex.targets.NodeFromFields("Evidence", [cocoindex.targets.TargetFieldMapping("ev_id", "ev_id")]))), primary_key_fields=["edge_id"])
    
    edge_evidence_risk.export("exp_ev_risk", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Relationships(rel_type="RISK_PROVENANCE", source=cocoindex.targets.NodeFromFields("RiskFlag", [cocoindex.targets.TargetFieldMapping("rsk_id", "risk_id")]), target=cocoindex.targets.NodeFromFields("Evidence", [cocoindex.targets.TargetFieldMapping("ev_id", "ev_id")]))), primary_key_fields=["edge_id"])
    edge_evidence_practice.export("exp_ev_prac", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Relationships(rel_type="PRACTICE_PROVENANCE", source=cocoindex.targets.NodeFromFields("PositivePractice", [cocoindex.targets.TargetFieldMapping("prac_id", "practice_id")]), target=cocoindex.targets.NodeFromFields("Evidence", [cocoindex.targets.TargetFieldMapping("ev_id", "ev_id")]))), primary_key_fields=["edge_id"])
    
    # Dynamic Assessment Exports
    edge_qs_risk.export("exp_qs_risk", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Relationships(rel_type="HAS_RISK_FLAG", source=cocoindex.targets.NodeFromFields("QualityStatementAssessment", [cocoindex.targets.TargetFieldMapping("qs_asmt_id", "qs_asmt_id")]), target=cocoindex.targets.NodeFromFields("RiskFlag", [cocoindex.targets.TargetFieldMapping("rsk_id", "risk_id")]))), primary_key_fields=["edge_id"])
    edge_qs_practice.export("exp_qs_prac", GraphDbSpec(connection=conn_spec, mapping=cocoindex.targets.Relationships(rel_type="HAS_POSITIVE_PRACTICE", source=cocoindex.targets.NodeFromFields("QualityStatementAssessment", [cocoindex.targets.TargetFieldMapping("qs_asmt_id", "qs_asmt_id")]), target=cocoindex.targets.NodeFromFields("PositivePractice", [cocoindex.targets.TargetFieldMapping("prac_id", "practice_id")]))), primary_key_fields=["edge_id"])


# ==========================================
# 8. INITIALIZATION
# ==========================================
if __name__ == "__main__":
    print("Initializing CQC Source Connector...")
    docs_to_kg_flow.setup()
    
    print("ETL Update triggered.")
    docs_to_kg_flow.update()