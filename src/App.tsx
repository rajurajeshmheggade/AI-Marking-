
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactElement } from "react";
import Login from "./pages/Login";
import Register from "./pages/register";
import OCREvaluation from "./pages/OCREvaluation";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SubjectDashboard from "./pages/SubjectDashboard";
import NotFound from "./pages/NotFound";
import SandboxDashboard from "./pages/SandboxDashboard";
import StandaloneOCREvaluation from "./pages/StandaloneOCREvaluation";

const queryClient = new QueryClient();

/**
 * Keeps the protected pages behind a signed-in session. A deactivated
 * (active="0") account never gets a session written, so this is what stops it
 * reaching a dashboard by typing the URL directly.
 * /sandbox is deliberately excluded - it guards itself on its own sandboxLogin key.
 */
const RequireAuth = ({ children }: { children: ReactElement }) => {
  const isLoggedIn = sessionStorage.getItem('isLogin') === 'true';
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/ocr-evaluation" element={<RequireAuth><OCREvaluation /></RequireAuth>} />
          <Route path="/subject-dashboard" element={<RequireAuth><SubjectDashboard /></RequireAuth>} />
          <Route path="/superadmin-dashboard" element={<RequireAuth><SuperAdminDashboard /></RequireAuth>} />
          <Route path="/standalone-ocr" element={<RequireAuth><StandaloneOCREvaluation /></RequireAuth>} />
          <Route path="/sandbox" element={<SandboxDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
