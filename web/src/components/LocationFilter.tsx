"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, ChevronDown, Search, Filter } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  specialisms: string[];
  serviceTypes: string[];
}

interface LocationFilterProps {
  selectedLocationId: string | null;
  onLocationChange: (id: string) => void;
}

export default function LocationFilter({ selectedLocationId, onLocationChange }: LocationFilterProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Advanced Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSpecialisms, setSelectedSpecialisms] = useState<Set<string>>(new Set());
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fetch locations on mount
  useEffect(() => {
    setIsLoading(true);
    fetch('/api/locations')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLocations(data);
        }
      })
      .catch(err => console.error("Failed to load locations", err))
      .finally(() => setIsLoading(false));
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowFilters(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, []);

  // Extract unique filter categories
  const allSpecialisms = useMemo(() => Array.from(new Set(locations.flatMap(l => l.specialisms))).sort(), [locations]);
  const allServices = useMemo(() => Array.from(new Set(locations.flatMap(l => l.serviceTypes))).sort(), [locations]);

  // Apply Search and Filters
  const filteredLocations = useMemo(() => {
    return locations.filter(loc => {
      // 1. Text Search
      const textMatch = loc.name.toLowerCase().includes(searchTerm.toLowerCase()) || loc.id.toLowerCase().includes(searchTerm.toLowerCase());
      if (!textMatch) return false;

      // 2. Specialism Filter (OR logic within the category)
      if (selectedSpecialisms.size > 0) {
        const hasSpecialism = loc.specialisms.some(s => selectedSpecialisms.has(s));
        if (!hasSpecialism) return false;
      }

      // 3. Service Filter (OR logic within the category)
      if (selectedServices.size > 0) {
        const hasService = loc.serviceTypes.some(s => selectedServices.has(s));
        if (!hasService) return false;
      }

      return true;
    });
  }, [locations, searchTerm, selectedSpecialisms, selectedServices]);

  // Helper to determine text
  const getButtonText = () => {
    if (isLoading) return "Fetching locations...";
    const selectedLoc = locations.find(l => l.id === selectedLocationId);
    if (selectedLoc) return `${selectedLoc.name} (${selectedLoc.id})`;
    if (selectedLocationId) return `Location (${selectedLocationId})`;
    return "Search for Location...";
  };

  const toggleSpecialism = (spec: string) => {
    const newSet = new Set(selectedSpecialisms);
    if (newSet.has(spec)) newSet.delete(spec);
    else newSet.add(spec);
    setSelectedSpecialisms(newSet);
  };

  const toggleService = (svc: string) => {
    const newSet = new Set(selectedServices);
    if (newSet.has(svc)) newSet.delete(svc);
    else newSet.add(svc);
    setSelectedServices(newSet);
  };

  return (
    <div ref={wrapperRef} className="relative group w-[450px] max-w-[35vw] shrink z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`flex items-center gap-3 pl-12 pr-12 py-3 rounded-full bg-white/40 dark:bg-[#252830]/60 hover:bg-white dark:hover:bg-[#2d313a] backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm transition-all focus:ring-2 focus:ring-[#0058bb]/50 w-full text-left overflow-hidden ${isLoading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <MapPin className={`w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${isLoading ? 'text-slate-400' : 'text-[#0058bb] dark:text-[#4b8eff]'}`} />
        <div className="truncate w-full text-sm font-semibold text-slate-800 dark:text-slate-200 mt-[1px]">
          {getButtonText()}
        </div>
        <ChevronDown className={`w-4 h-4 text-[#5a5b60] dark:text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-[115%] left-0 w-full min-w-[340px] bg-white/95 dark:bg-[#1a1c23]/95 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col pt-3 animate-in fade-in slide-in-from-top-4 duration-200">
          
          <div className="px-3 pb-3 relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
              <input
                type="text"
                className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-black/30 text-[#2d2f33] dark:text-white text-sm border border-transparent rounded-xl outline-none focus:ring-2 focus:ring-[#0058bb]/30 dark:focus:ring-[#4b8eff]/30 placeholder:text-slate-400 transition-all font-medium"
                placeholder="Search Name or CQC ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 rounded-xl transition-colors border ${showFilters || selectedSpecialisms.size > 0 || selectedServices.size > 0 ? 'bg-[#0058bb]/10 border-[#0058bb]/20 text-[#0058bb] dark:bg-[#4b8eff]/10 dark:border-[#4b8eff]/20 dark:text-[#4b8eff]' : 'bg-slate-100 dark:bg-black/30 border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}
              title="Advanced Filters"
            >
              <Filter size={16} />
            </button>
          </div>

          {showFilters && (
            <div className="px-4 pb-4 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#13141a]/50 flex flex-col gap-3 max-h-[250px] overflow-y-auto custom-scrollbar">
              {allSpecialisms.length > 0 && (
                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#0058bb] dark:text-[#4b8eff]">Specialisms</span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {allSpecialisms.map(spec => (
                      <button 
                        key={spec} 
                        onClick={() => toggleSpecialism(spec)}
                        className={`px-3 py-1.5 rounded-full border transition-all ${selectedSpecialisms.has(spec) ? 'bg-[#0058bb] border-[#0058bb] text-white shadow-sm' : 'bg-white dark:bg-[#252830] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'}`}
                      >
                        {spec}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {allServices.length > 0 && (
                <div className="flex flex-col gap-2 mt-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#0058bb] dark:text-[#4b8eff]">Service Types</span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {allServices.map(svc => (
                      <button 
                        key={svc} 
                        onClick={() => toggleService(svc)}
                        className={`px-3 py-1.5 rounded-full border transition-all ${selectedServices.has(svc) ? 'bg-[#0058bb] border-[#0058bb] text-white shadow-sm' : 'bg-white dark:bg-[#252830] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'}`}
                      >
                        {svc}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!showFilters && <div className="h-[1px] bg-slate-200 dark:bg-white/5 w-full"></div>}

          <div className="max-h-[300px] overflow-y-auto px-2 py-2 custom-scrollbar">
            {/* Always show All Locations option at the top to clear bounds */}
            <button
              onClick={() => { onLocationChange(''); setIsOpen(false); setSearchTerm(''); }}
              className={`w-full flex flex-col text-left px-4 py-3 rounded-xl transition-all mb-1 ${!selectedLocationId ? 'bg-[#0058bb]/10 dark:bg-[#4b8eff]/20 text-[#0058bb] dark:text-[#4b8eff]' : 'text-[#2d2f33] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'}`}
            >
              <div className="flex justify-between items-center w-full">
                <span className="font-semibold text-sm truncate mr-3">All Locations (Global Search)</span>
              </div>
            </button>
            <div className="h-[1px] bg-slate-200 dark:bg-white/5 w-full mx-auto my-1 mb-2 max-w-[95%]"></div>

            {filteredLocations.map(loc => (
              <button
                key={loc.id}
                onClick={() => { onLocationChange(loc.id); setIsOpen(false); setSearchTerm(''); }}
                className={`w-full flex flex-col text-left px-4 py-3 rounded-xl transition-all mb-1 ${selectedLocationId === loc.id ? 'bg-[#0058bb]/10 dark:bg-[#4b8eff]/20 text-[#0058bb] dark:text-[#4b8eff]' : 'text-[#2d2f33] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'}`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="font-semibold text-sm truncate mr-3">{loc.name}</span>
                  <span className={`text-[0.65rem] uppercase tracking-wider font-bold shrink-0 ${selectedLocationId === loc.id ? 'text-[#0058bb]/70 dark:text-[#4b8eff]/70' : 'text-slate-400 dark:text-slate-500'}`}>
                    {loc.id}
                  </span>
                </div>
                {/* Micro-preview of specialisms/services below the text */}
                {(loc.specialisms.length > 0 || loc.serviceTypes.length > 0) && (
                   <div className="flex flex-wrap gap-1 mt-1.5 opacity-60">
                     {loc.specialisms.slice(0,2).map(s => <span key={s} className="text-[0.55rem] uppercase tracking-widest font-bold border border-current px-1.5 py-0.5 rounded-sm">{s}</span>)}
                   </div>
                )}
              </button>
            ))}

            {filteredLocations.length === 0 && (
              <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400 text-center font-medium">
                No matching locations found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}