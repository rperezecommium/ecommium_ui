import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import {
  getAutomationAdminData,
  type AutomationAdminFilters,
  type AutomationExecutionStatus,
  type AutomationGuidedStarter,
  type AutomationRuleStatus,
} from "../../../../../src/modules/configuracion/automation-admin";
import { AutomationAdminPage } from "../../../../../src/modules/configuracion/automation-admin-page";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const ruleStatuses = new Set<AutomationRuleStatus>(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]);
const executionStatuses = new Set<AutomationExecutionStatus>([
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "SKIPPED",
  "RETRYING",
  "DLQ",
]);
const listLimits = new Set(["10", "20", "50"]);
const guidedStarters = new Set<AutomationGuidedStarter>(["delivery-email", "invoice-email", "post-sales-notice"]);

export default async function AutomatizacionPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const context = await getAdminContext();
  const filters: AutomationAdminFilters = {
    drawer: normalizeDrawer(first(query?.drawer)),
    eventType: first(query?.eventType),
    executionId: first(query?.executionId),
    executionStatus: normalizeExecutionStatus(first(query?.executionStatus)),
    notice: first(query?.notice),
    ruleId: first(query?.ruleId),
    ruleStatus: normalizeRuleStatus(first(query?.ruleStatus)),
    rulesLimit: normalizeListLimit(first(query?.rulesLimit)),
    rulesOffset: normalizeListOffset(first(query?.rulesOffset)),
    starter: normalizeStarter(first(query?.starter)),
    executionsLimit: normalizeListLimit(first(query?.executionsLimit)),
    executionsOffset: normalizeListOffset(first(query?.executionsOffset)),
  };
  const data = await getAutomationAdminData(context, filters);

  return <AutomationAdminPage data={data} filters={filters} />;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeRuleStatus(value: string | undefined): AutomationRuleStatus | undefined {
  return ruleStatuses.has(value as AutomationRuleStatus) ? value as AutomationRuleStatus : undefined;
}

function normalizeExecutionStatus(value: string | undefined): AutomationExecutionStatus | undefined {
  return executionStatuses.has(value as AutomationExecutionStatus) ? value as AutomationExecutionStatus : undefined;
}

function normalizeDrawer(value: string | undefined): AutomationAdminFilters["drawer"] {
  return value === "rule" || value === "execution" || value === "rule-create" || value === "rule-edit" || value === "rule-guided" || value === "rule-visual-create" || value === "rule-migrate"
    ? value
    : undefined;
}

function normalizeStarter(value: string | undefined): AutomationGuidedStarter | undefined {
  return guidedStarters.has(value as AutomationGuidedStarter) ? value as AutomationGuidedStarter : undefined;
}

function normalizeListLimit(value: string | undefined): string | undefined {
  return value && listLimits.has(value) ? value : undefined;
}

function normalizeListOffset(value: string | undefined): string | undefined {
  return value && /^\d+$/.test(value) ? value : undefined;
}
