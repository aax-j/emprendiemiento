import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout/MainLayout";
import { ClientLayout } from "./layouts/ClientLayout/ClientLayout";
import { AuthLayout } from "./layouts/AuthLayout/AuthLayout";
import { ProtectedRoute } from "./components/ProtectedRoute/ProtectedRoute";
import { OnboardingGuard } from "./components/ProtectedRoute/OnboardingGuard";
import { Login } from "./features/auth/Login/Login";
import { Register } from "./features/auth/Register/Register";
import { SetupWorkshop } from "./features/onboarding/SetupWorkshop/SetupWorkshop";

// B2B - Módulos del Taller
import { ClientList } from "./features/clients/ClientList/ClientList";
import { VehicleList } from "./features/vehicles/VehicleList/VehicleList";
import { Agenda } from "./features/agenda/Agenda/Agenda";
import { InventoryList } from "./features/inventory/InventoryList/InventoryList";
import { FinanceDashboard } from "./features/finance/FinanceDashboard/FinanceDashboard";
import { Customization } from "./features/customization/Customization/Customization";
import { Settings } from "./features/settings/Settings/Settings";

// B2C - Módulos del Portal de Cliente
import { ClientDashboard } from "./features/client_portal/ClientDashboard";
import { WorkshopDirectory } from "./features/client_portal/WorkshopDirectory";
import { WorkshopDetails } from "./features/client_portal/WorkshopDetails";
import { ClientConnections } from "./features/client_portal/ClientConnections";
import { VehicleTelemetry } from "./features/client_portal/VehicleTelemetry";

const router = createBrowserRouter([
  // ── Rutas públicas de auth ────────────────────────────────────────────────
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <Login /> },
      { path: "/register", element: <Register /> },
    ],
  },

  // ── Onboarding del Taller (requiere sesión, sin workshop aún) ─────────────
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/onboarding", element: <SetupWorkshop /> },
    ],
  },

  // ── Layout unificado — el OnboardingGuard bifurca por role_type ───────────
  {
    element: <OnboardingGuard />,
    children: [

      // ── Portal B2B: Taller / Mecánico ──────────────────────────────────
      {
        path: "/",
        element: <MainLayout />,
        children: [
          { index: true, element: <Navigate to="/agenda" replace /> },
          { path: "agenda", element: <Agenda /> },
          { path: "clients", element: <ClientList /> },
          { path: "vehicles", element: <VehicleList /> },
          { path: "inventory", element: <InventoryList /> },
          { path: "finance", element: <FinanceDashboard /> },
          { path: "customization", element: <Customization /> },
          { path: "settings", element: <Settings /> },
        ],
      },

      // ── Portal B2C: Cliente Final ──────────────────────────────────────
      {
        path: "/client",
        element: <ClientLayout />,
        children: [
          { index: true, element: <Navigate to="/client/dashboard" replace /> },
          { path: "dashboard", element: <ClientDashboard /> },
          { path: "vehicles", element: <VehicleTelemetry /> },
          { path: "directory", element: <WorkshopDirectory /> },
          { path: "directory/:workshopId", element: <WorkshopDetails /> },
          { path: "connections", element: <ClientConnections /> },
        ],
      },
    ],
  },

  { path: "*", element: <Navigate to="/" replace /> },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;

