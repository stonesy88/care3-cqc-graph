const neo4j = require('neo4j-driver');

const driver = neo4j.driver('bolt://neo4j:7687', neo4j.auth.basic('neo4j', 'password'));
const session = driver.session();

const locationId = '1-5645167996';
const cypher = `
      MATCH (loc:Location {location_id: $locationId})
      
      // True Graph (Metadata)
      OPTIONAL MATCH p_prov = (loc)-[:MANAGED_BY]->(prov:Provider)
      OPTIONAL MATCH p_spec = (loc)-[:HAS_SPECIALISM]->(spec:Specialism)
      OPTIONAL MATCH p_svc = (loc)-[:PROVIDES_SERVICE]->(svc:ServiceType)

      // Assessment Hierarchy
      OPTIONAL MATCH p_kq = (loc)-[:HAS_KQ_ASSESSMENT]->(kqa:KeyQuestionAssessment)
      OPTIONAL MATCH p_qs = (kqa)-[:HAS_QS_ASSESSMENT]->(qsa:QualityStatementAssessment)
      
      // The Graph Triangle: Direct Assessment Links
      OPTIONAL MATCH p_risk_direct = (qsa)-[:HAS_RISK_FLAG]->(risk:RiskFlag)
      OPTIONAL MATCH p_prac_direct = (qsa)-[:HAS_POSITIVE_PRACTICE]->(prac:PositivePractice)
      
      // The Graph Triangle: Audit Trail Links
      OPTIONAL MATCH p_ev = (qsa)-[:HAS_EVIDENCE]->(ev:Evidence)
      OPTIONAL MATCH p_risk_audit = (risk)-[:RISK_PROVENANCE]->(ev)
      OPTIONAL MATCH p_prac_audit = (prac)-[:PRACTICE_PROVENANCE]->(ev)
      
      // The Static Law Links
      OPTIONAL MATCH p_reg = (qsa)-[:MAPS_TO_REGULATION]->(reg:Regulation)

      // Dynamic Policy Compliance Integrations
      OPTIONAL MATCH p_breach = (loc)-[:GENERATED_BREACH]->(breach:PolicyBreach)
      OPTIONAL MATCH p_viol = (breach)-[:VIOLATES]->(pol:Policy)
      OPTIONAL MATCH p_breach_qs = (breach)-[:AFFECTS_OUTCOME]->(qsa_b:QualityStatementAssessment)
      OPTIONAL MATCH p_pol_qs = (pol)-[:AFFECTS_OUTCOME]->(qsa_p:QualityStatementAssessment)

      RETURN loc, p_prov, p_spec, p_svc, p_kq, p_qs, p_risk_direct, p_prac_direct, p_ev, p_risk_audit, p_prac_audit, p_reg, p_breach, p_viol, p_breach_qs, p_pol_qs LIMIT 10
`;

async function test() {
  const result = await session.run(cypher, { locationId });
  const nodesMap = new Map();

  const processNode = (node) => {
    if (!node) return;
    const elementId = node.elementId;
    if (nodesMap.has(elementId)) return;
    const rawLabel = node.labels[0];
    
    nodesMap.set(elementId, { label: rawLabel });
  };

  result.records.forEach(record => {
    const pathNames = ['p_breach', 'p_viol', 'p_breach_qs', 'p_pol_qs'];
    pathNames.forEach(pathName => {
      if (record.keys.includes(pathName)) {
        const currentPath = record.get(pathName);
        if (currentPath && currentPath.segments) {
          currentPath.segments.forEach(segment => {
            processNode(segment.start);
            processNode(segment.end);
          });
        }
      }
    });
  });

  console.log("Nodes captured:", Array.from(nodesMap.values()).map(n => n.label));
  await session.close();
  await driver.close();
}

test().catch(console.error);
