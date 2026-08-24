import { requestAdminBff } from "../../shared/bff/admin-client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminSession } from "../../shared/auth/session";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import { getCustomerDetail } from "../clientes/customers-admin";

export type AfterSalesAdminDrawerTab = "caso" | "propuesta" | "ejecucion" | "historial";
export type AfterSalesAdminLegacyDrawerTab = "operacion" | "devolucion" | "resolucion" | "auditoria";

/**
 * Contrato de presentación Admin para las propuestas versionadas. La UI solo
 * representa lo que decide After Sales; no deriva ni persiste una transición.
 */
export type AfterSalesAdminSolutionProposalStatus =
  | "PENDING_CUSTOMER"
  | "SUPERSEDED"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED";

export type AfterSalesAdminSolutionType =
  | "REFUND"
  | "EXCHANGE"
  | "REPAIR"
  | "REPLACEMENT"
  | "STORE_CREDIT"
  | "NO_ACTION";

export type AfterSalesAdminSolutionProposal = {
  proposalId: string;
  version: number;
  status: AfterSalesAdminSolutionProposalStatus;
  solutionType: AfterSalesAdminSolutionType;
  customerMessage: string;
  amountMinor: number | null;
  currency: string | null;
  returnRequired: boolean;
  returnShippingPaidBy: "STORE" | "CUSTOMER" | "NOT_REQUIRED";
  createdAt: string | null;
  respondedAt: string | null;
  expiresAt: string | null;
};

export type AfterSalesAdminWorkflowPhase =
  | "REVIEW"
  | "WAITING_CUSTOMER"
  | "HIBERNATING"
  | "EXECUTION"
  | "READY_TO_CLOSE"
  | "WAITING_CUSTOMER_CONFIRMATION"
  | "CLOSED"
  | "LEGACY_EXECUTION";

/** Acciones de negocio permitidas; nunca es un estado técnico editable. */
export type AfterSalesAdminWorkflowAction =
  | "START_REVIEW"
  | "SEND_PROPOSAL"
  | "START_SOLUTION_EXECUTION"
  | "PROCESS_REFUND"
  | "COMPLETE_SOLUTION"
  | "RECORD_CLOSURE_PROOF"
  | "CLOSE_CASE";

export type AfterSalesAdminWorkflowPresentation = {
  phase: AfterSalesAdminWorkflowPhase;
  title: string;
  detail: string;
  primaryAction: AfterSalesAdminWorkflowAction | null;
  usesLegacyOperations: boolean;
};

export type AfterSalesAdminFilters = {
  caseId?: string;
  /** Acepta tabs antiguas solo para redirigir su presentación de forma segura. */
  caseTab?: AfterSalesAdminDrawerTab | AfterSalesAdminLegacyDrawerTab;
  caseFocus?: "message" | "evidence";
  status?: string;
  customerId?: string;
  orderId?: string;
  assignedEmployeeId?: string;
  limit?: string;
  offset?: string;
  taskType?: string;
  taskStatus?: string;
  taskLimit?: string;
  taskOffset?: string;
  notice?: string;
  noticeKind?: "success" | "error";
};

export type AfterSalesAdminCapabilities = {
  canViewAfterSales: boolean;
  canManageAfterSales: boolean;
};

export type AfterSalesAdminEmployee = {
  employeeId: string;
  label: string;
  active: boolean;
};

export type AfterSalesAdminReferenceOption = {
  id: string;
  label: string;
};

export type AfterSalesAdminOrderReferences = {
  transactions: AfterSalesAdminReferenceOption[];
  invoices: AfterSalesAdminReferenceOption[];
};

export type AfterSalesAdminHealth = {
  service?: string;
  status?: string;
  databaseReachable?: boolean;
  publisherEnabled?: boolean;
  consumerEnabled?: boolean;
};

export type AfterSalesAdminCaseItem = {
  caseItemId: string;
  name?: string;
  productId?: string | null;
  variantId?: string | null;
  quantityRequested?: number;
  quantityApproved?: number | null;
  status?: string;
};

export type AfterSalesAdminMessage = {
  messageId: string;
  authorType?: string;
  authorId?: string | null;
  visibility?: string;
  kind?: string;
  body?: string;
  createdAt?: string;
};

export type AfterSalesAdminEvidence = {
  evidenceId: string;
  privateEvidenceId: string | null;
  evidenceType?: string;
  visibility?: "CUSTOMER" | "INTERNAL";
  createdAt?: string;
};

export type AfterSalesAdminClosureProof = {
  closureProofId: string;
  resolutionId: string;
  evidenceId: string | null;
  source: "CUSTOMER_CONFIRMATION" | "ADMIN_EVIDENCE" | "PAYMENTS" | "SHIPPING";
  visibility: "CUSTOMER" | "INTERNAL";
  note: string | null;
  createdBy: string | null;
  createdAt: string | null;
  invalidatedAt: string | null;
};

export type AfterSalesAdminResolution = {
  resolutionId: string;
  caseItemId: string | null;
  resolutionType: string | null;
  status: string | null;
  amountMinor: number | null;
  currency: string | null;
  createdAt: string | null;
  completedAt: string | null;
};

export type AfterSalesAdminReturnAuthorization = {
  returnAuthorizationId: string;
  status: string | null;
  authorizedAt: string | null;
  receivedAt: string | null;
  createdAt: string | null;
};

export type AfterSalesAdminRefundRequest = {
  refundRequestId: string;
  resolutionId: string | null;
  transactionId: string | null;
  status: string | null;
  amountMinor: number | null;
  currency: string | null;
  requestedAt: string | null;
  completedAt: string | null;
};

export type AfterSalesAdminOperationalImpact = {
  impactId: string;
  status: string | null;
  createdAt: string | null;
};

export type AfterSalesAdminCase = {
  caseId: string;
  orderId: string;
  customerId?: string | null;
  caseType?: string;
  status?: string;
  lifecycleStatus?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  operationalStage?: string | null;
  resolutionOutcome?: string | null;
  resolutionReason?: string | null;
  closureProofRequired?: boolean;
  autoCloseAt?: string | null;
  closedBy?: string | null;
  closureReason?: string | null;
  assignedEmployeeId?: string | null;
  assignedBy?: string | null;
  assignedAt?: string | null;
  reasonCode?: string | null;
  customerMessage?: string | null;
  adminNotes?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  items: AfterSalesAdminCaseItem[];
  messages: AfterSalesAdminMessage[];
  evidences: AfterSalesAdminEvidence[];
  closureProofs: AfterSalesAdminClosureProof[];
  solutionProposals: AfterSalesAdminSolutionProposal[];
  resolutions: AfterSalesAdminResolution[];
  returnAuthorizations: AfterSalesAdminReturnAuthorization[];
  refundRequests: AfterSalesAdminRefundRequest[];
  inventoryDispositions: AfterSalesAdminOperationalImpact[];
  documentAdjustments: AfterSalesAdminOperationalImpact[];
};

