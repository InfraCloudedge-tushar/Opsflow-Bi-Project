import React, { useMemo, useRef, useState } from 'react';
import {
  Download,
  FileDown,
  FileSpreadsheet,
  FilterX,
  Upload,
} from 'lucide-react';
import { BottleneckPanel } from './components/BottleneckPanel';
import { BottleneckSlaView } from './components/BottleneckSlaView';
import { CapacityPlannerView } from './components/CapacityPlannerView';
import {
  CapacityGapDivergingChart,
  DemandCapacityComboChart,
  DepartmentUtilizationChart,
  YoYSeasonalComparisonChart,
} from './components/ExecutiveCharts';
import { ExcelDataGridView } from './components/ExcelDataGridView';
import { KpiStrip } from './components/KpiStrip';
import { YoYComparisonView } from './components/YoYComparisonView';
import { DEFAULT_WORKBOOK_NAME, generateDefaultOperationsDataset } from './data/defaultDataset';
import { FilterState, OperationRecord, QuarterLabel, ReportTab, ScenarioParams } from './types/operations';
import {
  computeDepartmentMetrics,
  computeExecutiveKpis,
  computeMonthlyTrends,
  computeRegionMetrics,
  detectBottlenecks,
  filterRecords,
  getDistinctDepartments,
  getDistinctRegions,
  getDistinctYears,
  runCapacityScenario,
} from './utils/analyticsEngine';
import {
  downloadExcelTemplate,
  exportExecutiveReportExcel,
  parseExcelFile,
} from './utils/excelService';
import { exportExecutiveReportPdf } from './utils/pdfExportService';

const MONTH_OPTIONS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

