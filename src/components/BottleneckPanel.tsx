import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Users } from 'lucide-react';
import { BottleneckInsight, RegionMetric } from '../types/operations';

interface BottleneckPanelProps {
  insights: BottleneckInsight[];
  regions: RegionMetric[];
  onSelectDepartment: (dept: string) => void;
  onOpenPlanner: () => void;
}

export const BottleneckPanel: React.FC<BottleneckPanelProps> = ({
  insights,
  regions,
  onSelectDepartment,
  onOpenPlanner,
}) => {
  const totalRecommendedFte = insights.reduce((sum, b) => sum + b.recommendedFteAdd, 0);

  return (
    <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Left 2 Columns: Automated Bottleneck & Root-Cause Findings */}
      <div className="xl:col-span-2 bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Automated Bottleneck Diagnostics &amp; Stakeholder Action Plan
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Deterministic Theory of Constraints scan across capacity gaps, queue velocity, and SLA erosion
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenPlanner}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0F4C81] bg-sky-50 hover:bg-sky-100 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            Simulate +{totalRecommendedFte} FTE Plan
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {insights.map((b) => {
            const isCrit = b.severity === 'Critical';
            const isWatch = b.severity === 'Watch';
            return (
              <div key={b.id} className="py-3 first:pt-0 last:pb-0 flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isCrit ? (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    ) : isWatch ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectDepartment(b.department)}
                      className="text-xs font-semibold text-slate-900 hover:text-[#0F4C81] text-left transition-colors"
                    >
                      {b.headline}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono tabular-nums shrink-0">
                    <span
                      className={
                        isCrit
                          ? 'text-red-700 font-semibold'
                          : isWatch
                          ? 'text-amber-700 font-semibold'
                          : 'text-emerald-700 font-semibold'
                      }
                    >
                      {b.severity}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-700">
                      {b.recommendedFteAdd > 0 ? `+${b.recommendedFteAdd} FTE needed` : 'Balanced FTE'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-6">
                  <span className="font-medium text-slate-800">Driver:</span> {b.rootCause}{' '}
                  <span className="font-medium text-slate-800">Action:</span> {b.actionPlan}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Regional Capacity Balance */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Regional Capacity Balance</h3>
              <p className="text-xs text-slate-500 mt-0.5">Footprint utilization &amp; SLA attainment</p>
            </div>
            <Users className="w-4 h-4 text-slate-400 shrink-0" />
          </div>

          <div className="divide-y divide-slate-100">
            {regions.map((r) => (
              <div key={r.region} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-900">{r.region}</span>
                  <span
                    className={`font-mono font-semibold tabular-nums ${
                      r.status === 'Critical'
                        ? 'text-red-700'
                        : r.status === 'Watch'
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {r.utilizationPct.toFixed(1)}% Util ({r.status})
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 font-mono tabular-nums mt-1.5">
                  <div>
                    <div className="text-[11px] font-sans text-slate-400">Demand</div>
                    <div>{r.demandUnits.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-sans text-slate-400">Cap. Gap</div>
                    <div className={r.capacityGap < 0 ? 'text-red-700 font-medium' : 'text-emerald-700'}>
                      {r.capacityGap >= 0 ? '+' : ''}
                      {r.capacityGap.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-sans text-slate-400">SLA / FTE</div>
                    <div>
                      {r.slaActualPct.toFixed(1)}% · {r.avgFte}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between tabular-nums">
          <span>Total Recommended Rebalance</span>
          <span className="font-mono font-semibold text-slate-900">+{totalRecommendedFte} FTE</span>
        </div>
      </div>
    </section>
  );
};