/** Datos de progreso para mostrar, no una decisión de completitud. */
export type AfterSalesAdminExecutionSummary = {
  acceptedProposal: AfterSalesAdminSolutionProposal | null;
  resolution: AfterSalesAdminResolution | null;
  requiresReturn: boolean;
  returnReceived: boolean;
  requiresRefund: boolean;
  /** Estado real del reembolso asociado a la resolución acordada. */
  refundStatus: string | null;
  refundCompleted: boolean;
};

export type AfterSalesAdminCaseList = {
  items: AfterSalesAdminCase[];
  total: number;
  limit: number;
  offset: number;
};

export type AfterSalesAdminTaskType = "NEW_CASE" | "CUSTOMER_MESSAGE" | "EVIDENCE_REVIEW" | "SOLUTION_PROPOSAL_REJECTED" | "SOLUTION_PROPOSAL_ACCEPTED";
export type AfterSalesAdminTaskStatus = "OPEN" | "ASSIGNED";

export type AfterSalesAdminTask = {
  taskId: string;
  caseId: string;
  taskType: AfterSalesAdminTaskType;
  status: AfterSalesAdminTaskStatus;
  priority: "NORMAL" | "HIGH";
  assignedEmployeeId: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  lastActivityAt: string;
};

export type AfterSalesAdminTaskList = {
  items: AfterSalesAdminTask[];
  total: number;
  limit: number;
  offset: number;
};

export type AfterSalesAdminTaskSummary = {
  pendingCount: number;
  openCount: number;
  assignedCount: number;
};

export type AfterSalesAdminData = {
  context: AdminContext;
  health: BffResult<AfterSalesAdminHealth | null>;
  cases: BffResult<AfterSalesAdminCaseList>;
  taskSummary: BffResult<AfterSalesAdminTaskSummary | null>;
  tasks: BffResult<AfterSalesAdminTaskList>;
  selectedCase: BffResult<AfterSalesAdminCase | null>;
  employees: BffResult<AfterSalesAdminEmployee[]>;
  orderReferences: BffResult<AfterSalesAdminOrderReferences | null>;
  selectedCustomerReference: string | null;
};

/**
 * Evento diseñado para explicar el expediente a una persona. A diferencia de
 * la auditoría, no transporta IDs, nombres de estados técnicos ni referencias
 * operativas que no ayudan a entender qué ocurrió.
 */
export type AfterSalesAdminHistoryEventKind =
  | "CASE_OPENED"
  | "CASE_ASSIGNED"
  | "REVIEW_STARTED"
  | "CUSTOMER_MESSAGE"
  | "TEAM_MESSAGE"
  | "CUSTOMER_EVIDENCE"
  | "INTERNAL_EVIDENCE"
  | "PROPOSAL_SENT"
  | "PROPOSAL_ACCEPTED"
  | "PROPOSAL_REJECTED"
  | "PROPOSAL_EXPIRED"
  | "SOLUTION_STARTED"
  | "SOLUTION_COMPLETED"
  | "RETURN_RECEIVED"
  | "REFUND_COMPLETED"
  | "CLOSURE_PROOF_RECORDED"
  | "CASE_CLOSED";

export type AfterSalesAdminHistoryEvent = {
  eventId: string;
  kind: AfterSalesAdminHistoryEventKind;
  title: string;
  occurredAt: string;
  actor: "CUSTOMER" | "TEAM" | "SYSTEM";
  detail?: string;
  visibility: "CUSTOMER" | "INTERNAL";
  evidenceId?: string;
  proposal?: {
    version: number;
    solutionLabel: string;
    amountMinor: number | null;
    currency: string | null;
    returnRequired: boolean;
  };
  execution?: {
    label: string;
    amountMinor?: number | null;
    currency?: string | null;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  return value === null ? null : asString(value);
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asNullableNumber(value: unknown): number | null | undefined {
  return value === null ? null : asNumber(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordField(value: unknown, keys: string[]): string | undefined {
  const record = asRecord(value);
  for (const key of keys) {
    const field = record[key];
    if (typeof field === "string" && field.trim()) {
      return field.trim();
    }
    if (typeof field === "number" && Number.isFinite(field)) {
      return String(field);
    }
  }

  return undefined;
}

function recordStatus(value: unknown) {
  return recordField(value, ["status", "resolutionType", "adjustmentType", "dispositionType", "evidenceType"]);
}

function scopedPath(path: string, context: AdminContext, extra?: Record<string, string | undefined>) {
  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
  });

  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value?.trim()) {
      params.set(key, value.trim());
    }
  });

  return `${path}?${params.toString()}`;
}

function unavailable<T>(error: string): BffResult<T> {
  return {
    ok: false,
    error,
    status: 428,
    correlationId: "after-sales-admin-unavailable",
  };
}

function normalizeItem(value: unknown): AfterSalesAdminCaseItem {
  const record = asRecord(value);

  return {
    caseItemId: asString(record.caseItemId) ?? asString(record.id) ?? "",
    name: asString(record.name),
    productId: asNullableString(record.productId),
    variantId: asNullableString(record.variantId),
    quantityRequested: asNumber(record.quantityRequested),
    quantityApproved: asNullableNumber(record.quantityApproved),
    status: asString(record.status),
  };
}

function normalizeMessage(value: unknown): AfterSalesAdminMessage {
  const record = asRecord(value);

  return {
    messageId: asString(record.messageId) ?? asString(record.id) ?? "",
    authorType: asString(record.authorType),
    authorId: asNullableString(record.authorId),
    visibility: asString(record.visibility),
    kind: asString(record.kind),
    body: asString(record.body),
    createdAt: asString(record.createdAt),
  };
}

