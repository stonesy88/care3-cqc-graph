"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  Building2, 
  AlertOctagon, 
  Sparkles, 
  LayoutDashboard, 
  Waypoints, 
  Bell, 
  Sun, 
  Moon,
  ArrowUpRight,
  FileCheck,
  Clock,
  Activity,
  X,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  RefreshCw
} from "lucide-react";
import { 
  Tooltip, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";

// --- MOCK DATA ---
const MOCK_PILLARS = [
  { subject: 'Safe', score: 65, fullMark: 100 },
  { subject: 'Effective', score: 80, fullMark: 100 },
  { subject: 'Caring', score: 95, fullMark: 100 },
  { subject: 'Responsive', score: 70, fullMark: 100 },
  { subject: 'Well-led', score: 55, fullMark: 100 },
];

const MOCK_ALERTS = [
  { id: 1, pillar: 'Safe', statement: 'Safe environments', desc: 'Water temperature thresholds critically breached...', severity: 'high', location: 'St Jude Care Home' },
  { id: 2, pillar: 'Well-led', statement: 'Governance, management', desc: 'Absence of registered manager oversight on internal audits.', severity: 'high', location: 'Elmwood Facility' },
  { id: 3, pillar: 'Effective', statement: 'Assessing needs', desc: 'Care plans missing mandatory consent forms.', severity: 'medium', location: 'Oakhaven Trust' },
  { id: 4, pillar: 'Safe', statement: 'Infection prevention', desc: 'PPE supplies fundamentally low following vendor shifts.', severity: 'high', location: 'St Jude Care Home' },
];

// We replaced MOCK_LOCATIONS with real Restate telemetry
interface ActiveWorkflow {
  invocationId: string;
  workflowKey: string;
  residentId: string;
  policyId: string;
  createdAt: string;
  status: string;
}

interface GranularState {
  currentStep?: string;
  expiresAt?: number;
  totalSteps?: number;
  stepIndex?: number;
  status?: string;
  stepStatuses?: { step: string; status: string }[];
}

export default function PortfolioDashboard() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeWorkflows, setActiveWorkflows] = useState<ActiveWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Drill-down Modal State
  const [selectedWorkflow, setSelectedWorkflow] = useState<ActiveWorkflow | null>(null);
  const [granularState, setGranularState] = useState<GranularState | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);

  // Sorting State
  type SortKey = keyof ActiveWorkflow;
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>({ key: 'createdAt', direction: 'desc' });

  // Fetch Macro Data on Load
  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(data => {
        if (data.activeWorkflows) {
          setActiveWorkflows(data.activeWorkflows);
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load macro Restate dashboard:", err);
        setIsLoading(false);
      });
  }, []);

  const handleRowClick = async (workflow: ActiveWorkflow) => {
    setSelectedWorkflow(workflow);
    setIsModalLoading(true);
    try {
      const res = await fetch(`/api/workflows/${workflow.workflowKey}`);
      if (res.ok) {
        const data = await res.json();
        setGranularState(data);
      }
    } catch (err) {
      console.error("Failed to load granular state", err);
    } finally {
      setIsModalLoading(false);
    }
  };

  // LIVE POLLING: Automatically refresh the drilldown every 1000ms to watch steps progress!
  useEffect(() => {
    if (!selectedWorkflow) return;
    
    // Create an artificial state trigger to force Date.now() recalculation for the UI countdown
    const ticker = setInterval(() => {
      setGranularState(prev => prev ? { ...prev } : prev); 
    }, 1000);

    const dataPoller = setInterval(async () => {
      try {
        const res = await fetch(`/api/workflows/${selectedWorkflow.workflowKey}`);
        if (res.ok) {
          const data = await res.json();
          setGranularState(data);
        }
      } catch (e) {}
    }, 1000);

    return () => {
      clearInterval(ticker);
      clearInterval(dataPoller);
    };
  }, [selectedWorkflow]);

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedWorkflows = useMemo(() => {
    let sortableItems = [...activeWorkflows];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA < valB) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [activeWorkflows, sortConfig]);

  const closeModal = () => {
    setSelectedWorkflow(null);
    setGranularState(null);
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} bg-[#f6f6fb] dark:bg-[#0c0e12] text-[#2d2f33] dark:text-slate-100 font-sans min-h-screen w-screen overflow-x-hidden flex flex-col relative transition-colors duration-300`}>
      
      {/* Navigation Header */}
      <header className="fixed top-0 left-0 w-full z-50 bg-white/70 dark:bg-[#1a1c23]/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,88,187,0.08)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] h-[88px] px-8 flex items-center justify-between border-b border-white/20 dark:border-white/5 transition-all pointer-events-auto">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-[1.75rem] font-bold tracking-tight text-[#2d2f33] dark:text-white leading-none ml-2 mr-2">Beacon</Link>
          <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 mx-2 transition-colors duration-300"></div>
          <nav className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all bg-white dark:bg-[#252830] text-[#0058bb] dark:text-[#4b8eff] shadow-sm border border-slate-200 dark:border-white/5 pointer-events-none">
              <LayoutDashboard size={18} />
              Dashboard
            </div>
            <Link href="/" className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all text-[#5a5b60] dark:text-slate-400 hover:text-[#2d2f33] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10">
              <Waypoints size={18} />
              Inspector
            </Link>
            <Link href="/policy" className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all text-[#5a5b60] dark:text-slate-400 hover:text-[#2d2f33] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10">
              <FileCheck size={18} />
              Policies
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#dbdde3]/50 dark:hover:bg-white/10 transition-colors text-[#5a5b60] dark:text-slate-400 active:scale-95 relative">
              <Bell size={20} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#0058bb] dark:bg-[#4b8eff] rounded-full ring-2 ring-white dark:ring-[#1a1c23]"></span>
            </button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#dbdde3]/50 dark:hover:bg-white/10 transition-colors text-[#5a5b60] dark:text-slate-400 active:scale-95">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
          <div className="h-10 w-[1px] bg-[#e7e8ee] dark:bg-slate-700 transition-colors duration-300"></div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-base font-semibold text-[#2d2f33] dark:text-slate-200 leading-tight">James Wilson</p>
              <p className="text-[0.75rem] font-semibold text-[#5a5b60] dark:text-slate-500 tracking-[0.05em] mt-1 uppercase">Regional Director</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-[#0058bb]/10 dark:bg-[#4b8eff]/10 flex items-center justify-center text-[#0058bb] dark:text-[#4b8eff] font-bold text-lg shadow-sm border border-white/40 dark:border-white/5 transition-colors duration-300">
              JW
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="flex-1 mt-[88px] p-8 max-w-screen-2xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#2d2f33] dark:text-white mb-2">Portfolio Command Center</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Aggregated real-time oversight of all compliance environments.</p>
        </div>

        {/* Top Row: KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/5 p-6 rounded-2xl shadow-sm flex items-center justify-between transition-colors duration-300">
            <div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Monitored Locations</p>
              <h3 className="text-4xl font-bold text-[#2d2f33] dark:text-white">4</h3>
            </div>
            <div className="w-14 h-14 rounded-full bg-[#0058bb]/10 dark:bg-[#4b8eff]/20 flex items-center justify-center text-[#0058bb] dark:text-[#4b8eff]">
              <Building2 size={24} />
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/5 p-6 rounded-2xl shadow-sm flex items-center justify-between relative overflow-hidden group transition-colors duration-300">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#ef4444]" />
            <div className="ml-2">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Active Risks</p>
              <h3 className="text-4xl font-bold text-[#2d2f33] dark:text-white">24</h3>
            </div>
            <div className="w-14 h-14 rounded-full bg-[#ef4444]/10 dark:bg-[#ef4444]/20 flex items-center justify-center text-[#ef4444] dark:text-[#ff7676]">
              <AlertOctagon size={24} />
            </div>
          </div>

          <div className="bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/5 p-6 rounded-2xl shadow-sm flex items-center justify-between relative overflow-hidden transition-colors duration-300">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#10b981]" />
            <div className="ml-2">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Highlighted Practices</p>
              <h3 className="text-4xl font-bold text-[#2d2f33] dark:text-white">12</h3>
            </div>
            <div className="w-14 h-14 rounded-full bg-[#10b981]/10 dark:bg-[#10b981]/20 flex items-center justify-center text-[#10b981] dark:text-[#6ffb85]">
              <Sparkles size={24} />
            </div>
          </div>
        </div>

        {/* Middle Row: Radar Chart & Action Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* CQC Pillar Radar */}
          <div className="lg:col-span-2 bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/5 p-6 rounded-2xl shadow-sm flex flex-col items-center transition-colors duration-300">
            <div className="w-full mb-6">
              <h3 className="text-lg font-bold text-[#2d2f33] dark:text-white">Aggregate CQC Health Matrix</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total compliance density mapped across Five Pillars.</p>
            </div>
            <div className="w-full h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={MOCK_PILLARS}>
                  <PolarGrid stroke={isDarkMode ? 'rgba(255,255,255,0.15)' : '#e2e8f0'} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 13, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Compliance Score" dataKey="score" stroke="#0058bb" fill="#0058bb" fillOpacity={isDarkMode ? 0.4 : 0.25} dot={{ stroke: '#0058bb', r: 4, strokeWidth: 2, fill: isDarkMode ? '#1a1c23' : '#fff' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: isDarkMode ? '#1a1c23' : '#fff', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: '12px', fontWeight: 600 }} 
                    itemStyle={{ color: isDarkMode ? '#4b8eff' : '#0058bb' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Priority Action Feed */}
          <div className="bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/5 p-0 rounded-2xl shadow-sm flex flex-col overflow-hidden max-h-[445px] transition-colors duration-300">
            <div className="p-5 border-b border-slate-100 dark:border-white/5 bg-[#f8f9fc] dark:bg-[#13141a] transition-colors duration-300">
              <h3 className="text-lg font-bold text-[#2d2f33] dark:text-white">Immediate Attention</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Top severity risks across portfolio</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-3">
              {MOCK_ALERTS.map(alert => (
                <div key={alert.id} className="relative p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-[#f8f9fc] dark:bg-[#13141a] hover:bg-white dark:hover:bg-[#181a20] transition-colors duration-300 overflow-hidden group shadow-sm">
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${alert.severity === 'high' ? 'bg-[#ff4b4b]' : 'bg-[#f59e0b]'}`} />
                  <div className="ml-1 mb-2 flex justify-between items-start">
                    <span className={`px-2 py-0.5 rounded-full text-[0.6rem] font-bold tracking-wider uppercase ${alert.severity === 'high' ? 'bg-[#ff4b4b]/10 text-[#e03131] dark:text-[#ff7676]' : 'bg-[#f59e0b]/10 text-[#d97706] dark:text-[#fbbf24]'}`}>
                      {alert.pillar}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{alert.location}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white ml-1 leading-snug mb-1">{alert.statement}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 ml-1 line-clamp-2 leading-relaxed">{alert.desc}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom Row: Location Data Table / Active Workflows */}
        <div className="bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden mb-12 transition-colors duration-300">
          <div className="p-6 border-b border-slate-100 dark:border-white/5 transition-colors duration-300">
            <h3 className="text-lg font-bold text-[#2d2f33] dark:text-white">Active Compliance Workflows</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Real-time macro view driven directly by Restate Introspection telemetry.</p>
          </div>
          <div className="w-full overflow-x-auto min-h-[150px]">
            {isLoading ? (
              <div className="flex justify-center items-center py-10">
                <p className="text-slate-500 animate-pulse">Loading Restate telemetry...</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8f9fc] dark:bg-[#191b22] border-b border-slate-200 dark:border-white/5 text-[0.7rem] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors duration-300">
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => requestSort('invocationId')}>
                      <div className="flex items-center gap-2">Invocation ID {sortConfig?.key === 'invocationId' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>) : <ArrowUpDown size={14} className="opacity-30"/>}</div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => requestSort('workflowKey')}>
                      <div className="flex items-center gap-2">Target Key {sortConfig?.key === 'workflowKey' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>) : <ArrowUpDown size={14} className="opacity-30"/>}</div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => requestSort('residentId')}>
                      <div className="flex items-center gap-2">Resident ID {sortConfig?.key === 'residentId' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>) : <ArrowUpDown size={14} className="opacity-30"/>}</div>
                    </th>
                    <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => requestSort('policyId')}>
                      <div className="flex items-center justify-center gap-2">Policy Template {sortConfig?.key === 'policyId' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>) : <ArrowUpDown size={14} className="opacity-30"/>}</div>
                    </th>
                    <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => requestSort('status')}>
                      <div className="flex items-center justify-center gap-2">Status {sortConfig?.key === 'status' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>) : <ArrowUpDown size={14} className="opacity-30"/>}</div>
                    </th>
                    <th className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => requestSort('createdAt')}>
                      <div className="flex items-center justify-end gap-2">{sortConfig?.key === 'createdAt' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>) : <ArrowUpDown size={14} className="opacity-30"/>} Created At</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {sortedWorkflows.map(workflow => (
                    <tr 
                      key={workflow.invocationId} 
                      onClick={() => handleRowClick(workflow)}
                      className="hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors duration-300 group"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-[#0058bb] dark:text-[#4b8eff] group-hover:underline">
                        {workflow.invocationId.substring(0, 16)}...
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                        {workflow.workflowKey}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#2d2f33] dark:text-white">
                        {workflow.residentId}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#10b981]/10 text-[#059669] dark:text-[#34d399] uppercase tracking-wider">
                          {workflow.policyId.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          workflow.status === 'completed' 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : workflow.status === 'failed'
                            ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                        }`}>
                          {workflow.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-slate-500 font-medium">
                        {new Date(workflow.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {activeWorkflows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-sm font-medium text-slate-500">
                        No active workflows pending resolution.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </main>

      {/* Drill-Down Micro View Modal */}
      {selectedWorkflow && (
        <div className="fixed inset-0 z-[100] flex justify-center items-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1a1c23] w-full max-w-lg rounded-3xl shadow-2xl border border-white/20 overflow-hidden transform transition-all scale-100 relative">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-br from-[#0058bb] to-[#003d82] p-6 relative">
              <button 
                onClick={closeModal}
                className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors bg-black/20 hover:bg-black/40 rounded-full p-2"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-3 mb-1">
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                  <Activity className="text-white" size={24} />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">Workflow Drill-Down</h2>
              </div>
              <p className="text-white/80 text-sm ml-12 font-medium break-all">
                {selectedWorkflow.invocationId}
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-8">
              {isModalLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-[#0058bb]/20 border-t-[#0058bb] rounded-full animate-spin mb-4"></div>
                  <p className="text-slate-500 font-medium animate-pulse">Querying Shared Handler...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  
                  {/* Status Banner */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#f8f9fc] dark:bg-[#252830] border border-slate-200 dark:border-white/5">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-1">Current State</p>
                      <p className="text-lg font-bold text-[#2d2f33] dark:text-white">
                        {granularState?.status === 'Not Started or Completed' 
                          ? 'Inactive' 
                          : 'In-Flight'}
                      </p>
                    </div>
                    {granularState?.currentStep && (
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-1">Progress</p>
                        <p className="text-lg font-bold text-[#0058bb] dark:text-[#4b8eff]">
                          Step {granularState.stepIndex} <span className="text-slate-400">/ {granularState.totalSteps}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Context Metrics */}
                  {granularState?.currentStep ? (
                    <div className="grid grid-cols-2 gap-4">
                      
                      {/* Action Required */}
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#13141a]">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Awaiting Action</p>
                          <Activity size={16} className="text-[#0058bb] dark:text-[#4b8eff]" />
                        </div>
                        <p className="font-semibold text-slate-900 dark:text-white text-md">
                          {granularState.currentStep}
                        </p>
                      </div>

                      {/* Countdown */}
                      <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-500/5">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-xs text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">SLA Expires In</p>
                          <Clock size={16} className="text-red-500" />
                        </div>
                        <p className="font-bold text-red-600 dark:text-red-400 text-lg">
                          {(() => {
                            const remainingMs = Math.max(0, (granularState.expiresAt || 0) - Date.now());
                            const m = Math.floor(remainingMs / 60000);
                            const s = Math.floor(remainingMs / 1000) % 60;
                            return `${m}m ${s}s`;
                          })()}
                        </p>
                      </div>
                      
                    </div>
                  ) : (
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/40 p-4 rounded-xl text-amber-800 dark:text-amber-400 font-medium text-sm text-center">
                      This workflow doesn't have an active SLA state currently waiting in the queue.
                    </div>
                  )}

                  {/* Historical Compliance Matrix */}
                  {granularState?.stepStatuses && granularState.stepStatuses.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-3">Service Level Agreement (SLA) Matrix</p>
                      <div className="space-y-2">
                        {granularState.stepStatuses.map((s: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center bg-white dark:bg-[#13141a] border border-slate-100 dark:border-white/5 rounded-lg p-3">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{s.step}</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                              s.status.includes('SLA Met') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                              s.status.includes('Breached') ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                              s.status.includes('Late') ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' :
                              'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400'
                            }`}>
                              {s.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Meta Identifiers */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-xs text-slate-500 font-semibold uppercase">Resident ID</span>
                       <span className="text-sm font-semibold text-slate-800 dark:text-slate-300">{selectedWorkflow.residentId}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-xs text-slate-500 font-semibold uppercase">Workflow Key</span>
                       <span className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-black/40 px-2 py-1 rounded">{selectedWorkflow.workflowKey}</span>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 dark:border-white/5 flex gap-3 justify-end bg-slate-50 dark:bg-[#13141a]">
              <button onClick={closeModal} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                Close
              </button>
              <button 
                onClick={async () => {
                  if (!selectedWorkflow) return;
                  setIsModalLoading(true);
                  try {
                    const res = await fetch(`/api/workflows/${selectedWorkflow.workflowKey}`);
                    if (res.ok) setGranularState(await res.json());
                  } finally {
                    setIsModalLoading(false);
                  }
                }} 
                className="px-5 py-2.5 rounded-xl font-semibold bg-[#0058bb] text-white hover:bg-[#004e9a] transition-colors shadow-sm flex items-center gap-2"
              >
                <RefreshCw size={16} className={isModalLoading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
