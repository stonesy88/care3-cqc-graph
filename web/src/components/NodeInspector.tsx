import { X, CheckCircle, AlertTriangle, AlertCircle, Waypoints, MapPin, Search, ChevronRight, FileText, Scale, PlusCircle, Building, Stethoscope, BriefcaseMedical, Star } from "lucide-react";

interface NodeInspectorProps {
  isOpen: boolean;
  nodeData: any;
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  'Identified Risk': 'bg-red-500/10 text-red-400 border-red-500/20',
  'Positive Practice': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Framework QS': 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/20',
  'Regulation': 'bg-pink-500/10 text-pink-500 dark:text-pink-400 border-pink-500/20',
  'Evidence': 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20',
  'Location': 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20',
  'Provider': 'bg-sky-500/10 text-sky-500 dark:text-sky-400 border-sky-500/20',
  'Key Question': 'bg-purple-500/10 text-purple-500 dark:text-purple-400 border-purple-500/20',
  'Quality Statement': 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border-indigo-500/20',
  'Specialism': 'bg-teal-500/10 text-teal-500 dark:text-teal-400 border-teal-500/20',
  'Service Type': 'bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 border-cyan-500/20',
  'default': 'bg-slate-100/50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
};

export default function NodeInspector({ isOpen, nodeData, onClose }: NodeInspectorProps) {
  if (!nodeData) return null;

  const group = nodeData.group;
  const props = nodeData.properties || nodeData.rawProperties || {};

  const isRisk = group === "Identified Risk";
  const isPractice = group === "Positive Practice";
  const isAssessment = group === "Quality Statement" || group === "Key Question";

  const getIcon = () => {
    if (isRisk) return <AlertTriangle size={14} />;
    if (isPractice) return <CheckCircle size={14} />;
    if (group === "Framework QS" || group === "Quality Statement") return <AlertCircle size={14} />;
    if (group === "Key Question") return <Star size={14} />;
    if (group === "Location") return <MapPin size={14} />;
    if (group === "Provider") return <Building size={14} />;
    if (group === "Specialism") return <Stethoscope size={14} />;
    if (group === "Service Type") return <BriefcaseMedical size={14} />;
    if (group === "Regulation") return <Scale size={14} />;
    if (group === "Evidence") return <FileText size={14} />;
    return <Waypoints size={14} />;
  };

  // Dynamic Title Rendering based on Node Type
  const getTitle = () => {
    if (group === "Location") return props.name;
    if (group === "Key Question") return props.kq_name;
    if (group === "Quality Statement") return props.qs_name;
    if (group === "Framework QS") return props.name;
    if (group === "Regulation") return props.name;
    if (group === "Provider" || group === "Specialism" || group === "Service Type") return props.name;
    if (isRisk || isPractice) return "Identified Intelligence";
    if (group === "Evidence") return "Audit Trail Extract";
    return "Node Data";
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/10 dark:bg-black/20 z-[90] lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-[88px] right-0 h-[calc(100vh-88px)] w-full lg:w-[400px] z-[100] transform transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col bg-white/95 dark:bg-[#1a1c23]/95 backdrop-blur-3xl border-l border-slate-200 dark:border-white/10 shadow-2xl dark:shadow-[0_0_50px_rgba(0,0,0,0.6)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          <div className={`flex items-center justify-between p-6 border-b sticky top-0 backdrop-blur-xl z-20 transition-colors duration-300 ${TYPE_COLORS[group] || TYPE_COLORS.default}`}>
            <div className="flex items-center gap-3">
              <span className="font-bold tracking-wider uppercase flex items-center gap-2">
                {getIcon()}
                {group}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <div className="p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
                {getTitle()}
              </h3>
              {nodeData?.locationContext && group !== 'Location' && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0058bb] dark:text-[#4b8eff] bg-[#0058bb]/5 dark:bg-[#4b8eff]/10 self-start px-2.5 py-1 rounded-md border border-[#0058bb]/10 dark:border-[#4b8eff]/20">
                  <MapPin size={12} className="shrink-0" />
                  <span className="truncate max-w-[280px]">{nodeData.locationContext}</span>
                </div>
              )}

              {/* Main Content Area (Risk/Practice Descriptions or Raw Evidence Text) */}
              {(props.description || props.raw_html || props.commentary || props.qs_score_description) && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#13141a] border border-slate-100 dark:border-white/5 shadow-inner flex flex-col gap-3">
                  
                  {group === 'Evidence' && props.commentary_date && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold w-fit">
                      <Waypoints size={12} />
                      {props.commentary_date}
                    </div>
                  )}

                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar whitespace-pre-line">
                    {props.raw_html || props.description || props.qs_score_description || props.commentary}
                  </p>
                  
                  {group === 'Quality Statement' && props.commentary && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar whitespace-pre-line border-t border-slate-200 dark:border-slate-800 pt-3 mt-1">
                      <span className="font-semibold block mb-1">Additional Commentary:</span>
                      {props.commentary}
                    </p>
                  )}
                </div>
              )}

              {/* Assessment Score Block */}
              {isAssessment && (
                <div className="mt-2 p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 flex flex-col gap-2">
                  {group === "Key Question" && (
                    <>
                      <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rating</span>
                        <span className={`text-sm font-bold ${props.rating?.includes('Good') ? 'text-green-500' : props.rating?.includes('Requires') ? 'text-orange-500' : 'text-slate-700 dark:text-white'}`}>{props.rating || "N/A"}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-white">{props.percentage_score || 0}%</span>
                      </div>
                    </>
                  )}
                  {group === "Quality Statement" && (
                    <>
                      <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-white">
                          {props.qs_score !== undefined ? `Score: ${typeof props.qs_score === 'object' ? props.qs_score.low : props.qs_score}` : "Not Scored"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-white">{props.status || "Unknown"}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Evidence Subgraph Context (Enriched Lineage & Breadcrumbs) */}
            {['Evidence', 'Identified Risk', 'Positive Practice'].includes(group) && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 relative overflow-hidden">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Waypoints size={14} />
                    Assessment Lineage
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">

                    {nodeData?.evidenceSnippets?.length > 0 && group !== 'Evidence' && (
                      <>
                        <span className="flex items-center gap-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-1 rounded truncate max-w-[120px]">
                          <Search size={12} className="shrink-0" /> Evidence Match
                        </span>
                        <ChevronRight size={12} className="opacity-50 shrink-0" />
                      </>
                    )}

                    {(isRisk || isPractice) && (
                      <>
                        <span className={`flex items-center gap-1 px-2 py-1 rounded truncate max-w-[140px] ${isRisk ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                          {getIcon()} {props.name || group}
                        </span>
                        <ChevronRight size={12} className="opacity-50 shrink-0" />
                      </>
                    )}

                    {nodeData?.qualityStatements?.length > 0 && (
                      <>
                        <span className="flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-1 rounded truncate max-w-[140px]">
                          <AlertCircle size={12} className="shrink-0" /> {nodeData.qualityStatements[0]}
                        </span>
                        {(nodeData?.regulations?.length > 0) && <ChevronRight size={12} className="opacity-50 shrink-0" />}
                      </>
                    )}

                    {nodeData?.regulations?.length > 0 && (
                      <span className="flex items-center gap-1 bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 px-2 py-1 rounded truncate max-w-[140px]">
                        <Scale size={12} className="shrink-0" /> {nodeData.regulations[0]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Mitigation Status */}
                {isRisk && (
                  <div className="mt-2">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mitigation Status</h4>
                    {(!nodeData.actions || nodeData.actions.length === 0) ? (
                      <div className="p-3 rounded-md bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm flex gap-2 items-start">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <p><strong>Action Required:</strong> No mitigating actions have been recorded for this risk.</p>
                      </div>
                    ) : (
                      <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex flex-col gap-2">
                        <div className="flex gap-2 items-center font-medium">
                          <CheckCircle size={16} />
                          <span>Active Interventions</span>
                        </div>
                        <ul className="list-disc pl-6 space-y-1 text-slate-600 dark:text-slate-300">
                          {nodeData.actions.map((action: string, idx: number) => (
                            <li key={idx}>{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}


            {nodeData?.evidenceSnippets && nodeData.evidenceSnippets.length > 0 && typeof nodeData.evidenceSnippets[0] === 'object' && group !== 'Evidence' && (
              <div className="flex flex-col gap-3 mt-2 pr-2">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-2 border-t border-slate-200 dark:border-slate-800 pt-4">Linked Source Evidence</span>
                {nodeData.evidenceSnippets.map((ev: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 flex flex-col gap-2">
                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 opacity-90"><Waypoints size={12} /> Date: {ev.commentary_date}</div>
                    <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-h-[200px] overflow-y-auto custom-scrollbar italic">&quot;{ev.raw_html}&quot;</div>
                  </div>
                ))}
              </div>
            )}

            {group === 'Evidence' && (nodeData?.relatedRisks?.length > 0 || nodeData?.relatedPractices?.length > 0) && (
              <div className="flex flex-col gap-3 mt-2 pr-2">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-2 border-t border-slate-200 dark:border-slate-800 pt-4 flex items-center gap-2">
                  <Star size={14} className="text-purple-500" />
                  AI Derived Insights
                </span>
                
                {nodeData.relatedRisks?.map((risk: string, idx: number) => (
                  <div key={`risk-${idx}`} className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Identified Risk</span>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{risk}</span>
                    </div>
                  </div>
                ))}

                {nodeData.relatedPractices?.map((practice: string, idx: number) => (
                  <div key={`practice-${idx}`} className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 flex items-start gap-2">
                    <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">Positive Practice</span>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{practice}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1c23] shrink-0">
          {isRisk ? (
            <>
              {(!nodeData.actions || nodeData.actions.length === 0) ? (
                <button className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors flex justify-center items-center gap-2">
                  <PlusCircle size={18} />
                  Create Action Plan
                </button>
              ) : (
                <button className="w-full py-2.5 bg-transparent border border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors">
                  + Add Additional Action
                </button>
              )}
            </>
          ) : (
            <button className="w-full py-3 px-4 rounded-xl bg-[#0058bb] hover:bg-[#004a9e] text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,88,187,0.3)] hover:shadow-[0_0_25px_rgba(0,88,187,0.5)] active:scale-95">
              {isPractice ? "Acknowledge Practice" : "Explore Subgraph"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}