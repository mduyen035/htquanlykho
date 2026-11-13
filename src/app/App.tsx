import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useApp, AppProvider } from './context';
import { Layout } from '../presentation/components/Layout';
import { Login } from '../presentation/pages/Login';
import { Dashboard } from '../presentation/pages/Dashboard';
import { Materials } from '../presentation/pages/Materials';
import { Movements } from '../presentation/pages/Movements';
import { Counts } from '../presentation/pages/Counts';
import { Approvals } from '../presentation/pages/Approvals';
import { Recipes } from '../presentation/pages/Recipes';
import { SalesPage } from '../presentation/pages/Sales';
import { Reports } from '../presentation/pages/Reports';
function AppRoutes() {
  const { user } = useApp();
  if (!user) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="materials" element={<Materials />} />
        <Route path="inbound" element={<Movements key="inbound" kind="inbound" />} />
        <Route path="outbound" element={<Movements key="outbound" kind="outbound" />} />
        <Route path="counts" element={<Counts />} />
        {user.role === 'owner' && <Route path="approvals/:kind" element={<Approvals />} />}
        {user.role !== 'staff' && (
          <>
            <Route path="recipes" element={<Recipes />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="loss-report" element={<Reports key="loss" loss />} />
            <Route path="stock-report" element={<Reports key="stock" />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
