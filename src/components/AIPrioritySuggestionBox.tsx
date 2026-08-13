import React, { useState, useEffect } from 'react';
import { JobCard } from '../types';
import { 
  Sparkles, 
  Flame, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  ArrowRight, 
  ShieldAlert, 
  ListChecks, 
  Activity,
  Zap,
  TrendingUp,
  Sliders
} from 'lucide-react';

export interface AIPriorityAnalysis {
  suggestedPriority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  urgencyScore: number;
  headline: string;
  keyReasons: string[];
  recommendedActions: string[];
  estimatedRisk: string;
  shouldBeMarkedUrgent: boolean;
}

interface AIPrioritySuggestionBoxProps {
  card: JobCard;
  onApplyUrgencyToggle?: (isUrgent: boolean) => void;
  onSetTargetToday?: () => void;
}

export function AIPrioritySuggestionBox({
  card,
  onApplyUrgencyToggle,
  onSetTargetToday,
}: AIPrioritySuggestionBoxProps) {
  const [analysis, setAnalysis] = useState<AIPriorityAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const completedCount = card.tasks.filter((t) => t.status === 'COMPLETED').length;
  const totalCount = card.tasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const pendingApprovalsCount = card.tasks.filter(
    (t) => t.requiresCustomerApproval && t.isCustomerApproved === null
  ).length;

  const pendingRequisitionsCount = card.tasks.reduce((acc, t) => {
    if (t.requisitions) {
      return acc + t.requisitions.filter((r) => r.status === 'PENDING_APPROVAL').length;
    }
    return acc;
  }, 0);

  const analyzeJobPriority = async () => {
    setLoading(true);
    setError(null);

    const jobContext = {
      id: card.id,
      vehicle: `${card.vehicle.make} ${card.vehicle.model} (${card.vehicle.registrationNumber})`,
      status: card.status,
      isUrgent: card.isUrgent || false,
      createdAt: card.createdAt,
      estimatedCompletionDate: card.estimatedCompletionDate,
      completedCount,
      totalCount,
      progressPct,
      pendingApprovalsCount,
      pendingRequisitionsCount,
      tasksSummary: card.tasks.map((t) => ({
        title: t.title,
        category: t.category,
        status: t.status,
        assignedTo: t.assignedToName || 'Unassigned',
      })),
    };

    try {
      const res = await fetch('/api/ai-priority-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobContext }),
      });

      const data = await res.json();
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
      } else {
        throw new Error(data.error || 'Failed to fetch AI priority suggestion');
      }
    } catch (err: any) {
      console.error('Error fetching AI priority suggestion:', err);
      // Fallback local logic in frontend if network fails
      setAnalysis(generateLocalPriorityAnalysis(card, completedCount, totalCount, progressPct, pendingApprovalsCount, pendingRequisitionsCount));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyzeJobPriority();
  }, [card.id, card.estimatedCompletionDate, card.tasks.length, completedCount, card.isUrgent]);

  // Local fallback generator for offline or network issues
  function generateLocalPriorityAnalysis(
    c: JobCard,
    comp: number,
    tot: number,
    pct: number,
    pAppr: number,
    pReq: number
  ): AIPriorityAnalysis {
    const today = new Date().toISOString().split('T')[0];
    const estDate = c.estimatedCompletionDate || today;
    const isTodayOrPast = estDate <= today;
    const remTasks = tot - comp;

    if (isTodayOrPast && pct < 70) {
      return {
        suggestedPriority: 'CRITICAL',
        urgencyScore: 94,
        headline: `CRITICAL ALERT: Target delivery is ${estDate === today ? 'TODAY' : 'OVERDUE'} with ${remTasks} task(s) unfinished (${pct}% done).`,
        keyReasons: [
          `Promised completion date (${estDate}) requires immediate floor focus.`,
          `Only ${comp} of ${tot} tasks are completed (${pct}% overall progress).`,
          pAppr > 0 ? `${pAppr} customer approval item(s) currently pending sign-off.` : 'Multiple active tasks require dedicated mechanic allocation.'
        ],
        recommendedActions: [
          'Reassign active mechanics to clear bottlenecks on remaining tasks.',
          'Escalate customer approvals with service advisor immediately.',
          'Mark job card as 🔥 URGENT for priority bay allocation.'
        ],
        estimatedRisk: 'High risk of delayed customer vehicle delivery.',
        shouldBeMarkedUrgent: true
      };
    } else if (isTodayOrPast || pct < 50 || c.isUrgent || pReq > 0) {
      return {
        suggestedPriority: 'HIGH',
        urgencyScore: 78,
        headline: `HIGH PRIORITY: Target delivery on ${estDate} with ${remTasks} task(s) remaining (${pct}% completed).`,
        keyReasons: [
          `Delivery deadline is scheduled for ${estDate}.`,
          `${remTasks} remaining task(s) in workshop pipeline.`,
          pReq > 0 ? `${pReq} spare part requisition(s) pending fulfillment.` : 'Progress rate requires monitoring.'
        ],
        recommendedActions: [
          'Expedite required spare parts issuing from store inventory.',
          'Assign senior technician to oversee remaining task completion.',
          'Verify midpoint QC checklist.'
        ],
        estimatedRisk: 'Moderate risk of workflow bottleneck.',
        shouldBeMarkedUrgent: true
      };
    } else if (pct >= 80) {
      return {
        suggestedPriority: 'LOW',
        urgencyScore: 22,
        headline: `ON TRACK: ${pct}% completed. Final inspection & vehicle delivery prep active.`,
        keyReasons: [
          `Most repair tasks (${comp}/${tot}) are finished successfully.`,
          `Delivery date (${estDate}) has ample margin.`,
          'No critical part or estimate blockers flagged.'
        ],
        recommendedActions: [
          'Perform final Quality Control (QC) inspection.',
          'Send vehicle for washing and detailing.',
          'Prepare final GST invoice.'
        ],
        estimatedRisk: 'Low risk. On track for timely customer delivery.',
        shouldBeMarkedUrgent: false
      };
    } else {
      return {
        suggestedPriority: 'MEDIUM',
        urgencyScore: 50,
        headline: `STANDARD PRIORITY: ${pct}% completed for target completion date ${estDate}.`,
        keyReasons: [
          `Job is progressing steadily (${comp}/${tot} tasks completed).`,
          `Promised delivery date (${estDate}) allows sufficient time.`,
          'Assigned team specialists are working on schedule.'
        ],
        recommendedActions: [
          'Maintain regular repair workflow sequence.',
          'Monitor task log updates from assigned mechanics.'
        ],
        estimatedRisk: 'Low-Moderate risk under standard conditions.',
        shouldBeMarkedUrgent: c.isUrgent || false
      };
    }
  }

  const getPriorityTheme = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return {
          bg: 'bg-rose-950/40 dark:bg-rose-950/60',
          border: 'border-rose-500/50',
          badgeBg: 'bg-rose-500 text-white',
          badgeBorder: 'border-rose-400',
          textColor: 'text-rose-400',
          barColor: 'bg-rose-500',
          glow: 'shadow-rose-500/20 shadow-lg',
          icon: <Flame className="w-5 h-5 text-rose-400 animate-pulse" />
        };
      case 'HIGH':
        return {
          bg: 'bg-amber-950/40 dark:bg-amber-950/60',
          border: 'border-amber-500/50',
          badgeBg: 'bg-amber-500 text-slate-950 font-black',
          badgeBorder: 'border-amber-400',
          textColor: 'text-amber-400',
          barColor: 'bg-amber-500',
          glow: 'shadow-amber-500/20 shadow-lg',
          icon: <Flame className="w-5 h-5 text-amber-400" />
        };
      case 'MEDIUM':
        return {
          bg: 'bg-blue-950/40 dark:bg-blue-950/60',
          border: 'border-blue-500/40',
          badgeBg: 'bg-blue-500 text-white font-bold',
          badgeBorder: 'border-blue-400',
          textColor: 'text-blue-400',
          barColor: 'bg-blue-500',
          glow: 'shadow-blue-500/10',
          icon: <Activity className="w-5 h-5 text-blue-400" />
        };
      case 'LOW':
      default:
        return {
          bg: 'bg-emerald-950/40 dark:bg-emerald-950/60',
          border: 'border-emerald-500/40',
          badgeBg: 'bg-emerald-500 text-slate-950 font-black',
          badgeBorder: 'border-emerald-400',
          textColor: 'text-emerald-400',
          barColor: 'bg-emerald-500',
          glow: 'shadow-emerald-500/10',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        };
    }
  };

  const currentTheme = analysis ? getPriorityTheme(analysis.suggestedPriority) : getPriorityTheme('MEDIUM');

  return (
    <div className={`mx-4 my-3 rounded-2xl border transition-all overflow-hidden ${currentTheme.border} ${currentTheme.bg} ${currentTheme.glow}`}>
      {/* Box Header */}
      <div className="p-3.5 sm:p-4 bg-slate-950/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-purple-400 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-white tracking-wide flex items-center gap-1.5">
                AI Priority Advisor
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                Gemini 3.6 Flash
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Real-time deadline & progress analysis for workshop allocation</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={analyzeJobPriority}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
            title="Re-analyze priority with Gemini AI"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            <span>{loading ? 'Analyzing...' : 'Re-analyze'}</span>
          </button>

          {/* Expand/Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono transition-all"
          >
            {isExpanded ? 'Hide' : 'Details'}
          </button>
        </div>
      </div>

      {/* Analysis Content */}
      {loading && !analysis && (
        <div className="p-6 text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-purple-400 text-sm font-bold animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Analyzing deadline, task dependencies & customer approvals...</span>
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Comparing promised delivery ({card.estimatedCompletionDate || 'Not set'}) with current progress ({progressPct}%).
          </p>
        </div>
      )}

      {analysis && (
        <div className="p-4 space-y-4">
          {/* Main Priority Status Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="shrink-0">{currentTheme.icon}</div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Suggested Priority:</span>
                  <span className={`px-3 py-0.5 rounded-lg text-xs tracking-wide uppercase ${currentTheme.badgeBg} border ${currentTheme.badgeBorder}`}>
                    {analysis.suggestedPriority} PRIORITY
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-300">
                    Urgency Score: <strong className={currentTheme.textColor}>{analysis.urgencyScore}/100</strong>
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-200 mt-1 leading-snug">
                  {analysis.headline}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              {analysis.shouldBeMarkedUrgent && !card.isUrgent && onApplyUrgencyToggle && (
                <button
                  type="button"
                  onClick={() => onApplyUrgencyToggle(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 border border-rose-400 text-xs font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                >
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  <span>Apply & Mark 🔥 URGENT</span>
                </button>
              )}

              {(!card.estimatedCompletionDate || card.estimatedCompletionDate > new Date().toISOString().split('T')[0]) &&
               analysis.suggestedPriority === 'CRITICAL' && onSetTargetToday && (
                <button
                  type="button"
                  onClick={onSetTargetToday}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 text-xs font-extrabold flex items-center gap-1.5 transition-all"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Set Target Today</span>
                </button>
              )}
            </div>
          </div>

          {/* Visual Urgency Gauge Bar */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>Low Urgency</span>
              <span>Medium</span>
              <span className="text-amber-400 font-bold">High</span>
              <span className="text-rose-400 font-black">Critical Urgency</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden p-0.5 border border-slate-800">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${currentTheme.barColor}`} 
                style={{ width: `${Math.max(5, analysis.urgencyScore)}%` }} 
              />
            </div>
          </div>

          {/* Expanded Breakdown Grid */}
          {isExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 border-t border-slate-800/80 text-xs">
              {/* Key Analytical Reasons */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/90 space-y-2">
                <div className="flex items-center gap-1.5 text-slate-300 font-black tracking-wide text-[11px] uppercase">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>Analytical Drivers</span>
                </div>
                <ul className="space-y-1.5">
                  {analysis.keyReasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-300 text-[11px] leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommended Team Next Steps */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/90 space-y-2">
                <div className="flex items-center gap-1.5 text-slate-300 font-black tracking-wide text-[11px] uppercase">
                  <ListChecks className="w-3.5 h-3.5 text-purple-400" />
                  <span>Recommended Action Steps</span>
                </div>
                <ul className="space-y-1.5">
                  {analysis.recommendedActions.map((action, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-300 text-[11px] leading-relaxed">
                      <ArrowRight className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Risk Footer */}
          {analysis.estimatedRisk && (
            <div className="flex items-center justify-between text-[11px] bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/60 text-slate-400">
              <span className="flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Risk Assessment: <strong className="text-slate-200">{analysis.estimatedRisk}</strong></span>
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                Deadline: {card.estimatedCompletionDate || 'Not set'} • Tasks: {completedCount}/{totalCount}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
