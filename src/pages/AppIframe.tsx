import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/loader";
import { ArrowLeft, LogOut } from "lucide-react";
import { toast } from "sonner";
import { AppDetail, getAppDetails } from "@/api";

const SSO_ENDPOINT = `${import.meta.env.VITE_AIAPPS_API_BASE || 'https://ailevate-poc.excelsoftcorp.com/aiapps'}/Login/ssoTokenGen`;

const AppIframe = () => {
  const { appCode = "" } = useParams<{ appCode: string }>();
  const navigate = useNavigate();

  const [token, setToken] = useState<string | null>(null);
  const [app, setApp] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = () => {
    ['isLogin', 'userInfo', 'username', 'password', 'userCode', 'orgCode', 'customerCode', 'userRole']
      .forEach(k => sessionStorage.removeItem(k));
    navigate('/login');
  };

  // Load app details to discover URL and validate redirect-eligibility
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const userInfo = JSON.parse(sessionStorage.getItem("userInfo") || "{}");
        const usercode = userInfo.userCode || "";
        const orgcode = userInfo.orgCode || "";
        if (!usercode || !orgcode) {
          throw new Error("User not logged in or missing codes");
        }
        const apps = await getAppDetails(usercode, orgcode, 1);
        const match = (apps || []).find(a => (a.appCode || "").toLowerCase() === appCode.toLowerCase());
        if (!match) {
          throw new Error(`App ${appCode} not found`);
        }
        if (!(match as any).isRedirect) {
          // If not an iframe/redirect type, send user to mapped internal route or back
          throw new Error("This app is not configured for iframe redirection.");
        }
        setApp(match);
      } catch (e: any) {
        const msg = e?.message || "Failed to load app details";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [appCode]);

  // Generate SSO token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(SSO_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Expires": "0",
          },
          body: JSON.stringify({
            username: sessionStorage.getItem("email"),
            password: sessionStorage.getItem("password"),
            appcode: appCode,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const t = data?.token as string | undefined;
        if (!t) throw new Error("Token not present in response");
        setToken(t);
      } catch (err: any) {
        const msg = err?.message || "Failed to generate SSO token";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    if (appCode) fetchToken();
  }, [appCode]);

  // Build iframe source from applicationURL and token
  const iframeSrc = useMemo(() => {
    if (!token || !app?.applicationURL) return undefined;
    const base = app.applicationURL;
    // Rule of thumb observed in existing pages:
    // - If URL already contains a hash ("#"), append "?isSSO=1&token=..."
    // - Otherwise, append "#/isSSO=1&token=..."
    if (base.includes("#")) {
      const joiner = base.includes("?") ? "&" : "?";
      return `${base}${joiner}isSSO=1&token=${encodeURIComponent(token)}`;
    }
    return `${base}#/isSSO=1&token=${encodeURIComponent(token)}`;
  }, [token, app?.applicationURL]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/lovable-uploads/b5b0f5a8-9552-4635-8c44-d5e6f994179c.png"
              alt="AI-Levate"
              className="h-8 w-auto"
            />
            <div>
              {/* Intentionally minimal header */}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="text-gray-600">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-gray-200 mx-1" />
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 text-gray-500 hover:text-red-500 transition-all duration-200 tracking-wide text-sm font-semibold px-2 py-1.5 rounded-lg hover:bg-red-50"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

     {loading && <PageLoader />}

      <main className="p-0">
        {error && (
          <div className="p-6">
            <div className="max-w-3xl mx-auto bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
              <p className="font-semibold">Unable to load {app?.applicationName || appCode}</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}
        {iframeSrc && !loading && !error && (
          <iframe
            title={app?.applicationName || appCode}
            src={iframeSrc}
            className="w-full h-[calc(100vh-64px)] border-0"
            allow="clipboard-write; fullscreen; display-capture;"
          />
        )}
      </main>
    </div>
  );
};

export default AppIframe;
