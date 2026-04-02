import { NextResponse } from 'next/server';
import * as clients from '@restatedev/restate-sdk-clients';
import { complianceFlowV2 } from '../../../restate/workflows/complianceWorkflow';

const restate = clients.connect({ url: process.env.RESTATE_URL || 'http://restate:8080' });

export async function GET(req: Request, { params }: { params: Promise<{ workflowKey: string }> }) {
  try {
    const { workflowKey } = await params;
    // Call the Shared Handler on the specific Workflow instance
    const granularState = await restate
      .workflowClient(complianceFlowV2, workflowKey)
      .getGranularState();

    return NextResponse.json(granularState, { status: 200 });
  } catch (error) {
    console.error("Restate Shared Handler Error:", error);
    return NextResponse.json({ error: 'Failed to fetch granular state' }, { status: 500 });
  }
}
