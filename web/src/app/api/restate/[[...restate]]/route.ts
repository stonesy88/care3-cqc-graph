import { endpoint } from "@restatedev/restate-sdk/fetch";
import { complianceFlowV2 } from "@/app/restate/workflows/complianceWorkflow";

const handler = endpoint().bind(complianceFlowV2).handler();

export const dynamic = 'force-dynamic';

export const GET = (req: Request) => handler.fetch(req);
export const POST = (req: Request) => handler.fetch(req);
