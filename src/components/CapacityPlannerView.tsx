import React from 'react';
import { RotateCcw } from 'lucide-react';
import { ExecutiveKpis, ScenarioParams, ScenarioResult } from '../types/operations';

interface CapacityPlannerViewProps {
  kpis: ExecutiveKpis;
  params: ScenarioParams;
  result: ScenarioResult;
  onChangeParams: (next: ScenarioParams) => void;
}

export const CapacityPlannerView: React.FC<CapacityPlannerViewProps> = ({
  kpis,
  params,
  result,
  onChangeParams,
}) => {
  const applyPreset = (preset: 'reset' | 'q4' | 'automation' | 'hiring') => {
    if (preset === 'reset') {
      onChangeParams({
        demandGrowthPct: 0,
        fteDelta: 0,
        efficiencyGainPct: 0,
        overtimeBufferPct: 0,
        targetUtilizationPct: 85,
      });
    } else if (preset === 'q4') {
      onChangeParams({
        demandGrowthPct: 18,
        fteDelta: 28,
        efficiencyGainPct: 5,
        overtimeBufferPct: 8,
        targetUtilizationPct: 85,
      });
    } else if (preset === 'automation') {
      onChangeParams({
        demandGrowthPct: 10,
        fteDelta: 4,
        efficiencyGainPct: 15,
        overtimeBufferPct: 0,
        targetUtilizationPct: 85,
      });
    } else {
      onChangeParams({
        demandGrowthPct: 0,
        fteDelta: 24,
        efficiencyGainPct: 4,
        overtimeBufferPct: 0,
        targetUtilizationPct: 85,
      });
    }
  };

  // Burn-down SVG chart geometry
  const width = 620;
  const height = 220;
  const pad = { top: 20, right: 24, bottom: 30, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxBacklog = Math.max(
    500,
    ...result.burnDownSeries.map((b) => Math.max(b.baselineBacklog, b.projectedBacklog))
  ) * 1.15;

  const xPos = (i: number) => pad.left + (i / (result.burnDownSeries.length - 1)) * plotW;
  const yPos = (v: number) => pad.top + plotH - (v / maxBacklog) * plotH;

  const basePts = result.burnDownSeries.map((b, i) => `${xPos(i)},${yPos(b.baselineBacklog)}`).join(' ');
  const projPts = result.burnDownSeries.map((b, i) => `${xPos(i)},${yPos(b.projectedBacklog)}`).join(' ');

  return (
    <div className="space-y-5">
      {/* Scenario Presets Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Interactive Resource &amp; Capacity Planning Simulator
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Model headcount hiring, process automation, overtime surge buffers, and demand shocks against your active Excel scope
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyPreset('q4')}
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-colors whitespace-nowrap"
          >
            Q4 Peak (+18% Demand)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('automation')}
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-colors whitespace-nowrap"
          >
            Lean Automation (+15% Eff.)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('hiring')}
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-colors whitespace-nowrap"
          >
            Backlog Recovery (+24 FTE)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('reset')}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Baseline
          </button>
        </div>
      </div>

      {/* Main Simulator Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Controls (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
            Planning Levers
          </h4>

          {/* Slider 1: Demand Growth */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="sim-demand" className="font-medium text-slate-700">
                Projected Demand Shift
              </label>
              <span className="font-mono font-semibold text-[#0F4C81] tabular-nums">
                {params.demandGrowthPct >= 0 ? '+' : ''}
                {params.demandGrowthPct}%
              </span>
            </div>
            <input
              id="sim-demand"
              type="range"
              min={-20}
              max={40}
              step={1}
              value={params.demandGrowthPct}
              onChange={(e) => onChangeParams({ ...params, demandGrowthPct: Number(e.target.value) })}
              className="w-full accent-[#0F4C81]"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-0.5">
              <span>-20%</span>
              <span>0% Baseline</span>
              <span>+40% Surge</span>
            </div>
          </div>

          {/* Slider 2: Planned FTE Additions */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="sim-fte" className="font-medium text-slate-700">
                Planned FTE Headcount Change
              </label>
              <span className="font-mono font-semibold text-[#0F4C81] tabular-nums">
                {params.fteDelta >= 0 ? '+' : ''}
                {params.fteDelta} FTE (Total: {Math.round(kpis.avgActiveFte + params.fteDelta)})
              </span>
            </div>
            <input
              id="sim-fte"
              type="range"
              min={-15}
              max={60}
              step={1}
              value={params.fteDelta}
              onChange={(e) => onChangeParams({ ...params, fteDelta: Number(e.target.value) })}
              className="w-full accent-[#0F4C81]"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-0.5">
              <span>-15 FTE</span>
              <span>0</span>
              <span>+60 FTE</span>
            </div>
          </div>

          {/* Slider 3: Process Efficiency Gain */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="sim-eff" className="font-medium text-slate-700">
                Process Efficiency / Automation Gain
              </label>
              <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                +{params.efficiencyGainPct}% throughput/FTE
              </span>
            </div>
            <input
              id="sim-eff"
              type="range"
              min={0}
              max={25}
              step={1}
              value={params.efficiencyGainPct}
              onChange={(e) => onChangeParams({ ...params, efficiencyGainPct: Number(e.target.value) })}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-0.5">
              <span>0%</span>
              <span>+12%</span>
              <span>+25%</span>
            </div>
          </div>

          {/* Slider 4: Overtime Buffer */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="sim-ot" className="font-medium text-slate-700">
                Temporary Overtime Surge Buffer
              </label>
              <span className="font-mono font-semibold text-amber-700 tabular-nums">
                +{params.overtimeBufferPct}% capacity
              </span>
            </div>
            <input
              id="sim-ot"
              type="range"
              min={0}
              max={20}
              step={1}
              value={params.overtimeBufferPct}
              onChange={(e) => onChangeParams({ ...params, overtimeBufferPct: Number(e.target.value) })}
              className="w-full accent-amber-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-0.5">
              <span>0%</span>
              <span>+10%</span>
              <span>+20%</span>
            </div>
          </div>
        </div>

        {/* Right Outcome Projections & Burn-down Chart (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Before vs After Comparison Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3.5">
              <div className="text-[11px] text-slate-500">Projected Utilization</div>
              <div
                className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
                  result.projectedUtilizationPct >= 95
                    ? 'text-red-700'
                    : result.projectedUtilizationPct >= 88
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }`}
              >
                {result.projectedUtilizationPct.toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                Base: {kpis.utilizationPct.toFixed(1)}%
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3.5">
              <div className="text-[11px] text-slate-500">Projected Cap. Gap</div>
              <div
                className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
                  result.projectedGap < 0 ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                {result.projectedGap >= 0 ? '+' : ''}
                {result.projectedGap.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                Base: {kpis.capacityGap >= 0 ? '+' : ''}
                {kpis.capacityGap.toLocaleString()}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3.5">
              <div className="text-[11px] text-slate-500">Projected SLA %</div>
              <div
                className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
                  result.projectedSlaPct < kpis.slaTargetPct ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {result.projectedSlaPct.toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                Target: {kpis.slaTargetPct.toFixed(1)}%
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3.5">
              <div className="text-[11px] text-slate-500">Monthly Cost Impact</div>
              <div className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                {result.monthlyLaborCostDeltaUsd >= 0 ? '+' : '-'}$
                {Math.abs(result.monthlyLaborCostDeltaUsd).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                Unit Cost: ${result.projectedCostPerUnitUsd.toFixed(2)}
              </div>
            </div>
          </div>

          {/* 6-Month Backlog Burn-down Chart */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  6-Month Backlog Burn-Down Trajectory
                </h4>
                <p className="text-xs text-slate-500">
                  Simulated queue clearance vs. status quo ·{' '}
                  <span className="font-medium text-slate-800">
                    {result.monthsToClearBacklog === 0
                      ? 'Backlog already cleared'
                      : result.monthsToClearBacklog !== null
                      ? `Est. full backlog clearance in ${result.monthsToClearBacklog} month(s)`
                      : 'Capacity deficit persists — backlog continues growing'}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-400 inline-block" />
                  Baseline
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#0F4C81] inline-block" />
                  Simulated Plan
                </span>
              </div>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const val = maxBacklog * t;
                const y = yPos(val);
                return (
                  <g key={t}>
                    <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#F1F5F9" />
                    <text x={pad.left - 8} y={y + 3} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
                      {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val)}
                    </text>
                  </g>
                );
              })}

              <polyline fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="5 4" points={basePts} />
              <polyline fill="none" stroke="#0F4C81" strokeWidth="2.5" points={projPts} />

              {result.burnDownSeries.map((b, i) => (
                <g key={b.monthIndex}>
                  <circle cx={xPos(i)} cy={yPos(b.baselineBacklog)} r="3" fill="#94A3B8" />
                  <circle
                    cx={xPos(i)}
                    cy={yPos(b.projectedBacklog)}
                    r="4"
                    fill="#0F4C81"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                  <text x={xPos(i)} y={height - 10} textAnchor="middle" className="fill-slate-600 text-[10px] font-mono">
                    {b.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
