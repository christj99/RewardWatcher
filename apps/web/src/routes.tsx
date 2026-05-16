import { Navigate, type RouteObject } from "react-router-dom";

import { Layout } from "./components/Layout.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { FeedbackPage } from "./pages/FeedbackPage.js";
import { CreditsPage } from "./pages/CreditsPage.js";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { MerchantLookupPage } from "./pages/MerchantLookupPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import { OffersPage } from "./pages/OffersPage.js";
import { OnboardingPage } from "./pages/OnboardingPage.js";
import { OutcomesPage } from "./pages/OutcomesPage.js";
import { RecommendationHistoryPage } from "./pages/RecommendationHistoryPage.js";
import { RecommendationReceiptPage } from "./pages/RecommendationReceiptPage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import { RemindersPage } from "./pages/RemindersPage.js";
import { ResetPasswordPage } from "./pages/ResetPasswordPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { TransactionDetailPage } from "./pages/TransactionDetailPage.js";
import { TransactionImportPage } from "./pages/TransactionImportPage.js";
import { TransactionsPage } from "./pages/TransactionsPage.js";
import { WalletPage } from "./pages/WalletPage.js";
import { WeeklyAuditPage } from "./pages/WeeklyAuditPage.js";

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/dashboard", element: <Navigate to="/" replace /> },
          { path: "/onboarding", element: <OnboardingPage /> },
          { path: "/wallet", element: <WalletPage /> },
          { path: "/lookup", element: <MerchantLookupPage /> },
          { path: "/recommendations", element: <RecommendationHistoryPage /> },
          {
            path: "/recommendations/:id",
            element: <RecommendationReceiptPage />,
          },
          { path: "/transactions", element: <TransactionsPage /> },
          { path: "/transactions/import", element: <TransactionImportPage /> },
          { path: "/transactions/:id", element: <TransactionDetailPage /> },
          { path: "/outcomes", element: <OutcomesPage /> },
          { path: "/offers", element: <OffersPage /> },
          { path: "/reminders", element: <RemindersPage /> },
          { path: "/credits", element: <CreditsPage /> },
          { path: "/audit/weekly", element: <WeeklyAuditPage /> },
          { path: "/settings", element: <SettingsPage /> },
          { path: "/feedback", element: <FeedbackPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
