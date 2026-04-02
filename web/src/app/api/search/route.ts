import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const t0 = performance.now();
  try {
    const body = await req.json();

    const { query, searchQuery, locationId, selectedLocation } = body;
    const finalQuery = query || searchQuery;
    const finalLocationId = locationId || selectedLocation || 'all';

    if (!finalQuery) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    console.log(`[Next.js Proxy] Forwarding query: "${finalQuery}" for Location: ${finalLocationId}`);

    // Offload Semantic & Structural intelligence securely to the Python AI Microservice!
    const aiEngineUrl = process.env.PYTHON_AI_ENGINE_URL || 'http://neo4j-grag:8000/search';
    
    const response = await fetch(aiEngineUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: finalQuery,
        locationId: finalLocationId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Next.js Proxy Error]:", errorText);
      throw new Error(`Python AI Engine failed with status ${response.status}`);
    }

    const data = await response.json();
    
    const NODE_LABELS: Record<string, string> = {
      Location: "Location",
      KeyQuestionAssessment: "Key Question",
      QualityStatementAssessment: "Quality Statement",
      Evidence: "Evidence",
      RiskFlag: "Identified Risk",
      PositivePractice: "Positive Practice",
      QualityStatement: "Framework QS",
      Regulation: "Regulation",
      Provider: "Provider",
      Specialism: "Specialism",
      ServiceType: "Service Type",
      PolicyBreach: "Policy Breach",
      Policy: "Policy",
      Finding: "Identified Intelligence"
    };

    const LINK_LABELS: Record<string, string> = {
      HAS_KQ_ASSESSMENT: "Scored On",
      HAS_QS_ASSESSMENT: "Assessed On",
      HAS_EVIDENCE: "Backed By",
      HAS_FINDING: "Finding",
      FINDING_PROVENANCE: "Sourced From",
      RISK_RELATES_TO: "Violates",
      PRACTICE_RELATES_TO: "Exemplifies",
      MAPS_TO_REGULATION: "Enforces",
      MANAGED_BY: "Managed By",
      HAS_SPECIALISM: "Specialises In",
      PROVIDES_SERVICE: "Provides",
      GENERATED_BREACH: "Generated Breach",
      VIOLATES: "Violates Policy",
      AFFECTS_OUTCOME: "Affects Outcome",
      DRIVES_ADHERENCE: "Drives Adherence",
      BREACHES_QS_STATEMENT: "Breaches QS"
    };

    // Format nodes explicitly replacing raw schema labels into UI-friendly groups
    const formattedNodes = (data.nodes || []).map((node: any) => {
      // Re-map Finding explicitly back to Risk/Practice properties if retained in properties
      let rawGroup = node.group;
      if (rawGroup === 'Finding') {
         if (node.properties?.type === 'risk') {
            rawGroup = 'RiskFlag';
         } else if (node.properties?.type === 'positive') {
            rawGroup = 'PositivePractice';
         }
      }
      return {
        ...node,
        group: NODE_LABELS[rawGroup] || rawGroup
      };
    });

    // Format links replacing raw neo4j edge names with conversational bindings
    const formattedLinks = (data.links || []).map((link: any) => ({
      ...link,
      label: LINK_LABELS[link.label] || link.label
    }));

    // Natively return exactly the identical mapped JSON Graph shape the React UI expects!
    return NextResponse.json({
      answer: data.answer || "No response received.",
      nodes: formattedNodes,
      links: formattedLinks,
      debug: {
        totalExecutionMs: performance.now() - t0,
        pythonServiceLatency: true
      }
    });

  } catch (error) {
    console.error("API Gateway Proxy Error:", error);
    return NextResponse.json({ error: "Failed to resolve downstream graph search." }, { status: 500 });
  }
}