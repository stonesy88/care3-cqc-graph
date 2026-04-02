"use client";

import React, { useState, useMemo, useEffect } from 'react';

export interface PolicyStep {
  id: string;
  step_order: number;
  expected_action_id: string;
  time_limit: number;
  time_unit: 'Seconds' | 'Minutes' | 'Hours' | 'Days';
}

export interface ActionDefinition {
  id: string;
  label: string;
}

export interface EventDefinition {
  id: string;
  label: string;
}

export interface KeyStatement {
  qs_id: string;
  qs_name: string;
}

interface PolicyBuilderProps {
  availableKeyStatements?: KeyStatement[];
  availableActions?: ActionDefinition[];
  availableTriggers?: EventDefinition[];
}

const CQC_QUALITY_STATEMENTS: KeyStatement[] = [
  { qs_id: '1', qs_name: 'Learning culture' },
  { qs_id: '2', qs_name: 'Safe systems, pathways and transitions' },
  { qs_id: '3', qs_name: 'Safeguarding' },
  { qs_id: '4', qs_name: 'Involving people to manage risks' },
  { qs_id: '5', qs_name: 'Safe environments' },
  { qs_id: '6', qs_name: 'Safe and effective staffing' },
  { qs_id: '7', qs_name: 'Infection prevention and control' },
  { qs_id: '8', qs_name: 'Medicines optimisation' },
  { qs_id: '9', qs_name: 'Assessing needs' },
  { qs_id: '10', qs_name: 'Delivering evidence-based care and treatment' },
  { qs_id: '11', qs_name: 'How staff, teams and services work together' },
  { qs_id: '12', qs_name: 'Supporting people to live healthier lives' },
  { qs_id: '13', qs_name: 'Monitoring and improving outcomes' },
  { qs_id: '14', qs_name: 'Consent to care and treatment' },
  { qs_id: '15', qs_name: 'Kindness, compassion and dignity' },
  { qs_id: '16', qs_name: 'Treating people as individuals' },
  { qs_id: '17', qs_name: 'Independence, choice and control' },
  { qs_id: '18', qs_name: 'Responding to people’s immediate needs' },
  { qs_id: '19', qs_name: 'Workforce wellbeing and enablement' },
  { qs_id: '20', qs_name: 'Person-centred Care' },
  { qs_id: '21', qs_name: 'Care provision, Integration and continuity' },
  { qs_id: '22', qs_name: 'Providing Information' },
  { qs_id: '23', qs_name: 'Listening to and involving people' },
  { qs_id: '24', qs_name: 'Equity in access' },
  { qs_id: '25', qs_name: 'Equity in experiences and outcomes' },
  { qs_id: '26', qs_name: 'Planning for the future' },
  { qs_id: '27', qs_name: 'Shared direction and culture' },
  { qs_id: '28', qs_name: 'Capable, compassionate and inclusive leaders' },
  { qs_id: '29', qs_name: 'Freedom to speak up' },
  { qs_id: '30', qs_name: 'Workforce equality, diversity and inclusion' },
  { qs_id: '31', qs_name: 'Governance, management and sustainability' },
  { qs_id: '32', qs_name: 'Partnerships and communities' },
  { qs_id: '33', qs_name: 'Learning, improvement and innovation' },
  { qs_id: '34', qs_name: 'Environmental sustainability - sustainable development' }
];

const DEFAULT_ACTIONS: ActionDefinition[] = [
  { id: 'OBS_NEURO', label: 'Neurological Observation' },
  { id: 'NOTIFY_FAMILY', label: 'Notify Family/NOK' },
  { id: 'CALL_PARAMEDIC', label: 'Call Paramedic' }
];

const DEFAULT_TRIGGERS: EventDefinition[] = [
  { id: 'FALL_RESIDENT', label: 'Resident Fall' },
  { id: 'MED_MISSED', label: 'Missed Medication' },
  { id: 'INCIDENT_SAFEGUARDING', label: 'Safeguarding Alert' }
];

