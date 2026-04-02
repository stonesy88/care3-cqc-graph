import "dotenv/config";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STATEMENTS = [
  { id: '1', name: 'Learning culture' },
  { id: '2', name: 'Safe systems, pathways and transitions' },
  { id: '3', name: 'Safeguarding' },
  { id: '4', name: 'Involving people to manage risks' },
  { id: '5', name: 'Safe environments' },
  { id: '6', name: 'Safe and effective staffing' },
  { id: '7', name: 'Infection prevention and control' },
  { id: '8', name: 'Medicines optimisation' },
  { id: '9', name: 'Assessing needs' },
  { id: '10', name: 'Delivering evidence-based care and treatment' },
  { id: '11', name: 'How staff, teams and services work together' },
  { id: '12', name: 'Supporting people to live healthier lives' },
  { id: '13', name: 'Monitoring and improving outcomes' },
  { id: '14', name: 'Consent to care and treatment' },
  { id: '15', name: 'Kindness, compassion and dignity' },
  { id: '16', name: 'Treating people as individuals' },
  { id: '17', name: 'Independence, choice and control' },
  { id: '18', name: 'Responding to people’s immediate needs' },
  { id: '19', name: 'Workforce wellbeing and enablement' },
  { id: '20', name: 'Person-centred Care' },
  { id: '21', name: 'Care provision, Integration and continuity' },
  { id: '22', name: 'Providing Information' },
  { id: '23', name: 'Listening to and involving people' },
  { id: '24', name: 'Equity in access' },
  { id: '25', name: 'Equity in experiences and outcomes' },
  { id: '26', name: 'Planning for the future' },
  { id: '27', name: 'Shared direction and culture' },
  { id: '28', name: 'Capable, compassionate and inclusive leaders' },
  { id: '29', name: 'Freedom to speak up' },
  { id: '30', name: 'Workforce equality, diversity and inclusion' },
  { id: '31', name: 'Governance, management and sustainability' },
  { id: '32', name: 'Partnerships and communities' },
  { id: '33', name: 'Learning, improvement and innovation' },
  { id: '34', name: 'Environmental sustainability - sustainable development' }
];

async function seed() {
  console.log("Starting DB seed...");
  for (const s of STATEMENTS) {
    await prisma.keyStatementAssessment.upsert({
      where: { id: s.id },
      update: { name: s.name, statementRef: `QS-${s.id}` },
      create: { id: s.id, name: s.name, statementRef: `QS-${s.id}` }
    });
  }
  console.log(`Seeded ${STATEMENTS.length} exactly matched Quality Statements natively.`);
}

seed().catch(console.error).finally(() => prisma.$disconnect());
