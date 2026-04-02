import { NextResponse } from 'next/server';
import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password')
);

export async function GET(req: Request, { params }: { params: Promise<{ locationId: string }> }) {
  const session = driver.session();

  try {
    const { locationId: resolvedLocationId } = await params;
    const locationId = resolvedLocationId || 'all';

    // Upgraded Cypher: Lightweight payload, fetching IDs instead of heavy text
    const result = await session.run(`
      MATCH (loc:Location)
      WHERE ($locationId = 'all' OR loc.location_id = $locationId)
      MATCH (loc)-[:HAS_KQ_ASSESSMENT]->(kq:KeyQuestionAssessment)
      MATCH (kq)-[:HAS_QS_ASSESSMENT]->(qs:QualityStatementAssessment)
      
      // Look for linked Risks and their exact evidence provenance
      OPTIONAL MATCH (qs)-[:HAS_FINDING]->(risk:Finding {type: 'risk'})
      OPTIONAL MATCH (qs)-[:HAS_EVIDENCE]->(evRisk:Evidence)<-[:FINDING_PROVENANCE]-(risk)
      
      // Look for linked Practices and their exact evidence provenance
      OPTIONAL MATCH (qs)-[:HAS_FINDING]->(prac:Finding {type: 'positive'})
      OPTIONAL MATCH (qs)-[:HAS_EVIDENCE]->(evPrac:Evidence)<-[:FINDING_PROVENANCE]-(prac)
      
      WITH risk, prac, kq, qs, evRisk, evPrac
      WHERE risk IS NOT NULL OR prac IS NOT NULL
      
      RETURN 
        collect(DISTINCT CASE WHEN risk IS NOT NULL THEN {
          id: coalesce(risk.risk_id, elementId(risk)), 
          description: risk.description, 
          qualityStatement: qs.qs_name, 
          pillar: kq.kq_name,
          evidence: evRisk.commentary
        } END) AS risks,
        collect(DISTINCT CASE WHEN prac IS NOT NULL THEN {
          id: coalesce(prac.practice_id, elementId(prac)), 
          description: prac.description, 
          qualityStatement: qs.qs_name, 
          pillar: kq.kq_name,
          evidence: evPrac.commentary
        } END) AS practices
    `, { locationId });

    const unifiedFeed: any[] = [];
    const seenIds = new Set<string>();

    result.records.forEach(record => {
      const risks = record.get('risks').filter((r: any) => r !== null);
      const practices = record.get('practices').filter((p: any) => p !== null);

      risks.forEach((r: any) => {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          unifiedFeed.push({
            type: 'risk',
            id: r.id,
            description: r.description,
            qualityStatement: r.qualityStatement,
            pillar: r.pillar,
            evidence: r.evidence
          });
        }
      });

      practices.forEach((p: any) => {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          unifiedFeed.push({
            type: 'practice',
            id: p.id,
            description: p.description,
            qualityStatement: p.qualityStatement,
            pillar: p.pillar,
            evidence: p.evidence
          });
        }
      });
    });

    return NextResponse.json(unifiedFeed);
  } catch (error) {
    console.error("Alerts API Error:", error);
    return NextResponse.json({ error: "Failed to fetch alerts." }, { status: 500 });
  } finally {
    await session.close();
  }
}