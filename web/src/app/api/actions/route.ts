import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as clients from '@restatedev/restate-sdk-clients';
import { complianceFlowV2 } from '../../restate/workflows/complianceWorkflow';

const prisma = new PrismaClient();
const restate = clients.connect({ url: process.env.RESTATE_URL || 'http://restate:8080' });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('Incoming Action Payload:', body);
    const { residentId, eventId, actionId } = body;

    if (!residentId || !eventId || !actionId) {
      return NextResponse.json({ error: 'Missing residentId, eventId, or actionId' }, { status: 400 });
    }

    // Lookup the active policy id to reconstruct the exact workflow instance key
    const policies = await prisma.policy.findMany({
      where: { triggerEventId: eventId, isActive: true }
    });

    if (policies.length === 0) {
      return NextResponse.json({ message: 'No active policies configured' }, { status: 200 });
    }

    const dispatched = [];
    for (const policy of policies) {
      const restateKey = `${residentId}-${eventId}-${policy.id}`;
      
      try {
        // Find the active workflow and register the follow up action natively bypassing HTTP bridging restrictions!
        await restate.workflowClient(complianceFlowV2, restateKey).registerFollowUpAction({
          residentId,
          actionId,
          timestamp: new Date().toISOString()
        });
        dispatched.push({ policyName: policy.name, restateKey, actionId });
      } catch (e: any) {
        console.error(`Failed to register action for ${restateKey}:`, e);
      }
    }

    return NextResponse.json({ success: true, dispatched }, { status: 200 });
  } catch (error) {
    console.error("Action Endpoint Error:", error);
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
  }
}