function normalizeEvidence(value: unknown): AfterSalesAdminEvidence {
  const record = asRecord(value);

  return {
    evidenceId: asString(record.evidenceId) ?? asString(record.id) ?? "",
    privateEvidenceId: asNullableString(record.privateEvidenceId) ?? null,
    evidenceType: asString(record.evidenceType),
    visibility: asString(record.visibility) as AfterSalesAdminEvidence["visibility"],
    createdAt: asString(record.createdAt),
  };
}

const closureProofSources = new Set<AfterSalesAdminClosureProof["source"]>([
  "CUSTOMER_CONFIRMATION",
  "ADMIN_EVIDENCE",
  "PAYMENTS",
  "SHIPPING",
]);
const closureProofVisibilities = new Set<AfterSalesAdminClosureProof["visibility"]>(["CUSTOMER", "INTERNAL"]);

function normalizeClosureProof(value: unknown): AfterSalesAdminClosureProof | null {
  const record = asRecord(value);
  const closureProofId = asString(record.closureProofId) ?? asString(record.id);
  const resolutionId = asString(record.resolutionId);
  const source = asString(record.source) as AfterSalesAdminClosureProof["source"] | undefined;
  const visibility = asString(record.visibility) as AfterSalesAdminClosureProof["visibility"] | undefined;
  if (!closureProofId || !resolutionId || !source || !closureProofSources.has(source) || !visibility || !closureProofVisibilities.has(visibility)) {
    return null;
  }

  return {
    closureProofId,
    resolutionId,
    evidenceId: asNullableString(record.evidenceId) ?? null,
    source,
    visibility,
    note: asNullableString(record.note) ?? null,
    createdBy: asNullableString(record.createdBy) ?? null,
    createdAt: asNullableString(record.createdAt) ?? null,
    invalidatedAt: asNullableString(record.invalidatedAt) ?? null,
  };
}

const proposalStatuses = new Set<AfterSalesAdminSolutionProposalStatus>([
  "PENDING_CUSTOMER",
  "SUPERSEDED",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
]);
const proposalSolutionTypes = new Set<AfterSalesAdminSolutionType>([
  "REFUND",
  "EXCHANGE",
  "REPAIR",
  "REPLACEMENT",
  "STORE_CREDIT",
  "NO_ACTION",
]);
const returnShippingPayers = new Set<AfterSalesAdminSolutionProposal["returnShippingPaidBy"]>([
  "STORE",
  "CUSTOMER",
  "NOT_REQUIRED",
]);

function normalizeSolutionProposal(value: unknown): AfterSalesAdminSolutionProposal | null {
  const record = asRecord(value);
  const proposalId = asString(record.proposalId) ?? asString(record.id);
  const status = asString(record.status) as AfterSalesAdminSolutionProposalStatus | undefined;
  const solutionType = asString(record.solutionType) as AfterSalesAdminSolutionType | undefined;
  const returnShippingPaidBy = asString(record.returnShippingPaidBy) as AfterSalesAdminSolutionProposal["returnShippingPaidBy"] | undefined;

  if (!proposalId || !status || !proposalStatuses.has(status) || !solutionType || !proposalSolutionTypes.has(solutionType)) {
    return null;
  }

  return {
    proposalId,
    version: asNumber(record.version) ?? 1,
    status,
    solutionType,
    customerMessage: asString(record.customerMessage) ?? "",
    amountMinor: asNullableNumber(record.amountMinor) ?? null,
    currency: asNullableString(record.currency) ?? null,
    returnRequired: record.returnRequired === true,
    returnShippingPaidBy: returnShippingPaidBy && returnShippingPayers.has(returnShippingPaidBy)
      ? returnShippingPaidBy
      : "NOT_REQUIRED",
    createdAt: asNullableString(record.createdAt) ?? null,
    respondedAt: asNullableString(record.respondedAt) ?? null,
    expiresAt: asNullableString(record.expiresAt) ?? null,
  };
}

function normalizeResolution(value: unknown): AfterSalesAdminResolution | null {
  const record = asRecord(value);
  const resolutionId = asString(record.resolutionId) ?? asString(record.caseResolutionId) ?? asString(record.id);
  if (!resolutionId) return null;

  return {
    resolutionId,
    caseItemId: asNullableString(record.caseItemId) ?? null,
    resolutionType: asNullableString(record.resolutionType) ?? null,
    status: asNullableString(record.status) ?? null,
    amountMinor: asNullableNumber(record.amountMinor) ?? null,
    currency: asNullableString(record.currency) ?? null,
    createdAt: asNullableString(record.createdAt) ?? null,
    completedAt: asNullableString(record.completedAt) ?? null,
  };
}

function normalizeReturnAuthorization(value: unknown): AfterSalesAdminReturnAuthorization | null {
  const record = asRecord(value);
  const returnAuthorizationId = asString(record.returnAuthorizationId) ?? asString(record.authorizationId) ?? asString(record.id);
  if (!returnAuthorizationId) return null;

  return {
    returnAuthorizationId,
    status: asNullableString(record.status) ?? null,
    authorizedAt: asNullableString(record.authorizedAt) ?? null,
    receivedAt: asNullableString(record.receivedAt) ?? null,
    createdAt: asNullableString(record.createdAt) ?? null,
  };
}

function normalizeRefundRequest(value: unknown): AfterSalesAdminRefundRequest | null {
  const record = asRecord(value);
  const refundRequestId = asString(record.refundRequestId) ?? asString(record.requestId) ?? asString(record.id);
  if (!refundRequestId) return null;

  return {
    refundRequestId,
    resolutionId: asNullableString(record.resolutionId) ?? null,
    transactionId: asNullableString(record.transactionId) ?? null,
    status: asNullableString(record.status) ?? null,
    amountMinor: asNullableNumber(record.amountMinor) ?? null,
    currency: asNullableString(record.currency) ?? null,
    requestedAt: asNullableString(record.requestedAt) ?? null,
    completedAt: asNullableString(record.completedAt) ?? null,
  };
}

function normalizeOperationalImpact(value: unknown, idKeys: string[]): AfterSalesAdminOperationalImpact | null {
  const record = asRecord(value);
  const impactId = recordField(record, idKeys);
  if (!impactId) return null;

  return {
    impactId,
    status: asNullableString(record.status) ?? null,
    createdAt: asNullableString(record.createdAt) ?? null,
  };
}

