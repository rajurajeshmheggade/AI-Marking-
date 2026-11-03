import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Input } from "@/components/ui/input";
import { Search, FolderOpen, Layers, ChevronDown, ChevronRight, Download, Loader2, CalendarRange, AlertTriangle, RefreshCw } from "lucide-react";
import { getSessionCodes } from "@/lib/session";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import OCREvaluation from "./OCREvaluation";
import { HeaderAccountControls } from "@/components/HeaderAccountControls";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_ICMEPRODUCT_API_BASE || 'https://icmeprod.excelsoftcorp.com/icmeproduct';
const API_BASE1 = import.meta.env.VITE_AIMARKING_API_BASE || 'https://icmeprod.excelsoftcorp.com/AIMarkingAPI/api';

// Centralized so every Year/Cycle/Subject call goes through one place, matching
// how OCREvaluation.tsx keeps its own API_ENDPOINTS map.
const API_ENDPOINTS = {
  yearData: `${API_BASE1}/get-year-data`,
  cycleData: `${API_BASE1}/get-cycle-data`,
  subjectData: `${API_BASE1}/get-subject-data`,
};

// ───────────────────────────────────────────────────────────────────────────
// TEMPORARY: get-year-data / get-cycle-data / get-subject-data are still being
// built on the backend and currently answer with no rows. Until they're live,
// an empty (or failing) response falls back to this fixed sample data so the
// Year → Cycle → Subject flow can still be exercised end to end in the UI.
//
// Flip this to false the moment the real APIs return data - every fetch*
// function below only reaches for the mock when the real call came back with
// nothing, so nothing else needs to change.
// ───────────────────────────────────────────────────────────────────────────
const USE_MOCK_DATA_WHILE_BACKEND_IN_DEV = true;

const MOCK_YEARS: any[] = [
  { yearid: '1', yearname: '2024', yearcode: '2024' },
  { yearid: '2', yearname: '2025', yearcode: '2025' },
];

const MOCK_CYCLES_BY_YEAR: Record<string, any[]> = {
  // subjectcount matters: a cycle reporting 0 is shown as "Yet to Active" and
  // cannot be opened, so the stand-ins carry counts to stay usable offline.
  '2024': [
    { cycleid: '1', cyclename: 'Cycle 1', cyclecode: 'C1', subjectcount: '12', yearid: '1', yearcode: '2024' },
    { cycleid: '2', cyclename: 'Cycle 2', cyclecode: 'C2', subjectcount: '8', yearid: '1', yearcode: '2024' },
    { cycleid: '3', cyclename: 'Cycle 3', cyclecode: 'C3', subjectcount: '5', yearid: '1', yearcode: '2024' },
  ],
  '2025': [
    { cycleid: '4', cyclename: 'Cycle 1', cyclecode: 'C1', subjectcount: '12', yearid: '2', yearcode: '2025' },
    { cycleid: '5', cyclename: 'Cycle 2', cyclecode: 'C2', subjectcount: '8', yearid: '2', yearcode: '2025' },
    { cycleid: '6', cyclename: 'Cycle 3', cyclecode: 'C3', subjectcount: '5', yearid: '2', yearcode: '2025' },
    { cycleid: '7', cyclename: 'Cycle 4', cyclecode: 'C4', subjectcount: '0', yearid: '2', yearcode: '2025' },
  ],
};

const MOCK_SUBJECTS_BY_CYCLE: Record<string, any[]> = {
  'C1': [
    { subjectid: '10', subjectcode: 'S1_10', subjectname: 'Accident & Emergency Procedures' },
    { subjectid: '11', subjectcode: 'S1_11', subjectname: 'Business Law' },
    { subjectid: '12', subjectcode: 'S1_12', subjectname: 'Customer Service' },
  ],
  'C2': [
    { subjectid: '13', subjectcode: 'S1_13', subjectname: 'Digital Marketing' },
    { subjectid: '14', subjectcode: 'S1_14', subjectname: 'Environmental Management' },
  ],
  'C3': [
    { subjectid: '15', subjectcode: 'S1_15', subjectname: 'Food & Beverage Management' },
  ],
  'C4': [
    { subjectid: '16', subjectcode: 'S1_16', subjectname: 'Freelance & Feature Writing' },
    { subjectid: '17', subjectcode: 'S1_17', subjectname: 'Front Office Operations & Administration' },
  ],
};

/**
 * True only when get-config-info enables every one of the four workflow stages.
 *
 * Strict `=== true` on purpose: a missing field, a string "true", or an absent
 * workflowStages object all count as not enabled, so the configuration is never
 * assumed to allow something it did not explicitly say.
 */
const areAllWorkflowStagesEnabled = (stages: unknown): boolean => {
  if (!stages || typeof stages !== 'object') return false;
  const s = stages as Record<string, unknown>;
  return s.ocr === true && s.indexing === true && s.evaluation === true && s.segmentation === true;
};

interface Subject {
  value: string;
  label: string;
  code: string;
  workspaceCount: number;
  status: number;
}

/**
 * A configuration without the Evaluation stage has no subject step: there is
 * nothing subject-specific left to pick (no marking scheme, no per-subject pass
 * mark or prompt), so Year > Cycle leads straight to the workspace list. Every
 * API then works against the fixed 'generic' subject code - the same stand-in
 * Standalone Mode has always used, so nothing downstream needs to change.
 */
const GENERIC_SUBJECT: Subject = {
  value: 'generic',
  label: 'Generic',
  code: 'generic',
  workspaceCount: 0,
  status: 1,
};

