import React from 'react';
import { Sparkles, AlertTriangle, CheckCircle, Search, Loader2 } from 'lucide-react';

interface SearchResultsSidebarProps {
  answer?: string;
  nodes: any[];
  isLoading: boolean;
  loadingStep: string | null;
  onNodeClick: (nodeId: string) => void;
  focusedNodeId: string | null;
}

export default function SearchResultsSidebar({
  answer,
  nodes,
  isLoading,
  loadingStep,
  onNodeClick,
  focusedNodeId
}: SearchResultsSidebarProps) {
  
  const primaryFindings = nodes?.filter(
    (n) => n.group === 'Identified Risk' || n.group === 'Positive Practice' || n.group === 'RiskFlag' || n.group === 'PositivePractice'
  ) || [];

  return (
    <div className="w-[400px] h-full bg-white/95 dark:bg-[#1a1c23]/95 backdrop-blur-3xl border-r border-slate-200 dark:border-white/10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.4)] flex flex-col z-30 transition-all transform pointer-events-auto">
      
      {/* Generative Answer Header */}
      <div className="p-6 border-b border-slate-200 dark:border-white/10 shrink-0 bg-slate-50/50 dark:bg-[#13141a]/50">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#0058bb] dark:text-[#4b8eff] flex items-center gap-2 mb-3">
          <Sparkles size={16} /> Answers Engine
        </h2>
        
        {isLoading ? (
          <div className="flex flex-col gap-3 py-4">
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 font-medium">
              <Loader2 className="animate-spin" size={18} />
              <span className="animate-pulse">{loadingStep || "Searching..."}</span>
            </div>
          </div>
        ) : (
          <div className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-200 font-medium">
            {answer ? answer : "No generative summary available."}
          </div>
        )}
      </div>

      {/* Primary Findings Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-transparent">
        {isLoading ? null : primaryFindings.length > 0 ? (
          <div className="flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 sticky top-0 bg-white/90 dark:bg-[#1a1c23]/90 backdrop-blur-md z-10 shrink-0">
               <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                 <Search size={14} /> Supporting Evidence ({primaryFindings.length})
               </h3>
            </div>
            
            <div className="flex flex-col p-4 gap-3">
              {primaryFindings.map((node, i) => {
                const isRisk = node.group === 'Identified Risk' || node.group === 'RiskFlag';
                const isActive = focusedNodeId === node.id || focusedNodeId === node.customId;
                
                return (
                  <button
                    key={`${node.id}-${i}`}
                    onClick={() => onNodeClick(node.id || node.customId)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-300 group
                      ${isActive 
                        ? (isRisk 
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)] ring-1 ring-red-400/50' 
                            : 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-green-400/50')
                        : 'bg-white dark:bg-[#252830] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-md'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 shrink-0 p-1.5 rounded-full ${isRisk ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                        {isRisk ? <AlertTriangle size={14} strokeWidth={2.5} /> : <CheckCircle size={14} strokeWidth={2.5} />}
                      </div>
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${isRisk ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {isRisk ? 'Identified Risk' : 'Positive Practice'}
                        </span>
                        <h4 className={`text-sm font-semibold truncate ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'}`}>
                          {node.name || "Evidence Node"}
                        </h4>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
           <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
             No direct primary findings (Risks or Practices) surfaced for this query.
           </div>
        )}
      </div>
    </div>
  );
}
