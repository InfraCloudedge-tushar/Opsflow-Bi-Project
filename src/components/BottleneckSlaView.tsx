import React from 'react';
import { DepartmentMetric, FilterState, MonthlyTrendPoint, OperationRecord, QuarterLabel } from '../types/operations';
import { BacklogSlaControlChart, CapacityGapDivergingChart } from './ExecutiveCharts';

interface BottleneckSlaViewProps {
  records: OperationRecord[];
  filters: FilterState;
  deptMetrics: DepartmentMetric[];
  monthlyTrends: MonthlyTrendPoint[];
  onSelectDepartment: (dept: string) => void;
}

const QUARTERS: QuarterLabel[] = ['Q1', 'Q2', 'Q3', 'Q4'];

export const BottleneckSlaView: React.FC<BottleneckSlaViewProps> = ({
  records,
  filters,
  deptMetrics,
  monthlyTrends,
  onSelectDepartment,
}) => {
  const activeYear = filters.year === 'ALL' ? 2026 : filters.year;

  // Build Department x Quarter Utilization Heatmap
  const heatmapRows = deptMetrics.map((d) => {
    const qCells = QUARTERS.map((q) => {
      const slice = records.filter(
        (r) =>
          r.department === d.department &&
          r.quarter === q &&
          (filters.year === 'ALL' || r.year === activeYear) &&
          (filters.region === 'ALL' || r.region === filters.region)
      );
      const demand = slice.reduce((s, r) => s + r.demandUnits, 0);
      const cap = slice.reduce((s, r) => s + r.availableCapacityUnits, 0);
      const util = cap > 0 ? (demand / cap) * 100 : 0;
      const sla = demand > 0 ? slice.reduce((s, r) => s + r.slaActualPct * r.demandUnits, 0) / demand : 0;
      return { quarter: q, util, sla, gap: cap - demand, hasData: slice.length > 0 };
    });
    return { department: d.department, region: d.region, qCells };
  });

  return (
    <div className="space-y-5">
      {/* Top Charts: Capacity Gap Diverging + Backlog vs SLA Control */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CapacityGapDivergingChart data={monthlyTrends} />
        <BacklogSlaControlChart data={monthlyTrends} />
      </div>

      {/* Department x Quarter Utilization Heatmap */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Quarterly Bottleneck Heatmap ({filters.year === 'ALL' ? 'All Years' : activeYear})
            </h3>
            <p className="text-xs text-slate-500">
              Utilization % and SLA attainment by Quarter · Highlights seasonal constraint propagation
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 bg-emerald-50 border border-emerald-200 rounded-xs inline-block" />
              Optimal (&lt;88%)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 bg-amber-50 border border-amber-200 rounded-xs inline-block" />
              Watch (88–95%)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 bg-red-50 border border-red-200 rounded-xs inline-block" />
              Critical (&ge;95%)
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-3">Region</th>
                {QUARTERS.map((q) => (
                  <th key={q} className="py-2.5 px-4 text-center">
                    {q} Util / SLA
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {heatmapRows.map((row) => (
                <tr key={row.department} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 font-semibold text-slate-900">
                    <button
                      type="button"
                      onClick={() => onSelectDepartment(row.department)}
                      className="hover:text-[#0F4C81] text-left"
                    >
                      {row.department}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">{row.region}</td>
                  {row.qCells.map((cell) => {
                    if (!cell.hasData) {
                      return (
                        <td key={cell.quarter} className="py-2.5 px-4 text-center text-slate-400 font-mono">
                          —
                        </td>
                      );
                    }
                    const bgClass =
                      cell.util >= 95
                        ? 'bg-red-50 text-red-800'
                        : cell.util >= 88
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-emerald-50/70 text-emerald-800';
                    return (
                      <td key={cell.quarter} className="py-2 px-2">
                        <div className={`rounded px-2.5 py-1.5 text-center font-mono tabular-nums ${bgClass}`}>
                          <div className="font-semibold">{cell.util.toFixed(1)}%</div>
                          <div className="text-[11px] opacity-85">SLA {cell.sla.toFixed(1)}%</div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Department Capacity & Unit Economics Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">
            Department Bottleneck Ranking, Backlog Exposure &amp; FTE Planning Matrix
          </h3>
          <p className="text-xs text-slate-500">
            Sorted by composite Bottleneck Risk Score (Utilization saturation + SLA variance + Backlog days)
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Risk Idx</th>
                <th className="py-2.5 px-3 text-right">Demand</th>
                <th className="py-2.5 px-3 text-right">Capacity</th>
                <th className="py-2.5 px-3 text-right">Cap. Gap</th>
                <th className="py-2.5 px-3 text-right">Util %</th>
                <th className="py-2.5 px-3 text-right">Backlog</th>
                <th className="py-2.5 px-3 text-right">Queue Days</th>
                <th className="py-2.5 px-3 text-right">SLA (Var)</th>
                <th className="py-2.5 px-3 text-right">FTE (Rec.)</th>
                <th className="py-2.5 px-3 text-right">OT Hrs</th>
                <th className="py-2.5 px-4 text-right">Unit Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {deptMetrics.map((d) => (
                <tr key={d.department} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-4 font-sans font-semibold text-slate-900">{d.department}</td>
                  <td
                    className={`py-2.5 px-3 font-sans font-semibold ${
                      d.status === 'Critical'
                        ? 'text-red-700'
                        : d.status === 'Watch'
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {d.status}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{d.bottleneckScore}/100</td>
                  <td className="py-2.5 px-3 text-right text-slate-800">{d.demandUnits.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600">{d.capacityUnits.toLocaleString()}</td>
                  <td
                    className={`py-2.5 px-3 text-right font-semibold ${
                      d.capacityGap < 0 ? 'text-red-700' : 'text-emerald-700'
                    }`}
                  >
                    {d.capacityGap >= 0 ? '+' : ''}
                    {d.capacityGap.toLocaleString()}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-semibold ${
                      d.utilizationPct >= 95
                        ? 'text-red-700'
                        : d.utilizationPct >= 88
                        ? 'text-amber-700'
                        : 'text-slate-900'
                    }`}
                  >
                    {d.utilizationPct.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-700">{d.endingBacklog.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-slate-700">{d.backlogDays.toFixed(1)}d</td>
                  <td
                    className={`py-2.5 px-3 text-right ${
                      d.slaVariancePp < 0 ? 'text-red-700 font-semibold' : 'text-emerald-700'
                    }`}
                  >
                    {d.slaActualPct.toFixed(1)}% ({d.slaVariancePp >= 0 ? '+' : ''}
                    {d.slaVariancePp.toFixed(1)})
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-900">
                    {d.avgFte}{' '}
                    <span className={d.recommendedFteDelta > 0 ? 'text-[#0F4C81] font-semibold' : 'text-slate-400'}>
                      ({d.recommendedFteDelta > 0 ? `+${d.recommendedFteDelta}` : d.recommendedFteDelta})
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-600">{d.overtimeHours.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-right text-slate-700">${d.avgCostPerUnitUsd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
