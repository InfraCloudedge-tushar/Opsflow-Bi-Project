import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Plus, RotateCcw, Search, Trash2, Upload } from 'lucide-react';
import { OperationRecord, QuarterLabel } from '../types/operations';

interface ExcelDataGridViewProps {
  records: OperationRecord[];
  workbookName: string;
  onUpdateRecord: (id: string, field: keyof OperationRecord, value: number | string) => void;
  onAddRecord: (record: OperationRecord) => void;
  onDeleteRecord: (id: string) => void;
  onTriggerUpload: () => void;
  onDownloadWorkbook: () => void;
  onResetDefault: () => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getQuarter(month: number): QuarterLabel {
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}

export const ExcelDataGridView: React.FC<ExcelDataGridViewProps> = ({
  records,
  workbookName,
  onUpdateRecord,
  onAddRecord,
  onDeleteRecord,
  onTriggerUpload,
  onDownloadWorkbook,
  onResetDefault,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);

  const [newPeriod, setNewPeriod] = useState('2026-12');
  const [newDept, setNewDept] = useState('Fulfillment & Logistics');
  const [newRegion, setNewRegion] = useState('North America');
  const [newDemand, setNewDemand] = useState(18500);
  const [newCapacity, setNewCapacity] = useState(17200);
  const [newThroughput, setNewThroughput] = useState(17200);
  const [newBegBacklog, setNewBegBacklog] = useState(950);
  const [newSlaActual, setNewSlaActual] = useState(91.5);
  const [newFte, setNewFte] = useState(98);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.period.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.monthName.toLowerCase().includes(q) ||
        r.quarter.toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  const handleCreateRow = (e: React.FormEvent) => {
    e.preventDefault();
    const match = /^(\d{4})-(\d{2})$/.exec(newPeriod.trim());
    const year = match ? parseInt(match[1], 10) : 2026;
    const month = match ? Math.min(12, Math.max(1, parseInt(match[2], 10))) : 12;
    const endingBacklog = Math.max(0, newBegBacklog + newDemand - newThroughput);

    onAddRecord({
      id: `${year}-${String(month).padStart(2, '0')}-${newDept}-${Date.now()}`,
      period: `${year}-${String(month).padStart(2, '0')}`,
      year,
      month,
      monthName: MONTH_NAMES[month - 1] ?? 'Dec',
      quarter: getQuarter(month),
      department: newDept.trim() || 'Operations',
      region: newRegion.trim() || 'North America',
      demandUnits: Math.max(0, newDemand),
      availableCapacityUnits: Math.max(1, newCapacity),
      throughputUnits: Math.max(0, newThroughput),
      beginningBacklog: Math.max(0, newBegBacklog),
      endingBacklog,
      slaTargetPct: 95.0,
      slaActualPct: newSlaActual,
      activeFte: Math.max(1, newFte),
      operatingHoursPerFte: 160,
      overtimeHours: Math.max(0, Math.round((newDemand / Math.max(1, newCapacity) - 0.88) * newFte * 10)),
      costPerUnitUsd: 14.5,
    });
    setShowAddRow(false);
  };

  return (
    <div className="space-y-4">
      {/* Excel Workbook Control Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Excel Data Model &amp; Live Workbook Editor
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Active File: <span className="font-mono text-slate-800">{workbookName}</span> ·{' '}
              <span className="tabular-nums">{records.length} rows</span> · Zero database storage — edit cells inline or upload an updated .xlsx file
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onTriggerUpload}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0F4C81] hover:bg-[#0c3d68] text-white rounded-md transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            Import Excel (.xlsx / .csv)
          </button>
          <button
            type="button"
            onClick={onDownloadWorkbook}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-md transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Save Workbook (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => setShowAddRow((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-md transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Row
          </button>
          <button
            type="button"
            onClick={onResetDefault}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-md transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Sample
          </button>
        </div>
      </div>

      {/* Add Row Inline Form */}
      {showAddRow && (
        <form
          onSubmit={handleCreateRow}
          className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3 items-end"
        >
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Period (YYYY-MM)</label>
            <input
              type="text"
              value={newPeriod}
              onChange={(e) => setNewPeriod(e.target.value)}
              pattern="\d{4}-\d{2}"
              required
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Department</label>
            <input
              type="text"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Region</label>
            <input
              type="text"
              value={newRegion}
              onChange={(e) => setNewRegion(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Demand</label>
            <input
              type="number"
              value={newDemand}
              onChange={(e) => setNewDemand(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Capacity</label>
            <input
              type="number"
              value={newCapacity}
              onChange={(e) => setNewCapacity(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Throughput</label>
            <input
              type="number"
              value={newThroughput}
              onChange={(e) => setNewThroughput(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Beg. Backlog</label>
            <input
              type="number"
              value={newBegBacklog}
              onChange={(e) => setNewBegBacklog(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">SLA % / FTE</label>
            <div className="flex gap-1">
              <input
                type="number"
                step="0.1"
                value={newSlaActual}
                onChange={(e) => setNewSlaActual(Number(e.target.value))}
                className="w-1/2 px-1.5 py-1.5 text-xs font-mono border border-slate-300 rounded"
                title="SLA %"
              />
              <input
                type="number"
                value={newFte}
                onChange={(e) => setNewFte(Number(e.target.value))}
                className="w-1/2 px-1.5 py-1.5 text-xs font-mono border border-slate-300 rounded"
                title="FTE"
              />
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              type="submit"
              className="flex-1 px-3 py-1.5 text-xs font-medium bg-[#0F4C81] text-white rounded hover:bg-[#0c3d68]"
            >
              Insert
            </button>
            <button
              type="button"
              onClick={() => setShowAddRow(false)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search & Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by period (2026-10), department, region..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#0F4C81]"
            />
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            Showing {filtered.length} of {records.length} records · Click any numeric cell to edit live
          </span>
        </div>

        <div className="overflow-auto max-h-[540px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap">Period</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Department</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Region</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">Demand</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">Capacity</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">Throughput</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">Beg. Backlog</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">End Backlog</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">Util %</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">SLA %</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">FTE</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">OT Hrs</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">$/Unit</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">Del</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {filtered.map((r) => {
                const util =
                  r.availableCapacityUnits > 0 ? (r.demandUnits / r.availableCapacityUnits) * 100 : 0;
                return (
                  <tr key={r.id} className="hover:bg-sky-50/40">
                    <td className="py-1.5 px-3 text-slate-900 font-medium whitespace-nowrap">
                      {r.period} <span className="font-sans text-slate-400">({r.quarter})</span>
                    </td>
                    <td className="py-1.5 px-3 font-sans font-medium text-slate-900 whitespace-nowrap">
                      {r.department}
                    </td>
                    <td className="py-1.5 px-3 font-sans text-slate-600 whitespace-nowrap">{r.region}</td>
                    <td className="py-1 px-1.5 text-right">
                      <input
                        type="number"
                        value={r.demandUnits}
                        onChange={(e) => onUpdateRecord(r.id, 'demandUnits', Number(e.target.value))}
                        className="w-20 px-1.5 py-1 text-right bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-[#0F4C81] rounded outline-none"
                      />
                    </td>
                    <td className="py-1 px-1.5 text-right">
                      <input
                        type="number"
                        value={r.availableCapacityUnits}
                        onChange={(e) =>
                          onUpdateRecord(r.id, 'availableCapacityUnits', Math.max(1, Number(e.target.value)))
                        }
                        className="w-20 px-1.5 py-1 text-right bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-[#0F4C81] rounded outline-none"
                      />
                    </td>
                    <td className="py-1 px-1.5 text-right">
                      <input
                        type="number"
                        value={r.throughputUnits}
                        onChange={(e) => onUpdateRecord(r.id, 'throughputUnits', Number(e.target.value))}
                        className="w-20 px-1.5 py-1 text-right bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-[#0F4C81] rounded outline-none"
                      />
                    </td>
                    <td className="py-1 px-1.5 text-right">
                      <input
                        type="number"
                        value={r.beginningBacklog}
                        onChange={(e) => onUpdateRecord(r.id, 'beginningBacklog', Number(e.target.value))}
                        className="w-16 px-1.5 py-1 text-right bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-[#0F4C81] rounded outline-none"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right text-slate-700 font-semibold">
                      {r.endingBacklog.toLocaleString()}
                    </td>
                    <td
                      className={`py-1.5 px-2 text-right font-semibold ${
                        util >= 95 ? 'text-red-700' : util >= 88 ? 'text-amber-700' : 'text-slate-800'
                      }`}
                    >
                      {util.toFixed(1)}%
                    </td>
                    <td className="py-1 px-1.5 text-right">
                      <input
                        type="number"
                        step="0.1"
                        value={r.slaActualPct}
                        onChange={(e) => onUpdateRecord(r.id, 'slaActualPct', Number(e.target.value))}
                        className="w-16 px-1.5 py-1 text-right bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-[#0F4C81] rounded outline-none"
                      />
                    </td>
                    <td className="py-1 px-1.5 text-right">
                      <input
                        type="number"
                        value={r.activeFte}
                        onChange={(e) => onUpdateRecord(r.id, 'activeFte', Math.max(1, Number(e.target.value)))}
                        className="w-14 px-1.5 py-1 text-right bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-[#0F4C81] rounded outline-none"
                      />
                    </td>
                    <td className="py-1 px-1.5 text-right">
                      <input
                        type="number"
                        value={r.overtimeHours}
                        onChange={(e) => onUpdateRecord(r.id, 'overtimeHours', Number(e.target.value))}
                        className="w-16 px-1.5 py-1 text-right bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-[#0F4C81] rounded outline-none"
                      />
                    </td>
                    <td className="py-1 px-1.5 text-right">
                      <input
                        type="number"
                        step="0.1"
                        value={r.costPerUnitUsd}
                        onChange={(e) => onUpdateRecord(r.id, 'costPerUnitUsd', Number(e.target.value))}
                        className="w-16 px-1.5 py-1 text-right bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-[#0F4C81] rounded outline-none"
                      />
                    </td>
                    <td className="py-1 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => onDeleteRecord(r.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                        title="Delete row"
                        aria-label={`Delete ${r.period} ${r.department}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={14} className="py-10 text-center font-sans text-sm text-slate-500">
                    No matching operations records found. Clear search or import an Excel file.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
