"use client";

import { useEffect, useState } from 'react';

// 1. Updated Alert type to include qualityStatement
type Alert = {
  id: string;
  description: string;
  pillar: string;
  severity?: string;
  type?: string;
  evidence: string;
  qualityStatement?: string;
};

interface AlertCardProps {
  alert: Alert;
  selectedAlertId: string | null;
  onInspect: (id: string | null) => void;
}

function AlertCard({ alert, selectedAlertId, onInspect }: AlertCardProps) {
  const isRisk = alert.type === 'risk';
  const isActive = selectedAlertId === alert.id;
  const isUncategorized = alert.pillar === 'Uncategorized' || !alert.pillar;

  return (
    <div className={`
      relative p-5 rounded-2xl border transition-all duration-300 flex flex-col gap-3 mb-3 overflow-hidden
      ${isActive
        ? 'bg-white dark:bg-[#1a1c23] border-slate-300 dark:border-slate-700 shadow-lg scale-[1.02] z-10'
        : 'bg-[#f8f9fc] dark:bg-[#13141a] border-slate-200 dark:border-white/5 hover:bg-white dark:hover:bg-[#181a20] hover:shadow-md'}
    `}>
      {/* Sleek Hugging Left Border */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl transition-colors duration-300 ${isRisk ? 'bg-[#f97316]' : 'bg-[#14b8a6]'
        }`} />

      {/* Top Row: Pill Tag & Key Question (Time Clock position) */}
      <div className="flex justify-between items-center ml-1">
        <span className={`px-3 py-1 rounded-full text-[0.65rem] font-bold tracking-wider uppercase ${isRisk
          ? 'bg-[#f97316]/10 text-[#ea580c] dark:bg-[#f97316]/10 dark:text-[#fb923c]'
          : 'bg-[#14b8a6]/10 text-[#0d9488] dark:bg-[#14b8a6]/15 dark:text-[#2dd4bf]'
          }`}>
          {isRisk ? 'RISK' : 'POSITIVE PRACTICE'}
        </span>

        {!isUncategorized && (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tracking-wide">
            {alert.pillar}
          </span>
        )}
      </div>

      {/* Title: Quality Statement */}
      <h3 className="text-lg font-bold text-slate-900 dark:text-white ml-1 leading-snug">
        {alert.qualityStatement || 'General Finding'}
      </h3>

      {/* Body: Description */}
      <p className="text-sm text-slate-600 dark:text-slate-400 ml-1 leading-relaxed line-clamp-3">
        {alert.description}
      </p>

      {/* Footer: Action Button */}
      <div className="flex justify-end items-center mt-1 ml-1">
        <button
          onClick={() => onInspect(isActive ? null : alert.id)}
          className={`
            w-28 flex items-center justify-center py-2 rounded-full text-sm font-semibold transition-all duration-300 active:scale-95
            ${isActive
              ? 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 shadow-none'
              : 'bg-[#475569] text-white hover:bg-[#334155] shadow-[0_0_15px_rgba(71,85,105,0.25)] hover:shadow-[0_0_20px_rgba(71,85,105,0.4)] dark:shadow-[0_0_15px_rgba(71,85,105,0.15)]'
            }
          `}
        >
          {isActive ? 'Close' : 'Inspect'}
        </button>
      </div>
    </div>
  );
}

export default function AlertSidebar({
  locationId,
  isSidebarOpen,
  selectedAlertId,
  setSelectedAlertId,
  filterType,
  setFilterType,
  searchResultNodes
}: {
  locationId: string,
  isSidebarOpen: boolean,
  selectedAlertId: string | null,
  setSelectedAlertId: (id: string | null) => void,
  filterType: 'all' | 'risk' | 'practice',
  setFilterType: (filter: 'all' | 'risk' | 'practice') => void,
  searchResultNodes?: any[] | null
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedAlertId && filterType !== 'all') {
      const alert = alerts.find(a => a.id === selectedAlertId);
      if (alert && alert.type !== filterType) {
        setSelectedAlertId(null);
      }
    }
  }, [filterType, alerts, selectedAlertId, setSelectedAlertId]);

  const filteredAlerts = alerts.filter(alert => {
    // 1. Check the UI Toggle Filter
    if (filterType !== 'all' && alert.type !== filterType) return false;

    // 2. Check the Search Filter natively mapped from Dashboard
    if (searchResultNodes && searchResultNodes.length > 0) {
      // Only keep this alert if its exact ID exists natively in the Search graph mapping
      const isNodeInSearch = searchResultNodes.some(node => node.id === alert.id);
      if (!isNodeInSearch) return false;
    }

    return true;
  });

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`/api/alerts/${locationId}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) setAlerts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch alerts", err);
        setError("Unable to retrieve compliance data. Please check connection.");
        setLoading(false);
      });
  }, [locationId]);

  return (
    <aside className={`${isSidebarOpen ? "w-[420px] relative" : "w-0 relative"} transition-all duration-300 h-full bg-white/70 dark:bg-[#1a1c23]/80 backdrop-blur-2xl border-r border-white/20 dark:border-white/5 z-10 flex flex-col bg-gradient-to-br from-[#0058bb]/5 dark:from-[#0058bb]/20 to-white/80 dark:to-[#1a1c23]/90 shadow-[20px_0_50px_rgba(0,88,187,0.08)] dark:shadow-none overflow-hidden shrink-0`}>
      <div className="w-[420px] h-full flex flex-col pt-[2.75rem] pb-6 shrink-0">
        <div className="w-full pl-[1.4rem] pr-[22px] flex justify-between items-center pb-4 shrink-0">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#5a5b60] dark:text-slate-400 whitespace-nowrap">Insight Feed</h2>
          <div className="bg-slate-200 dark:bg-[#252830] p-[0.2rem] rounded-full flex gap-0.5 border border-slate-300 dark:border-white/5 shrink-0">
            <button onClick={() => setFilterType('all')} className={`px-3 py-1 text-[0.65rem] uppercase tracking-widest font-bold rounded-full transition-all ${filterType === 'all' ? 'bg-white dark:bg-[#3d424d] shadow-sm text-[#2d2f33] dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>All</button>
            <button onClick={() => setFilterType('risk')} className={`px-3 py-1 text-[0.65rem] uppercase tracking-widest font-bold rounded-full transition-all ${filterType === 'risk' ? 'bg-white dark:bg-[#3d424d] shadow-sm text-[#2d2f33] dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>Risks</button>
            <button onClick={() => setFilterType('practice')} className={`px-3 py-1 text-[0.65rem] uppercase tracking-widest font-bold rounded-full transition-all ${filterType === 'practice' ? 'bg-white dark:bg-[#3d424d] shadow-sm text-[#2d2f33] dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>Practices</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-scroll overflow-x-hidden custom-scrollbar px-4 pb-[2.75rem] flex flex-col">
          {loading ? (
            <div className="text-[#5a5b60] dark:text-slate-400 animate-pulse text-base tracking-wide flex items-center gap-3 mt-4">
              <span className="material-symbols-outlined animate-spin text-[#0058bb] dark:text-[#4b8eff]">sync</span>
              Synthesising Live Compliance...
            </div>
          ) : error ? (
            <div className="bg-[#b31b25]/5 dark:bg-[#fb5151]/10 rounded-2xl p-6 text-[#b31b25] dark:text-[#fb5151] font-medium leading-[1.6] mt-4 border border-[#b31b25]/20">
              {error}
            </div>
          ) : alerts.length === 0 ? (
            <div className="bg-[#006a26]/5 dark:bg-[#006a26]/20 rounded-2xl p-6 text-[#006a26] dark:text-[#6ffb85] font-medium leading-[1.6] mt-4 border border-[#006a26]/20">
              No imminent compliance risks mapped within the active network horizon.
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className={`rounded-2xl p-6 font-medium leading-[1.6] mt-4 border ${filterType === 'risk' ? 'bg-[#f97316]/5 dark:bg-[#f97316]/10 text-[#ea580c] dark:text-[#fb923c] border-[#f97316]/20' : 'bg-[#14b8a6]/5 dark:bg-[#14b8a6]/10 text-[#0d9488] dark:text-[#2dd4bf] border-[#14b8a6]/20'}`}>
              {searchResultNodes ? (
                "No risks or practices found matching your explicit search."
              ) : (
                `No ${filterType === 'risk' ? 'active risks' : 'positive practices'} found mapped for this specific location parameters.`
              )}
            </div>
          ) : (
            <div className="flex flex-col mt-2">
              {filteredAlerts.map((alert, idx) => (
                <AlertCard
                  key={`${alert.id}-${idx}`}
                  alert={alert}
                  selectedAlertId={selectedAlertId}
                  onInspect={setSelectedAlertId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}