export function normalizeAfterSalesCase(value: unknown): AfterSalesAdminCase {
  const record = asRecord(value);

  return {
    caseId: asString(record.caseId) ?? asString(record.id) ?? "",
    orderId: asString(record.orderId) ?? "",
    customerId: asNullableString(record.customerId),
    caseType: asString(record.caseType),
    status: asString(record.status),
    lifecycleStatus: asString(record.lifecycleStatus) as AfterSalesAdminCase["lifecycleStatus"],
    operationalStage: asNullableString(record.operationalStage),
    resolutionOutcome: asNullableString(record.resolutionOutcome),
    resolutionReason: asNullableString(record.resolutionReason),
    closureProofRequired: record.closureProofRequired === true,
    autoCloseAt: asNullableString(record.autoCloseAt),
    closedBy: asNullableString(record.closedBy),
    closureReason: asNullableString(record.closureReason),
    assignedEmployeeId: asNullableString(record.assignedEmployeeId),
    assignedBy: asNullableString(record.assignedBy),
    assignedAt: asNullableString(record.assignedAt),
    reasonCode: asNullableString(record.reasonCode),
    customerMessage: asNullableString(record.customerMessage),
    adminNotes: asNullableString(record.adminNotes),
    submittedAt: asNullableString(record.submittedAt),
    reviewedAt: asNullableString(record.reviewedAt),
    resolvedAt: asNullableString(record.resolvedAt),
    closedAt: asNullableString(record.closedAt),
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
    items: asArray(record.items).map(normalizeItem),
    messages: asArray(record.messages).map(normalizeMessage).filter((message) => Boolean(message.messageId)),
    evidences: asArray(record.evidences)
      .map(normalizeEvidence)
      .filter((evidence) => Boolean(evidence.evidenceId)),
    closureProofs: asArray(record.closureProofs)
      .map(normalizeClosureProof)
      .filter((proof): proof is AfterSalesAdminClosureProof => Boolean(proof)),
    solutionProposals: asArray(record.solutionProposals)
      .map(normalizeSolutionProposal)
      .filter((proposal): proposal is AfterSalesAdminSolutionProposal => Boolean(proposal)),
    resolutions: asArray(record.resolutions)
      .map(normalizeResolution)
      .filter((resolution): resolution is AfterSalesAdminResolution => Boolean(resolution)),
    returnAuthorizations: asArray(record.returnAuthorizations)
      .map(normalizeReturnAuthorization)
      .filter((authorization): authorization is AfterSalesAdminReturnAuthorization => Boolean(authorization)),
    refundRequests: asArray(record.refundRequests)
      .map(normalizeRefundRequest)
      .filter((refund): refund is AfterSalesAdminRefundRequest => Boolean(refund)),
    inventoryDispositions: asArray(record.inventoryDispositions)
      .map((impact) => normalizeOperationalImpact(impact, ["inventoryDispositionId", "dispositionId", "id"]))
      .filter((impact): impact is AfterSalesAdminOperationalImpact => Boolean(impact)),
    documentAdjustments: asArray(record.documentAdjustments)
      .map((impact) => normalizeOperationalImpact(impact, ["documentAdjustmentId", "adjustmentId", "id"]))
      .filter((impact): impact is AfterSalesAdminOperationalImpact => Boolean(impact)),
  };
}

function hasInProgressResolution(caseRecord: AfterSalesAdminCase) {
  return caseRecord.resolutions.some((resolution) => recordStatus(resolution) === "IN_PROGRESS");
}

export function hasActiveAfterSalesClosureProof(caseRecord: AfterSalesAdminCase) {
  return caseRecord.closureProofs.some((proof) => proof.invalidatedAt === null);
}

function activeProposal(caseRecord: AfterSalesAdminCase) {
  return caseRecord.solutionProposals.find((proposal) => proposal.status === "PENDING_CUSTOMER")
    ?? caseRecord.solutionProposals.find((proposal) => proposal.status === "ACCEPTED")
    ?? caseRecord.solutionProposals.find((proposal) => proposal.status === "EXPIRED")
    ?? null;
}

function proposalHasExpired(proposal: AfterSalesAdminSolutionProposal) {
  // El worker de After Sales decide y persiste la expiración. La UI no debe
  // adelantar ese cambio por reloj local ni convertir silencio en aceptación.
  return proposal.status === "EXPIRED";
}

function firstByStatus<T extends { status: string | null }>(items: T[], statuses: string[]) {
  return items.find((item) => item.status !== null && statuses.includes(item.status)) ?? null;
}

/**
 * Proyección compacta de ejecución para la futura pestaña. No intenta validar
 * importes, moneda ni requisitos finales: esa decisión sigue siendo de BFF.
 */
export function getAfterSalesExecutionSummary(caseRecord: AfterSalesAdminCase): AfterSalesAdminExecutionSummary {
  const acceptedProposal = caseRecord.solutionProposals.find((proposal) => proposal.status === "ACCEPTED") ?? null;
  const resolution = firstByStatus(caseRecord.resolutions, ["IN_PROGRESS"])
    ?? firstByStatus(caseRecord.resolutions, ["COMPLETED"])
    ?? caseRecord.resolutions[0]
    ?? null;
  const returnAuthorization = firstByStatus(caseRecord.returnAuthorizations, ["RECEIVED"])
    ?? caseRecord.returnAuthorizations[0]
    ?? null;
  const refund = resolution
    ? caseRecord.refundRequests.find((request) => request.resolutionId === resolution.resolutionId)
      ?? firstByStatus(caseRecord.refundRequests, ["COMPLETED"])
      ?? caseRecord.refundRequests[0]
      ?? null
    : null;

  return {
    acceptedProposal,
    resolution,
    requiresReturn: acceptedProposal?.returnRequired === true,
    returnReceived: returnAuthorization?.status === "RECEIVED",
    requiresRefund: acceptedProposal?.solutionType === "REFUND",
    refundStatus: refund?.status ?? null,
    refundCompleted: refund?.status === "COMPLETED",
  };
}

/**
 * Matriz UI controlada para el nuevo flujo. Es deliberadamente conservadora:
 * los casos anteriores a propuestas se identifican como legado y no se les
 * fuerza una transición nueva desde el navegador.
 */
