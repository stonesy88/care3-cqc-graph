import { PrismaClient } from '@prisma/client';
import neo4j from 'neo4j-driver';
const prisma = new PrismaClient();

const driver = neo4j.driver(
  'bolt://neo4j:7687',
  neo4j.auth.basic('neo4j', 'password'),
  { disableLosslessIntegers: true }
);

const CQC_QUALITY_STATEMENTS = {
  '1': 'Learning culture', '2': 'Safe systems, pathways and transitions',
  '3': 'Safeguarding', '4': 'Involving people to manage risks', '5': 'Safe environments',
  '6': 'Safe and effective staffing', '7': 'Infection prevention and control',
  '8': 'Medicines optimisation', '9': 'Assessing needs',
  '10': 'Delivering evidence-based care and treatment',
  '11': 'How staff, teams and services work together',
  '12': 'Supporting people to live healthier lives',
  '13': 'Monitoring and improving outcomes', '14': 'Consent to care and treatment',
  '15': 'Kindness, compassion and dignity', '16': 'Treating people as individuals',
  '17': 'Independence, choice and control', '18': 'Responding to people’s immediate needs',
  '19': 'Workforce wellbeing and enablement', '20': 'Person-centred Care',
  '21': 'Care provision, Integration and continuity', '22': 'Providing Information',
  '23': 'Listening to and involving people', '24': 'Equity in access',
  '25': 'Equity in experiences and outcomes', '26': 'Planning for the future',
  '27': 'Shared direction and culture', '28': 'Capable, compassionate and inclusive leaders',
  '29': 'Freedom to speak up', '30': 'Workforce equality, diversity and inclusion',
  '31': 'Governance, management and sustainability', '32': 'Partnerships and communities',
  '33': 'Learning, improvement and innovation', '34': 'Environmental sustainability - sustainable development'
};

async function run() {
  const policies = await prisma.policy.findMany();
  console.log(`Found ${policies.length} policies to backfill...`);

  const session = driver.session();
  let createdCount = 0;
  
  for (const policy of policies) {
    const qsNames = policy.qsIds.map(id => CQC_QUALITY_STATEMENTS[id]).filter(Boolean);
    if (!qsNames.length) continue;
    
    try {
      const result = await session.run(`
        MATCH (p:Policy {policy_id: $pid})
        UNWIND $qsNames AS qsName
        MATCH (qsa:QualityStatementAssessment {qs_name: qsName})
        MERGE (p)-[r:DRIVES_ADHERENCE]->(qsa)
        RETURN count(r) AS edges
      `, {
        pid: policy.id,
        qsNames: qsNames
      });
      createdCount += result.records[0].get('edges');
    } catch (e) {
      console.error(e);
    }
  }
  
  console.log(`Successfully mapped and backfilled ${createdCount} DRIVES_ADHERENCE edges!`);
  await session.close();
  await driver.close();
}
run();
