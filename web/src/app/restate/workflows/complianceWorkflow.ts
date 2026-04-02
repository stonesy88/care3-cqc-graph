import * as restate from "@restatedev/restate-sdk";
import { TimeoutError } from "@restatedev/restate-sdk";
import neo4j, { Driver } from "neo4j-driver";

// Lazy initialize Neo4j so Next.js build doesn't crash on undefined vars
let driver: Driver | null = null;
function getDriver() {
  if (!driver) {
    driver = neo4j.driver(
      process.env.NEO4J_URI || 'neo4j://localhost:7687',
      neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password'),
      { disableLosslessIntegers: true }
    );
  }
  return driver;
}

interface PolicyStep {
  stepType: string;
  expectedActionType: string; // e.g., 'OBS_NEURO'
  slaMinutes: number;
  notifyRoles: string[];
}

interface WorkflowParams {
  residentId: string;
  locationId: string;
  eventId: string;
  policyId: string;
  policyName: string;
  qsIds: string[];
  steps: PolicyStep[];
}

export const complianceFlowV2 = restate.workflow({
  name: "complianceFlowV2",
  handlers: {

    // 1. THE MAIN ENGINE
    run: async (ctx: restate.WorkflowContext, params: WorkflowParams) => {

      // Loop through the sequential SLA steps we fetched from PostgreSQL
      for (const step of params.steps) {

        // Evaluate exactly when this step started deterministically so Restate doesn't crash on replays!
        const stepStartTime = await ctx.run(`get-start-time-${step.expectedActionType}`, () => Date.now());

        // Inside the run loop:
        await ctx.set("workflowState", {
          currentStep: step.expectedActionType,
          expiresAt: stepStartTime + (step.slaMinutes * 60000),
          totalSteps: params.steps.length,
          stepIndex: params.steps.indexOf(step) + 1,
          steps: params.steps
        });

        // Create a unique identifier for the specific event we are waiting for
        const eventKey = `${params.residentId}-${step.expectedActionType}`;

        ctx.set(`status_${step.expectedActionType}`, 'Awaiting Action');

        // THE MAGIC: Native Restate explicit race execution exposing the primitives cleanly to the Journal!
        // We MUST use `restate.RestatePromise.race` instead of native JS `Promise.race` to prevent 
        // 570 Invariance Violations and 598 State Machine Closed errors during suspending replays!
        const volatileRaceOutcome = await restate.RestatePromise.race([
          ctx.promise<string>(eventKey).get(),
          ctx.sleep(step.slaMinutes * 1000)
        ]);

        const actualWinner = volatileRaceOutcome === undefined ? 'timeout' : 'completed';

        if (actualWinner === 'timeout') {
          // Scenario C: SLA Breached, Incomplete
          // The timer expired, but we still strictly require the action to be completed eventually!
          ctx.set(`status_${step.expectedActionType}`, 'SLA Breached - Awaiting Action');

          // Log the Breach natively into the Neo4j CQC Graph Database dynamically spanning Docker clusters!
          await ctx.run(`generate-cqc-risk-node-${step.expectedActionType}`, async () => {
            const session = getDriver().session();
            try {
              await session.run(`
                  // 1. Find the Location
                  MATCH (loc:Location {location_id: $locationId})
                  
                  // 2. Safely Upsert the specific Policy Node exclusively based on policy_id
                  MERGE (p:Policy {policy_id: $policyId})
                  ON CREATE SET p.name = $policyName
                  
                  // 3. MERGE the unique Policy Breach node for this specific workflow instance
                  MERGE (pb:PolicyBreach { workflow_instance_id: $workflowInstance })
                  ON CREATE SET 
                    pb.resident_id = $residentId, 
                    pb.policy_name = $policyName, 
                    pb.created_at = datetime(),
                    pb.status = 'OPEN',
                    pb.severity = 'HIGH'
                  
                  // 4. Link the Location uniquely to the Breach
                  MERGE (loc)-[:GENERATED_BREACH]->(pb)
                  
                  // 5. CREATE exactly one edge explicitly mapping the Branch directly to the Policy ID
                  CREATE (pb)-[v:VIOLATES { 
                    step_name: $expectedAction, 
                    sla_minutes: $slaMinutes,
                    timestamp: datetime() 
                  }]->(p)
                  
                  // 6. Link Policy to QualityStatementAssessment natively using the array of mapped qsIds
                  WITH p, loc
                  UNWIND $qsIds AS targetQsId
                  MATCH (loc)-[:HAS_KQ_ASSESSMENT]->()-[:HAS_QS_ASSESSMENT]->(qs:QualityStatementAssessment {qs_id: targetQsId})
                  MERGE (p)-[:GOVERNS]->(qs)
                `, {
                slaMinutes: step.slaMinutes,
                residentId: params.residentId,
                locationId: params.locationId,
                expectedAction: step.expectedActionType,
                policyId: params.policyId,
                policyName: params.policyName,
                workflowInstance: ctx.key,
                qsIds: params.qsIds ? params.qsIds.map(String) : []
              });
            } finally {
              await session.close();
            }
          });

          // If SLA breaches, we immediately transition to the next compliance sequence to ensure
          // the system continues recording subsequent infractions uninterrupted!
          ctx.set(`status_${step.expectedActionType}`, 'SLA Breached - Awaiting Action');
          continue; // Skip the RESOLVED_LATE wait cycle completely to let downstream SLAs fail cleanly!
        } else {
          // Scenario A: SLA Met perfectly!
          ctx.set(`status_${step.expectedActionType}`, 'Completed (SLA Met)');
        }
      }

      return { status: "Workflow Completed" };
    },

    // 2. THE SIGNAL RECEIVER
    // Our Next.js webhook calls this when a follow-up event arrives from Nourish/PCS/ShadowTraffic
    registerFollowUpAction: async (
      ctx: restate.WorkflowSharedContext,
      event: { residentId: string; actionId: string; timestamp: string }
    ) => {
      const eventKey = `${event.residentId}-${event.actionId}`;

      // Resolve the promise! If the \`run\` handler is currently waiting for this key, 
      // it instantly wakes up and clears the timeout.
      await ctx.promise<string>(eventKey).resolve(event.timestamp);
    },

    getGranularState: async (ctx: restate.WorkflowSharedContext) => {
      // Shared handlers can be called concurrently without interrupting the sleeping workflow
      const state = await ctx.get<any>("workflowState");
      if (!state) return { status: "Not Started or Completed" };

      const stepStatuses = [];
      if (state.steps) {
        for (const step of state.steps) {
          const status = await ctx.get(`status_${step.expectedActionType}`);
          stepStatuses.push({
            step: step.expectedActionType,
            status: status || 'Pending'
          });
        }
      }

      return { ...state, stepStatuses };
    }
  }
});