export function getAfterSalesWorkflowPresentation(
  caseRecord: AfterSalesAdminCase,
): AfterSalesAdminWorkflowPresentation {
  const status = caseRecord.status ?? "SUBMITTED";
  const lifecycle = caseRecord.lifecycleStatus;
  const proposal = activeProposal(caseRecord);

  if (status === "CLOSED" || lifecycle === "CLOSED") {
    return {
      phase: "CLOSED",
      title: "Cerrado",
      detail: "El expediente permanece disponible para consulta, sin nuevas interacciones.",
      primaryAction: null,
      usesLegacyOperations: false,
    };
  }

  if (status === "RESOLVED" || lifecycle === "RESOLVED") {
    const closureProofPending = caseRecord.closureProofRequired === true && !hasActiveAfterSalesClosureProof(caseRecord);
    if (caseRecord.closureProofRequired === true && !closureProofPending) {
      return {
        phase: "WAITING_CUSTOMER_CONFIRMATION",
        title: "Esperando confirmación del cliente",
        detail: caseRecord.autoCloseAt
          ? "El cliente puede confirmar que recibió la solución. Si no responde, el caso se cerrará automáticamente al vencer el plazo."
          : "La solución está lista. El caso espera la confirmación del cliente o el cierre automático cuando exista un plazo.",
        primaryAction: null,
        usesLegacyOperations: false,
      };
    }
    return {
      phase: "READY_TO_CLOSE",
      title: closureProofPending ? "Prueba de cierre pendiente" : "Listo para cerrar",
      detail: closureProofPending
        ? "La solución terminó. Registra la prueba interna de cierre para avisar al cliente e iniciar el plazo automático."
        : "La solución terminó. Confirma el cierre cuando la comunicación final esté completa.",
      primaryAction: closureProofPending ? "RECORD_CLOSURE_PROOF" : "CLOSE_CASE",
      usesLegacyOperations: false,
    };
  }

  if (status === "SUBMITTED") {
    return {
      phase: "REVIEW",
      title: "En revisión",
      detail: "Caso nuevo pendiente de revisión. La primera acción asignará el caso automáticamente.",
      primaryAction: "START_REVIEW",
      usesLegacyOperations: false,
    };
  }

  if (status === "UNDER_REVIEW") {
    return {
      phase: "REVIEW",
      title: "En revisión",
      detail: "Puedes conversar con el cliente, revisar evidencias o preparar una propuesta de solución.",
      primaryAction: "SEND_PROPOSAL",
      usesLegacyOperations: false,
    };
  }

  if (status === "AWAITING_CUSTOMER") {
    if (proposal && proposalHasExpired(proposal)) {
      return {
        phase: "HIBERNATING",
        title: "Invernando",
        detail: "La propuesta venció sin respuesta. Una nueva actividad del cliente reabrirá la revisión.",
        primaryAction: null,
        usesLegacyOperations: false,
      };
    }

    return {
      phase: "WAITING_CUSTOMER",
      title: "Esperando al cliente",
      detail: "La propuesta fue enviada y queda pendiente de aceptación o rechazo del cliente.",
      primaryAction: null,
      usesLegacyOperations: false,
    };
  }

  if (status === "RESOLUTION_IN_PROGRESS") {
    const execution = getAfterSalesExecutionSummary(caseRecord);
    if (!hasInProgressResolution(caseRecord)) {
      return {
        phase: "EXECUTION",
        title: "Preparar solución",
        detail: "La propuesta fue aceptada. Inicia la ejecución para registrar los impactos de la solución.",
        primaryAction: "START_SOLUTION_EXECUTION",
        usesLegacyOperations: false,
      };
    }

    if (execution.requiresReturn && !execution.returnReceived) {
      return {
        phase: "EXECUTION",
        title: "Esperando devolución",
        detail: "El producto debe quedar recibido antes de finalizar la solución.",
        primaryAction: null,
        usesLegacyOperations: false,
      };
    }

    if (execution.requiresRefund && !execution.refundCompleted) {
      const refundInProgress = execution.refundStatus !== null;
      return {
        phase: "EXECUTION",
        title: refundInProgress ? "Reembolso en curso" : "Procesar reembolso",
        detail: refundInProgress
          ? "El reembolso está siendo procesado. La finalización se habilitará cuando el pago lo confirme."
          : "Procesa el reembolso acordado. La solución solo podrá finalizarse cuando el pago quede confirmado.",
        primaryAction: refundInProgress ? null : "PROCESS_REFUND",
        usesLegacyOperations: false,
      };
    }

    return {
      phase: "EXECUTION",
      title: "En ejecución",
      detail: "La solución fue aceptada. El sistema conserva y valida sus impactos antes de finalizar.",
      primaryAction: "COMPLETE_SOLUTION",
      usesLegacyOperations: false,
    };
  }

  return {
    phase: "LEGACY_EXECUTION",
    title: "Operación heredada",
    detail: "Este caso usa el flujo anterior y conservará sus acciones específicas hasta completarse.",
    primaryAction: null,
    usesLegacyOperations: true,
  };
}

function historyEvent(event: AfterSalesAdminHistoryEvent): AfterSalesAdminHistoryEvent {
  return event;
}

function proposalSolutionLabel(solutionType: AfterSalesAdminSolutionType) {
  const labels: Record<AfterSalesAdminSolutionType, string> = {
    REFUND: "reembolso",
    EXCHANGE: "cambio",
    REPAIR: "reparación",
    REPLACEMENT: "reemplazo",
    STORE_CREDIT: "crédito en tienda",
    NO_ACTION: "sin acción",
  };
  return labels[solutionType];
}

function executionOutcomeLabel(value: string | null) {
  const labels: Record<string, string> = {
    REFUND: "Reembolso",
    EXCHANGE: "Cambio",
    REPAIR: "Reparación",
    REPLACEMENT: "Reemplazo",
    STORE_CREDIT: "Crédito en tienda",
    NO_ACTION: "Sin acción",
  };
  return value ? labels[value] ?? "Solución acordada" : "Solución acordada";
}

