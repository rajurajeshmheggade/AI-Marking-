
export interface SharedProps {
  selectedCustomer: string;
  selectedOrg: string;
  organizations: any[];
  loadingOrgs: boolean;
}

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen, Database, Award, LogOut, FileSpreadsheet,
  LayoutDashboard, FolderOpen, Users, Layers, Search,
  ChevronDown, ChevronUp, ChevronLeft, Upload, Send, Loader2, Trash2, Plus, Copy, CheckCircle2, ArrowLeft, Download, Eye, EyeOff, X, RotateCcw, Settings, Save, ListOrdered,
  ShieldCheck, UserCog, Lock, Unlock, Edit2, Check, AlertTriangle, Shield, Key, Crown, User, Filter, MoreVertical, GripVertical, ToggleLeft, ToggleRight, ChevronRight, MessageSquare, ScanLine, AlertCircle, FileText, Terminal,
  Image as ImageIcon, AudioLines, Video, Calendar, Network, Info, Sparkles
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import OCREvaluation from "./OCREvaluation";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import axios from 'axios';
import { PageLoader } from "@/components/ui/loader";
import { parseMarkdownToQuestions } from '../utils/mdQuestionParser';
import { getSessionCodes } from "@/lib/session";
import SandboxDashboard from './SandboxDashboard';
import SubjectDashboard from './SubjectDashboard';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const API_BASE = import.meta.env.VITE_ICMEPRODUCT_API_BASE || 'https://icmeprod.excelsoftcorp.com/icmeproduct';
const API_BASE1 = import.meta.env.VITE_AIMARKING_API_BASE || 'https://icmeprod.excelsoftcorp.com/AIMarkingAPI/api';
const REPO_BASE = import.meta.env.VITE_REPO_BASE || 'https://icmeprod.excelsoftcorp.com/ICME/icme_repo';

type ActiveSection = 'dashboard' | 'subject-question' | 'settings' | 'role-management';




interface Subject {
  value: string;
  label: string;
  code: string;
  workspaceCount: number;
  status?: number;
  guidelinepath?: string | null;
}

interface MarksSchemaCard {
  subjectCode: string;
  subjectName: string;
  guidelinepath: string;
}

interface Organization {
  organizationid: number;
  organizationname: string;
  organizationcode: string;
}

// â”€â”€â”€ Subject Dashboard (inside Admin) 
const AdminSubjectView: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  
  const loggedInRole = typeof window !== 'undefined' ? (sessionStorage.getItem('userRole') || 'superadmin').toLowerCase() : 'superadmin';
  const loggedInCustomer = typeof window !== 'undefined' ? sessionStorage.getItem('customerCode') || 'ICME' : 'ICME';
  const loggedInOrg = typeof window !== 'undefined' ? sessionStorage.getItem('orgCode') || '' : '';
  const isAdmin = loggedInRole === 'admin';

  const [selectedCustomer, setSelectedCustomer] = React.useState(isAdmin ? loggedInCustomer : 'ICME');
  const [selectedOrg, setSelectedOrg] = React.useState<string>(isAdmin ? loggedInOrg : '');
  const [loadingOrgs, setLoadingOrgs] = React.useState(true);

  React.useEffect(() => {
    const fetchOrganizations = async () => {
      setLoadingOrgs(true);
      try {
        const orgRes = await axios.get(`${API_BASE1}/organization-details?CustCode=${selectedCustomer || 'ICME'}`, {
          headers: { 'accept': '*/*' }
        });
        const orgData = orgRes.data?.data || [];
        setOrganizations(orgData);
        if (orgData.length > 0) setSelectedOrg(String(orgData[0].organizationid));
      } catch (error) {
        console.error('Error fetching organizations:', error);
        toast.error('Failed to load organizations');
      } finally {
        setLoadingOrgs(false);
      }
    };
    fetchOrganizations();
  }, [selectedCustomer]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchSubjects = React.useCallback(async () => {
    setLoading(true);
    try {
      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
      const orgCodeToSend = org ? org.organizationcode : '';

      const res = await axios.get(`${API_BASE1}/subject-list`, {
        params: {
          OrgCode: orgCodeToSend,
          CustCode: 'ICME'
        },
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
      const data = res?.data;
      const mapItem = (item: any): Subject => {
        if (typeof item === 'string') {
          const v = item.toLowerCase().replace(/\s+/g, '-');
          return { value: v, label: item, code: v, workspaceCount: 0 };
        }
        const label = (() => {
          const raw = item.subjectname || item.subjectName || item.SName || item.label || item.name;
          if (raw && typeof raw === 'object') return JSON.stringify(raw);
          if (raw != null) return String(raw);
          const strVal = Object.values(item).find(v => typeof v === 'string' && v.trim());
          return strVal ? String(strVal) : '(Unknown)';
        })();
        const rawCode = item.subjectcode || item.subjectCode || item.value || item.code;
        const value = rawCode != null ? String(rawCode) : label.toLowerCase().replace(/\s+/g, '-');
        return {
          value: String(value),
          label: String(label),
          code: String(value),
          workspaceCount: Number(item.workspacecount ?? item.workspaceCount ?? 0),
          status: Number(item.status ?? 1),
        };
      };
      let mapped: Subject[] = [];
      if (Array.isArray(data)) mapped = data.map(mapItem);
      else if (data && typeof data === 'object') {
        const arr = data.subjects || data.data || data.items || data.result || data.subjectList || [];
        if (Array.isArray(arr)) mapped = arr.map(mapItem);
        else {
          const vals = Object.values(data);
          if (vals.length > 0 && Array.isArray(vals[0])) mapped = (vals[0] as any[]).map(mapItem);
        }
      }
      if (mapped.length > 0) setSubjects(mapped.filter(s => s.status === 1));
    } catch (e) {
      console.error('Failed to load subjects', e);
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, organizations]);

  React.useEffect(() => {
    if (selectedOrg && organizations.length > 0) {
      fetchSubjects();
    }
  }, [fetchSubjects, selectedOrg, organizations]);

  const filtered = subjects.filter(s => {
    const matchesSearch = s.label.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = !selectedSubject || s.value === selectedSubject.value;
    return matchesSearch && matchesSubject;
  });

  const handleSelect = (subject: Subject) => {
    sessionStorage.setItem('subjectcode', subject.code);
    sessionStorage.setItem('subjectCode', subject.code);
    setSelected(subject);
  };

  if (selected) {
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    const orgCodeToSend = org ? org.organizationcode : '';
    return (
      <OCREvaluation
        preselectedSubject={selected.value}
        onBack={() => setSelected(null)}
        selectedSubjectLabel={selected.label}
        overrideOrgCode={orgCodeToSend}
      />
    );
  }

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        {/* Section header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Subjects</h2>
              <p className="text-sm text-gray-500">Select a subject to start evaluation</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full sm:w-auto">
            {/* Organization Dropdown — hidden for admin */}
            {!isAdmin && (
              <>
                <div className="flex flex-col w-48">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Select Customer</label>
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]/30 cursor-pointer text-gray-700 font-medium"
                  >
                    <option value="ICME">ICME</option>
                  </select>
                </div>
                <div className="flex flex-col w-48">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Select Organization</label>
                  <select
                    value={selectedOrg}
                    onChange={(e) => setSelectedOrg(e.target.value)}
                    disabled={loadingOrgs}
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]/30 cursor-pointer text-gray-700 font-medium disabled:opacity-60"
                  >
                    {loadingOrgs ? (
                      <option value="">Loading...</option>
                    ) : organizations.length > 0 ? (
                      organizations.map(org => (
                        <option key={org.organizationid} value={org.organizationid}>
                          {org.organizationname}
                        </option>
                      ))
                    ) : (
                      <option value="">No Organizations Found</option>
                    )}
                  </select>
                </div>
              </>
            )}

            <div className="relative w-full sm:w-auto sm:mb-0 mb-2 sm:self-end self-stretch">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                placeholder="Search subjects..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-[38px] w-full sm:w-52 text-sm border border-gray-200 bg-white rounded-lg shadow-sm"
              />
            </div>

            {/* <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg shadow-sm px-3 h-9">
              <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase select-none">Subject</span>
              <div className="w-px h-4 bg-gray-200" />
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(v => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-800 hover:text-teal-700 transition-colors min-w-[140px] justify-between focus:outline-none"
                >
                  <span className="truncate">{selectedSubject ? selectedSubject.label : 'All Subjects'}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search..."
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 bg-gray-50"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      <button
                        onClick={() => { setSelectedSubject(null); setDropdownOpen(false); setSearch(''); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${!selectedSubject ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        <span>All Subjects</span>
                        {!selectedSubject && <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
                      </button>
                      {subjects
                        .filter(s => s.label.toLowerCase().includes(search.toLowerCase()))
                        .map(s => (
                          <button
                            key={s.value}
                            onClick={() => { setSelectedSubject(s); setDropdownOpen(false); setSearch(''); handleSelect(s); }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${selectedSubject?.value === s.value ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                          >
                            <span className="truncate">{s.label}</span>
                            {selectedSubject?.value === s.value && <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div> */}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium">no subject yet</p>
            <p className="text-sm">please contact to admin</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium">No matching subjects found</p>
            <p className="text-sm">Try a different search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((subject, idx) => (
              <button
                key={`${subject.value}-${idx}`}
                onClick={() => handleSelect(subject)}
                className="text-left border border-gray-200 rounded-xl p-4 bg-white hover:border-teal-400 hover:shadow-md transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-1"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                    <FolderOpen className="w-5 h-5 text-teal-600" />
                  </div>
                  {subject.status !== 0 ? (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">Active</span>
                  ) : (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-400 border border-blue-200">Inactive</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-teal-700 transition-colors">{subject.label}</p>
                <p className="text-xs text-gray-400 mb-3">Code: {subject.code}</p>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <FolderOpen className="w-3.5 h-3.5 text-gray-400" />
                  {subject.workspaceCount} Workspace(s)
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// â”€â”€â”€ Inline Excel Editor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface SheetData {
  name: string;
  headers: string[];
  rows: Record<string, any>[];
}

const ExcelInlineEditor: React.FC<{ onClear: () => void }> = ({ onClear }) => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState('');

  const handleCellChange = (sheetIdx: number, rowIdx: number, col: string, val: string) => {
    setSheets(prev => {
      const next = prev.map((s, si) => {
        if (si !== sheetIdx) return s;
        const newRows = s.rows.map((r, ri) => ri === rowIdx ? { ...r, [col]: val } : r);
        return { ...s, rows: newRows };
      });
      return next;
    });
  };

  const handleUpload = async () => {
    if (!apiEndpoint.trim()) { toast.error('Please enter an API endpoint first.'); return; }
    setUploading(true);
    try {
      const payload = sheets.reduce((acc, s) => ({ ...acc, [s.name]: s.rows }), {} as Record<string, any>);
      await axios.post(apiEndpoint, payload);
      toast.success('Data uploaded successfully!');
    } catch {
      toast.error('Upload failed. Check your endpoint and try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sheet Tabs */}
      {sheets.length > 0 && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {sheets.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveSheet(i)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${activeSheet === i ? 'bg-[#2563eb] text-white border-[#2563eb]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#2563eb] hover:text-[#2563eb]'}`}
              >
                {s.name}
              </button>
            ))}
            <button onClick={onClear} className="ml-auto text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          </div>

          {/* Table */}
          {sheets[activeSheet] && (
            <div className="border border-gray-200 rounded-lg overflow-auto max-h-[420px] bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 w-10">#</th>
                    {sheets[activeSheet].headers.map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheets[activeSheet].rows.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                      <td className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100">{ri + 1}</td>
                      {sheets[activeSheet].headers.map(h => (
                        <td key={h} className="px-1 py-1 border-b border-gray-100">
                          <input
                            type="text"
                            value={row[h] || ''}
                            onChange={e => handleCellChange(activeSheet, ri, h, e.target.value)}
                            className="w-full min-w-[100px] px-2 py-1 text-xs rounded border border-transparent hover:border-gray-300 focus:border-[#2563eb] focus:outline-none focus:bg-blue-50/50 transition-all bg-transparent"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Upload Section */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
            <Label className="text-sm font-semibold text-gray-700">API Endpoint</Label>
            <Input
              value={apiEndpoint}
              onChange={e => setApiEndpoint(e.target.value)}
              placeholder="https://your-api.com/import"
              className="text-sm"
            />
            <Button
              className="w-full bg-[#2563eb] hover:bg-[#2563eb]/90 text-white font-semibold"
              disabled={sheets.every(s => s.rows.length === 0) || uploading}
              onClick={handleUpload}
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" />Upload All Sheets to API</>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

// â”€â”€â”€ Subject & Question Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface SubjectRow {
  subjectid: number;
  subjectcode: string;
  subjectname: string;
  kbpath: string | null;
  guidelinepath: string | null;
  workspacecount: number;
  status?: number;
  isReady?: number;
}

interface SubQuestionEntry {
  id: number;
  text: string;
  marks: number;
  rubrics: { text: string; score: number }[];
}

interface QuestionEntry {
  id: number;
  text: string;
  marks: number;
  rubrics: { text: string; score: number }[];
  subQuestions: SubQuestionEntry[];
}

interface YearCycleDropdownsProps {
  years: { yearcode: string; yearname: string }[];
  yearCode: string;
  onYearChange: (code: string) => void;
  yearsLoading: boolean;
  cycles: { cyclecode: string; cyclename: string }[];
  cycleCode: string;
  onCycleChange: (code: string) => void;
  cyclesLoading: boolean;
  // 'compact' matches the Subject & Question / Marks Schema rows, 'settings' the Config Settings row.
  variant: 'compact' | 'settings';
}

// Year + Cycle dropdowns shown right after the Organization dropdown on Config Settings,
// Subject & Question and Marks Schema. State lives in the dashboard so all three stay in sync.
const YearCycleDropdowns: React.FC<YearCycleDropdownsProps> = ({
  years, yearCode, onYearChange, yearsLoading, cycles, cycleCode, onCycleChange, cyclesLoading, variant,
}) => {
  const isSettings = variant === 'settings';
  const labelClass = isSettings
    ? 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2'
    : 'text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1';
  const selectClass = isSettings
    ? 'w-full px-4 py-2 pr-8 text-sm border border-gray-200 rounded-lg bg-white shadow-sm hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer text-gray-700 font-medium disabled:opacity-50'
    : 'w-full px-3 py-1.5 pr-8 text-sm border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]/30 appearance-none cursor-pointer text-gray-700 font-medium disabled:opacity-60';
  const wrapperClass = isSettings ? 'w-40' : 'flex flex-col w-40';
  const chevronClass = isSettings
    ? 'absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none'
    : 'absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none';
  return (
    <>
      <div className={wrapperClass}>
        <label className={labelClass}>Select Year</label>
        <div className="relative">
          <select
            id="header-year-select"
            value={yearCode}
            onChange={e => onYearChange(e.target.value)}
            disabled={yearsLoading}
            className={selectClass}
          >
            {yearsLoading
              ? <option>Loading...</option>
              : years.map(y => (
                  <option key={y.yearcode} value={y.yearcode}>{y.yearname || y.yearcode}</option>
                ))}
          </select>
          <ChevronDown className={chevronClass} />
        </div>
      </div>
      <div className={wrapperClass}>
        <label className={labelClass}>Select Cycle</label>
        <div className="relative">
          <select
            id="header-cycle-select"
            value={cycleCode}
            onChange={e => onCycleChange(e.target.value)}
            disabled={cyclesLoading || cycles.length === 0}
            className={selectClass}
          >
            {cyclesLoading
              ? <option>Loading...</option>
              : cycles.length === 0
                ? <option value="">No cycles</option>
                : cycles.map(c => (
                    <option key={c.cyclecode} value={c.cyclecode}>{c.cyclename || c.cyclecode}</option>
                  ))}
          </select>
          <ChevronDown className={chevronClass} />
        </div>
      </div>
    </>
  );
};

/**
 * Repo URL for a stored guideline path.
 *
 * The path is saved Windows-style and unencoded - "ICME\ICME01\AEP04\Broadcast
 * Journalism (BJ05) Mark Scheme.docx.md" - so the separators are flipped and the
 * spaces escaped. encodeURI is used rather than encodeURIComponent: it leaves the
 * slashes and the parentheses in the file name alone.
 */
const buildSchemeFileUrl = (guidelinePath: string) => {
  const raw = String(guidelinePath ?? '').trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '');
  return `${REPO_BASE.replace(/\/+$/, '')}/${encodeURI(normalized)}`;
};

/**
 * Reads a subject's marking scheme and lets it be edited in place.
 *
 * The file is read straight from the repo, and saving reuses the upload
 * endpoint - it takes a file, so the edited text is wrapped back into a .md
 * under the original filename.
 */
const MarkingSchemePreviewDialog: React.FC<{
  card: MarksSchemaCard | null;
  orgCode: string;
  onClose: () => void;
  onSaved?: () => void;
}> = ({ card, orgCode, onClose, onSaved }) => {
  const [content, setContent] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedContent, setEditedContent] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const hasUnsavedEdits = isEditing && editedContent !== content;

  React.useEffect(() => {
    if (!card) return;
    let cancelled = false;
    setContent('');
    setEditedContent('');
    setIsEditing(false);
    setConfirmDiscard(false);
    setLoading(true);

    const load = async () => {
      try {
        // Read the file straight from the repo. get-marking-scheme answers the
        // same content but without CORS headers, so the browser blocks it.
        const res = await axios.get(buildSchemeFileUrl(card.guidelinepath), {
          responseType: 'text',
          headers: { 'Accept': 'text/markdown, text/plain, */*', 'Cache-Control': 'no-cache' },
        });
        if (!cancelled) setContent(res.data || 'No content available.');
      } catch {
        if (!cancelled) setContent('Failed to load content. Please contact your administrator.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [card]);

  const requestClose = (force = false) => {
    if (!force && hasUnsavedEdits) {
      setConfirmDiscard(true);
      return;
    }
    setConfirmDiscard(false);
    onClose();
  };

  const handleSave = async () => {
    if (!card) return;
    setSaving(true);
    try {
      const fileName = String(card.guidelinepath).split(/[\\/]/).pop() || `${card.subjectCode}.md`;
      const fd = new FormData();
      fd.append('orgcode', orgCode || sessionStorage.getItem('orgCode') || 'ICME01');
      fd.append('custcode', 'ICME');
      fd.append('subjectcode', card.subjectCode);
      fd.append('file', new File([editedContent], fileName, { type: 'text/markdown' }), fileName);
      await axios.post(`${API_BASE}/upload-marking-scheme`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Reopening should show what was just saved, without refetching.
      setContent(editedContent);
      setIsEditing(false);
      toast.success('Marking scheme saved successfully!');
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!card} onOpenChange={() => { }}>
      <DialogContent
        className="flex flex-col overflow-hidden"
        style={{ maxWidth: '1100px', width: '95vw', height: '90vh', maxHeight: '90vh' }}
        onInteractOutside={e => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle>{card?.subjectName} &mdash; Marking Scheme</DialogTitle>
              <DialogDescription>Subject Code: {card?.subjectCode}</DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!loading && !isEditing && (
                <button
                  onClick={() => { setEditedContent(content); setIsEditing(true); }}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:border-[#2563eb] hover:text-[#2563eb] hover:bg-blue-50 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
              {isEditing && (
                <>
                  <button
                    onClick={() => { setIsEditing(false); setEditedContent(''); }}
                    disabled={saving}
                    className="h-8 px-3 inline-flex items-center rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || editedContent === content}
                    className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] text-xs font-semibold text-white hover:bg-blue-600 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              )}
              <div className="relative group">
                <button
                  onClick={() => requestClose()}
                  disabled={saving}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
                <span className="absolute -bottom-7 right-0 bg-gray-800 text-white text-xs rounded px-2 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">Close</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Closing on top of a part-finished edit would lose it silently. */}
        {confirmDiscard && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-800 font-medium">Close without saving your changes?</p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setConfirmDiscard(false)}
                className="h-7 px-2.5 rounded-md border border-amber-300 bg-white text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
              >
                Keep editing
              </button>
              <button
                onClick={() => requestClose(true)}
                className="h-7 px-2.5 rounded-md bg-red-600 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* min-h-0 is what lets these scroll inside the flex column rather than
            stretching the dialog past its height. */}
        {loading ? (
          <div className="flex-1 min-h-0 flex items-center justify-center gap-2 text-gray-400 bg-gray-50 rounded-lg border border-gray-200">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading...
          </div>
        ) : isEditing ? (
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            spellCheck={false}
            className="flex-1 min-h-0 overflow-y-auto scrollbar-slim bg-white rounded-lg p-4 text-sm font-mono leading-relaxed text-gray-700 border border-[#2563eb]/40 focus:outline-none focus:ring-4 focus:ring-[#2563eb]/10 resize-none"
          />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-slim bg-gray-50 rounded-lg p-4 text-sm font-mono leading-relaxed whitespace-pre-wrap text-gray-700 border border-gray-200">
            {content || 'No content available.'}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

/**
 * The blocking overlay these dashboard pages use while a long action runs.
 * Shared so an upload started from a dialog looks the same as one started from
 * the toolbar behind it, and sits above both.
 */
const UploadingOverlay: React.FC<{ text: string }> = ({ text }) => (
  <div
    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4"
    style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
  >
    <div className="relative w-20 h-20">
      <div className="absolute inset-0 rounded-full border-4 border-white/10" />
      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#2563eb] border-r-[#2563eb] animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-[#2563eb]/20 animate-pulse" />
      </div>
    </div>
    <p className="text-white font-semibold text-sm tracking-wide animate-pulse">{text}</p>
  </div>
);

interface SubjectQuestionPanelProps {
  yearCode: string;
  cycleCode: string;
  yearCycleSelector: React.ReactNode;
}

const SubjectQuestionPanel: React.FC<SubjectQuestionPanelProps> = ({ yearCode, cycleCode, yearCycleSelector }) => {
  // â”€â”€ Subject table state â”€â”€
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingSubjects, setDeletingSubjects] = useState(false);
  const [statusToggleSubject, setStatusToggleSubject] = useState<{ code: string, name: string, newStatus: number } | null>(null);
  // Marking schemes are uploaded from here now, in a dialog, rather than from a
  // page of their own.
  const [showMarkingSchemeDialog, setShowMarkingSchemeDialog] = useState(false);
  // Scheme opened from the Guideline Path column, for preview and editing.
  const [previewScheme, setPreviewScheme] = useState<MarksSchemaCard | null>(null);
  // Bulk Active / Inactive for the checked rows: 1 activates, 0 deactivates.
  const [bulkStatusTarget, setBulkStatusTarget] = useState<0 | 1 | null>(null);
  const [bulkStatusSaving, setBulkStatusSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  // Subject code whose activation is waiting on the workflow-config lookup.
  const [checkingActivationConfig, setCheckingActivationConfig] = useState<string | null>(null);

  // ── Question Preview state ──
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewSubjectCode, setPreviewSubjectCode] = useState('');
  // Editing the previewed questions. editedQuestions is a working copy, so
  // Cancel falls back to what the API returned.
  const [isEditingPreview, setIsEditingPreview] = useState(false);
  const [editedQuestions, setEditedQuestions] = useState<any[]>([]);
  const [savingPreview, setSavingPreview] = useState(false);

  // ── Import Dialog state ──
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  type ImportTab = 'subject' | 'questions';
  const [importTab, setImportTab] = useState<ImportTab>('subject');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<Record<string, any>[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  // ── Import Dialog: Year / Cycle (import-subject-data-v2 requires both) ──
  const [importYears, setImportYears] = useState<{ yearid: string; yearname: string; yearcode: string }[]>([]);
  const [importSelectedYearCode, setImportSelectedYearCode] = useState('');
  const [importYearsLoading, setImportYearsLoading] = useState(false);
  const [importCycles, setImportCycles] = useState<{ cycleid: string; cyclename: string; cyclecode: string; yearcode?: string }[]>([]);
  const [importSelectedCycleCode, setImportSelectedCycleCode] = useState('');
  const [importCyclesLoading, setImportCyclesLoading] = useState(false);

  // â”€â”€ Organization state â”€â”€
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedCustomer, setSelectedCustomer] = React.useState('ICME');
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [loadingOrgs, setLoadingOrgs] = useState<boolean>(true);

  // -- Role --
  const loggedInRole = typeof window !== 'undefined' ? (sessionStorage.getItem('userRole') || 'superadmin').toLowerCase() : 'superadmin';
  const isAdmin = loggedInRole === 'admin';

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        setLoadingOrgs(true);
        const orgRes = await axios.get(
          `${API_BASE1}/organization-details?CustCode=ICME`,
          { headers: { 'accept': '*/*' } }
        );

        const orgData = orgRes.data?.data;
        if (orgData && Array.isArray(orgData)) {
          setOrganizations(orgData);
          if (orgData.length > 0) {
            setSelectedOrg(String(orgData[0].organizationid));
          }
        }
      } catch (error) {
        console.error('Error fetching organizations:', error);
        toast.error('Failed to load organizations');
      } finally {
        setLoadingOrgs(false);
      }
    };
    fetchOrganizations();
  }, []);

  // Years for the Import dialog's Year/Cycle step - fetched once, same as
  // organizations above; the first year is auto-selected, which cascades to
  // fetching that year's cycles below.
  useEffect(() => {
    const fetchImportYears = async () => {
      setImportYearsLoading(true);
      try {
        // No params at all - sending yearName='' made the backend filter for
        // an exact empty match and return nothing; omitting it returns every year.
        const res = await axios.get(`${API_BASE1}/get-year-data`);
        const data = res?.data;
        const arr: any[] = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        const mapped = arr
          .filter(item => item && typeof item === 'object')
          .map((item: any) => ({
            yearid: String(item.yearid ?? item.yearId ?? ''),
            yearname: String(item.yearname ?? item.yearName ?? ''),
            yearcode: String(item.yearcode ?? item.yearCode ?? ''),
          }))
          .filter(y => y.yearcode);
        setImportYears(mapped);
        setImportSelectedYearCode(mapped.length > 0 ? mapped[0].yearcode : '');
      } catch (error) {
        console.error('Error fetching years for import:', error);
        toast.error('Failed to load years');
      } finally {
        setImportYearsLoading(false);
      }
    };
    fetchImportYears();
  }, []);

  // Cycles for whichever year is selected in the Import dialog.
  useEffect(() => {
    if (!importSelectedYearCode) {
      setImportCycles([]);
      setImportSelectedCycleCode('');
      return;
    }
    const fetchImportCycles = async () => {
      setImportCyclesLoading(true);
      setImportCycles([]);
      setImportSelectedCycleCode('');
      try {
        // get-cycle-data scopes to the selected year server-side via YearCode;
        // its response carries no year field of its own to filter on client-side.
        // OrgCode narrows it to the signed-in organization, from the login response
        // the session holds.
        const { orgcode } = getSessionCodes();
        const res = await axios.get(`${API_BASE1}/get-cycle-data`, {
          params: {
            YearCode: importSelectedYearCode,
            OrgCode: (orgcode || sessionStorage.getItem('orgCode') || '').replace(/\x00/g, ''),
          },
        });
        const data = res?.data;
        const arr: any[] = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        const mapped = arr
          .filter(item => item && typeof item === 'object')
          .map((item: any) => ({
            cycleid: String(item.cycleid ?? item.cycleId ?? ''),
            cyclename: String(item.cyclename ?? item.cycleName ?? ''),
            cyclecode: String(item.cyclecode ?? item.cycleCode ?? ''),
            yearcode: item.yearcode != null ? String(item.yearcode) : importSelectedYearCode,
          }))
          .filter(c => c.cyclecode);
        setImportCycles(mapped);
        if (mapped.length > 0) setImportSelectedCycleCode(mapped[0].cyclecode);
      } catch (error) {
        console.error('Error fetching cycles for import:', error);
        toast.error('Failed to load cycles');
      } finally {
        setImportCyclesLoading(false);
      }
    };
    fetchImportCycles();
  }, [importSelectedYearCode]);

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // CSV only: the accept filter can be bypassed in the file dialog, so the
    // extension is checked here too rather than trusting the picker.
    if (!/\.csv$/i.test(f.name)) {
      toast.error('Only .csv files are allowed. Please upload a CSV template.');
      e.target.value = '';
      return;
    }
    setImportFile(f);
    setShowPreview(false);
    setImportHeaders([]);
    setImportRows([]);

    // Auto-preview logic
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const wsData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
      const headers = wsData.length > 0 ? Object.keys(wsData[0]) : [];
      setImportHeaders(headers);
      setImportRows(wsData);
      setShowPreview(true);
    } catch {
      toast.error('Failed to parse file. Ensure it is a valid Excel or CSV.');
    }

    if (importFileRef.current) importFileRef.current.value = '';
  };

  const handleImportPreview = async () => {
    // Kept for manual refresh if needed, or can be removed if not needed.
    // The user said "no need click the preview button remove this"
    // So we can potentially remove the function or just keep it for internal use.
    if (!importFile) return;
    try {
      const buf = await importFile.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const wsData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
      const headers = wsData.length > 0 ? Object.keys(wsData[0]) : [];
      setImportHeaders(headers);
      setImportRows(wsData);
      setShowPreview(true);
    } catch {
      toast.error('Failed to parse file. Ensure it is a valid Excel or CSV.');
    }
  };

  // â”€â”€ Expected headers per tab (matches template sheets) â”€â”€
  const IMPORT_SCHEMA: Record<string, { sheet: string; headers: string[] }> = {
    subject: { sheet: 'Subject', headers: ['Subject Code', 'Subject Name'] },
    questions: { sheet: 'Subject_Question', headers: ['Subject Code', 'Question Label', 'Question JSON', 'Max Score'] },

  };

  const IMPORT_IS_TYPE: Record<string, number> = { subject: 0, questions: 1 };

  const validateImportHeaders = async (file: File): Promise<boolean> => {
    try {
      const schema = IMPORT_SCHEMA[importTab];
      if (!schema) return true;

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });

      // For CSV files use first sheet; for xlsx check named sheet
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      const sheetName = isCsv ? wb.SheetNames[0] : (wb.SheetNames.includes(schema.sheet) ? schema.sheet : null);
      if (!sheetName) {
        toast.error(`Sheet "${schema.sheet}" not found. Please use the correct template.`);
        return false;
      }

      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
      const fileHeaders: string[] = (rows[0] || []).map((h: any) => String(h).trim());

      const missing = schema.headers.filter(h => !fileHeaders.includes(h));
      const extra = fileHeaders.filter(h => !schema.headers.includes(h));

      if (missing.length > 0) {
        toast.error(`Missing column(s) in "${schema.sheet}" sheet: ${missing.join(', ')}`);
        return false;
      }
      if (extra.length > 0) {
        toast.error(`Unexpected column(s) in "${schema.sheet}" sheet: ${extra.join(', ')}. Please use the downloaded template.`);
        return false;
      }

      return true;
    } catch {
      toast.error('Could not read the file for header validation. Ensure it is a valid Excel (.xlsx) file.');
      return false;
    }
  };

  const handleImportSubmit = async () => {
    // â”€â”€ Year / Cycle are required by import-subject-data-v2 â”€â”€
    if (!importSelectedYearCode || !importSelectedCycleCode) {
      toast.error('Please select a Year and a Cycle before importing.');
      return;
    }

    // â”€â”€ Header validation before upload â”€â”€
    const isValid = await validateImportHeaders(importFile);
    if (!isValid) return;

    // Validations for questions import
    if (importTab === 'questions') {
      // 1. Subject Code must exist
      const fileSubjectCodes = Array.from(new Set(importRows.map(row => String(row['Subject Code'] || '').trim().toLowerCase()).filter(Boolean)));
      const existingCodes = subjects.map(s => String(s.subjectcode || '').trim().toLowerCase());
      const missing = fileSubjectCodes.filter(code => !existingCodes.includes(code));
      if (missing.length > 0) {
        toast.error(`Subject code(s) not found: ${missing.join(', ')}. Please add the subject first.`);
        return;
      }

      // 2. Max Score must be 1-99
      const invalidScores = importRows
        .map((row, i) => ({ row: i + 2, score: Number(row['Max Score']) }))
        .filter(({ score }) => !Number.isFinite(score) || score < 1 || score > 99);
      if (invalidScores.length > 0) {
        toast.error(`Max Score must be between 1 and 99. Invalid at row(s): ${invalidScores.map(r => r.row).join(', ')}`);
        return;
      }

      // 3. Duplicate Subject Code + Question Label
      const seen = new Map<string, number>();
      const duplicates: string[] = [];
      importRows.forEach((row, i) => {
        const key = `${String(row['Subject Code'] || '').trim().toLowerCase()}::${String(row['Question Label'] || '').trim().toLowerCase()}`;
        if (seen.has(key)) {
          duplicates.push(`Row ${i + 2}: Subject "${row['Subject Code']}" Label "${row['Question Label']}" is duplicate`);
        } else { seen.set(key, i); }
      });
      if (duplicates.length > 0) {
        toast.error(`Duplicate Subject Code + Question Label found: ${duplicates.slice(0, 3).join('; ')}${duplicates.length > 3 ? ` and ${duplicates.length - 3} more` : ''}`);
        return;
      }

      // 4. Question JSON must be valid JSON
      const invalidJson: number[] = [];
      importRows.forEach((row, i) => {
        const jsonStr = String(row['Question JSON'] || '').trim();
        if (!jsonStr) { invalidJson.push(i + 2); return; }
        try { JSON.parse(jsonStr); } catch { invalidJson.push(i + 2); }
      });
      if (invalidJson.length > 0) {
        toast.error(`Invalid JSON in "Question JSON" at row(s): ${invalidJson.slice(0, 5).join(', ')}${invalidJson.length > 5 ? ` and ${invalidJson.length - 5} more` : ''}. Please fix and re-upload.`);
        return;
      }
    }

    // Validations for subject import
    if (importTab === 'subject') {
      const existingSubjectCodes = subjects.map(s => String(s.subjectcode || '').trim().toLowerCase());
      const existingSubjectNames = subjects.map(s => String(s.subjectname || '').trim().toLowerCase());

      // 1. Duplicate Subject Code within file (case-insensitive)
      const seenCodes = new Map<string, number>();
      const dupCodes: string[] = [];
      importRows.forEach((row, i) => {
        const code = String(row['Subject Code'] || '').trim().toLowerCase();
        if (!code) return;
        if (seenCodes.has(code)) {
          dupCodes.push(`Row ${i + 2}: "${row['Subject Code']}" (duplicate of row ${seenCodes.get(code)! + 2})`);
        } else { seenCodes.set(code, i); }
      });
      if (dupCodes.length > 0) {
        toast.error(`Duplicate Subject Code in file: ${dupCodes.slice(0, 3).join('; ')}${dupCodes.length > 3 ? ` and ${dupCodes.length - 3} more` : ''}`);
        return;
      }

      // 2. Duplicate Subject Name within file (case-insensitive)
      const seenNames = new Map<string, number>();
      const dupNames: string[] = [];
      importRows.forEach((row, i) => {
        const name = String(row['Subject Name'] || '').trim().toLowerCase();
        if (!name) return;
        if (seenNames.has(name)) {
          dupNames.push(`Row ${i + 2}: "${row['Subject Name']}" (duplicate of row ${seenNames.get(name)! + 2})`);
        } else { seenNames.set(name, i); }
      });
      if (dupNames.length > 0) {
        toast.error(`Duplicate Subject Name in file: ${dupNames.slice(0, 3).join('; ')}${dupNames.length > 3 ? ` and ${dupNames.length - 3} more` : ''}`);
        return;
      }

      // 3. Subject Code already exists in system (case-insensitive)
      const alreadyExistCodes = importRows
        .filter(row => existingSubjectCodes.includes(String(row['Subject Code'] || '').trim().toLowerCase()))
        .map(row => String(row['Subject Code'] || ''));
      if (alreadyExistCodes.length > 0) {
        toast.error(`Subject Code(s) already exist: ${[...new Set(alreadyExistCodes)].join(', ')}. Use a different code or update via edit.`);
        return;
      }

      // 4. Subject Name already exists in system (case-insensitive)
      const alreadyExistNames = importRows
        .filter(row => existingSubjectNames.includes(String(row['Subject Name'] || '').trim().toLowerCase()))
        .map(row => String(row['Subject Name'] || ''));
      if (alreadyExistNames.length > 0) {
        toast.error(`Subject Name(s) already exist: ${[...new Set(alreadyExistNames)].join(', ')}. Use a different name.`);
        return;
      }
    }

    setImporting(true);
    try {
      const buf = await importFile.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });

      // Sanitize all strings in all sheets
      wb.SheetNames.forEach(sheetName => {
        const ws = wb.Sheets[sheetName];
        if (!ws) return;
        Object.keys(ws).forEach(cell => {
          if (cell.startsWith('!')) return;
          const c = ws[cell];
          if (c && c.t === 's' && typeof c.v === 'string') {
            c.v = c.v.replace(/\x00/g, '');
            if (c.w) c.w = c.w.replace(/\x00/g, '');
          }
        });
      });

      let sanitizedFile: File;
      const isCsv = importFile.name.toLowerCase().endsWith('.csv');

      if (isCsv) {
        // Use XLSX to write CSV to ensure proper quoting/escaping
        const csvString = XLSX.write(wb, { bookType: 'csv', type: 'string' });
        sanitizedFile = new File([csvString], importFile.name, { type: 'text/csv' });
      } else {
        const sanitizedBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        sanitizedFile = new File([sanitizedBuf], importFile.name, { type: importFile.type });
      }
      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
      const orgCodeToSend = org ? org.organizationcode : '';

      const formData = new FormData();
      formData.append('File', sanitizedFile);
      formData.append('IsType', String(IMPORT_IS_TYPE[importTab] ?? 0));
      formData.append('OrgCode', orgCodeToSend);
      // -v2 use case is otherwise identical; it only adds these two.
      formData.append('YearCode', importSelectedYearCode);
      formData.append('CycleCode', importSelectedCycleCode);

      const res = await axios.post(
        `${API_BASE1}/import-subject-data-v2`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const status = res?.data?.status;
      const message = res?.data?.message || '';
      if (status === 'S001') {
        toast.success('Subject added successfully!');
        fetchSubjects();
        resetImportDialog(); setImportDialogOpen(false);
      } else if (status === 'S002') {
        toast.info('Subject already exists and updated successfully.');
        fetchSubjects();
        resetImportDialog(); setImportDialogOpen(false);
      } else if (status && String(status).startsWith('F')) {
        toast.error(`Failed to import: ${message || 'Please check your file and try again.'}`);
      } else {
        toast.success('Import completed successfully!');
        fetchSubjects();
        resetImportDialog(); setImportDialogOpen(false);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Import failed. Please try again.';
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const resetImportDialog = () => {
    setImportFile(null);
    setImportHeaders([]);
    setImportRows([]);
    setShowPreview(false);
    setImporting(false);
    if (importFileRef.current) importFileRef.current.value = '';
  };
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const makeId = () => Date.now() + Math.random();
  const getInitialQuestions = (): QuestionEntry[] => [
    { id: makeId(), text: '', marks: 0, rubrics: [{ text: '', score: 0 }], subQuestions: [] }
  ];
  const [questions, setQuestions] = useState<QuestionEntry[]>(getInitialQuestions());
  const [copied, setCopied] = useState(false);
  const [questionFormat, setQuestionFormat] = useState<'main-rubric' | 'main-sub-rubric' | 'sub-only'>('main-rubric');

  // fetchSubjects uses the yearCode/cycleCode received from the parent header
  // dropdowns so the user can switch year/cycle without re-opening any dialog.
  const fetchSubjects = React.useCallback(async () => {
    setLoadingSubjects(true);
    try {
      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
      const orgCodeToSend = org ? org.organizationcode : '';

      if (!yearCode || !cycleCode) {
        setSubjects([]);
        toast.error('No Year/Cycle available to load subjects.');
        return;
      }
      const userCode = (sessionStorage.getItem('userCode') || sessionStorage.getItem('username') || '').replace(/\x00/g, '');

      const res = await axios.get(`${API_BASE1}/get-subject-data`, {
        params: {
          orgCode: orgCodeToSend,
          custCode: 'ICME',
          yearCode,
          cycleCode,
          userCode,
        },
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
      const data = res?.data;
      let rawRows: any[] = [];
      if (Array.isArray(data)) rawRows = data;
      else if (Array.isArray(data?.data)) rawRows = data.data;
      else if (Array.isArray(data?.subjects)) rawRows = data.subjects;
      const rows: SubjectRow[] = rawRows.map((item: any) => ({
        subjectid: Number(item.subjectid ?? item.subjectId ?? 0),
        subjectcode: String(item.subjectcode ?? item.subjectCode ?? ''),
        subjectname: String(item.subjectname ?? item.subjectName ?? ''),
        kbpath: item.kbpath ?? null,
        guidelinepath: item.guidelinepath ?? null,
        workspacecount: Number(item.workspacecount ?? item.workspaceCount ?? 0),
        status: Number(item.status ?? 1),
        isReady: item.isReady,
      }));
      setSubjects(rows);
    } catch (e) {
      console.error('Failed to fetch subjects', e);
      toast.error('Failed to load subjects');
    } finally {
      setLoadingSubjects(false);
    }
  }, [selectedOrg, organizations, yearCode, cycleCode]);

  // â”€â”€ Fetch subjects when selected organization changes â”€â”€
  useEffect(() => {
    if (selectedOrg && organizations.length > 0) {
      fetchSubjects();
    }
  }, [fetchSubjects, selectedOrg, organizations]);

  // â”€â”€ Filtered rows â”€â”€
  const filtered = subjects.filter(s =>
    s.subjectname?.toLowerCase().includes(search.toLowerCase()) ||
    s.subjectcode?.toLowerCase().includes(search.toLowerCase())
  );

  const selectableFiltered = filtered.filter(s => Number(s.workspacecount ?? 0) === 0);
  const selectedSubjectRows = filtered.filter(
    s => selectedRows.has(s.subjectid) && Number(s.workspacecount ?? 0) === 0
  );
  const selectedDeletableCount = selectedSubjectRows.length;
  // Bulk status only offers the direction that would actually change something:
  // already-active rows cannot be activated again, and vice versa.
  const selectedInactiveRows = selectedSubjectRows.filter(s => Number(s.status ?? 0) !== 1);
  const selectedActiveRows = selectedSubjectRows.filter(s => Number(s.status ?? 0) === 1);

  // â”€â”€ Row selection â”€â”€
  const toggleRow = (id: number) => {
    const row = subjects.find(s => s.subjectid === id);
    if (!row || Number(row.workspacecount ?? 0) > 0) return;
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    const selectableIds = selectableFiltered.map(s => s.subjectid);
    if (selectableIds.length === 0) {
      setSelectedRows(new Set());
      return;
    }
    const allSelectableSelected = selectableIds.every(id => selectedRows.has(id));
    if (allSelectableSelected) {
      setSelectedRows(prev => {
        const next = new Set(prev);
        selectableIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedRows(prev => {
        const next = new Set(prev);
        selectableIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  useEffect(() => {
    setSelectedRows(prev => {
      const next = new Set<number>();
      prev.forEach(id => {
        const row = subjects.find(s => s.subjectid === id);
        if (row && Number(row.workspacecount ?? 0) === 0) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [subjects]);

  // â”€â”€ Download Template â”€â”€
  const downloadSubjectTemplate = () => {
    const csvContent = 'Subject Code,Subject Name\nS1,Broadcast Journalism';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Subject_Template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Subject template downloaded!');
  };


  // â”€â”€ JSON Creator helpers â”€â”€
  const resetJsonDialog = () => setQuestions(getInitialQuestions());

  const addQuestion = () => setQuestions(prev => [
    ...prev,
    { id: makeId(), text: '', marks: 0, rubrics: [{ text: '', score: 0 }], subQuestions: [] }
  ]);
  const removeQuestion = (id: number) => setQuestions(prev => prev.filter(q => q.id !== id));
  const updateQuestion = (id: number, patch: Partial<QuestionEntry>) =>
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));

  const addMainRubric = (id: number) =>
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, rubrics: [...q.rubrics, { text: '', score: 0 }] } : q));
  const removeMainRubric = (id: number, ri: number) =>
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, rubrics: q.rubrics.filter((_, i) => i !== ri) } : q));
  const updateMainRubric = (id: number, ri: number, patch: { text?: string; score?: number }) =>
    setQuestions(prev => prev.map(q => q.id === id ? {
      ...q, rubrics: q.rubrics.map((r, i) => i === ri ? { ...r, ...patch } : r)
    } : q));

  const addSubQuestion = (qId: number) =>
    setQuestions(prev => prev.map(q => q.id === qId ? {
      ...q, subQuestions: [...q.subQuestions, { id: makeId(), text: '', marks: 0, rubrics: [{ text: '', score: 0 }] }]
    } : q));
  const removeSubQuestion = (qId: number, sqId: number) =>
    setQuestions(prev => prev.map(q => q.id === qId ? {
      ...q, subQuestions: q.subQuestions.filter(sq => sq.id !== sqId)
    } : q));
  const updateSubQuestion = (qId: number, sqId: number, patch: Partial<SubQuestionEntry>) =>
    setQuestions(prev => prev.map(q => q.id === qId ? {
      ...q, subQuestions: q.subQuestions.map(sq => sq.id === sqId ? { ...sq, ...patch } : sq)
    } : q));

  const addRubric = (qId: number, sqId: number) =>
    setQuestions(prev => prev.map(q => q.id === qId ? {
      ...q, subQuestions: q.subQuestions.map(sq => sq.id === sqId ? { ...sq, rubrics: [...sq.rubrics, { text: '', score: 0 }] } : sq)
    } : q));
  const removeRubric = (qId: number, sqId: number, ri: number) =>
    setQuestions(prev => prev.map(q => q.id === qId ? {
      ...q, subQuestions: q.subQuestions.map(sq => sq.id === sqId ? { ...sq, rubrics: sq.rubrics.filter((_, i) => i !== ri) } : sq)
    } : q));
  const updateRubric = (qId: number, sqId: number, ri: number, patch: { text?: string; score?: number }) =>
    setQuestions(prev => prev.map(q => q.id === qId ? {
      ...q, subQuestions: q.subQuestions.map(sq => sq.id === sqId ? {
        ...sq, rubrics: sq.rubrics.map((r, i) => i === ri ? { ...r, ...patch } : r)
      } : sq)
    } : q));

  const totalMarks = questions.reduce((sum, q) => {
    if (questionFormat === 'main-rubric') {
      return sum + (Number(q.marks) || 0);
    }
    if (q.subQuestions.length > 0) {
      return sum + q.subQuestions.reduce((s, sq) => s + (Number(sq.marks) || 0), 0);
    }
    return sum + (Number(q.marks) || 0);
  }, 0);

  const generatedJson = JSON.stringify(
    questionFormat === 'sub-only'
      ? questions.flatMap(q =>
        q.subQuestions.length > 0
          ? q.subQuestions.map(sq => ({
            text: sq.text,
            marks: Number(sq.marks),
            rubric: sq.rubrics.filter(r => r.text.trim()).map(r => ({ text: r.text, score: Number(r.score) }))
          }))
          : [{
            text: q.text,
            marks: Number(q.marks),
            rubric: q.rubrics.filter(r => r.text.trim()).map(r => ({ text: r.text, score: Number(r.score) }))
          }]
      )
      : questionFormat === 'main-sub-rubric'
        ? questions.flatMap(q => [
          { text: q.text },
          ...q.subQuestions.map(sq => ({
            text: sq.text,
            marks: Number(sq.marks),
            rubric: sq.rubrics.filter(r => r.text.trim()).map(r => ({ text: r.text, score: Number(r.score) }))
          }))
        ])
        : questions.map(q => ({
          text: q.text,
          marks: Number(q.marks),
          rubric: q.rubrics.filter(r => r.text.trim()).map(r => ({ text: r.text, score: Number(r.score) }))
        })),
    null, 4
  );

  const handleCopy = () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(generatedJson).then(() => {
          setCopied(true);
          toast.success('JSON copied!');
          setTimeout(() => setCopied(false), 2000);
        }).catch(() => fallbackCopy());
      } else {
        fallbackCopy();
      }
    } catch {
      fallbackCopy();
    }
  };

  const fallbackCopy = () => {
    const ta = document.createElement('textarea');
    ta.value = generatedJson;
    // Position off-screen but still part of the DOM to allow focus/selection
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopied(true);
        toast.success('JSON copied!');
        setTimeout(() => setCopied(false), 2000);
      } else {
        throw new Error('execCommand failed');
      }
    } catch (err) {
      console.error('Fallback copy failed', err);
      toast.error('Copy failed. Please copy manually from the output box.');
    }
    document.body.removeChild(ta);
  };

  /** The questions as the preview shows them, whichever shape the API used. */
  const readPreviewQuestions = (data: any): any[] =>
    Array.isArray(data) ? data : (Array.isArray(data?.ref1Data) ? data.ref1Data : []);

  /** Replaces one field deep in the working copy, leaving everything else as-is. */
  const updateEditedQuestion = (qi: number, mutate: (question: any) => void) => {
    setEditedQuestions(prev => {
      const next = prev.map((q, i) => (i === qi ? JSON.parse(JSON.stringify(q)) : q));
      mutate(next[qi]);
      return next;
    });
  };

  /**
   * A question's total marks are whatever its parts add up to, never typed in:
   * a part split into a. / b. sub-questions counts as the sum of those, and any
   * other part counts as its own marks, so nothing is counted twice.
   */
  const sumQuestionMarks = (question: any): number => {
    const list = question?.questionText ?? question?.questiontext;
    if (!Array.isArray(list)) return 0;
    return list.reduce((total: number, part: any) => {
      const subs = Array.isArray(part?.subQuestions) ? part.subQuestions : [];
      if (subs.length > 0) {
        return total + subs.reduce((sum: number, sq: any) => sum + (Number(sq?.marks) || 0), 0);
      }
      return total + (Number(part?.marks) || 0);
    }, 0);
  };

  /** A blank sub-question, shaped like the ones the API returns. */
  const makeBlankSubQuestion = () => ({ text: '', marks: 0, rubric: [] as any[] });

  /** Appends a main question, labelled after the highest number already used. */
  const addEditedQuestion = () => {
    setEditedQuestions(prev => {
      const highest = prev.reduce((max, q) => {
        const n = parseInt(String(q.questionLabel ?? q.questionlabel ?? ''), 10);
        return Number.isFinite(n) ? Math.max(max, n) : max;
      }, 0);
      return [...prev, {
        questionLabel: String(highest + 1),
        marks: 0,
        questionText: [makeBlankSubQuestion()],
      }];
    });
  };

  /** a., b., c. ... for the sub-questions under a main question. */
  const subQuestionLabel = (index: number) => String.fromCharCode(97 + (index % 26));

  /**
   * Appends a sub-question under one main question, so Q1's stem can carry
   * a. / b. parts of its own.
   */
  const addEditedNestedSubQuestion = (qi: number, pi: number) => {
    updateEditedQuestion(qi, (question) => {
      const list = question.questionText ?? question.questiontext;
      if (!Array.isArray(list) || !list[pi]) return;
      list[pi].subQuestions = [...(list[pi].subQuestions ?? []), makeBlankSubQuestion()];
    });
  };

  /** Appends a main question part, whichever key holds them. */
  const addEditedSubQuestion = (qi: number) => {
    updateEditedQuestion(qi, (question) => {
      if (Array.isArray(question.questiontext) && !Array.isArray(question.questionText)) {
        question.questiontext.push(makeBlankSubQuestion());
      } else {
        question.questionText = [...(question.questionText ?? []), makeBlankSubQuestion()];
      }
    });
  };

  const handleSaveQuestions = async () => {
    setSavingPreview(true);
    try {
      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
      const orgcode = org ? org.organizationcode : (sessionStorage.getItem('orgCode') || 'ICME01');

      // Same contract the import flow posts, but the rubric is carried through
      // rather than stripped - it is on screen and editable here.
      const payload = {
        custcode: selectedCustomer || 'ICME',
        orgcode,
        subjectCode: previewSubjectCode,
        questions: editedQuestions.map((q: any) => ({
          questionLabel: String(q.questionLabel ?? q.questionlabel ?? ''),
          questionText: Array.isArray(q.questionText) ? q.questionText
            : Array.isArray(q.questiontext) ? q.questiontext : [],
          // Sent as the sum of the parts, matching the read-only total on screen.
          marks: sumQuestionMarks(q),
        })),
      };
      await axios.post(`${API_BASE1}/save-questions`, payload, {
        headers: { 'Content-Type': 'application/json', 'accept': '*/*' }
      });

      // Reopening should show what was just saved.
      setPreviewData(Array.isArray(previewData) ? editedQuestions : { ...(previewData as any), ref1Data: editedQuestions });
      setIsEditingPreview(false);
      toast.success('Questions saved successfully!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save questions. Please try again.');
    } finally {
      setSavingPreview(false);
    }
  };

  const handleOpenQuestionPreview = async (subjectCode: string) => {
    setPreviewSubjectCode(subjectCode);
    setPreviewDialogOpen(true);
    setPreviewLoading(true);
    setPreviewData(null);
    setIsEditingPreview(false);
    setEditedQuestions([]);
    try {
      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
      const orgCodeToSend = org ? org.organizationcode : '';

      const res = await axios.get(`${API_BASE1}/question-data`, {
        params: {
          OrgCode: orgCodeToSend,
          CustCode: 'ICME',
          SubjectCode: subjectCode
        },
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
      setPreviewData(res.data);
    } catch (e) {
      console.error('Failed to fetch question data', e);
      toast.error('Failed to load question preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmDeleteSubject = async () => {
    if (selectedRows.size === 0) return;

    // Check if user is superadmin before allowing deletion
    const userRole = sessionStorage.getItem('userRole') || '';
    const isSuperAdmin = userRole.toLowerCase() === 'superadmin';
    if (!isSuperAdmin) {
      toast.error('Only superadmin can delete subjects');
      setShowDeleteDialog(false);
      return;
    }

    const selectedSubjects = subjects.filter(s => selectedRows.has(s.subjectid));
    const blocked = selectedSubjects.filter(s => (s.workspacecount ?? 0) > 0);
    const deletable = selectedSubjects.filter(s => (s.workspacecount ?? 0) === 0);

    if (blocked.length > 0) {
      toast.error('Please unselect subjects with active workspaces before deleting.');
      setShowDeleteDialog(false);
      return;
    }

    if (deletable.length === 0) {
      toast.error('No valid subjects selected for deletion');
      setShowDeleteDialog(false);
      return;
    }

    setDeletingSubjects(true);
    try {
      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
      const orgCodeToSend = org ? org.organizationcode : '';

      const failed: { subjectCode: string; message: string }[] = [];
      for (const sub of deletable) {
        const payload = {
          subjectCode: sub.subjectcode,
          orgCode: orgCodeToSend,
          yearCode,
          cycleCode,
        };
        const res = await axios.post(`${API_BASE1}/delete-subject`, payload);
        if (res?.data?.status !== 'S001') {
          failed.push({ subjectCode: sub.subjectcode, message: res?.data?.message || 'Failed to delete' });
          console.warn(`Failed to delete subject ${sub.subjectcode}: ${res?.data?.message}`);
        }
      }

      const succeededCount = deletable.length - failed.length;
      if (succeededCount > 0) {
        toast.success(
          failed.length > 0
            ? `${succeededCount} subject(s) deleted; ${failed.length} failed`
            : 'Subject(s) deleted successfully'
        );
      }
      if (failed.length > 0) {
        toast.error(
          failed.length === 1
            ? `Failed to delete ${failed[0].subjectCode}: ${failed[0].message}`
            : `Failed to delete ${failed.length} subject(s): ${failed.map(f => f.subjectCode).join(', ')}`
        );
      }
      setSelectedRows(new Set());
      await fetchSubjects();
    } catch (e) {
      console.error('Failed to delete subjects', e);
      toast.error('Deletion failed. Please try again.');
    } finally {
      setDeletingSubjects(false);
      setShowDeleteDialog(false);
    }
  };

  /**
   * Reads the org's saved workflow configuration to find out whether the
   * Evaluation stage is part of the pipeline.
   *
   * Activation only needs an MD/guideline file when Evaluation runs, so this is
   * checked on every activation rather than cached - a change made in Config
   * Settings then takes effect without a reload.
   *
   * Only an explicit `false` relaxes the requirement: an unreachable or
   * unreadable config keeps the stricter existing behaviour rather than letting
   * subjects go active on the back of a failed request.
   */
  const isEvaluationStageEnabled = async (): Promise<boolean> => {
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    const orgCodeToSend = org ? org.organizationcode : '';
    try {
      const res = await axios.get(`${API_BASE1}/get-config-info`, {
        params: { OrgCode: orgCodeToSend, CustCode: selectedCustomer, AppCode: 'AImarking' },
      });
      const data = res.data;
      // The endpoint answers as an array of records, but tolerate a bare object.
      const config = Array.isArray(data) ? data[0]?.configSetting : (data?.configSetting ?? data);
      return config?.workflowStages?.evaluation !== false;
    } catch (e) {
      console.error('Failed to read workflow configuration', e);
      return true;
    }
  };

  const handleToggleStatus = async () => {
    if (!statusToggleSubject) return;
    setTogglingStatus(true);
    try {
      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
      const orgCodeToSend = org ? org.organizationcode : '';

      const payload = {
        subjectCode: statusToggleSubject.code,
        isActive: statusToggleSubject.newStatus,
        orgCode: orgCodeToSend
      };
      await axios.post(`${API_BASE1}/update-subject-data`, payload);
      toast.success('Subject status updated successfully');
      await fetchSubjects();
    } catch (e) {
      console.error('Failed to update status', e);
      toast.error('Failed to update subject status');
    } finally {
      setTogglingStatus(false);
      setStatusToggleSubject(null);
    }
  };

  /**
   * Applies Active / Inactive to every checked row.
   *
   * update-subject-data takes one subject per call, so the rows are posted in
   * turn and the outcome reported together. The same rules the single-row toggle
   * enforces apply here: a subject with workspaces can never be deactivated (it
   * cannot be checked at all), and activation needs a guideline file whenever
   * Evaluation is part of the workflow.
   */
  const handleBulkStatusUpdate = async () => {
    const target = bulkStatusTarget;
    if (target === null) return;
    const rows = target === 1 ? selectedInactiveRows : selectedActiveRows;
    if (rows.length === 0) {
      setBulkStatusTarget(null);
      return;
    }

    setBulkStatusSaving(true);
    try {
      let eligible = rows;
      let notReady: typeof rows = [];
      if (target === 1) {
        const evaluationEnabled = await isEvaluationStageEnabled();
        if (evaluationEnabled) {
          notReady = rows.filter(s => !(s.guidelinepath ?? '').toString().trim());
          eligible = rows.filter(s => (s.guidelinepath ?? '').toString().trim());
        }
      }

      if (eligible.length === 0) {
        toast.error(`No selected subject is ready to be active${notReady.length ? ' - a marking scheme is required first.' : '.'}`);
        return;
      }

      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
      const orgCodeToSend = org ? org.organizationcode : '';
      const failed: string[] = [];

      for (const subject of eligible) {
        try {
          await axios.post(`${API_BASE1}/update-subject-data`, {
            subjectCode: subject.subjectcode,
            isActive: target,
            orgCode: orgCodeToSend,
          });
        } catch (e) {
          console.error(`Failed to update status for ${subject.subjectcode}`, e);
          failed.push(subject.subjectcode);
        }
      }

      const succeeded = eligible.length - failed.length;
      const label = target === 1 ? 'active' : 'inactive';
      if (succeeded > 0) {
        toast.success(`${succeeded} subject(s) marked ${label}`);
      }
      if (failed.length > 0) {
        toast.error(`Could not update ${failed.length} subject(s): ${failed.join(', ')}`);
      }
      if (notReady.length > 0) {
        toast.error(`Skipped ${notReady.length} subject(s) with no marking scheme: ${notReady.map(s => s.subjectcode).join(', ')}`);
      }

      setSelectedRows(new Set());
      await fetchSubjects();
    } catch (e) {
      console.error('Bulk status update failed', e);
      toast.error('Failed to update subject status');
    } finally {
      setBulkStatusSaving(false);
      setBulkStatusTarget(null);
    }
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {loadingOrgs && <PageLoader />}
      {/* â”€â”€ Full-page loader overlay â”€â”€ */}
      {(importing || deletingSubjects) && (
        <UploadingOverlay text={deletingSubjects ? 'Deleting subject(s), please wait…' : 'Uploading file, please wait…'} />
      )}
      {/* â”€â”€ ROW 1: Three action buttons â”€â”€ */}
      {/* ─── ROW 1: Action Buttons & Dropdowns ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Import File — opens dialog */}
          <button
            onClick={() => { resetImportDialog(); setImportDialogOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:border-[#2563eb] hover:text-[#2563eb] hover:bg-blue-50 transition-all shadow-sm"
          >
            <Upload className="w-4 h-4" />
            Import Subject File
          </button>

          {/* Upload Marking Schema — opens the marking scheme flow in a dialog */}
          <button
            onClick={() => setShowMarkingSchemeDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:border-[#2563eb] hover:text-[#2563eb] hover:bg-blue-50 transition-all shadow-sm"
          >
            <Award className="w-4 h-4" />
            Upload Marking Schema
          </button>

          {/* JSON Creator — hidden for now */}
          {/* <button
            onClick={() => setJsonDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:border-[#2563eb] hover:text-[#2563eb] hover:bg-blue-50 transition-all shadow-sm"
          >
            <Database className="w-4 h-4" />
            Question JSON Creator
          </button> */}
        </div>

        <div className="flex items-center gap-4">
          {/* Dropdowns — hidden for admin */}
          {!isAdmin && (
            <>
              <div className="flex flex-col w-48">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Select Customer</label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]/30 cursor-pointer text-gray-700 font-medium"
                >
                  <option value="ICME">ICME</option>
                </select>
              </div>
              <div className="flex flex-col w-48">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Select Organization</label>
                <select
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                  disabled={loadingOrgs}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]/30 cursor-pointer text-gray-700 font-medium disabled:opacity-60"
                >
                  {loadingOrgs ? (
                    <option value="">Loading...</option>
                  ) : organizations.length > 0 ? (
                    organizations.map(org => (
                      <option key={org.organizationid} value={org.organizationid}>
                        {org.organizationname}
                      </option>
                    ))
                  ) : (
                    <option value="">No Organizations Found</option>
                  )}
                </select>
              </div>
            </>
          )}
          {yearCycleSelector}
        </div>
      </div>

      {/* ─── ROW 2: Search bar ─── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by subject name or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 transition-all placeholder:text-gray-400"
          />
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {loadingSubjects ? 'Loading...' : `${filtered.length} subject(s)`}
        </span>

        {/* Bulk Active / Inactive for the checked rows, beside Delete. */}
        <div className="ml-auto flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectedInactiveRows.length === 0 || bulkStatusSaving}
                    onClick={() => setBulkStatusTarget(1)}
                    className="h-9 px-4 gap-2 text-teal-700 border-teal-100 bg-teal-50 hover:bg-teal-100 hover:border-teal-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Active ({selectedInactiveRows.length})</span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-gray-900 text-white border-none text-[10px]">
                {selectedInactiveRows.length === 0
                  ? 'Select inactive subjects to activate'
                  : `Mark ${selectedInactiveRows.length} selected subject(s) active`}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectedActiveRows.length === 0 || bulkStatusSaving}
                    onClick={() => setBulkStatusTarget(0)}
                    className="h-9 px-4 gap-2 text-gray-600 border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <X className="w-4 h-4" />
                    <span>Inactive ({selectedActiveRows.length})</span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-gray-900 text-white border-none text-[10px]">
                {selectedActiveRows.length === 0
                  ? 'Select active subjects to deactivate'
                  : `Mark ${selectedActiveRows.length} selected subject(s) inactive`}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectedDeletableCount === 0 || deletingSubjects}
                    onClick={() => setShowDeleteDialog(true)}
                    className="h-9 px-4 gap-2 text-red-600 border-red-100 bg-red-50 hover:bg-red-100 hover:border-red-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete ({selectedDeletableCount})</span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-gray-900 text-white border-none text-[10px]">
                {selectedDeletableCount === 0 ? "Select inactive subjects to delete" : `Delete ${selectedDeletableCount} selected subjects`}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* â”€â”€ Subject Table â”€â”€ */}
      <div className="flex flex-col flex-1 overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex-1 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="w-10 px-3 py-3 border-b border-gray-200">
                  <input
                    type="checkbox"
                    checked={selectableFiltered.length > 0 && selectedDeletableCount === selectableFiltered.length}
                    onChange={toggleAll}
                    disabled={selectableFiltered.length === 0}
                    className="w-4 h-4 rounded border-gray-300 text-[#2563eb] accent-[#2563eb] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">SL.NO</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">SUBJECT CODE</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">SUBJECT NAME</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">GUIDELINE PATH</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">WORKSPACES</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Q-Preview</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loadingSubjects ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-3 py-3 border-b border-gray-100">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: j === 3 ? '140px' : j === 0 ? '16px' : '80px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400 font-medium">No subjects found</p>
                    <p className="text-xs text-gray-300">Try a different search term</p>
                  </td>
                </tr>
              ) : (
                filtered.map((s, i) => (
                  <tr
                    key={s.subjectid}
                    className={`transition-colors cursor-pointer ${selectedRows.has(s.subjectid)
                      ? 'bg-blue-50'
                      : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100/60'
                      }`}
                    onClick={() => toggleRow(s.subjectid)}
                  >
                    <td className="px-3 py-3 border-b border-gray-100" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedRows.has(s.subjectid)}
                        onChange={() => toggleRow(s.subjectid)}
                        disabled={(s.workspacecount ?? 0) > 0}
                        className="w-4 h-4 rounded border-gray-300 text-[#2563eb] accent-[#2563eb] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title={(s.workspacecount ?? 0) > 0 ? 'Cannot select subject with active workspaces' : ''}
                      />
                    </td>
                    <td className="px-3 py-3 border-b border-gray-100 text-xs text-gray-400 font-mono">{i + 1}</td>
                    <td className="px-3 py-3 border-b border-gray-100">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-[#2563eb] text-xs font-semibold border border-blue-100">
                        {s.subjectcode}
                      </span>
                    </td>
                    <td className="px-3 py-3 border-b border-gray-100 text-sm font-medium text-gray-800 whitespace-nowrap">{s.subjectname || '—'}</td>

                    <td className="px-3 py-3 border-b border-gray-100">
                      {s.guidelinepath ? (
                        // Opens the scheme for preview and editing; the row's own
                        // click selects the subject, so it must not also fire.
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewScheme({
                              subjectCode: s.subjectcode,
                              subjectName: s.subjectname,
                              guidelinepath: String(s.guidelinepath),
                            });
                          }}
                          title={`${s.guidelinepath} - click to preview and edit`}
                          className="inline-flex items-center gap-1 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded px-2 py-0.5 max-w-[180px] hover:bg-teal-100 hover:border-teal-400 hover:underline transition-colors cursor-pointer"
                        >
                          <Award className="w-3 h-3 shrink-0" />
                          {/* truncate belongs on the text itself; on the flex row the name is
                              cut off with no trailing ellipsis. */}
                          <span className="truncate min-w-0">{String(s.guidelinepath).split(/[\\/]/).pop()}</span>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    <td className="px-3 py-3 border-b border-gray-100 text-center">
                      <span className="text-gray-900 font-bold text-xs uppercase tracking-tighter">{s.workspacecount ?? 0}</span>
                    </td>

                    <td className="px-3 py-3 border-b border-gray-100 text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenQuestionPreview(s.subjectcode); }}
                              className="w-7 h-7 inline-flex items-center justify-center rounded-lg hover:bg-blue-50 text-[#2563eb] transition-all cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-gray-900 text-white border-none text-[10px]">Question Preview</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>

                    <td className="px-3 py-3 border-b border-gray-100">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const newStatus = Number(s.status ?? 0) === 1 ? 0 : 1;
                          const guidelinepath = (s.guidelinepath ?? '').toString().trim();
                          const workspaceCount = Number(s.workspacecount ?? 0);

                          // Deactivation is unchanged.
                          if (newStatus === 0) {
                            if (workspaceCount > 0) {
                              toast.error('Cannot mark inactive. Subject has active workspaces.');
                              return;
                            }
                            setStatusToggleSubject({
                              code: s.subjectcode,
                              name: s.subjectname,
                              newStatus
                            });
                            return;
                          }

                          // Activating: ask the workflow configuration first, because the
                          // MD/guideline file is only mandatory when Evaluation is enabled.
                          if (checkingActivationConfig) return;
                          setCheckingActivationConfig(s.subjectcode);
                          let evaluationEnabled = true;
                          try {
                            evaluationEnabled = await isEvaluationStageEnabled();
                          } finally {
                            setCheckingActivationConfig(null);
                          }

                          if (evaluationEnabled && !guidelinepath) {
                            toast.error('This subject is not ready to be active.');
                            return;
                          }

                          setStatusToggleSubject({
                            code: s.subjectcode,
                            name: s.subjectname,
                            newStatus
                          });
                        }}
                        disabled={checkingActivationConfig === s.subjectcode}
                        className="cursor-pointer hover:opacity-80 transition-opacity focus:outline-none disabled:opacity-60 disabled:cursor-wait"
                        title={`Click to mark as ${Number(s.status ?? 0) === 1 ? 'Inactive' : 'Active'}`}
                      >
                        {Number(s.status ?? 0) === 1 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-600 border border-teal-100">Active</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-400 border border-blue-100">Inactive</span>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        {!loadingSubjects && filtered.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {selectedDeletableCount > 0 ? `${selectedDeletableCount} row(s) selected` : `${filtered.length} total subjects`}
            </span>
          </div>
        )}
      </div>

      {/* Status Toggle Confirmation Dialog */}
      {statusToggleSubject && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-base font-bold text-gray-900">Confirm Status Change</h3>
              <button onClick={() => setStatusToggleSubject(null)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-400 transition-colors cursor-pointer focus:outline-none">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to mark <strong>{statusToggleSubject.name}</strong> as <strong>{statusToggleSubject.newStatus === 1 ? 'Active' : 'Inactive'}</strong>?
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setStatusToggleSubject(null)} className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer focus:outline-none">Cancel</button>
                <button
                  disabled={togglingStatus}
                  onClick={handleToggleStatus}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-[#2563eb] to-blue-500 hover:from-blue-600 hover:to-blue-700 text-white shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                >
                  {togglingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Marking scheme upload, hosted here now that it has no page of its own.
          Mounted only while open so its subject fetch runs fresh each time. */}
      <Dialog open={showMarkingSchemeDialog} onOpenChange={setShowMarkingSchemeDialog}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          className="flex flex-col overflow-hidden p-0 rounded-xl shadow-xl border border-gray-200"
          style={{
            maxWidth: '720px', width: 'calc(100vw - 32px)',
            height: 'auto', maxHeight: 'calc(100vh - 64px)',
          }}
        >
          {/* Same shell as the redesigned Import Subject modal, so the two read
              as one family. */}
          <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-[10px] bg-blue-50 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5 text-[#2563eb]" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[18px] font-semibold text-gray-900 leading-tight">Upload marking scheme</DialogTitle>
                <DialogDescription className="text-[13px] text-gray-500 mt-0.5">
                  Choose the subject, then upload the scheme as PDF, Word or Markdown.
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={() => setShowMarkingSchemeDialog(false)}
              aria-label="Close"
              title="Close"
              className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto px-6 py-6">
            {showMarkingSchemeDialog && (
              <MarksSchemaSection
                variant="upload"
                orgId={selectedOrg}
                API_BASE={API_BASE}
                API_BASE1={API_BASE1}
                yearCode={yearCode}
                cycleCode={cycleCode}
                yearCycleSelector={null}
                onUploaded={() => {
                  setShowMarkingSchemeDialog(false);
                  // The subject table shows the guideline path, so it is stale now.
                  void fetchSubjects();
                }}
              />
            )}
          </div>

          {/* Footer: Cancel only. The actual upload is submitted from inside the
              nested "Upload Marking Scheme" method-choice dialog (Choose -> Process
              -> Preview, opened by the "Upload Marking Scheme" card below) or, in
              folder mode, fires as soon as a folder is picked - neither is a single
              top-level submit this shell can wire a primary button to without
              changing that flow, which is out of scope for a UI-only pass. Flagging
              rather than adding a button with no handler to call. */}
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end shrink-0 bg-white">
            <button
              onClick={() => setShowMarkingSchemeDialog(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Marking scheme preview / editor, opened from the Guideline Path column. */}
      <MarkingSchemePreviewDialog
        card={previewScheme}
        orgCode={organizations.find(o => String(o.organizationid) === selectedOrg)?.organizationcode || ''}
        onClose={() => setPreviewScheme(null)}
        onSaved={() => { void fetchSubjects(); }}
      />

      {/* Bulk Status Confirmation Dialog */}
      {bulkStatusTarget !== null && (() => {
        const rows = bulkStatusTarget === 1 ? selectedInactiveRows : selectedActiveRows;
        const label = bulkStatusTarget === 1 ? 'Active' : 'Inactive';
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden border border-gray-100">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-base font-bold text-gray-900">Confirm Status Change</h3>
                <button
                  onClick={() => setBulkStatusTarget(null)}
                  disabled={bulkStatusSaving}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-400 transition-colors cursor-pointer focus:outline-none disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-600 mb-3">
                  Mark <strong>{rows.length}</strong> selected subject{rows.length === 1 ? '' : 's'} as <strong>{label}</strong>?
                </p>
                <div className="max-h-40 overflow-auto rounded-lg border border-gray-100 bg-gray-50 p-2 mb-4">
                  <ul className="space-y-1 text-xs text-gray-700">
                    {rows.map(s => (
                      <li key={s.subjectid} className="truncate">
                        <span className="font-mono text-[#2563eb]">{s.subjectcode}</span> - {s.subjectname || '-'}
                      </li>
                    ))}
                  </ul>
                </div>
                {bulkStatusTarget === 1 && (
                  <p className="text-xs text-gray-500 mb-4">
                    Subjects without a marking scheme are skipped when Evaluation is part of the workflow.
                  </p>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setBulkStatusTarget(null)}
                    disabled={bulkStatusSaving}
                    className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer focus:outline-none disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={bulkStatusSaving}
                    onClick={handleBulkStatusUpdate}
                    className="px-4 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-[#2563eb] to-blue-500 hover:from-blue-600 hover:to-blue-700 text-white shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                  >
                    {bulkStatusSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (() => {
        const toDelete = filtered.filter(s => selectedRows.has(s.subjectid));
        const blocked = toDelete.filter(s => (s.workspacecount ?? 0) > 0);
        const deletable = toDelete.filter(s => (s.workspacecount ?? 0) === 0);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-600" /></div>
                  <div><h3 className="text-base font-bold text-gray-900">Delete Subject{toDelete.length > 1 ? 's' : ''}</h3><p className="text-xs text-gray-500">{toDelete.length} selected</p></div>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => setShowDeleteDialog(false)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-gray-900 text-white border-none text-[10px]">
                      Close
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {blocked.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-700">  Cannot delete - Please unselect subjects with active workspaces present:</p>
                  {blocked.map(s => (<div key={s.subjectid} className="flex items-center justify-between text-xs text-amber-700 bg-amber-100 rounded px-2 py-1"><span className="font-medium">{s.subjectname}</span><span>{s.workspacecount} workspace{(s.workspacecount ?? 0) > 1 ? 's' : ''}</span></div>))}
                </div>
              )}
              {deletable.length > 0 && blocked.length === 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-red-700">The following will be permanently deleted:</p>
                  {deletable.map(s => (<div key={s.subjectid} className="text-xs text-red-700 bg-red-100 rounded px-2 py-1 font-medium">{s.subjectname} ({s.subjectcode})</div>))}
                </div>
              )}
              {deletable.length === 0 && blocked.length === 0 && <p className="text-sm text-gray-500 text-center py-2">No subjects can be deleted from the current selection.</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowDeleteDialog(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer">Cancel</button>
                {deletable.length > 0 && blocked.length === 0 && (
                  <button
                    disabled={deletingSubjects}
                    onClick={handleConfirmDeleteSubject}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                  >
                    {deletingSubjects && <Loader2 className="w-4 h-4 animate-spin" />}
                    {deletingSubjects ? 'Deleting...' : `Delete ${deletable.length} Subject${deletable.length > 1 ? 's' : ''}`}
                  </button>
                )}

              </div>
            </div>
          </div>
        );
      })()}

      {/* â”€â”€ Question Preview Dialog (Evaluation Rubric Design) â”€â”€ */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          className="flex flex-col p-0 overflow-hidden border-none bg-[#f8fafc]"
          style={{
            maxWidth: '900px', width: '96vw',
            maxHeight: '85vh',
            borderRadius: '24px',
            boxShadow: '0 40px 100px -20px rgba(0,0,0,0.3)',
          }}
        >
          {/* Header Area */}
          <div className="px-8 pt-8 pb-6 bg-white shrink-0 relative">
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full border-2 border-teal-500/20 flex items-center justify-center bg-teal-50/30">
                  <div className="w-6 h-6 rounded-full border-2 border-teal-500 flex items-center justify-center text-teal-600 font-serif font-black italic text-xs">i</div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#1e293b] tracking-tight">Question(s) & Rubric(s)</h2>
                  <p className="text-sm text-gray-500 mt-1 font-medium">
                    {isEditingPreview ? 'Edit the question text, marks and rubric, then save.' : 'Rubric breakdown for the question.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mr-12">
                {!previewLoading && readPreviewQuestions(previewData).length > 0 && !isEditingPreview && (
                  <button
                    onClick={() => {
                      // Deep copy, so edits never touch what the API returned.
                      setEditedQuestions(JSON.parse(JSON.stringify(readPreviewQuestions(previewData))));
                      setIsEditingPreview(true);
                    }}
                    className="h-9 px-4 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:border-teal-500 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
                {isEditingPreview && (
                  <>
                    <button
                      onClick={() => { setIsEditingPreview(false); setEditedQuestions([]); }}
                      disabled={savingPreview}
                      className="h-9 px-4 inline-flex items-center rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveQuestions}
                      disabled={savingPreview}
                      className="h-9 px-4 inline-flex items-center gap-1.5 rounded-xl bg-teal-600 text-xs font-bold text-white hover:bg-teal-700 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {savingPreview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {savingPreview ? 'Saving...' : 'Save'}
                    </button>
                  </>
                )}
              </div>
              {/* {previewData && (
                <div className="px-3 py-1 rounded-full bg-teal-50 border border-teal-100 text-[11px] font-bold text-teal-600 flex items-center gap-1.5 shadow-sm">
                  {(() => {
                    const data = (previewData as any)?.ref1Data || (Array.isArray(previewData) ? previewData : [previewData]);
                    const marks = data.reduce((sum: number, q: any) => sum + (Number(q.totalMarks ?? q.marks ?? 0)), 0);
                    const label = data[0]?.questionLabel || data[0]?.label || '1';
                    return `Q${label} Â· ${marks} marks`;
                  })()}
                </div>
              )} */}
            </div>

            <button
              onClick={() => setPreviewDialogOpen(false)}
              title="Close"
              className="absolute top-6 right-6 w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all border border-transparent cursor-pointer group"
            >
              <X className="w-4 h-4" />
              <span className="absolute -bottom-7 right-0 bg-gray-800 text-white text-xs rounded px-2 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">Close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6 mt-4">
            {previewLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
                <p className="text-xs font-bold text-teal-600 uppercase tracking-widest animate-pulse">Loading Rubric...</p>
              </div>
            ) : !previewData ? (
              <div className="text-center py-16 text-gray-400 text-sm">No data available.</div>
            ) : (() => {
              // While editing, the working copy is what's on screen.
              const arr: any[] = isEditingPreview ? editedQuestions : readPreviewQuestions(previewData);

              if (arr.length === 0) return <div className="text-center py-16 text-gray-400 text-sm">No questions found.</div>;

              return arr.map((q: any, qi: number) => {
                const qLabel = q.questionLabel ?? q.questionlabel ?? String(qi + 1);
                const qMarks = Number(q.marks ?? q.totalMarks ?? 0);
                const parts: any[] = Array.isArray(q.questionText) ? q.questionText
                  : Array.isArray(q.questiontext) ? q.questiontext : [];

                return (
                  <div key={qi} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Question Header */}
                    <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-teal-50 to-white border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-teal-500 text-white text-xs font-bold flex items-center justify-center">{qLabel}</span>
                        <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Question {qLabel}</span>
                      </div>
                      {isEditingPreview ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => addEditedSubQuestion(qi)}
                            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white text-[11px] font-bold text-teal-700 hover:bg-teal-50 hover:border-teal-400 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Main question
                          </button>
                          {/* Read-only: it is the sum of the marks entered against the
                              parts and sub-questions below. */}
                          <span
                            title="Total of the marks entered below"
                            className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-3 py-0.5 whitespace-nowrap"
                          >
                            {sumQuestionMarks(q)} marks
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-teal-600 bg-teal-50 border border-teal-200 rounded-full px-3 py-0.5">{qMarks} marks</span>
                      )}
                    </div>

                    <div className="p-5 space-y-4">
                      {parts.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">No question parts available</div>
                      ) : (
                        parts.map((part: any, pi: number) => {
                          const partText = String(part.text ?? '');
                          const partMarks = part.marks != null ? Number(part.marks) : null;
                          const rubric: any[] = Array.isArray(part.rubric) ? part.rubric : [];
                          const hasMarks = partMarks != null;

                          return (
                            <div key={pi} className={hasMarks ? 'border border-gray-100 rounded-xl overflow-hidden' : ''}>
                              {/* Part text */}
                              <div className={`flex items-start justify-between gap-2 ${hasMarks ? 'px-4 py-3 bg-gray-50 border-b border-gray-100' : 'pb-2'}`}>
                                {isEditingPreview ? (
                                  <textarea
                                    value={partText}
                                    rows={Math.min(6, Math.max(2, partText.split('\n').length))}
                                    onChange={(e) => updateEditedQuestion(qi, (question) => {
                                      const list = question.questionText ?? question.questiontext;
                                      if (Array.isArray(list)) list[pi].text = e.target.value;
                                    })}
                                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400/30 resize-y"
                                  />
                                ) : (
                                  <p className={`text-sm whitespace-pre-wrap ${hasMarks ? 'font-semibold text-gray-800' : 'text-gray-500 italic'}`}>{partText}</p>
                                )}
                                {hasMarks && (
                                  isEditingPreview ? (
                                    <label className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-blue-600">
                                      <input
                                        type="number"
                                        min={0}
                                        value={partMarks ?? 0}
                                        onChange={(e) => updateEditedQuestion(qi, (question) => {
                                          const list = question.questionText ?? question.questiontext;
                                          if (Array.isArray(list)) list[pi].marks = Number(e.target.value) || 0;
                                        })}
                                        className="w-20 px-2 py-1 rounded-lg border border-blue-200 bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                                      />
                                      marks
                                    </label>
                                  ) : (
                                    <span className="shrink-0 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 whitespace-nowrap">{partMarks} marks</span>
                                  )
                                )}
                              </div>

                              {/* Rubric items */}
                              {rubric.length > 0 && (
                                <div className="divide-y divide-gray-50">
                                  {rubric.map((r: any, ri: number) => (
                                    <div key={ri} className="flex items-start justify-between gap-3 px-4 py-2.5 hover:bg-gray-50/50 transition-colors">
                                      <div className="flex items-start gap-2 min-w-0 flex-1">
                                        <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{ri + 1}</span>
                                        {isEditingPreview ? (
                                          <textarea
                                            value={String(r.text ?? '')}
                                            rows={Math.min(5, Math.max(2, String(r.text ?? '').split('\n').length))}
                                            onChange={(e) => updateEditedQuestion(qi, (question) => {
                                              const list = question.questionText ?? question.questiontext;
                                              if (Array.isArray(list) && Array.isArray(list[pi]?.rubric)) list[pi].rubric[ri].text = e.target.value;
                                            })}
                                            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400/30 resize-y"
                                          />
                                        ) : (
                                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{String(r.text ?? '')}</p>
                                        )}
                                      </div>
                                      {isEditingPreview ? (
                                        <label className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                                          <input
                                            type="number"
                                            min={0}
                                            value={Number(r.score ?? 0)}
                                            onChange={(e) => updateEditedQuestion(qi, (question) => {
                                              const list = question.questionText ?? question.questiontext;
                                              if (Array.isArray(list) && Array.isArray(list[pi]?.rubric)) list[pi].rubric[ri].score = Number(e.target.value) || 0;
                                            })}
                                            className="w-20 px-2 py-1 rounded-lg border border-emerald-200 bg-white text-right focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                                          />
                                          marks
                                        </label>
                                      ) : (
                                        <span className="shrink-0 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 whitespace-nowrap">{Number(r.score ?? 0)} mark{Number(r.score ?? 0) !== 1 ? 's' : ''}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Sub-questions of this main question: Q1's stem
                                  followed by its a. / b. parts. */}
                              {(() => {
                                const subs: any[] = Array.isArray(part.subQuestions) ? part.subQuestions : [];
                                if (subs.length === 0 && !isEditingPreview) return null;
                                return (
                                  <div className={`${hasMarks ? 'px-4 pb-3 pt-1' : 'pt-1 pb-2'} space-y-2`}>
                                    {subs.map((sq: any, si: number) => (
                                      <div key={si} className="flex items-start gap-2 pl-3 border-l-2 border-teal-100">
                                        <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-1.5">
                                          {subQuestionLabel(si)}
                                        </span>
                                        {isEditingPreview ? (
                                          <>
                                            <textarea
                                              value={String(sq.text ?? '')}
                                              rows={Math.min(5, Math.max(1, String(sq.text ?? '').split('\n').length))}
                                              onChange={(e) => updateEditedQuestion(qi, (question) => {
                                                const list = question.questionText ?? question.questiontext;
                                                if (Array.isArray(list) && Array.isArray(list[pi]?.subQuestions)) list[pi].subQuestions[si].text = e.target.value;
                                              })}
                                              placeholder={`Sub-question ${subQuestionLabel(si)}`}
                                              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400/30 resize-y"
                                            />
                                            <label className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-blue-600">
                                              <input
                                                type="number"
                                                min={0}
                                                value={Number(sq.marks ?? 0)}
                                                onChange={(e) => updateEditedQuestion(qi, (question) => {
                                                  const list = question.questionText ?? question.questiontext;
                                                  if (Array.isArray(list) && Array.isArray(list[pi]?.subQuestions)) list[pi].subQuestions[si].marks = Number(e.target.value) || 0;
                                                })}
                                                className="w-20 px-2 py-1 rounded-lg border border-blue-200 bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                                              />
                                              marks
                                            </label>
                                          </>
                                        ) : (
                                          <>
                                            <p className="flex-1 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{String(sq.text ?? '')}</p>
                                            {sq.marks != null && (
                                              <span className="shrink-0 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 whitespace-nowrap">{Number(sq.marks)} marks</span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    ))}
                                    {isEditingPreview && (
                                      <button
                                        onClick={() => addEditedNestedSubQuestion(qi, pi)}
                                        className="ml-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-teal-700 transition-colors"
                                      >
                                        <Plus className="w-3 h-3" />
                                        Add sub-question ({subQuestionLabel(subs.length)})
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              });
            })()}

            {/* Adding a whole question sits under the list, where the next one
                would appear. */}
            {isEditingPreview && !previewLoading && (
              <button
                onClick={addEditedQuestion}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-teal-200 text-sm font-bold text-teal-700 hover:border-teal-400 hover:bg-teal-50/50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Question
              </button>
            )}
          </div>

          <div className="px-8 py-5 bg-white border-t border-gray-50 flex justify-end shrink-0">
            <Button
              variant="outline"
              disabled={savingPreview}
              className="h-11 rounded-xl px-10 font-bold text-gray-800 hover:text-gray-900 border-gray-200 bg-gray-50/50 hover:bg-gray-100/80 transition-all shadow-sm"
              onClick={() => {
                // Closing mid-edit would drop the changes without a word.
                if (isEditingPreview && !window.confirm('Close without saving your question changes?')) return;
                setIsEditingPreview(false);
                setEditedQuestions([]);
                setPreviewDialogOpen(false);
              }}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* â”€â”€ Import File Dialog â”€â”€
          UI-only redesign: container size/radius/shadow, header, section
          headings, select/dropzone/table styling and the footer are all
          restyled. No API call, handler, prop, field id or the CSV parsing
          flow changed - every onClick/onChange below still calls exactly the
          function it called before.
          Not done: a drag-over dropzone state and a file-level error state,
          since neither exists in the current data/handlers (there is no
          onDragOver/onDrop wiring or import-error state to style against),
          and adding either would be new behavior rather than a restyle. Flagging
          rather than inventing fake state - say if you want those added. */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!open) resetImportDialog(); setImportDialogOpen(open); }}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          className="flex flex-col overflow-hidden p-0 rounded-xl shadow-xl border border-gray-200"
          style={{
            maxWidth: '720px', width: 'calc(100vw - 32px)',
            height: 'auto', maxHeight: 'calc(100vh - 64px)',
          }}
        >
          {/* Header - sticky, no gradient, bottom border only. */}
          <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-[10px] bg-blue-50 flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5 text-[#2563eb]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[18px] font-semibold text-gray-900 leading-tight">Import Subjects</h2>
                <p className="text-[13px] text-gray-500 mt-0.5">Choose where to import, then upload a CSV using the template.</p>
              </div>
            </div>
            <button
              onClick={() => { resetImportDialog(); setImportDialogOpen(false); }}
              aria-label="Close"
              title="Close"
              className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body - the only scrolling region. */}
          <div className="flex flex-col overflow-y-auto px-6 py-6 gap-6">
            {/* Category selection removed - Subject is the only import type
                offered (Question import is disabled above), so choosing
                between them no longer applies. importTab stays fixed at
                'subject' and everything that reads it is unaffected. */}

            {/* â”€â”€ Section A: Import destination â”€â”€ */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Import destination</h3>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">Pick the customer, organization, year and cycle this file imports into.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Customer</label>
                  <div className="relative">
                    <select
                      value={selectedCustomer}
                      onChange={(e) => setSelectedCustomer(e.target.value)}
                      className="w-full px-3 py-2.5 pr-9 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition-colors appearance-none cursor-pointer text-gray-700"
                    >
                      <option value="ICME">ICME</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Organization</label>
                  <div className="relative">
                    <select
                      value={selectedOrg}
                      onChange={(e) => setSelectedOrg(e.target.value)}
                      disabled={loadingOrgs}
                      className="w-full px-3 py-2.5 pr-9 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition-colors appearance-none cursor-pointer text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loadingOrgs ? (
                        <option value="">Loading Organizations...</option>
                      ) : organizations.length > 0 ? (
                        organizations.map(org => (
                          <option key={org.organizationid} value={org.organizationid}>
                            {org.organizationname}
                          </option>
                        ))
                      ) : (
                        <option value="">No Organizations Found</option>
                      )}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Year</label>
                  <div className="relative">
                    <select
                      value={importSelectedYearCode}
                      onChange={(e) => setImportSelectedYearCode(e.target.value)}
                      disabled={importYearsLoading || importYears.length === 0}
                      className="w-full px-3 py-2.5 pr-9 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition-colors appearance-none cursor-pointer text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {importYearsLoading ? (
                        <option value="">Loading Years...</option>
                      ) : importYears.length > 0 ? (
                        importYears.map(year => (
                          <option key={year.yearid || year.yearcode} value={year.yearcode}>{year.yearname}</option>
                        ))
                      ) : (
                        <option value="">No Years Found</option>
                      )}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Cycle</label>
                  <div className="relative">
                    <select
                      value={importSelectedCycleCode}
                      onChange={(e) => setImportSelectedCycleCode(e.target.value)}
                      disabled={importCyclesLoading || importCycles.length === 0}
                      className="w-full px-3 py-2.5 pr-9 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition-colors appearance-none cursor-pointer text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {importCyclesLoading ? (
                        <option value="">Loading Cycles...</option>
                      ) : importCycles.length > 0 ? (
                        importCycles.map(cycle => (
                          <option key={cycle.cycleid || cycle.cyclecode} value={cycle.cyclecode}>{cycle.cyclename}</option>
                        ))
                      ) : (
                        <option value="">No Cycles for this Year</option>
                      )}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* â”€â”€ Section B: Upload file â”€â”€ */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-1">
                <h3 className="text-sm font-semibold text-gray-800">Upload file</h3>
                <button
                  type="button"
                  onClick={downloadSubjectTemplate}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563eb] hover:text-blue-700 hover:underline transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Template
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">Only the subject-import CSV template is accepted.</p>
              <input ref={importFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFileChange} />
              <div
                onClick={() => importFileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  importFile ? 'border-[#2563eb] bg-blue-50/40' : 'border-gray-200 bg-gray-50/40 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {importFile ? (
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-lg bg-white border border-blue-100 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-5 h-5 text-[#2563eb]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{importFile.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{(importFile.size / 1024).toFixed(1)} KB · click to choose a different file</p>
                    </div>
                    {showPreview && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-[11px] font-medium border border-teal-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {importRows.length} rows
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="py-1">
                    <div className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center mx-auto">
                      <Upload className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-700 mt-2.5">Click to browse or drop your file here</p>
                    <p className="text-xs text-gray-400 mt-0.5">Accepts .csv templates only</p>
                  </div>
                )}
              </div>
            </div>

            {/* â”€â”€ Section C: Preview (shown automatically) â”€â”€ */}
            {showPreview && importRows.length > 0 && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800">Data preview</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{importHeaders.length} columns</span>
                    <span className="text-gray-300">·</span>
                    <span>{importRows.length} rows</span>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-auto max-h-56">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-500 border-b border-gray-200 w-10">#</th>
                          {importHeaders.map(h => (
                            <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-600 border-b border-gray-200 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importRows.map((row, ri) => (
                          <tr key={ri} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-2.5 text-gray-400 font-mono text-[11px]">{ri + 1}</td>
                            {importHeaders.map(h => (
                              <td key={h} className="px-4 py-2.5 text-gray-600 whitespace-nowrap max-w-[200px] truncate">
                                {row[h] !== undefined && row[h] !== null ? String(row[h]) : <span className="text-gray-300">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer - sticky, clear separation from the scrolling body. */}
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-4 shrink-0 bg-white">
            <button
              onClick={() => { resetImportDialog(); setImportDialogOpen(false); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              Cancel
            </button>
            {/* The disabled reason is spelled out in the tooltip rather than left
                for the user to guess - the condition itself is unchanged. */}
            <button
              onClick={handleImportSubmit}
              disabled={!importFile || importing || !importSelectedYearCode || !importSelectedCycleCode}
              title={
                !importFile ? 'Choose a CSV file to import'
                  : !importSelectedYearCode ? 'Select a Year'
                  : !importSelectedCycleCode ? 'Select a Cycle'
                  : undefined
              }
              className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-[#2563eb] text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{importing ? 'Importing...' : 'Import'}</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={jsonDialogOpen} onOpenChange={(open) => { setJsonDialogOpen(open); if (!open) resetJsonDialog(); }}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          className="flex flex-col overflow-hidden"
          style={{
            maxWidth: '1200px',
            width: '95vw',
            height: '90vh',
            maxHeight: '90vh',
            borderRadius: '16px',
            boxShadow: '0 25px 60px -10px rgba(0,0,0,0.25)',
            background: 'linear-gradient(to bottom, #ffffff, #f8faff)',
          }}
        >
          <DialogHeader className="border-b border-gray-100 pb-4 flex-shrink-0">
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-[#2563eb] to-blue-400 bg-clip-text text-transparent">
              Question JSON Creator
            </DialogTitle>
            <div className="flex items-center justify-between">
              <DialogDescription className="text-gray-500 text-sm">
                Add parent questions and sub-questions with marks & rubrics. Copy the generated JSON when done.
              </DialogDescription>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 shrink-0">
                Total Marks: <span className="text-blue-900">{totalMarks}</span>
              </div>
            </div>
            {/* Format Selection Buttons */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Format:</span>
              <button
                onClick={() => { setQuestionFormat('main-rubric'); setQuestions(getInitialQuestions()); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${questionFormat === 'main-rubric'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Main Question + Rubrics
              </button>
              <button
                onClick={() => { setQuestionFormat('main-sub-rubric'); setQuestions(getInitialQuestions()); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${questionFormat === 'main-sub-rubric'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Main + Sub-Questions + Rubrics
              </button>
              <button
                onClick={() => { setQuestionFormat('sub-only'); setQuestions(getInitialQuestions()); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${questionFormat === 'sub-only'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Sub-Questions Only
              </button>
            </div>
          </DialogHeader>

          <div className="flex flex-1 gap-4 overflow-hidden pt-4">
            {/* LEFT — question builder */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-blue-300 [&::-webkit-scrollbar-track]:bg-blue-50/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#2563eb]">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500"> Question(s)</span>

              </div>

              {questions.map((q, qi) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-blue-100 bg-white p-4 space-y-4 transition-all shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
                    <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">Question {qi + 1}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500"
                      title={qi === 0 ? "Clear Content" : "Delete Question"}
                      onClick={() => {
                        if (qi === 0 && questions.length === 1) {
                          setQuestions([{ id: makeId(), text: '', marks: 0, rubrics: [{ text: '', score: 0 }], subQuestions: [] }]);
                        } else if (qi === 0) {
                          updateQuestion(q.id, { text: '', marks: 0, rubrics: [{ text: '', score: 0 }], subQuestions: [] });
                        } else {
                          removeQuestion(q.id);
                        }
                      }}>
                      {qi === 0 ? <RotateCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                  </div>

                  {questionFormat !== 'sub-only' && (
                    <Textarea
                      placeholder="e.g. Expand on the following concepts..."
                      value={q.text}
                      onChange={e => updateQuestion(q.id, { text: e.target.value })}
                      style={{ minHeight: '56px', resize: 'none' }}
                      className="text-sm bg-gray-50"
                    />
                  )}

                  {questionFormat === 'main-rubric' && q.subQuestions.length === 0 && (
                    <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 space-y-3">
                      <div className="flex items-center gap-3">
                        <Label className="text-[10px] text-gray-500 font-semibold uppercase">Marks</Label>
                        <Input
                          type="number" value={q.marks} min={1} max={99} className="w-20 h-8 text-sm bg-white border-amber-200"
                          onBlur={e => {
                            const v = Math.min(99, Math.max(1, Number(e.target.value) || 1));
                            updateQuestion(q.id, { marks: v });
                          }}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === '') {
                              updateQuestion(q.id, { marks: '' as any });
                              return;
                            }
                            let v = parseInt(val, 10);
                            if (isNaN(v)) return;
                            if (v > 99) v = 99;
                            if (v < 0) v = 1; // Prevent negative but allow typing
                            updateQuestion(q.id, { marks: v });
                          }}
                        />
                      </div>

                      <div className="space-y-2 pt-2 border-t border-amber-200/50">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Main Question Rubrics</Label>
                          <Button variant="ghost" size="sm" className="h-5 text-[10px] text-amber-600 hover:bg-amber-100 px-1.5"
                            onClick={() => addMainRubric(q.id)}>
                            <Plus className="w-2.5 h-2.5 mr-0.5" />Add
                          </Button>
                        </div>
                        {q.rubrics.map((r, ri) => (
                          <div key={ri} className="flex gap-2 items-center">
                            <Input
                              placeholder="Rubric requirement..."
                              value={r.text}
                              className="flex-1 h-7 text-xs bg-white border-amber-200"
                              onChange={e => updateMainRubric(q.id, ri, { text: e.target.value })}
                            />
                            <Input
                              type="number" value={r.score} min={1} max={99}
                              className="w-16 h-7 text-xs bg-white border-amber-200 px-2"
                              onBlur={e => {
                                const v = Math.min(99, Math.max(1, Number(e.target.value) || 1));
                                updateMainRubric(q.id, ri, { score: v });
                              }}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '' || val === '0') {
                                  updateMainRubric(q.id, ri, { score: 0 as any });
                                  return;
                                }
                                let v = parseInt(val, 10);
                                if (isNaN(v)) return;
                                if (v > 99) v = 99;
                                if (v < 0) v = 1;
                                updateMainRubric(q.id, ri, { score: v });
                              }}
                            />
                            <Button variant="ghost" size="icon"
                              className="h-6 w-6 text-gray-400 hover:text-red-500 flex-shrink-0"
                              disabled={q.rubrics.length === 1}
                              onClick={() => removeMainRubric(q.id, ri)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SUBQUESTIONS */}
                  {(questionFormat === 'main-sub-rubric' || questionFormat === 'sub-only') && (
                    <div className="space-y-3 pl-4 border-l-2 border-blue-200">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-gray-500">Sub-Questions</Label>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-[#2563eb] hover:bg-blue-50 px-2"
                          onClick={() => addSubQuestion(q.id)}>
                          <Plus className="w-3 h-3 mr-1" />Add Sub-Question
                        </Button>
                      </div>

                      {q.subQuestions.map((sq, sqi) => (
                        <div key={sq.id} className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 space-y-3">
                          <div className="flex gap-2">
                            <Textarea
                              placeholder={`e.g. (${String.fromCharCode(97 + sqi)}) Detail part one`}
                              value={sq.text}
                              onChange={e => updateSubQuestion(q.id, sq.id, { text: e.target.value })}
                              style={{ minHeight: '44px', resize: 'none' }}
                              className="text-sm bg-white flex-1"
                            />
                            <div className="w-20 flex-shrink-0">
                              <Label className="text-[10px] text-gray-500 mb-1 block">Marks (1-99)</Label>
                              <Input
                                type="number" value={sq.marks} min={1} max={99} className="h-8 text-sm bg-white px-2"
                                onBlur={e => {
                                  const v = Math.min(99, Math.max(1, Number(e.target.value) || 1));
                                  updateSubQuestion(q.id, sq.id, { marks: v });
                                }}
                                onChange={e => {
                                  const val = e.target.value;
                                  if (val === '') {
                                    updateSubQuestion(q.id, sq.id, { marks: '' as any });
                                    return;
                                  }
                                  let v = parseInt(val, 10);
                                  if (isNaN(v)) return;
                                  if (v > 99) v = 99;
                                  if (v < 0) v = 1;
                                  updateSubQuestion(q.id, sq.id, { marks: v });
                                }}
                              />
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 mt-5 text-gray-400 hover:text-red-500"
                              onClick={() => removeSubQuestion(q.id, sq.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-blue-100/50">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Rubrics</Label>
                              <Button variant="ghost" size="sm" className="h-5 text-[10px] text-teal-600 hover:bg-teal-50 px-1.5"
                                onClick={() => addRubric(q.id, sq.id)}>
                                <Plus className="w-2.5 h-2.5 mr-0.5" />Add
                              </Button>
                            </div>
                            {sq.rubrics.map((r, ri) => (
                              <div key={ri} className="flex gap-2 items-center">
                                <Input
                                  placeholder="Rubric requirement..."
                                  value={r.text}
                                  className="flex-1 h-7 text-xs bg-white border-blue-100"
                                  onChange={e => updateRubric(q.id, sq.id, ri, { text: e.target.value })}
                                />
                                <Input
                                  type="number" value={r.score} min={1} max={99}
                                  className="w-16 h-7 text-xs bg-white border-blue-100 px-2"
                                  onBlur={e => {
                                    const v = Math.min(99, Math.max(1, Number(e.target.value) || 1));
                                    updateRubric(q.id, sq.id, ri, { score: v });
                                  }}
                                  onChange={e => {
                                    const val = e.target.value;
                                    if (val === '' || val === '0') {
                                      updateRubric(q.id, sq.id, ri, { score: 0 as any });
                                      return;
                                    }
                                    let v = parseInt(val, 10);
                                    if (isNaN(v)) return;
                                    if (v > 99) v = 99;
                                    if (v < 0) v = 1;
                                    updateRubric(q.id, sq.id, ri, { score: v });
                                  }}
                                />
                                <Button variant="ghost" size="icon"
                                  className="h-6 w-6 text-gray-400 hover:text-red-500 flex-shrink-0"
                                  disabled={sq.rubrics.length === 1}
                                  onClick={() => removeRubric(q.id, sq.id, ri)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* RIGHT — JSON output */}
            <div
              className="flex flex-col rounded-xl overflow-hidden border border-gray-200"
              style={{ width: '380px', flexShrink: 0, background: '#0d1117' }}
            >
              <div
                className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
                style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500/80" />
                  <span className="w-3 h-3 rounded-full bg-yellow-400/80" />
                  <span className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="text-xs font-mono text-gray-400 ml-2">output.json</span>
                </div>
                <Button
                  size="sm"
                  className="h-7 text-xs px-3"
                  style={{ background: copied ? '#238636' : '#21262d', color: copied ? '#fff' : '#c9d1d9', border: '1px solid #30363d' }}
                  onClick={handleCopy}
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <pre
                className="flex-1 overflow-auto p-4 text-xs font-mono [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-blue-500/50 [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-blue-400/80 [&::-webkit-scrollbar-thumb]:rounded-full"
                style={{ color: '#79c0ff', lineHeight: '1.6' }}
              >
                {generatedJson}
              </pre>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-100 flex-shrink-0">
            <Button variant="outline" onClick={() => { setJsonDialogOpen(false); resetJsonDialog(); }}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// — ImportPanel for Knowledge Base / Marks Schema ——————————————————————————————————
const ImportPanel: React.FC<{ title: string; description: string; icon: React.ReactNode; acceptTypes?: string }> = ({
  title, description, icon, acceptTypes = '.xlsx,.xls',
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!file) { toast.error('Please select a file first'); return; }
    setImporting(true);
    await new Promise(r => setTimeout(r, 1200));
    toast.success(`${title} imported successfully`);
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
    setImporting(false);
  };

  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2563eb] to-blue-400 flex items-center justify-center text-white">{icon}</div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
        <div
          className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-[#2563eb]/50 hover:bg-blue-50/30 transition-all"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          {file ? (
            <p className="text-sm font-medium text-[#2563eb]">{file.name}</p>
          ) : (
            <>
              <p className="text-sm text-gray-600 font-medium">Click to select file</p>
              <p className="text-xs text-gray-400 mt-1">{acceptTypes}</p>
            </>
          )}
          <input ref={inputRef} type="file" accept={acceptTypes} className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>
        <Button className="w-full bg-[#2563eb] hover:bg-[#2563eb]/90 text-white" disabled={!file || importing} onClick={handleImport}>
          {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</> : <><Upload className="w-4 h-4 mr-2" />Import</>}
        </Button>
      </CardContent>
    </Card>
  );
};

// — Main SuperAdminDashboard ————————————————————————————————————————————————————————
/**
 * Marking scheme upload.
 *
 * variant 'upload' is the embedded form: only the subject picker and the upload
 * flow, for hosting inside another page's dialog. It then follows that page's
 * organization through orgId rather than offering its own selector, so both show
 * the same subjects.
 */
/** One folder upload sends at most this many marking schemes. */
const MAX_BULK_SCHEME_FILES = 300;

/**
 * Strips ids and rubrics out of parsed markdown items, keeping only what the
 * save-questions endpoint reads.
 */
const cleanQuestionItems = (data: any[]): any[] => data.map((item: any) => {
  const cleaned: any = {};
  if (item.text !== undefined) cleaned.text = item.text;
  if (item.marks !== undefined) cleaned.marks = item.marks;
  if (Array.isArray(item.subQuestions) && item.subQuestions.length > 0) {
    cleaned.subQuestions = cleanQuestionItems(item.subQuestions);
  }
  return cleaned;
});

/** Turns parseMarkdownToQuestions output into the save-questions payload. */
const buildQuestionsPayload = (parsedQuestions: any[]) => parsedQuestions.map((q: any) => {
  let rawJson: any;
  try {
    rawJson = typeof q['Question JSON'] === 'string' ? JSON.parse(q['Question JSON']) : q['Question JSON'];
  } catch {
    rawJson = [];
  }
  const cleanedItems: any[] = Array.isArray(rawJson) ? cleanQuestionItems(rawJson) : [];
  return {
    questionLabel: String(q['Question Label']),
    questionText: cleanedItems,
    marks: q['Max Score'] || 0,
  };
});

const MarksSchemaSection: React.FC<{
  API_BASE: string;
  API_BASE1: string;
  yearCode: string;
  cycleCode: string;
  yearCycleSelector: React.ReactNode;
  variant?: 'page' | 'upload';
  orgId?: string;
  /** Fired after a scheme uploads, so a host dialog can close and refresh. */
  onUploaded?: () => void;
}> = ({ API_BASE, API_BASE1, yearCode, cycleCode, yearCycleSelector, variant = 'page', orgId, onUploaded }) => {
  const isUploadOnly = variant === 'upload';
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = React.useState<Subject | null>(null);
  const [loadingSubjects, setLoadingSubjects] = React.useState(true);
  const [mdFile, setMdFile] = React.useState<File | null>(null);
  // True when the preview is a .md the user supplied themselves. Downloading it
  // back would just hand them their own file, so that button is only offered for
  // markdown the PDF conversion produced.
  const [isDirectMdUpload, setIsDirectMdUpload] = React.useState(false);
  const [previewContent, setPreviewContent] = React.useState<string>('');
  const [showPreviewDialog, setShowPreviewDialog] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [cards, setCards] = React.useState<MarksSchemaCard[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const pdfRef = React.useRef<HTMLInputElement>(null);
  // Bulk mode: upload a folder whose .md files are named after subjects, and
  // update each matching subject in one pass.
  const [bulkFolderMode, setBulkFolderMode] = React.useState(false);
  // Ticked in the preview footer: upload the scheme only, leave the subject's
  // existing questions alone instead of posting to save-questions.
  const [skipSaveQuestions, setSkipSaveQuestions] = React.useState(false);
  // The generated (or uploaded) markdown can be corrected in the preview before
  // it is sent, so the draft is held separately until the user saves it.
  const [isEditingMd, setIsEditingMd] = React.useState(false);
  const [mdDraft, setMdDraft] = React.useState('');
  const [bulkUploading, setBulkUploading] = React.useState(false);
  const folderRef = React.useRef<HTMLInputElement>(null);

  // Upload type chooser dialog
  const [showUploadTypeDialog, setShowUploadTypeDialog] = React.useState(false);

  // PDF → API → MD flow states
  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const [pdfProcessing, setPdfProcessing] = React.useState(false);
  const [pdfStep, setPdfStep] = React.useState<'idle' | 'processing' | 'preview'>('idle');

  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [selectedCustomer, setSelectedCustomer] = React.useState('ICME');
  const [selectedOrg, setSelectedOrg] = React.useState<string>('');
  const [loadingOrgs, setLoadingOrgs] = React.useState(true);

  // Embedded, the Year and Cycle are picked here rather than inherited from the
  // host page's header, so the form carries its own lists.
  const [localYears, setLocalYears] = React.useState<{ yearid: string; yearname: string; yearcode: string }[]>([]);
  const [localYearCode, setLocalYearCode] = React.useState('');
  const [localYearsLoading, setLocalYearsLoading] = React.useState(false);
  const [localCycles, setLocalCycles] = React.useState<{ cycleid: string; cyclename: string; cyclecode: string }[]>([]);
  const [localCycleCode, setLocalCycleCode] = React.useState('');
  const [localCyclesLoading, setLocalCyclesLoading] = React.useState(false);

  // What the subject fetch actually runs on: the picked values when embedded,
  // the host page's otherwise.
  const effectiveYearCode = isUploadOnly ? localYearCode : yearCode;
  const effectiveCycleCode = isUploadOnly ? localCycleCode : cycleCode;

  React.useEffect(() => {
    if (!isUploadOnly) return;
    const fetchYears = async () => {
      setLocalYearsLoading(true);
      try {
        const res = await axios.get(`${API_BASE1}/get-year-data`);
        const data = res?.data;
        const arr: any[] = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        const mapped = arr
          .filter(item => item && typeof item === 'object')
          .map((item: any) => ({
            yearid: String(item.yearid ?? item.yearId ?? ''),
            yearname: String(item.yearname ?? item.yearName ?? ''),
            yearcode: String(item.yearcode ?? item.yearCode ?? ''),
          }))
          .filter(y => y.yearcode);
        setLocalYears(mapped);
        // Open on the host page's year when it is still in the list.
        setLocalYearCode(mapped.some(y => y.yearcode === yearCode) ? yearCode : (mapped[0]?.yearcode ?? ''));
      } catch (error) {
        console.error('Error fetching years for marking scheme upload:', error);
        toast.error('Failed to load years');
      } finally {
        setLocalYearsLoading(false);
      }
    };
    fetchYears();
    // yearCode is only the opening default, so a header change must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUploadOnly]);

  React.useEffect(() => {
    if (!isUploadOnly) return;
    if (!localYearCode) {
      setLocalCycles([]);
      setLocalCycleCode('');
      return;
    }
    const fetchCycles = async () => {
      setLocalCyclesLoading(true);
      setLocalCycles([]);
      setLocalCycleCode('');
      try {
        const { orgcode } = getSessionCodes();
        const res = await axios.get(`${API_BASE1}/get-cycle-data`, {
          params: {
            YearCode: localYearCode,
            OrgCode: (orgcode || sessionStorage.getItem('orgCode') || '').replace(/\x00/g, ''),
          },
        });
        const data = res?.data;
        const arr: any[] = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        const mapped = arr
          .filter(item => item && typeof item === 'object')
          .map((item: any) => ({
            cycleid: String(item.cycleid ?? item.cycleId ?? ''),
            cyclename: String(item.cyclename ?? item.cycleName ?? ''),
            cyclecode: String(item.cyclecode ?? item.cycleCode ?? ''),
          }))
          .filter(c => c.cyclecode);
        setLocalCycles(mapped);
        setLocalCycleCode(mapped.some(c => c.cyclecode === cycleCode) ? cycleCode : (mapped[0]?.cyclecode ?? ''));
      } catch (error) {
        console.error('Error fetching cycles for marking scheme upload:', error);
        toast.error('Failed to load cycles');
      } finally {
        setLocalCyclesLoading(false);
      }
    };
    fetchCycles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUploadOnly, localYearCode]);

  React.useEffect(() => {
    const fetchOrganizations = async () => {
      setLoadingOrgs(true);
      try {
        const orgRes = await axios.get(`${API_BASE1}/organization-details?CustCode=${selectedCustomer || 'ICME'}`, {
          headers: { 'accept': '*/*' }
        });
        const orgData = orgRes.data?.data || [];
        setOrganizations(orgData);
        if (orgData.length > 0) setSelectedOrg(String(orgData[0].organizationid));
      } catch (error) {
        console.error('Error fetching organizations:', error);
        toast.error('Failed to load organizations');
      } finally {
        setLoadingOrgs(false);
      }
    };
    fetchOrganizations();
  }, [selectedCustomer]);

  // Embedded: the host page already has an organization chosen, so follow it
  // instead of defaulting to the first one in the list.
  React.useEffect(() => {
    if (orgId) setSelectedOrg(orgId);
  }, [orgId]);

  // fetchSubjects uses yearCode/cycleCode passed from the parent header dropdowns.
  const fetchSubjects = React.useCallback(async () => {
    setLoadingSubjects(true);
    try {
      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
      const orgCodeToSend = org ? org.organizationcode : '';

      if (!effectiveYearCode || !effectiveCycleCode) {
        setSubjects([]);
        setCards([]);
        return;
      }
      const userCode = (sessionStorage.getItem('userCode') || sessionStorage.getItem('username') || '').replace(/\x00/g, '');

      const res = await axios.get(`${API_BASE1}/get-subject-data`, {
        params: {
          orgCode: orgCodeToSend,
          custCode: selectedCustomer || 'ICME',
          yearCode: effectiveYearCode,
          cycleCode: effectiveCycleCode,
          userCode,
        },
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' }
      });
      const data = res?.data;
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      const mapped: Subject[] = arr.map((item: any) => ({
        value: item.subjectcode || item.subjectCode || '',
        label: item.subjectname || item.subjectName || '',
        code: item.subjectcode || item.subjectCode || '',
        workspaceCount: Number(item.workspacecount ?? item.workspaceCount ?? 0),
        status: Number(item.status ?? 1),
        guidelinepath: item.guidelinepath ?? item.guidelinePath ?? null,
      }));
      setSubjects(mapped);
      setCards(mapped.filter(s => s.guidelinepath).map(s => ({
        subjectCode: s.code,
        subjectName: s.label,
        guidelinepath: s.guidelinepath as string,
      })));
    } catch (e) {
      toast.error('Failed to load subjects');
    } finally {
      setLoadingSubjects(false);
    }
  }, [selectedOrg, organizations, API_BASE1, effectiveYearCode, effectiveCycleCode, selectedCustomer]);

  React.useEffect(() => {
    if (selectedOrg && organizations.length > 0) fetchSubjects();
  }, [fetchSubjects, selectedOrg, organizations]);

  const refreshSubjects = async () => { await fetchSubjects(); };

  /**
   * Matches a .md file name to a subject.
   *
   * Files arrive named after the subject - "AEP04.md", "Broadcast Journalism.md",
   * or the repo's own "<name>.docx.md" - so both extensions are stripped and the
   * comparison ignores case, spaces and punctuation.
   */
  const matchSubjectForFile = (fileName: string) => {
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const base = fileName.replace(/\.md$/i, '').replace(/\.docx?$/i, '');
    const key = normalize(base);
    if (!key) return null;
    return subjects.find(s => normalize(s.code) === key)
      || subjects.find(s => normalize(s.label) === key)
      || null;
  };

  /**
   * Uploads every .md in the chosen folder against the subject its name points
   * at. Files that match nothing are reported rather than guessed at.
   */
  const handleBulkFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (folderRef.current) folderRef.current.value = '';
    if (picked.length === 0) return;

    const mdFiles = picked.filter(f => /\.md$/i.test(f.name));
    if (mdFiles.length === 0) {
      toast.error('That folder has no .md files in it.');
      return;
    }

    const matched: { file: File; subject: Subject }[] = [];
    const unmatched: string[] = [];
    mdFiles.forEach(file => {
      const subject = matchSubjectForFile(file.name);
      if (subject) matched.push({ file, subject });
      else unmatched.push(file.name);
    });

    if (matched.length === 0) {
      toast.error(`No file name matched a subject in this year and cycle. Name each file after its subject, e.g. "${subjects[0]?.code ?? 'AEP04'}.md".`, { duration: 6000 });
      return;
    }

    // One upload carries at most MAX_BULK_SCHEME_FILES schemes; the rest are left
    // for a second folder rather than being sent.
    const overCap = matched.length - MAX_BULK_SCHEME_FILES;
    const toUpload = overCap > 0 ? matched.slice(0, MAX_BULK_SCHEME_FILES) : matched;
    if (overCap > 0) {
      toast.error(
        `Only ${MAX_BULK_SCHEME_FILES} marking schemes can be uploaded at once. The first ${MAX_BULK_SCHEME_FILES} were taken and ${overCap} file(s) were skipped.`,
        { duration: 6000 }
      );
    }

    setBulkUploading(true);
    try {
      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
      const orgcode = org ? org.organizationcode : (sessionStorage.getItem('orgCode') || 'ICME01');
      const failed: string[] = [];

      const custcode = selectedCustomer || 'ICME';
      const blank: string[] = [];
      const questionWarnings: string[] = [];
      let succeeded = 0;

      for (const { file, subject } of toUpload) {
        try {
          const text = await file.text();
          if (!text.trim() || text.trim().length < 10) {
            blank.push(file.name);
            continue;
          }

          const fd = new FormData();
          fd.append('orgcode', orgcode);
          fd.append('custcode', custcode);
          fd.append('subjectcode', subject.code);
          fd.append('file', file, file.name);
          await axios.post(`${API_BASE}/upload-marking-scheme`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          succeeded++;

          // Same second step as the single-subject upload: the parsed questions
          // go to save-questions, and a parser failure only warns.
          try {
            const parsedQuestions = parseMarkdownToQuestions(text, subject.code);
            if (parsedQuestions && parsedQuestions.length > 0) {
              await axios.post(`${API_BASE1}/save-questions`, {
                custcode,
                orgcode,
                subjectCode: subject.code,
                questions: buildQuestionsPayload(parsedQuestions),
              }, { headers: { 'Content-Type': 'application/json', 'accept': '*/*' } });
            }
          } catch (parserErr) {
            console.error(`Questions could not be saved for ${subject.code}`, parserErr);
            questionWarnings.push(subject.code);
          }
        } catch (err) {
          console.error(`Failed to upload marking scheme for ${subject.code}`, err);
          failed.push(subject.code);
        }
      }

      if (succeeded > 0) toast.success(`${succeeded} subject marking scheme(s) updated`);
      if (failed.length > 0) toast.error(`Failed for ${failed.length} subject(s): ${failed.join(', ')}`);
      if (blank.length > 0) toast.error(`Skipped ${blank.length} blank file(s): ${blank.slice(0, 5).join(', ')}${blank.length > 5 ? '…' : ''}`, { duration: 6000 });
      if (questionWarnings.length > 0) {
        toast.warning(`Scheme uploaded, but questions could not be saved for: ${questionWarnings.join(', ')}`, { duration: 6000 });
      }
      if (unmatched.length > 0) {
        toast.error(`Skipped ${unmatched.length} file(s) with no matching subject: ${unmatched.slice(0, 5).join(', ')}${unmatched.length > 5 ? '...' : ''}`, { duration: 6000 });
      }
      await refreshSubjects();
      if (succeeded > 0) onUploaded?.();
    } finally {
      setBulkUploading(false);
    }
  };

  const handleOpenUploadDialog = () => {
    if (!selectedSubject) { toast.error('Please select a subject first'); return; }
    setPdfFile(null);
    setMdFile(null);
    setPreviewContent('');
    setIsDirectMdUpload(false);
    setPdfStep('idle');
    setShowUploadTypeDialog(true);
  };

  // USE CASE 1: PDF -> API -> .md preview
  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (pdfRef.current) pdfRef.current.value = '';
    if (!f) return;
    const nameLower = f.name.toLowerCase();
    if (!nameLower.endsWith('.pdf') && !nameLower.endsWith('.doc') && !nameLower.endsWith('.docx')) { 
      toast.error('Only PDF and Word documents are allowed here'); 
      return; 
    }
    setPdfFile(f);
    setPdfStep('processing');
    setPdfProcessing(true);
    try {
      const fd = new FormData();
      fd.append('file', f, f.name);
      const baseUrl = import.meta.env.VITE_ICMEPRODUCT_API_BASE || 'https://ailevate-poc.excelsoftcorp.com/aiapps/ICME_OCR';
      const res = await axios.post(`${baseUrl}/convert-markscheme-to-md`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const mdContent: string =
        typeof res.data === 'string'
          ? res.data
          : (res.data?.content || res.data?.markdown || JSON.stringify(res.data, null, 2));

      if (!mdContent || mdContent.trim().length < 5) {
        toast.error('API returned empty markdown. Please try again or upload .md directly.');
        setPdfStep('idle');
        return;
      }
      setPreviewContent(mdContent);
      const blob = new Blob([mdContent], { type: 'text/markdown' });
      const syntheticMd = new File([blob], `${f.name.replace(/\.pdf$/i, '')}.md`, { type: 'text/markdown' });
      setMdFile(syntheticMd);
      setIsDirectMdUpload(false);
      setPdfStep('preview');
    } catch (err: any) {
      console.error('PDF to MD API failed:', err);
      toast.error(err?.response?.data?.message || 'Failed to process PDF. Please try uploading .md directly.');
      setPdfStep('idle');
    } finally {
      setPdfProcessing(false);
    }
  };

  // USE CASE 2: Direct .md upload
  const handleMdSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.md')) { toast.error('Only .md files are allowed'); return; }
    const text = await f.text();
    if (!text.trim() || text.trim().length < 10) {
      toast.error('File is empty or too short. Please add meaningful content.');
      return;
    }
    setMdFile(f);
    setPreviewContent(text);
    setIsDirectMdUpload(true);
    setPdfStep('preview');
  };

  /**
   * Commits the edited markdown to the preview and rebuilds mdFile from it, so
   * the upload sends what is on screen rather than the original text.
   */
  const applyMdEdits = () => {
    if (!mdDraft.trim() || mdDraft.trim().length < 10) {
      toast.error('Cannot save blank or near-empty content.');
      return;
    }
    const name = mdFile?.name || 'marking_scheme.md';
    setPreviewContent(mdDraft);
    setMdFile(new File([new Blob([mdDraft], { type: 'text/markdown' })], name, { type: 'text/markdown' }));
    setIsEditingMd(false);
    toast.success('Changes saved to the file. Click Confirm & Save to upload it.');
  };

  const handleSubmit = async () => {
    if (!mdFile || !selectedSubject) { toast.error('Please select a subject and a file'); return; }
    const text = await mdFile.text();
    if (!text.trim() || text.trim().length < 10) {
      toast.error('Cannot upload blank or empty file.');
      setShowPreviewDialog(false);
      setMdFile(null);
      return;
    }
    setUploading(true);
    try {
      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
      const orgcode = org ? org.organizationcode : (sessionStorage.getItem('orgCode') || 'ICME01');
      const custcode = 'ICME';

      // 1. Upload Markdown to the marking scheme API
      const fd = new FormData();
      fd.append('orgcode', orgcode);
      fd.append('custcode', custcode);
      fd.append('subjectcode', selectedSubject.code);
      fd.append('file', mdFile, mdFile.name);
      await axios.post(`${API_BASE}/upload-marking-scheme`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // 2. Parse Markdown to Question JSON format and POST to save-questions API,
      //    unless the user ticked "Skip saving questions" in the preview footer.
      if (!skipSaveQuestions) {
        try {
          const parsedQuestions = parseMarkdownToQuestions(text, selectedSubject.code);
          if (parsedQuestions && parsedQuestions.length > 0) {

            // Build the questions array expected by the save-questions endpoint
            const questionsPayload = buildQuestionsPayload(parsedQuestions);

            // Build final payload using values from the selected dropdowns
            const saveQuestionsPayload = {
              custcode,
              orgcode,
              subjectCode: selectedSubject.code,
              questions: questionsPayload,
            };

            // TODO: Uncomment original import-subject-data call once backend issue is resolved
            // const qFd = new FormData();
            // qFd.append('File', csvFile);
            // qFd.append('IsType', '1');
            // qFd.append('OrgCode', orgcode);
            // await axios.post(`${API_BASE1}/import-subject-data`, qFd, { headers: { 'Content-Type': 'multipart/form-data' } });

            // Call the new save-questions API
            await axios.post(`${API_BASE1}/save-questions`, saveQuestionsPayload, {
              headers: { 'Content-Type': 'application/json', 'accept': '*/*' }
            });

            toast.success(
              `✅ ${questionsPayload.length} question${questionsPayload.length > 1 ? 's' : ''} saved successfully for ${selectedSubject.code}!`,
              { duration: 4000 }
            );
          }
        } catch (parserErr: any) {
          console.error('Failed to parse/save questions from markdown', parserErr);
          const errMsg = parserErr?.response?.data?.message || parserErr?.message || 'Unknown error';
          toast.warning(`⚠️ Marking schema uploaded, but questions could not be saved: ${errMsg}`);
        }
      }

      toast.success(skipSaveQuestions
        ? 'Marks schema uploaded successfully! Questions were not changed.'
        : 'Marks schema and questions uploaded successfully!');
      setShowUploadTypeDialog(false);
      setShowPreviewDialog(false);
      setMdFile(null);
      setPdfFile(null);
      setPdfStep('idle');
      setSelectedSubject(null);
      await refreshSubjects();
      // Hosted in a dialog: the upload is done, so close it rather than leaving
      // the form open behind the toast.
      onUploaded?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const resetUploadDialog = () => {
    setShowUploadTypeDialog(false);
    setSkipSaveQuestions(false);
    setIsEditingMd(false);
    setMdDraft('');
    setPdfFile(null);
    setMdFile(null);
    setPreviewContent('');
    setIsDirectMdUpload(false);
    setPdfStep('idle');
  };

  return (
    // Embedded, this sits in a dialog that does its own scrolling, so it must not
    // stretch or scroll on its own the way the full page does.
    <div className={isUploadOnly ? 'space-y-5' : 'space-y-6 flex flex-col flex-1 min-h-0'}>
      {/* Same overlay the rest of this dashboard uses, and above the dialog this
          form may be hosted in. */}
      {pdfProcessing && <UploadingOverlay text={`Converting ${pdfFile?.name || 'document'} to Markdown, please wait…`} />}
      {uploading && <UploadingOverlay text={selectedSubject ? `Uploading scheme for ${selectedSubject.label}, please wait…` : 'Uploading file, please wait…'} />}
      {bulkUploading && <UploadingOverlay text="Uploading marking schemes, please wait…" />}

      {/* Header - the embedded form inherits its host page's selectors instead. */}
      {!isUploadOnly && (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Marks Schema</h2>
          <p className="text-sm text-gray-500 mt-0.5">Upload and manage marking scheme files per subject</p>
        </div>
        <div className="flex items-end gap-3">
                    <div className="flex flex-col w-48">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Select Customer</label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)} 
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]/30 cursor-pointer text-gray-700 font-medium"
            >
              <option value="ICME">ICME</option>
            </select>
          </div>
          <div className="flex flex-col w-48">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Select Organization</label>
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              disabled={loadingOrgs}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]/30 cursor-pointer text-gray-700 font-medium disabled:opacity-60"
            >
              {loadingOrgs ? (
                <option value="">Loading...</option>
              ) : organizations.length > 0 ? (
                organizations.map(org => (
                  <option key={org.organizationid} value={org.organizationid}>
                    {org.organizationname}
                  </option>
                ))
              ) : (
                <option value="">No Organizations Found</option>
              )}
            </select>
          </div>
          {yearCycleSelector}
        </div>
      </div>
      )}

      {/* Upload Card - numbered steps and controls sized to match Import Subject. */}
      <div className={isUploadOnly ? 'flex flex-col gap-6' : 'bg-white rounded-xl border border-gray-200 p-6 space-y-4'}>
        {!isUploadOnly && <h3 className="text-sm font-semibold text-gray-700">Upload Marking Scheme</h3>}

        {/* Embedded: the scope is chosen here, since there is no page header to
            inherit it from. Subjects are re-read whenever any of it changes. */}
        {isUploadOnly && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Import destination</h3>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">Pick the customer, organization, academic year and cycle this scheme belongs to.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Customer</label>
                  <div className="relative">
                    <select
                      value={selectedCustomer}
                      onChange={(e) => setSelectedCustomer(e.target.value)}
                      className="w-full px-3 py-2.5 pr-9 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition-colors appearance-none cursor-pointer text-gray-700"
                    >
                      <option value="ICME">ICME</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Organization</label>
                  <div className="relative">
                    <select
                      value={selectedOrg}
                      onChange={(e) => setSelectedOrg(e.target.value)}
                      disabled={loadingOrgs || organizations.length === 0}
                      className="w-full px-3 py-2.5 pr-9 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition-colors appearance-none cursor-pointer text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loadingOrgs ? (
                        <option value="">Loading Organizations...</option>
                      ) : organizations.length > 0 ? (
                        organizations.map(org => (
                          <option key={org.organizationid} value={org.organizationid}>{org.organizationname}</option>
                        ))
                      ) : (
                        <option value="">No Organizations Found</option>
                      )}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Academic year</label>
                  <div className="relative">
                    <select
                      value={localYearCode}
                      onChange={(e) => setLocalYearCode(e.target.value)}
                      disabled={localYearsLoading || localYears.length === 0}
                      className="w-full px-3 py-2.5 pr-9 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition-colors appearance-none cursor-pointer text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {localYearsLoading ? (
                        <option value="">Loading Years...</option>
                      ) : localYears.length > 0 ? (
                        localYears.map(year => (
                          <option key={year.yearid || year.yearcode} value={year.yearcode}>{year.yearname}</option>
                        ))
                      ) : (
                        <option value="">No Years Found</option>
                      )}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Cycle</label>
                  <div className="relative">
                    <select
                      value={localCycleCode}
                      onChange={(e) => setLocalCycleCode(e.target.value)}
                      disabled={localCyclesLoading || localCycles.length === 0}
                      className="w-full px-3 py-2.5 pr-9 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition-colors appearance-none cursor-pointer text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {localCyclesLoading ? (
                        <option value="">Loading Cycles...</option>
                      ) : localCycles.length > 0 ? (
                        localCycles.map(cycle => (
                          <option key={cycle.cycleid || cycle.cyclecode} value={cycle.cyclecode}>{cycle.cyclename}</option>
                        ))
                      ) : (
                        <option value="">No Cycles for this Year</option>
                      )}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* This whole block (subject/toggle, upload trigger, status message) is
            shared with the full Marks Schema page (`!isUploadOnly`), so each
            piece branches on isUploadOnly - the page variant's markup below is
            byte-for-byte what it was before; only the modal variant is redesigned. */}
        {isUploadOnly ? (
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Subject & upload mode</h3>
            <p className="text-xs text-gray-500 mt-0.5 mb-3">Pick the subject this scheme is for, or switch to folder mode to match several subjects by file name.</p>

            {!bulkFolderMode && (
              <div className="relative mb-3">
                <select
                  value={selectedSubject?.code || ''}
                  onChange={e => { const s = subjects.find(s => s.code === e.target.value) || null; setSelectedSubject(s); }}
                  className="w-full px-3 py-2.5 pr-9 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition-colors appearance-none cursor-pointer text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loadingSubjects}
                >
                  <option value="">{loadingSubjects ? 'Loading Subjects...' : 'Select subject…'}</option>
                  {subjects.map((s, idx) => (
                    <option key={`${s.code}-${idx}`} value={s.code}>{s.label} ({s.code})</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Same bulkFolderMode boolean and onChange as before - moved below
                the select and restyled as a switch row instead of floating
                beside the "Select Subject" label. */}
            <label className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50/60 cursor-pointer select-none">
              <span>
                <span className="block text-sm font-medium text-gray-700">Upload folder by subject name</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  {bulkFolderMode ? 'Files are matched to subjects by folder name.' : 'Off: upload a single scheme for the subject selected above.'}
                </span>
              </span>
              <span className="relative inline-flex items-center shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  role="switch"
                  aria-checked={bulkFolderMode}
                  checked={bulkFolderMode}
                  onChange={(e) => setBulkFolderMode(e.target.checked)}
                  className="sr-only peer"
                />
                <span className="w-9 h-5 rounded-full bg-gray-300 peer-checked:bg-[#2563eb] transition-colors" />
                <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
              </span>
            </label>

            {bulkFolderMode && (
              <p className="mt-2 text-xs text-gray-500 px-0.5">
                Every <strong>.md</strong> in the folder is matched to the subject its file name names
                &mdash; by code or by name &mdash; and updates that subject. No single subject needed.
                Up to {MAX_BULK_SCHEME_FILES} schemes per upload.
              </p>
            )}
          </div>
        ) : (
          <div className="relative group">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#2563eb]/10 text-[#2563eb] flex items-center justify-center text-[10px]">1</span>
                Select Subject
              </p>
              {/* Bulk route: one folder of .md files, each named after its subject. */}
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={bulkFolderMode}
                  onChange={(e) => setBulkFolderMode(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#2563eb] accent-[#2563eb] cursor-pointer"
                />
                Upload folder by subject name
              </label>
            </div>
            {bulkFolderMode ? (
              <p className="px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-xs text-gray-500">
                Every <strong>.md</strong> in the folder is matched to the subject its file name names
                &mdash; by code or by name &mdash; and updates that subject. No single subject needed.
                Up to {MAX_BULK_SCHEME_FILES} schemes per upload.
              </p>
            ) : (
              <div className="relative">
                <select
                  value={selectedSubject?.code || ''}
                  onChange={e => { const s = subjects.find(s => s.code === e.target.value) || null; setSelectedSubject(s); }}
                  className="w-full px-4 py-3 pr-10 text-sm border-2 border-gray-100 rounded-xl bg-white shadow-sm hover:border-[#2563eb]/50 focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10 transition-all appearance-none cursor-pointer text-gray-700 font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loadingSubjects}
                >
                  <option value="">{loadingSubjects ? 'Loading Subjects...' : '-- Select Subject --'}</option>
                  {subjects.map((s, idx) => (
                    <option key={`${s.code}-${idx}`} value={s.code}>{s.label} ({s.code})</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none group-hover:text-[#2563eb] transition-colors" />
              </div>
            )}
          </div>
        )}

        {isUploadOnly ? (
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Upload file</h3>
            {/* This card opens the existing "Choose upload method" dialog
                (AI Auto-Convert / Direct Upload) rather than a native file
                input directly - that nested flow is unchanged and out of
                scope for this UI-only pass. */}
            {bulkFolderMode ? (
              <>
                <input
                  ref={folderRef}
                  type="file"
                  multiple
                  accept=".md"
                  className="hidden"
                  onChange={handleBulkFolderSelect}
                  {...({ webkitdirectory: '', directory: '' } as any)}
                />
                <button
                  onClick={() => folderRef.current?.click()}
                  disabled={bulkUploading || loadingSubjects || subjects.length === 0}
                  aria-disabled={bulkUploading || loadingSubjects || subjects.length === 0}
                  className={`w-full border-2 border-dashed rounded-[10px] px-4 py-6 text-center transition-colors ${
                    bulkUploading || loadingSubjects || subjects.length === 0
                      ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                      : 'border-gray-300 bg-gray-50 hover:border-[#2563eb]/50 hover:bg-blue-50/30 cursor-pointer'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
                    <FolderOpen className="w-5 h-5 text-[#2563eb]" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 mt-2.5">
                    {bulkUploading ? 'Uploading…' : 'Click to choose a folder'}
                  </p>
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">MD</span>
                  </div>
                </button>
              </>
            ) : (
              <button
                onClick={handleOpenUploadDialog}
                disabled={!selectedSubject}
                aria-disabled={!selectedSubject}
                className={`w-full border-2 border-dashed rounded-[10px] px-4 py-6 text-center transition-colors ${
                  !selectedSubject
                    ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                    : 'border-gray-300 bg-gray-50 hover:border-[#2563eb]/50 hover:bg-blue-50/30 cursor-pointer'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
                  {!selectedSubject ? <Lock className="w-5 h-5 text-gray-400" /> : <Upload className="w-5 h-5 text-[#2563eb]" />}
                </div>
                <p className="text-sm font-medium text-gray-700 mt-2.5">
                  {!selectedSubject ? 'Select a subject to enable upload' : 'Click to upload'}
                </p>
                {selectedSubject && (
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">PDF</span>
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">DOCX</span>
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">MD</span>
                  </div>
                )}
              </button>
            )}
          </div>
        ) : (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#2563eb]/10 text-[#2563eb] flex items-center justify-center text-[10px]">2</span>
              Upload File
            </p>
            {bulkFolderMode ? (
              <>
                <input
                  ref={folderRef}
                  type="file"
                  multiple
                  accept=".md"
                  className="hidden"
                  onChange={handleBulkFolderSelect}
                  {...({ webkitdirectory: '', directory: '' } as any)}
                />
                <button
                  onClick={() => folderRef.current?.click()}
                  disabled={bulkUploading || loadingSubjects || subjects.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl transition-all shadow-sm bg-[#2563eb] text-white hover:bg-blue-600 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  <FolderOpen className="w-4 h-4" />
                  {bulkUploading ? 'Uploading…' : 'Choose Folder'}
                </button>
              </>
            ) : (
              <button
                onClick={handleOpenUploadDialog}
                disabled={!selectedSubject}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl transition-all shadow-sm bg-[#2563eb] text-white hover:bg-blue-600 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                Upload Marking Scheme
              </button>
            )}
          </div>
        )}
        {isUploadOnly ? (
          bulkFolderMode ? (
            <div role="status" className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 text-blue-700 text-[13px]">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {loadingSubjects
                  ? 'Loading subjects…'
                  : subjects.length === 0
                    ? 'No subjects loaded yet — pick a customer, organization, year and cycle first.'
                    : `Pick the folder holding your .md files. ${subjects.length} subject(s) are available to match against.`}
              </span>
            </div>
          ) : !selectedSubject ? (
            <div role="status" className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-gray-50 text-gray-600 text-[13px]">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
              <span>Select a subject to continue.</span>
            </div>
          ) : cards.some(c => c.subjectCode === selectedSubject.code) ? (
            <div role="alert" className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 text-amber-700 text-[13px] font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span><strong>{selectedSubject.label}</strong> already has a marking scheme. Uploading will replace it.</span>
            </div>
          ) : (
            <div role="status" className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-teal-50 text-teal-700 text-[13px]">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Ready to upload for <strong>{selectedSubject.label}</strong></span>
            </div>
          )
        ) : (
          bulkFolderMode ? (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
              {loadingSubjects
                ? 'Loading subjects…'
                : subjects.length === 0
                  ? 'No subjects loaded yet — pick a customer, organization, year and cycle first.'
                  : `Pick the folder holding your .md files. ${subjects.length} subject(s) are available to match against.`}
            </p>
          ) : !selectedSubject ? (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
              Select a subject to continue.
            </p>
          ) : cards.some(c => c.subjectCode === selectedSubject.code) ? (
            <p className="text-xs text-amber-700 font-medium bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span><strong>{selectedSubject.label}</strong> already has a marking scheme. Uploading will replace it.</span>
            </p>
          ) : (
            <p className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Ready to upload for <strong>{selectedSubject.label}</strong></span>
            </p>
          )
        )}
      </div>

      {/* Upload Type Chooser + Flow Dialog */}
      <Dialog open={showUploadTypeDialog} onOpenChange={() => { }}>
        <DialogContent
          className="max-w-[760px] w-[calc(100vw-32px)] flex flex-col p-0 overflow-hidden bg-white border border-gray-200 shadow-xl rounded-xl"
          style={{ maxHeight: 'calc(100vh - 64px)' }}
          onInteractOutside={e => e.preventDefault()}
        >
          {/* Dialog Header - same no-gradient, white, icon-tile language as the
              Import Subject and Upload Marking Schema (selection) modals. */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 shrink-0">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-[10px] bg-blue-50 flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5 text-[#2563eb]" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[18px] font-semibold text-gray-900 leading-tight">Upload marking scheme</DialogTitle>
                {/* Breadcrumb built only from state this component already holds -
                    no new fetches. Year/Cycle names only exist locally when this
                    section is embedded (isUploadOnly); on the full page they are
                    shown by code since only the code is passed down from the header. */}
                <DialogDescription className="text-[13px] text-gray-500 mt-1 truncate">
                  {[
                    selectedCustomer,
                    organizations.find(o => String(o.organizationid) === selectedOrg)?.organizationname,
                    isUploadOnly ? (localYears.find(y => y.yearcode === localYearCode)?.yearname || localYearCode) : yearCode,
                    isUploadOnly ? (localCycles.find(c => c.cyclecode === localCycleCode)?.cyclename || localCycleCode) : cycleCode,
                  ].filter(Boolean).join(' \u203a ')}
                  {selectedSubject && (
                    <>
                      {' '}&middot; Subject: <strong className="text-gray-700 font-semibold">{selectedSubject.label}</strong>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={resetUploadDialog}
              disabled={uploading || pdfProcessing}
              aria-label="Close"
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Overwrite warning - inline banner replaces the old header chip so it
              can't be missed. Same condition as before; no logic changed. */}
          {selectedSubject && cards.some(c => c.subjectCode === selectedSubject.code) && (
            <div role="status" className="flex items-start gap-2 px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-[13px] shrink-0">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span><strong className="font-semibold">{selectedSubject.label}</strong> already has a marking scheme. Uploading will replace it.</span>
            </div>
          )}

          {/* Step Indicator - primary (blue) token to match the rest of the app;
              compact and centered instead of edge-to-edge. */}
          <div className="px-8 py-5 border-b border-gray-200 shrink-0">
            <ol className="flex items-center justify-between max-w-[480px] mx-auto relative">
              <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 -translate-y-1/2 z-0" />
              {[
                { label: 'Choose', active: pdfStep === 'idle', done: pdfStep !== 'idle', num: 1 },
                { label: 'Process', active: pdfStep === 'processing', done: pdfStep === 'preview', num: 2 },
                { label: 'Preview', active: pdfStep === 'preview', done: false, num: 3 },
              ].map((s, i) => (
                <li key={i} aria-current={s.active ? 'step' : undefined} className="relative z-10 flex flex-col items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-500 shadow-sm ${
                    s.done ? 'bg-[#2563eb] text-white scale-105 ring-4 ring-blue-50' :
                    s.active ? 'bg-white text-[#2563eb] ring-4 ring-blue-100 border-2 border-[#2563eb] scale-110' :
                    'bg-white text-gray-400 border border-gray-200'
                  }`}>
                    {s.done ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                  </div>
                  <span className={`text-xs font-semibold transition-colors duration-300 absolute -bottom-6 whitespace-nowrap ${
                    s.active ? 'text-[#2563eb]' : s.done ? 'text-[#2563eb]' : 'text-gray-400'
                  }`}>{s.label}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-8 py-8 relative bg-white">
            {/* Step 1: Choose upload type */}
            {pdfStep === 'idle' && (
              <div className="flex-1 flex items-center justify-center">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-[620px]">
                  {/* Option A: Upload PDF/Word - a real <button> (was a <div onClick>)
                      so it is keyboard-focusable; onClick/behavior unchanged. */}
                  <button
                    type="button"
                    onClick={() => pdfRef.current?.click()}
                    className="group relative flex flex-col items-start gap-4 p-6 rounded-xl bg-white border-2 border-gray-200 text-left hover:border-orange-300 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/20 focus-visible:border-orange-400 transition-all duration-200"
                  >
                    <div className="w-12 h-12 rounded-[10px] bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center transition-colors duration-200">
                      <FileSpreadsheet className="w-6 h-6 text-orange-600" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[15px] font-semibold text-gray-900">Upload document</p>
                      <p className="text-[13px] text-gray-500 leading-relaxed">
                        Upload a Word document and our AI will automatically convert it into structured Markdown.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                        <Sparkles className="w-3 h-3" /> AI auto-convert
                      </span>
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">DOC</span>
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">DOCX</span>
                    </div>
                  </button>

                  {/* Option B: Upload .md directly */}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="group relative flex flex-col items-start gap-4 p-6 rounded-xl bg-white border-2 border-gray-200 text-left hover:border-teal-300 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20 focus-visible:border-teal-400 transition-all duration-200"
                  >
                    <div className="w-12 h-12 rounded-[10px] bg-teal-50 group-hover:bg-teal-100 flex items-center justify-center transition-colors duration-200">
                      <BookOpen className="w-6 h-6 text-teal-600" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[15px] font-semibold text-gray-900">Upload .md file</p>
                      <p className="text-[13px] text-gray-500 leading-relaxed">
                        Already have a Markdown schema? Upload it directly to bypass the AI conversion step.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                        Direct upload
                      </span>
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">MD</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Preview content */}
            {pdfStep === 'preview' && (
              <div className="flex-1 flex flex-col h-full animate-in slide-in-from-bottom-4 duration-500">


                {/* Premium Code Editor look for Markdown response */}
                <div className="flex-1 min-h-0 relative bg-[#0d1117] rounded-xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col group">

                  {/* Editor toolbar - the .md is editable here before it is uploaded */}
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#161b22] border-b border-slate-700 shrink-0">
                    <p className="flex items-center gap-2 text-[11px] font-mono text-slate-400 truncate">
                      <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{mdFile?.name || 'marking_scheme.md'}</span>
                      {isEditingMd && <span className="text-amber-400 font-semibold shrink-0">&bull; editing</span>}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {!isEditingMd ? (
                        <button
                          onClick={() => { setMdDraft(previewContent); setIsEditingMd(true); }}
                          disabled={uploading || !previewContent}
                          className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-slate-600 text-[11px] font-semibold text-slate-300 hover:border-teal-500 hover:text-teal-300 hover:bg-teal-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => { setIsEditingMd(false); setMdDraft(''); }}
                            disabled={uploading}
                            className="h-7 px-2.5 inline-flex items-center rounded-md border border-slate-600 text-[11px] font-medium text-slate-300 hover:bg-slate-700/50 transition-colors disabled:opacity-40"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={applyMdEdits}
                            disabled={uploading || mdDraft === previewContent}
                            className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md bg-teal-500 text-[11px] font-bold text-white hover:bg-teal-400 transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Save
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Editor Content */}
                  {isEditingMd ? (
                    <textarea
                      value={mdDraft}
                      onChange={e => setMdDraft(e.target.value)}
                      spellCheck={false}
                      className="flex-1 min-h-0 overflow-y-auto scrollbar-slim bg-[#0d1117] p-5 font-mono text-[13px] leading-relaxed text-slate-200 resize-none border-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500/40 selection:bg-teal-500/30"
                    />
                  ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-slim p-5 font-mono text-[13px] leading-relaxed text-slate-300 selection:bg-teal-500/30">
                      <pre className="whitespace-pre-wrap break-words">{previewContent || 'No content generated.'}</pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Step 1 footer - this step had no footer at all before. Cards call
              pdfRef/fileRef.current.click() the moment they're clicked, and
              there is no separate "Next"/"Continue" handler for this step, so
              only Cancel is wired up here. Do NOT add a Continue button or any
              new navigation logic - flagging this for review per the UI spec
              rather than inventing a handler that doesn't exist. */}
          {pdfStep === 'idle' && (
            <div className="flex items-center justify-between px-8 py-4 bg-white border-t border-gray-200 shrink-0">
              <p className="text-xs text-gray-500">Step 1 of 3 &middot; Choose an upload method</p>
              <button
                onClick={resetUploadDialog}
                disabled={uploading || pdfProcessing}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Footer - only shown in preview step */}
          {pdfStep === 'preview' && (
            <div className="flex items-center justify-between px-8 py-5 bg-white border-t border-gray-100 shrink-0 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] z-10">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skipSaveQuestions}
                    onChange={e => setSkipSaveQuestions(e.target.checked)}
                    disabled={uploading}
                    className="w-4 h-4 rounded border-gray-300 text-[#2563eb] accent-[#2563eb] cursor-pointer disabled:cursor-not-allowed"
                  />
                  Skip saving questions
                </label>
                <p className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-teal-500" />
                  {isEditingMd
                    ? 'Save or cancel your edits to continue'
                    : skipSaveQuestions ? 'Schema only — questions untouched' : 'Schema ready for saving'}
                </p>
              </div>
              <div className="flex gap-3">
                {/* Only the converted markdown is worth downloading; a .md the user
                    uploaded themselves would just be handed straight back. */}
                {!isDirectMdUpload && (
                <button
                  onClick={() => {
                    if (!previewContent) return;
                    const blob = new Blob([previewContent], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = mdFile?.name || 'marking_scheme.md';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  disabled={uploading || isEditingMd}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-teal-200 text-teal-700 bg-teal-50 hover:bg-teal-100 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" /> Download .md
                </button>
                )}
                <button
                  onClick={resetUploadDialog}
                  disabled={uploading}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 transition-all shadow-sm"
                >
                 Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={uploading || isEditingMd}
                  className="px-6 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 text-white hover:from-teal-700 hover:to-teal-600 disabled:opacity-50 flex items-center gap-2 shadow-md hover:shadow-lg hover:shadow-teal-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm & Save
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden file inputs */}
      <input ref={pdfRef} type="file" accept=".doc,.docx" className="hidden" onChange={handlePdfSelect} />
      <input ref={fileRef} type="file" accept=".md" className="hidden" onChange={handleMdSelect} />

      {/* View Card Dialog */}
    </div>
  );
};
/**
 * Keeps a whole-number count input digits-only. A `type="number"` input still
 * lets the user type signs and exponent characters (-, +, e, .), and reports an
 * empty value for them, so they are blocked at the key press and stripped from
 * pasted or dropped text before the value reaches state.
 */
const NON_DIGIT_COUNT_KEYS = ['-', '+', 'e', 'E', '.', ','];
const blockNonDigitCountKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (NON_DIGIT_COUNT_KEYS.includes(e.key)) e.preventDefault();
};
const toDigitsOnly = (raw: string) => raw.replace(/\D/g, '');
/** Max Questions / Max Images hold a two-digit count, so 1-99. */
const MAX_COUNT_DIGITS = 2;

/** Both threshold scores start here, and fall back to it when left blank. */
const DEFAULT_THRESHOLD = '80';

/** Keeps a threshold a whole 1-100, or empty while it is being typed. */
const toThresholdValue = (raw: string) => {
  const digits = toDigitsOnly(raw).slice(0, 3);
  if (digits === '') return '';
  const value = Number(digits);
  return value > 100 ? '100' : String(value);
};
const toCountValue = (raw: string) => toDigitsOnly(raw).slice(0, MAX_COUNT_DIGITS);
/**
 * Normalises a predefined question->images mapping against a given
 * Max Questions / Max Images configuration.
 *
 * Rules enforced:
 *  - only questions q1...qMaxQ survive (anything beyond is orphaned)
 *  - only image numbers firstImg...maxImg survive. firstImg is 2 when Candidate
 *    Info Extraction is on, because 1.png is then the candidate information page
 *    and is no longer taggable to a question.
 *  - the same image may be tagged to several questions; only repeats within a
 *    single question are collapsed. The pool is firstImg...maxImg, so the number
 *    of distinct tagged images still cannot exceed Max Images
 *
 * Returns the cleaned mapping plus everything that had to be discarded, so the
 * caller can warn the user before applying a destructive configuration change.
 */
const sanitizePredefinedMapping = (
  mapping: Record<string, number[]>,
  maxQ: number,
  maxImg: number,
  firstImg: number = 1
): { mapping: Record<string, number[]>; removedQuestions: number[]; removedImages: number[] } => {
  const cleaned: Record<string, number[]> = {};
  const removedQuestions: number[] = [];
  const removedImages: number[] = [];

  Object.keys(mapping || {})
    .map(key => ({ key, num: parseInt(key.replace(/^q/, ''), 10) }))
    .filter(q => Number.isFinite(q.num))
    .sort((a, b) => a.num - b.num)
    .forEach(({ key, num }) => {
      const images = Array.isArray(mapping[key]) ? mapping[key] : [];
      // The question slot no longer exists -> the whole row is orphaned.
      if (num < 1 || num > maxQ) {
        if (images.length) {
          removedQuestions.push(num);
          removedImages.push(...images);
        }
        return;
      }
      const kept: number[] = [];
      images.forEach(img => {
        if (!Number.isFinite(img) || img < firstImg || img > maxImg) {
          removedImages.push(img);
          return;
        }
        // A repeat inside the same question is noise, not a second tag.
        if (kept.includes(img)) return;
        kept.push(img);
      });
      if (kept.length) cleaned[key] = kept.sort((a, b) => a - b);
    });

  return {
    mapping: cleaned,
    removedQuestions,
    removedImages: Array.from(new Set(removedImages)).sort((a, b) => a - b),
  };
};

/** Message shown when a date earlier than today is entered. */
const PAST_DATE_MESSAGE = 'Please select today or a future date. Past dates are not allowed.';

/**
 * Today as yyyy-mm-dd for <input type="date"> min/value comparisons.
 * Built from the local calendar fields rather than toISOString(), which reports
 * UTC and would name yesterday or tomorrow depending on the timezone offset.
 */
const getTodayISO = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * Formats a stored date for display as DD/MM/YYYY. Display only - the value
 * sent to the API is never passed through here.
 *
 * The API answers in more than one shape, so each is read textually rather than
 * through `new Date(...)`: parsing "2026-09-08" yields UTC midnight, which is
 * the previous day in any timezone behind UTC and would show 07/09/2026.
 *   "2026-09-08"                -> 08/09/2026   (ISO, optionally with a time)
 *   "7/18/2024 11:26:35 AM"     -> 18/07/2024   (M/D/YYYY, US order)
 * Anything unrecognised falls back to Date parsing, and failing that is
 * returned untouched rather than shown as "Invalid Date".
 */
const formatDateDDMMYYYY = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (raw === '') return '';

  const pad = (n: string | number) => String(n).padStart(2, '0');

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${pad(iso[3])}/${pad(iso[2])}/${iso[1]}`;

  const slashed = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashed) return `${pad(slashed[2])}/${pad(slashed[1])}/${slashed[3]}`;

  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
  }
  return raw;
};

/**
 * The Top N / Total field starts life holding just the separator, so the
 * Numerator/Denominator shape is visible before anything is typed.
 */
const TOP_Q_DEFAULT = '/';

/** A blank field, or one still holding only the bare separator, means 'not set'. */
const isTopQUnset = (raw: unknown): boolean => {
  const value = String(raw ?? '').trim();
  return value === '' || value === TOP_Q_DEFAULT;
};

type WorkflowStageSelection = { segmentation: boolean; indexing: boolean; ocr: boolean; evaluation: boolean };

/** The four workflow stages, in pipeline order. */
const INDIVIDUAL_STAGES = ['segmentation', 'indexing', 'ocr', 'evaluation'] as const;

/** The status labels shown in the Role Management table. */
const USER_STATUS = {
  yetToBeActive: 'Yet to Active',
  active: 'Active',
  inactive: 'Inactive',
} as const;

/**
 * Parses the dates the user API returns into a local calendar date, dropping the
 * time. Read textually for the same reason as formatDateDDMMYYYY: "2026-09-08"
 * through Date() is UTC midnight, which is the previous day west of UTC.
 *   "7/18/2026 11:26:35 AM" -> 18 July 2026   (M/D/YYYY, as the API sends it)
 *   "2026-09-08"            -> 8 September 2026
 */
const parseUserDateOnly = (value: unknown): Date | null => {
  const raw = String(value ?? '').trim();
  if (raw === '') return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const slashed = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashed) return new Date(Number(slashed[3]), Number(slashed[1]) - 1, Number(slashed[2]));

  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

/** Formats a stored date as yyyy-mm-dd for an <input type="date"> value. */
const toDateInputValue = (value: unknown): string => {
  const parsed = parseUserDateOnly(value);
  if (!parsed) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
};

/**
 * Derives the status from the validity window rather than trusting the stored
 * flag, which goes stale the moment a date passes without the record being
 * touched.
 *
 *   before From Date        -> Yet to be Active
 *   From Date .. To Date    -> Active   (both ends inclusive)
 *   after To Date           -> Inactive
 *
 * Compared by calendar day, so the To Date counts in full regardless of the
 * time component the API appends. With no usable dates it falls back to the
 * stored flag, preserving the old behaviour.
 */
const resolveUserStatus = (fromDate: unknown, toDate: unknown, storedActive: unknown): string => {
  const from = parseUserDateOnly(fromDate);
  const to = parseUserDateOnly(toDate);
  if (!from && !to) {
    return String(storedActive ?? '') === '1' ? USER_STATUS.active : USER_STATUS.inactive;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (from && today < from) return USER_STATUS.yetToBeActive;
  if (to && today > to) return USER_STATUS.inactive;
  return USER_STATUS.active;
};

/** The three ways a Top N / Total entry can be wrong, phrased for the user. */
const TOP_Q_MESSAGES = {
  format: 'Please enter a valid value in the format Min Question Count/Max Question.',
  positive: 'Numerator and denominator must both be greater than zero.',
  order: 'The denominator cannot be less than the numerator.',
};

/**
 * Validates a "Top N / Total" entry, which must read as Numerator/Denominator
 * (e.g. 2/6). Both parts have to be greater than zero and the denominator may
 * not be smaller than the numerator - equal values such as 5/5 are fine, while
 * 6/2, 0/1, 1/0, 0/0, a bare number and anything non-numeric are rejected.
 *
 * An empty string means "not set" rather than "invalid": the caller clears the
 * stored override instead of blocking on it.
 *
 * Returns the message to show, or null when the value is acceptable.
 */
const validateTopQValue = (raw: string): string | null => {
  const value = (raw || '').trim();
  if (isTopQUnset(value)) return null;

  const match = value.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return TOP_Q_MESSAGES.format;

  const numerator = parseInt(match[1], 10);
  const denominator = parseInt(match[2], 10);
  if (numerator <= 0 || denominator <= 0) return TOP_Q_MESSAGES.positive;
  // Equal values are allowed (5/5): only a denominator smaller than the numerator is wrong.
  if (denominator < numerator) return TOP_Q_MESSAGES.order;
  return null;
};

/**
 * Top N / Total entry as two number boxes either side of a fixed "/", the same
 * shape as the Max Questions / Max Images pair.
 *
 * The separator is part of the layout rather than the text, so it is always on
 * screen and can never be typed, deleted or pasted over. Each box takes at most
 * 2 digits and filling the numerator jumps to the denominator, so the whole
 * value is entered without ever pressing "/" or Tab.
 *
 * It still emits the existing "N/D" string, so storage, validation and the API
 * payload are unchanged - only the way the value is typed differs.
 */
const TopQFractionInput: React.FC<{
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
  compact?: boolean;
  title?: string;
  /** An "N/D" value this field falls back to, shown greyed while the boxes are empty. */
  inherited?: string;
  /** Show the inherited value as real (muted) text until the field is focused. */
  showInherited?: boolean;
  /** Fixed denominator (Total). Given, the box is read-only and only the numerator is editable. */
  lockedTotal?: string;
}> = ({ value, onChange, invalid = false, compact = false, title, inherited, showInherited = false, lockedTotal }) => {
  const denominatorRef = React.useRef<HTMLInputElement>(null);
  const [focused, setFocused] = React.useState(false);
  const [numerator = '', denominator = ''] = String(value ?? '').split('/');
  const [inheritedNumerator = '', inheritedDenominator = ''] = String(inherited ?? '').split('/');
  // Nothing entered and not being edited: display what the subject inherits.
  // Once the user has cleared a box ("/8") the field stays empty and red, exactly
  // like the global field, instead of the inherited value reappearing in it.
  const hasNoEntry = String(value ?? '').trim() === '';
  const isShowingInherited = showInherited && !focused && hasNoEntry;
  const shownNumerator = isShowingInherited ? inheritedNumerator : numerator;
  const shownDenominator = lockedTotal ?? (isShowingInherited ? inheritedDenominator : denominator);
  const shownPlaceholder = hasNoEntry ? inherited : '';
  const [placeholderNumerator = '', placeholderDenominator = ''] = String(shownPlaceholder ?? '').split('/');

  const digitsOnly = (raw: string) => raw.replace(/\D/g, '').slice(0, 2);
  // With a fixed total, every edit keeps that denominator whatever the box holds.
  const emit = (num: string, den: string) => onChange(`${num}/${lockedTotal ?? den}`);

  const boxSize = compact ? 'w-6 text-xs' : 'w-9 text-sm';
  // One colour for the value whether it is typed or inherited, so the subject grid
  // matches the global field; the card's caption and highlight already tell an
  // inherited value from an override.
  const textTone = invalid ? 'text-red-600' : 'text-blue-700';
  // While a subject card is being edited its boxes are empty and the global value
  // shows as the placeholder; keep it in the value's colour so the card looks the
  // same as the global field instead of turning grey.
  const placeholderTone = invalid ? 'placeholder:font-bold placeholder:text-red-300' : 'placeholder:font-bold placeholder:text-blue-700';
  const shell = invalid
    ? 'border-red-400 bg-red-50'
    : 'border-blue-200 bg-white';

  return (
    <div className={`inline-flex items-center justify-center gap-0.5 rounded-md border px-1.5 py-1 transition-colors ${shell}`}>
      <input
        type="text"
        inputMode="numeric"
        value={shownNumerator}
        placeholder={placeholderNumerator}
        aria-label="Numerator"
        title={title}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const next = digitsOnly(e.target.value);
          emit(next, denominator);
          // Two digits fills the numerator, so move on without a manual Tab.
          if (!lockedTotal && next.length === 2) denominatorRef.current?.focus();
        }}
        className={`${boxSize} ${textTone} bg-transparent text-center font-bold outline-none border-0 p-0 ${placeholderTone}`}
      />
      <span className={`font-bold ${invalid ? 'text-red-400' : 'text-gray-400'}`}>/</span>
      <input
        ref={denominatorRef}
        type="text"
        inputMode="numeric"
        value={shownDenominator}
        placeholder={placeholderDenominator}
        aria-label="Denominator"
        title={lockedTotal ? `Total comes from Max Questions (${lockedTotal})` : title}
        readOnly={!!lockedTotal}
        tabIndex={lockedTotal ? -1 : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => { if (lockedTotal) return; emit(numerator, digitsOnly(e.target.value)); }}
        className={`${boxSize} ${lockedTotal ? 'text-gray-500 cursor-not-allowed' : textTone} bg-transparent text-center font-bold outline-none border-0 p-0 ${placeholderTone}`}
      />
    </div>
  );
};

type WorkflowStageKey = 'segmentation' | 'indexing' | 'ocr' | 'evaluation';

interface WorkflowCombination {
  label: string;
  stages: { segmentation: boolean; indexing: boolean; ocr: boolean; evaluation: boolean };
  /** Offered in Standalone Mode (single-stage configurations only). */
  standalone?: boolean;
  /** Offers the Image / Audio upload choice. */
  audio?: boolean;
}

/**
 * What a combination's Create Workspace dialog actually asks for, following
 * the same pipeline order `getUploadPolicy` and `questionFlowMode` check:
 * Segmentation always wins the dialog shape (PDF/ZIP of PDFs) even alongside
 * Indexing/OCR/Evaluation; Indexing on its own takes a ZIP of images; OCR
 * with neither of those takes images (plus Audio/Video when `audio` is set);
 * Evaluation on its own takes typed text with no file at all. Kept in sync
 * with docs/frontend/workflows/workflow-stage-combinations.md §3-4.
 */
const getCombinationInputType = (combo: WorkflowCombination): string => {
  if (combo.stages.segmentation) return 'PDF';
  if (combo.stages.indexing) return 'Images';
  if (combo.stages.ocr) return combo.audio ? 'Images, Audio, Video' : 'Images';
  if (combo.stages.evaluation) return 'Text';
  return '\u2014';
};

/**
 * Every stage combination an organization may run, in pipeline order. The stage
 * checkboxes validate against this list and the "View combinations" dialog lists
 * it, so what is allowed and what is shown can never drift apart.
 */
const WORKFLOW_COMBINATIONS: WorkflowCombination[] = [
  {
    label: 'Segmentation only',
    stages: { segmentation: true, indexing: false, ocr: false, evaluation: false },
    standalone: true,
  },
  {
    label: 'Segmentation + Indexing',
    stages: { segmentation: true, indexing: true, ocr: false, evaluation: false },
  },
  {
    label: 'Segmentation + Indexing + OCR',
    stages: { segmentation: true, indexing: true, ocr: true, evaluation: false },
  },
  {
    label: 'Segmentation + Indexing + OCR + Evaluation',
    stages: { segmentation: true, indexing: true, ocr: true, evaluation: true },
  },
  {
    label: 'Indexing only',
    stages: { segmentation: false, indexing: true, ocr: false, evaluation: false },
    standalone: true,
  },
  {
    label: 'Indexing + OCR',
    stages: { segmentation: false, indexing: true, ocr: true, evaluation: false },
  },
  {
    label: 'Indexing + OCR + Evaluation',
    stages: { segmentation: false, indexing: true, ocr: true, evaluation: true },
  },
  {
    label: 'OCR only',
    stages: { segmentation: false, indexing: false, ocr: true, evaluation: false },
    standalone: true,
    audio: true,
  },
  {
    label: 'OCR + Evaluation',
    stages: { segmentation: false, indexing: false, ocr: true, evaluation: true },
    audio: true,
  },
  {
    label: 'Evaluation only',
    stages: { segmentation: false, indexing: false, ocr: false, evaluation: true },
    standalone: true,
  },
];

const WORKFLOW_STAGE_ORDER: WorkflowStageKey[] = ['segmentation', 'indexing', 'ocr', 'evaluation'];
const WORKFLOW_STAGE_STYLE: Record<WorkflowStageKey, { label: string; chip: string }> = {
  segmentation: { label: 'Segmentation', chip: 'bg-orange-50 text-orange-700 border-orange-200' },
  indexing: { label: 'Indexing', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  ocr: { label: 'OCR', chip: 'bg-purple-50 text-purple-700 border-purple-200' },
  evaluation: { label: 'Evaluation', chip: 'bg-teal-50 text-teal-700 border-teal-200' },
};

const SettingsSection: React.FC<{
  API_BASE1: string;
  yearCode: string;
  cycleCode: string;
  yearCycleSelector: React.ReactNode;
  /** Told about the workflow stages whenever they change, for the sidebar. */
  onStagesChange?: (stages: { segmentation: boolean; indexing: boolean; ocr: boolean; evaluation: boolean }) => void;
}> = ({ API_BASE1, yearCode, cycleCode, yearCycleSelector, onStagesChange }) => {
  const loggedInRole = typeof window !== 'undefined' ? (sessionStorage.getItem('userRole') || 'superadmin').toLowerCase() : 'superadmin';
  const isAdmin = loggedInRole === 'admin';

  const [selectedCustomer, setSelectedCustomer] = React.useState("ICME");
  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = React.useState<string>("");
  const [loadingOrgs, setLoadingOrgs] = React.useState(true);
  const [loadingSettings, setLoadingSettings] = React.useState(false);

  // Subjects
  const [subjects, setSubjects] = React.useState<any[]>([]);
  const [loadingSubjects, setLoadingSubjects] = React.useState(false);

  React.useEffect(() => {
    const fetchOrganizations = async () => {
      setLoadingOrgs(true);
      try {
        const response = await fetch(`${API_BASE1}/organization-details?CustCode=${selectedCustomer || 'ICME'}`);
        if (!response.ok) throw new Error('Failed to fetch organizations');
        const data = await response.json();
        const orgData = data.data || data || [];
        setOrganizations(orgData);
        if (orgData.length > 0) {
          const defaultOrg = String(orgData[0].organizationid);
          const defaultOrgCode = orgData[0].organizationcode;
          setSelectedOrg(defaultOrg);

          await fetchSubjects(defaultOrgCode);
          loadSettings(defaultOrgCode);
        }
      } catch (error) {
        console.error('Error fetching organizations:', error);
      } finally {
        setLoadingOrgs(false);
      }
    };
    fetchOrganizations();
  }, [API_BASE1, selectedCustomer]);

  // Settings states
  const [passMark, setPassMark] = React.useState<string>('');
  // While a subject pass-mark field is being edited it shows what the user typed,
  // including an empty field after Backspace. Outside editing it falls back to the
  // subject's own value, or to the global pass mark when it has none.
  const [passMarkDrafts, setPassMarkDrafts] = React.useState<Record<string, string>>({});
  const setPassMarkDraft = (subjectCode: string, value: string | null) =>
    setPassMarkDrafts(prev => {
      const next = { ...prev };
      if (value === null) delete next[subjectCode];
      else next[subjectCode] = value;
      return next;
    });
  const [topQuestionsCount, setTopQuestionsCount] = React.useState<string>(TOP_Q_DEFAULT);
  const [topQError, setTopQError] = React.useState<string | null>(null);
  // Per-subject Top N / Total state for the "Subject wise change" grid. Drafts
  // keep what was typed on screen even when it is too invalid to persist, so
  // the field never fights the user by snapping back to the stored value.
  const [topQSubjectErrors, setTopQSubjectErrors] = React.useState<Record<string, string>>({});
  const [topQSubjectDrafts, setTopQSubjectDrafts] = React.useState<Record<string, string>>({});
  const [standardsCount, setStandardsCount] = React.useState<string>('');

  // Subject toggles
  const [isPassMarkSubjectSpecific, setIsPassMarkSubjectSpecific] = React.useState(false);
  const [passMarkSubjectCode, setPassMarkSubjectCode] = React.useState<string>('');

  const [isTopQSubjectSpecific, setIsTopQSubjectSpecific] = React.useState(false);
  const [topQSubjectCode, setTopQSubjectCode] = React.useState<string>('');

  const [isStandardsSubjectSpecific, setIsStandardsSubjectSpecific] = React.useState(false);
  const [standardsSubjectCode, setStandardsSubjectCode] = React.useState<string>('');
  const [isStandardsGlobalOn, setIsStandardsGlobalOn] = React.useState(false);
  // Asked for once Standards Met Count is on: whether the Evaluation workflow is
  // gated on a threshold score, and the OCR threshold it is gated on. 80 unless
  // the organization changes it.
  const [isThresholdDependent, setIsThresholdDependent] = React.useState(false);
  const [ocrThreshold, setOcrThreshold] = React.useState<string>(DEFAULT_THRESHOLD);
  const [isStandardsSubjectOn, setIsStandardsSubjectOn] = React.useState(false);
  const [isStandardsExpanded, setIsStandardsExpanded] = React.useState(false);

  // Candidate Info Extraction (Indexing) state
  const [isCandidateInfoGlobalOn, setIsCandidateInfoGlobalOn] = React.useState(false);

  // OCR Config State
  // Metadata
  const [isMetadataSubjectSpecific, setIsMetadataSubjectSpecific] = React.useState(false);
  const [metadataSubjectCode, setMetadataSubjectCode] = React.useState<string>('');
  const [isMetadataGlobalOn, setIsMetadataGlobalOn] = React.useState(false);
  const [isMetadataSubjectOn, setIsMetadataSubjectOn] = React.useState(false);
  const [isMetadataExpanded, setIsMetadataExpanded] = React.useState(false);
  const [isMetadataAllSubjectsOn, setIsMetadataAllSubjectsOn] = React.useState(false);
  // Question Number Extraction
  const [isQNumSubjectSpecific, setIsQNumSubjectSpecific] = React.useState(false);
  const [qNumSubjectCode, setQNumSubjectCode] = React.useState<string>('');
  const [isQNumGlobalOn, setIsQNumGlobalOn] = React.useState(false);
  const [isQNumSubjectOn, setIsQNumSubjectOn] = React.useState(false);
  const [isQNumExpanded, setIsQNumExpanded] = React.useState(false);
  const [isQNumAllSubjectsOn, setIsQNumAllSubjectsOn] = React.useState(false);

  const [isPassMarkExpanded, setIsPassMarkExpanded] = React.useState(false);
  const [isTopQExpanded, setIsTopQExpanded] = React.useState(false);
  const [predefinedMapping, setPredefinedMapping] = React.useState<Record<string, number[]>>({});
  const [isPredefinedExpanded, setIsPredefinedExpanded] = React.useState(false);
  const [predefinedMaxQuestions, setPredefinedMaxQuestions] = React.useState<number | string>(8);
  const [predefinedMaxImages, setPredefinedMaxImages] = React.useState<number | string>(12);
  // Extension of the page images the predefined mapping refers to (1.png / 1.jpg).
  const [predefinedImageFormat, setPredefinedImageFormat] = React.useState<'png' | 'jpg'>('png');
  // A flexible script maps no pages in advance, so the only thing to ask for is
  // how many questions it can hold. Ten unless the organization changes it.
  const [flexibleMaxQuestions, setFlexibleMaxQuestions] = React.useState<number | string>(10);
  const [openDropdownQNum, setOpenDropdownQNum] = React.useState<number | null>(null);

  // Prompt Selection State
  const [isPromptSubjectSpecific, setIsPromptSubjectSpecific] = React.useState(false);
  const [promptSubjectCode, setPromptSubjectCode] = React.useState<string>('');
  const [selectedPrompt, setSelectedPrompt] = React.useState<string>('generic');
  const [isPromptExpanded, setIsPromptExpanded] = React.useState(false);

  const [isReevalAgentExpanded, setIsReevalAgentExpanded] = React.useState(false);
  const [isReevalAgentGlobalOn, setIsReevalAgentGlobalOn] = React.useState(false);
  const [isReevalAgentSubjectSpecific, setIsReevalAgentSubjectSpecific] = React.useState(false);
  const [isReevalAgentSubjectOn, setIsReevalAgentSubjectOn] = React.useState(false);
  const [isReevalAgentAllSubjectsOn, setIsReevalAgentAllSubjectsOn] = React.useState(false);
  const [reevalAgentSubjectCode, setReevalAgentSubjectCode] = React.useState<string>('');
  const [previewRefreshKey, setPreviewRefreshKey] = React.useState(0);

  const [answerScriptType, setAnswerScriptType] = React.useState<string>('flexible');
  // Default for an organization with nothing saved yet: Segmentation alone.
  const DEFAULT_STAGES = { segmentation: true, indexing: false, ocr: false, evaluation: false };
  const [selectedStages, setSelectedStages] = React.useState<{ segmentation: boolean, indexing: boolean, ocr: boolean, evaluation: boolean }>({ ...DEFAULT_STAGES });

  // This section is the only place the stages can be changed, and the sidebar
  // outside it keys the Subject & Question item off Evaluation. The flag is also
  // persisted, because the sidebar is there before this section is ever opened.
  React.useEffect(() => {
    localStorage.setItem('stage_evaluation_on', selectedStages.evaluation ? '1' : '0');
    onStagesChange?.(selectedStages);
  }, [selectedStages, onStagesChange]);

  // Standalone Mode: hides Subject Dashboard, removes subject selectors/confirmation,
  // shows only Q1/Q2/Q3 labels, and suppresses the Evaluation workflow UI.
  const [isStandaloneMode, setIsStandaloneMode] = React.useState(false);
  // Standalone OCR only: whether evaluators upload answer images or audio recordings.
  const [standaloneInputType, setStandaloneInputType] = React.useState<'image' | 'audio' | 'video'>('image');
  // "View combinations" dialog in the Workflow Configuration header.
  const [showCombinationsDialog, setShowCombinationsDialog] = React.useState(false);

  // Cycle Configuration: how many cycles this organization's year is split
  // into - Annual (1), Semi-Annual (2) or Quarterly (4). Quarterly is the
  // default so an organization with nothing saved yet keeps today's behavior
  // (every org currently gets up to 4 cycles).
  const CYCLE_TYPE_COUNT: Record<'annual' | 'semiannual' | 'quarterly', number> = {
    annual: 1,
    semiannual: 2,
    quarterly: 4,
  };
  const [cycleType, setCycleType] = React.useState<'annual' | 'semiannual' | 'quarterly'>('quarterly');

  // Candidate Info Extraction belongs to Segmentation and Indexing, so it is cleared
  // once a change leaves neither of them on - the rule the stage checkboxes already
  // follow, applied here to changes Standalone Mode makes too.
  const resetCandidateInfoIfStageDropped = (prev: WorkflowStageSelection, next: WorkflowStageSelection) => {
    const dropped = (prev.segmentation || prev.indexing) && !(next.segmentation || next.indexing);
    if (!dropped) return;
    setIsCandidateInfoGlobalOn(false);
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (org) {
      localStorage.removeItem(`org_seg_candidateinfo_${org.organizationcode}`);
    }
  };

  // Standards Met Count and Candidate Info Extraction are both hidden in Standalone
  // Mode (it runs a single raw stage with no candidate-info page and no standards
  // scoring), so turning it on forces both off the same way resetCandidateInfoIfStageDropped
  // clears Candidate Info when its stage is dropped.
  React.useEffect(() => {
    if (!isStandaloneMode) return;
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (isStandardsGlobalOn) {
      setIsStandardsGlobalOn(false);
      if (org) localStorage.setItem(`org_standards_count_${org.organizationcode}`, '0');
    }
    if (isCandidateInfoGlobalOn) {
      setIsCandidateInfoGlobalOn(false);
      if (org) localStorage.removeItem(`org_seg_candidateinfo_${org.organizationcode}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStandaloneMode, isStandardsGlobalOn, isCandidateInfoGlobalOn, selectedOrg]);

  // Candidate Info Extraction claims 1.png as the candidate information page, so
  // that image stops being taggable to a question. Everything downstream asks
  // firstTaggableImage() rather than hard-coding 1, so flipping the toggle
  // re-shapes the tagging UI immediately with no reload.
  // Predefined answer scripts fix the number of questions, so Top N counts out of
  // Max Questions: the Total box is read-only and follows that value.
  // Max Questions is only asked for on a flexible script, and not when the
  // Evaluation stage is selected.
  const showFlexibleMaxQuestions =
    selectedStages.indexing && answerScriptType === 'flexible' && !selectedStages.evaluation;

  const predefinedQuestionTotal =
    answerScriptType === 'predefined' && selectedStages.indexing
      ? String(parseInt(String(predefinedMaxQuestions)) || '')
      : '';

  // Keep the global Top N on that total, defaulting the numerator to it (all questions
  // counted) and never letting it exceed the total.
  React.useEffect(() => {
    if (!predefinedQuestionTotal) return;
    const total = Number(predefinedQuestionTotal);
    if (!Number.isFinite(total) || total <= 0) return;
    setTopQuestionsCount(prev => {
      const [rawNumerator = ''] = String(prev ?? '').split('/');
      const numerator = Number(rawNumerator);
      const nextNumerator = Number.isFinite(numerator) && numerator > 0 ? Math.min(numerator, total) : total;
      const next = `${nextNumerator}/${total}`;
      return next === prev ? prev : next;
    });
  }, [predefinedQuestionTotal]);

  // Same clamp for every subject's own Top N override: the Total box always
  // follows Max Questions (lockedTotal), so a numerator saved before Max
  // Questions shrank must come down to match rather than sit invalid.
  React.useEffect(() => {
    if (!predefinedQuestionTotal) return;
    const total = Number(predefinedQuestionTotal);
    if (!Number.isFinite(total) || total <= 0) return;
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (!org) return;
    let changed = false;
    subjects.forEach(s => {
      const key = `org_top_questions_${org.organizationcode}_${s.subjectcode}`;
      const stored = localStorage.getItem(key);
      if (!stored) return;
      const [rawNumerator = ''] = stored.split('/');
      const numerator = Number(rawNumerator);
      if (Number.isFinite(numerator) && numerator > total) {
        localStorage.setItem(key, `${total}/${total}`);
        changed = true;
      }
    });
    if (changed) setSubjects([...subjects]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predefinedQuestionTotal, subjects, organizations, selectedOrg]);

  // Standalone Mode does not tag pages to questions in advance, so its answer
  // script is Flexible and Predefined is not offered.
  const lockAnswerScriptToFlexible = isStandaloneMode && selectedStages.indexing;

  // Turning Standalone Mode on selects Flexible, so what is saved matches what
  // is shown even if the organization was on Predefined beforehand.
  React.useEffect(() => {
    if (lockAnswerScriptToFlexible && answerScriptType !== 'flexible') {
      setAnswerScriptType('flexible');
    }
  }, [lockAnswerScriptToFlexible, answerScriptType]);

  // Standalone Mode needs exactly one of Segmentation / Indexing / OCR / Evaluation;
  // any other selection hides the toggle entirely.
  const isSingleIndividualStage =
    INDIVIDUAL_STAGES.filter(stage => selectedStages[stage]).length === 1;

  // Standalone Mode is not a choice any more: a single stage runs standalone, and
  // anything else runs the standard flow. It follows the stage selection here,
  // which is why no toggle for it is offered anywhere in the UI.
  React.useEffect(() => {
    setIsStandaloneMode(isSingleIndividualStage);
    // Written straight away, not only on Save, so anything reading it
    // synchronously sees the current mode.
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (org) localStorage.setItem(`org_standalone_${org.organizationcode}`, isSingleIndividualStage ? '1' : '0');
    localStorage.setItem('standalone_mode', isSingleIndividualStage ? '1' : '0');
  }, [isSingleIndividualStage, organizations, selectedOrg]);

  // Candidate Info Extraction applies to Segmentation and to Indexing: it decides
  // whether the first page of a script is the candidate information page.
  const candidateInfoStageOn = selectedStages.segmentation || selectedStages.indexing;
  const candidateInfoActive = candidateInfoStageOn && isCandidateInfoGlobalOn;
  const firstTaggableImage = () => (candidateInfoActive ? 2 : 1);
  // With Candidate Info on, 1.png is the candidate information page, so a single
  // image would leave nothing to tag - Max Images then starts at 2.
  const minPredefinedImages = candidateInfoActive ? 2 : 1;
  const maxImagesError = (Number(predefinedMaxImages) || 0) > 0 && (Number(predefinedMaxImages) || 0) < minPredefinedImages
    ? 'Max Images must be at least 2 while Candidate Info Extraction is on, because 1.png is the Candidate Info page.'
    : '';

  // A Max Questions / Max Images change that would invalidate existing tags is
  // parked here until the user confirms the removal in the warning dialog.
  const [pendingPredefinedConfig, setPendingPredefinedConfig] = React.useState<{
    field: 'questions' | 'images';
    value: number;
    mapping: Record<string, number[]>;
    removedQuestions: number[];
    removedImages: number[];
  } | null>(null);

  /**
   * The mapping panel follows the structure choice: Predefined (the toggle in its
   * off position) opens it, Flexible closes it.
   *
   * This is driven off answerScriptType rather than the toggle's click handler so
   * it covers every route that sets the type - the toggle, the backend config load
   * and the localStorage load - which is why an org saved as Predefined now shows
   * its mapping immediately instead of waiting for a click.
   *
   * It keys on answerScriptType alone, so a manual "Hide Mapping Details" sticks
   * until the structure is switched again.
   */
  React.useEffect(() => {
    setIsPredefinedExpanded(answerScriptType === 'predefined');
  }, [answerScriptType]);

  const applyPredefinedConfig = (
    field: 'questions' | 'images',
    value: number,
    mapping: Record<string, number[]>
  ) => {
    if (field === 'questions') setPredefinedMaxQuestions(value);
    else setPredefinedMaxImages(value);
    setPredefinedMapping(mapping);
    setOpenDropdownQNum(null);
  };

  // Recalculates the mapping for a new Max Questions / Max Images value. Applies it
  // immediately when nothing is lost, otherwise parks it for confirmation so the
  // user is never silently stripped of tags they already made.
  const requestPredefinedConfigChange = (field: 'questions' | 'images', raw: string) => {
    if (raw === '') {
      // Allow the field to be cleared while typing; validation happens on the next value.
      if (field === 'questions') setPredefinedMaxQuestions('');
      else setPredefinedMaxImages('');
      return;
    }
    // Both fields accept any whole number from 1; a value the configuration does
    // not allow (Max Images 1 while Candidate Info is on) is kept on screen and
    // reported under the field instead of being raised behind the user's back.
    const value = Math.max(1, parseInt(raw, 10) || 1);
    const nextQ = field === 'questions' ? value : (parseInt(String(predefinedMaxQuestions)) || 1);
    const nextImg = field === 'images' ? value : (parseInt(String(predefinedMaxImages)) || 1);
    const result = sanitizePredefinedMapping(predefinedMapping, nextQ, nextImg, firstTaggableImage());
    if (!result.removedQuestions.length && !result.removedImages.length) {
      applyPredefinedConfig(field, value, result.mapping);
      return;
    }
    setPendingPredefinedConfig({ field, value, ...result });
  };

  const confirmPredefinedConfigChange = () => {
    if (!pendingPredefinedConfig) return;
    const { field, value, mapping, removedImages } = pendingPredefinedConfig;
    applyPredefinedConfig(field, value, mapping);
    setPendingPredefinedConfig(null);
    toast.success(`Configuration updated - ${removedImages.length} image tag${removedImages.length === 1 ? '' : 's'} removed`);
  };

  // Tags or untags one image on one question. The same image may be tagged to
  // any number of questions, so this only ever touches the question it was
  // clicked on and leaves every other question's tags alone.
  const toggleImageForQuestion = (qNum: number, imgNum: number) => {
    setPredefinedMapping(prev => {
      const key = `q${qNum}`;
      const current = prev[key] || [];
      const next: Record<string, number[]> = { ...prev };
      if (current.includes(imgNum)) {
        const remaining = current.filter(n => n !== imgNum);
        if (remaining.length) next[key] = remaining; else delete next[key];
      } else {
        next[key] = [...current, imgNum].sort((a, b) => a - b);
      }
      return next;
    });
  };

  // Turning Candidate Info on mid-session must drop every existing 1.png tag
  // right away - it can be held by several questions at once - so the grid never
  // shows a mapping the configuration no longer allows.
  React.useEffect(() => {
    if (!candidateInfoActive) return;
    const holders = Object.keys(predefinedMapping).filter(k => (predefinedMapping[k] || []).includes(1));
    if (!holders.length) return;
    setPredefinedMapping(prev => {
      const next = { ...prev };
      holders.forEach(key => {
        const remaining = (next[key] || []).filter(n => n !== 1);
        if (remaining.length) next[key] = remaining; else delete next[key];
      });
      return next;
    });
  }, [candidateInfoActive, predefinedMapping]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as Element).closest('.q-dropdown-container')) {
        setOpenDropdownQNum(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // fetchSubjects uses yearCode/cycleCode passed from the parent header dropdowns.
  const fetchSubjects = async (orgCode: string) => {
    setLoadingSubjects(true);
    try {
      if (!yearCode || !cycleCode) {
        setSubjects([]);
        setPassMarkSubjectCode(''); setTopQSubjectCode(''); setStandardsSubjectCode(''); setMetadataSubjectCode(''); setQNumSubjectCode('');
        toast.error('No Year/Cycle available to load subjects.');
        return;
      }
      const userCode = (sessionStorage.getItem('userCode') || sessionStorage.getItem('username') || '').replace(/\x00/g, '');
      const params = new URLSearchParams({
        orgCode, custCode: 'ICME', yearCode, cycleCode, userCode,
      });
      const response = await fetch(`${API_BASE1}/get-subject-data?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch subjects');
      const data = await response.json();
      const subjectData = data.data || data || [];
      // Only subjects the API reports as active belong in these pickers: status 0
      // is inactive and must not be offered. A missing status counts as active,
      // the same assumption the other subject lists on this page make.
      const activeSubjects = Array.isArray(subjectData)
        ? subjectData.filter((item: any) => Number(item?.status ?? 1) === 1)
        : [];
      setSubjects(activeSubjects);

      if (activeSubjects.length > 0) {
        setPassMarkSubjectCode(activeSubjects[0].subjectcode);
        setTopQSubjectCode(activeSubjects[0].subjectcode);
        setStandardsSubjectCode(activeSubjects[0].subjectcode);
        setMetadataSubjectCode(activeSubjects[0].subjectcode);
        setQNumSubjectCode(activeSubjects[0].subjectcode);
      } else {
        setPassMarkSubjectCode('');
        setTopQSubjectCode('');
        setStandardsSubjectCode('');
        setMetadataSubjectCode('');
        setQNumSubjectCode('');
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast.error('Failed to load subjects');
    } finally {
      setLoadingSubjects(false);
    }
  };

  const loadSettings = React.useCallback(async (orgCode: string, passSubjCode?: string, topQSubjCode?: string, stdSubjCode?: string) => {
    setLoadingSettings(true);
    try {
      const response = await fetch(`${API_BASE1}/get-config-info?OrgCode=${orgCode}&CustCode=${selectedCustomer}&AppCode=AImarking`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0 && data[0].configSetting) {
          const config = data[0].configSetting;
          
          if (config.ocrConfig) {
             setIsMetadataGlobalOn(!!config.ocrConfig.MetadataPresent);
             setIsStandardsGlobalOn(!!config.ocrConfig.StandardsMetCount);
             setIsQNumGlobalOn(!!config.ocrConfig.QuestionNumberExtraction);
             setIsThresholdDependent(!!config.ocrConfig.ThresholdDependent);
             setOcrThreshold(String(config.ocrConfig.Thresholds?.ocr ?? DEFAULT_THRESHOLD));
          }
          if (config.indexingConfig) {
             setAnswerScriptType(config.indexingConfig.type || 'flexible');
             setFlexibleMaxQuestions(
               Number(config.indexingConfig.flexibleSettings?.maxQuestions) || 10
             );
             if (config.indexingConfig.predefinedSettings) {
                const savedMaxQ = config.indexingConfig.predefinedSettings.maxQuestions || 1;
                const savedMaxImg = config.indexingConfig.predefinedSettings.maxImages || 1;
                setPredefinedMaxImages(savedMaxImg);
                setPredefinedMaxQuestions(savedMaxQ);
                setPredefinedImageFormat(config.indexingConfig.predefinedSettings.imageFormat === 'jpg' ? 'jpg' : 'png');
                // Drop anything the saved configuration can no longer accommodate.
                setPredefinedMapping(
                  sanitizePredefinedMapping(config.indexingConfig.predefinedSettings.mapping || {}, savedMaxQ, savedMaxImg).mapping
                );
             }
          }
          if (config.workflowStages) {
             setSelectedStages(config.workflowStages);
          }
          if (config.standalone !== undefined) {
             setIsStandaloneMode(!!config.standalone);
             localStorage.setItem('standalone_mode', config.standalone ? '1' : '0');
          }
          setCycleType(
            config.cycleType === 'annual' || config.cycleType === 'semiannual' || config.cycleType === 'quarterly'
              ? config.cycleType
              : 'quarterly'
          );
          // Always set, so a previous organization's choice never carries over.
          setStandaloneInputType(
            config.standaloneInputType === 'audio' || config.standaloneInputType === 'video'
              ? config.standaloneInputType
              : 'image'
          );
          if (config.evaluationConfig && config.evaluationConfig.globalThresholds) {
             setPassMark(config.evaluationConfig.globalThresholds.passMarkThreshold?.toString() || '40');
             setTopQuestionsCount(config.evaluationConfig.globalThresholds.topQuestionsCount?.toString() || '5/8');
             setSelectedPrompt(config.evaluationConfig.globalThresholds.selectedPrompt || 'generic');
             setIsReevalAgentGlobalOn(!!config.evaluationConfig.globalThresholds.liveEvaluationAgentEnabled);
          }
          if (config.segmentationConfig && config.segmentationConfig.CandidateInfo !== undefined) {
             setIsCandidateInfoGlobalOn(!!config.segmentationConfig.CandidateInfo);
          } else if (config.indexingConfig && config.indexingConfig.CandidateInfo !== undefined) {
             setIsCandidateInfoGlobalOn(!!config.indexingConfig.CandidateInfo);
          } else if (config.CandidateInfo !== undefined) {
             setIsCandidateInfoGlobalOn(!!config.CandidateInfo);
          }
          
          // Clear existing overrides for this org from localStorage before repopulating
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
              key.startsWith(`org_pass_mark_${orgCode}_`) || 
              key.startsWith(`org_top_questions_${orgCode}_`) || 
              key.startsWith(`org_prompt_${orgCode}_`) || 
              key.startsWith(`org_reeval_agent_${orgCode}_`) ||
              key.startsWith(`org_standards_count_${orgCode}_`) ||
              key.startsWith(`org_ocr_metadata_${orgCode}_`) ||
              key.startsWith(`org_ocr_qnum_${orgCode}_`)
            )) {
                keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));

          if (config.evaluationConfig && config.evaluationConfig.subjectOverrides) {
             config.evaluationConfig.subjectOverrides.forEach((override: any) => {
                 const sc = override.subjectCode;
                 if (!sc) return;
                 if (override.passMarkThreshold !== undefined) {
                     localStorage.setItem(`org_pass_mark_${orgCode}_${sc}`, override.passMarkThreshold.toString());
                 }
                 if (override.topQuestionsCount !== undefined) {
                     localStorage.setItem(`org_top_questions_${orgCode}_${sc}`, override.topQuestionsCount.toString());
                 }
                 if (override.selectedPrompt !== undefined) {
                     localStorage.setItem(`org_prompt_${orgCode}_${sc}`, override.selectedPrompt.toString());
                 }
                 if (override.liveEvaluationAgentEnabled !== undefined) {
                     localStorage.setItem(`org_reeval_agent_${orgCode}_${sc}`, override.liveEvaluationAgentEnabled ? '1' : '0');
                 }
             });
          }

          if (config.ocrConfig && config.ocrConfig.subjectOverrides) {
             config.ocrConfig.subjectOverrides.forEach((override: any) => {
                 const sc = override.subjectCode;
                 if (!sc) return;
                 if (override.StandardsMetCount !== undefined) {
                     localStorage.setItem(`org_standards_count_${orgCode}_${sc}`, override.StandardsMetCount ? '1' : '0');
                 }
                 if (override.MetadataPresent !== undefined) {
                     localStorage.setItem(`org_ocr_metadata_${orgCode}_${sc}`, override.MetadataPresent ? '1' : '0');
                 }
                 if (override.QuestionNumberExtraction !== undefined) {
                     localStorage.setItem(`org_ocr_qnum_${orgCode}_${sc}`, override.QuestionNumberExtraction ? '1' : '0');
                 }
             });
          }

          setSubjects(prev => [...prev]); // Force re-render

          // Return early so we don't overwrite with local storage if API succeeds
          setLoadingSettings(false);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to fetch from get-config-info API, falling back to local storage', e);
    }

    // Pass Mark Load
    const actualPassSubjCode = passSubjCode || passMarkSubjectCode;
    const passKey = isPassMarkSubjectSpecific && actualPassSubjCode ? `org_pass_mark_${orgCode}_${actualPassSubjCode}` : `org_pass_mark_${orgCode}`;
    setPassMark(localStorage.getItem(passKey) || '40');

    // Top Q Load
    const actualTopQSubjCode = topQSubjCode || topQSubjectCode;
    const topQKey = isTopQSubjectSpecific && actualTopQSubjCode ? `org_top_questions_${orgCode}_${actualTopQSubjCode}` : `org_top_questions_${orgCode}`;
    setTopQuestionsCount(localStorage.getItem(topQKey) || '5/8');

    // AI Prompt Load
    const promptKey = `org_prompt_${orgCode}`;
    setSelectedPrompt(localStorage.getItem(promptKey) || 'generic');

    // Standards Met Load Global
    const globalStdKey = `org_standards_count_${orgCode}`;
    setIsStandardsGlobalOn(localStorage.getItem(globalStdKey) === '1');

    // Threshold dependency + the OCR threshold score
    setIsThresholdDependent(localStorage.getItem(`org_threshold_dependent_${orgCode}`) === '1');
    setOcrThreshold(localStorage.getItem(`org_ocr_threshold_${orgCode}`) || DEFAULT_THRESHOLD);

    // Standards Met Load Subject Specific
    const actualStdSubjCode = stdSubjCode || standardsSubjectCode;
    const stdKey = isStandardsSubjectSpecific && actualStdSubjCode ? `org_standards_count_${orgCode}_${actualStdSubjCode}` : `org_standards_count_${orgCode}`;
    setIsStandardsSubjectOn(localStorage.getItem(stdKey) === '1');

    // Metadata OCR Load
    const globalMetaKey = `org_ocr_metadata_${orgCode}`;
    setIsMetadataGlobalOn(localStorage.getItem(globalMetaKey) === '1');
    const actualMetaSubjCode = metadataSubjectCode;
    const metaKey = isMetadataSubjectSpecific && actualMetaSubjCode ? `org_ocr_metadata_${orgCode}_${actualMetaSubjCode}` : `org_ocr_metadata_${orgCode}`;
    setIsMetadataSubjectOn(localStorage.getItem(metaKey) === '1');

    // Question Number Extraction OCR Load
    const globalQNumKey = `org_ocr_qnum_${orgCode}`;
    setIsQNumGlobalOn(localStorage.getItem(globalQNumKey) === '1');
    const actualQNumSubjCode = qNumSubjectCode;
    const qNumKey = isQNumSubjectSpecific && actualQNumSubjCode ? `org_ocr_qnum_${orgCode}_${actualQNumSubjCode}` : `org_ocr_qnum_${orgCode}`;
    setIsQNumSubjectOn(localStorage.getItem(qNumKey) === '1');

    // Candidate Info Extraction Load
    const globalCandidateInfoKey = `org_seg_candidateinfo_${orgCode}`;
    setIsCandidateInfoGlobalOn(localStorage.getItem(globalCandidateInfoKey) === '1');

    // Answer Script Load
    // Predefined Mapping Load
    const predefinedConfigRaw = localStorage.getItem(`org_predefined_mapping_${orgCode}`);
    if (predefinedConfigRaw) {
      try {
        const data = JSON.parse(predefinedConfigRaw);
        const savedMaxQ = data.maxQuestions || 1;
        const savedMaxImg = data.maxImages || 1;
        setPredefinedMaxQuestions(savedMaxQ);
        setPredefinedMaxImages(savedMaxImg);
        setPredefinedImageFormat(data.imageFormat === 'jpg' ? 'jpg' : 'png');
        // Drop anything the saved configuration can no longer accommodate.
        setPredefinedMapping(sanitizePredefinedMapping(data.mapping || {}, savedMaxQ, savedMaxImg).mapping);
      } catch (e) { }
    } else {
      setPredefinedMapping({});
      setPredefinedMaxQuestions(8);
      setPredefinedMaxImages(12);
      setPredefinedImageFormat('png');
    }

    const scriptTypeKey = `org_answer_script_type_${orgCode}`;
    setAnswerScriptType(localStorage.getItem(scriptTypeKey) || 'flexible');

    const flexibleMaxQKey = `org_flexible_max_questions_${orgCode}`;
    setFlexibleMaxQuestions(parseInt(localStorage.getItem(flexibleMaxQKey) || '') || 10);

    // Selected Stages Load
    const stagesKey = `org_selected_stages_${orgCode}`;
    const storedStages = localStorage.getItem(stagesKey);
    if (storedStages) {
      try { setSelectedStages(JSON.parse(storedStages)); } catch (e) { }
    } else {
      setSelectedStages({ ...DEFAULT_STAGES });
    }

    // Standalone Mode Load (localStorage fallback)
    const standaloneKey = `org_standalone_${orgCode}`;
    const storedStandalone = localStorage.getItem(standaloneKey);
    const standaloneVal = storedStandalone === '1';
    setIsStandaloneMode(standaloneVal);
    localStorage.setItem('standalone_mode', standaloneVal ? '1' : '0');
    setStandaloneInputType(localStorage.getItem(`org_standalone_input_${orgCode}`) === 'audio' ? 'audio' : 'image');

    // Cycle Type Load (localStorage fallback)
    const storedCycleType = localStorage.getItem(`org_cycle_type_${orgCode}`);
    setCycleType(storedCycleType === 'annual' || storedCycleType === 'semiannual' ? storedCycleType : 'quarterly');

    setLoadingSettings(false);
  }, [isPassMarkSubjectSpecific, passMarkSubjectCode, isTopQSubjectSpecific, topQSubjectCode, isStandardsSubjectSpecific, standardsSubjectCode]);

  React.useEffect(() => {
    if (selectedOrg && organizations.length > 0) {
      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
      if (org) {
        loadSettings(org.organizationcode);
      }
    }
  }, [isPassMarkSubjectSpecific, passMarkSubjectCode, isTopQSubjectSpecific, topQSubjectCode, isStandardsSubjectSpecific, standardsSubjectCode, loadSettings, selectedOrg, organizations]);



  const handleOrgChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOrgId = e.target.value;
    setSelectedOrg(newOrgId);
    const org = organizations.find(o => String(o.organizationid) === newOrgId);
    if (org) {
      await fetchSubjects(org.organizationcode);
      // loadSettings is called by useEffect
    }
  };

  const handleSavePassMark = (silent = false) => {
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (!org) return;
    const parsedMark = parseFloat(passMark);
    if (isNaN(parsedMark) || parsedMark < 0 || parsedMark > 100) {
      if (!silent) toast.error('Please enter a valid pass mark between 0 and 100');
      return;
    }
    const passKey = isPassMarkSubjectSpecific && passMarkSubjectCode ? `org_pass_mark_${org.organizationcode}_${passMarkSubjectCode}` : `org_pass_mark_${org.organizationcode}`;
    localStorage.setItem(passKey, parsedMark.toString());
    if (!silent) toast.success(`Pass mark saved ${isPassMarkSubjectSpecific ? 'for subject' : 'globally'}`);
    setPreviewRefreshKey(prev => prev + 1);
  };

  const handleSaveTopQ = (silent = false) => {
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (!org) return;
    const topQKey = isTopQSubjectSpecific && topQSubjectCode ? `org_top_questions_${org.organizationcode}_${topQSubjectCode}` : `org_top_questions_${org.organizationcode}`;
    if (!isTopQUnset(topQuestionsCount)) {
      const val = topQuestionsCount.trim();
      // Only a valid Numerator/Denominator entry may be persisted.
      const validationError = validateTopQValue(val);
      if (validationError) {
        setTopQError(validationError);
        if (!silent) toast.error(validationError);
        return;
      }
      localStorage.setItem(topQKey, val);
    } else {
      localStorage.removeItem(topQKey);
    }
    if (!silent) toast.success(`Top Q count saved ${isTopQSubjectSpecific ? 'for subject' : 'globally'}`);
    setPreviewRefreshKey(prev => prev + 1);
  };

  const handleSaveReevalAgent = (silent = false) => {
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (!org) return;
    if (isReevalAgentSubjectSpecific) {
      if (isReevalAgentAllSubjectsOn) {
        subjects.forEach(s => {
          const subjKey = `org_reeval_agent_${org.organizationcode}_${s.subjectcode}`;
          localStorage.setItem(subjKey, '1');
        });
        if (!silent) toast.success('Live-evaluation Agent enabled for all subjects');
        setPreviewRefreshKey(prev => prev + 1);
        return;
      } else if (reevalAgentSubjectCode) {
        const subjKey = `org_reeval_agent_${org.organizationcode}_${reevalAgentSubjectCode}`;
        if (isReevalAgentSubjectOn) {
          localStorage.setItem(subjKey, '1');
        } else {
          localStorage.setItem(subjKey, '0');
        }
        if (!silent) toast.success('Subject specific re-evaluation config saved');
      }
    } else {
      const globalKey = `org_reeval_agent_${org.organizationcode}`;
      if (isReevalAgentGlobalOn) {
        localStorage.setItem(globalKey, '1');
      } else {
        localStorage.removeItem(globalKey);
      }
      if (!silent) toast.success(`Global re-evaluation config saved`);
    }
    setPreviewRefreshKey(prev => prev + 1);
  };

  const handleSaveStandards = (silent = false) => {
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (!org) return;
    if (isStandardsSubjectSpecific) {
      if (standardsSubjectCode) {
        const subjKey = `org_standards_count_${org.organizationcode}_${standardsSubjectCode}`;
        localStorage.setItem(subjKey, isStandardsSubjectOn ? '1' : '0');
        if (!silent) toast.success('Subject specific standards config saved');
      }
    } else {
      const globalStdKey = `org_standards_count_${org.organizationcode}`;
      if (isStandardsGlobalOn) {
        localStorage.setItem(globalStdKey, '1');
      } else {
        localStorage.removeItem(globalStdKey);
      }
      if (!silent) toast.success(`Global standards config saved`);
    }
    setPreviewRefreshKey(prev => prev + 1);
  };

  const handleSaveMetadata = (silent = false) => {
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (!org) return;
    if (isMetadataSubjectSpecific) {
      if (isMetadataAllSubjectsOn) {
        subjects.forEach(s => {
          localStorage.setItem(`org_ocr_metadata_${org.organizationcode}_${s.subjectcode}`, '1');
        });
        if (!silent) toast.success('Metadata enabled for all subjects');
        setPreviewRefreshKey(prev => prev + 1);
        return;
      } else if (metadataSubjectCode) {
        localStorage.setItem(`org_ocr_metadata_${org.organizationcode}_${metadataSubjectCode}`, isMetadataSubjectOn ? '1' : '0');
        if (!silent) toast.success('Subject specific metadata config saved');
      }
    } else {
      const globalKey = `org_ocr_metadata_${org.organizationcode}`;
      if (isMetadataGlobalOn) {
        localStorage.setItem(globalKey, '1');
      } else {
        localStorage.removeItem(globalKey);
      }
      if (!silent) toast.success('Global metadata config saved');
    }
    setPreviewRefreshKey(prev => prev + 1);
  };

  const handleSaveQNum = (silent = false) => {
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (!org) return;
    if (isQNumSubjectSpecific) {
      if (isQNumAllSubjectsOn) {
        subjects.forEach(s => {
          localStorage.setItem(`org_ocr_qnum_${org.organizationcode}_${s.subjectcode}`, '1');
        });
        if (!silent) toast.success('Question number extraction enabled for all subjects');
        setPreviewRefreshKey(prev => prev + 1);
        return;
      } else if (qNumSubjectCode) {
        localStorage.setItem(`org_ocr_qnum_${org.organizationcode}_${qNumSubjectCode}`, isQNumSubjectOn ? '1' : '0');
        if (!silent) toast.success('Subject specific question number extraction config saved');
      }
    } else {
      const globalKey = `org_ocr_qnum_${org.organizationcode}`;
      if (isQNumGlobalOn) {
        localStorage.setItem(globalKey, '1');
      } else {
        localStorage.removeItem(globalKey);
      }
      if (!silent) toast.success('Global question number extraction config saved');
    }
    setPreviewRefreshKey(prev => prev + 1);
  };

  const handleSavePrompt = (silent = false) => {
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (!org) return;
    const promptKey = isPromptSubjectSpecific && promptSubjectCode ? `org_prompt_${org.organizationcode}_${promptSubjectCode}` : `org_prompt_${org.organizationcode}`;
    localStorage.setItem(promptKey, selectedPrompt);
    if (!silent) toast.success(`Prompt selection saved ${isPromptSubjectSpecific ? 'for subject' : 'globally'}`);
    setPreviewRefreshKey(prev => prev + 1);
  };

  const handleSavePredefinedMapping = () => {
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (!org) return;
    const data = {
      maxQuestions: parseInt(String(predefinedMaxQuestions)) || 1,
      maxImages: parseInt(String(predefinedMaxImages)) || 1,
      imageFormat: predefinedImageFormat,
      mapping: predefinedMapping
    };
    localStorage.setItem(`org_predefined_mapping_${org.organizationcode}`, JSON.stringify(data));
    setPreviewRefreshKey(prev => prev + 1);
  };

  const handleSaveAnswerScript = (silent = false) => {
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (!org) return;
    localStorage.setItem(`org_answer_script_type_${org.organizationcode}`, answerScriptType);
    localStorage.setItem(
      `org_flexible_max_questions_${org.organizationcode}`,
      String(parseInt(String(flexibleMaxQuestions)) || 10)
    );
    handleSavePredefinedMapping();
    if (!silent) toast.success('Answer script configuration saved globally');
  };

  const handleSaveStages = (silent = false) => {
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (!org) return;
    localStorage.setItem(`org_selected_stages_${org.organizationcode}`, JSON.stringify(selectedStages));
    if (!silent) toast.success('Workflow stages configuration saved globally');
  };

  const handleSaveStandalone = (silent = false) => {
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (!org) return;
    localStorage.setItem(`org_standalone_${org.organizationcode}`, isStandaloneMode ? '1' : '0');
    // Always keep the global 'standalone_mode' key in sync for Login and OCREvaluation to read
    localStorage.setItem('standalone_mode', isStandaloneMode ? '1' : '0');
    localStorage.setItem(`org_standalone_input_${org.organizationcode}`, standaloneInputType);
    if (!silent) toast.success('Standalone mode configuration saved');
  };

  const handleSaveCycleType = (silent = false) => {
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (!org) return;
    localStorage.setItem(`org_cycle_type_${org.organizationcode}`, cycleType);
    if (!silent) toast.success('Cycle configuration saved');
  };

  const [isSavingToDB, setIsSavingToDB] = React.useState(false);

  // Nothing may be saved while a Top N / Total field holds an invalid entry -
  // neither the main field nor any per-subject override.
  const topQFieldError = validateTopQValue(topQuestionsCount);
  const topQSubjectErrorList = Object.entries(topQSubjectErrors);

  // Every question in the predefined mapping must carry at least one image.
  // Only meaningful while Indexing is on and the structure is Predefined -
  // Flexible has no mapping to check.
  const untaggedQuestions =
    selectedStages.indexing && answerScriptType === 'predefined'
      ? Array.from({ length: parseInt(String(predefinedMaxQuestions)) || 1 }, (_, i) => i + 1)
          .filter(qNum => !(predefinedMapping[`q${qNum}`] || []).length)
      : [];

  // And the other way round: every page in the taggable pool has to be claimed by
  // at least one question, or it would be uploaded and then never indexed. Same
  // pool the mapping grid shows, so 1.png is left out while Candidate Info owns it.
  const untaggedImages =
    selectedStages.indexing && answerScriptType === 'predefined'
      ? (() => {
          const firstImg = firstTaggableImage();
          const maxImg = parseInt(String(predefinedMaxImages)) || 1;
          const tagged = new Set<number>();
          Object.values(predefinedMapping).forEach(imgs => (imgs || []).forEach(n => tagged.add(n)));
          return Array.from({ length: Math.max(0, maxImg - firstImg + 1) }, (_, i) => i + firstImg)
            .filter(n => !tagged.has(n));
        })()
      : [];
  const hasTopQErrors = !!topQFieldError || topQSubjectErrorList.length > 0;

  const handleSaveToDB = async () => {
    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
    if (!org) {
      toast.error("No organization selected");
      return;
    }

    // Top N Questions belongs to the Evaluation section, which is only hidden
    // (not unmounted) when Evaluation is off. Its errors must not block Save
    // for a section the user can't even see.
    if (selectedStages.evaluation) {
      if (topQFieldError) {
        setTopQError(topQFieldError);
        toast.error(topQFieldError);
        return;
      }
      if (topQSubjectErrorList.length > 0) {
        const [subjectCode, message] = topQSubjectErrorList[0];
        const subjectName = subjects.find(s => s.subjectcode === subjectCode)?.subjectname || subjectCode;
        toast.error(`Top N / Total for ${subjectName}: ${message}`);
        return;
      }
    }
    // A blank Max Questions / Max Images must be filled in rather than silently
    // saved as the fallback value of 1.
    if (isStandardsGlobalOn && isThresholdDependent && selectedStages.ocr && !isStandaloneMode) {
      if (String(ocrThreshold ?? '').trim() === '') {
        toast.error('Please enter a value for OCR threshold (1-100).');
        return;
      }
    }
    if (showFlexibleMaxQuestions && String(flexibleMaxQuestions ?? '').trim() === '') {
      toast.error('Please enter a value for Max Questions (1-99).');
      return;
    }
    if (answerScriptType === 'predefined' && selectedStages.indexing) {
      const blankCountFields = [
        ['Max Questions', predefinedMaxQuestions],
        ['Max Images', predefinedMaxImages],
      ].filter(([, value]) => String(value ?? '').trim() === '').map(([label]) => label);
      if (blankCountFields.length > 0) {
        toast.error(`Please enter a value for ${blankCountFields.join(' and ')} (1-99).`);
        setIsPredefinedExpanded(true);
        return;
      }
      if ((Number(predefinedMaxImages) || 0) < minPredefinedImages) {
        toast.error(candidateInfoActive
          ? 'Max Images must be at least 2 when Candidate Info Extraction is on, because 1.png is the Candidate Info page.'
          : 'Max Images must be at least 1.');
        setIsPredefinedExpanded(true);
        return;
      }
    }
    if (untaggedQuestions.length > 0) {
      toast.error(
        `Every question must have at least one image tagged. Missing: ${untaggedQuestions.map(n => `Q${n}`).join(', ')}`,
        { duration: 5000 }
      );
      setIsPredefinedExpanded(true);
      return;
    }
    if (untaggedImages.length > 0) {
      toast.error(
        `Every image must be tagged to a question. Untagged: ${untaggedImages.map(n => `${n}.${predefinedImageFormat}`).join(', ')}`,
        { duration: 5000 }
      );
      setIsPredefinedExpanded(true);
      return;
    }

    setIsSavingToDB(true);
    
    // Construct the payload
    const payload = {
      orgCode: org.organizationcode,
      custCode: selectedCustomer,
      appCode: "AImarking",
      configSetting: {
        OrgCode: org.organizationcode,
        CustCode: selectedCustomer,
        workflowStages: selectedStages,
        standalone: isStandaloneMode,
        cycleType,
        // Only meaningful for Standalone OCR; left out otherwise, like other inactive settings.
        ...(isStandaloneMode && selectedStages.ocr ? { standaloneInputType } : {}),
        // A stage that is off disables its section in the UI, so its settings are
        // left out of the payload entirely rather than sent as stale values.
        // Candidate Info belongs to Segmentation and Indexing; the key is unchanged
        // because the app and the backend already read segmentationConfig.CandidateInfo.
        ...(selectedStages.segmentation || selectedStages.indexing ? {
        segmentationConfig: {
          CandidateInfo: isCandidateInfoGlobalOn
        },
        } : {}),
        ...(selectedStages.ocr ? {
        ocrConfig: {
          StandardsMetCount: isStandardsGlobalOn,
          // Only meaningful while Standards Met Count is on, which is the only
          // place the question is asked.
          ThresholdDependent: isStandardsGlobalOn && isThresholdDependent,
          Thresholds: {
            ocr: Number(ocrThreshold) || Number(DEFAULT_THRESHOLD),
          },
          MetadataPresent: isMetadataGlobalOn,
          QuestionNumberExtraction: isQNumGlobalOn,
          subjectOverrides: subjects.map(s => {
            const orgCode = org.organizationcode;
            const sc = s.subjectcode;
            
            const stdKey = `org_standards_count_${orgCode}_${sc}`;
            const metaKey = `org_ocr_metadata_${orgCode}_${sc}`;
            const qnumKey = `org_ocr_qnum_${orgCode}_${sc}`;

            const hasStd = localStorage.getItem(stdKey) !== null;
            const hasMeta = localStorage.getItem(metaKey) !== null;
            const hasQnum = localStorage.getItem(qnumKey) !== null;
            
            if (hasStd || hasMeta || hasQnum) {
              return {
                subjectCode: sc,
                ...(hasStd && { StandardsMetCount: localStorage.getItem(stdKey) === '1' }),
                ...(hasMeta && { MetadataPresent: localStorage.getItem(metaKey) === '1' }),
                ...(hasQnum && { QuestionNumberExtraction: localStorage.getItem(qnumKey) === '1' })
              };
            }
            return null;
          }).filter(Boolean)
        },
        } : {}),
        ...(selectedStages.indexing ? {
        indexingConfig: {
          type: answerScriptType,
          CandidateInfo: isCandidateInfoGlobalOn,
          flexibleSettings: {
            maxQuestions: Number(flexibleMaxQuestions) || 10,
          },
          predefinedSettings: {
            maxQuestions: Number(predefinedMaxQuestions) || 1,
            maxImages: Number(predefinedMaxImages) || 1,
            imageFormat: predefinedImageFormat,
            mapping: predefinedMapping
          }
        },
        } : {}),
        ...(selectedStages.evaluation ? {
        evaluationConfig: {
          globalThresholds: {
            passMarkThreshold: Number(passMark) || 40,
            selectedPrompt: selectedPrompt,
            topQuestionsCount: !isTopQUnset(topQuestionsCount) ? topQuestionsCount.trim() : '5',
            liveEvaluationAgentEnabled: isReevalAgentGlobalOn
          },
          subjectOverrides: subjects.map(s => {
            const orgCode = org.organizationcode;
            const sc = s.subjectcode;
            const passKey = `org_pass_mark_${orgCode}_${sc}`;
            const promptKey = `org_prompt_${orgCode}_${sc}`;
            const topQKey = `org_top_questions_${orgCode}_${sc}`;
            const agentKey = `org_reeval_agent_${orgCode}_${sc}`;
            
            const hasPass = localStorage.getItem(passKey) !== null;
            const hasPrompt = localStorage.getItem(promptKey) !== null;
            const hasTopQ = localStorage.getItem(topQKey) !== null;
            const hasAgent = localStorage.getItem(agentKey) !== null;
            
            if (hasPass || hasPrompt || hasTopQ || hasAgent) {
               return {
                 subjectCode: sc,
                 ...(hasPass && { passMarkThreshold: Number(localStorage.getItem(passKey)) }),
                 ...(hasPrompt && { selectedPrompt: localStorage.getItem(promptKey) }),
                 ...(hasTopQ && { topQuestionsCount: localStorage.getItem(topQKey) }),
                 ...(hasAgent && { liveEvaluationAgentEnabled: localStorage.getItem(agentKey) === '1' }),
               }
            }
            return null;
          }).filter(Boolean)
        },
        } : {}),
      }
    };

    try {
      const response = await fetch(`${API_BASE1}/save-config-info`, {
        method: 'POST',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        
        // Handle specific status codes
        const code = result?.code || result?.status || result;
        if (code === 's001' || result?.message?.includes('s001')) {
           toast.success('Settings saved successfully (s001)');
        } else if (code === 's002' || result?.message?.includes('s002')) {
           toast.success('Settings updated successfully (s002)');
        } else {
           toast.success(result?.message || 'Configuration saved to database!');
        }

        // Call GET API to refresh UI
        await loadSettings(org.organizationcode);
      } else {
        toast.error(`Failed to save configuration: ${response.status}`);
      }
    } catch (e) {
      console.error("Save API error", e);
      toast.error('Error connecting to the API to save settings');
    } finally {
      setIsSavingToDB(false);

      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
      if (org) {
        const globalKey = `org_seg_candidateinfo_${org.organizationcode}`;
        if (isCandidateInfoGlobalOn) {
          localStorage.setItem(globalKey, '1');
        } else {
          localStorage.removeItem(globalKey);
        }
      }
      
      // Fallback: save to local storage as backup just in case
      handleSavePassMark(true);
      handleSaveTopQ(true);
      handleSaveStandards(true);
      handleSaveReevalAgent(true);
      handleSavePrompt(true);
      handleSaveStages(true);
      handleSaveAnswerScript(true);
      handleSaveMetadata(true);
      handleSaveQNum(true);
      handleSaveStandalone(true);
      handleSaveCycleType(true);
    }
  };

  return (
    <div className="flex flex-col h-full w-full flex-1 bg-slate-50 relative">
      {loadingSettings && <PageLoader />}
      {isSavingToDB && <PageLoader />}
      <div className="p-6 flex-1 overflow-y-auto pb-24">
        <div className="flex items-center justify-between gap-4 border-b pb-4 mb-6">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#2563eb]" />
            <h2 className="text-xl font-semibold">Settings</h2>
          </div>
          {/* Customer & Org dropdowns — hidden for admin; Year & Cycle follow them and stay visible */}
          <div className="flex items-end gap-3">
            {!isAdmin && (
            <>
              <div className="w-52">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Select Customer</label>
                <div className="relative group">
                  <select
                    value={selectedCustomer}
                    onChange={e => setSelectedCustomer(e.target.value)}
                    className="w-full px-4 py-2 pr-8 text-sm border border-gray-200 rounded-lg bg-white shadow-sm hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer text-gray-700 font-medium"
                  >
                    <option value="ICME">ICME</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none group-hover:text-blue-500 transition-colors" />
                </div>
              </div>
              <div className="w-64">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Select Organization</label>
                <div className="relative group">
                  <select
                    value={selectedOrg}
                    onChange={handleOrgChange}
                    className="w-full px-4 py-2 pr-8 text-sm border border-gray-200 rounded-lg bg-white shadow-sm hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer text-gray-700 font-medium"
                  >
                    {organizations.map(org => (
                      <option key={org.organizationid} value={org.organizationid}>
                        {org.organizationname}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none group-hover:text-blue-500 transition-colors" />
                </div>
              </div>
            </>
            )}
            {yearCycleSelector}
          </div>
        </div>

        {loadingOrgs ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="w-full space-y-8">
            {/* Premium Settings Container */}
            {/* Cycle Configuration Container */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-visible">
              <div className="flex items-start gap-3 bg-gray-50/80 rounded-t-xl px-6 py-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-[#2563eb] flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Cycle Configuration</h3>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">Choose how many cycles this organization's year is split into. This decides how many cycles appear in Select Cycle, above.</p>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {([
                    { value: 'annual', label: 'Annual', hint: '1 cycle' },
                    { value: 'semiannual', label: 'Semi-Annual', hint: '2 cycles' },
                    { value: 'quarterly', label: 'Quarterly', hint: '4 cycles' },
                  ] as const).map(option => {
                    const active = cycleType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setCycleType(option.value)}
                        className={`relative flex flex-col items-start gap-1 rounded-xl px-4 py-4 text-left transition-all duration-200 ${
                          active
                            ? 'border-2 border-[#2563eb] bg-blue-50/60 shadow-sm hover:shadow-md'
                            : 'border border-gray-200 bg-white hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md'
                        }`}
                      >
                        {active && (
                          <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-[#2563eb]" />
                        )}
                        <span className={`text-sm font-semibold pr-6 ${active ? 'text-blue-800' : 'text-gray-800'}`}>{option.label}</span>
                        <span className={`text-xs font-medium ${active ? 'text-blue-600' : 'text-gray-500'}`}>{option.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Workflow Settings Container */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-visible mt-6">
              <div className="bg-gray-50/80 rounded-t-xl px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Workflow Configuration</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Organization-wide settings that decide which stages run and how each one behaves.</p>
                </div>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setShowCombinationsDialog(true)}
                        aria-label="View workflow combinations"
                        className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-full border border-blue-200 bg-white text-[#2563eb] transition-all hover:bg-blue-50 hover:border-[#2563eb] hover:ring-2 hover:ring-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs py-1 px-2 bg-white text-gray-800 border border-gray-200 rounded-md shadow-sm">
                      View all workflow combinations
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Every valid stage combination, what it takes in and what it produces. */}
              <Dialog open={showCombinationsDialog} onOpenChange={setShowCombinationsDialog}>
                <DialogContent
                  className="w-[95vw] max-w-[900px] max-h-[85vh] rounded-2xl border border-gray-100 bg-white shadow-2xl flex flex-col p-0 gap-0 overflow-hidden"
                  // Only the Close button (or Escape) closes it, never a click outside.
                  onPointerDownOutside={(e) => e.preventDefault()}
                  onInteractOutside={(e) => e.preventDefault()}
                >
                  {/* Header - fixed; only the list below scrolls. */}
                  <DialogHeader className="px-6 py-5 border-b border-gray-100 shrink-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563eb] flex items-center justify-center shrink-0">
                          <Network className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <DialogTitle className="text-lg font-semibold text-gray-900">Workflow Combinations</DialogTitle>
                          <DialogDescription className="text-sm text-gray-500 mt-0.5">
                            Explore the {WORKFLOW_COMBINATIONS.length} supported workflow combinations for an organization.
                          </DialogDescription>
                        </div>
                      </div>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => setShowCombinationsDialog(false)}
                              aria-label="Close"
                              className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-700 hover:border-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs py-1 px-2 bg-white text-gray-800 border border-gray-200 rounded-md shadow-sm z-[60]">
                            Close
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </DialogHeader>

                  {/* List - the only scrollable region; header and footer stay fixed. */}
                  <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-2.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-300">
                    {WORKFLOW_COMBINATIONS.map((combination, index) => {
                      const isCurrent = WORKFLOW_STAGE_ORDER.every(stage => Boolean(selectedStages[stage]) === combination.stages[stage]);
                      const enabled = WORKFLOW_STAGE_ORDER.filter(stage => combination.stages[stage]);
                      return (
                        <div
                          key={combination.label}
                          className={`rounded-xl border px-4 py-3.5 transition-colors duration-150 ${
                            isCurrent
                              ? 'border-blue-300 bg-blue-50/50'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/70'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                            {/* Left: numbered indicator + stage sequence */}
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span
                                className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold shrink-0 transition-colors ${
                                  isCurrent ? 'bg-[#2563eb] text-white' : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {index + 1}
                              </span>
                              {enabled.map((stage, stageIndex) => (
                                <React.Fragment key={stage}>
                                  {stageIndex > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" aria-hidden="true" />}
                                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border whitespace-nowrap ${WORKFLOW_STAGE_STYLE[stage].chip}`}>
                                    {WORKFLOW_STAGE_STYLE[stage].label}
                                  </span>
                                </React.Fragment>
                              ))}
                            </div>

                            {/* Right: Standalone, file type, Current */}
                            <div className="flex items-center gap-1.5 flex-wrap sm:justify-end sm:shrink-0">
                              {combination.standalone && (
                                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                                  Standalone
                                </span>
                              )}
                              {/* What the Create Workspace dialog actually asks for, for every
                                  combination - not just the ones that offer Audio/Video. */}
                              <span
                                title={`Create Workspace asks for: ${getCombinationInputType(combination)}`}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap"
                              >
                                {combination.stages.segmentation ? (
                                  <FileText className="w-3 h-3" aria-hidden="true" />
                                ) : combination.audio ? (
                                  <Video className="w-3 h-3" aria-hidden="true" />
                                ) : combination.stages.ocr || combination.stages.indexing ? (
                                  <ImageIcon className="w-3 h-3" aria-hidden="true" />
                                ) : (
                                  <FileText className="w-3 h-3" aria-hidden="true" />
                                )}
                                {getCombinationInputType(combination)}
                              </span>
                              {isCurrent && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#2563eb] text-white whitespace-nowrap">
                                  <Check className="w-3 h-3" aria-hidden="true" />
                                  Current
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </DialogContent>
              </Dialog>

              <div className="p-6 space-y-6">
                {/* Setting 5: Workflow Stages Selection */}
                <div className="p-5 rounded-lg border border-gray-100 hover:border-blue-100 hover:shadow-md transition-all duration-200 bg-white group">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                        <ListOrdered className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col items-start">
                        <Label className="text-sm font-semibold text-gray-900 text-base">Workflow Stages</Label>
                        <p className="text-sm text-gray-500 mt-1 max-w-md">Choose the stages this organization runs. Stages left unchecked are skipped for every script.</p>
                        <p className="text-xs font-medium text-cyan-600 mt-1 italic">
                          • Note: Each stage has its own settings below. Turning a stage off hides its settings and leaves them out of the saved configuration.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-4 min-w-[280px]">
                      {(() => {
                        const stageOrder: (keyof typeof selectedStages)[] = ['segmentation', 'indexing', 'ocr', 'evaluation'];
                        const stageLabels: Record<keyof typeof selectedStages, string> = {
                          segmentation: 'Segmentation',
                          indexing: 'Indexing',
                          ocr: 'OCR',
                          evaluation: 'Evaluation',
                        };

                        // Only the combinations in WORKFLOW_COMBINATIONS are allowed; the same
                        // list feeds the "View combinations" dialog.
                        type StageCombo = { segmentation: boolean; indexing: boolean; ocr: boolean; evaluation: boolean };
                        const validCombinations: StageCombo[] = WORKFLOW_COMBINATIONS.map(combination => combination.stages);

                        const allowedMessage =
                          'Allowed combinations:\n' +
                          WORKFLOW_COMBINATIONS.map((combination, index) => `${index + 1}. ${combination.label}`).join('\n');

                        const isValidCombo = (combo: StageCombo) =>
                          validCombinations.some(v =>
                            v.segmentation === combo.segmentation &&
                            v.indexing    === combo.indexing &&
                            v.ocr         === combo.ocr &&
                            v.evaluation  === combo.evaluation
                          );

                        return (
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            {stageOrder.map(stage => {
                              // Every stage stays selectable: the combination rules below are
                              // the only constraint, and the mode follows from what is chosen.
                              const isStageDisabled = false;
                              return (
                              <div key={stage} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`stage-${stage}`}
                                  checked={selectedStages[stage]}
                                  disabled={isStageDisabled}
                                  onChange={(e) => {
                                    const isChecked = e.target.checked;
                                    const newStages: StageCombo = { ...selectedStages, [stage]: isChecked };
                                    if (!isValidCombo(newStages)) {
                                      toast.error(
                                        `You have selected an invalid combination. Please choose one of the valid combinations listed below. ${allowedMessage}`,
                                        { duration: 5000, style: { whiteSpace: 'pre-line' } }
                                      );
                                      return;
                                    }
                                    setSelectedStages(newStages);
                                    // Candidate Info Extraction is reset once neither Segmentation
                                    // nor Indexing is left on.
                                    if ((stage === 'segmentation' || stage === 'indexing') && !isChecked
                                      && !(newStages.segmentation || newStages.indexing)) {
                                      setIsCandidateInfoGlobalOn(false);
                                      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                                      if (org) {
                                        localStorage.removeItem(`org_seg_candidateinfo_${org.organizationcode}`);
                                      }
                                    }
                                  }}
                                  className={`w-4 h-4 text-[#2563eb] rounded border-gray-300 focus:ring-[#2563eb] ${isStageDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                />
                                <Label htmlFor={`stage-${stage}`} className={`text-sm font-medium ${isStageDisabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 cursor-pointer'}`}>
                                  {stageLabels[stage]}
                                </Label>
                              </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── OCR Input ──────────────────────────────────────────────── */}
            {/* DISABLED: OCR Input - Image / Audio / Video selection.
                Super Admin no longer restricts the upload type here; the user now
                picks Image / Audio / Video themselves in OCR Evaluation's Create
                Workspace dialog. Kept commented (not deleted) per the agreed plan,
                in case this admin-side override needs to come back.
            <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mt-6 ${isStandaloneMode && selectedStages.ocr ? '' : 'hidden'}`}>
              <div className="bg-gradient-to-r from-indigo-50/80 to-blue-50/60 px-6 py-4 border-b border-indigo-100/60 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 mr-1">
                      <ToggleRight className="w-4 h-4" />
                    </span>
                    OCR Input
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">OCR runs on its own, so workspaces run against that single stage. Choose what evaluators upload.</p>
                </div>
              </div>

              <div className="p-6 space-y-6">
                [ Standalone OCR only: evaluators upload either answer images (the
                    existing image flow) or audio recordings that are transcribed. ]
                {isStandaloneMode && selectedStages.ocr && (
                  <div className="p-5 rounded-lg border border-gray-100 hover:border-indigo-100 hover:shadow-md transition-all duration-200 bg-white group">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                          {standaloneInputType === 'audio'
                            ? <AudioLines className="w-5 h-5" />
                            : standaloneInputType === 'video'
                              ? <Video className="w-5 h-5" />
                              : <ImageIcon className="w-5 h-5" />}
                        </div>
                        <div className="flex flex-col items-start">
                          <Label className="text-sm font-semibold text-gray-900 text-base">OCR Input Type</Label>
                          <p className="text-sm text-gray-500 mt-1 max-w-md">Choose what evaluators upload when creating a workspace.</p>
                          <p className="text-xs font-medium text-indigo-600 mt-1 italic">
                            {standaloneInputType === 'audio'
                              ? '• Audio: candidate recordings (MP3 / WAV) are uploaded and transcribed.'
                              : standaloneInputType === 'video'
                                ? '• Video: candidate answer videos (MP4 only) are uploaded and transcribed.'
                                : '• Image: answer script images (PNG / JPG) are uploaded and extracted.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-white border border-indigo-200 rounded-lg p-1 shadow-sm mt-2 md:mt-0 self-start">
                        {([
                          { value: 'image' as const, label: 'Image', Icon: ImageIcon },
                          { value: 'audio' as const, label: 'Audio', Icon: AudioLines },
                          { value: 'video' as const, label: 'Upload Video', Icon: Video },
                        ]).map(({ value, label, Icon }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setStandaloneInputType(value);
                              const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                              if (org) localStorage.setItem(`org_standalone_input_${org.organizationcode}`, value);
                            }}
                            aria-pressed={standaloneInputType === value}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                              standaloneInputType === value
                                ? 'bg-indigo-500 text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            */}


            {/* ─── Indexing Config Section ─────────────────────────────── */}
            {/* overflow-visible so the per-question image dropdowns are not clipped. */}
            {/* Shown when Segmentation or Indexing runs: Candidate Info belongs to both,
                while the Answer Script block below stays with Indexing alone. */}
            <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-visible mt-6 ${!candidateInfoStageOn ? 'hidden' : ''}`}>
              <div className="bg-gradient-to-r from-orange-50/80 to-amber-50/60 rounded-t-xl px-6 py-4 border-b border-orange-100/60 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-orange-100 text-orange-600 mr-1">
                      <Layers className="w-4 h-4" />
                    </span>
                    Segmentation / Indexing Configuration
                    {!candidateInfoStageOn && <span className="text-xs font-medium text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">Disabled</span>}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">Set how answer script pages are structured and which pages belong to each question.</p>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Candidate Info Extraction decides whether the first page of a script is
                    the candidate information page. It applies to Segmentation and to
                    Indexing, so it shows whenever either stage runs. */}
                <div className={`p-5 rounded-lg border border-gray-100 hover:border-blue-100 hover:shadow-md transition-all duration-200 bg-white group ${isStandaloneMode ? 'hidden' : ''}`}>
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col items-start">
                        <Label className="text-sm font-semibold text-gray-900 text-base">Candidate Info Extraction</Label>
                        <p className="text-sm text-gray-500 mt-1 max-w-md">Enable or disable extraction of candidate information (like Roll No) globally. When on, the first page of every script is the candidate information page and is not tagged to a question.</p>
                      </div>
                    </div>

                    {/* Simplified global control panel */}
                    <div className="flex flex-col gap-2 min-w-[280px] mt-2 md:mt-0">
                      <div className="flex items-center justify-between bg-white rounded-lg border border-amber-200 px-3 py-2.5 shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-600">Global status</span>
                          <span className={`text-[10px] mt-0.5 font-semibold ${(candidateInfoStageOn && isCandidateInfoGlobalOn) ? 'text-amber-600' : 'text-red-400'}`}>
                            {(candidateInfoStageOn && isCandidateInfoGlobalOn) ? '● Active globally' : '○ Inactive globally'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${(candidateInfoStageOn && isCandidateInfoGlobalOn) ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                            {(candidateInfoStageOn && isCandidateInfoGlobalOn) ? 'ON' : 'OFF'}
                          </span>
                          <Switch 
                            disabled={!candidateInfoStageOn}
                            checked={candidateInfoStageOn && isCandidateInfoGlobalOn} 
                            onCheckedChange={(checked) => {
                              setIsCandidateInfoGlobalOn(checked);
                              const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                              if (org) {
                                const globalKey = `org_seg_candidateinfo_${org.organizationcode}`;
                                if (checked) {
                                  localStorage.setItem(globalKey, '1');
                                } else {
                                  localStorage.removeItem(globalKey);
                                }
                              }
                            }} 
                            className="data-[state=checked]:bg-amber-500" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Answer Script is the Indexing stage's configuration, so it follows the
                    same rule as the Segmentation/OCR/Evaluation sections: unchecking the
                    Indexing stage disables it. pointer-events-none stops the mouse and the
                    disabled attributes below stop keyboard/tab editing. */}
                <div className={`p-5 rounded-lg border border-gray-100 hover:border-blue-100 hover:shadow-md transition-all duration-200 bg-white group ${!selectedStages.indexing ? 'hidden' : ''}`}>
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col items-start">
                        <Label className="text-sm font-semibold text-gray-900 text-base">Answer Script Structure</Label>
                        <p className="text-sm text-gray-500 mt-1 max-w-md">Choose whether pages are mapped to questions in advance or left flexible.</p>
                        {showFlexibleMaxQuestions && (
                          <p className="text-xs font-medium text-blue-600 mt-1 italic animate-in fade-in zoom-in-40 duration-300">
                            &bull; Note: Flexible scripts hold up to {parseInt(String(flexibleMaxQuestions)) || 10} question(s) per script.
                          </p>
                        )}
                        {answerScriptType === 'predefined' && (
                          <>
                            <p className="text-xs font-medium text-orange-600 mt-1 italic animate-in fade-in zoom-in-40 duration-300">
                              • Note: This predefined mapping covers {parseInt(String(predefinedMaxQuestions)) || 1} question(s) and {parseInt(String(predefinedMaxImages)) || 1} image(s) per script.
                            </p>
                            <button
                              onClick={() => setIsPredefinedExpanded(!isPredefinedExpanded)}
                              disabled={!selectedStages.indexing}
                              className="text-[11px] font-medium text-gray-500 hover:text-orange-600 flex items-center gap-1 transition-colors mt-3 disabled:cursor-not-allowed"
                            >
                              {isPredefinedExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              {isPredefinedExpanded ? 'Hide' : 'Configure'} Mapping Details
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-4 min-w-[280px]">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 flex items-center justify-center gap-3 bg-gray-50/80 p-2 rounded-lg border border-gray-100 shadow-inner">
                          <span
                            title={lockAnswerScriptToFlexible
                              ? 'Standalone Mode always uses a flexible answer script.'
                              : undefined}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${(!selectedStages.indexing || lockAnswerScriptToFlexible) ? 'cursor-not-allowed' : 'cursor-pointer'} ${lockAnswerScriptToFlexible ? 'text-gray-300' : answerScriptType === 'predefined' ? 'bg-white shadow-sm text-gray-800 border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => {
                              if (lockAnswerScriptToFlexible) return;
                              if (selectedStages.indexing) setAnswerScriptType('predefined');
                            }}
                          >
                            Predefined
                          </span>
                          <Switch
                            checked={answerScriptType === 'flexible'}
                            disabled={!selectedStages.indexing || lockAnswerScriptToFlexible}
                            title={lockAnswerScriptToFlexible
                              ? 'Standalone Mode always uses a flexible answer script.'
                              : undefined}
                            onCheckedChange={(checked) => {
                              if (lockAnswerScriptToFlexible) return;
                              setAnswerScriptType(checked ? 'flexible' : 'predefined');
                            }}
                            className="data-[state=checked]:bg-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <span
                            title={lockAnswerScriptToFlexible
                              ? 'Standalone Mode always uses a flexible answer script.'
                              : undefined}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${(!selectedStages.indexing || lockAnswerScriptToFlexible) ? 'cursor-not-allowed' : 'cursor-pointer'} ${answerScriptType === 'flexible' ? 'bg-white shadow-sm text-blue-600 border border-blue-100' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => {
                              if (lockAnswerScriptToFlexible) return;
                              if (selectedStages.indexing) setAnswerScriptType('flexible');
                            }}
                          >
                            Flexible
                          </span>
                        </div>
                      </div>

                      {/* A flexible script needs no page mapping, so Max Questions
                          is the only thing worth asking for. */}
                      {showFlexibleMaxQuestions && (
                        <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-3 animate-in fade-in slide-in-from-top-1 duration-300">
                          <Label className="text-xs font-semibold text-gray-700">Max Questions</Label>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            How many questions a flexible script can hold. Default 10.
                          </p>
                          <Input
                            type="number"
                            min={1}
                            max={99}
                            step={1}
                            inputMode="numeric"
                            placeholder="Enter max questions (1-99)"
                            value={flexibleMaxQuestions}
                            disabled={!selectedStages.indexing}
                            onKeyDown={blockNonDigitCountKeys}
                            onChange={(e) => setFlexibleMaxQuestions(toCountValue(e.target.value))}
                            className="mt-1.5 bg-white disabled:cursor-not-allowed disabled:bg-gray-100"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {isPredefinedExpanded && answerScriptType === 'predefined' && (() => {
                  // ── Predefined tagging workflow ──────────────────────────────────
                  // "Max Questions" decides how many question slots are offered for
                  // tagging; "Max Images" decides the pool of images (1.png … N.png).
                  // Every image belongs to exactly one question, so the tagged total can
                  // never exceed the taggable pool, while one question may hold several.
                  // e.g. 8 questions / 12 images => 8 slots shown, with 4 spare images
                  // that can be attached to whichever question needs them.
                  //
                  // Candidate Info Extraction reserves 1.png as the candidate
                  // information page, so when it is ON the pool starts at 2.png.
                  const maxQ = parseInt(String(predefinedMaxQuestions)) || 1;
                  const maxImg = parseInt(String(predefinedMaxImages)) || 1;
                  const firstImg = firstTaggableImage();
                  const taggableImages = Array.from(
                    { length: Math.max(0, maxImg - firstImg + 1) },
                    (_, i) => i + firstImg
                  );

                  // Max Questions / Max Images is briefly empty while being retyped, and
                  // the math above falls back to 1 for that instant - it must not make
                  // this screen show a tag on some now out-of-range image (e.g. 4.png
                  // still shown once Max Images is cleared) as if it were still valid.
                  // predefinedMapping itself stays untouched here so nothing is lost;
                  // this view is filtered down to what the current count actually allows,
                  // and the real prune (with its removed-tags confirmation) only runs once
                  // a real number is committed, in requestPredefinedConfigChange.
                  const visibleMapping: Record<string, number[]> = {};
                  Object.entries(predefinedMapping).forEach(([key, imgs]) => {
                    const kept = (imgs || []).filter(n => taggableImages.includes(n));
                    if (kept.length) visibleMapping[key] = kept;
                  });

                  // image number -> every question currently holding it, since one
                  // image can be tagged to several questions at once.
                  const imageOwners: Record<number, number[]> = {};
                  Object.keys(visibleMapping).forEach(key => {
                    const qn = parseInt(key.replace(/^q/, ''), 10);
                    (visibleMapping[key] || []).forEach(img => {
                      if (!imageOwners[img]) imageOwners[img] = [];
                      if (!imageOwners[img].includes(qn)) imageOwners[img].push(qn);
                    });
                  });
                  Object.values(imageOwners).forEach(list => list.sort((a, b) => a - b));
                  // Counts distinct images, so an image on three questions still counts once.
                  const taggedCount = Object.keys(imageOwners).length;
                  const untaggedImages = taggableImages.filter(n => !imageOwners[n]);
                  const notEnoughImages = taggableImages.length < maxQ;

                  return (
                  <div className={`mt-5 pt-4 border-t border-gray-50 col-span-full w-full transition-opacity duration-300 ${!selectedStages.indexing ? 'hidden' : ''}`}>
                    <div className="flex gap-6 mb-4">
                      <div className="flex-1">
                        <Label className="text-xs font-medium text-gray-700">Max Questions</Label>
                        <Input type="number" min={1} max={99} step={1} inputMode="numeric" placeholder="Enter max questions (1-99)" value={predefinedMaxQuestions} disabled={!selectedStages.indexing} onKeyDown={blockNonDigitCountKeys} onChange={(e) => requestPredefinedConfigChange('questions', toCountValue(e.target.value))} className="mt-1 disabled:cursor-not-allowed disabled:bg-gray-100" />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs font-medium text-gray-700">Max Images</Label>
                        <Input type="number" min={1} max={99} step={1} inputMode="numeric" placeholder={`Enter max images (${minPredefinedImages}-99)`} value={predefinedMaxImages} disabled={!selectedStages.indexing} onKeyDown={blockNonDigitCountKeys} onChange={(e) => requestPredefinedConfigChange('images', toCountValue(e.target.value))} className={`mt-1 disabled:cursor-not-allowed disabled:bg-gray-100 ${maxImagesError ? 'border-red-400 focus-visible:ring-red-200' : ''}`} />
                        {maxImagesError && (
                          <p className="text-[11px] text-red-600 font-medium mt-1 leading-snug">{maxImagesError}</p>
                        )}
                      </div>
                      {/* Page image format: the tagging pool is 1.png … N.png or 1.jpg … N.jpg. */}
                      <div className="shrink-0">
                        <Label className="text-xs font-medium text-gray-700">Image Format</Label>
                        <div className="mt-1 flex w-max items-center gap-0.5 rounded-md border border-gray-200 bg-gray-50 p-0.5 h-10">
                          {(['png', 'jpg'] as const).map(format => (
                            <button
                              key={format}
                              type="button"
                              disabled={!selectedStages.indexing}
                              onClick={() => setPredefinedImageFormat(format)}
                              className={`px-3 h-9 rounded text-xs font-semibold uppercase transition-colors disabled:cursor-not-allowed ${predefinedImageFormat === format
                                ? 'bg-indigo-500 text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                              {format}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Live validation of the Candidate + Max Questions + Max Images combination */}
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{maxQ} question{maxQ === 1 ? '' : 's'}</span>
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{maxImg} image{maxImg === 1 ? '' : 's'}</span>
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700">{taggedCount} / {taggableImages.length} tagged</span>
                      {/* Blue read as a neutral note rather than "this still needs attention" -
                          amber matches the "tagged" count beside it, and green is kept only for
                          the fully-resolved state, same as the badge below it. */}
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${untaggedImages.length ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {untaggedImages.length ? `${untaggedImages.length} untagged` : 'All images tagged'}
                      </span>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${candidateInfoActive ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                        Candidate info: {candidateInfoActive ? 'ON' : 'OFF'}
                      </span>
                    </div>

                    {/* What the Candidate Info toggle does to the taggable page range */}
                    {candidateInfoActive ? (
                      <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                        <User className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-amber-700">
                          <span className="font-semibold">1.{predefinedImageFormat} is the Candidate Info page</span> — it is hidden from question tagging. Questions are tagged from 2.{predefinedImageFormat} … {maxImg}.{predefinedImageFormat}.
                        </p>
                      </div>
                    ) : (
                      <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
                        <User className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-gray-500">
                          Candidate Info is off — no candidate information page is extracted, so <span className="font-semibold text-gray-600">1.{predefinedImageFormat} is available for question tagging</span>.
                        </p>
                      </div>
                    )}

                    {untaggedImages.length > 0 && (
                      <p className="text-[11px] text-gray-500 mb-3">
                        Free to tag against any question: <span className="font-medium text-gray-600">{untaggedImages.map(n => `${n}.${predefinedImageFormat}`).join(', ')}</span>
                      </p>
                    )}

                    {notEnoughImages && (
                      <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-amber-700">
                          Only {taggableImages.length} taggable image{taggableImages.length === 1 ? '' : 's'} for {maxQ} questions — {maxQ - taggableImages.length} question{maxQ - taggableImages.length === 1 ? '' : 's'} cannot receive an image.
                        </p>
                      </div>
                    )}

                    <TooltipProvider delayDuration={200}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {Array.from({ length: maxQ }).map((_, i) => {
                        const qNum = i + 1;
                        const assigned = visibleMapping[`q${qNum}`] || [];
                        return (
                          <div key={qNum} className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-xs font-bold text-gray-700">Question {qNum}</Label>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${assigned.length ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-500'}`}>
                                {assigned.length} image{assigned.length === 1 || 0 ? '' : 's'}
                              </span>
                            </div>
                            <div className="relative q-dropdown-container">
                              {/* The closed selector truncates a long list, so hovering shows every
                                  image tagged to this question. */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    onClick={() => setOpenDropdownQNum(openDropdownQNum === qNum ? null : qNum)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white flex justify-between items-center cursor-pointer text-xs min-h-[36px]"
                                  >
                                    <span className="truncate text-gray-700">
                                      {assigned.length > 0
                                        ? assigned.map(n => `${n}.${predefinedImageFormat}`).join(', ')
                                        : 'Select images...'}
                                    </span>
                                    <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs text-xs">
                                  {assigned.length > 0 ? (
                                    <>
                                      <p className="font-semibold mb-0.5">Question {qNum} - {assigned.length} image{assigned.length === 1 ? '' : 's'}</p>
                                      <p className="whitespace-pre-wrap break-words">{assigned.map(n => `${n}.${predefinedImageFormat}`).join(', ')}</p>
                                    </>
                                  ) : 'No images tagged to this question yet'}
                                </TooltipContent>
                              </Tooltip>
                              {openDropdownQNum === qNum && (
                                <div className="absolute z-50 top-full left-0 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg py-1">
                                  {taggableImages.length === 0 && (
                                    <div className="px-3 py-2 text-[11px] text-gray-400">No images available to tag</div>
                                  )}
                                  {taggableImages.map(imgNum => {
                                    const owners = imageOwners[imgNum] || [];
                                    const isSelected = owners.includes(qNum);
                                    // Other questions sharing this image - shown for context only,
                                    // it never blocks tagging it here as well.
                                    const sharedWith = owners.filter(o => o !== qNum);
                                    return (
                                      <div
                                        key={imgNum}
                                        // The row only tags. Untagging is the Remove button's job
                                        // alone, so a stray click cannot drop an image.
                                        onClick={() => { if (!isSelected) toggleImageForQuestion(qNum, imgNum); }}
                                        title={sharedWith.length ? `Also tagged to Question ${sharedWith.join(', ')}` : undefined}
                                        className={`px-3 py-1.5 text-xs flex items-center justify-between gap-2 ${isSelected ? 'cursor-default' : 'hover:bg-gray-50 cursor-pointer'}`}
                                      >
                                        <span className={isSelected ? 'font-medium text-orange-700' : 'text-gray-600'}>{imgNum}.{predefinedImageFormat}</span>
                                        <span className="flex items-center gap-1 shrink-0">
                                          {sharedWith.length > 0 && (
                                            <span className="text-[9px] font-bold text-gray-400">{sharedWith.map(o => `Q${o}`).join(' ')}</span>
                                          )}
                                          {/* Untags just this image. stopPropagation keeps the row's
                                              own toggle from firing straight after and re-adding it. */}
                                          {isSelected && (
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleImageForQuestion(qNum, imgNum);
                                                  }}
                                                  aria-label={`Remove ${imgNum}.${predefinedImageFormat} from Question ${qNum}`}
                                                  className="p-0.5 rounded text-orange-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                >
                                                  <X className="w-3 h-3" />
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent side="top" className="text-xs">
                                                Remove from Question {qNum}
                                              </TooltipContent>
                                            </Tooltip>
                                          )}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    </TooltipProvider>
                  </div>
                  );
                })()}

                {/* Confirm before a config change drops tags the user already made */}
                {pendingPredefinedConfig && (
                  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 p-6 animate-in zoom-in-95 duration-200">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900">Some existing tags will be removed</h3>
                          <p className="text-xs text-gray-500 mt-1">
                            Setting <span className="font-semibold text-gray-700">Max {pendingPredefinedConfig.field === 'questions' ? 'Questions' : 'Images'}</span> to <span className="font-semibold text-gray-700">{pendingPredefinedConfig.value}</span> invalidates part of the current mapping.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 mb-5">
                        {pendingPredefinedConfig.removedQuestions.length > 0 && (
                          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                            <p className="text-[11px] font-semibold text-red-700">Questions removed</p>
                            <p className="text-[11px] text-red-600 mt-0.5">{pendingPredefinedConfig.removedQuestions.map(n => `Q${n}`).join(', ')}</p>
                          </div>
                        )}
                        {pendingPredefinedConfig.removedImages.length > 0 && (
                          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                            <p className="text-[11px] font-semibold text-red-700">Image tags cleared</p>
                            <p className="text-[11px] text-red-600 mt-0.5">{pendingPredefinedConfig.removedImages.map(n => `${n}.${predefinedImageFormat}`).join(', ')}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end gap-3">
                        <button onClick={() => setPendingPredefinedConfig(null)}
                          className="px-5 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-bold transition-colors">
                          Cancel
                        </button>
                        <button onClick={confirmPredefinedConfigChange}
                          className="px-5 py-2 text-sm bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition-colors">
                          Remove &amp; Apply
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─── OCR Config Section ─────────────────────────────── */}
            <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mt-6 transition-opacity duration-300 ${(!selectedStages.ocr || isStandaloneMode) ? 'hidden' : ''}`}>
              <div className="bg-gradient-to-r from-teal-50/80 to-cyan-50/60 px-6 py-4 border-b border-teal-100/60 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-teal-100 text-teal-600 mr-1">
                      <Eye className="w-4 h-4" />
                    </span>
                    OCR Configuration
                    {!selectedStages.ocr && <span className="text-xs font-medium text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">Disabled</span>}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">Set how OCR output is produced. Each option applies to the whole organization, or per subject where offered.</p>
                </div>
              </div>

              <div className="p-6 space-y-6">

                {/* OCR Setting 1: Standards Met Count */}
                <div className={`p-5 rounded-lg border border-gray-100 hover:border-violet-100 hover:shadow-md transition-all duration-200 bg-white group ${isStandaloneMode ? 'hidden' : ''}`}>
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col items-start">
                        <Label className="text-sm font-semibold text-gray-900 text-base">Standards Met Count</Label>
                        <p className="text-sm text-gray-500 mt-1 max-w-md">Include the number of standards each candidate has met in the OCR output.</p>
                      </div>
                    </div>

                    {/* Advanced unified control panel */}
                    <div className="flex flex-col gap-2 min-w-[300px]">
                      <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/60 to-white overflow-hidden shadow-sm">
                        <div className="p-3">
                          <div className="flex items-center justify-between bg-white rounded-lg border border-violet-100 px-3 py-2.5">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-600">Global status</span>
                              <span className={`text-[10px] mt-0.5 font-semibold ${isStandardsGlobalOn ? 'text-violet-600' : 'text-red-400'}`}>
                                {isStandardsGlobalOn ? '● Active for all subjects' : '○ Inactive globally'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${isStandardsGlobalOn ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
                                {isStandardsGlobalOn ? 'ON' : 'OFF'}
                              </span>
                              <Switch checked={isStandardsGlobalOn} onCheckedChange={(val) => {
                                setIsStandardsGlobalOn(val);
                                const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                                if (org) {
                                  const globalKey = `org_standards_count_${org.organizationcode}`;
                                  localStorage.setItem(globalKey, val ? '1' : '0');
                                }
                              }} className="data-[state=checked]:bg-violet-600" />
                            </div>
                          </div>

                          {/* With standards counted, the next question is whether
                              Evaluation is gated on threshold scores - and if it is,
                              what those thresholds are. */}
                          {isStandardsGlobalOn && (
                            <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                              <div className="flex items-center justify-between gap-3 bg-white rounded-lg border border-violet-100 px-3 py-2.5">
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium text-gray-600">Depends on threshold scores</span>
                                  <span className="text-[10px] mt-0.5 text-gray-400">
                                    Does the Evaluation workflow depend on threshold scores?
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${isThresholdDependent ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {isThresholdDependent ? 'YES' : 'NO'}
                                  </span>
                                  <Switch
                                    checked={isThresholdDependent}
                                    onCheckedChange={(val) => {
                                      setIsThresholdDependent(val);
                                      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                                      if (org) {
                                        localStorage.setItem(`org_threshold_dependent_${org.organizationcode}`, val ? '1' : '0');
                                      }
                                    }}
                                    className="data-[state=checked]:bg-violet-600"
                                  />
                                </div>
                              </div>

                              {isThresholdDependent && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                                  <div className="flex items-center justify-between bg-white rounded-lg border border-violet-100 px-3 py-2">
                                    <span className="text-xs font-medium text-gray-600">OCR threshold</span>
                                    <div className="w-20">
                                      <Input
                                        type="number"
                                        min={1}
                                        max={100}
                                        step={1}
                                        inputMode="numeric"
                                        placeholder={DEFAULT_THRESHOLD}
                                        value={ocrThreshold}
                                        onKeyDown={blockNonDigitCountKeys}
                                        onChange={(e) => {
                                          const val = toThresholdValue(e.target.value);
                                          setOcrThreshold(val);
                                          const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                                          if (org) localStorage.setItem(`org_ocr_threshold_${org.organizationcode}`, val || DEFAULT_THRESHOLD);
                                        }}
                                        className="text-center font-bold text-violet-700 py-1.5 text-sm border-violet-200 focus:border-violet-500 focus:ring-violet-100"
                                      />
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-gray-400 italic px-0.5">
                                    * Score out of 100. Defaults to {DEFAULT_THRESHOLD}.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* OCR Setting 2: Metadata */}
                {/* DISABLED: OCR Setting 2 - Metadata Present
                <div className="p-5 rounded-lg border border-gray-100 hover:border-teal-100 hover:shadow-md transition-all duration-200 bg-white group">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                        <Database className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col items-start">
                        <Label className="text-sm font-semibold text-gray-900 text-base">Metadata Present</Label>
                        <p className="text-sm text-gray-500 mt-1 max-w-md">Include the metadata OCR returns alongside the extracted text.</p>
                      </div>
                    </div>

                    [ Advanced unified control panel ]
                    <div className="flex flex-col gap-2 min-w-[300px]">
                      <div className="rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50/60 to-white overflow-hidden shadow-sm">
                        <div className="p-3">
                          <div className="flex items-center justify-between bg-white rounded-lg border border-teal-100 px-3 py-2.5">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-600">Global status</span>
                              <span className={`text-[10px] mt-0.5 font-semibold ${isMetadataGlobalOn ? 'text-teal-600' : 'text-red-400'}`}>
                                {isMetadataGlobalOn ? '● Active for all subjects' : '○ Inactive globally'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${isMetadataGlobalOn ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>
                                {isMetadataGlobalOn ? 'ON' : 'OFF'}
                              </span>
                              <Switch checked={isMetadataGlobalOn} onCheckedChange={(val) => {
                                setIsMetadataGlobalOn(val);
                                const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                                if (org) {
                                  const globalKey = `org_ocr_metadata_${org.organizationcode}`;
                                  localStorage.setItem(globalKey, val ? '1' : '0');
                                }
                              }} className="data-[state=checked]:bg-teal-600" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                */}

                {/* OCR Setting 3: Question Number Extraction */}
                {/* DISABLED: OCR Setting 3 - Question Number Extraction
                <div className="p-5 rounded-lg border border-gray-100 hover:border-cyan-100 hover:shadow-md transition-all duration-200 bg-white group">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                        <ListOrdered className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col items-start">
                        <Label className="text-sm font-semibold text-gray-900 text-base">Question Number Extraction</Label>
                        <p className="text-sm text-gray-500 mt-1 max-w-md">Read the question number written on each page so answers are matched to questions automatically.</p>
                      </div>
                    </div>

                    [ Advanced unified control panel ]
                    <div className="flex flex-col gap-2 min-w-[300px]">
                      <div className="rounded-xl border border-cyan-100 bg-gradient-to-br from-cyan-50/60 to-white overflow-hidden shadow-sm">
                        <div className="p-3">
                          <div className="flex items-center justify-between bg-white rounded-lg border border-cyan-100 px-3 py-2.5">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-600">Global status</span>
                              <span className={`text-[10px] mt-0.5 font-semibold ${isQNumGlobalOn ? 'text-cyan-600' : 'text-red-400'}`}>
                                {isQNumGlobalOn ? '● Active for all subjects' : '○ Inactive globally'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${isQNumGlobalOn ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-500'}`}>
                                {isQNumGlobalOn ? 'ON' : 'OFF'}
                              </span>
                              <Switch checked={isQNumGlobalOn} onCheckedChange={(val) => {
                                setIsQNumGlobalOn(val);
                                const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                                if (org) {
                                  const globalKey = `org_ocr_qnum_${org.organizationcode}`;
                                  localStorage.setItem(globalKey, val ? '1' : '0');
                                }
                              }} className="data-[state=checked]:bg-cyan-600" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                */}

              </div>
            </div>
            {/* ─── End OCR Config Section ──────────────────────────── */}

            <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mt-6 transition-opacity duration-300 ${!selectedStages.evaluation ? 'hidden' : ''}`}>
              <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>

                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">Evaluation Thresholds {!selectedStages.evaluation && <span className="text-xs font-medium text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">Disabled</span>}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Set how candidate scores are calculated, marked as pass or fail, and displayed.</p>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Setting 1: Pass Mark */}
                <div className="p-5 rounded-lg border border-gray-100 hover:border-emerald-100 hover:shadow-md transition-all duration-200 bg-white group">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                        <Award className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col items-start">
                        <Label className="text-sm font-semibold text-gray-900 text-base">Pass/Fail Mark Threshold</Label>
                        <p className="text-sm text-gray-500 mt-1 max-w-md">Scores equal to and above this value will be marked as pass and appear as <span className="font-medium text-emerald-600">green</span>.</p>
                        <button
                          onClick={() => setIsPassMarkExpanded(!isPassMarkExpanded)}
                          className="mt-3 px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200 rounded flex items-center gap-1.5 transition-all w-fit shadow-sm"
                        >
                          {isPassMarkExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {isPassMarkExpanded ? 'Hide' : 'View'} Subject wise change
                        </button>
                      </div>
                    </div>

                    {/* Advanced unified control panel */}
                    <div className="flex flex-col gap-2 min-w-[300px]">
                      <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-white overflow-hidden shadow-sm">
                        {/* Scope selector tabs */}
                        <div className="flex border-b border-emerald-100">
                          <button
                            onClick={() => {
                              setIsPassMarkSubjectSpecific(false);
                              const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                              if (org) {
                                const globalKey = `org_pass_mark_${org.organizationcode}`;
                                setPassMark(localStorage.getItem(globalKey) || '40');
                              }
                            }}
                            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                              !isPassMarkSubjectSpecific
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-transparent text-gray-500 hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${!isPassMarkSubjectSpecific ? 'bg-white' : 'bg-gray-300'}`} />
                            Global
                          </button>

                        </div>

                        {/* Value control area */}
                        <div className="p-3">
                          {isPassMarkSubjectSpecific ? (
                            <div className="flex flex-col gap-2">
                              <div className="relative">
                                <select
                                  value={passMarkSubjectCode}
                                  onChange={(e) => {
                                    const newSubj = e.target.value;
                                    setPassMarkSubjectCode(newSubj);
                                    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                                    if (org) {
                                      const subjKey = `org_pass_mark_${org.organizationcode}_${newSubj}`;
                                      const globalKey = `org_pass_mark_${org.organizationcode}`;
                                      const val = localStorage.getItem(subjKey) || localStorage.getItem(globalKey) || '40';
                                      setPassMark(val);
                                    }
                                  }}
                                  disabled={loadingSubjects}
                                  className="w-full px-3 py-2.5 pr-8 text-sm border border-emerald-200 rounded-lg bg-white shadow-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 appearance-none hover:border-emerald-300 transition-colors font-medium text-gray-700"
                                >
                                  {loadingSubjects ? <option value="">Loading...</option>
                                    : subjects.length > 0 ? subjects.map(s => <option key={s.subjectcode} value={s.subjectcode}>{s.subjectname}</option>)
                                    : <option value="">No subjects found</option>}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 pointer-events-none" />
                              </div>
                              <div className="flex items-center justify-between bg-white rounded-lg border border-emerald-100 px-3 py-2">
                                <span className="text-xs font-medium text-gray-600">Pass mark value</span>
                                <div className="w-20">
                                  <Input type="number" min="1" max="99" value={passMark} onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || (Number(val) >= 1 && Number(val) <= 99 && !val.includes('.'))) {
                                      setPassMark(val);
                                      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                                      if (org && passMarkSubjectCode) {
                                        const subjKey = `org_pass_mark_${org.organizationcode}_${passMarkSubjectCode}`;
                                        localStorage.setItem(subjKey, val || '40');
                                        setSubjects([...subjects]);
                                      }
                                    }
                                  }} placeholder="40"
                                    className="text-center font-bold text-emerald-700 py-1.5 text-sm border-emerald-200 focus:border-emerald-500 focus:ring-emerald-100" />
                                </div>
                              </div>
                              <p className="text-[10px] text-gray-400 italic px-0.5">* Applies to this subject only and overrides the global value.</p>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between bg-white rounded-lg border border-emerald-100 px-3 py-2.5">
                              <div className="flex flex-col">
                                <span className="text-xs font-medium text-gray-600">Global pass mark</span>
                                <span className="text-[10px] mt-0.5 font-semibold text-emerald-600">
                                  ● Applies to all subjects
                                </span>
                              </div>
                              <div className="w-20">
                                <Input type="number" min="1" max="99" value={passMark} onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || (Number(val) >= 1 && Number(val) <= 99 && !val.includes('.'))) {
                                    setPassMark(val);
                                    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                                    if (org) {
                                      const globalKey = `org_pass_mark_${org.organizationcode}`;
                                      localStorage.setItem(globalKey, val || '40');
                                      setSubjects([...subjects]);
                                    }
                                  }
                                }} placeholder="40"
                                  className="text-center font-bold text-emerald-700 py-1.5 text-sm border-emerald-200 focus:border-emerald-500 focus:ring-emerald-100" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isPassMarkExpanded && (
                    <div className="mt-5 pt-4 border-t border-gray-50">
                      <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2">
                        {subjects.map(s => {
                          const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                          if (!org) return null;
                          const subjKey = `org_pass_mark_${org.organizationcode}_${s.subjectcode}`;
                          const subjVal = localStorage.getItem(subjKey);
                          const isOverride = !!subjVal;
                          return (
                            // A subject without its own value simply follows the global pass
                            // mark, so it shows that number plainly; only an override is highlighted.
                            // Indigo, not emerald/green, marks "this subject has an override" -
                            // green here is reserved for "this score passes" (see the heading
                            // above), and a card for a low override value showing green would
                            // read as if it were itself a passing score.
                            <div key={s.subjectcode} className={`p-3 rounded-lg border text-sm flex justify-between items-center transition-colors ${isOverride ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200' : 'bg-gray-50 border-gray-100'}`}>
                              <div className="min-w-0 mr-2">
                                <span className={`font-medium truncate block text-xs ${isOverride ? 'text-indigo-900' : 'text-gray-700'}`} title={s.subjectname}>{s.subjectname}</span>
                                <span className={`text-[10px] ${isOverride ? 'text-indigo-600' : 'text-gray-400'}`}>
                                  {isOverride ? 'Subject override' : 'Global value'}
                                </span>
                              </div>
                              <div className="flex items-center shrink-0">
                                <input
                                  type="number"
                                  min="1"
                                  max="99"
                                  value={passMarkDrafts[s.subjectcode] ?? (isOverride ? subjVal : (passMark || '40'))}
                                  title={isOverride
                                    ? 'Clear this field to go back to the global pass mark'
                                    : 'Global pass mark - enter a value to override it for this subject'}
                                  placeholder={passMark || '40'}
                                  onFocus={() => setPassMarkDraft(s.subjectcode, isOverride ? (subjVal || '') : '')}
                                  onBlur={() => setPassMarkDraft(s.subjectcode, null)}
                                  onChange={(e) => {
                                    const newVal = e.target.value;
                                    if (newVal === '' || (Number(newVal) >= 1 && Number(newVal) <= 99 && !newVal.includes('.'))) {
                                      // Backspacing to empty drops the override; the card shows the
                                      // global value again once the field loses focus.
                                      setPassMarkDraft(s.subjectcode, newVal);
                                      if (newVal === '') {
                                        localStorage.removeItem(subjKey);
                                      } else {
                                        localStorage.setItem(subjKey, newVal);
                                      }
                                      if (isPassMarkSubjectSpecific && passMarkSubjectCode === s.subjectcode) {
                                        setPassMark(newVal || passMark);
                                      }
                                      setSubjects([...subjects]);
                                    }
                                  }}
                                  className={`w-16 px-2 py-1 rounded text-xs font-bold text-center outline-none border transition-colors ${isOverride ? 'border-emerald-300 bg-emerald-100 text-emerald-700' : 'border-transparent bg-gray-200 text-gray-500'}`}
                                />
                                {/* Only a subject that carries its own value has anything to clear,
                                    so the button appears once a value is entered and disappears
                                    again when the subject is back on the global pass mark. */}
                                {isOverride && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      localStorage.removeItem(subjKey);
                                      setPassMarkDraft(s.subjectcode, null);
                                      setSubjects([...subjects]);
                                      toast.info(`${s.subjectname} now uses the global pass mark (${passMark || '40'}).`);
                                    }}
                                    title="Clear this value and use the global pass mark"
                                    aria-label={`Clear pass mark override for ${s.subjectname}`}
                                    className="ml-1 p-1 rounded text-emerald-600 hover:bg-emerald-100 transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Setting 1.5: Prompt Selection */}
                <div className="p-5 rounded-lg border border-gray-100 hover:border-purple-100 hover:shadow-md transition-all duration-200 bg-white group">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col items-start">
                        <Label className="text-sm font-semibold text-gray-900 text-base">Select AI Prompt</Label>
                        <p className="text-sm text-gray-500 mt-1 max-w-md">Choose the prompt the AI uses when evaluating answers. It is applied to every script processed for this organization.</p>
                        <button
                          onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                          className="mt-3 px-3 py-1.5 text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 border border-purple-200 rounded flex items-center gap-1.5 transition-all w-fit shadow-sm"
                        >
                          {isPromptExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {isPromptExpanded ? 'Hide' : 'View'} Subject wise change
                        </button>
                      </div>
                    </div>

                    {/* Advanced unified control panel */}
                    <div className="flex flex-col gap-2 min-w-[300px]">
                      <div className="rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50/60 to-white overflow-hidden shadow-sm">
                        <div className="flex border-b border-purple-100">
                          <button
                            onClick={() => setIsPromptSubjectSpecific(false)}
                            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                              !isPromptSubjectSpecific ? 'bg-purple-600 text-white shadow-sm' : 'bg-transparent text-gray-500 hover:bg-purple-50 hover:text-purple-700'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${!isPromptSubjectSpecific ? 'bg-white' : 'bg-gray-300'}`} />
                            Global
                          </button>

                        </div>
                        <div className="p-3">
                          {isPromptSubjectSpecific ? (
                            <div className="flex flex-col gap-2">
                              <div className="relative">
                                <select
                                  value={promptSubjectCode}
                                  onChange={(e) => setPromptSubjectCode(e.target.value)}
                                  disabled={loadingSubjects}
                                  className="w-full px-3 py-2.5 pr-8 text-sm border border-purple-200 rounded-lg bg-white shadow-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 appearance-none hover:border-purple-300 transition-colors font-medium text-gray-700"
                                >
                                  {loadingSubjects ? <option value="">Loading...</option>
                                    : subjects.length > 0 ? subjects.map(s => <option key={s.subjectcode} value={s.subjectcode}>{s.subjectname}</option>)
                                    : <option value="">No subjects found</option>}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 pointer-events-none" />
                              </div>
                              <div className="flex flex-row gap-1.5 mt-1">
                                {[
                                  { value: 'generic', label: 'Generic', icon: '✦', color: 'purple' },
                                  { value: 'math',    label: 'Math',    icon: '∑', color: 'blue'   },
                                  { value: 'chemistry', label: 'Chemistry', icon: '⚗', color: 'teal' },
                                ].map(p => (
                                  <button
                                    key={p.value}
                                    type="button"
                                    onClick={() => {
                                      setSelectedPrompt(p.value);
                                      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                                      if (org && promptSubjectCode) {
                                        const subjKey = `org_prompt_${org.organizationcode}_${promptSubjectCode}`;
                                        localStorage.setItem(subjKey, p.value);
                                        setSubjects([...subjects]);
                                      }
                                    }}
                                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg border-2 text-center transition-all duration-200 flex-1 ${
                                      selectedPrompt === p.value
                                        ? p.color === 'purple' ? 'border-purple-400 bg-purple-50 shadow-sm'
                                          : p.color === 'blue'   ? 'border-blue-400 bg-blue-50 shadow-sm'
                                          : 'border-teal-400 bg-teal-50 shadow-sm'
                                        : 'border-gray-100 bg-white hover:border-gray-300'
                                    }`}
                                  >
                                    <span className={`text-sm w-6 h-6 flex items-center justify-center rounded-full shrink-0 font-bold ${
                                      selectedPrompt === p.value
                                        ? p.color === 'purple' ? 'bg-purple-100 text-purple-700'
                                          : p.color === 'blue'   ? 'bg-blue-100 text-blue-700'
                                          : 'bg-teal-100 text-teal-700'
                                        : 'bg-gray-100 text-gray-500'
                                    }`}>{p.icon}</span>
                                    <p className={`text-[10px] font-bold leading-tight ${
                                      selectedPrompt === p.value
                                        ? p.color === 'purple' ? 'text-purple-800'
                                          : p.color === 'blue'   ? 'text-blue-800'
                                          : 'text-teal-800'
                                        : 'text-gray-600'
                                    }`}>{p.label}</p>
                                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                                      selectedPrompt === p.value
                                        ? p.color === 'purple' ? 'border-purple-500 bg-purple-500'
                                          : p.color === 'blue'   ? 'border-blue-500 bg-blue-500'
                                          : 'border-teal-500 bg-teal-500'
                                        : 'border-gray-300 bg-white'
                                    }`}>
                                      {selectedPrompt === p.value && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                                    </span>
                                  </button>
                                ))}
                              </div>
                              <p className="text-[10px] text-gray-400 italic px-0.5">* Applies to this subject only and overrides the global value.</p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 bg-white rounded-xl border border-purple-100 px-3 py-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-gray-600">Global Prompt</span>
                                <span className="text-[10px] font-semibold text-purple-600">● Applies to all subjects</span>
                              </div>
                              <div className="flex flex-row gap-1.5">
                                {[
                                  { value: 'generic', label: 'Generic', icon: '✦', color: 'purple' },
                                  { value: 'math',    label: 'Math',    icon: '∑', color: 'blue'   },
                                  { value: 'chemistry', label: 'Chemistry', icon: '⚗', color: 'teal' },
                                ].map(p => (
                                  <button
                                    key={p.value}
                                    type="button"
                                    onClick={() => {
                                      setSelectedPrompt(p.value);
                                      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                                      if (org) {
                                        const globalKey = `org_prompt_${org.organizationcode}`;
                                        localStorage.setItem(globalKey, p.value);
                                        setSubjects([...subjects]);
                                      }
                                    }}
                                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg border-2 text-center transition-all duration-200 flex-1 ${
                                      selectedPrompt === p.value
                                        ? p.color === 'purple' ? 'border-purple-400 bg-purple-50 shadow-sm'
                                          : p.color === 'blue'   ? 'border-blue-400 bg-blue-50 shadow-sm'
                                          : 'border-teal-400 bg-teal-50 shadow-sm'
                                        : 'border-gray-100 bg-white hover:border-gray-300'
                                    }`}
                                  >
                                    <span className={`text-sm w-6 h-6 flex items-center justify-center rounded-full shrink-0 font-bold ${
                                      selectedPrompt === p.value
                                        ? p.color === 'purple' ? 'bg-purple-100 text-purple-700'
                                          : p.color === 'blue'   ? 'bg-blue-100 text-blue-700'
                                          : 'bg-teal-100 text-teal-700'
                                        : 'bg-gray-100 text-gray-500'
                                    }`}>{p.icon}</span>
                                    <p className={`text-[10px] font-bold leading-tight ${
                                      selectedPrompt === p.value
                                        ? p.color === 'purple' ? 'text-purple-800'
                                          : p.color === 'blue'   ? 'text-blue-800'
                                          : 'text-teal-800'
                                        : 'text-gray-600'
                                    }`}>{p.label}</p>
                                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                                      selectedPrompt === p.value
                                        ? p.color === 'purple' ? 'border-purple-500 bg-purple-500'
                                          : p.color === 'blue'   ? 'border-blue-500 bg-blue-500'
                                          : 'border-teal-500 bg-teal-500'
                                        : 'border-gray-300 bg-white'
                                    }`}>
                                      {selectedPrompt === p.value && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isPromptExpanded && (
                    <div className="mt-5 pt-4 border-t border-gray-50">
                      <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2">
                        {subjects.map(s => {
                          const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                          if (!org) return null;
                          const subjKey = `org_prompt_${org.organizationcode}_${s.subjectcode}`;
                          const globalKey = `org_prompt_${org.organizationcode}`;
                          const val = localStorage.getItem(subjKey) || localStorage.getItem(globalKey) || 'generic';
                          const isOverride = !!localStorage.getItem(subjKey);
                          const promptMeta: Record<string, { label: string; icon: string; color: string }> = {
                            generic: { label: 'Generic', icon: '✦', color: 'bg-purple-100 text-purple-700' },
                            math:    { label: 'Math',    icon: '∑', color: 'bg-blue-100 text-blue-700' },
                            chemistry: { label: 'Chemistry', icon: '⚗', color: 'bg-teal-100 text-teal-700' },
                          };
                          const meta = promptMeta[val] ?? { label: val, icon: '', color: isOverride ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600' };
                          return (
                            <div key={s.subjectcode} className={`p-3 rounded-lg border text-sm flex justify-between items-center transition-colors ${isOverride ? 'bg-purple-50/50 border-purple-100' : 'bg-gray-50 border-gray-100'}`}>
                              <span className="font-medium text-gray-700 truncate mr-2 text-xs" title={s.subjectname}>{s.subjectname}</span>
                              <div className="relative">
                                <select
                                  value={val}
                                  onChange={(e) => {
                                    const newVal = e.target.value;
                                    localStorage.setItem(subjKey, newVal);
                                    setSubjects(prev => [...prev]); // Force re-render to reflect new override
                                  }}
                                  className={`appearance-none cursor-pointer flex items-center gap-1 pl-2 pr-6 py-1 rounded text-xs font-bold outline-none transition-colors border ${isOverride ? 'border-purple-200' : 'border-transparent'} ${meta.color}`}
                                >
                                  <option value="generic">✦ Generic</option>
                                  <option value="math">∑ Math</option>
                                  <option value="chemistry">⚗ Chemistry</option>
                                </select>
                                <ChevronDown className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${isOverride ? 'text-purple-500' : 'text-gray-500'}`} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Setting 2: Top Q Count */}
                <div className="p-5 rounded-lg border border-gray-100 hover:border-blue-100 hover:shadow-md transition-all duration-200 bg-white group">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                        <ListOrdered className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col items-start">
                        <Label className="text-sm font-semibold text-gray-900 text-base">Top N Questions</Label>
                        <p className="text-sm text-gray-500 mt-1 max-w-md">Only sum the marks of the top <span className="font-medium text-blue-600">N</span> highest scoring questions per candidate.</p>
                        <button
                          onClick={() => setIsTopQExpanded(!isTopQExpanded)}
                          className="mt-3 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border border-blue-200 rounded flex items-center gap-1.5 transition-all w-fit shadow-sm"
                        >
                          {isTopQExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {isTopQExpanded ? 'Hide' : 'View'} Subject wise change
                        </button>
                      </div>
                    </div>

                    {/* Advanced unified control panel */}
                    <div className="flex flex-col gap-2 min-w-[300px]">
                      <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/60 to-white overflow-hidden shadow-sm">
                        <div className="flex border-b border-blue-100">
                          <button
                            onClick={() => {
                              setIsTopQSubjectSpecific(false);
                              const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                              if (org) {
                                const globalKey = `org_top_questions_${org.organizationcode}`;
                                setTopQuestionsCount(localStorage.getItem(globalKey) || TOP_Q_DEFAULT);
                              }
                            }}
                            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                              !isTopQSubjectSpecific ? 'bg-blue-600 text-white shadow-sm' : 'bg-transparent text-gray-500 hover:bg-blue-50 hover:text-blue-700'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${!isTopQSubjectSpecific ? 'bg-white' : 'bg-gray-300'}`} />
                            Global
                          </button>

                        </div>
                        <div className="p-3">
                          {isTopQSubjectSpecific ? (
                            <div className="flex flex-col gap-2">
                              <div className="relative">
                                <select
                                  value={topQSubjectCode}
                                  onChange={(e) => {
                                    const newSubj = e.target.value;
                                    setTopQSubjectCode(newSubj);
                                    const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                                    if (org) {
                                      const subjKey = `org_top_questions_${org.organizationcode}_${newSubj}`;
                                      const globalKey = `org_top_questions_${org.organizationcode}`;
                                      const val = localStorage.getItem(subjKey) || localStorage.getItem(globalKey) || '';
                                      setTopQuestionsCount(val);
                                    }
                                  }}
                                  disabled={loadingSubjects}
                                  className="w-full px-3 py-2.5 pr-8 text-sm border border-blue-200 rounded-lg bg-white shadow-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 appearance-none hover:border-blue-300 transition-colors font-medium text-gray-700"
                                >
                                  {loadingSubjects ? <option value="">Loading...</option>
                                    : subjects.length > 0 ? subjects.map(s => <option key={s.subjectcode} value={s.subjectcode}>{s.subjectname}</option>)
                                    : <option value="">No subjects found</option>}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 pointer-events-none" />
                              </div>
                                  <div className="flex items-center justify-between bg-white rounded-lg border border-blue-100 px-3 py-2">
                                <span className="text-xs font-medium text-gray-600">Top N / Total</span>
                                <div className="relative">
                                  <TopQFractionInput
                                    value={topQuestionsCount}
                                    invalid={!!topQError}
                                    lockedTotal={predefinedQuestionTotal || undefined}
                                    title="Numerator / Denominator, e.g. 2/6"
                                    onChange={(val) => {
                                      // Accept every keystroke so the user can see what they typed,
                                      // then validate live and only persist a value that passes.
                                      setTopQuestionsCount(val);
                                      const validationError = validateTopQValue(val);
                                      setTopQError(validationError);
                                      if (validationError) return;
                                      const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                                      if (org && topQSubjectCode) {
                                        const subjKey = `org_top_questions_${org.organizationcode}_${topQSubjectCode}`;
                                        if (isTopQUnset(val)) localStorage.removeItem(subjKey);
                                        else localStorage.setItem(subjKey, val.trim());
                                        setSubjects([...subjects]);
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                              {topQError && <p className="text-[11px] text-red-500 font-semibold px-0.5 mt-1">{topQError}</p>}
                              <p className="text-[10px] text-gray-400 italic px-0.5">* Applies to this subject only and overrides the global value.</p>
                            </div>
                          ) : (
                              <>
                                <div className="flex items-center justify-between bg-white rounded-lg border border-blue-100 px-3 py-2.5">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-medium text-gray-600">Global Top N / Total</span>
                                    <span className="text-[10px] mt-0.5 font-semibold text-blue-600">● Applies to all subjects</span>
                                  </div>
                                  <div className="relative">
                                    <TopQFractionInput
                                      value={topQuestionsCount}
                                      invalid={!!topQError}
                                      lockedTotal={predefinedQuestionTotal || undefined}
                                      title="Numerator / Denominator, e.g. 2/6"
                                      onChange={(val) => {
                                        // Same contract as the subject-specific field above:
                                        // show every keystroke, persist only a valid entry.
                                        setTopQuestionsCount(val);
                                        const validationError = validateTopQValue(val);
                                        setTopQError(validationError);
                                        if (validationError) return;
                                        const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                                        if (org) {
                                          const globalKey = `org_top_questions_${org.organizationcode}`;
                                          if (isTopQUnset(val)) localStorage.removeItem(globalKey);
                                          else localStorage.setItem(globalKey, val.trim());
                                          setSubjects([...subjects]);
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                                {topQError && <p className="text-[11px] text-red-500 font-semibold px-0.5 mt-1">{topQError}</p>}
                              </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isTopQExpanded && (
                    <div className="mt-5 pt-4 border-t border-gray-50">
                      <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2">
                        {subjects.map(s => {
                          const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                          if (!org) return null;
                          const subjKey = `org_top_questions_${org.organizationcode}_${s.subjectcode}`;
                          const subjVal = localStorage.getItem(subjKey);
                          const isOverride = !!subjVal;
                          const draft = topQSubjectDrafts[s.subjectcode];
                          // An in-flight draft wins so a rejected entry stays on screen.
                          const displayValue = draft !== undefined ? draft : (isOverride ? subjVal : '');
                          const subjError = topQSubjectErrors[s.subjectcode];
                          return (
                            // A subject without its own entry simply follows the global Top N,
                            // so it shows that value plainly; only an override is highlighted.
                            <div key={s.subjectcode} className={`p-3 rounded-lg border text-sm transition-colors ${subjError ? 'bg-red-50/50 border-red-200' : isOverride ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-gray-50 border-gray-100'}`}>
                              <div className="flex justify-between items-center">
                                <div className="min-w-0 mr-2">
                                  <span className={`font-medium truncate block text-xs ${isOverride ? 'text-blue-900' : 'text-gray-700'}`} title={s.subjectname}>{s.subjectname}</span>
                                  <span className={`text-[10px] ${isOverride ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {isOverride ? 'Subject override' : 'Global value'}
                                  </span>
                                </div>
                                <div className="flex items-center shrink-0">
                                <TopQFractionInput
                                  value={displayValue}
                                  invalid={!!subjError}
                                  compact
                                  showInherited
                                  lockedTotal={predefinedQuestionTotal || undefined}
                                  title={`Numerator / Denominator — inherits ${isTopQUnset(topQuestionsCount) ? 'All' : topQuestionsCount}`}
                                  inherited={isTopQUnset(topQuestionsCount) ? '' : topQuestionsCount}
                                  onChange={(newVal) => {
                                    setTopQSubjectDrafts(prev => ({ ...prev, [s.subjectcode]: newVal }));
                                    const validationError = validateTopQValue(newVal);
                                    setTopQSubjectErrors(prev => {
                                      const next = { ...prev };
                                      if (validationError) next[s.subjectcode] = validationError;
                                      else delete next[s.subjectcode];
                                      return next;
                                    });
                                    if (validationError) return;
                                    if (isTopQUnset(newVal)) {
                                      localStorage.removeItem(subjKey);
                                    } else {
                                      localStorage.setItem(subjKey, newVal.trim());
                                    }
                                    if (isTopQSubjectSpecific && topQSubjectCode === s.subjectcode) {
                                      setTopQuestionsCount(newVal.trim() || topQuestionsCount);
                                    }
                                    setSubjects([...subjects]);
                                  }}
                                />
                                {/* Only a subject carrying its own entry has anything to clear. */}
                                {isOverride && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      localStorage.removeItem(subjKey);
                                      setTopQSubjectDrafts(prev => {
                                        const next = { ...prev };
                                        delete next[s.subjectcode];
                                        return next;
                                      });
                                      setTopQSubjectErrors(prev => {
                                        const next = { ...prev };
                                        delete next[s.subjectcode];
                                        return next;
                                      });
                                      setSubjects([...subjects]);
                                      toast.info(`${s.subjectname} now uses the global Top N (${isTopQUnset(topQuestionsCount) ? 'All' : topQuestionsCount}).`);
                                    }}
                                    title="Clear this value and use the global Top N"
                                    aria-label={`Clear Top N override for ${s.subjectname}`}
                                    className="ml-1 p-1 rounded text-blue-600 hover:bg-blue-100 transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                </div>
                              </div>
                              {subjError && <p className="text-[10px] text-red-500 font-semibold mt-1.5 leading-snug">{subjError}</p>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Setting 4: Re-evaluation Agent Validation */}
                <div className="p-5 rounded-lg border border-gray-100 hover:border-indigo-100 hover:shadow-md transition-all duration-200 bg-white group">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col items-start">
                        <Label className="text-sm font-semibold text-gray-900 text-base">Live-evaluation Agent</Label>
                        <p className="text-sm text-gray-500 mt-1 max-w-md">Ask an evaluator to review the AI score and evaluation data before results are finalized.</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 min-w-[300px]">
                      <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white overflow-hidden shadow-sm">
                        <div className="p-3">
                          <div className="flex items-center justify-between bg-white rounded-lg border border-indigo-100 px-3 py-2.5">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-600">Global status</span>
                              <span className={`text-[10px] mt-0.5 font-semibold ${isReevalAgentGlobalOn ? 'text-indigo-600' : 'text-red-400'}`}>
                                {isReevalAgentGlobalOn ? '● Active globally' : '○ Inactive globally'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${isReevalAgentGlobalOn ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                                {isReevalAgentGlobalOn ? 'ON' : 'OFF'}
                              </span>
                              <Switch checked={isReevalAgentGlobalOn} onCheckedChange={(val) => {
                                setIsReevalAgentGlobalOn(val);
                                const org = organizations.find(o => String(o.organizationid) === selectedOrg);
                                if (org) {
                                  const globalKey = `org_reeval_agent_${org.organizationcode}`;
                                  localStorage.setItem(globalKey, val ? '1' : '0');
                                }
                              }} className="data-[state=checked]:bg-indigo-600" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}
      </div>
      <div className="absolute bottom-8 right-8 z-10">
        <Button
          onClick={handleSaveToDB}
          className="bg-[#2563eb] hover:bg-blue-600 px-8 shadow-xl shadow-blue-500/20 rounded-full h-12"
        >
          <Save className="w-5 h-5 mr-2" />
          Save Settings
        </Button>
      </div>
    </div>
  );
};



// ─── Role Management Section ───────────────────────────────────────────────
const CONFIG_PRIVILEGES = [
  { id: 'all', label: 'All (Full Access)' },
  { id: 'config:stages', label: 'Choosing of Stages' },
  { id: 'config:answerScript', label: 'Configuring Answer Script' },
  { id: 'config:standardsMet', label: 'Standards Met Count' },
  { id: 'config:passFail', label: 'Pass/Fail Mark Threshold' },
  { id: 'config:topN', label: 'Top N Questions to Count' },
  { id: 'config:liveEval', label: 'Live-evaluation Agent' },
];

const ROLE_OPTIONS = [
  { id: 'admin', label: 'Admin' },
  { id: 'user', label: 'User' },
];

const RoleManagementSection = () => {
  const API_BASE1 = import.meta.env.VITE_AIMARKING_API_BASE || 'https://icmeprod.excelsoftcorp.com/AIMarkingAPI/api';
  
  const loggedInRole = typeof window !== 'undefined' ? (sessionStorage.getItem('userRole') || 'superadmin').toLowerCase() : 'superadmin';
  const loggedInCustomer = typeof window !== 'undefined' ? sessionStorage.getItem('customerCode') || 'ICME' : 'ICME';
  const loggedInOrg = typeof window !== 'undefined' ? sessionStorage.getItem('orgCode') || '' : '';
  const isAdmin = loggedInRole === 'admin';

  const [selectedCustomer, setSelectedCustomer] = React.useState(isAdmin ? loggedInCustomer : 'ICME');
  const [customerList, setCustomerList] = React.useState<any[]>([]);
  const [organizations, setOrganizations] = React.useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = React.useState(isAdmin ? loggedInOrg : '');
  const [loadingOrgs, setLoadingOrgs] = React.useState(true);

  const [roleList, setRoleList] = React.useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const [showModal, setShowModal] = React.useState(false);
  const [editItem, setEditItem] = React.useState<any>(null);

  // Action Modals State
  const [actionConfirm, setActionConfirm] = React.useState<{type: 'Approve' | 'Reject' | 'Delete' | null, id: string | null}>({ type: null, id: null });

  // Form state for Edit/Create
  const [formFirstName, setFormFirstName] = React.useState('');
  const [formLastName, setFormLastName] = React.useState('');
  const [formEmail, setFormEmail] = React.useState('');
  const [formContactNumber, setFormContactNumber] = React.useState('');
  const [formAddress, setFormAddress] = React.useState('');
  
  const [formUsername, setFormUsername] = React.useState('');
  const [formPassword, setFormPassword] = React.useState('');
  // Show/hide toggle for the password field. The Edit and Create modals are
  // never open at once and share formPassword, so one flag covers both.
  const [showFormPassword, setShowFormPassword] = React.useState(false);
  const [formFromDate, setFormFromDate] = React.useState('');
  const [formToDate, setFormToDate] = React.useState('');
  const [formStatus, setFormStatus] = React.useState('Active');
  // The values the edit dialog opened with. Save Changes stays disabled until one
  // of the fields differs from this snapshot.
  const [editSnapshot, setEditSnapshot] = React.useState<Record<string, string> | null>(null);
  const [formCustomer, setFormCustomer] = React.useState('');
  const [formOrg, setFormOrg] = React.useState('');
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  // Advanced Add User Modal State
  const [showAdvancedAddUser, setShowAdvancedAddUser] = React.useState(false);
  const [advUsername, setAdvUsername] = React.useState('');
  const [advPassword, setAdvPassword] = React.useState('');
  const [advFromDate, setAdvFromDate] = React.useState('');
  const [advToDate, setAdvToDate] = React.useState('');
  const [advStatus, setAdvStatus] = React.useState('Active');

  // Filter state
  const [filterStatus, setFilterStatus] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Fetch customer list on mount
  React.useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await fetch(`${API_BASE1}/customer-details`);
        const data = await res.json();
        const custData = data.data || data || [];
        if (Array.isArray(custData) && custData.length > 0) {
          setCustomerList(custData);
        } else {
          setCustomerList([{ customercode: 'ICME', customername: 'ICME' }]);
        }
      } catch {
        setCustomerList([{ customercode: 'ICME', customername: 'ICME' }]);
      }
    };
    fetchCustomers();
  }, []);

  React.useEffect(() => {
    const fetchOrgs = async () => {
      setLoadingOrgs(true);
      try {
        const res = await fetch(`${API_BASE1}/organization-details?CustCode=${selectedCustomer || 'ICME'}`);
        const data = await res.json();
        const orgData = data.data || data || [];
        setOrganizations(orgData);
        if (orgData.length > 0) {
          setSelectedOrg(String(orgData[0].organizationid));
        }
      } catch { setOrganizations([]); } finally { setLoadingOrgs(false); }
    };
    fetchOrgs();
  }, [selectedCustomer]);

  const fetchUsers = React.useCallback(async () => {
    if (!selectedCustomer || !selectedOrg) return;
    setLoadingUsers(true);
    try {
      const userCode = sessionStorage.getItem('username') || sessionStorage.getItem('userCode') || 'superadmin';
      // Resolve org name from the organizations list; fall back to selectedOrg if not found
      const orgName = organizations.find(o => String(o.organizationid) === String(selectedOrg))?.organizationname || selectedOrg;
      const url = `${API_BASE1}/get-user-details?UserCode=${userCode}&OrgCode=${encodeURIComponent(orgName)}&CustCode=${selectedCustomer}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data && data.userDetails) {
        // Map API payload to internal structure and filter out admins
        const mappedUsers = data.userDetails
          .filter((u: any) => (u.userrole || '').toLowerCase() !== 'admin')
          .map((u: any, idx: number) => ({
            id: u.usercode, // use usercode as id
            userid: u.userid || u.userId || u.user_id || 0, // numeric primary key for edit payload
            customer: u.customercode,
            orgId: u.organizationcode,
            orgName: u.organizationname,
            username: (u.username || '').trim(),
            usercode: u.usercode,
            fromDate: u.fromdate,
            toDate: u.todate,
            status: resolveUserStatus(u.fromdate, u.todate, u.active ?? u.activestatus),
            active: u.active ?? u.activestatus,
            role: (u.userrole || '').toLowerCase(),
            // Profile fields for pre-filling the Edit modal
            firstName: u.firstname || u.firstName || '',
            lastName: u.lastname || u.lastName || '',
            // The API names these gmail / contact_number / password_hash; the other
            // spellings are kept so older payloads keep working.
            email: u.gmail || u.email || u.emailid || '',
            contactNumber: u.contact_number || u.contactnumber || u.contactNumber || u.contact || u.phone || '',
            password: u.password_hash || u.passwordHash || u.password || '',
            address: u.address || ''
          }));
        setRoleList(mappedUsers);
      } else {
        setRoleList([]);
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
      setRoleList([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [selectedCustomer, selectedOrg, organizations, API_BASE1]);

  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const saveList = (list) => {
    setRoleList(list);
  };

  const currentOrgName = organizations.find(o => String(o.organizationid) === selectedOrg)?.organizationname || selectedOrg;

  const filteredRoles = roleList.filter(r => {
    const matchCustomer = (r.customer || '').trim() === (selectedCustomer || '').trim();
    const matchOrg = (selectedOrg === '' || r.orgId === selectedOrg || r.orgId === currentOrgName || r.orgId === sessionStorage.getItem('orgCode') || r.orgId === '');
    const matchRole = !(isAdmin && r.role === 'admin');
    
    const matchStatus = filterStatus ? r.status === filterStatus : true;
    
    const searchStr = searchQuery.toLowerCase();
    const matchSearch = !searchQuery || 
      (r.username || '').toLowerCase().includes(searchStr) || 
      (r.usercode || '').toLowerCase().includes(searchStr);

    return matchCustomer && matchOrg && matchRole && matchStatus && matchSearch;
  });

  // True once any field in the edit dialog differs from the values it opened with.
  const hasEditChanges = React.useMemo(() => {
    if (!editSnapshot) return false;
    const current: Record<string, string> = {
      username: formUsername,
      password: formPassword,
      firstName: formFirstName,
      lastName: formLastName,
      email: formEmail,
      contactNumber: formContactNumber,
      address: formAddress,
      fromDate: formFromDate,
      toDate: formToDate,
      status: String(formStatus ?? ''),
    };
    return Object.keys(current).some(key => (current[key] ?? '') !== (editSnapshot[key] ?? ''));
  }, [editSnapshot, formUsername, formPassword, formFirstName, formLastName, formEmail,
    formContactNumber, formAddress, formFromDate, formToDate, formStatus]);

  const openEdit = (item: any) => {
    setEditItem(item);
    setFormUsername(item.usercode || item.username || '');
    setFormPassword(item.password || '');
    
    // Parse First/Last name from username if explicit fields are missing
    let fName = item.firstName || item.firstname || '';
    let lName = item.lastName || item.lastname || '';
    const fullName = (item.username || '').trim();
    if (!fName && fullName) {
      const parts = fullName.split(' ');
      fName = parts[0] || '';
      lName = parts.slice(1).join(' ') || '';
    }
    
    setFormFirstName(fName);
    setFormLastName(lName);
    setFormEmail(item.email || '');
    setFormContactNumber(item.contactNumber || item.contactnumber || item.contact || '');
    setFormAddress(item.address || '');
    // Read as local calendar dates: toISOString() reports UTC, which pre-fills the
    // previous day for anyone west of UTC.
    setFormFromDate(toDateInputValue(item.fromDate));
    setFormToDate(toDateInputValue(item.toDate));
    setFormStatus(item.status);
    setShowFormPassword(false); // always reopen masked
    setEditSnapshot({
      username: item.usercode || item.username || '',
      password: item.password || '',
      firstName: fName,
      lastName: lName,
      email: item.email || '',
      contactNumber: item.contactNumber || item.contactnumber || item.contact || '',
      address: item.address || '',
      fromDate: toDateInputValue(item.fromDate),
      toDate: toDateInputValue(item.toDate),
      status: String(item.status ?? ''),
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditItem(null);
    setEditSnapshot(null);
    setFormUsername('');
    setFormPassword('');
    setFormCustomer('');
    setFormOrg(selectedOrg);
    setFormFromDate('');
    setFormToDate('');
    setFormFirstName('');
    setFormLastName('');
    setFormEmail('');
    setFormContactNumber('');
    setFormAddress('');
    setShowFormPassword(false); // always reopen masked
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (editItem) {
      await handleEditSave();
    }
    setShowModal(false);
  };

  const handleEditSave = async () => {
    // Validate required fields. Same required set as the Create dialog, so the
    // two forms ask for exactly the same data.
    if (!formFirstName.trim() || !formEmail.trim() || !formPassword.trim() || !formFromDate || !formToDate) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (new Date(formToDate) < new Date(formFromDate)) {
      toast.error('To Active Date  cannot be earlier than From Active Date .');
      return;
    }
    
    if (formFirstName.trim() && (!/^[A-Za-z\s]+$/.test(formFirstName.trim()) || formFirstName.trim().length > 60)) {
      toast.error('First Name must contain only letters and spaces (max 60 chars).');
      return;
    }
    if (formFirstName.trim() && formFirstName.trim().length < 3) {
      toast.error('First Name must contain at least 3 characters.');
      return;
    }
    if (formLastName.trim() && (!/^[A-Za-z\s]+$/.test(formLastName.trim()) || formLastName.trim().length > 60)) {
      toast.error('Last Name must contain only letters and spaces (max 60 chars).');
      return;
    }
    if (formLastName.trim() && formLastName.trim().length < 1) {
      toast.error('Last Name must contain at least 1 character.');
      return;
    }
    if (formAddress.trim().length > 100) {
      toast.error('Address cannot exceed 100 characters.');
      return;
    }
    if (formEmail.trim()) {
      const emailRegex = /^([A-Za-z0-9._%+-]{1,64})@(([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63})$/;
      if (!emailRegex.test(formEmail.trim())) {
        toast.error('Please enter a valid email address.');
        return;
      }
    }
    if (formContactNumber.trim() && !/^\+?\d{8,20}$/.test(formContactNumber.trim())) {
      toast.error('Contact Number must be 8-20 digits');
      return;
    }
    // Password is optional on edit — only validate if provided
    if (formPassword.trim()) {
      const pwdOk = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,60}$/.test(formPassword);
      if (!pwdOk) {
        toast.error('Password must be 6-60 chars and include 1 uppercase, 1 lowercase, 1 number, and 1 special character.');
        return;
      }
    }
    setIsSaving(true);
    try {
      const selectedOrgName = organizations.find(o => String(o.organizationid) === String(formOrg || selectedOrg))?.organizationname || (formOrg || selectedOrg);
      const payload = {
        userId: Number(editItem?.userid || editItem?.userId || 0),
        organizationId: selectedOrgName,
        customerCode: formCustomer || selectedCustomer,
        firstName: formFirstName,
        lastName: formLastName,
        email: formEmail,
        contactNumber: formContactNumber,
        address: formAddress,
        loginName: formUsername,
        passwordHash: formPassword || undefined,
        userRole: 'User',
        userCode: formUsername,
        isSSO: 0,
        fromDate: formFromDate ? `${formFromDate}` : new Date().toISOString().split('Z')[0],
        toDate: formToDate ? `${formToDate}` : new Date(new Date().setFullYear(new Date().getFullYear() + 10)).toISOString().split('Z')[0]
      };
      const res = await fetch(`${API_BASE1}/create-user`, {
        method: 'POST',
        headers: { 'accept': '*/*', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const resData = await res.json().catch(() => null);
      // E001 = login name already exists
      if (resData?.status === 'E001' || resData?.errorCode === 'E001' || resData?.errorcode === 'E001') {
        toast.error('Login name already exists! Please give another name and try.');
        return;
      }
      if (res.ok) {
        toast.success('User updated successfully!');
        setShowModal(false);
        fetchUsers();
      } else {
        toast.error(resData?.message || resData?.Message || 'Failed to update user.');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!formFirstName.trim() || !formEmail.trim() || !formUsername.trim() || !formPassword.trim() || !formFromDate || !formToDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (new Date(formToDate) < new Date(formFromDate)) {
      toast.error('To Active Date  cannot be earlier than From Active Date.');
      return;
    }

    if (!/^[A-Za-z\s]+$/.test(formFirstName.trim()) || formFirstName.trim().length > 60) {
      toast.error('First Name must contain only letters and spaces (max 60 chars).');
      return;
    }

    if (formFirstName.trim().length < 3) {
      toast.error('First Name must contain at least 3 characters.');
      return;
    }

    if (formLastName.trim() && (!/^[A-Za-z\s]+$/.test(formLastName.trim()) || formLastName.trim().length > 60)) {
      toast.error('Last Name must contain only letters and spaces (max 60 chars).');
      return;
    }

    // Last Name takes a single character; only the letters/spaces and 60-char
    // rules above apply to it. First Name keeps its minimum of three.
    if (formLastName.trim() && formLastName.trim().length < 1) {
      toast.error('Last Name must contain at least 1 character.');
      return;
    }

    if (formAddress.trim().length > 100) {
      toast.error('Address cannot exceed 100 characters.');
      return;
    }

    const emailRegex = /^([A-Za-z0-9._%+-]{1,64})@(([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63})$/;
    if (!emailRegex.test(formEmail.trim())) {
      toast.error('Please enter a valid email address.');
      return;
    }

    if (formContactNumber.trim() && !/^\+?\d{10,13}$/.test(formContactNumber.trim())) {
      toast.error('Contact Number must be 10-13 digits, optionally starting with +.');
      return;
    }

    if (!/^[A-Za-z0-9]+$/.test(formUsername.trim()) || formUsername.trim().length < 4 || formUsername.trim().length > 20) {
      toast.error('Username must be 4-20 alphanumeric characters.');
      return;
    }

    const pwdOk = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,60}$/.test(formPassword);
    if (!pwdOk) {
      toast.error('Password must be 6-60 chars and include uppercase, lowercase, number, and special character.');
      return;
    }
    setIsSaving(true);
    try {
      // Resolve org name from selected org id
      const selectedOrgName = organizations.find(o => String(o.organizationid) === String(formOrg || selectedOrg))?.organizationname || (formOrg || selectedOrg);
      const payload = {
        userId: 0,
        organizationId: selectedOrgName,
        customerCode: formCustomer || selectedCustomer,
        firstName: formFirstName,
        lastName: formLastName,
        email: formEmail,
        contactNumber: formContactNumber,
        address: formAddress,
        loginName: formUsername,
        passwordHash: formPassword || 'defaultPass123',
        userRole: 'User',
        userCode: formUsername,
        isSSO: 0,
        fromDate: formFromDate ? `${formFromDate}` : new Date().toISOString().split('Z')[0],
        toDate: formToDate ? `${formToDate}` : new Date(new Date().setFullYear(new Date().getFullYear() + 10)).toISOString().split('Z')[0]
      };

      const res = await fetch(`${API_BASE1}/create-user`, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const resData = await res.json().catch(() => null);
      // E001 = login name already exists
      if (resData?.status === 'E001' || resData?.errorCode === 'E001' || resData?.errorcode === 'E001') {
        toast.error('Login name already exists! Please give another name and try.');
        return;
      }
      if (res.ok) {
        toast.success('User created successfully!');
        setShowCreateModal(false);
        setShowModal(false);
        fetchUsers();
      } else {
        toast.error(resData?.message || resData?.Message || 'Failed to save user');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleActionConfirm = async () => {
    const { type, id } = actionConfirm;
    if (!id || !type) return;

    if (type === 'Delete') {
      const target = roleList.find(r => r.id === id);
      if (!target) {
        setActionConfirm({ type: null, id: null });
        return;
      }
      setIsSaving(true);
      try {
        const payload = {
          custCode: target.customer || selectedCustomer,
          orgCode: target.orgId || selectedOrg,
          // usercode from get-user-details is the login name; username is the
          // display name (firstname + lastname) and is only a last resort.
          loginName: (target.usercode || '').trim() || (target.username || '').trim() || target.id,
        };
        const res = await axios.post(`${API_BASE1}/delete-user`, payload);
        const data = (res && res.data) || {};
        const statusCode = data.statusCode ?? data.status;
        // S001 is the only success. On F001 - or anything unrecognised - the row
        // stays put, so the table never claims a delete the backend refused.
        if (statusCode === 'S001') {
          saveList(roleList.filter(r => r.id !== id));
          toast.success(data.message || 'User deleted successfully');
        } else {
          toast.error(data.message || 'Failed to delete user');
        }
      } catch (e) {
        console.error('Delete user failed', e);
        toast.error('Failed to delete user');
      } finally {
        setIsSaving(false);
        setActionConfirm({ type: null, id: null });
      }
      return;
    }

    if (type === 'Approve') {
      saveList(roleList.map(r => r.id === id ? { ...r, status: 'Approved' } : r));
      toast.success('User approved!');
    } else if (type === 'Reject') {
      saveList(roleList.map(r => r.id === id ? { ...r, status: 'Rejected' } : r));
      toast.success('User rejected!');
    }
    setActionConfirm({ type: null, id: null });
  };

  const configLabel = (ids) => { if (!ids) return 'None'; if (Array.isArray(ids)) { if (ids.includes('all')) return 'All (Full Access)'; return ids.map(id => CONFIG_PRIVILEGES.find(c => c.id === id)?.label || id).join(', ') || 'None'; } return CONFIG_PRIVILEGES.find(c => c.id === ids)?.label || ids; };

  return (
    <div className="relative flex-1 flex flex-col min-h-0 bg-slate-50/50">
      {isSaving && <PageLoader />}

      {/* Content: Table */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="w-full">
          {/* Customer & Org Dropdowns + Filters Bar */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 flex-wrap">
              {/* Customer Dropdown */}
              {!isAdmin && (
                <>
                  <div className="w-52">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Select Customer</label>
                    <div className="relative group">
                      <select
                        value={selectedCustomer}
                        onChange={e => setSelectedCustomer(e.target.value)}
                        className="w-full px-4 py-2 pr-8 text-sm border border-gray-200 rounded-lg bg-white shadow-sm hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer text-gray-700 font-medium"
                      >
                        {customerList.length > 0 ? customerList.map(c => (
                          <option key={c.customercode || c.id} value={c.customercode || c.id}>
                            {c.customername || c.name || c.customercode}
                          </option>
                        )) : <option value="ICME">ICME</option>}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                  <div className="w-64">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Select Organization</label>
                    <div className="relative group">
                      <select
                        value={selectedOrg}
                        onChange={e => setSelectedOrg(e.target.value)}
                        className="w-full px-4 py-2 pr-8 text-sm border border-gray-200 rounded-lg bg-white shadow-sm hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer text-gray-700 font-medium"
                      >
                        {organizations.map(org => (
                          <option key={org.organizationid} value={org.organizationid}>
                            {org.organizationname}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                </>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Action Buttons & Filters */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => { openCreate(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#2563eb] to-blue-500 text-white hover:from-blue-600 hover:to-blue-700 shadow-sm rounded-lg text-sm font-bold transition-all"
                >
                  <Plus className="w-4 h-4" /> Add User
                </button>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2563eb]"
                >
                  <option value="">All Status</option>
                  <option value={USER_STATUS.yetToBeActive}>{USER_STATUS.yetToBeActive}</option>
                  <option value={USER_STATUS.active}>{USER_STATUS.active}</option>
                  <option value={USER_STATUS.inactive}>{USER_STATUS.inactive}</option>
                </select>
                <div className="flex items-center gap-2 relative">
                  <Search className="w-4 h-4 absolute left-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search user..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-2 text-sm w-48 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
              </div>
            </div>

            {/* Summary Info */}
            {selectedOrg && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2563eb] to-purple-600 flex items-center justify-center shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-xs text-gray-500">
                  Total User(s): <span className="font-semibold text-blue-600">{filteredRoles.length}</span>
                </p>
              </div>
            )}
          </div>

          {/* Tables */}
          {(() => {
            const filteredAdmins = filteredRoles.filter(r => r.role === 'admin');
            const filteredUsers = filteredRoles.filter(r => r.role === 'user' || !r.role);

            const renderTable = (data, title, type) => (
              <div className="mb-8 last:mb-0">
                {title && <h3 className="text-sm font-bold text-gray-800 mb-3 ml-1">{title}</h3>}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-5 py-3">Username</th>
                          {type === 'admin' && <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-5 py-3">Configuration</th>}
                          <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-5 py-3">From Active Date </th>
                          <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-5 py-3">To Active Date </th>
                          <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                          <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.length === 0 ? (
                          <tr>
                            <td colSpan={type === 'admin' ? 5 : 5} className="py-16 text-center">
                              <div className="flex flex-col items-center gap-3">
                                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                                  <ShieldCheck className="w-7 h-7 text-gray-300" />
                                </div>
                                <p className="text-sm font-semibold text-gray-500">No {title ? title.toLowerCase() : 'User(s)'} found</p>
                              </div>
                            </td>
                          </tr>
                        ) : data.map((item, idx) => {
                          return (
                            <tr key={item.id} className={"border-b border-gray-50 hover:bg-blue-50/30 transition-colors " + (idx % 2 === 0 ? '' : 'bg-gray-50/30')}>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm bg-gradient-to-br from-blue-500 to-indigo-600">
                                    {(item.username || 'U').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <span className="text-sm font-semibold text-gray-800 block">{item.username}</span>

                                  </div>
                                </div>
                              </td>
                              {type === 'admin' && (
                                <td className="px-5 py-3.5">
                                  <span className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200 block truncate max-w-[150px]" title={configLabel(item.configPrivilege)}>
                                    {configLabel(item.configPrivilege)}
                                  </span>
                                </td>
                              )}
                              <td className="px-5 py-3.5 text-sm text-gray-600">
                                {formatDateDDMMYYYY(item.fromDate)}
                              </td>
                              <td className="px-5 py-3.5 text-sm text-gray-600">
                                {formatDateDDMMYYYY(item.toDate)}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                                  item.status === 'Active' ? 'bg-teal-50 text-teal-600 border-teal-200' :
                                  'bg-gray-100 text-gray-500 border-gray-300'
                                }`}>
                                  {item.status || 'Unknown'}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2">
                                  {/* Edit stays available whatever the status. */}
                                  <button onClick={() => openEdit(item)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors border text-[#2563eb] bg-blue-50 border-blue-100 hover:bg-blue-100">
                                    <Edit2 className="w-3 h-3" /> Edit
                                  </button>
                                  {/* Delete stays available for both active and inactive users. */}
                                  <button onClick={() => setActionConfirm({ type: 'Delete', id: item.id })}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors border text-red-500 bg-red-50 border-red-100 hover:bg-red-100">
                                    <Trash2 className="w-3 h-3" /> Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );

            // Always render only the Users table (no separate Administrators table)
            return renderTable(filteredRoles, '', 'user');
          })()}
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-[#2563eb] to-purple-600 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <UserCog className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Edit User</h3>
                  <p className="text-xs text-white/70">Update credentials and access period</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                title="Close"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/40 transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[65vh] bg-gray-50/40">
              <p className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                <span className="w-1 h-3.5 rounded-full bg-gradient-to-b from-[#2563eb] to-purple-600" />
                Personal Details
              </p>

              {/* Populated by openEdit from the get-user-details response; a field the
                  API returns as null simply shows empty rather than being omitted. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">First Name <span className="text-red-400">*</span></label>
                  <input value={formFirstName} onChange={e => setFormFirstName(e.target.value)} placeholder="First name"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white transition-all hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">Last Name</label>
                  <input value={formLastName} onChange={e => setFormLastName(e.target.value)} placeholder="Last name"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white transition-all hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">Email <span className="text-red-400">*</span></label>
                  <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="name@example.com"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white transition-all hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">Contact Number</label>
                  <input value={formContactNumber} onChange={e => setFormContactNumber(e.target.value)} placeholder="e.g. +441234567890"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white transition-all hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">Address</label>
                  <input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Address"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white transition-all hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>

              <p className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                <span className="w-1 h-3.5 rounded-full bg-gradient-to-b from-[#2563eb] to-purple-600" />
                Account Details
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">Login Name <span className="text-red-400">*</span></label>
                  <input value={formUsername} disabled
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">Password <span className="text-red-400">*</span></label>
                  {/* Toggling only swaps the input type, so the value is untouched. */}
                  <div className="relative">
                    <input type={showFormPassword ? 'text' : 'password'} value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="******"
                      className="w-full px-4 py-2.5 pr-11 text-sm border border-gray-200 rounded-lg bg-white transition-all hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/20" />
                    <button
                      type="button"
                      onClick={() => setShowFormPassword(v => !v)}
                      title={showFormPassword ? 'Hide password' : 'Show password'}
                      aria-label={showFormPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                    >
                      {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5 leading-snug">6–60 chars, uppercase, lowercase, number &amp; special char</p>
                </div>
              </div>

              <p className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                <span className="w-1 h-3.5 rounded-full bg-gradient-to-b from-[#2563eb] to-purple-600" />
                Access Period
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">From Active Date  <span className="text-red-400">*</span></label>
                  {/* min greys out past dates in the picker; the onChange guard also
                      catches a past date typed straight into the field. */}
                  <input type="date" value={formFromDate}
                    min={getTodayISO()}
                    onChange={e => {
                      const value = e.target.value;
                      if (value && value < getTodayISO()) {
                        toast.error(PAST_DATE_MESSAGE);
                        return;
                      }
                      setFormFromDate(value);
                    }}
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white transition-all hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/20 cursor-pointer" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">To Active Date  <span className="text-red-400">*</span></label>
                  <input type="date" value={formToDate}
                    min={formFromDate || getTodayISO()}
                    onChange={e => {
                      const value = e.target.value;
                      if (value && value < getTodayISO()) {
                        toast.error(PAST_DATE_MESSAGE);
                        return;
                      }
                      setFormToDate(value);
                    }}
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white transition-all hover:border-gray-300 focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/20 cursor-pointer" />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-center sm:justify-end gap-3 bg-white flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="px-6 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-300 font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300">
                Cancel
              </button>
              {/* Editing an existing user saves only after something actually changes;
                  creating a user is unaffected. */}
              <button onClick={handleEditSave}
                disabled={!!editItem && !hasEditChanges}
                title={!!editItem && !hasEditChanges ? 'Make a change to enable saving' : undefined}
                className="px-6 py-2.5 text-sm bg-gradient-to-r from-[#2563eb] to-purple-600 text-white font-bold rounded-lg shadow-sm hover:shadow-md hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm disabled:hover:brightness-100 disabled:active:scale-100 transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {actionConfirm.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
              actionConfirm.type === 'Approve' ? 'bg-green-100 text-green-600' :
              actionConfirm.type === 'Reject' ? 'bg-red-100 text-red-600' :
              'bg-red-100 text-red-600'
            }`}>
              {actionConfirm.type === 'Approve' ? <Check className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm {actionConfirm.type}</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to {actionConfirm.type.toLowerCase()} this user? This action cannot be undone.</p>
            <div className="flex w-full gap-3">
              <button onClick={() => setActionConfirm({ type: null, id: null })}
                className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-semibold transition-colors">
                Cancel
              </button>
              <button onClick={handleActionConfirm}
                className={`flex-1 py-2.5 text-sm rounded-xl font-bold text-white transition-all ${
                  actionConfirm.type === 'Approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}>
                Yes, {actionConfirm.type}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User/Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] max-w-2xl">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-[#2563eb] to-purple-600 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create User</h3>
                  
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                title="Close"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/40 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 bg-gray-50/30">

              {/* Customer & Organization Selection */}
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Organisation</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 p-4 bg-blue-50/60 rounded-xl border border-blue-100">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                    Customer <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formCustomer || selectedCustomer}
                      onChange={e => setFormCustomer(e.target.value)}
                      className="w-full px-3 py-2 pr-8 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-[#2563eb] appearance-none cursor-pointer text-gray-700 font-medium"
                    >
                      {customerList.length > 0 ? customerList.map(c => (
                        <option key={c.customercode || c.id} value={c.customercode || c.id}>
                          {c.customername || c.name || c.customercode}
                        </option>
                      )) : <option value={selectedCustomer}>{selectedCustomer}</option>}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                    Organization <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formOrg || selectedOrg}
                      onChange={e => setFormOrg(e.target.value)}
                      className="w-full px-3 py-2 pr-8 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-[#2563eb] appearance-none cursor-pointer text-gray-700 font-medium"
                    >
                      {organizations.map(org => (
                        <option key={org.organizationid} value={org.organizationid}>
                          {org.organizationname}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">First Name <span className="text-red-400">*</span></label>
                  <input value={formFirstName} onChange={e => setFormFirstName(e.target.value)} placeholder="First name"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2563eb]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Last Name</label>
                  <input value={formLastName} onChange={e => setFormLastName(e.target.value)} placeholder="Last name"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2563eb]" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Email <span className="text-red-400">*</span></label>
                  <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="Email address"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2563eb]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Contact Number</label>
                  <input value={formContactNumber} onChange={e => setFormContactNumber(e.target.value)} placeholder="Contact number"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2563eb]" />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Address</label>
                <input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Full address" maxLength={100}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2563eb]" />
              </div>

              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-6 mb-4">Account Details</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Login Name <span className="text-red-400">*</span></label>
                  <input value={formUsername} onChange={e => setFormUsername(e.target.value)} placeholder="Login name"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2563eb]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Password <span className="text-red-400">*</span></label>
                  {/* Toggling only swaps the input type, so the value is untouched. */}
                  <div className="relative">
                    <input type={showFormPassword ? 'text' : 'password'} value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Password"
                      className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2563eb]" />
                    <button
                      type="button"
                      onClick={() => setShowFormPassword(v => !v)}
                      title={showFormPassword ? 'Hide password' : 'Show password'}
                      aria-label={showFormPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                    >
                      {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">From Active Date  <span className="text-red-400">*</span></label>
                  <input type="date" value={formFromDate} onChange={e => setFormFromDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2563eb]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">To Active Date  <span className="text-red-400">*</span></label>
                  <input type="date" value={formToDate} onChange={e => setFormToDate(e.target.value)}
                    min={formFromDate || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2563eb]" />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-semibold transition-colors">
                Cancel
              </button>
              {/* Always clickable; handleCreate rejects invalid input with a message. */}
              <button onClick={handleCreate}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-[#2563eb] text-white rounded-xl hover:bg-[#1d4ed8] font-bold shadow-md transition-all">
                <Save className="w-4 h-4" /> Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Add User Modal */}
      {showAdvancedAddUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-base font-bold text-gray-900">Add User</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowAdvancedAddUser(false)}
                      title="Close"
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-400 transition-colors focus:outline-none"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs z-[70] bg-gray-800 text-white border-gray-700">Close</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Username <span className="text-red-400">*</span></label>
                <input value={advUsername} onChange={e => setAdvUsername(e.target.value)} placeholder="Enter username"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 text-gray-700" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Password <span className="text-red-400">*</span></label>
                <input type="password" value={advPassword} onChange={e => setAdvPassword(e.target.value)} placeholder="Enter password"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 text-gray-700" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">From Active Date </label>
                  <input type="date" value={advFromDate} onChange={e => setAdvFromDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 text-gray-700" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">To Active Date </label>
                  <input type="date" value={advToDate} onChange={e => setAdvToDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 text-gray-700" />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => {
                  toast.success('User added successfully');
                  setShowAdvancedAddUser(false);
                }}
                disabled={!advUsername.trim() || !advPassword.trim()}
                className="px-6 py-2.5 text-sm bg-gradient-to-r from-[#2563eb] to-blue-500 text-white font-bold rounded-xl shadow-md hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  // Lands on the first menu entry, since Dashboard is no longer in the menu.
  const [activeSection, setActiveSection] = useState<ActiveSection>('role-management');
  // Subject & Question is only offered while the Evaluation stage is selected in
  // Config Settings; that section reports every change through onStagesChange.
  const [isEvaluationStageOn, setIsEvaluationStageOn] = useState(
    () => localStorage.getItem('stage_evaluation_on') === '1'
  );
  const handleStagesChange = React.useCallback(
    (stages: { evaluation: boolean }) => setIsEvaluationStageOn(!!stages.evaluation),
    []
  );
  // Collapsed sidebar: icons only, and the panel name next to the logo is dropped.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  
  const loggedInRole = typeof window !== 'undefined' ? (sessionStorage.getItem('userRole') || 'superadmin').toLowerCase() : 'superadmin';
  const loggedInCustomer = typeof window !== 'undefined' ? sessionStorage.getItem('customerCode') || 'ICME' : 'ICME';
  const loggedInOrg = typeof window !== 'undefined' ? sessionStorage.getItem('orgCode') || '' : '';
  const isAdmin = loggedInRole === 'admin';

  const [selectedCustomer, setSelectedCustomer] = useState(isAdmin ? loggedInCustomer : 'ICME');
  const [selectedOrg, setSelectedOrg] = useState(isAdmin ? loggedInOrg : '');

  // ── Year / Cycle state for the header dropdowns (used by Subject & Question) ──
  const [headerYears, setHeaderYears] = useState<{ yearid: string; yearname: string; yearcode: string }[]>([]);
  const [headerSelectedYearCode, setHeaderSelectedYearCode] = useState('');
  const [headerYearsLoading, setHeaderYearsLoading] = useState(false);
  const [headerCycles, setHeaderCycles] = useState<{ cycleid: string; cyclename: string; cyclecode: string }[]>([]);
  const [headerSelectedCycleCode, setHeaderSelectedCycleCode] = useState('');
  const [headerCyclesLoading, setHeaderCyclesLoading] = useState(false);

  // Fetch years once on mount
  useEffect(() => {
    const fetchHeaderYears = async () => {
      setHeaderYearsLoading(true);
      try {
        const res = await axios.get(`${API_BASE1}/get-year-data`);
        const data = res?.data;
        const arr: any[] = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        const mapped = arr
          .filter(item => item && typeof item === 'object')
          .map((item: any) => ({
            yearid: String(item.yearid ?? item.yearId ?? ''),
            yearname: String(item.yearname ?? item.yearName ?? ''),
            yearcode: String(item.yearcode ?? item.yearCode ?? ''),
          }))
          .filter(y => y.yearcode);
        setHeaderYears(mapped);
        if (mapped.length > 0) setHeaderSelectedYearCode(mapped[0].yearcode);
      } catch (error) {
        console.error('Error fetching years for header:', error);
      } finally {
        setHeaderYearsLoading(false);
      }
    };
    fetchHeaderYears();
  }, []);

  // Fetch cycles whenever the selected year changes
  useEffect(() => {
    if (!headerSelectedYearCode) {
      setHeaderCycles([]);
      setHeaderSelectedCycleCode('');
      return;
    }
    const fetchHeaderCycles = async () => {
      setHeaderCyclesLoading(true);
      setHeaderCycles([]);
      setHeaderSelectedCycleCode('');
      try {
        // OrgCode comes from the login response the session holds.
        const { orgcode } = getSessionCodes();
        const res = await axios.get(`${API_BASE1}/get-cycle-data`, {
          params: {
            YearCode: headerSelectedYearCode,
            OrgCode: (orgcode || sessionStorage.getItem('orgCode') || '').replace(/\x00/g, ''),
          },
        });
        const data = res?.data;
        const arr: any[] = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        const mapped = arr
          .filter(item => item && typeof item === 'object')
          .map((item: any) => ({
            cycleid: String(item.cycleid ?? item.cycleId ?? ''),
            cyclename: String(item.cyclename ?? item.cycleName ?? ''),
            cyclecode: String(item.cyclecode ?? item.cycleCode ?? ''),
          }))
          .filter(c => c.cyclecode);
        setHeaderCycles(mapped);
        if (mapped.length > 0) setHeaderSelectedCycleCode(mapped[0].cyclecode);
      } catch (error) {
        console.error('Error fetching cycles for header:', error);
      } finally {
        setHeaderCyclesLoading(false);
      }
    };
    fetchHeaderCycles();
  }, [headerSelectedYearCode]);

  React.useEffect(() => {
    // Admin users are pre-scoped to their org — no need to load all orgs
    if (isAdmin) return;

    const fetchOrganizations = async () => {
      try {
        setLoadingOrgs(true);
        const orgRes = await axios.get(
          `${API_BASE1}/organization-details?CustCode=ICME`,
          { headers: { 'accept': '*/*' } }
        );
        const orgData = orgRes.data?.data;
        if (orgData && Array.isArray(orgData)) {
          setOrganizations(orgData);
          if (orgData.length > 0) {
            setSelectedOrg(String(orgData[0].organizationid));
          }
        }
      } catch (error) {
        console.error('Error fetching organizations:', error);
      } finally {
        setLoadingOrgs(false);
      }
    };
    fetchOrganizations();
  }, [isAdmin]);

  const sharedProps = { selectedCustomer, selectedOrg, organizations, loadingOrgs };

  const renderYearCycle = (variant: 'compact' | 'settings') => (
    <YearCycleDropdowns
      years={headerYears}
      yearCode={headerSelectedYearCode}
      onYearChange={setHeaderSelectedYearCode}
      yearsLoading={headerYearsLoading}
      cycles={headerCycles}
      cycleCode={headerSelectedCycleCode}
      onCycleChange={setHeaderSelectedCycleCode}
      cyclesLoading={headerCyclesLoading}
      variant={variant}
    />
  );


  const displayName = (() => {
    try {
      const raw = sessionStorage.getItem('userInfo');
      if (raw) {
        const info = JSON.parse(raw);
        const name = (info?.username || '').toString().trim();
        if (name) return name;
      }
    } catch { }
    return sessionStorage.getItem('username') || 'Super Admin';
  })();

  const handleLogout = () => {
    ['isLogin', 'userInfo', 'username', 'password', 'userCode', 'orgCode', 'customerCode', 'userRole']
      .forEach(k => sessionStorage.removeItem(k));
    navigate('/login');
  };

  // Menu order: Role Management, Config Settings, Subject & Question, Marks Schema.
  // Dashboard is no longer offered in the menu; Admin additionally loses the
  // subject and marks sections.
  const allNavItems: { key: ActiveSection; label: string; icon: React.ReactNode }[] = [
    { key: 'role-management', label: isAdmin ? 'User Management' : 'Role Management', icon: <ShieldCheck className="w-5 h-5" /> },
    { key: 'settings', label: 'Config Settings', icon: <Settings className="w-5 h-5" /> },
    // Marking schemes are uploaded from Subject & Question now, so they no longer
    // need a page of their own.
    { key: 'subject-question', label: 'Subject & Question', icon: <BookOpen className="w-5 h-5" /> },
  ];
  const navItems = allNavItems.filter(item => {
    // Hidden from admins, and from everyone while Evaluation is not selected.
    if (item.key === 'subject-question') return !isAdmin && isEvaluationStageOn;
    return true;
  });

  // The item can disappear while its own page is open, so don't leave a page up
  // that the menu no longer offers.
  useEffect(() => {
    if (activeSection === 'subject-question' && (isAdmin || !isEvaluationStageOn)) {
      setActiveSection('settings');
    }
  }, [activeSection, isAdmin, isEvaluationStageOn]);


  return (

    <div className="h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex overflow-hidden">
      {/* Left Sidebar */}
      <div className={`${isSidebarCollapsed ? 'w-20' : 'w-16 lg:w-56'} bg-white border-r border-gray-100 shadow-sm flex flex-col transition-all duration-200`}>
        {/* Logo and the toggle share one row in both states; collapsed keeps the
            logo readable and puts the expand chevron directly after it. */}
        <div className={`border-b border-gray-100 flex items-center ${isSidebarCollapsed ? 'px-1.5 py-3 gap-1 justify-center' : 'p-3 lg:p-4 gap-2 justify-center lg:justify-between'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/lovable-uploads/b5b0f5a8-9552-4635-8c44-d5e6f994179c.png"
              alt="AI-Levate"
              className={`h-7 w-auto object-contain ${isSidebarCollapsed ? 'max-w-[48px]' : ''}`}
            />
            <span className={`${isSidebarCollapsed ? 'hidden' : 'hidden lg:block'} text-sm font-bold text-gray-800 truncate`}>Admin Panel</span>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(prev => !prev)}
            title={isSidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
            aria-label={isSidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
            aria-expanded={!isSidebarCollapsed}
            className="hidden lg:inline-flex items-center justify-center h-6 w-5 rounded-md text-gray-400 hover:text-[#2563eb] hover:bg-blue-50 transition-colors shrink-0"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className={`flex-1 py-4 space-y-1 ${isSidebarCollapsed ? 'px-1.5' : 'px-2'}`}>
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              title={item.label}
              className={`w-full flex items-center rounded-lg transition-all duration-200 ${isSidebarCollapsed ? 'justify-center gap-0 px-0 py-2.5' : 'gap-3 px-2 lg:px-3 py-2.5'} ${activeSection === item.key ? 'bg-[#2563eb] text-white shadow-md' : 'text-gray-500 hover:bg-blue-50 hover:text-[#2563eb]'}`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className={`${isSidebarCollapsed ? 'hidden' : 'hidden lg:block'} text-sm font-medium truncate`}>{item.label}</span>
            </button>
          ))}
        </nav>

      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-hidden`}>
        {/* Header is now visible for all roles */}
        {true && (
          <header className="bg-white border-b border-gray-100 shadow-sm px-6 pt-[3px] pb-3 flex items-center justify-between flex-shrink-0">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {navItems.find(n => n.key === activeSection)?.label}
              </h1>
              <p className="text-xs text-gray-500">{isAdmin ? 'Admin Dashboard' : 'Super Admin Dashboard'}</p>
            </div>
            
            <div className="flex items-center gap-8">
              {/* Year / Cycle selectors now sit beside Customer / Organization in each section. */}
              {/* Logout moved under the profile: the name and avatar open a small menu. */}
              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      title="Account"
                      className="flex items-center gap-3 rounded-full py-1 pl-2 pr-1.5 hover:bg-blue-50/70 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                    >
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold text-gray-800">{displayName}</p>
                        <p className="text-xs text-[#2563eb] font-medium">{isAdmin ? 'Admin' : 'Super Admin'}</p>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563eb] to-blue-400 flex items-center justify-center text-white text-sm font-bold">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
                      <p className="text-xs text-[#2563eb] font-medium">{isAdmin ? 'Admin' : 'Super Admin'}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>
        )}

        <main className={`flex-1 overflow-hidden ${activeSection === 'dashboard' ? 'flex flex-col' : activeSection === 'subject-question' ? 'flex flex-col p-4' : activeSection === 'settings' ? 'flex flex-col p-0' : activeSection === 'role-management' ? 'flex flex-col p-0' : 'overflow-auto p-6'}`}>
          {activeSection === 'dashboard' && (
            isAdmin ? (
              <div className="flex-1 overflow-auto bg-gray-50/50 -m-6 p-0">
                <SubjectDashboard />
              </div>
            ) : <AdminSubjectView />
          )}

          {activeSection === 'subject-question' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <SubjectQuestionPanel
                yearCode={headerSelectedYearCode}
                cycleCode={headerSelectedCycleCode}
                yearCycleSelector={renderYearCycle('compact')}
              />
            </div>
          )}


          {activeSection === 'settings' && (
            <div className="flex flex-col flex-1 overflow-hidden bg-slate-50/50">
              <SettingsSection
                API_BASE1={API_BASE1}
                yearCode={headerSelectedYearCode}
                cycleCode={headerSelectedCycleCode}
                yearCycleSelector={renderYearCycle('settings')}
                onStagesChange={handleStagesChange}
              />
            </div>
          )}

          {activeSection === 'role-management' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <RoleManagementSection />
            </div>
          )}
        </main>

        <footer className="bg-white border-t border-gray-100 px-6 py-3 shrink-0">
          <p className="text-center text-xs text-gray-400">Copyright &copy; 2026 | Excelsoft Technologies Ltd. | Version: V.1.0.0</p>
        </footer>
      </div>
    </div>

  );
};

export default SuperAdminDashboard;
