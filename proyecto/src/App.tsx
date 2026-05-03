import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
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

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <Login /> },
      { path: "/register", element: <Register /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/onboarding", element: <SetupWorkshop /> },
    ],
  },
  {
    element: <OnboardingGuard />,
    children: [
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
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
