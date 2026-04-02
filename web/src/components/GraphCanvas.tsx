"use client";

import { useEffect, useRef, useState, useMemo } from 'react';
import { Plus, Minus, Target, Type, Eye, EyeOff } from 'lucide-react'; // Removed FileText
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => <div className="text-slate-400 dark:text-[#5a5b60] animate-pulse font-medium">Loading Graph Engine...</div>
});

const NODE_COLORS: Record<string, string> = {
  'Location': '#3b82f6', // Blue 500
  'Key Question': '#6366f1', // Indigo 500
  'Quality Statement': '#a855f7', // Purple 500
  'Evidence': '#64748b', // Slate 500
  'Framework QS': '#a855f7', // Purple 500
  'Regulation': '#f59e0b', // Amber 500
  'Identified Risk': '#f97316', // Orange 500
  'Positive Practice': '#14b8a6', // Teal 500
  'Provider': '#0284c7', // Sky 600
  'Specialism': '#0d9488', // Teal 600
  'Service Type': '#0891b2', // Cyan 600
  'Policy Breach': '#e11d48', // Rose 600
  'Policy': '#10b981' // Emerald 500
};

export default function GraphCanvas({
  locationId,
  isSidebarOpen,
  selectedAlertId,
  focusedNodeId,
  isDarkMode,
  filterType,
  onNodeSelect,
  searchResultNodes,
  searchResultLinks
}: {
  locationId: string | null,
  isSidebarOpen: boolean,
  selectedAlertId: string | null,
  focusedNodeId?: string | null,
  isDarkMode: boolean,
  filterType?: 'all' | 'risk' | 'practice',
  onNodeSelect?: (node: any) => void,
  searchResultNodes?: any[] | null,
  searchResultLinks?: any[] | null
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const initialCenterDone = useRef(false);

  const [data, setData] = useState<{ nodes: any[], links: any[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [showLabels, setShowLabels] = useState(false);

  const displayData = useMemo(() => {
    const activeData = (searchResultNodes && searchResultLinks)
      ? { nodes: searchResultNodes, links: searchResultLinks }
      : data;

    if (!activeData || activeData.nodes.length === 0) return { nodes: [], links: [] };

    // Strict structural layout filtering only applies to Search toggles (practice vs risk globally)!
    if (!filterType || filterType === 'all') return activeData;

    const getId = (nodeOrId: any) => typeof nodeOrId === 'object' ? nodeOrId.id : nodeOrId;
    const filteredNodes = activeData.nodes.filter((n: any) => {
      if (filterType === 'risk' && n.group === 'Positive Practice') return false;
      if (filterType === 'practice' && n.group === 'Identified Risk') return false;
      return true;
    });
    
    const validNodeIds = new Set(filteredNodes.map((n: any) => n.id));
    const filteredLinks = activeData.links.filter((l: any) => {
      const sourceId = getId(l.source);
      const targetId = getId(l.target);
      return validNodeIds.has(sourceId) && validNodeIds.has(targetId);
    });
    
    return { nodes: filteredNodes, links: filteredLinks };
  }, [data, filterType, searchResultNodes, searchResultLinks]);

  const cleanedGraphData = useMemo(() => {
    if (!displayData || !displayData.nodes || !displayData.links) {
      return { nodes: [], links: [] };
    }

    let currentNodes = displayData.nodes;
    let currentLinks = displayData.links;

    const validIds = new Set(currentNodes.map((n: any) => n.id));
    currentLinks = currentLinks.filter((l: any) => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      return validIds.has(sourceId) && validIds.has(targetId);
    });

    return {
      nodes: currentNodes,
      links: currentLinks
    };
  }, [displayData]);

  // Compute Active Highlight Scope (Bridging natively both Hover Focus AND Sidebar Inspect Alerts!)
  const activeFocusId = focusedNodeId || selectedAlertId;

  const focusedNeighbors = useMemo(() => {
    if (!activeFocusId) return new Set<string>();
    const neighbors = new Set<string>();
    
    const targetNode = cleanedGraphData.nodes.find((n: any) => n.id === activeFocusId || n.customId === activeFocusId);
    if (!targetNode) return neighbors;
    
    neighbors.add(targetNode.id);
    
    // Natively trace 1-degree associations highlighting structural provenance!
    cleanedGraphData.links.forEach((l: any) => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      if (sourceId === targetNode.id) neighbors.add(targetId);
      if (targetId === targetNode.id) neighbors.add(sourceId);
    });
    return neighbors;
  }, [activeFocusId, cleanedGraphData]);

  useEffect(() => {
    // Isolated Camera Zoom Engine cleanly sweeping to active components seamlessly
    if (activeFocusId && graphRef.current && cleanedGraphData.nodes.length > 0) {
      const targetNode = cleanedGraphData.nodes.find((n: any) => n.id === activeFocusId || n.customId === activeFocusId);
      if (targetNode) {
        // Evaluate physics offset seamlessly using local matrix states safely
        setTimeout(() => {
            graphRef.current?.centerAt(targetNode.x, targetNode.y, 1000);
            graphRef.current?.zoom(5, 1000);
        }, 100);
        
        // Sync Sidebar actions natively broadcasting directly onto the Canvas UI Panel
        if (activeFocusId && onNodeSelect) {
            const enriched = enrichNode(targetNode);
            onNodeSelect(enriched);
        }
      }
    } else if (!activeFocusId && graphRef.current && initialCenterDone.current) {
        graphRef.current?.zoomToFit(800, 50);
        if (onNodeSelect) onNodeSelect(null);
    }
  }, [activeFocusId, cleanedGraphData.nodes, selectedAlertId]);

  const enrichNode = (node: any) => {
    const getId = (n: any) => typeof n === 'object' ? n.id : n;
    let enrichedNode = { ...node };

    if (['Evidence', 'Identified Risk', 'Positive Practice'].includes(node.group)) {
      const relatedReports = new Set<string>();
      const relatedQS = new Set<string>();
      const relatedRegs = new Set<string>();
      const relatedEvidenceMap = new Map<string, any>();
      const relatedRisks = new Set<string>();
      const relatedPractices = new Set<string>();
      const relatedLocations = new Set<string>();
      const visited = new Set<string>();
      visited.add(node.id);

      const walkConnections = (startId: string, depth: number) => {
        if (depth > 4) return;
        const neighbors = displayData.links
          .filter((l: any) => getId(l.source) === startId || getId(l.target) === startId)
          .map((l: any) => getId(l.source) === startId ? getId(l.target) : getId(l.source))
          .filter((id: string) => !visited.has(id));

        neighbors.forEach((neighborId: string) => {
          visited.add(neighborId);
          const neighbor = displayData.nodes.find((n: any) => n.id === neighborId);
          if (!neighbor) return;

          const neighborProps = neighbor.rawProperties || neighbor.properties || {};
          
          // Strict depth==1 enforcement prevents structural bleeding into sibling assessments!
          if (neighbor.group === 'Evidence' && depth === 1) {
            relatedEvidenceMap.set(neighbor.id, {
              id: neighbor.id,
              raw_html: neighborProps.raw_html || neighbor.name,
              commentary_date: neighborProps.commentary_date || 'Unknown Date'
            });
          }
          if ((neighbor.group === 'Identified Risk' || neighbor.group === 'RiskFlag') && depth === 1) {
            relatedRisks.add(neighborProps.name || neighborProps.description || neighborProps.title || neighbor.name || neighbor.id);
          }
          if (neighbor.group === 'Positive Practice' && depth === 1) {
            relatedPractices.add(neighborProps.name || neighborProps.description || neighborProps.title || neighbor.name || neighbor.id);
          }
          
          if (neighbor.group === 'Quality Statement' || neighbor.group === 'Framework QS') relatedQS.add(neighbor.name || neighbor.id);
          if (neighbor.group === 'Regulation') relatedRegs.add(neighbor.name || neighbor.id);
          if (neighbor.group === 'Location') relatedLocations.add(neighbor.name || neighbor.id);

          walkConnections(neighborId, depth + 1);
        });
      };

      walkConnections(node.id, 1);

      enrichedNode.reports = Array.from(relatedReports);
      enrichedNode.evidenceSnippets = Array.from(relatedEvidenceMap.values());
      enrichedNode.relatedRisks = Array.from(relatedRisks);
      enrichedNode.relatedPractices = Array.from(relatedPractices);
      enrichedNode.qualityStatements = Array.from(relatedQS);
      enrichedNode.regulations = Array.from(relatedRegs);
      enrichedNode.locationContext = Array.from(relatedLocations)[0] || null;
    }
    return enrichedNode;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setLoading(true);
    initialCenterDone.current = false; // Add this line to force graph re-centering on new fetch
    
    fetch(`/api/graph/${locationId}`)
      .then(res => res.json())
      .then(resData => {
        setData(resData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch graph data", err);
        setLoading(false);
      });
  }, [locationId]);

  useEffect(() => {
    if (!loading && graphRef.current) {
      // 1. Separate clustering by increasing D3 negative electrostatic charge
      const chargeForce = graphRef.current.d3Force('charge');
      if (chargeForce) chargeForce.strength(-250);

      // 2. Lengthen the baseline springs holding edges natively
      const linkForce = graphRef.current.d3Force('link');
      if (linkForce) linkForce.distance(50);

      // 3. Command the physics engine to smoothly expand
      graphRef.current.d3ReheatSimulation();
    }
  }, [loading, cleanedGraphData]);

  return (
    <div ref={containerRef} className="flex-1 h-full w-full relative overflow-hidden bg-slate-50 dark:bg-[#0c0e12] min-w-0 transition-colors duration-300">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="text-slate-400 dark:text-[#5a5b60] animate-pulse font-medium">Rendering compliance graph...</div>
        </div>
      )}

      {!loading && dimensions.width > 0 && (
        <ForceGraph2D
          ref={graphRef}
          graphData={cleanedGraphData}
          width={dimensions.width}
          height={dimensions.height}
          nodeLabel="name"
          nodeColor={(node: any) => {
            const baseColor = NODE_COLORS[node.group] || '#94a3b8';
            if (focusedNodeId && !focusedNeighbors.has(node.id)) {
              return isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
            }
            return baseColor;
          }}
          linkCanvasObjectMode={() => showLabels ? 'after' : undefined}
          linkCanvasObject={showLabels ? (link: any, ctx: any, globalScale: number) => {
            const label = link.label;
            if (!label || typeof link.source !== 'object' || typeof link.target !== 'object') return;

            const start = link.source;
            const end = link.target;
            const x = start.x + (end.x - start.x) / 2;
            const y = start.y + (end.y - start.y) / 2;

            const fontSize = Math.max(8 / globalScale, 1.5);
            ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;

            const textWidth = ctx.measureText(label).width;
            const padding = fontSize * 0.4;
            const bgWidth = textWidth + padding * 2;
            const bgHeight = fontSize + padding * 2;

            ctx.fillStyle = isDarkMode ? 'rgba(15, 23, 42, 0.85)' : 'rgba(240, 240, 246, 0.85)';
            ctx.beginPath();
            ctx.roundRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight, fontSize * 0.5);
            ctx.fill();

            ctx.fillStyle = isDarkMode ? 'rgba(148, 163, 184, 0.9)' : 'rgba(100, 116, 139, 0.9)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, x, y);
          } : undefined}
          linkColor={(link: any) => {
            const label = link.label || link.type;
            if (label === 'DRIVES_ADHERENCE' || label === 'Drives Adherence') {
              return isDarkMode ? "rgba(16, 185, 129, 0.7)" : "rgba(16, 185, 129, 0.5)"; // Emerald solid/green
            }
            if (label === 'BREACHES_QS_STATEMENT' || label === 'Breaches QS') {
              return isDarkMode ? "rgba(244, 63, 94, 0.95)" : "rgba(244, 63, 94, 0.85)"; // Visually distinct solid Rose Red!
            }
            if (focusedNodeId) {
              const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
              const targetId = typeof link.target === 'object' ? link.target.id : link.target;
              if (focusedNeighbors.has(sourceId) && focusedNeighbors.has(targetId)) {
                 return isDarkMode ? "rgba(255, 255, 255, 0.4)" : "rgba(100, 116, 139, 0.6)";
              }
              return isDarkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(100, 116, 139, 0.05)";
            }
            return isDarkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(100, 116, 139, 0.25)";
          }}
          linkLineDash={(link: any) => {
            const label = link.label || link.type;
            if (label === 'BREACHES_QS_STATEMENT' || label === 'Breaches QS') return [5, 5]; // Draw rigid dashed failure path boundaries!
            return null;
          }}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          linkLabel="label"
          cooldownTicks={100}
          onEngineStop={() => {
            if (!initialCenterDone.current && graphRef.current) {
              setTimeout(() => graphRef.current?.zoomToFit(400, 50), 100);
              initialCenterDone.current = true;
            }
          }}
          onNodeClick={(node: any) => {
            const enrichedNode = enrichNode(node);
            graphRef.current?.centerAt(node.x, node.y, 1000);
            graphRef.current?.zoom(5, 2000);
            if (onNodeSelect) onNodeSelect(enrichedNode);
          }}
          onNodeHover={(node: any) => {
            if (containerRef.current) containerRef.current.style.cursor = node ? 'pointer' : 'default';
          }}
        />
      )}

      {!loading && (
        <>
          <div className={`absolute bottom-6 z-20 pointer-events-auto bg-white/90 dark:bg-[#1a1c23]/90 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] rounded-3xl px-6 py-4 flex flex-row flex-wrap items-center gap-y-3 gap-x-5 transition-all duration-300 ${isSidebarOpen ? 'left-[440px]' : 'left-6'} max-w-[calc(100vw-340px)] sm:max-w-[calc(100vw-480px)]`}>
            <ul className="flex flex-row flex-wrap items-center gap-y-3 gap-x-5 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS['Location'] }}></span> Location</li>
              <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS['Key Question'] }}></span> Key Question</li>
              <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS['Quality Statement'] }}></span> Quality Statement</li>
              <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS['Regulation'] }}></span> Regulation</li>
              <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS['Evidence'] }}></span> Evidence</li>
              <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS['Identified Risk'] }}></span> Risk</li>
              <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS['Positive Practice'] }}></span> Positive Practice</li>
              <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS['Policy Breach'] }}></span> Policy Breach</li>
              <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS['Policy'] }}></span> Policy</li>
            </ul>
          </div>

          <div className="absolute bottom-8 right-8 flex flex-col justify-end items-end pointer-events-auto z-50">
            <div className="bg-white/70 dark:bg-[#1a1c23]/80 backdrop-blur-2xl border border-white/20 dark:border-white/5 bg-gradient-to-br from-[#0058bb]/5 dark:from-[#0058bb]/20 to-white/80 dark:to-[#1a1c23]/90 p-3 rounded-[2rem] flex flex-col gap-3 shadow-[0_20px_50px_rgba(0,88,187,0.08)] dark:shadow-none mb-6 transition-colors duration-300">
              <button aria-label="Toggle Labels" onClick={() => setShowLabels(!showLabels)} className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors active:scale-95 ${showLabels ? 'bg-[#0058bb] text-white dark:bg-[#4b8eff] dark:text-black shadow-md' : 'hover:bg-[#dbdde3]/50 dark:hover:bg-white/10 text-[#2d2f33] dark:text-slate-300'}`}>
                {showLabels ? <Eye strokeWidth={2.5} size={20} /> : <EyeOff strokeWidth={2.5} size={20} />}
              </button>
              <div className="h-[1px] bg-white/50 dark:bg-white/10 mx-3 relative transition-colors duration-300"></div>

              <button aria-label="Zoom In" onClick={() => graphRef.current?.zoom(graphRef.current.zoom() * 1.5, 400)} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-[#dbdde3]/50 dark:hover:bg-white/10 transition-colors text-[#2d2f33] dark:text-slate-300">
                <Plus strokeWidth={2.5} size={20} />
              </button>
              <div className="h-[1px] bg-white/50 dark:bg-white/10 mx-3 relative transition-colors duration-300"></div>

              <button aria-label="Zoom Out" onClick={() => graphRef.current?.zoom(graphRef.current.zoom() / 1.5, 400)} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-[#dbdde3]/50 dark:hover:bg-white/10 transition-colors text-[#2d2f33] dark:text-slate-300">
                <Minus strokeWidth={2.5} size={20} />
              </button>
            </div>
            <button aria-label="Center Focus" onClick={() => graphRef.current?.zoomToFit(400, 50)} className="w-[4.5rem] h-[4.5rem] bg-white/70 dark:bg-[#1a1c23]/80 backdrop-blur-2xl border border-white/20 dark:border-white/5 shadow-[0_20px_50px_rgba(0,88,187,0.08)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] rounded-full flex items-center justify-center hover:bg-white/90 dark:hover:bg-[#252830] transition-all text-[#2d2f33] dark:text-slate-300 hover:scale-105 active:scale-95">
              <Target strokeWidth={2.5} size={24} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}