function proposalResponseHistoryEvent(proposal: AfterSalesAdminSolutionProposal): AfterSalesAdminHistoryEvent | null {
  const responseAt = proposal.respondedAt ?? (proposal.status === "EXPIRED" ? proposal.expiresAt : null);
  if (!responseAt || proposal.status === "PENDING_CUSTOMER" || proposal.status === "SUPERSEDED") {
    return null;
  }

  const configuration: Record<Exclude<AfterSalesAdminSolutionProposalStatus, "PENDING_CUSTOMER" | "SUPERSEDED">, Pick<AfterSalesAdminHistoryEvent, "kind" | "title" | "actor">> = {
    ACCEPTED: { kind: "PROPOSAL_ACCEPTED", title: "El cliente aceptó la propuesta", actor: "CUSTOMER" },
    REJECTED: { kind: "PROPOSAL_REJECTED", title: "El cliente rechazó la propuesta", actor: "CUSTOMER" },
    EXPIRED: { kind: "PROPOSAL_EXPIRED", title: "La propuesta venció sin respuesta", actor: "SYSTEM" },
  };
  const event = configuration[proposal.status];

  return historyEvent({
    eventId: `proposal-response:${proposal.proposalId}:${proposal.status}`,
    ...event,
    occurredAt: responseAt,
    visibility: "CUSTOMER",
    proposal: proposalHistorySummary(proposal),
  });
}

function proposalHistorySummary(proposal: AfterSalesAdminSolutionProposal) {
  return {
    version: proposal.version,
    solutionLabel: proposalSolutionLabel(proposal.solutionType),
    amountMinor: proposal.amountMinor,
    currency: proposal.currency,
    returnRequired: proposal.returnRequired,
  };
}

/**
 * Proyección cronológica para la futura vista Historial. Solo crea hitos que
 * tienen fecha confirmada por BFF y expresa el flujo en lenguaje humano.
 */
