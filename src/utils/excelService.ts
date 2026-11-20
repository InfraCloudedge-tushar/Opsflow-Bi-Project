import * as XLSX from 'xlsx';
import {
  BottleneckInsight,
  DepartmentMetric,
  ExecutiveKpis,
  MonthlyTrendPoint,
  OperationRecord,
  QuarterLabel,
  ScenarioResult,
} from '../types/operations';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getQuarterFromMonth(month: number): QuarterLabel {
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}

function normalizeHeader(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[$,%\s,]/g, '');
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export interface ExcelImportResult {
  records: OperationRecord[];
  sheetName: string;
  warnings: string[];
}

export async function parseExcelFile(file: File): Promise<ExcelImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Prefer sheet named Operations_Data if present, otherwise first sheet
  const sheetName =
    workbook.SheetNames.find((name) => normalizeHeader(name).includes('operations')) ??
    workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('The uploaded workbook contains no readable worksheets.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (rawRows.length === 0) {
    throw new Error(`Worksheet "${sheetName}" is empty. Download the Excel template to see the required schema.`);
  }

  const warnings: string[] = [];
  const records: OperationRecord[] = [];

  rawRows.forEach((row, index) => {
    // Build normalized lookup map for flexible Excel column naming
    const normMap = new Map<string, unknown>();
    Object.entries(row).forEach(([k, v]) => {
      normMap.set(normalizeHeader(k), v);
    });

    const getField = (candidates: string[]): unknown => {
      for (const c of candidates) {
        if (normMap.has(c)) return normMap.get(c);
      }
      return undefined;
    };

    let periodStr = String(getField(['period', 'yearmonth', 'monthyear', 'date']) ?? '').trim();
    let year = Math.round(toNum(getField(['year', 'fiscalyear', 'fy']), 0));
    let month = Math.round(toNum(getField(['month', 'monthnum', 'monthnumber']), 0));

    if (periodStr && /^\d{4}[-/]\d{1,2}$/.test(periodStr)) {
      const [yPart, mPart] = periodStr.split(/[-/]/);
      if (!year) year = parseInt(yPart, 10);
      if (!month) month = parseInt(mPart, 10);
      periodStr = `${year}-${String(month).padStart(2, '0')}`;
    } else if (year > 1900 && month >= 1 && month <= 12) {
      periodStr = `${year}-${String(month).padStart(2, '0')}`;
    } else {
      // Try parsing month name
      const mName = String(getField(['monthname', 'month']) ?? '').trim().slice(0, 3).toLowerCase();
      const mIdx = MONTH_NAMES.findIndex((m) => m.toLowerCase() === mName);
      if (mIdx >= 0 && year > 1900) {
        month = mIdx + 1;
        periodStr = `${year}-${String(month).padStart(2, '0')}`;
      }
    }

    if (!year || month < 1 || month > 12) {
      warnings.push(`Row ${index + 2} skipped: missing valid Period (YYYY-MM) or Year/Month.`);
      return;
    }

    const department = String(
      getField(['department', 'businessunit', 'unit', 'team', 'function']) ?? ''
    ).trim();
    if (!department) {
      warnings.push(`Row ${index + 2} skipped: missing Department.`);
      return;
    }

    const region = String(getField(['region', 'geography', 'location', 'site']) ?? 'North America').trim() || 'North America';
    const demandUnits = Math.max(0, Math.round(toNum(getField(['demandunits', 'demand', 'volume', 'orders']), 0)));
    const availableCapacityUnits = Math.max(
      1,
      Math.round(toNum(getField(['availablecapacityunits', 'capacityunits', 'capacity', 'availablecapacity']), 0))
    );
    const throughputUnits = Math.max(
      0,
      Math.round(toNum(getField(['throughputunits', 'throughput', 'completedunits', 'output']), 0))
    );
    const beginningBacklog = Math.max(
      0,
      Math.round(toNum(getField(['beginningbacklog', 'startbacklog', 'openbacklog']), 0))
    );
    const rawEndingBacklog = getField(['endingbacklog', 'backlog', 'closebacklog']);
    const endingBacklog =
      rawEndingBacklog !== undefined && rawEndingBacklog !== ''
        ? Math.max(0, Math.round(toNum(rawEndingBacklog, 0)))
        : Math.max(0, beginningBacklog + demandUnits - throughputUnits);

    const slaTargetPct = Number(toNum(getField(['slatargetpct', 'slatarget', 'targetsla']), 95.0).toFixed(1));
    const slaActualPct = Number(toNum(getField(['slaactualpct', 'slaactual', 'sla', 'slapct']), 94.0).toFixed(1));
    const activeFte = Math.max(1, Math.round(toNum(getField(['activefte', 'fte', 'headcount']), 20)));
    const operatingHoursPerFte = Math.max(
      1,
      Math.round(toNum(getField(['operatinghoursperfte', 'hoursperfte', 'operatinghours']), 160))
    );
    const overtimeHours = Math.max(0, Math.round(toNum(getField(['overtimehours', 'overtime', 'othours']), 0)));
    const costPerUnitUsd = Number(toNum(getField(['costperunitusd', 'unitcost', 'costperunit']), 15.0).toFixed(2));

    const quarter = getQuarterFromMonth(month);
    const monthName = MONTH_NAMES[month - 1] ?? String(month);

    records.push({
      id: `${periodStr}-${department}-${index}`,
      period: periodStr,
      year,
      month,
      monthName,
      quarter,
      department,
      region,
      demandUnits,
      availableCapacityUnits,
      throughputUnits,
      beginningBacklog,
      endingBacklog,
      slaTargetPct,
      slaActualPct,
      activeFte,
      operatingHoursPerFte,
      overtimeHours,
      costPerUnitUsd,
    });
  });

  if (records.length === 0) {
    throw new Error(
      'No valid operations records found. Ensure columns include Period (YYYY-MM), Department, Demand_Units, Available_Capacity_Units, Throughput_Units, and SLA_Actual_Pct.'
    );
  }

  return {
    records: records.sort((a, b) => a.period.localeCompare(b.period) || a.department.localeCompare(b.department)),
    sheetName,
    warnings,
  };
}