export default function PolicyBuilder({ 
  availableKeyStatements = CQC_QUALITY_STATEMENTS,
  availableActions = DEFAULT_ACTIONS,
  availableTriggers = DEFAULT_TRIGGERS
}: PolicyBuilderProps) {
  // State Management
  const defaultAction = availableActions.length > 0 ? availableActions[0].id : '';
  const defaultTrigger = availableTriggers.length > 0 ? availableTriggers[0].id : '';
  const [policyName, setPolicyName] = useState<string>("Post-Fall Protocol");
  const [triggerEventId, setTriggerEventId] = useState<string>(defaultTrigger);
  const [selectedKeyStatementIds, setSelectedKeyStatementIds] = useState<string[]>([]);
  
  const [steps, setSteps] = useState<PolicyStep[]>([{
    id: crypto.randomUUID(),
    step_order: 1,
    expected_action_id: defaultAction,
    time_limit: 1,
    time_unit: 'Hours'
  }]);

  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [savedPolicies, setSavedPolicies] = useState<any[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(true);

  const fetchPolicies = async () => {
    setIsLoadingPolicies(true);
    try {
      const res = await fetch('/api/policies');
      if (res.ok) {
        const data = await res.json();
        setSavedPolicies(data.policies || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingPolicies(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleSelectPolicy = (policy: any) => {
    setSelectedPolicyId(policy.id);
    setPolicyName(policy.name);
    setTriggerEventId(policy.triggerEventId);
    setSelectedKeyStatementIds(policy.qsIds || []);
    
    if (policy.steps && Array.isArray(policy.steps) && policy.steps.length > 0) {
      setSteps(policy.steps.map((s: any, idx: number) => {
        let limit = Math.round((s.max_delay_minutes || 60) * 100) / 100;
        let unit: 'Seconds' | 'Minutes' | 'Hours' | 'Days' = 'Minutes';
        
        if (limit >= 1440 && limit % 1440 === 0) { limit /= 1440; unit = 'Days'; }
        else if (limit >= 60 && limit % 60 === 0) { limit /= 60; unit = 'Hours'; }
        else if (limit < 1) { limit = Math.round(limit * 60); unit = 'Seconds'; } 
        
        return {
          id: crypto.randomUUID(),
          step_order: s.step_order || idx + 1,
          expected_action_id: s.expected_action_id || defaultAction,
          time_limit: limit,
          time_unit: unit
        };
      }));
    } else {
      setSteps([{ id: crypto.randomUUID(), step_order: 1, expected_action_id: defaultAction, time_limit: 1, time_unit: 'Hours' }]);
    }
  };

  const handleCreateNew = () => {
    setSelectedPolicyId(null);
    setPolicyName("New Protocol");
    setTriggerEventId(defaultTrigger);
    setSelectedKeyStatementIds([]);
    setSteps([{ id: crypto.randomUUID(), step_order: 1, expected_action_id: defaultAction, time_limit: 1, time_unit: 'Hours' }]);
  };

  const handleDeletePolicy = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this policy?")) return;
    try {
      const res = await fetch(`/api/policies/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedPolicyId === id) handleCreateNew();
        fetchPolicies();
      }
    } catch(err) {
      console.error(err);
    }
  };

  // The Math & Payload Generator
  const generatedPayload = useMemo(() => {
    const formattedSteps = steps.map(step => {
      let maxDelayMinutes = step.time_limit;
      if (step.time_unit === 'Seconds') maxDelayMinutes = step.time_limit / 60;
      if (step.time_unit === 'Hours') maxDelayMinutes = step.time_limit * 60;
      if (step.time_unit === 'Days') maxDelayMinutes = step.time_limit * 1440;

      return {
        step_order: step.step_order,
        expected_action_id: step.expected_action_id,
        max_delay_minutes: maxDelayMinutes
      };
    });

    return {
      policy_id: selectedPolicyId || undefined,
      policy_name: policyName,
      trigger_event_id: triggerEventId,
      qs_ids: selectedKeyStatementIds,
      is_active: true,
      steps: formattedSteps
    };
  }, [selectedPolicyId, policyName, triggerEventId, selectedKeyStatementIds, steps]);

  // Handlers
  const toggleKeyStatement = (id: string) => {
    setSelectedKeyStatementIds(prev => 
      prev.includes(id) 
        ? prev.filter(stmtId => stmtId !== id)
        : [...prev, id]
    );
  };

  const addStep = () => {
    setSteps(prev => [
      ...prev, 
      {
        id: crypto.randomUUID(),
        step_order: prev.length + 1,
        expected_action_id: defaultAction,
        time_limit: 1,
        time_unit: 'Hours'
      }
    ]);
  };

  const removeStep = (idToRemove: string) => {
    setSteps(prev => {
      const filtered = prev.filter(s => s.id !== idToRemove);
      // Re-index step orders sequentially
      return filtered.map((s, index) => ({
        ...s,
        step_order: index + 1
      }));
    });
  };

  const updateStep = (id: string, updates: Partial<PolicyStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const [isDeploying, setIsDeploying] = useState(false);

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      const response = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generatedPayload)
      });
      if (!response.ok) throw new Error('Failed to save policy');
      const data = await response.json();
      console.log("Deployed successfully:", data);
      alert("Policy activated successfully!");
      fetchPolicies();
    } catch (e) {
      console.error(e);
      alert("Failed to activate policy");
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 lg:p-8 bg-zinc-50 min-h-screen flex flex-col lg:flex-row gap-8">
      
      {/* SAVED POLICIES SIDEBAR */}
      <div className="w-full lg:w-1/4 flex flex-col gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-zinc-200 sticky top-8 flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-zinc-900 border-b-2 border-blue-500 pb-1">Saved Policies</h2>
            <button onClick={handleCreateNew} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" title="Create New Policy">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
            {isLoadingPolicies ? (
              <p className="text-sm text-zinc-500 animate-pulse text-center py-4">Loading policies...</p>
            ) : savedPolicies.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-4">No policies saved.</p>
            ) : (
              savedPolicies.map(policy => (
                <div 
                  key={policy.id} 
                  onClick={() => handleSelectPolicy(policy)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedPolicyId === policy.id
                      ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400' 
                      : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-zinc-800 line-clamp-1">{policy.name}</h3>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[0.65rem] font-medium text-zinc-400 uppercase tracking-widest">
                          {policy.triggerEventId.split('_').join(' ')}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => handleDeletePolicy(policy.id, e)}
                      className="ml-2 text-zinc-400 hover:text-red-500 p-1 opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PANE: BUILDER MAIN */}
      <div className="flex-1">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">{selectedPolicyId ? 'Edit Selected Framework' : 'Sequential Policy Builder'}</h1>
            <p className="text-zinc-500 mt-2">Design strict event-driven workflows tied to specific Quality Statements.</p>
          </div>
          {selectedPolicyId && (
            <span className="px-4 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-bold shadow-sm whitespace-nowrap">
              Editing Target ID: {selectedPolicyId.substring(0,8)}...
            </span>
          )}
        </div>

        <div className="grid xl:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: The Form */}
        <div className="flex flex-col space-y-8">
          
          {/* Base Configuration */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
            <h2 className="text-lg font-semibold text-zinc-800 mb-4">Core Definition</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Policy Name</label>
                <input 
                  type="text" 
                  value={policyName}
                  onChange={(e) => setPolicyName(e.target.value)}
                  className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="e.g., Post-Fall Protocol"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Trigger Event</label>
                <select 
                  value={triggerEventId}
                  onChange={(e) => setTriggerEventId(e.target.value)}
                  className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                >
                  {availableTriggers.map(trigger => (
                    <option key={trigger.id} value={trigger.id}>
                      {trigger.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Multi-Select Pills */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Linked Key Statements</label>
                <div className="flex flex-wrap gap-2">
                  {availableKeyStatements.map(stmt => {
                    const isSelected = selectedKeyStatementIds.includes(stmt.qs_id);
                    return (
                      <button
                        key={stmt.qs_id}
                        onClick={() => toggleKeyStatement(stmt.qs_id)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all border ${
                          isSelected 
                            ? 'bg-blue-100 text-blue-800 border-blue-300 shadow-sm' 
                            : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200'
                        }`}
                      >
                        {stmt.qs_name}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Sequential Steps Builder */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-lg font-semibold text-zinc-800">Sequential Steps</h2>
              <span className="text-sm font-medium text-zinc-500">{steps.length} {steps.length === 1 ? 'Step' : 'Steps'}</span>
            </div>

            {steps.map((step, index) => (
              <div key={step.id} className="bg-white p-5 rounded-xl shadow-sm border border-zinc-200 border-l-4 border-l-blue-500 relative group transition-all hover:shadow-md">
                
                {/* Remove Button */}
                <button 
                  onClick={() => removeStep(step.id)}
                  className="absolute top-4 right-4 text-zinc-400 hover:text-red-500 transition-colors"
                  title="Remove step"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>

                <div className="mb-4">
                  <span className="inline-flex items-center justify-center bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-md mb-3">
                    Step {step.step_order}
                  </span>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Expected Event / Action</label>
                    <select 
                      value={step.expected_action_id}
                      onChange={(e) => updateStep(step.id, { expected_action_id: e.target.value })}
                      className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                    >
                      {availableActions.map(action => (
                        <option key={action.id} value={action.id}>
                          {action.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Time Limit</label>
                    <input 
                      type="number" 
                      min="1"
                      value={step.time_limit}
                      onChange={(e) => updateStep(step.id, { time_limit: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Unit</label>
                    <select
                      value={step.time_unit}
                      onChange={(e) => updateStep(step.id, { time_unit: e.target.value as any })}
                      className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                    >
                      <option value="Seconds">Seconds</option>
                      <option value="Minutes">Minutes</option>
                      <option value="Hours">Hours</option>
                      <option value="Days">Days</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addStep}
              className="w-full py-3 border-2 border-dashed border-zinc-300 rounded-xl text-zinc-600 font-medium hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Next Step
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: The Live Preview */}
        <div className="flex flex-col h-full space-y-4 sticky top-8">
          <div className="bg-zinc-900 rounded-xl overflow-hidden shadow-lg flex flex-col h-[600px] border border-zinc-800">
            <div className="bg-zinc-950 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400 text-sm font-mono tracking-wide">payload_preview.json</span>
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
              <pre className="text-green-400 font-mono text-sm leading-relaxed">
                <code>
                  {JSON.stringify(generatedPayload, null, 2)}
                </code>
              </pre>
            </div>
            
            <div className="p-4 bg-zinc-950 border-t border-zinc-800">
              <button 
                onClick={handleDeploy}
                disabled={isDeploying}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:shadow-lg focus:ring-4 focus:ring-blue-500/30 transition-all disabled:opacity-50"
              >
                {isDeploying ? 'Activating...' : 'Activate Policy'}
              </button>
            </div>
          </div>
          
          <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex gap-3 shadow-sm border border-blue-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-sm">
              {selectedPolicyId 
                ? 'Activating this policy will clone it into a completely NEW policy instance tracking natively alongside your original ruleset!' 
                : 'The generated payload automatically converts complex time units into native Postgre database structures for safe polling!'}
            </p>
          </div>
        </div>

      </div>
      </div>
    </div>
  );
}
