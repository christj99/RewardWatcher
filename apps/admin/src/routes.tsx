import { Navigate, Route, Routes } from "react-router-dom";

import { AdminLayout } from "./components/AdminLayout";
import { AdminProtectedRoute } from "./components/AdminProtectedRoute";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { AdminFeedbackDetailPage } from "./pages/AdminFeedbackDetailPage";
import { AdminFeedbackPage } from "./pages/AdminFeedbackPage";
import { BetaCohortsPage } from "./pages/BetaCohortsPage";
import { BetaReadinessPage } from "./pages/BetaReadinessPage";
import { BetaUsersPage } from "./pages/BetaUsersPage";
import { CardDetailPage } from "./pages/CardDetailPage";
import { CardFormPage } from "./pages/CardFormPage";
import { CardsPage } from "./pages/CardsPage";
import { CorrectionsPage } from "./pages/CorrectionsPage";
import { CurrenciesPage } from "./pages/CurrenciesPage";
import { EarningRuleFormPage } from "./pages/EarningRuleFormPage";
import { EarningRulesPage } from "./pages/EarningRulesPage";
import { EmailLogsPage } from "./pages/EmailLogsPage";
import { EntitlementsPage } from "./pages/EntitlementsPage";
import { JobsPage } from "./pages/JobsPage";
import { KillTestPage } from "./pages/KillTestPage";
import { MerchantDetailPage } from "./pages/MerchantDetailPage";
import { MerchantsPage } from "./pages/MerchantsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { OfferFormPage } from "./pages/OfferFormPage";
import { OffersPage } from "./pages/OffersPage";
import { OpsSummaryPage } from "./pages/OpsSummaryPage";
import { RecommendationErrorsPage } from "./pages/RecommendationErrorsPage";
import { ReviewTaskDetailPage } from "./pages/ReviewTaskDetailPage";
import { ReviewTasksPage } from "./pages/ReviewTasksPage";
import { RuleFreshnessPage } from "./pages/RuleFreshnessPage";
import { RuleSourcesPage } from "./pages/RuleSourcesPage";

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route element={<AdminProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/review-tasks" element={<ReviewTasksPage />} />
          <Route path="/review-tasks/:id" element={<ReviewTaskDetailPage />} />
          <Route path="/corrections" element={<CorrectionsPage />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/cards/new" element={<CardFormPage />} />
          <Route path="/cards/:id" element={<CardDetailPage />} />
          <Route path="/cards/:id/edit" element={<CardFormPage />} />
          <Route path="/cards/:id/versions" element={<CardDetailPage />} />
          <Route path="/earning-rules" element={<EarningRulesPage />} />
          <Route path="/earning-rules/new" element={<EarningRuleFormPage />} />
          <Route
            path="/earning-rules/:id/edit"
            element={<EarningRuleFormPage />}
          />
          <Route path="/rule-sources" element={<RuleSourcesPage />} />
          <Route path="/currencies" element={<CurrenciesPage />} />
          <Route path="/merchants" element={<MerchantsPage />} />
          <Route path="/merchants/new" element={<MerchantDetailPage />} />
          <Route path="/merchants/:id" element={<MerchantDetailPage />} />
          <Route path="/offers" element={<OffersPage />} />
          <Route path="/offers/new" element={<OfferFormPage />} />
          <Route path="/offers/:id/edit" element={<OfferFormPage />} />
          <Route
            path="/recommendation-errors"
            element={<RecommendationErrorsPage />}
          />
          <Route path="/rule-freshness" element={<RuleFreshnessPage />} />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
          <Route path="/feedback" element={<AdminFeedbackPage />} />
          <Route path="/feedback/:id" element={<AdminFeedbackDetailPage />} />
          <Route path="/beta-users" element={<BetaUsersPage />} />
          <Route path="/beta-cohorts" element={<BetaCohortsPage />} />
          <Route path="/beta-readiness" element={<BetaReadinessPage />} />
          <Route path="/email-logs" element={<EmailLogsPage />} />
          <Route path="/entitlements" element={<EntitlementsPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/ops" element={<OpsSummaryPage />} />
          <Route path="/kill-test" element={<KillTestPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