export function buildAfterSalesCaseHistory(selectedCase: AfterSalesAdminCase | null): AfterSalesAdminHistoryEvent[] {
  if (!selectedCase) {
    return [];
  }

  const openedAt = selectedCase.submittedAt ?? selectedCase.createdAt;
  const openingMessagePresent = selectedCase.messages.some((message) => message.kind === "OPENING");
  const events: Array<AfterSalesAdminHistoryEvent | null> = [
    openedAt ? historyEvent({
      eventId: `case-opened:${selectedCase.caseId}`,
      kind: "CASE_OPENED",
      title: "El cliente abrió el caso",
      occurredAt: openedAt,
      actor: "CUSTOMER",
      detail: selectedCase.customerMessage ?? undefined,
      visibility: "CUSTOMER",
    }) : null,
    selectedCase.assignedAt ? historyEvent({
      eventId: `case-assigned:${selectedCase.caseId}`,
      kind: "CASE_ASSIGNED",
      title: "El caso fue asignado al equipo",
      occurredAt: selectedCase.assignedAt,
      actor: "TEAM",
      visibility: "INTERNAL",
    }) : null,
    selectedCase.reviewedAt ? historyEvent({
      eventId: `case-reviewed:${selectedCase.caseId}`,
      kind: "REVIEW_STARTED",
      title: "El equipo inició la revisión",
      occurredAt: selectedCase.reviewedAt,
      actor: "TEAM",
      visibility: "INTERNAL",
    }) : null,
    ...selectedCase.messages.map((message) => {
      if (!message.createdAt || !message.body || (openingMessagePresent && message.kind === "OPENING" && selectedCase.customerMessage)) {
        return null;
      }
      const isCustomer = message.authorType === "CUSTOMER";
      return historyEvent({
        eventId: `message:${message.messageId}`,
        kind: isCustomer ? "CUSTOMER_MESSAGE" : "TEAM_MESSAGE",
        title: isCustomer ? "El cliente dejó un mensaje" : "El equipo respondió al cliente",
        occurredAt: message.createdAt,
        actor: isCustomer ? "CUSTOMER" : "TEAM",
        detail: message.body,
        visibility: "CUSTOMER",
      });
    }),
    ...selectedCase.evidences.map((evidence) => evidence.createdAt ? historyEvent({
      eventId: `evidence:${evidence.evidenceId}`,
      kind: evidence.visibility === "INTERNAL" ? "INTERNAL_EVIDENCE" : "CUSTOMER_EVIDENCE",
      title: evidence.visibility === "INTERNAL" ? "El equipo adjuntó una evidencia interna" : "El cliente adjuntó una evidencia",
      occurredAt: evidence.createdAt,
      actor: evidence.visibility === "INTERNAL" ? "TEAM" : "CUSTOMER",
      visibility: evidence.visibility === "INTERNAL" ? "INTERNAL" : "CUSTOMER",
      evidenceId: evidence.evidenceId,
    }) : null),
    ...selectedCase.solutionProposals.flatMap((proposal) => [
      proposal.createdAt ? historyEvent({
        eventId: `proposal-sent:${proposal.proposalId}`,
        kind: "PROPOSAL_SENT",
        title: `El equipo envió una propuesta de ${proposalSolutionLabel(proposal.solutionType)}`,
        occurredAt: proposal.createdAt,
        actor: "TEAM",
        detail: proposal.customerMessage || undefined,
        visibility: "CUSTOMER",
        proposal: proposalHistorySummary(proposal),
      }) : null,
      proposalResponseHistoryEvent(proposal),
    ]),
    ...selectedCase.resolutions.flatMap((resolution) => [
      resolution.createdAt ? historyEvent({
        eventId: `solution-started:${resolution.resolutionId}`,
        kind: "SOLUTION_STARTED",
        title: `El equipo inició la ejecución: ${executionOutcomeLabel(resolution.resolutionType)}`,
        occurredAt: resolution.createdAt,
        actor: "TEAM",
        visibility: "INTERNAL",
        execution: { label: executionOutcomeLabel(resolution.resolutionType), amountMinor: resolution.amountMinor, currency: resolution.currency },
      }) : null,
      resolution.completedAt ? historyEvent({
        eventId: `solution-completed:${resolution.resolutionId}`,
        kind: "SOLUTION_COMPLETED",
        title: `Solución completada: ${executionOutcomeLabel(resolution.resolutionType)}`,
        occurredAt: resolution.completedAt,
        actor: "TEAM",
        detail: selectedCase.resolutionReason ?? undefined,
        visibility: "CUSTOMER",
        execution: { label: executionOutcomeLabel(resolution.resolutionType), amountMinor: resolution.amountMinor, currency: resolution.currency },
      }) : null,
    ]),
    ...selectedCase.returnAuthorizations.map((authorization) => authorization.receivedAt ? historyEvent({
      eventId: `return-received:${authorization.returnAuthorizationId}`,
      kind: "RETURN_RECEIVED",
      title: "Se recibió el producto devuelto",
      occurredAt: authorization.receivedAt,
      actor: "TEAM",
      visibility: "INTERNAL",
      execution: { label: "Devolución recibida" },
    }) : null),
    ...selectedCase.refundRequests.map((refund) => refund.status === "COMPLETED" && refund.completedAt ? historyEvent({
      eventId: `refund-completed:${refund.refundRequestId}`,
      kind: "REFUND_COMPLETED",
      title: "El reembolso fue completado",
      occurredAt: refund.completedAt,
      actor: "SYSTEM",
      visibility: "CUSTOMER",
      execution: { label: "Reembolso", amountMinor: refund.amountMinor, currency: refund.currency },
    }) : null),
    ...selectedCase.closureProofs.map((proof) => proof.createdAt && proof.invalidatedAt === null ? historyEvent({
      eventId: `closure-proof:${proof.closureProofId}`,
      kind: "CLOSURE_PROOF_RECORDED",
      title: "El equipo aportó una prueba de cierre",
      occurredAt: proof.createdAt,
      actor: "TEAM",
      detail: proof.note ?? undefined,
      visibility: "INTERNAL",
      evidenceId: proof.evidenceId ?? undefined,
    }) : null),
    selectedCase.closedAt ? historyEvent({
      eventId: `case-closed:${selectedCase.caseId}`,
      kind: "CASE_CLOSED",
      title: "El caso fue cerrado",
      occurredAt: selectedCase.closedAt,
      actor: selectedCase.closureReason === "AUTO_TIMEOUT" ? "SYSTEM" : "TEAM",
      visibility: "CUSTOMER",
    }) : null,
  ];

  return events
    .filter((event): event is AfterSalesAdminHistoryEvent => Boolean(event))
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

function normalizeCaseList(value: unknown): AfterSalesAdminCaseList {
  const record = asRecord(value);
  const items = asArray(record.items ?? record.data ?? value).map(normalizeAfterSalesCase);

  return {
    items,
    total: asNumber(record.total) ?? items.length,
    limit: asNumber(record.limit) ?? items.length,
    offset: asNumber(record.offset) ?? 0,
  };
}

const taskTypes = new Set<AfterSalesAdminTaskType>(["NEW_CASE", "CUSTOMER_MESSAGE", "EVIDENCE_REVIEW", "SOLUTION_PROPOSAL_REJECTED", "SOLUTION_PROPOSAL_ACCEPTED"]);
const taskStatuses = new Set<AfterSalesAdminTaskStatus>(["OPEN", "ASSIGNED"]);
const taskPriorities = new Set<AfterSalesAdminTask["priority"]>(["NORMAL", "HIGH"]);

function normalizeTask(value: unknown): AfterSalesAdminTask | null {
  const record = asRecord(value);
  const taskId = asString(record.taskId);
  const caseId = asString(record.caseId);
  const taskType = asString(record.taskType) as AfterSalesAdminTaskType | undefined;
  const status = asString(record.status) as AfterSalesAdminTaskStatus | undefined;
  const priority = asString(record.priority) as AfterSalesAdminTask["priority"] | undefined;
  const lastActivityAt = asString(record.lastActivityAt);

  if (!taskId || !caseId || !taskType || !taskTypes.has(taskType) || !status || !taskStatuses.has(status) || !priority || !taskPriorities.has(priority) || !lastActivityAt) {
    return null;
  }

  return {
    taskId,
    caseId,
    taskType,
    status,
    priority,
    assignedEmployeeId: asNullableString(record.assignedEmployeeId) ?? null,
    assignedBy: asNullableString(record.assignedBy) ?? null,
    assignedAt: asNullableString(record.assignedAt) ?? null,
    lastActivityAt,
  };
}

function normalizeTaskList(value: unknown): AfterSalesAdminTaskList {
  const record = asRecord(value);
  const items = asArray(record.items ?? record.data ?? value)
    .map(normalizeTask)
    .filter((task): task is AfterSalesAdminTask => Boolean(task));

  return {
    items,
    total: asNumber(record.total) ?? items.length,
    limit: asNumber(record.limit) ?? items.length,
    offset: asNumber(record.offset) ?? 0,
  };
}

function normalizeTaskSummary(value: unknown): AfterSalesAdminTaskSummary {
  const record = asRecord(value);

  return {
    pendingCount: asNumber(record.pendingCount) ?? 0,
    openCount: asNumber(record.openCount) ?? 0,
    assignedCount: asNumber(record.assignedCount) ?? 0,
  };
}

function normalizeHealth(value: unknown): AfterSalesAdminHealth {
  const record = asRecord(value);
  const persistence = asRecord(record.persistence);
  const events = asRecord(record.events);

  return {
    service: asString(record.service),
    status: asString(record.status),
    databaseReachable: typeof persistence.reachable === "boolean" ? persistence.reachable : undefined,
    publisherEnabled: typeof events.publisherEnabled === "boolean" ? events.publisherEnabled : undefined,
    consumerEnabled: typeof events.consumerEnabled === "boolean" ? events.consumerEnabled : undefined,
  };
}

function normalizeEmployees(value: unknown): AfterSalesAdminEmployee[] {
  const record = asRecord(value);
  const values = asArray(record.items ?? record.data ?? record.employees ?? value);

  return values
    .map((value) => {
      const employee = asRecord(value);
      const employeeId = asString(employee.employeeId) ?? asString(employee.id) ?? asString(employee.principalId) ?? "";
      const firstName = asString(employee.firstName);
      const lastName = asString(employee.lastName);
      const name = asString(employee.name) ?? asString(employee.fullName) ?? [firstName, lastName].filter(Boolean).join(" ");
      const email = asString(employee.email);
      const status = (asString(employee.status) ?? "").toUpperCase();
      const active = employee.active !== false && !["INACTIVE", "DISABLED", "BLOCKED", "ARCHIVED"].includes(status);

      return {
        employeeId,
        label: [name || "Sin nombre", email].filter(Boolean).join(" · "),
        active,
      };
    })
    .filter((employee) => Boolean(employee.employeeId))
    .sort((left, right) => left.label.localeCompare(right.label, "es"));
}

function normalizeReferenceOptions(value: unknown, idKeys: string[], labelKeys: string[]): AfterSalesAdminReferenceOption[] {
  const records = asArray(value);
  const seen = new Set<string>();

  return records.flatMap((value) => {
    const record = asRecord(value);
    const id = recordField(record, idKeys);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{ id, label: recordField(record, labelKeys) ?? id }];
  });
}

