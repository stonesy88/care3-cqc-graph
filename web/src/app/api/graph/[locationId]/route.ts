import { NextResponse } from 'next/server';
import { driver } from '@/lib/neo4j';

export const dynamic = 'force-dynamic';

const NODE_LABELS: Record<string, string> = {
  Location: "Location",
  KeyQuestionAssessment: "Key Question",
  QualityStatementAssessment: "Quality Statement",
  Evidence: "Evidence",
  RiskFlag: "Identified Risk",
  PositivePractice: "Positive Practice",
  QualityStatement: "Framework QS",
  Regulation: "Regulation",
  Provider: "Provider",
  Specialism: "Specialism",
  ServiceType: "Service Type",
  PolicyBreach: "Policy Breach",
  Policy: "Policy"
};

const REL_LABELS: Record<string, string> = {
  HAS_KQ_ASSESSMENT: "Scored On",
  HAS_QS_ASSESSMENT: "Assessed On",
  HAS_EVIDENCE: "Backed By",
  HAS_FINDING: "Finding",
  FINDING_PROVENANCE: "Sourced From",
  RISK_RELATES_TO: "Violates",
  PRACTICE_RELATES_TO: "Exemplifies",
  MAPS_TO_REGULATION: "Enforces",
  MANAGED_BY: "Managed By",
  HAS_SPECIALISM: "Specialises In",
  PROVIDES_SERVICE: "Provides",
  GENERATED_BREACH: "Generated Breach",
  VIOLATES: "Violates Policy",
  AFFECTS_OUTCOME: "Affects Outcome",
  DRIVES_ADHERENCE: "Drives Adherence",
  BREACHES_QS_STATEMENT: "Breaches QS"
};