/**
 * Subject codes carry an internal suffix after the first underscore
 * (AEP04_2026, S1_11) that means nothing to an evaluator, so cards show only the
 * part before it. Display only - the stored code keeps its suffix, which is what
 * selection, the APIs and filtering all run on. A code that is only a suffix
 * (_2026) is shown whole rather than as an empty cell.
 */
const toDisplaySubjectCode = (code?: string | null) => (code ? code.split('_')[0] || code : '');

interface YearOption {
  yearid: string;
  yearname: string;
  yearcode: string;
}

interface CycleOption {
  cycleid: string;
  cyclename: string;
  cyclecode: string;
  /** How many subjects the cycle holds; 0 means it is not open for marking yet. */
  subjectcount: number;
  yearid?: string;
  yearcode?: string;
}

const SubjectDashboard: React.FC = () => {
  const navigate = useNavigate();

  // ── Year → Cycle → Subject chain ────────────────────────────────────────
  const [years, setYears] = useState<YearOption[]>([]);
  const [selectedYearCode, setSelectedYearCode] = useState<string>('');
  const [isYearLoading, setIsYearLoading] = useState(true);
  const [yearError, setYearError] = useState<string | null>(null);

  const [cycles, setCycles] = useState<CycleOption[]>([]);
  const [selectedCycleCode, setSelectedCycleCode] = useState<string>('');
  const [isCycleLoading, setIsCycleLoading] = useState(false);
  const [cycleError, setCycleError] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isSubjectLoading, setIsSubjectLoading] = useState(false);
  const [subjectError, setSubjectError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Subject | null>(null);
  // null until get-config-info answers: unknown, so the subject step is kept
  // rather than skipped on a guess. Set to false only when the configuration
  // positively says Evaluation is not part of the workflow.
  const [isEvaluationEnabled, setIsEvaluationEnabled] = useState<boolean | null>(null);
  const workflowConfigPromiseRef = useRef<Promise<boolean | null> | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [totalTokens, setTotalTokens] = useState<number>(0);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [studentRegisterNumber, setStudentRegisterNumber] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Guards a slow Cycle response from a year the user has since changed away
  // from landing after a newer one, the same pattern fetchWorkflowConfig uses.
  const cycleRequestIdRef = useRef(0);
  const subjectRequestIdRef = useRef(0);

  // Restore selection from sessionStorage when returning to this page
  // This runs when selected changes (i.e., returning from a subject) to
  // preserve the year/cycle context instead of resetting to defaults.
  const isFirstRestoreRunRef = useRef(true);
  useEffect(() => {
    // Only restore when returning from a subject (selected just changed to null).
    // Skipped on the initial mount, so a fresh login (whose sessionStorage may
    // still hold the previous session's year/cycle) lands on the cycle cards and
    // fetchYears auto-selects the first year.
    if (isFirstRestoreRunRef.current) {
      isFirstRestoreRunRef.current = false;
      return;
    }
    const storedYearCode = sessionStorage.getItem('yearcode') || sessionStorage.getItem('yearCode');
    const storedCycleCode = sessionStorage.getItem('cyclecode') || sessionStorage.getItem('cycleCode');
    if (storedYearCode && !selectedYearCode) {
      // Only restore if not already set (this handles the case where the
      // user navigated back after selecting a year/cycle)
      setSelectedYearCode(storedYearCode);
    }
    if (storedCycleCode && !selectedCycleCode) {
      setSelectedCycleCode(storedCycleCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleStudentExport = async () => {
    if (!studentRegisterNumber.trim()) return;
    setIsExportDialogOpen(false);
    setIsExporting(true);
    try {
      const custCode = sessionStorage.getItem('custCode') || 'ICME';
      const orgCode = sessionStorage.getItem('orgCode') || 'ICMELIVE';
      const url = `${API_BASE1}/student-export?CustCode=${custCode}&OrgCode=${orgCode}&RegistrationNumber=${studentRegisterNumber}`;
      
      const res = await axios.get(url, { headers: { 'accept': '*/*' } });
      const data = res.data;
      if (!data || !data.candidateData || data.candidateData.length === 0) {
        toast.error("No data found for this register number.");
        return;
      }
      
      const candidateData = data.candidateData;
      const rows1: any[] = [];
      const rows2: any[] = [];
      
      candidateData.forEach((candidate: any) => {
        let processData = null;
        try {
          processData = JSON.parse(candidate.processdata);
        } catch(e) {
          console.error("Failed to parse processdata", e);
        }
        
        const regNumber = data.registration_number || studentRegisterNumber;
        const row1: any = { "Subject Name": candidate.subjectname || "" };
        const row2: any = { 
          "Subject Name": candidate.subjectname || "",
          "Workspace Name": candidate.workspacename || candidate.workspace_name || candidate.workspaceid || ""
        };

        if (processData && processData.eval_data) {
          const evalData = processData.eval_data;
          Object.keys(evalData).forEach(qNum => {
            const qData = evalData[qNum];
            row1[`Q${qNum}`] = qData.marks_awarded;
            row2[`Q${qNum}_Score`] = qData.marks_awarded;
            row2[`Q${qNum}_Missing Points`] = qData.missing_points ? qData.missing_points.map((m: any) => m.how_to_improve).join("\n") : "";
            row2[`Q${qNum}_Feedback`] = qData.feedback || "";
          });
          row1["Total Score"] = processData.final_score?.obtained_score || 0;
        } else {
          row1["Total Score"] = 0;
        }
        rows1.push(row1);
        rows2.push(row2);
      });
      
      if (rows1.length === 0) {
        toast.info("No evaluation data found to export.");
        return;
      }
      
      // Find max Q number to ensure consistent columns across all rows (at least 8)
      let maxQ = 8;
      rows1.forEach(r => {
        Object.keys(r).forEach(k => {
          if (k.startsWith('Q')) {
            const num = parseInt(k.substring(1), 10);
            if (!isNaN(num) && num > maxQ) {
              maxQ = num;
            }
          }
        });
      });

      // Fill N/A for missing data in Evaluation Details (Sheet 2)
      rows2.forEach(r => {
        for (let i = 1; i <= maxQ; i++) {
          if (r[`Q${i}_Score`] === undefined || r[`Q${i}_Score`] === null) r[`Q${i}_Score`] = "N/A";
          if (!r[`Q${i}_Missing Points`]) r[`Q${i}_Missing Points`] = "N/A";
          if (!r[`Q${i}_Feedback`]) r[`Q${i}_Feedback`] = "N/A";
        }
      });

      // Sheet 1: ObtainedScore
      const header1 = ["Subject Name"];
      for (let i = 1; i <= maxQ; i++) {
        header1.push(`Q${i}`);
      }
      header1.push("Total Score");
      
      const workbook = new ExcelJS.Workbook();
      const ws1 = workbook.addWorksheet("ObtainedScore");
      
      ws1.columns = header1.map((h, i) => ({
        header: h,
        key: h,
        width: i === 0 || i === header1.length - 1 ? 15 : 10
      }));
      ws1.addRows(rows1);

      // Sheet 2: Evaluation Details
      const header2 = ["Subject Name", "Workspace Name"];
      for (let i = 1; i <= maxQ; i++) {
        header2.push(`Q${i}_Score`);
        header2.push(`Q${i}_Missing Points`);
        header2.push(`Q${i}_Feedback`);
      }
      
      const ws2 = workbook.addWorksheet("Evaluation Details");
      ws2.columns = header2.map((h, i) => ({
        header: h,
        key: h,
        width: i === 0 ? 30 : (i === 1 ? 20 : (h.includes('Missing Points') ? 80 : (h.includes('Feedback') ? 60 : 10)))
      }));
      ws2.addRows(rows2);

      // Apply Header Colors
      const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }
      };

      [ws1, ws2].forEach(ws => {
        ws.getRow(1).eachCell((cell) => {
          cell.font = headerStyle.font as any;
          cell.fill = headerStyle.fill as any;
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
      });
      
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `${studentRegisterNumber}.xlsx`);
      
      toast.success("Export successful!");
      setIsExportDialogOpen(false);
      setStudentRegisterNumber('');
    } catch(err) {
      console.error(err);
      toast.error("An error occurred during export.");
    } finally {
      setIsExporting(false);
    }
  };

  const displayName = (() => {
    try {
      const raw = sessionStorage.getItem('userInfo');
      if (raw) {
        const info = JSON.parse(raw);
        return (info?.username || '').toString().trim() || null;
      }
    } catch { }
    return sessionStorage.getItem('username') || 'Evaluator';
  })();

  const isAdmin = (sessionStorage.getItem('userRole') || '').toLowerCase() === 'admin';

  const tokenCount = totalTokens;

  const handleLogout = () => {
    ['isLogin', 'userInfo', 'username', 'password', 'userCode', 'orgCode', 'customerCode', 'userRole']
      .forEach(k => sessionStorage.removeItem(k));
    navigate('/login');
  };

  // Shared by both subject sources (the old subject-list shape and the new
  // per-cycle get-subject-data shape use the same field names), so a subject
  // card looks and behaves identically regardless of which endpoint fed it.
  const mapSubjectItem = (item: any, index: number): Subject => {
    if (typeof item === 'string') {
      const v = item.toLowerCase().replace(/\s+/g, '-');
      return { value: v, label: item, code: v, workspaceCount: 0, status: 1 };
    }
    const label = (() => {
      const raw = item.subjectname || item.subjectName || item.SName || item.label || item.name;
      if (raw && typeof raw === 'object') return JSON.stringify(raw);
      if (raw != null) return String(raw);
      const strVal = Object.values(item).find(v => typeof v === 'string' && (v as string).trim());
      return strVal ? String(strVal) : `Unknown-${index}`;
    })();
    const rawCode = item.subjectcode || item.subjectCode || item.value || item.code || item.id;
    const value = rawCode != null ? String(rawCode) : `${label.toLowerCase().replace(/\s+/g, '-')}-${index}`;
    return {
      value: String(value),
      label: String(label),
      code: String(value),
      workspaceCount: Number(item.workspacecount ?? item.workspaceCount ?? 0),
      // get-subject-data (per cycle) doesn't carry a status flag - every subject
      // it returns for the cycle is assumed active, same as a status of 1.
      status: Number(item.status ?? 1),
    };
  };

  const extractArray = (data: any): any[] => {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      const arr = data.subjects || data.data || data.items || [];
      if (Array.isArray(arr)) return arr;
    }
    return [];
  };

  // Step 1: years for the dropdown. The first year is auto-selected once this
  // resolves; everything else (cycles, subjects) cascades from that.
  const fetchYears = async () => {
    setIsYearLoading(true);
    setYearError(null);
    try {
      // No params at all - sending yearName='' made the backend filter for
      // an exact empty match and return nothing; omitting it returns every year.
      const res = await axios.get(API_ENDPOINTS.yearData, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' },
      });
      let rawYears = extractArray(res?.data);
      if (USE_MOCK_DATA_WHILE_BACKEND_IN_DEV && rawYears.length === 0) {
        console.warn('get-year-data returned no rows; showing mock year data until the backend is live.');
        rawYears = MOCK_YEARS;
      }
      const mapped: YearOption[] = rawYears
        .filter(item => item && typeof item === 'object')
        .map((item: any) => ({
          yearid: String(item.yearid ?? item.yearId ?? ''),
          yearname: String(item.yearname ?? item.yearName ?? ''),
          yearcode: String(item.yearcode ?? item.yearCode ?? ''),
        }))
        .filter(y => y.yearcode);
      setYears(mapped);
      // If a year is already selected (e.g., returning from a subject), keep it
      // instead of resetting to the first fetched year. Only auto-select if no
      // year is currently selected AND this is the initial load.
      if (selectedYearCode && mapped.some(y => y.yearcode === selectedYearCode)) {
        // Keep the existing selection - fetchCycles will use it
        console.log(`Year "${selectedYearCode}" already selected, preserving it`);
      } else if (mapped.length > 0) {
        // Auto-select the first year if none selected (initial load)
        setSelectedYearCode(mapped[0].yearcode);
      } else {
        setSelectedYearCode('');
      }
      if (mapped.length === 0) {
        setCycles([]);
        setSelectedCycleCode('');
        setSubjects([]);
      }
    } catch (e) {
      console.error('Failed to load years', e);
      if (USE_MOCK_DATA_WHILE_BACKEND_IN_DEV) {
        console.warn('get-year-data failed; showing mock year data until the backend is live.');
        setYears(MOCK_YEARS);
        if (!selectedYearCode || !MOCK_YEARS.some(y => y.yearcode === selectedYearCode)) {
          setSelectedYearCode(MOCK_YEARS[0]?.yearcode ?? '');
        }
      } else {
        setYearError('Failed to load years. Please try again.');
        toast.error('Failed to load years. Please try again.');
        setYears([]);
        setSelectedYearCode('');
        setCycles([]);
        setSelectedCycleCode('');
        setSubjects([]);
      }
    } finally {
      setIsYearLoading(false);
    }
  };

  // Step 2: cycles for the selected year, shown as cards.
  const fetchCycles = async (yearCode: string) => {
    if (!yearCode) return;
    const requestId = ++cycleRequestIdRef.current;
    setIsCycleLoading(true);
    setCycleError(null);
    // Only clear cycles list - keep the selected cycle to preserve context
    // when returning from a subject. If the cycle no longer exists for this
    // year, it will be cleared by the cascade effect.
    setSubjects([]);
    setSubjectError(null);
    try {
      // get-cycle-data scopes to the selected year server-side via YearCode;
      // its response carries no year field of its own to filter on client-side.
      // OrgCode scopes it to the signed-in organization, and comes from the login
      // response the session holds.
      const { orgcode } = getSessionCodes();
      const res = await axios.get(API_ENDPOINTS.cycleData, {
        params: {
          YearCode: yearCode,
          OrgCode: (orgcode || sessionStorage.getItem('orgCode') || '').replace(/\x00/g, ''),
        },
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' },
      });
      if (requestId !== cycleRequestIdRef.current) return; // a newer year was selected meanwhile
      let rawCycles = extractArray(res?.data);
      if (USE_MOCK_DATA_WHILE_BACKEND_IN_DEV && rawCycles.length === 0) {
        console.warn('get-cycle-data returned no rows; showing mock cycle data until the backend is live.');
        rawCycles = MOCK_CYCLES_BY_YEAR[yearCode] ?? [];
      }
      const mapped: CycleOption[] = rawCycles
        .filter(item => item && typeof item === 'object')
        .map((item: any) => ({
          cycleid: String(item.cycleid ?? item.cycleId ?? ''),
          cyclename: String(item.cyclename ?? item.cycleName ?? ''),
          cyclecode: String(item.cyclecode ?? item.cycleCode ?? ''),
          // The API sends this as a string ("884"); anything unparseable counts as none.
          subjectcount: Number(item.subjectcount ?? item.subjectCount ?? 0) || 0,
          yearid: item.yearid != null ? String(item.yearid) : undefined,
          yearcode: item.yearcode != null ? String(item.yearcode) : yearCode,
        }))
        .filter(c => c.cyclecode);
      // Preserve the selected cycle if it exists in the new list
      const newCycleList = mapped.filter(c => c.cyclecode);
      setCycles(newCycleList);
      if (!newCycleList.some(c => c.cyclecode === selectedCycleCode)) {
        // Selected cycle is not in the new list - clear it
        setSelectedCycleCode('');
      }
    } catch (e) {
      if (requestId !== cycleRequestIdRef.current) return;
      console.error('Failed to load cycles', e);
      if (USE_MOCK_DATA_WHILE_BACKEND_IN_DEV) {
        console.warn('get-cycle-data failed; showing mock cycle data until the backend is live.');
        setCycles(MOCK_CYCLES_BY_YEAR[yearCode] ?? []);
      } else {
        setCycleError('Failed to load cycles. Please try again.');
        toast.error('Failed to load cycles. Please try again.');
        setCycles([]);
      }
    } finally {
      if (requestId === cycleRequestIdRef.current) setIsCycleLoading(false);
    }
  };

  // Step 3: subjects for the selected year + cycle, feeding the existing
  // subject grid/click-to-open flow unchanged.
  const fetchSubjectsForCycle = async (yearCode: string, cycleCode: string) => {
    if (!yearCode || !cycleCode) return;
    const requestId = ++subjectRequestIdRef.current;
    setIsSubjectLoading(true);
    setSubjectError(null);
    // The search box filters whatever list is on screen, so a term left over from
    // the previous cycle would silently hide subjects from the one just loaded.
    setSearch('');
    // Don't clear subjects here - fetchSubjectsForCycle is called from handleCycleSelect
    // which already has the subject context. We'll let the caller manage the subject list.
    try {
      const { orgcode, custcode, usercode } = getSessionCodes();
      const res = await axios.get(API_ENDPOINTS.subjectData, {
        params: {
          orgCode: (orgcode || sessionStorage.getItem('orgCode') || 'ICMELIVE').replace(/\x00/g, ''),
          custCode: (custcode || 'ICME').replace(/\x00/g, ''),
          yearCode,
          cycleCode,
          // From the logged-in session (same source every other call on this
          // page uses), not left blank.
          userCode: (usercode || sessionStorage.getItem('userCode') || sessionStorage.getItem('username') || '').replace(/\x00/g, ''),
        },
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' },
      });
      if (requestId !== subjectRequestIdRef.current) return; // a newer cycle was selected meanwhile
      let rawSubjects = extractArray(res?.data);
      if (USE_MOCK_DATA_WHILE_BACKEND_IN_DEV && rawSubjects.length === 0) {
        console.warn('get-subject-data returned no rows; showing mock subject data until the backend is live.');
        rawSubjects = MOCK_SUBJECTS_BY_CYCLE[cycleCode] ?? [];
      }
      const mapped = rawSubjects.map((item, index) => mapSubjectItem(item, index));
      setSubjects(mapped);
    } catch (e) {
      if (requestId !== subjectRequestIdRef.current) return;
      console.error('Failed to load subjects for cycle', e);
      if (USE_MOCK_DATA_WHILE_BACKEND_IN_DEV) {
        console.warn('get-subject-data failed; showing mock subject data until the backend is live.');
        const rawSubjects = MOCK_SUBJECTS_BY_CYCLE[cycleCode] ?? [];
        setSubjects(rawSubjects.map((item, index) => mapSubjectItem(item, index)));
      } else {
        setSubjectError('Failed to load subjects. Please try again.');
        toast.error('Failed to load subjects. Please try again.');
        setSubjects([]);
      }
    } finally {
      if (requestId === subjectRequestIdRef.current) setIsSubjectLoading(false);
    }
  };

  /**
   * Skips the subject step: stores the Year/Cycle the workspaces belong to and
   * the generic subject code every API will read, then opens the workspace list.
   */
  const openGenericWorkspaces = (yearCode: string, cycleCode: string) => {
    sessionStorage.setItem('subjectcode', GENERIC_SUBJECT.code);
    sessionStorage.setItem('subjectCode', GENERIC_SUBJECT.code);
    sessionStorage.setItem('yearcode', yearCode);
    sessionStorage.setItem('yearCode', yearCode);
    sessionStorage.setItem('cyclecode', cycleCode);
    sessionStorage.setItem('cycleCode', cycleCode);
    setSubjects([]);
    setSubjectError(null);
    setSelected(GENERIC_SUBJECT);
  };

  const handleCycleSelect = async (cycle: CycleOption) => {
    if (isSubjectLoading || selectedCycleCode === cycle.cyclecode) return;
    setSelectedCycleCode(cycle.cyclecode);

    // Without Evaluation there is no subject step, so get-subject-data is not
    // even called - the workspace list opens directly.
    setIsSubjectLoading(true);
    let evaluationOn: boolean | null = null;
    try {
      evaluationOn = await resolveEvaluationEnabled();
    } finally {
      setIsSubjectLoading(false);
    }
    if (evaluationOn === false) {
      openGenericWorkspaces(selectedYearCode, cycle.cyclecode);
      return;
    }
    void fetchSubjectsForCycle(selectedYearCode, cycle.cyclecode);
  };

  // get-config-info can answer after a cycle has already been picked - a slow
  // response, or a cycle restored on the way back. Once it says Evaluation is
  // off, the subject step that was opened in the meantime gives way to the
  // workspace list, so that configuration never sits on a subject card it has
  // no use for. Back clears the cycle, which is what stops this repeating.
  useEffect(() => {
    if (isEvaluationEnabled !== false) return;
    if (selected || !selectedYearCode || !selectedCycleCode) return;
    openGenericWorkspaces(selectedYearCode, selectedCycleCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEvaluationEnabled, selected, selectedYearCode, selectedCycleCode]);

  const fetchTokens = async () => {
    try {
      const { orgcode, custcode } = getSessionCodes();
      const today = new Date().toISOString().slice(0, 10);
      const res = await axios.get(`${API_BASE1}/list-workspace`, {
        params: {
          fromdate: '2024-12-01',
          todate: today,
          orgcode: orgcode || sessionStorage.getItem('orgCode') || 'ICME01',
          custcode: 'ICME',
          usercode: sessionStorage.getItem('userCode') || 'ICME1',
          subject_code: '',
        },
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
      const data = res?.data;
      let items: any[] = [];
      if (Array.isArray(data)) items = data;
      else if (Array.isArray(data?.data)) items = data.data;
      else if (Array.isArray(data?.workspaces)) items = data.workspaces;
      const total = items.reduce((sum: number, w: any) => {
        return sum + Number(w.totaltokenusage || w.totalTokenUsage || w.totaltoken || 0);
      }, 0);
      setTotalTokens(total);
    } catch (e) {
      console.error('Failed to fetch tokens', e);
    }
  };

  useEffect(() => {
    if (!selected) {
      // Kicks off Year → (first year auto-selected) → Cycle → Subjects.
      // Re-read on every return to the list, so a stage changed while working
      // inside a subject is reflected without reloading the page.
      fetchYears();
      // If a cycle was previously selected, re-fetch its subjects. The
      // [selectedYearCode] useEffect will trigger and call fetchCycles(), so
      // we don't need to call it here explicitly. But we DO need to call
      // fetchSubjectsForCycle() because no cycle card was clicked.
      // Nothing to restore when the subject step is skipped; the cycle picker is
      // where Back lands in that configuration.
      if (selectedYearCode && selectedCycleCode && isEvaluationEnabled !== false) {
        void fetchSubjectsForCycle(selectedYearCode, selectedCycleCode);
      }
      fetchTokens();
      void loadWorkflowConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Cycle API never runs before a year is selected; it reruns for a manual
  // Year change same as it does for the auto-selected first year.
  useEffect(() => {
    if (selectedYearCode) {
      void fetchCycles(selectedYearCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYearCode]);

  // Student Export is only offered when all four workflow stages are enabled.
  // Starts hidden and stays hidden while loading, on error, or when the config
  // cannot be read.
  const [allWorkflowStagesEnabled, setAllWorkflowStagesEnabled] = useState(false);
  // Guards against a slow response from an earlier request overwriting a newer one.
  const configRequestIdRef = useRef(0);

  /**
   * Reads the organization's workflow configuration once and answers with the
   * Evaluation stage flag (null when it cannot be read, which keeps the subject
   * step rather than skipping it).
   */
  const fetchWorkflowConfig = async (): Promise<boolean | null> => {
    const requestId = ++configRequestIdRef.current;
    setAllWorkflowStagesEnabled(false);
    try {
      const { orgcode, custcode } = getSessionCodes();
      const res = await axios.get(`${API_BASE1}/get-config-info`, {
        params: {
          OrgCode: (orgcode || sessionStorage.getItem('orgCode') || 'ICME01').replace(/\x00/g, ''),
          CustCode: (custcode || 'ICME').replace(/\x00/g, ''),
          AppCode: 'AImarking',
          _t: Date.now(),
        },
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
      if (requestId !== configRequestIdRef.current) return null;
      const data = res && res.data ? res.data : null;
      // Answers as an array of records carrying configSetting; tolerate a bare object too.
      const config = Array.isArray(data) ? data[0]?.configSetting : (data?.configSetting ?? data);
      setAllWorkflowStagesEnabled(areAllWorkflowStagesEnabled(config?.workflowStages));
      const stages = config?.workflowStages;
      const evaluationOn = stages && typeof stages === 'object' ? Boolean((stages as any).evaluation) : null;
      setIsEvaluationEnabled(evaluationOn);
      return evaluationOn;
    } catch (error) {
      if (requestId !== configRequestIdRef.current) return null;
      console.error('Failed to load workflow configuration:', error);
      setAllWorkflowStagesEnabled(false);
      // Unknown, not "off": the subject step stays rather than being skipped
      // because the configuration could not be reached.
      setIsEvaluationEnabled(null);
      return null;
    }
  };

  /** Starts the config request and keeps the promise, so a cycle clicked while
   *  it is still in flight waits for it instead of firing a second one. */
  const loadWorkflowConfig = () => {
    const promise = fetchWorkflowConfig();
    workflowConfigPromiseRef.current = promise;
    return promise;
  };

  const resolveEvaluationEnabled = async (): Promise<boolean | null> => {
    if (isEvaluationEnabled !== null) return isEvaluationEnabled;
    return workflowConfigPromiseRef.current ?? loadWorkflowConfig();
  };

  const filtered = subjects.filter(s => {
    if (s.status === 0) return false;
    const matchesSearch = s.label.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = !selectedSubject || s.value === selectedSubject.value;
    return matchesSearch && matchesSubject;
  });

  const handleSelect = (subject: Subject) => {
    sessionStorage.setItem('subjectcode', subject.code);
    sessionStorage.setItem('subjectCode', subject.code);
    // Carry the Year/Cycle this subject was reached through into OCREvaluation,
    // so its own Subject dropdown can call get-subject-data for just this one
    // pair instead of fanning out across every Year x Cycle to rebuild the list.
    sessionStorage.setItem('yearcode', selectedYearCode);
    sessionStorage.setItem('yearCode', selectedYearCode);
    sessionStorage.setItem('cyclecode', selectedCycleCode);
    sessionStorage.setItem('cycleCode', selectedCycleCode);
    setSelected(subject);
  };

  if (selected) {
    const isGenericSelection = selected.code === GENERIC_SUBJECT.code;
    const backToCycles = () => {
      // Drop the stored cycle too, or the restore effect re-selects it at once.
      sessionStorage.removeItem('cyclecode');
      sessionStorage.removeItem('cycleCode');
      setSelected(null); setSelectedCycleCode(''); setSubjects([]);
    };
    return (
      <OCREvaluation
        preselectedSubject={selected.value}
        // No subject list to return to when the subject step was skipped, so
        // Back goes one level further, to the cycle picker.
        onBack={isGenericSelection ? backToCycles : () => setSelected(null)}
        genericSubjectMode={isGenericSelection}
        selectedSubjectLabel={selected.label}
        preselectedYearName={years.find(y => y.yearcode === selectedYearCode)?.yearname}
        preselectedCycleName={cycles.find(c => c.cyclecode === selectedCycleCode)?.cyclename}
        onBackToCycles={backToCycles}
      />
    );
  }

  return (
    <div className="h-screen min-h-0 bg-[#f4f6f9] flex flex-col overflow-hidden">
      {/* Header — identical to OCREvaluation header */}
      <header className={`bg-white border-b border-gray-200 px-4 sm:px-6 ${isAdmin ? 'pt-[28px]' : 'pt-3'} pb-3 sticky top-0 z-50 shrink-0`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center shrink-0">
              <img src="/lovable-uploads/b5b0f5a8-9552-4635-8c44-d5e6f994179c.png" alt="scan" className="h-7 w-auto object-contain" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-gray-900">OCR Evaluation</h1>
              <p className="text-xs text-gray-500 hidden sm:block">AI-powered Essay Marking</p>
            </div>
          </div>
            {/* Right controls: tokens and the account menu, shared with the OCR page. */}
            <div className="flex items-center gap-2 sm:gap-4">
              <HeaderAccountControls
                displayName={displayName || 'Evaluator'}
                tokenCount={tokenCount}
                onLogout={handleLogout}
              />
            </div>
          </div>
        </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Breadcrumb: shown once a cycle is picked, in place of the Select
            Cycle card below - jumps back to it without a refetch, since the
            cycle list already fetched is kept in state either way. Year and a
            separate "Cycles" step landed on the exact same screen, so only
            Year is kept as the clickable step back to it. */}
        {selectedCycleCode && (() => {
          const backToCycleSelection = () => {
            setSelectedCycleCode('');
            setSubjects([]);
            setSubjectError(null);
          };
          // Show the actual selected year (e.g. "2025") instead of the generic
          // "Select Year & Cycle" label, falling back to that label only when
          // no year is resolved yet (years still loading / not found).
          const selectedYearLabel = years.find(y => y.yearcode === selectedYearCode)?.yearname
            || selectedYearCode
            || 'Select Year & Cycle';
          return (
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-gray-500 flex-wrap">
              <button
                type="button"
                onClick={backToCycleSelection}
                className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:text-teal-700 hover:bg-teal-50 transition-colors"
              >
                <CalendarRange className="w-4 h-4" aria-hidden="true" />
                {selectedYearLabel}
              </button>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" aria-hidden="true" />
              <span className="font-medium text-gray-800" aria-current="page">
                {cycles.find(c => c.cyclecode === selectedCycleCode)?.cyclename || selectedCycleCode}
              </span>
            </nav>
          );
        })()}

        {/* Year → Cycle selection — hidden once a cycle is picked, so only the
            Subjects card below is on screen at that point. */}
        {!selectedCycleCode && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <CalendarRange className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedYearCode
                    ? `Cycle ${years.find(y => y.yearcode === selectedYearCode)?.yearname || selectedYearCode}`
                    : 'Select Year & Cycle'}
                </h2>
                <p className="text-sm text-gray-500">Select the year, then select the cycle to view its subjects</p>
              </div>
            </div>

            {/* Year dropdown — same pattern as OCREvaluation's Subject/Workspace dropdowns */}
            <div className="flex items-center bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm shrink-0">
              <span className="px-3 py-2.5 text-xs font-semibold text-gray-500 bg-gray-50 border-r border-gray-200 uppercase tracking-wide">Year</span>
              <select
                value={selectedYearCode}
                disabled={isYearLoading || years.length === 0}
                onChange={(e) => {
                  const code = e.target.value;
                  setSelectedYearCode(code);
                  // Instant feedback; fetchCycles clears them again once it runs,
                  // so nothing from the old year is left on screen in between.
                  setCycles([]);
                  setSelectedCycleCode('');
                  setSubjects([]);
                  setSubjectError(null);
                }}
                className="h-10 px-3 pr-8 text-sm font-medium text-gray-800 bg-transparent border-0 focus:ring-0 focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 appearance-none min-w-[140px]"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '1rem' }}
              >
                {years.map((year) => (
                  <option key={year.yearid || year.yearcode} value={year.yearcode}>{year.yearname}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cycle cards */}
          {isYearLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : yearError ? (
            <div className="text-center py-16 text-gray-400">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-40 text-amber-500" />
              <p className="text-sm font-medium text-gray-600">{yearError}</p>
              <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => fetchYears()}>
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </Button>
            </div>
          ) : years.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CalendarRange className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No year(s) found</p>
            </div>
          ) : isCycleLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : cycleError ? (
            <div className="text-center py-16 text-gray-400">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-40 text-amber-500" />
              <p className="text-sm font-medium text-gray-600">{cycleError}</p>
              <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => fetchCycles(selectedYearCode)}>
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </Button>
            </div>
          ) : cycles.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No cycles available for the selected year.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {cycles.map((cycle) => {
                const isCycleSelected = selectedCycleCode === cycle.cyclecode;
                // A cycle with no subjects yet is still open: the badge and the count
                // say so, but it can be picked like any other.
                const isYetToActive = cycle.subjectcount === 0;
                return (
                  <button
                    key={cycle.cycleid || cycle.cyclecode}
                    onClick={() => handleCycleSelect(cycle)}
                    disabled={isSubjectLoading}
                    aria-pressed={isCycleSelected}
                    className={`w-full text-left border rounded-xl p-4 bg-white transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed ${isCycleSelected
                      ? 'border-teal-500 ring-2 ring-teal-100 shadow-md'
                      : 'border-gray-200 hover:border-teal-400 hover:shadow-md'
                      }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isCycleSelected ? 'bg-teal-100' : 'bg-teal-50 group-hover:bg-teal-100'}`}>
                        <Layers className="w-5 h-5 text-teal-600" />
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${isYetToActive
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : isCycleSelected
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                        {isYetToActive ? 'Yet to Active' : isCycleSelected ? 'Selected' : 'Active'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold mb-1 line-clamp-1 text-gray-900 group-hover:text-teal-700 transition-colors">
                      {cycle.cyclename}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-400">Code: {cycle.cyclecode}</p>
                      <span className={`text-xs font-medium ${isYetToActive ? 'text-amber-600' : 'text-gray-500'}`}>
                        {cycle.subjectcount} Subject(s)
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* Only shown once a cycle is picked above - the flow is Cycle first,
            Subjects second, not both cards visible together from the start. The
            subject step itself exists only where Evaluation runs. */}
        {selectedCycleCode && isEvaluationEnabled !== false && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {/* Section header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <Layers className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Subjects</h2>
                <p className="text-sm text-gray-500">Select a subject to start evaluation</p>
              </div>
            </div>

            {/* Right controls: SUBJECT dropdown + Search */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <Input
                  placeholder="Search subjects..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 w-52 text-sm border border-gray-200 bg-white rounded-lg shadow-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Student Export Dialog */}
              <Dialog open={isExportDialogOpen} onOpenChange={(open) => {
                if (!open) {
                  setStudentRegisterNumber('');
                  setIsExportDialogOpen(false);
                }
              }}>
                {/* Shown only when get-config-info enables all four workflow stages, and only
                    when get-subject-data actually returned subjects for this org/year/cycle. */}
                {allWorkflowStagesEnabled && subjects.length > 0 && (
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="h-9 gap-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-sm"
                    onClick={() => {
                      setStudentRegisterNumber('');
                      setIsExportDialogOpen(true);
                    }}
                  >
                    <Download className="w-4 h-4" />
                    Student Export
                  </Button>
                </DialogTrigger>
                )}
                <DialogContent 
                  onInteractOutside={(e) => e.preventDefault()}
                  className="sm:max-w-[425px]"
                >
                  <DialogHeader>
                    <DialogTitle>Student Export</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="register-number" className="text-sm font-medium text-gray-700">
                        Student Register Number
                      </label>
                      <Input
                        id="register-number"
                        placeholder="Enter register number"
                        value={studentRegisterNumber}
                        onChange={(e) => setStudentRegisterNumber(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setStudentRegisterNumber('');
                      setIsExportDialogOpen(false);
                    }}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleStudentExport}
                      className="bg-teal-600 hover:bg-teal-700 text-white min-w-[100px]"
                      disabled={!studentRegisterNumber.trim() || isExporting}
                    >
                      {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      {isExporting ? 'Downloading...' : 'Download'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* SUBJECT dropdown — matches workspace page exactly */}
              
            </div>
          </div>

          {/* Cards grid — this whole section only mounts once a cycle is
              selected (see the guard around this card), so there is no
              "pick a cycle first" placeholder branch to handle here. */}
          {isSubjectLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-32 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : subjectError ? (
            <div className="text-center py-20 text-gray-400">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-40 text-amber-500" />
              <p className="text-base font-medium text-gray-600">{subjectError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-2"
                onClick={() => fetchSubjectsForCycle(selectedYearCode, selectedCycleCode)}
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-base font-medium">
                {subjects.length === 0 ? 'No subjects available for the selected cycle.' : 'No subject(s) found'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((subject, index) => (
                <button
                  key={`${subject.value || subject.code || 'subj'}-${index}`}
                  onClick={() => handleSelect(subject)}
                  className="text-left border border-gray-200 rounded-xl p-4 bg-white hover:border-teal-400 hover:shadow-md transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-1"
                >
                  <div className="flex items-start justify-between mb-3">
                    {/* Folder icon */}
                    <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                      <FolderOpen className="w-5 h-5 text-teal-600" />
                    </div>
                    {/* Status badge — Always Active since inactive subjects are filtered out */}
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                      Active
                    </span>
                  </div>

                  {/* Subject name */}
                  <p className="text-sm font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-teal-700 transition-colors">
                    {subject.label}
                  </p>

                  {/* Code + workspace count */}
                  <p className="text-xs text-gray-400 mb-3">Code: {toDisplaySubjectCode(subject.code)}</p>

                  {/* Workspace count */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <FolderOpen className="w-3.5 h-3.5 text-gray-400" />
                    {subject.workspaceCount} Workspace(s)
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3 shrink-0">
        <div className="flex justify-center items-center">
          <p className="text-center text-xs text-gray-400">
            Copyright © 2026 | Excelsoft Technologies Ltd. | Version: V.1.0.0
          </p>
        </div>
      </footer>

      {isExporting && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-xl flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <p className="text-sm font-medium text-gray-600">Exporting data...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectDashboard;
