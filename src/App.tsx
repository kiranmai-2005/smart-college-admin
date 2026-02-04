import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import GenerateCircular from "./pages/GenerateCircular";
import GenerateNotice from "./pages/GenerateNotice";
import GenerateTimetable from "./pages/GenerateTimetable";
import UploadDocuments from "./pages/UploadDocuments";
import DocumentHistory from "./pages/DocumentHistory";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/generate/circular" element={<GenerateCircular />} />
            <Route path="/generate/notice" element={<GenerateNotice />} />
            <Route path="/generate/timetable" element={<GenerateTimetable />} />
            <Route path="/upload" element={<UploadDocuments />} />
            <Route path="/history" element={<DocumentHistory />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