function toExcelDataRows(records: OperationRecord[]) {
  return records.map((r) => ({
    Period: r.period,
    Year: r.year,
    Month: r.month,
    Month_Name: r.monthName,
    Quarter: r.quarter,
    Department: r.department,
    Region: r.region,
    Demand_Units: r.demandUnits,
    Available_Capacity_Units: r.availableCapacityUnits,
    Throughput_Units: r.throughputUnits,
    Beginning_Backlog: r.beginningBacklog,
    Ending_Backlog: r.endingBacklog,
    SLA_Target_Pct: r.slaTargetPct,
    SLA_Actual_Pct: r.slaActualPct,
    Active_FTE: r.activeFte,
    Operating_Hours_Per_FTE: r.operatingHoursPerFte,
    Overtime_Hours: r.overtimeHours,
    Cost_Per_Unit_USD: r.costPerUnitUsd,
  }));
}

export function downloadExcelTemplate(records: OperationRecord[], filename = 'OpsFlow_Operations_Data_Template.xlsx') {
  const wb = XLSX.utils.book_new();

  const dataSheet = XLSX.utils.json_to_sheet(toExcelDataRows(records));
  dataSheet['!cols'] = [
    { wch: 10 },
    { wch: 7 },
    { wch: 7 },
    { wch: 12 },
    { wch: 9 },
    { wch: 24 },
    { wch: 15 },
    { wch: 14 },
    { wch: 22 },
    { wch: 17 },
    { wch: 18 },
    { wch: 16 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 },
    { wch: 22 },
    { wch: 15 },
    { wch: 17 },
  ];
  XLSX.utils.book_append_sheet(wb, dataSheet, 'Operations_Data');

  const dictionaryRows = [
    { Column_Name: 'Period', Format: 'YYYY-MM (e.g. 2026-01)', Description: 'Reporting month key used for chronological and YoY comparison.' },
    { Column_Name: 'Year', Format: 'Integer (e.g. 2025, 2026)', Description: 'Fiscal / calendar year for Year-over-Year (YoY) variance.' },
    { Column_Name: 'Month', Format: 'Integer (1-12)', Description: 'Numeric month index for seasonal indexing.' },
    { Column_Name: 'Month_Name', Format: 'Text (Jan-Dec)', Description: 'Display month abbreviation.' },
    { Column_Name: 'Quarter', Format: 'Q1 | Q2 | Q3 | Q4', Description: 'Quarter slice for executive filtering.' },
    { Column_Name: 'Department', Format: 'Text', Description: 'Operational business unit or functional tower.' },
    { Column_Name: 'Region', Format: 'Text', Description: 'Geographic operating region (North America, EMEA, APAC).' },
    { Column_Name: 'Demand_Units', Format: 'Integer', Description: 'Incoming volume of orders, tickets, or service requests.' },
    { Column_Name: 'Available_Capacity_Units', Format: 'Integer', Description: 'Effective production/service capacity available in the month.' },
    { Column_Name: 'Throughput_Units', Format: 'Integer', Description: 'Completed units delivered during the month.' },
    { Column_Name: 'Beginning_Backlog', Format: 'Integer', Description: 'Unfulfilled work carried over from the prior period.' },
    { Column_Name: 'Ending_Backlog', Format: 'Integer', Description: 'Remaining queue = max(0, Beginning_Backlog + Demand - Throughput).' },
    { Column_Name: 'SLA_Target_Pct', Format: 'Percentage (e.g. 95.0)', Description: 'Contractual or internal service level target (%).' },
    { Column_Name: 'SLA_Actual_Pct', Format: 'Percentage (e.g. 93.4)', Description: 'Achieved SLA attainment rate (%).' },
    { Column_Name: 'Active_FTE', Format: 'Integer', Description: 'Full-Time Equivalent headcount staffed.' },
    { Column_Name: 'Operating_Hours_Per_FTE', Format: 'Integer (e.g. 160)', Description: 'Standard productive hours per FTE per month.' },
    { Column_Name: 'Overtime_Hours', Format: 'Integer', Description: 'Incremental overtime hours required to handle demand surges.' },
    { Column_Name: 'Cost_Per_Unit_USD', Format: 'Decimal ($)', Description: 'Fully-loaded operating cost per unit of throughput.' },
  ];

  const dictSheet = XLSX.utils.json_to_sheet(dictionaryRows);
  dictSheet['!cols'] = [{ wch: 26 }, { wch: 24 }, { wch: 68 }];
  XLSX.utils.book_append_sheet(wb, dictSheet, 'Data_Dictionary');

  XLSX.writeFile(wb, filename);
}

