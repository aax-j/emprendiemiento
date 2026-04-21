
import { Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout/MainLayout";
import { AuthLayout } from "./layouts/AuthLayout/AuthLayout";
import { ProtectedRoute } from "./components/ProtectedRoute/ProtectedRoute";
import { OnboardingGuard } from "./components/ProtectedRoute/OnboardingGuard";
import { Login } from "./features/auth/Login/Login";
import { Register } from "./features/auth/Register/Register";
import { SetupWorkshop } from "./features/onboarding/SetupWorkshop/SetupWorkshop";
import { ClientList } from "./features/clients/ClientList/ClientList";
import { VehicleList } from "./features/vehicles/VehicleList/VehicleList";
import { Agenda } from "./features/agenda/Agenda/Agenda";
import { InventoryList } from "./features/inventory/InventoryList/InventoryList";
import { FinanceDashboard } from "./features/finance/FinanceDashboard/FinanceDashboard";
import { Customization } from "./features/customization/Customization/Customization";
import { Settings } from "./features/settings/Settings/Settings";

// Placeholder Pages

function App() {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Protected Setup Route (Needs session, but not workshop) */}
      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<SetupWorkshop />} />
      </Route>

      {/* Main App Routes (Needs session AND workshop) */}
      <Route element={<OnboardingGuard />}>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/agenda" replace />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="clients" element={<ClientList />} />
          <Route path="vehicles" element={<VehicleList />} />
          <Route path="inventory" element={<InventoryList />} />
          <Route path="finance" element={<FinanceDashboard />} />
          <Route path="customization" element={<Customization />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
