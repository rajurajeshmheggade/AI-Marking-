import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Eye, EyeOff, Info } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { loginUser } from "@/api";
import { clearAuthSession, getAccountAccess } from "@/lib/session";

const CONFIG_API_BASE = import.meta.env.VITE_AIMARKING_API_BASE || 'https://icmeprod.excelsoftcorp.com/AIMarkingAPI/api';

/**
 * Standalone Mode as the organization's configuration reports it.
 *
 * It used to be read from localStorage alone, which only holds a value once this
 * browser has opened Config Settings or the OCR page. A fresh browser - every
 * first login on the hosted app - therefore saw "off" and landed on the Subject
 * Dashboard. Asking the API settles it for any browser, and the answer is cached
 * so the rest of the app keeps reading the same value it always has.
 *
 * Returns null when the configuration cannot be read, leaving the caller on the
 * cached value rather than guessing.
 */
const fetchStandaloneMode = async (orgCode: string, custCode: string): Promise<boolean | null> => {
  const org = String(orgCode ?? '').trim();
  const cust = String(custCode ?? '').trim();
  if (!org || !cust) return null;
  try {
    const response = await fetch(
      `${CONFIG_API_BASE}/get-config-info?OrgCode=${encodeURIComponent(org)}&CustCode=${encodeURIComponent(cust)}&AppCode=AImarking`,
      { headers: { 'Cache-Control': 'no-cache' } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const config = Array.isArray(data) && data.length > 0 ? data[0]?.configSetting : null;
    if (!config) return null;

    if (config.workflowStages) {
      // Cached under both keys the app already reads.
      localStorage.setItem('workflowStages', JSON.stringify(config.workflowStages));
      localStorage.setItem(`org_selected_stages_${org}`, JSON.stringify(config.workflowStages));
    }
    if (config.standalone === undefined) return null;

    const standalone = !!config.standalone;
    localStorage.setItem('standalone_mode', standalone ? '1' : '0');
    localStorage.setItem(`org_standalone_${org}`, standalone ? '1' : '0');
    return standalone;
  } catch (e) {
    console.warn('Could not read Standalone Mode from the configuration; using the cached value', e);
    return null;
  }
};

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  // Wording depends on which blocked state the account is in.
  const [accessDeniedMessage, setAccessDeniedMessage] = useState('');

  // Shown after an account that is not yet active ("0") or expired ("2")
  // authenticates successfully. The session is already cleared by then; OK only
  // resets the form and returns the user to a clean Login page.
  const handleAccessDeniedOk = () => {
    clearAuthSession();
    setAccessDenied(false);
    setFormData({ username: '', password: '' });
    setError('');
    navigate('/login', { replace: true });
  };

  const submitDisabled = !formData.username.trim() || !formData.password.trim() || loading;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const userName = formData.username.trim();
    const password = formData.password.trim();



    try {
      const user = await loginUser(userName, password);

      // Support new response: { statusCode, message, userData: [...] }
      // and old response: { status, data: [...] }
      const status = user.statusCode || user.status;
      if (status !== 'S001') {
        setError(user.message || 'Login failed');
        setLoading(false);
        return;
      }

      // New format uses 'userData', old format uses 'data'
      const rawUser = (user.userData && user.userData[0]) || (user.data && user.data[0]) || {};

      // Normalize: new format has lowercase keys, old has camelCase
      const userData = {
        userCode:     rawUser.usercode     || rawUser.userCode     || '',
        orgCode:      rawUser.organizationcode || rawUser.orgCode  || '',
        customerCode: rawUser.customercode || rawUser.customerCode || '',
        userRole:     rawUser.userrole     || rawUser.userRole     || '',
        username:     rawUser.username     || userName,
      };

      // The credentials are valid, but the account may be outside its validity
      // window. The login response carries the active flag itself, so this needs
      // no second request. loginUser() has already written identity keys by now,
      // so a denial has to wipe them rather than merely skip writing more.
      const access = getAccountAccess(
        rawUser.active ?? rawUser.Active ?? rawUser.ACTIVE ?? rawUser.isActive ?? rawUser.isactive
      );
      if (!access.allowed) {
        clearAuthSession();
        setAccessDeniedMessage(access.message ?? '');
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      sessionStorage.setItem('userInfo', JSON.stringify(userData));
      sessionStorage.setItem('isLogin', 'true');
      sessionStorage.setItem('username', userName);
      sessionStorage.setItem('password', password);
      if (userData.userCode)     sessionStorage.setItem('userCode',     userData.userCode);
      if (userData.orgCode)      sessionStorage.setItem('orgCode',      userData.orgCode);
      if (userData.customerCode) sessionStorage.setItem('customerCode', userData.customerCode);
      if (userData.userRole)     sessionStorage.setItem('userRole',     userData.userRole);

      const customerCode = userData.customerCode.trim().toUpperCase();
      const userRole     = userData.userRole.trim().toLowerCase();

      // The organization's own configuration decides Standalone Mode; the cached
      // value is only the fallback for when that call cannot be made.
      // customerCode is the trimmed, upper-cased code; get-config-info answers to
      // that exact spelling and returns [] for anything else.
      const standaloneFromConfig = await fetchStandaloneMode(userData.orgCode, customerCode);
      const isStandaloneMode = standaloneFromConfig ?? (localStorage.getItem('standalone_mode') === '1');

      let isStandaloneOcrOnly = false;
      if (isStandaloneMode) {
        try {
          const storedStages = localStorage.getItem(`org_selected_stages_${userData.orgCode}`);
          if (storedStages) {
            const stages = JSON.parse(storedStages);
            isStandaloneOcrOnly = stages.ocr && !stages.segmentation && !stages.indexing && !stages.evaluation;
          }
        } catch (e) {
          console.error("Failed to parse workflow stages", e);
        }
      }

      if (customerCode === 'ICME') {
        if (userRole === 'superadmin' || userRole === 'admin') {
          navigate('/superadmin-dashboard', { replace: true });
        } else if (isStandaloneMode) {
          // Standalone mode: skip Subject Dashboard, go directly to workspace
          navigate('/ocr-evaluation', { replace: true });
        } else {
          navigate('/subject-dashboard', { replace: true });
        }
      } else {
        setError('Access denied.');
      }

    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const isLoggedIn = sessionStorage.getItem('isLogin') === 'true';
    if (isLoggedIn && location.pathname === '/login') {
      const role = (sessionStorage.getItem('userRole') || '').toLowerCase();
      const isStandaloneMode = localStorage.getItem('standalone_mode') === '1';
      
      let isStandaloneOcrOnly = false;
      if (isStandaloneMode) {
        try {
          const storedStages = localStorage.getItem(`org_selected_stages_${sessionStorage.getItem('orgCode')}`);
          if (storedStages) {
            const stages = JSON.parse(storedStages);
            isStandaloneOcrOnly = stages.ocr && !stages.segmentation && !stages.indexing && !stages.evaluation;
          }
        } catch (e) {
          console.error("Failed to parse workflow stages in useEffect", e);
        }
      }

      if (role === 'superadmin' || role === 'admin') {
        navigate('/superadmin-dashboard', { replace: true });
      } else if (isStandaloneMode) {
        navigate('/ocr-evaluation', { replace: true });
      } else {
        navigate('/subject-dashboard', { replace: true });
      }
    }
    if (!isLoggedIn && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl animate-spin" style={{ animationDuration: '20s' }} />
        <div className="absolute top-1/3 -right-20 w-64 h-64 bg-gradient-to-r from-purple-400/15 to-pink-400/15 rounded-full blur-3xl animate-spin" style={{ animationDuration: '25s', animationDirection: 'reverse' }} />
        <div className="absolute -bottom-32 left-1/4 w-96 h-96 bg-gradient-to-r from-yellow-400/10 to-orange-400/10 rounded-full blur-3xl animate-spin" style={{ animationDuration: '30s' }} />
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400/40 rounded-full animate-pulse" />
        <div className="absolute top-3/4 right-1/3 w-1 h-1 bg-purple-400/40 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-3/4 w-1.5 h-1.5 bg-cyan-400/40 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 min-h-screen flex">
        {/* Left Side */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12">
          <div className="max-w-md text-center space-y-8">
            <div className="flex items-center justify-center space-x-3 mb-8">
              <img src="/lovable-uploads/b5b0f5a8-9552-4635-8c44-d5e6f994179c.png" alt="AI-Levate" className="h-20 w-auto" />
            </div>

            <div className="relative mx-auto w-80 h-80">
              <div className="absolute inset-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-gradient-to-r from-primary to-blue-500 rounded-full shadow-2xl animate-pulse" />
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '20s' }}>
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full opacity-80" />
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full opacity-80" />
              </div>
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '15s', animationDirection: 'reverse' }}>
                <div className="absolute top-1/2 right-0 transform -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full opacity-80" />
                <div className="absolute top-1/2 left-0 transform -translate-y-1/2 w-6 h-6 bg-gradient-to-r from-red-400 to-rose-400 rounded-full opacity-80" />
              </div>
              <div className="absolute inset-0">
                <svg className="w-full h-full opacity-30" viewBox="0 0 320 320">
                  <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#2e5c9e" />
                      <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                  </defs>
                  <path d="M160,60 Q160,160 60,160" stroke="url(#lineGradient)" strokeWidth="2" fill="none" className="animate-pulse" />
                  <path d="M160,60 Q160,160 260,160" stroke="url(#lineGradient)" strokeWidth="2" fill="none" className="animate-pulse" style={{ animationDelay: '0.5s' }} />
                  <path d="M60,160 Q160,160 160,260" stroke="url(#lineGradient)" strokeWidth="2" fill="none" className="animate-pulse" style={{ animationDelay: '1s' }} />
                  <path d="M260,160 Q160,160 160,260" stroke="url(#lineGradient)" strokeWidth="2" fill="none" className="animate-pulse" style={{ animationDelay: '1.5s' }} />
                </svg>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-4xl font-bold text-gray-900 leading-tight">
                Welcome Back to
                <span className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent"> AI Innovation</span>
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                Sign in to continue your AI-powered automation and intelligent workflows.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex-1 lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex items-center justify-center mb-8">
              <img src="/lovable-uploads/b5b0f5a8-9552-4635-8c44-d5e6f994179c.png" alt="AI-Levate" className="h-10 w-auto" />
            </div>

            <Card className="border-0 shadow-2xl bg-white/70 backdrop-blur-sm">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
                  <p className="text-gray-600">Sign in to your AI-powered platform</p>
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                  {loading && (
                    <div className="flex justify-center items-center text-blue-600 text-base font-medium py-2">
                      Signing in, please wait...
                    </div>
                  )}

                  <Input
                    placeholder="Username or Email"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className="h-12 border-gray-200 bg-white/80 focus:border-primary focus:ring-primary/20 transition-all duration-200"
                    disabled={loading}
                  />

                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className="h-12 border-gray-200 bg-white/80 focus:border-primary focus:ring-primary/20 transition-all duration-200 pr-12"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      title={showPassword ? "Hide" : "Show"}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {error && (
                    <div className="text-sm text-red-600 font-medium text-center">{error}</div>
                  )}

                  <span className={`block ${submitDisabled ? 'cursor-not-allowed' : ''}`} aria-disabled={submitDisabled}>
                    <Button
                      type="submit"
                      disabled={submitDisabled}
                      className="w-full h-12 bg-[#2563eb] hover:bg-[#2563eb]/90 text-white font-semibold rounded-lg transform transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed"
                    >
                      {loading ? "Signing In..." : "Sign In"}
                    </Button>
                  </span>
                </form>

                {/* Sign Up link */}
                <p className="hidden text-center text-sm text-gray-500 mt-6">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="text-[#2563eb] font-semibold hover:underline transition-colors"
                  >
                    Sign up
                  </button>
                </p>
              </CardContent>
            </Card>

            {/* Footer */}
            <div className="mt-8 text-center space-y-2">
              <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
                <Sparkles className="w-3 h-3" />
                <span className="flex items-center gap-1">Powered By:
                  <img src="/lovable-uploads/b5b0f5a8-9552-4635-8c44-d5e6f994179c.png" alt="AI-Levate" className="h-3 w-auto" />
                </span>
              </div>
              <div className="text-xs text-gray-400 space-y-1">
                <p>Copyright © 2026 | Excelsoft Technologies Ltd.</p>
                <div className="flex items-center justify-center space-x-4">
                  <a href="https://www.excelsoftcorp.com/privacy-policy/" className="text-sky-500 hover:text-sky-600 transition-colors">Privacy and Cookie Policy</a>
                  <span>•</span>
                  <span>Version: V.1.0.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account outside its validity window - no trigger and no cancel, OK is
          the only way out and it returns the user to a cleared Login page. */}
      <AlertDialog open={accessDenied}>
        <AlertDialogContent className="max-w-[440px] gap-0 rounded-xl sm:rounded-xl border-0 bg-white p-0 shadow-2xl overflow-hidden">
          {/* Illustration band - line-art scene with the warning badge centred */}
          <div className="flex justify-center px-6 pt-7 pb-2">
            <svg viewBox="0 0 320 120" className="h-[120px] w-full max-w-[320px]" role="presentation">
              {/* soft decorative strokes either side */}
              <path d="M18 44c-10 22 2 44 26 44" fill="none" stroke="#dadce0" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M292 40c14 16 8 42-14 48" fill="none" stroke="#dadce0" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M52 30l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" fill="#dadce0" />
              <circle cx="276" cy="86" r="7" fill="#e8eaed" />
              <circle cx="288" cy="86" r="10" fill="#e8eaed" />

              {/* the card being denied */}
              <rect x="96" y="18" width="128" height="86" rx="8" fill="#ffffff" stroke="#dadce0" strokeWidth="2.5" />
              <rect x="112" y="34" width="42" height="6" rx="3" fill="#e8eaed" />
              {/* masked credential dots */}
              <circle cx="156" cy="76" r="5" fill="#4285f4" />
              <circle cx="172" cy="76" r="5" fill="#4285f4" />
              <circle cx="188" cy="76" r="5" fill="#4285f4" />
              <rect x="202" y="70" width="3" height="13" rx="1.5" fill="#4285f4" />

              {/* red warning badge - apex rounded first, then down the right
                  side, across the base and back up, so the path closes cleanly */}
              <path
                d="M126.5 42a4 4 0 0 1 7 0l20 38a4 4 0 0 1-3.5 6h-40a4 4 0 0 1-3.5-6z"
                fill="#ea4335"
              />
              <rect x="128" y="58" width="4" height="14" rx="2" fill="#ffffff" />
              <circle cx="130" cy="78" r="2.6" fill="#ffffff" />
            </svg>
          </div>

          <AlertDialogHeader className="space-y-2 px-8 pt-2 text-left sm:text-left">
            <AlertDialogTitle className="text-[22px] font-normal leading-tight text-[#202124]">
              Access Denied
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-[#5f6368]">
              {accessDeniedMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex flex-row items-center justify-between px-6 pb-5 pt-8 sm:justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-full text-[#5f6368]">
              <Info className="h-5 w-5" />
            </span>
            <AlertDialogAction
              onClick={handleAccessDeniedOk}
              className="h-10 rounded-full bg-[#1a73e8] px-7 text-sm font-medium text-white shadow-none hover:bg-[#1765cc] focus:ring-2 focus:ring-[#1a73e8]/40"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Login;
