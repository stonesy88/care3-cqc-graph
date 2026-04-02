"use client";

import PolicyBuilder from "../../components/PolicyBuilder";
import Link from "next/link";
import { LayoutDashboard, Waypoints, FileCheck, Bell, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";

export default function PolicyPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <div className={`${isDarkMode ? 'dark' : ''} bg-[#f6f6fb] dark:bg-[#0c0e12] font-sans min-h-screen w-screen overflow-x-hidden flex flex-col relative transition-colors duration-300`}>
      <header className="fixed top-0 left-0 w-full z-50 bg-white/70 dark:bg-[#1a1c23]/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,88,187,0.08)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] h-[88px] px-8 flex items-center justify-between border-b border-white/20 dark:border-white/5 transition-all pointer-events-auto">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-[1.75rem] font-bold tracking-tight text-[#2d2f33] dark:text-white leading-none ml-2 mr-2">Beacon</Link>
          <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 mx-2 transition-colors duration-300"></div>
          <nav className="flex items-center gap-2">
            <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all text-[#5a5b60] dark:text-slate-400 hover:text-[#2d2f33] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10">
              <LayoutDashboard size={18} />
              Dashboard
            </Link>
            <Link href="/" className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all text-[#5a5b60] dark:text-slate-400 hover:text-[#2d2f33] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10">
              <Waypoints size={18} />
              Inspector
            </Link>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all bg-white dark:bg-[#252830] text-[#0058bb] dark:text-[#4b8eff] shadow-sm border border-slate-200 dark:border-white/5 pointer-events-none">
              <FileCheck size={18} />
              Policies
            </div>
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

      <main className="flex-1 mt-[88px] w-full max-w-[100vw]">
        <PolicyBuilder />
      </main>
    </div>
  );
}