function normalizeOrderReferences(value: unknown): AfterSalesAdminOrderReferences {
  const order = asRecord(value);
  const payment = asRecord(order.payment);
  const invoice = asRecord(order.invoice);
  // El detalle Admin de Orders expone una transacción principal como
  // `payment.transaction`; las colecciones se conservan por compatibilidad.
  // Incluir ambas formas evita esconder un pago reembolsable al operador.
  const paymentRecords = [payment.transaction, payment, ...asArray(payment.transactions), ...asArray(payment.items)];
  const invoiceRecords = [invoice, ...asArray(invoice.items), ...asArray(invoice.invoices)];

  return {
    transactions: normalizeReferenceOptions(paymentRecords, ["transactionId", "id"], ["paymentReference", "referenceId", "transactionId", "id"]),
    invoices: normalizeReferenceOptions(invoiceRecords, ["invoiceId", "id"], ["invoiceNumberFormatted", "invoiceNumber", "invoiceId", "id"]),
  };
}

function hasPermission(session: Pick<AdminSession, "permissions" | "scope"> | null | undefined, aliases: string[]) {
  if (!session || session.scope !== "admin") {
    return false;
  }

  const current = new Set(session.permissions.map((item) => item.trim().toLowerCase()));
  return (
    current.has("*") ||
    current.has("system.admin") ||
    current.has("admin:*") ||
    aliases.some((alias) => current.has(alias.toLowerCase()))
  );
}

export function getAfterSalesAdminCapabilities(
  session: Pick<AdminSession, "permissions" | "scope"> | null | undefined,
): AfterSalesAdminCapabilities {
  const canManageAfterSales = hasPermission(session, ["after-sales.manage", "after_sales.manage"]);

  return {
    canViewAfterSales: canManageAfterSales || hasPermission(session, ["admin:after-sales:view"]),
    canManageAfterSales,
  };
}

export async function getAfterSalesTaskSummary(
  context: AdminContext,
  capabilities: AfterSalesAdminCapabilities,
): Promise<BffResult<AfterSalesAdminTaskSummary | null>> {
  if (!hasRequiredAdminContext(context)) {
    return unavailable("Selecciona organization y shop para consultar tareas de postventa.");
  }
  if (!capabilities.canViewAfterSales) {
    return unavailable("Falta permiso admin:after-sales:view.");
  }

  return requestAdminBff<AfterSalesAdminTaskSummary>(
    scopedPath("/admin/after-sales/tasks/summary", context),
    { context, parse: normalizeTaskSummary },
  );
}

export async function getAfterSalesAdminData(
  context: AdminContext,
  filters: AfterSalesAdminFilters = {},
  capabilities: AfterSalesAdminCapabilities,
): Promise<AfterSalesAdminData> {
  if (!hasRequiredAdminContext(context)) {
    const skipped = unavailable<null>("Selecciona organization y shop para operar postventa.");
    return {
      context,
      health: skipped,
      cases: unavailable("Selecciona organization y shop para operar postventa."),
      taskSummary: skipped,
      tasks: unavailable("Selecciona organization y shop para operar postventa."),
      selectedCase: skipped,
      employees: unavailable("Selecciona organization y shop para operar postventa."),
      orderReferences: skipped,
      selectedCustomerReference: null,
    };
  }

  if (!capabilities.canViewAfterSales) {
    const skipped = unavailable<null>("Falta permiso admin:after-sales:view.");
    return {
      context,
      health: skipped,
      cases: unavailable("Falta permiso admin:after-sales:view."),
      taskSummary: skipped,
      tasks: unavailable("Falta permiso admin:after-sales:view."),
      selectedCase: skipped,
      employees: unavailable("Falta permiso admin:after-sales:view."),
      orderReferences: skipped,
      selectedCustomerReference: null,
    };
  }

  const limit = filters.limit?.trim() || "25";
  const offset = filters.offset?.trim() || "0";
  const listPath = scopedPath("/admin/after-sales/cases", context, {
    status: filters.status,
    customerId: filters.customerId,
    orderId: filters.orderId,
    assignedEmployeeId: filters.assignedEmployeeId,
    limit,
    offset,
  });
  const selectedPath = filters.caseId
    ? scopedPath(`/admin/after-sales/cases/${encodeURIComponent(filters.caseId)}`, context)
    : null;
  const taskLimit = filters.taskLimit?.trim() || "20";
  const taskOffset = filters.taskOffset?.trim() || "0";
  const taskPath = scopedPath("/admin/after-sales/tasks", context, {
    taskType: filters.taskType,
    status: filters.taskStatus,
    limit: taskLimit,
    offset: taskOffset,
  });

  const [health, cases, taskSummary, tasks, selectedCase, employees] = await Promise.all([
    requestAdminBff<AfterSalesAdminHealth>("/admin/after-sales/health", {
      context,
      parse: normalizeHealth,
    }),
    requestAdminBff<AfterSalesAdminCaseList>(listPath, {
      context,
      parse: normalizeCaseList,
    }),
    getAfterSalesTaskSummary(context, capabilities),
    requestAdminBff<AfterSalesAdminTaskList>(taskPath, {
      context,
      parse: normalizeTaskList,
    }),
    selectedPath
      ? requestAdminBff<AfterSalesAdminCase>(selectedPath, {
          context,
          parse: normalizeAfterSalesCase,
        })
      : Promise.resolve({ ok: true as const, data: null, status: 200, correlationId: "after-sales-admin-no-selection" }),
    requestAdminBff<AfterSalesAdminEmployee[]>(scopedPath("/admin/employees", context), {
      context,
      parse: normalizeEmployees,
    }),
  ]);
  const selectedCustomer = selectedCase.ok && selectedCase.data?.customerId
    ? await getCustomerDetail(context, selectedCase.data.customerId)
    : null;
  const selectedOrderId = selectedCase.ok ? selectedCase.data?.orderId : undefined;
  const orderReferences = selectedOrderId
    ? await requestAdminBff<AfterSalesAdminOrderReferences>(
        scopedPath(`/admin/orders/${encodeURIComponent(selectedOrderId)}`, context),
        { context, parse: normalizeOrderReferences },
      )
    : { ok: true as const, data: null, status: 200, correlationId: "after-sales-admin-no-order" };

  return {
    context,
    health,
    cases,
    taskSummary,
    tasks,
    selectedCase,
    employees,
    orderReferences,
    selectedCustomerReference: selectedCustomer?.data?.customerReference ?? null,
  };
}
