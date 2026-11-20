import React, { useState } from 'react';
import { DepartmentMetric, MonthlyTrendPoint } from '../types/operations';

interface DemandCapacityChartProps {
  data: MonthlyTrendPoint[];
  selectedMonth: number | 'ALL';
  onSelectMonth: (month: number) => void;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export const DemandCapacityComboChart: React.FC<DemandCapacityChartProps> = ({
  data,
  selectedMonth,
  onSelectMonth,
  svgRef,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 680;
  const height = 270;
  const pad = { top: 24, right: 48, bottom: 34, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxVolume = Math.max(
    1000,
    ...data.map((d) => Math.max(d.cyDemand, d.cyCapacity, d.cyThroughput))
  );
  const yMaxVol = Math.ceil((maxVolume * 1.12) / 1000) * 1000;
  const utilMin = 60;
  const utilMax = Math.max(115, Math.ceil(Math.max(...data.map((d) => d.cyUtilizationPct), 100) / 5) * 5);

  const yVol = (v: number) => pad.top + plotH - (v / yMaxVol) * plotH;
  const yUtil = (u: number) =>
    pad.top + plotH - (Math.max(0, Math.min(1, (u - utilMin) / (utilMax - utilMin)))) * plotH;

  const groupW = data.length > 0 ? plotW / data.length : plotW;
  const barW = Math.min(18, Math.max(8, groupW * 0.28));

  const utilPoints = data
    .map((d, i) => {
      const cx = pad.left + groupW * i + groupW / 2;
      const cy = yUtil(d.cyUtilizationPct);
      return `${cx},${cy}`;
    })
    .join(' ');

  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Demand vs. Available Capacity &amp; Utilization %
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any month bar to cross-filter dashboard · Red ceiling marks 95% bottleneck threshold
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#0F4C81] rounded-xs inline-block" />
            Demand
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-slate-300 rounded-xs inline-block" />
            Capacity
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-600 inline-block" />
            Util %
          </span>
        </div>
      </div>

      <div className="relative w-full">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none overflow-visible"
          role="img"
          aria-label="Demand vs Available Capacity and Utilization Chart"
        >
          {/* Horizontal gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const val = yMaxVol * t;
            const y = yVol(val);
            return (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                <text
                  x={pad.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-mono"
                >
                  {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                </text>
              </g>
            );
          })}

          {/* Right Y-axis Utilization ticks */}
          {[70, 85, 95, 110].map((u) => {
            if (u > utilMax) return null;
            const y = yUtil(u);
            return (
              <g key={u}>
                {(u === 85 || u === 95) && (
                  <line
                    x1={pad.left}
                    x2={width - pad.right}
                    y1={y}
                    y2={y}
                    stroke={u === 95 ? '#FCA5A5' : '#FCD34D'}
                    strokeDasharray="4 3"
                    strokeWidth="1"
                  />
                )}
                <text
                  x={width - pad.right + 6}
                  y={y + 3}
                  textAnchor="start"
                  className={`text-[10px] font-mono ${u === 95 ? 'fill-red-600 font-semibold' : 'fill-slate-400'}`}
                >
                  {u}%
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((d, i) => {
            const cx = pad.left + groupW * i + groupW / 2;
            const demandH = pad.top + plotH - yVol(d.cyDemand);
            const capH = pad.top + plotH - yVol(d.cyCapacity);
            const isSelected = selectedMonth === 'ALL' || selectedMonth === d.month;
            const isDeficit = d.cyDemand > d.cyCapacity;

            return (
              <g
                key={d.month}
                className="cursor-pointer"
                opacity={isSelected ? 1 : 0.35}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => onSelectMonth(d.month)}
              >
                <rect
                  x={cx - groupW / 2}
                  y={pad.top}
                  width={groupW}
                  height={plotH}
                  fill={hoveredIdx === i ? '#F8FAFC' : 'transparent'}
                />
                {/* Demand Bar */}
                <rect
                  x={cx - barW - 1.5}
                  y={yVol(d.cyDemand)}
                  width={barW}
                  height={Math.max(1, demandH)}
                  rx={2}
                  fill={isDeficit ? '#DC2626' : '#0F4C81'}
                />
                {/* Capacity Bar */}
                <rect
                  x={cx + 1.5}
                  y={yVol(d.cyCapacity)}
                  width={barW}
                  height={Math.max(1, capH)}
                  rx={2}
                  fill="#CBD5E1"
                />
                {/* X-axis label */}
                <text
                  x={cx}
                  y={height - 10}
                  textAnchor="middle"
                  className={`text-[10px] font-medium ${
                    selectedMonth === d.month ? 'fill-[#0F4C81] font-bold' : 'fill-slate-500'
                  }`}
                >
                  {d.monthName}
                </text>
              </g>
            );
          })}

          {/* Utilization Line */}
          {data.length > 1 && (
            <polyline
              fill="none"
              stroke="#D97706"
              strokeWidth="2.2"
              strokeLinejoin="round"
              points={utilPoints}
              className="pointer-events-none"
            />
          )}

          {/* Utilization Points */}
          {data.map((d, i) => {
            const cx = pad.left + groupW * i + groupW / 2;
            const cy = yUtil(d.cyUtilizationPct);
            const isCrit = d.cyUtilizationPct >= 95;
            return (
              <circle
                key={d.month}
                cx={cx}
                cy={cy}
                r={hoveredIdx === i ? 5 : 3.5}
                fill={isCrit ? '#DC2626' : '#D97706'}
                stroke="#FFFFFF"
                strokeWidth="1.5"
                className="pointer-events-none"
              />
            );
          })}
        </svg>

        {/* Interactive Tooltip */}
        {hovered && hoveredIdx !== null && (
          <div className="mt-2 px-3 py-2 bg-slate-900 text-white rounded-md text-xs flex flex-wrap items-center justify-between gap-4 tabular-nums">
            <span className="font-semibold">{hovered.periodLabel}</span>
            <span>Demand: {hovered.cyDemand.toLocaleString()}</span>
            <span>Capacity: {hovered.cyCapacity.toLocaleString()}</span>
            <span className={hovered.capacityGap < 0 ? 'text-red-300 font-semibold' : 'text-emerald-300 font-semibold'}>
              Gap: {hovered.capacityGap >= 0 ? '+' : ''}
              {hovered.capacityGap.toLocaleString()}
            </span>
            <span>Util: {hovered.cyUtilizationPct.toFixed(1)}%</span>
            <span>SLA: {hovered.cySlaPct.toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface YoYChartProps {
  data: MonthlyTrendPoint[];
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export const YoYSeasonalComparisonChart: React.FC<YoYChartProps> = ({ data, svgRef }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 620;
  const height = 270;
  const pad = { top: 24, right: 20, bottom: 34, left: 54 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const hasPy = data.some((d) => d.pyDemand > 0);
  const maxVal = Math.max(1000, ...data.map((d) => Math.max(d.cyDemand, d.pyDemand)));
  const minVal = Math.max(0, Math.min(...data.map((d) => Math.min(d.cyDemand, hasPy ? d.pyDemand : d.cyDemand))) * 0.8);
  const yMax = Math.ceil((maxVal * 1.08) / 1000) * 1000;
  const yMin = Math.floor(minVal / 1000) * 1000;
  const span = Math.max(1000, yMax - yMin);

  const xPos = (i: number) =>
    data.length > 1 ? pad.left + (i / (data.length - 1)) * plotW : pad.left + plotW / 2;
  const yPos = (v: number) => pad.top + plotH - ((v - yMin) / span) * plotH;

  const cyLine = data.map((d, i) => `${xPos(i)},${yPos(d.cyDemand)}`).join(' ');
  const pyLine = data.map((d, i) => `${xPos(i)},${yPos(d.pyDemand)}`).join(' ');
  const cyArea =
    data.length > 1
      ? `M ${xPos(0)},${pad.top + plotH} L ${data
          .map((d, i) => `${xPos(i)},${yPos(d.cyDemand)}`)
          .join(' L ')} L ${xPos(data.length - 1)},${pad.top + plotH} Z`
      : '';

  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Year-over-Year (YoY) Demand &amp; Seasonal Pattern
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Current year intake vs. prior year baseline · Identifies Q4 peak surge &amp; structural growth
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#0F4C81] inline-block" />
            Current Year
          </span>
          {hasPy && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-400 inline-block" />
              Prior Year
            </span>
          )}
        </div>
      </div>

      <div className="relative w-full">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none overflow-visible"
          role="img"
          aria-label="Year over Year Demand Seasonal Comparison Chart"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const val = yMin + span * t;
            const y = yPos(val);
            return (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                <text x={pad.left - 8} y={y + 3} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
                  {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : Math.round(val)}
                </text>
              </g>
            );
          })}

          {cyArea && <path d={cyArea} fill="#0F4C81" fillOpacity="0.08" />}

          {hasPy && data.length > 1 && (
            <polyline
              fill="none"
              stroke="#94A3B8"
              strokeWidth="2"
              strokeDasharray="5 4"
              points={pyLine}
            />
          )}

          {data.length > 1 && (
            <polyline fill="none" stroke="#0F4C81" strokeWidth="2.5" strokeLinejoin="round" points={cyLine} />
          )}

          {data.map((d, i) => {
            const cx = xPos(i);
            const cy = yPos(d.cyDemand);
            const py = yPos(d.pyDemand);
            const sliceW = data.length > 1 ? plotW / data.length : plotW;

            return (
              <g
                key={d.month}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-crosshair"
              >
                <rect
                  x={cx - sliceW / 2}
                  y={pad.top}
                  width={sliceW}
                  height={plotH}
                  fill="transparent"
                />
                {hoveredIdx === i && (
                  <line
                    x1={cx}
                    x2={cx}
                    y1={pad.top}
                    y2={pad.top + plotH}
                    stroke="#CBD5E1"
                    strokeDasharray="3 3"
                  />
                )}
                {hasPy && (
                  <circle
                    cx={cx}
                    cy={py}
                    r={hoveredIdx === i ? 4 : 2.5}
                    fill="#94A3B8"
                    stroke="#FFFFFF"
                    strokeWidth="1"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={hoveredIdx === i ? 5 : 3.5}
                  fill={d.seasonalIndex >= 1.15 ? '#D97706' : '#0F4C81'}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
                <text x={cx} y={height - 10} textAnchor="middle" className="fill-slate-500 text-[10px] font-medium">
                  {d.monthName}
                </text>
              </g>
            );
          })}
        </svg>

        {hovered && (
          <div className="mt-2 px-3 py-2 bg-slate-900 text-white rounded-md text-xs flex flex-wrap items-center justify-between gap-4 tabular-nums">
            <span className="font-semibold">{hovered.periodLabel}</span>
            <span>CY Demand: {hovered.cyDemand.toLocaleString()}</span>
            <span>PY Demand: {hovered.pyDemand > 0 ? hovered.pyDemand.toLocaleString() : 'N/A'}</span>
            <span className="text-sky-300 font-semibold">
              YoY:{' '}
              {hovered.demandYoYPct !== null
                ? `${hovered.demandYoYPct >= 0 ? '+' : ''}${hovered.demandYoYPct.toFixed(1)}%`
                : 'N/A'}
            </span>
            <span>Seasonal Index: {hovered.seasonalIndex.toFixed(2)}x</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const CapacityGapDivergingChart: React.FC<{ data: MonthlyTrendPoint[] }> = ({ data }) => {
  const maxAbs = Math.max(500, ...data.map((d) => Math.abs(d.capacityGap)));
  const width = 560;
  const height = 210;
  const pad = { top: 20, right: 16, bottom: 28, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const zeroY = pad.top + plotH / 2;
  const barSlot = data.length > 0 ? plotW / data.length : plotW;
  const barW = Math.min(24, Math.max(10, barSlot * 0.56));

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Net Capacity Gap Trend (Surplus / Deficit)</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Available Capacity minus Demand · Negative bars indicate immediate backlog build
          </p>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
        <line x1={pad.left} x2={width - pad.right} y1={zeroY} y2={zeroY} stroke="#94A3B8" strokeWidth="1" />
        <text x={pad.left - 6} y={pad.top + 8} textAnchor="end" className="fill-emerald-700 text-[10px] font-mono">
          +{(maxAbs / 1000).toFixed(1)}k
        </text>
        <text x={pad.left - 6} y={zeroY + 3} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
          0
        </text>
        <text x={pad.left - 6} y={pad.top + plotH} textAnchor="end" className="fill-red-700 text-[10px] font-mono">
          -{(maxAbs / 1000).toFixed(1)}k
        </text>

        {data.map((d, i) => {
          const cx = pad.left + barSlot * i + barSlot / 2;
          const barH = (Math.abs(d.capacityGap) / maxAbs) * (plotH / 2 - 4);
          const isPositive = d.capacityGap >= 0;
          const y = isPositive ? zeroY - barH : zeroY;

          return (
            <g key={d.month}>
              <rect
                x={cx - barW / 2}
                y={y}
                width={barW}
                height={Math.max(2, barH)}
                rx={2}
                fill={isPositive ? '#16A34A' : '#DC2626'}
                fillOpacity={0.85}
              />
              <text x={cx} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[10px]">
                {d.monthName}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const DepartmentUtilizationChart: React.FC<{
  departments: DepartmentMetric[];
  selectedDepartment: string | 'ALL';
  onSelectDepartment: (dept: string) => void;
}> = ({ departments, selectedDepartment, onSelectDepartment }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Department Utilization &amp; Capacity Headroom
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Click a department to cross-filter all KPIs &amp; monthly trends
          </p>
        </div>
        <span className="text-xs font-mono text-slate-500">Target: 85%</span>
      </div>

      <div className="divide-y divide-slate-100">
        {departments.map((d) => {
          const isSelected = selectedDepartment === 'ALL' || selectedDepartment === d.department;
          const barWidth = Math.min(100, (d.utilizationPct / 115) * 100);
          const targetMarkerPct = (85 / 115) * 100;
          const barColor =
            d.status === 'Critical'
              ? 'bg-red-600'
              : d.status === 'Watch'
              ? 'bg-amber-500'
              : 'bg-[#0F4C81]';

          return (
            <button
              key={d.department}
              type="button"
              onClick={() => onSelectDepartment(d.department)}
              className={`w-full py-2.5 px-2 -mx-2 rounded text-left transition-colors hover:bg-slate-50 ${
                !isSelected ? 'opacity-45' : ''
              } ${selectedDepartment === d.department ? 'bg-sky-50/70' : ''}`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-slate-900 truncate">{d.department}</span>
                  <span className="text-slate-400 shrink-0">{d.region}</span>
                </div>
                <div className="flex items-center gap-3 font-mono tabular-nums shrink-0">
                  <span className={d.capacityGap < 0 ? 'text-red-700' : 'text-slate-600'}>
                    {d.capacityGap >= 0 ? '+' : ''}
                    {d.capacityGap.toLocaleString()} cap
                  </span>
                  <span
                    className={`font-semibold ${
                      d.status === 'Critical'
                        ? 'text-red-700'
                        : d.status === 'Watch'
                        ? 'text-amber-700'
                        : 'text-slate-900'
                    }`}
                  >
                    {d.utilizationPct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="relative h-2.5 w-full bg-slate-100 rounded-sm overflow-hidden">
                <div
                  className={`h-full ${barColor} transition-all duration-200`}
                  style={{ width: `${barWidth}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-900/50"
                  style={{ left: `${targetMarkerPct}%` }}
                  title="85% Target Utilization"
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const BacklogSlaControlChart: React.FC<{ data: MonthlyTrendPoint[] }> = ({ data }) => {
  const width = 560;
  const height = 210;
  const pad = { top: 20, right: 44, bottom: 28, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxBacklog = Math.max(500, ...data.map((d) => d.cyEndingBacklog)) * 1.15;
  const slaMin = 75;
  const slaMax = 100;

  const barSlot = data.length > 0 ? plotW / data.length : plotW;
  const barW = Math.min(22, Math.max(8, barSlot * 0.45));
  const yBacklog = (b: number) => pad.top + plotH - (b / maxBacklog) * plotH;
  const ySla = (s: number) =>
    pad.top + plotH - Math.max(0, Math.min(1, (s - slaMin) / (slaMax - slaMin))) * plotH;

  const slaPoints = data
    .map((d, i) => `${pad.left + barSlot * i + barSlot / 2},${ySla(d.cySlaPct)}`)
    .join(' ');

  const avgTarget =
    data.length > 0 ? data.reduce((s, d) => s + d.slaTargetPct, 0) / data.length : 95;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Backlog Queue Accumulation vs. SLA %</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tracks queue growth against SLA attainment (dashed line = {avgTarget.toFixed(1)}% target)
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-600 shrink-0">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-slate-300 inline-block rounded-xs" />
            Backlog
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-0.5 bg-emerald-600 inline-block" />
            SLA %
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
        {[0, 0.5, 1].map((t) => {
          const bVal = maxBacklog * t;
          const y = yBacklog(bVal);
          return (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#F1F5F9" />
              <text x={pad.left - 6} y={y + 3} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
                {bVal >= 1000 ? `${(bVal / 1000).toFixed(1)}k` : Math.round(bVal)}
              </text>
            </g>
          );
        })}

        {/* SLA Target line */}
        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={ySla(avgTarget)}
          y2={ySla(avgTarget)}
          stroke="#94A3B8"
          strokeDasharray="4 3"
          strokeWidth="1"
        />
        <text x={width - pad.right + 5} y={ySla(avgTarget) + 3} className="fill-slate-500 text-[10px] font-mono">
          {avgTarget.toFixed(0)}%
        </text>
        <text x={width - pad.right + 5} y={pad.top + 6} className="fill-slate-400 text-[10px] font-mono">
          100%
        </text>
        <text x={width - pad.right + 5} y={pad.top + plotH} className="fill-slate-400 text-[10px] font-mono">
          75%
        </text>

        {data.map((d, i) => {
          const cx = pad.left + barSlot * i + barSlot / 2;
          const h = pad.top + plotH - yBacklog(d.cyEndingBacklog);
          return (
            <g key={d.month}>
              <rect
                x={cx - barW / 2}
                y={yBacklog(d.cyEndingBacklog)}
                width={barW}
                height={Math.max(1, h)}
                rx={2}
                fill="#CBD5E1"
              />
              <text x={cx} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[10px]">
                {d.monthName}
              </text>
            </g>
          );
        })}

        {data.length > 1 && (
          <polyline fill="none" stroke="#059669" strokeWidth="2.2" points={slaPoints} />
        )}
        {data.map((d, i) => {
          const cx = pad.left + barSlot * i + barSlot / 2;
          const cy = ySla(d.cySlaPct);
          const breach = d.cySlaPct < d.slaTargetPct;
          return (
            <circle
              key={d.month}
              cx={cx}
              cy={cy}
              r="3.2"
              fill={breach ? '#DC2626' : '#059669'}
              stroke="#FFFFFF"
              strokeWidth="1.2"
            />
          );
        })}
      </svg>
    </div>
  );
};
