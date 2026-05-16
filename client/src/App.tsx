import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import AppointmentsPage from "./pages/AppointmentsPage";
import DashboardPage from "./pages/DashboardPage";
import ProfessionalsPage from "./pages/ProfessionalsPage";
import ServicesPage from "./pages/ServicesPage";
import CommissionsPage from "./pages/CommissionsPage";
import LoginPage from "./pages/LoginPage";
import RemindersPage from "./pages/RemindersPage";
import AccessLogsPage from "./pages/AccessLogsPage";
import ReminderChatbot from "./components/ReminderChatbot";
import { useAuth } from "./_core/hooks/useAuth";

function Router() {
  return (
    <Switch>
      {/* Rota de login — completamente isolada, sem DashboardLayout */}
      <Route path="/login" component={LoginPage} />

      {/* Todas as outras rotas ficam dentro do DashboardLayout */}
      <Route>
        <DashboardLayout>
          <Switch>
            <Route path="/" component={AppointmentsPage} />
            <Route path="/dashboard" component={DashboardPage} />
            <Route path="/professionals" component={ProfessionalsPage} />
            <Route path="/services" component={ServicesPage} />
            <Route path="/commissions" component={CommissionsPage} />
            <Route path="/reminders" component={RemindersPage} />
            <Route path="/access-logs" component={AccessLogsPage} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
          <AdminChatbot />
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function AdminChatbot() {
  const { user } = useAuth();
  if (user?.role !== "admin") return null;
  return <ReminderChatbot />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