export function exportExecutiveReportExcel(params: {
  kpis: ExecutiveKpis;
  monthlyTrends: MonthlyTrendPoint[];
  deptMetrics: DepartmentMetric[];
  bottlenecks: BottleneckInsight[];
  scenarioResult: ScenarioResult;
  filteredRecords: OperationRecord[];
  scopeLabel: string;
}) {
  const { kpis, monthlyTrends, deptMetrics, bottlenecks, scenarioResult, filteredRecords, scopeLabel } = params;
  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive KPI Summary
  const kpiRows = [
    { Metric: 'Report Scope', Value: scopeLabel, YoY_Comparison: kpis.hasPyComparison ? `vs FY ${kpis.pyYearLabel}` : 'Single Year Scope', Status: 'Active' },
    { Metric: 'Total Demand (Units)', Value: kpis.totalDemand, YoY_Comparison: kpis.demandYoYPct !== null ? `${kpis.demandYoYPct >= 0 ? '+' : ''}${kpis.demandYoYPct.toFixed(1)}%` : 'N/A', Status: 'Tracked' },
    { Metric: 'Available Capacity (Units)', Value: kpis.totalCapacity, YoY_Comparison: kpis.capacityYoYPct !== null ? `${kpis.capacityYoYPct >= 0 ? '+' : ''}${kpis.capacityYoYPct.toFixed(1)}%` : 'N/A', Status: kpis.capacityStatus },
    { Metric: 'Capacity Gap (Surplus / Deficit)', Value: kpis.capacityGap, YoY_Comparison: `${kpis.capacityGapPct >= 0 ? '+' : ''}${kpis.capacityGapPct.toFixed(1)}% of Cap`, Status: kpis.capacityStatus },
    { Metric: 'Capacity Utilization (%)', Value: Number(kpis.utilizationPct.toFixed(1)), YoY_Comparison: kpis.utilizationYoYPp !== null ? `${kpis.utilizationYoYPp >= 0 ? '+' : ''}${kpis.utilizationYoYPp.toFixed(1)} pp` : 'N/A', Status: kpis.utilizationStatus },
    { Metric: 'Total Throughput (Units)', Value: kpis.totalThroughput, YoY_Comparison: kpis.throughputYoYPct !== null ? `${kpis.throughputYoYPct >= 0 ? '+' : ''}${kpis.throughputYoYPct.toFixed(1)}%` : 'N/A', Status: 'Tracked' },
    { Metric: 'Ending Backlog (Units)', Value: kpis.endingBacklog, YoY_Comparison: kpis.backlogYoYPct !== null ? `${kpis.backlogYoYPct >= 0 ? '+' : ''}${kpis.backlogYoYPct.toFixed(1)}%` : 'N/A', Status: kpis.backlogDays > 5 ? 'Watch' : 'Optimal' },
    { Metric: 'Backlog Coverage (Days of Queue)', Value: Number(kpis.backlogDays.toFixed(1)), YoY_Comparison: `${kpis.backlogDelta >= 0 ? '+' : ''}${kpis.backlogDelta} units net`, Status: kpis.backlogDays > 7 ? 'Critical' : 'Optimal' },
    { Metric: 'SLA Attainment (%)', Value: Number(kpis.slaActualPct.toFixed(1)), YoY_Comparison: kpis.slaYoYPp !== null ? `${kpis.slaYoYPp >= 0 ? '+' : ''}${kpis.slaYoYPp.toFixed(1)} pp` : 'N/A', Status: kpis.slaStatus },
    { Metric: 'SLA Target (%)', Value: Number(kpis.slaTargetPct.toFixed(1)), YoY_Comparison: `${kpis.slaVariancePp >= 0 ? '+' : ''}${kpis.slaVariancePp.toFixed(1)} pp var`, Status: kpis.slaStatus },
    { Metric: 'Average Active FTE', Value: Math.round(kpis.avgActiveFte), YoY_Comparison: `${Math.round(kpis.outputPerFte)} units/FTE/mo`, Status: 'Tracked' },
    { Metric: 'Total Overtime Hours', Value: kpis.totalOvertimeHours, YoY_Comparison: `$${kpis.avgCostPerUnitUsd.toFixed(2)} avg unit cost`, Status: 'Tracked' },
  ];
  const s1 = XLSX.utils.json_to_sheet(kpiRows);
  s1['!cols'] = [{ wch: 34 }, { wch: 24 }, { wch: 24 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, s1, 'Executive_KPI_Summary');

  // Sheet 2: YoY Monthly Comparison
  const yoyRows = monthlyTrends.map((m) => ({
    Month: m.monthName,
    Period: m.periodLabel,
    CY_Demand: m.cyDemand,
    PY_Demand: m.pyDemand,
    Demand_YoY_Pct: m.demandYoYPct !== null ? Number(m.demandYoYPct.toFixed(1)) : 'N/A',
    CY_Capacity: m.cyCapacity,
    PY_Capacity: m.pyCapacity,
    Capacity_Gap_Units: m.capacityGap,
    CY_Utilization_Pct: Number(m.cyUtilizationPct.toFixed(1)),
    PY_Utilization_Pct: Number(m.pyUtilizationPct.toFixed(1)),
    CY_Throughput: m.cyThroughput,
    CY_Ending_Backlog: m.cyEndingBacklog,
    CY_SLA_Pct: Number(m.cySlaPct.toFixed(1)),
    PY_SLA_Pct: Number(m.pySlaPct.toFixed(1)),
    Seasonal_Index: Number(m.seasonalIndex.toFixed(2)),
    Active_FTE: m.activeFte,
  }));
  const s2 = XLSX.utils.json_to_sheet(yoyRows);
  s2['!cols'] = Array(16).fill({ wch: 16 });
  XLSX.utils.book_append_sheet(wb, s2, 'YoY_Monthly_Trends');

  // Sheet 3: Department Bottlenecks & FTE Plan
  const deptRows = deptMetrics.map((d) => {
    const insight = bottlenecks.find((b) => b.department === d.department);
    return {
      Department: d.department,
      Region: d.region,
      Health_Status: d.status,
      Bottleneck_Risk_Score: d.bottleneckScore,
      Demand_Units: d.demandUnits,
      Capacity_Units: d.capacityUnits,
      Capacity_Gap_Units: d.capacityGap,
      Utilization_Pct: Number(d.utilizationPct.toFixed(1)),
      Ending_Backlog: d.endingBacklog,
      Backlog_Days: Number(d.backlogDays.toFixed(1)),
      SLA_Actual_Pct: Number(d.slaActualPct.toFixed(1)),
      SLA_Target_Pct: Number(d.slaTargetPct.toFixed(1)),
      SLA_Variance_pp: Number(d.slaVariancePp.toFixed(1)),
      Avg_Active_FTE: d.avgFte,
      Recommended_FTE_Delta: d.recommendedFteDelta,
      Overtime_Hours: d.overtimeHours,
      Avg_Cost_Per_Unit_USD: d.avgCostPerUnitUsd,
      Diagnostic_Headline: insight?.headline ?? '',
      Action_Recommendation: insight?.actionPlan ?? '',
    };
  });
  const s3 = XLSX.utils.json_to_sheet(deptRows);
  s3['!cols'] = [
    { wch: 24 },
    { wch: 15 },
    { wch: 13 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 15 },
    { wch: 15 },
    { wch: 13 },
    { wch: 14 },
    { wch: 14 },
    { wch: 15 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
    { wch: 18 },
    { wch: 46 },
    { wch: 56 },
  ];
  XLSX.utils.book_append_sheet(wb, s3, 'Bottlenecks_and_FTE_Plan');

  // Sheet 4: Resource Planning Scenario
  const scenarioRows = [
    { Parameter: 'Projected Demand (Units)', Baseline: scenarioResult.baselineDemand, Scenario_Projected: scenarioResult.projectedDemand },
    { Parameter: 'Projected Capacity (Units)', Baseline: scenarioResult.baselineCapacity, Scenario_Projected: scenarioResult.projectedCapacity },
    { Parameter: 'Projected Capacity Gap (Units)', Baseline: scenarioResult.baselineCapacity - scenarioResult.baselineDemand, Scenario_Projected: scenarioResult.projectedGap },
    { Parameter: 'Projected Utilization (%)', Baseline: Number(kpis.utilizationPct.toFixed(1)), Scenario_Projected: Number(scenarioResult.projectedUtilizationPct.toFixed(1)) },
    { Parameter: 'Projected SLA Attainment (%)', Baseline: Number(kpis.slaActualPct.toFixed(1)), Scenario_Projected: scenarioResult.projectedSlaPct },
    { Parameter: 'Projected Unit Cost ($)', Baseline: kpis.avgCostPerUnitUsd, Scenario_Projected: scenarioResult.projectedCostPerUnitUsd },
    { Parameter: 'Monthly Labor Cost Impact ($)', Baseline: 0, Scenario_Projected: scenarioResult.monthlyLaborCostDeltaUsd },
    { Parameter: 'Estimated Months to Clear Backlog', Baseline: 'N/A', Scenario_Projected: scenarioResult.monthsToClearBacklog ?? 'Unresolved' },
  ];
  const s4 = XLSX.utils.json_to_sheet(scenarioRows);
  s4['!cols'] = [{ wch: 34 }, { wch: 18 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, s4, 'Capacity_Scenario_Plan');

  // Sheet 5: Filtered Raw Data
  const s5 = XLSX.utils.json_to_sheet(toExcelDataRows(filteredRecords));
  s5['!cols'] = Array(18).fill({ wch: 16 });
  XLSX.utils.book_append_sheet(wb, s5, 'Filtered_Operations_Data');

  const safeDate = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `OpsFlow_Executive_Operations_Report_${safeDate}.xlsx`);
}