export default function App() {
  const [records, setRecords] = useState<OperationRecord[]>(() => generateDefaultOperationsDataset());
  const [workbookName, setWorkbookName] = useState<string>(DEFAULT_WORKBOOK_NAME);
  const [activeTab, setActiveTab] = useState<ReportTab>('executive');
  const [filters, setFilters] = useState<FilterState>({
    year: 2026,
    quarter: 'ALL',
    month: 'ALL',
    department: 'ALL',
    region: 'ALL',
  });

  const [scenarioParams, setScenarioParams] = useState<ScenarioParams>({
    demandGrowthPct: 0,
    fteDelta: 0,
    efficiencyGainPct: 0,
    overtimeBufferPct: 0,
    targetUtilizationPct: 85,
  });

  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const demandChartRef = useRef<SVGSVGElement | null>(null);
  const yoyChartRef = useRef<SVGSVGElement | null>(null);

  const years = useMemo(() => getDistinctYears(records), [records]);
  const departments = useMemo(() => getDistinctDepartments(records), [records]);
  const regions = useMemo(() => getDistinctRegions(records), [records]);

  const filteredRecords = useMemo(() => filterRecords(records, filters), [records, filters]);
  const kpis = useMemo(() => computeExecutiveKpis(records, filters), [records, filters]);
  const monthlyTrends = useMemo(() => computeMonthlyTrends(records, filters), [records, filters]);
  const deptMetrics = useMemo(() => computeDepartmentMetrics(records, filters), [records, filters]);
  const regionMetrics = useMemo(() => computeRegionMetrics(records, filters), [records, filters]);
  const bottlenecks = useMemo(
    () => detectBottlenecks(deptMetrics, monthlyTrends),
    [deptMetrics, monthlyTrends]
  );
  const scenarioResult = useMemo(
    () => runCapacityScenario(kpis, deptMetrics, scenarioParams),
    [kpis, deptMetrics, scenarioParams]
  );

  const scopeLabel = useMemo(() => {
    const parts: string[] = [];
    parts.push(filters.year === 'ALL' ? 'All Years' : `FY ${filters.year}`);
    if (filters.quarter !== 'ALL') parts.push(filters.quarter);
    if (filters.month !== 'ALL') {
      const m = MONTH_OPTIONS.find((x) => x.value === filters.month);
      if (m) parts.push(m.label);
    }
    if (filters.department !== 'ALL') parts.push(filters.department);
    if (filters.region !== 'ALL') parts.push(filters.region);
    return parts.join(' · ');
  }, [filters]);

  const hasCustomFilter =
    filters.quarter !== 'ALL' ||
    filters.month !== 'ALL' ||
    filters.department !== 'ALL' ||
    filters.region !== 'ALL';

  const handleClearFilters = () => {
    setFilters((prev) => ({
      year: prev.year,
      quarter: 'ALL',
      month: 'ALL',
      department: 'ALL',
      region: 'ALL',
    }));
  };

  const handleCrossFilterMonth = (month: number) => {
    setFilters((prev) => ({
      ...prev,
      month: prev.month === month ? 'ALL' : month,
      quarter: 'ALL',
    }));
  };

  const handleCrossFilterDepartment = (dept: string) => {
    setFilters((prev) => ({
      ...prev,
      department: prev.department === dept ? 'ALL' : dept,
    }));
  };

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotice({ type, text });
    window.setTimeout(() => {
      setNotice((curr) => (curr?.text === text ? null : curr));
    }, 6000);
  };

  const handleImportFile = async (file: File) => {
    try {
      const result = await parseExcelFile(file);
      const importedYears = getDistinctYears(result.records);
      setRecords(result.records);
      setWorkbookName(file.name);
      setFilters({
        year: importedYears[0] ?? 'ALL',
        quarter: 'ALL',
        month: 'ALL',
        department: 'ALL',
        region: 'ALL',
      });
      const warnMsg =
        result.warnings.length > 0 ? ` (${result.warnings.length} row warnings)` : '';
      showNotice(
        'success',
        `Loaded ${result.records.length} records from "${file.name}" [${result.sheetName}]${warnMsg}.`
      );
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : 'Unable to parse Excel file.');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleImportFile(file);
      e.target.value = '';
    }
  };

  const handleUpdateRecord = (id: string, field: keyof OperationRecord, value: number | string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (
          field === 'demandUnits' ||
          field === 'throughputUnits' ||
          field === 'beginningBacklog'
        ) {
          updated.endingBacklog = Math.max(
            0,
            updated.beginningBacklog + updated.demandUnits - updated.throughputUnits
          );
        }
        return updated;
      })
    );
  };

  const handleAddRecord = (newRecord: OperationRecord) => {
    setRecords((prev) =>
      [...prev, newRecord].sort(
        (a, b) => a.period.localeCompare(b.period) || a.department.localeCompare(b.department)
      )
    );
    showNotice('success', `Inserted ${newRecord.period} (${newRecord.department}) into active workbook.`);
  };

  const handleDeleteRecord = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleResetDefault = () => {
    const fresh = generateDefaultOperationsDataset();
    setRecords(fresh);
    setWorkbookName(DEFAULT_WORKBOOK_NAME);
    setFilters({
      year: 2026,
      quarter: 'ALL',
      month: 'ALL',
      department: 'ALL',
      region: 'ALL',
    });
    showNotice('success', 'Restored default 24-month enterprise operations dataset (FY 2025–FY 2026).');
  };

  const handleExportExcel = () => {
    exportExecutiveReportExcel({
      kpis,
      monthlyTrends,
      deptMetrics,
      bottlenecks,
      scenarioResult,
      filteredRecords,
      scopeLabel,
    });
    showNotice('success', 'Exported 5-sheet Executive Operations Report (.xlsx).');
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportExecutiveReportPdf({
        kpis,
        monthlyTrends,
        deptMetrics,
        bottlenecks,
        scenarioResult,
        scopeLabel,
        workbookName,
        demandChartSvg: demandChartRef.current,
        yoyChartSvg: yoyChartRef.current,
      });
      showNotice('success', 'Exported Stakeholder Executive Brief (.pdf).');
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : 'PDF export failed.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const activeYearLabel =
    filters.year === 'ALL' ? String(years[0] ?? 2026) : String(filters.year);
  const priorYearLabel = String(Number(activeYearLabel) - 1);

  return (
    <div
      className="min-h-screen bg-[#F4F6F9] text-slate-900 flex flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void handleImportFile(file);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Drag & Drop Excel Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-6 pointer-events-none">
          <div className="bg-white border-2 border-dashed border-[#0F4C81] rounded-xl px-10 py-8 text-center shadow-lg">
            <FileSpreadsheet className="w-10 h-10 text-[#0F4C81] mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-900">
              Drop your Excel workbook (.xlsx / .csv) to refresh dashboard
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Processed 100% locally in your browser — zero database or server upload
            </p>
          </div>
        </div>
      )}

      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="no-print bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between gap-8 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('executive')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          OpsFlow BI
        </button>

        {/* Zone 2: 5 concise single-line report page links */}
        <nav aria-label="Report Pages" className="hidden md:flex items-center gap-6 text-sm font-medium">
          {(
            [
              { id: 'executive', label: 'Executive Summary' },
              { id: 'yoy', label: 'YoY & Seasonality' },
              { id: 'bottlenecks', label: 'Bottleneck & SLA' },
              { id: 'planner', label: 'Capacity Planner' },
              { id: 'datagrid', label: 'Excel Data Grid' },
            ] as Array<{ id: ReportTab; label: string }>
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-[#0F4C81] text-[#0F4C81] font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#0F4C81] hover:bg-[#0c3d68] rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            Import Excel
          </button>
        </div>
      </header>

      {/* Mobile Tab Switcher */}
      <div className="no-print md:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 overflow-x-auto">
        {(
          [
            { id: 'executive', label: 'Executive' },
            { id: 'yoy', label: 'YoY Trends' },
            { id: 'bottlenecks', label: 'Bottlenecks' },
            { id: 'planner', label: 'Planner' },
            { id: 'datagrid', label: 'Excel Grid' },
          ] as Array<{ id: ReportTab; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
              activeTab === tab.id ? 'bg-[#0F4C81] text-white' : 'text-slate-600 bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Power BI Slicer & Automated Reporting Toolbar */}
      <div className="no-print bg-white border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Slicers */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label htmlFor="slicer-year" className="text-xs font-medium text-slate-500">
              Year
            </label>
            <select
              id="slicer-year"
              value={String(filters.year)}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  year: e.target.value === 'ALL' ? 'ALL' : Number(e.target.value),
                }))
              }
              className="px-2.5 py-1 text-xs font-medium bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#0F4C81]"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  FY {y}
                </option>
              ))}
              <option value="ALL">All Years</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="slicer-quarter" className="text-xs font-medium text-slate-500">
              Quarter
            </label>
            <select
              id="slicer-quarter"
              value={filters.quarter}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  quarter: e.target.value as QuarterLabel | 'ALL',
                  month: 'ALL',
                }))
              }
              className="px-2.5 py-1 text-xs font-medium bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#0F4C81]"
            >
              <option value="ALL">All Quarters</option>
              <option value="Q1">Q1 (Jan–Mar)</option>
              <option value="Q2">Q2 (Apr–Jun)</option>
              <option value="Q3">Q3 (Jul–Sep)</option>
              <option value="Q4">Q4 (Oct–Dec)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="slicer-month" className="text-xs font-medium text-slate-500">
              Month
            </label>
            <select
              id="slicer-month"
              value={String(filters.month)}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  month: e.target.value === 'ALL' ? 'ALL' : Number(e.target.value),
                }))
              }
              className="px-2.5 py-1 text-xs font-medium bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#0F4C81]"
            >
              <option value="ALL">All Months</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="slicer-dept" className="text-xs font-medium text-slate-500">
              Department
            </label>
            <select
              id="slicer-dept"
              value={filters.department}
              onChange={(e) => setFilters((prev) => ({ ...prev, department: e.target.value }))}
              className="px-2.5 py-1 text-xs font-medium bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#0F4C81]"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="slicer-region" className="text-xs font-medium text-slate-500">
              Region
            </label>
            <select
              id="slicer-region"
              value={filters.region}
              onChange={(e) => setFilters((prev) => ({ ...prev, region: e.target.value }))}
              className="px-2.5 py-1 text-xs font-medium bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#0F4C81]"
            >
              <option value="ALL">All Regions</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {hasCustomFilter && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded transition-colors whitespace-nowrap"
            >
              <FilterX className="w-3.5 h-3.5" />
              Reset Slicers
            </button>
          )}
        </div>

        {/* Report Export & Template Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              downloadExcelTemplate(records);
              showNotice('success', 'Downloaded editable Excel workbook template (.xlsx).');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            Excel Template
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#0F4C81]" />
            Export Excel Report
          </button>

          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={isExportingPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
          >
            <FileDown className="w-3.5 h-3.5" />
            {isExportingPdf ? 'Generating PDF...' : 'Export PDF Brief'}
          </button>
        </div>
      </div>

      {/* Main Report Viewport */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 py-5 space-y-5">
        {/* Notification Banner */}
        {notice && (
          <div
            role="status"
            className={`px-4 py-2.5 rounded-md border text-xs flex items-center justify-between gap-4 ${
              notice.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs font-semibold underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Workbook Scope Metadata Line (Zero-pill unboxed typography) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight text-balance">
              Operations KPI &amp; Capacity Management
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>Workbook: {workbookName}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{filteredRecords.length} active records</span>
              <span aria-hidden="true">·</span>
              <span>Scope: {scopeLabel}</span>
              <span aria-hidden="true">·</span>
              <span>Client-side Excel BI model</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('datagrid')}
            className="text-xs font-medium text-[#0F4C81] hover:underline whitespace-nowrap"
          >
            Edit figures in Excel Data Grid &rarr;
          </button>
        </div>

        {/* Empty State Guard */}
        {filteredRecords.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <h2 className="text-base font-semibold text-slate-900">
              No operations records match the active slicers
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Clear your slicer filters or import an Excel workbook containing records for this period and department.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 text-xs font-medium bg-[#0F4C81] text-white rounded-md hover:bg-[#0c3d68]"
              >
                Reset Slicers
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-xs font-medium border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
              >
                Import Excel
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'executive' && (
              <div className="space-y-5">
                <KpiStrip kpis={kpis} />

                {/* Primary Visual Row */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                  <div className="xl:col-span-7">
                    <DemandCapacityComboChart
                      data={monthlyTrends}
                      selectedMonth={filters.month}
                      onSelectMonth={handleCrossFilterMonth}
                      svgRef={demandChartRef}
                    />
                  </div>
                  <div className="xl:col-span-5">
                    <YoYSeasonalComparisonChart data={monthlyTrends} svgRef={yoyChartRef} />
                  </div>
                </div>

                {/* Secondary Analytical Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <DepartmentUtilizationChart
                    departments={deptMetrics}
                    selectedDepartment={filters.department}
                    onSelectDepartment={handleCrossFilterDepartment}
                  />
                  <CapacityGapDivergingChart data={monthlyTrends} />
                </div>

                {/* Automated MBA Bottleneck Diagnostics */}
                <BottleneckPanel
                  insights={bottlenecks}
                  regions={regionMetrics}
                  onSelectDepartment={handleCrossFilterDepartment}
                  onOpenPlanner={() => setActiveTab('planner')}
                />
              </div>
            )}

            {activeTab === 'yoy' && (
              <YoYComparisonView
                monthlyTrends={monthlyTrends}
                activeYearLabel={activeYearLabel}
                priorYearLabel={priorYearLabel}
              />
            )}

            {activeTab === 'bottlenecks' && (
              <BottleneckSlaView
                records={records}
                filters={filters}
                deptMetrics={deptMetrics}
                monthlyTrends={monthlyTrends}
                onSelectDepartment={handleCrossFilterDepartment}
              />
            )}

            {activeTab === 'planner' && (
              <CapacityPlannerView
                kpis={kpis}
                params={scenarioParams}
                result={scenarioResult}
                onChangeParams={setScenarioParams}
              />
            )}

            {activeTab === 'datagrid' && (
              <ExcelDataGridView
                records={records}
                workbookName={workbookName}
                onUpdateRecord={handleUpdateRecord}
                onAddRecord={handleAddRecord}
                onDeleteRecord={handleDeleteRecord}
                onTriggerUpload={() => fileInputRef.current?.click()}
                onDownloadWorkbook={() => {
                  downloadExcelTemplate(records, workbookName.endsWith('.xlsx') ? workbookName : `${workbookName}.xlsx`);
                  showNotice('success', 'Saved current in-browser edits to Excel (.xlsx).');
                }}
                onResetDefault={handleResetDefault}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
