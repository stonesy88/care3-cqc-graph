"use client";

import AlertSidebar from "./AlertSidebar";
import SearchResultsSidebar from "./SearchResultsSidebar";
import dynamic from "next/dynamic";
import LocationFilter from "./LocationFilter";
import NodeInspector from "./NodeInspector";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Bell, Sun, Moon, ChevronLeft, ChevronRight, MapPin, X, Loader2, LayoutDashboard, Waypoints, FileCheck } from "lucide-react";

const GraphCanvas = dynamic<{ locationId: string | null; isSidebarOpen: boolean; selectedAlertId: string | null; focusedNodeId?: string | null; isDarkMode: boolean; filterType: 'all' | 'risk' | 'practice'; onNodeSelect?: (node: any) => void; searchResultNodes?: any[] | null; searchResultLinks?: any[] | null; }>(() => import("./GraphCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-[#0058bb] font-medium tracking-wide animate-pulse uppercase text-xs">Loading Visionary Engine...</div>
    </div>
  ),
});

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'risk' | 'practice'>('all');
  const [inspectedNode, setInspectedNode] = useState<any | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<{ answer?: string; nodes: any[]; links: any[] } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSearchExpanded) {
        setIsSearchExpanded(false);
        setSearchQuery('');
        setSearchResults(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchExpanded]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (val.trim() === '') {
      setSearchResults(null);
      setSearchError(null);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    if (!selectedLocation) {
      setInspectedNode(null);
      setSelectedAlertId(null);
    }

    setIsLoading(true);
    setLoadingStep("Classifying intent...");
    setSearchError(null);
    setSearchResults(null);
    setFocusedNodeId(null);

    const matchTimer = setTimeout(() => setLoadingStep("Vector matching & traversing graph..."), 800);
    const genTimer = setTimeout(() => setLoadingStep("Generating answer..."), 2000);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchQuery,
          locationId: selectedLocation || 'all'
        })
      });

      if (!response.ok) throw new Error('Failed to fetch search results');

      const data = await response.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
      setSearchError("An error occurred while searching. Please try again.");
    } finally {
      clearTimeout(matchTimer);
      clearTimeout(genTimer);
      setIsLoading(false);
      setLoadingStep(null);
    }
  };

  return (
    <div className="bg-[#f6f6fb] dark:bg-[#0c0e12] text-[#2d2f33] dark:text-slate-100 font-sans h-screen w-screen overflow-hidden flex flex-col relative transition-colors duration-300">
      <header className="absolute top-0 left-0 w-full z-50 bg-white/70 dark:bg-[#1a1c23]/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,88,187,0.08)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] h-[88px] px-8 flex items-center justify-between border-b border-white/20 dark:border-white/5 transition-all pointer-events-auto">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[1.75rem] font-bold tracking-tight text-[#2d2f33] dark:text-white leading-none ml-2 mr-2">Beacon</Link>

          <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 mx-2"></div>

          <nav className="flex items-center gap-2">
            <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all text-[#5a5b60] dark:text-slate-400 hover:text-[#2d2f33] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10">
              <LayoutDashboard size={18} />
              Dashboard
            </Link>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all bg-white dark:bg-[#252830] text-[#0058bb] dark:text-[#4b8eff] shadow-sm border border-slate-200 dark:border-white/5 pointer-events-none">
              <Waypoints size={18} />
              Inspector
            </div>
            <Link href="/policy" className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all text-[#5a5b60] dark:text-slate-400 hover:text-[#2d2f33] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10">
              <FileCheck size={18} />
              Policies
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <LocationFilter
            selectedLocationId={selectedLocation}
            onLocationChange={(id) => {
              setSelectedLocation(id);
              setSelectedAlertId(null);
              setFocusedNodeId(null);
              setInspectedNode(null);
            }}
          />

          <div className="flex items-center gap-2">
            <form onSubmit={handleSearch} className={`flex items-center transition-all duration-300 ease-in-out overflow-hidden rounded-full ${isSearchExpanded ? 'w-[450px] max-w-[35vw] shrink h-[50px] bg-white/40 dark:bg-black/20 backdrop-blur-md border border-white/20 dark:border-white/10 ring-2 ring-[#0058bb]/50' : 'w-[50px] h-[50px] shrink-0 justify-center bg-transparent border border-transparent hover:bg-[#dbdde3]/50 dark:hover:bg-white/10 cursor-pointer'}`}>
              <button
                type="button"
                aria-label="Expand Search"
                onClick={() => {
                  if (!isSearchExpanded) setIsSearchExpanded(true);
                  else if (searchQuery.trim()) handleSearch();
                }}
                className={`flex items-center justify-center shrink-0 ${isSearchExpanded ? 'w-12 h-full' : 'w-full h-full'}`}
              >
                {isLoading ? <Loader2 size={18} className="animate-spin text-[#0058bb] dark:text-[#4b8eff]" /> : <Search size={22} className={isSearchExpanded ? "text-[#0058bb] dark:text-[#4b8eff]" : "text-[#5a5b60] dark:text-slate-400"} />}
              </button>
              {isSearchExpanded && (
                <>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Beacon show me..."
                    className="bg-transparent border-none outline-none text-base text-[#2d2f33] dark:text-white flex-1 min-w-0 placeholder:text-slate-500 font-medium h-full"
                    autoFocus
                    spellCheck={true}
                    disabled={isLoading}
                  />
                  <button type="button" aria-label="Clear Search" onClick={() => { setIsSearchExpanded(false); setSearchQuery(''); setSearchResults(null); setSearchError(null); }} className="w-12 h-full flex items-center justify-center shrink-0">
                    <X className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors" />
                  </button>
                </>
              )}
            </form>

            <button aria-label="Notifications" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#dbdde3]/50 dark:hover:bg-white/10 transition-colors text-[#5a5b60] dark:text-slate-400 active:scale-95 relative">
              <Bell size={20} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#0058bb] dark:bg-[#4b8eff] rounded-full ring-2 ring-white dark:ring-[#1a1c23]"></span>
            </button>

            <button
              aria-label="Toggle Dark Mode"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#dbdde3]/50 dark:hover:bg-white/10 transition-colors text-[#5a5b60] dark:text-slate-400 active:scale-95"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
          <div className="h-10 w-[1px] bg-[#e7e8ee] dark:bg-slate-700"></div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-base font-semibold text-[#2d2f33] dark:text-slate-200 leading-tight">James Wilson</p>
              <p className="text-[0.75rem] font-semibold text-[#5a5b60] dark:text-slate-500 tracking-[0.05em] mt-1 uppercase">Care Home Manager</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-[#0058bb]/10 dark:bg-[#4b8eff]/10 flex items-center justify-center text-[#0058bb] dark:text-[#4b8eff] font-bold text-lg shadow-sm border border-white/40 dark:border-white/5">
              JW
            </div>
          </div>
        </div>
      </header>

      {searchError && isSearchExpanded && (
        <div className="absolute top-[88px] right-8 w-[450px] bg-white/95 dark:bg-[#1a1c23]/95 backdrop-blur-3xl border border-red-200 dark:border-red-900/30 rounded-2xl shadow-2xl z-50 p-6 animate-in slide-in-from-top-4 duration-300 mt-4 custom-scrollbar">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <Search size={18} />
              Search Error
            </h3>
            <button onClick={() => { setSearchError(null); }} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
              <X size={16} className="text-slate-500 dark:text-slate-400" />
            </button>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm border border-red-100 dark:border-red-900/30">
            {searchError}
          </div>
        </div>
      )}

      <main className="relative flex flex-1 h-[calc(100vh-88px)] overflow-hidden w-full mt-[88px]">
        {!selectedLocation && !searchResults ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0c0e12] z-10 w-full h-full transition-colors duration-300">
            <div className="w-24 h-24 bg-[#0058bb]/5 dark:bg-[#4b8eff]/10 rounded-full flex items-center justify-center mb-6 border border-[#0058bb]/10 dark:border-white/5 shadow-inner">
              <MapPin size={40} className="text-[#0058bb] dark:text-[#4b8eff] opacity-80" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Select a Location</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-3 font-medium text-center max-w-md">
              Use the dropdown to select a location, or use the global search above to initialise the compliance graph across all homes.
            </p>
          </div>
        ) : (
          <>
            {selectedLocation && (
              <div className="absolute top-0 left-0 h-full flex z-20 shrink-0 bg-white dark:bg-[#1a1c23] shadow-2xl dark:shadow-[0_0_50px_rgba(0,0,0,0.6)]">
                <AlertSidebar
                  locationId={selectedLocation}
                  isSidebarOpen={isSidebarOpen}
                  selectedAlertId={selectedAlertId}
                  setSelectedAlertId={setSelectedAlertId}
                  filterType={filterType}
                  setFilterType={setFilterType}
                  searchResultNodes={searchResults?.nodes || null}
                />

                <button
                  aria-label="Toggle Sidebar"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className={`absolute top-6 z-50 bg-white dark:bg-[#252830] border border-slate-200 dark:border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.5)] rounded-full p-1.5 hover:bg-slate-50 dark:hover:bg-[#2d313a] transition-all duration-300 text-[#5a5b60] dark:text-slate-300 focus:outline-none ${isSidebarOpen ? '-right-4' : '-right-14'}`}
                >
                  {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                </button>
              </div>
            )}

            {!selectedLocation && (isLoading || searchResults) && (
              <div className="absolute top-0 left-0 h-full flex z-20 shrink-0 bg-white dark:bg-[#1a1c23] shadow-2xl dark:shadow-[0_0_50px_rgba(0,0,0,0.6)]">
                <SearchResultsSidebar
                  answer={searchResults?.answer}
                  nodes={searchResults?.nodes || []}
                  isLoading={isLoading}
                  loadingStep={loadingStep}
                  onNodeClick={(id) => {
                    setFocusedNodeId(id);
                  }}
                  focusedNodeId={focusedNodeId}
                />
              </div>
            )}

            <GraphCanvas
              locationId={selectedLocation}
              isSidebarOpen={(isSidebarOpen && !!selectedLocation) || (!selectedLocation && !!(isLoading || searchResults))}
              selectedAlertId={selectedAlertId}
              focusedNodeId={focusedNodeId}
              isDarkMode={isDarkMode}
              filterType={filterType}
              onNodeSelect={setInspectedNode}
              searchResultNodes={searchResults?.nodes || null}
              searchResultLinks={searchResults?.links || null}
            />

            <NodeInspector
              isOpen={!!inspectedNode}
              nodeData={inspectedNode}
              onClose={() => setInspectedNode(null)}
            />
          </>
        )}
      </main>
    </div>
  );
}