import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const restateQueryUrl = process.env.RESTATE_ADMIN_URL 
    ? `${process.env.RESTATE_ADMIN_URL}/query` 
    : 'http://restate:9070/query';

  try {
    // Query Restate's internal system tables for active compliance workflows natively via HTTP DataFusion
    const response = await fetch(restateQueryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        query: `
          SELECT id, target_service_key, created_at, status 
          FROM sys_invocation 
          WHERE target_service_name = 'complianceFlowV2' 
        `
      }),
      // Reduce caching
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Restate HTTP Error: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Transform the result arrays for the UI
    const rowsArray = Array.isArray(result) ? result : (result.rows || []);
    
    // Deduplicate the system invocations so trailing Shared Handlers (like registerFollowUpAction) 
    // sharing the exact same Workflow Key do not duplicate rows in the Datafusion result!
    const uniqueKeys = new Set<string>();
    
    const activeWorkflows = rowsArray
      .filter((row: any) => {
        const key = row.target_service_key;
        if (uniqueKeys.has(key)) return false;
        uniqueKeys.add(key);
        return true;
      })
      .map((row: any) => {
        // Assuming target_service_key was formatted as: residentId-eventId-policyId
        const parts = row.target_service_key ? row.target_service_key.split('-') : []; 
        const residentId = parts[0] || 'Unknown';
        const policyId = parts.length > 2 ? parts.slice(2).join('-') : 'Unknown';
        
        return {
          invocationId: row.id,
          workflowKey: row.target_service_key,
          residentId,
          policyId,
          createdAt: row.created_at,
          status: row.status || 'unknown'
        };
      });

    return NextResponse.json({ activeWorkflows }, { status: 200 });
  } catch (error) {
    console.error("Restate HTTP Query API Error:", error);
    return NextResponse.json({ error: 'Failed to fetch Restate state via HTTP Query' }, { status: 500 });
  }
}
