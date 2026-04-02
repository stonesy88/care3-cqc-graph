import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Destructure the exact payload coming from our frontend component
    const { 
      policy_id,
      policy_name, 
      trigger_event_id, 
      qs_ids, 
      is_active, 
      steps 
    } = body;

    // 2. Basic validation
    if (!policy_name || !trigger_event_id || !steps || !Array.isArray(qs_ids)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 3. Upsert the Policy!
    let newPolicy;
    if (policy_id) {
      newPolicy = await prisma.policy.update({
        where: { id: policy_id },
        data: {
          name: policy_name,
          triggerEventId: trigger_event_id,
          isActive: is_active,
          steps: steps,
          qsIds: qs_ids
        }
      });
    } else {
      newPolicy = await prisma.policy.create({
        data: {
          name: policy_name,
          triggerEventId: trigger_event_id,
          isActive: is_active,
          steps: steps,
          qsIds: qs_ids
        }
      });
    }

    // 4. INSTANT NEO4J GRAPH SYNCHRONIZATION
    // Build the native Policy Node and structural mapping directly into the Knowledge Graph instantly!
    const CQC_QUALITY_STATEMENTS: Record<string, string> = {
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
    
    const mappedQsNames = qs_ids.map((id: string) => CQC_QUALITY_STATEMENTS[id]).filter(Boolean);

    const { driver } = await import('@/lib/neo4j');
    const session = driver.session();
    try {
      await session.run(`
        // Safely generate the Policy Node with the exact configuration properties
        MERGE (p:Policy {policy_id: $policyId})
        ON CREATE SET p.name = $policyName, p.isActive = $isActive, p.createdAt = datetime()
        ON MATCH SET p.name = $policyName, p.isActive = $isActive
        
        // Persist the specific IDs onto the Node property natively!
        SET p.qs_ids = $qsIds
        
        // Clear old edges gracefully ensuring amendments don't accumulate obsolete bindings!
        WITH p
        OPTIONAL MATCH (p)-[r:DRIVES_ADHERENCE]->(old:QualityStatementAssessment)
        DELETE r
        
        // Construct the explicit architectural Graph Edges dynamically matching all structural Assessments using the mapped standard schema names
        WITH p
        UNWIND $qsNames AS qsName
        MATCH (qsa:QualityStatementAssessment {qs_name: qsName})
        MERGE (p)-[:DRIVES_ADHERENCE]->(qsa)
      `, {
        policyId: newPolicy.id,
        policyName: newPolicy.name,
        isActive: newPolicy.isActive,
        qsIds: qs_ids, // Neo4j ids are strings ('1', '34')
        qsNames: mappedQsNames
      });
    } catch (graphError) {
      console.error("Non-fatal Neo4j Graph API Exception rendering Policy constraints:", graphError);
    } finally {
      await session.close();
    }

    return NextResponse.json({ success: true, policy: newPolicy }, { status: 201 });

  } catch (error) {
    console.error('Error creating policy:', error);
    return NextResponse.json({ error: 'Failed to create policy' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const policies = await prisma.policy.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ policies }, { status: 200 });
  } catch (error) {
    console.error('Error fetching policies:', error);
    return NextResponse.json({ error: 'Failed to fetch policies' }, { status: 500 });
  }
}