const GROUP_COLORS: Record<string, string> = {
  Location: "#3b82f6", // Blue 500
  KeyQuestionAssessment: "#6366f1", // Indigo 500
  QualityStatementAssessment: "#a855f7", // Purple 500
  Evidence: "#64748b", // Slate 500
  RiskFlag: "#f97316", // Orange 500
  PositivePractice: "#14b8a6", // Teal 500
  QualityStatement: "#a855f7", // Purple 500
  Regulation: "#f59e0b", // Amber 500
  Provider: "#0284c7", // Sky 600
  Specialism: "#0d9488", // Teal 600
  ServiceType: "#0891b2", // Cyan 600
  PolicyBreach: "#e11d48", // Rose 600
  Policy: "#10b981" // Emerald 500
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locationId: string }> }
) {
  const session = driver.session();
  try {
    const { locationId } = await params;

    if (!locationId || locationId === 'all') {
      return NextResponse.json({ error: "Specific Location ID required for structural queries" }, { status: 400 });
    }

    const queryParams = { locationId };

    const cypher = `
      MATCH (loc:Location {location_id: $locationId})
      
      CALL {
        WITH loc
        OPTIONAL MATCH p_meta = (loc)-[:MANAGED_BY|HAS_SPECIALISM|PROVIDES_SERVICE]->()
        RETURN collect(p_meta) AS meta_paths
      }
      
      CALL {
        WITH loc
        OPTIONAL MATCH p_asmt = (loc)-[:HAS_KQ_ASSESSMENT]->(kqa)-[:HAS_QS_ASSESSMENT]->(qsa)
        RETURN collect(p_asmt) AS asmt_paths
      }
      
      CALL {
        WITH loc
        OPTIONAL MATCH p_risk = (loc)-[:HAS_KQ_ASSESSMENT]->()-[:HAS_QS_ASSESSMENT]->(qsa)-[:HAS_FINDING]->(risk:Finding {type: 'risk'})-[:FINDING_PROVENANCE]->(ev)<-[:HAS_EVIDENCE]-(qsa)
        RETURN collect(p_risk) AS risk_paths
      }
      
      CALL {
        WITH loc
        OPTIONAL MATCH p_prac = (loc)-[:HAS_KQ_ASSESSMENT]->()-[:HAS_QS_ASSESSMENT]->(qsa)-[:HAS_FINDING]->(prac:Finding {type: 'positive'})-[:FINDING_PROVENANCE]->(ev)<-[:HAS_EVIDENCE]-(qsa)
        RETURN collect(p_prac) AS prac_paths
      }
      
      CALL {
        WITH loc
        OPTIONAL MATCH p_reg = (loc)-[:HAS_KQ_ASSESSMENT]->()-[:HAS_QS_ASSESSMENT]->(qsa)-[:MAPS_TO_REGULATION]->(reg)
        RETURN collect(p_reg) AS reg_paths
      }
      
      CALL {
        WITH loc
        OPTIONAL MATCH p_breach = (loc)-[:GENERATED_BREACH]->(breach:PolicyBreach)
        RETURN collect(p_breach) AS breach_paths
      }
      
      CALL {
        WITH loc
        OPTIONAL MATCH p_viol = (loc)-[:GENERATED_BREACH]->(breach)-[:VIOLATES]->(p:Policy)
        RETURN collect(p_viol) AS viol_paths
      }
      
      CALL {
        WITH loc
        OPTIONAL MATCH p_adherence = (loc)-[:HAS_KQ_ASSESSMENT]->()-[:HAS_QS_ASSESSMENT]->(qsa)<-[:DRIVES_ADHERENCE]-(pol:Policy)
        RETURN collect(p_adherence) AS adherence_paths
      }

      RETURN loc, meta_paths, asmt_paths, risk_paths, prac_paths, reg_paths, breach_paths, viol_paths, adherence_paths
    `;

    const result = await session.run(cypher, queryParams);

    const nodesMap = new Map();
    const linksMap = new Map();

    const processNode = (node: any) => {
      if (!node) return;

      const elementId = node.elementId;
      if (nodesMap.has(elementId)) return;

      let rawLabel = node.labels[0];
      if (rawLabel === 'Finding') {
         rawLabel = node.properties?.type === 'risk' ? 'RiskFlag' : 'PositivePractice';
      }
      const friendlyLabel = NODE_LABELS[rawLabel] || rawLabel;

      let name = friendlyLabel;
      if (rawLabel === 'Location') name = node.properties.name || node.properties.location_id;
      else if (rawLabel === 'KeyQuestionAssessment') name = node.properties.kq_name;
      else if (rawLabel === 'QualityStatementAssessment') name = node.properties.qs_name;
      else if (rawLabel === 'QualityStatement') name = node.properties.name;
      else if (rawLabel === 'Regulation') name = node.properties.name;
      else if (rawLabel === 'Provider' || rawLabel === 'Specialism' || rawLabel === 'ServiceType') name = node.properties.name;
      else if (rawLabel === 'Policy') name = node.properties.name;
      else if (rawLabel === 'PolicyBreach') name = `Breach: ${node.properties.policy_name || 'Workflow Timeout'}`;
      else if (rawLabel === 'RiskFlag' || rawLabel === 'PositivePractice') {
        name = (node.properties.description || "Finding...").substring(0, 50) + "...";
      }
      else if (rawLabel === 'Evidence') name = "Evidence Chunk";

      const customPropId = node.properties.location_id ||
        node.properties.kq_asmt_id ||
        node.properties.qs_asmt_id ||
        node.properties.ev_id ||
        node.properties.risk_id ||
        node.properties.practice_id ||
        node.properties.cqc_id ||
        node.properties.workflow_instance_id ||
        node.properties.policy_id ||
        elementId;

      nodesMap.set(elementId, {
        id: elementId,
        customId: customPropId,
        name,
        group: friendlyLabel,
        color: GROUP_COLORS[rawLabel] || "#94a3b8",
        val: rawLabel === 'Location' ? 25 : (rawLabel === 'KeyQuestionAssessment' ? 18 : 10),
        rawProperties: node.properties
      });
    };

    const processPathList = (pathsList: any[]) => {
      if (!pathsList) return;
      pathsList.forEach(path => {
        if (!path) return;
        path.segments.forEach((segment: any) => {
          processNode(segment.start);
          processNode(segment.end);

          const type = segment.relationship.type;
          let customLabel = REL_LABELS[type] || type;
          
          if (type === 'VIOLATES' && segment.relationship.properties?.step_name) {
            customLabel = `${customLabel} (${segment.relationship.properties.step_name})`;
          }

          const relId = segment.relationship.elementId;
          if (!linksMap.has(relId)) {
            linksMap.set(relId, {
              source: segment.relationship.startNodeElementId || segment.relationship.start,
              target: segment.relationship.endNodeElementId || segment.relationship.end,
              type: type,
              label: customLabel
            });
          }
        });
      });
    };

    result.records.forEach((record: any) => {
      processNode(record.get('loc'));
      processPathList(record.get('meta_paths'));
      processPathList(record.get('asmt_paths'));
      processPathList(record.get('risk_paths'));
      processPathList(record.get('prac_paths'));
      processPathList(record.get('reg_paths'));
      processPathList(record.get('breach_paths'));
      processPathList(record.get('viol_paths'));
      processPathList(record.get('adherence_paths'));
    });

    const nodesRes = Array.from(nodesMap.values());
    console.log("SERVER LOG - Nodes mapped:", nodesRes.length, "Policy:", nodesRes.filter(n => n.group === 'Policy').length, "Breaches:", nodesRes.filter(n => n.group === 'Policy Breach').length);

    return NextResponse.json({
      nodes: nodesRes,
      links: Array.from(linksMap.values())
    });

  } catch (error) {
    console.error("Error fetching graph data:", error);
    return NextResponse.json({ error: "Failed to fetch graph data" }, { status: 500 });
  } finally {
    await session.close();
  }
}