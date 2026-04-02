import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { residentId, locationId, eventId } = await req.json();

    if (!residentId || !locationId || !eventId) {
      return NextResponse.json({ error: 'Missing required fields: residentId, locationId, eventId' }, { status: 400 });
    }

    // Find all active policies that match this event trigger, including their exact Quality Statement linkages natively
    const policies = await prisma.policy.findMany({
      where: {
        triggerEventId: eventId,
        isActive: true
      }
    });

    if (policies.length === 0) {
      return NextResponse.json({ message: 'No active policies configured for this event type.' }, { status: 200 });
    }

    // Trigger Restate for each policy securely spanning internal Docker bridging
    const dispatched = [];
    for (const policy of policies) {
      const restateKey = `${residentId}-${eventId}-${policy.id}`;
      
      const payload = {
        residentId,
        locationId,
        eventId,
        policyId: policy.id,
        policyName: policy.name,
        qsIds: policy.qsIds || [], // Pass the exact database IDs directly
        steps: (policy.steps as any[]).map(s => ({
          stepType: s.step_order ? `STEP_${s.step_order}` : 'DEFAULT',
          expectedActionType: s.expected_action_id,
          slaMinutes: s.max_delay_minutes,
          notifyRoles: []
        }))
      };

      const restateUri = `http://restate:8080/complianceFlowV2/${restateKey}/run/send`;

      try {
        const response = await fetch(restateUri, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          dispatched.push(policy.name);
        } else {
          console.error("Restate Ingress rejected workflow for policy:", policy.name, await response.text());
        }
      } catch (err) {
        console.error("Restate network timeout firing workflow for policy:", policy.name, err);
      }
    }

    return NextResponse.json({ success: true, dispatchedPolicies: dispatched }, { status: 200 });

  } catch (error) {
    console.error('Error processing trigger event:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
