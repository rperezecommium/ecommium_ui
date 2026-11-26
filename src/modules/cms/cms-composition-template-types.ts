import type {
  CmsSectionContext,
  CmsSectionDocument,
} from "./cms-independent-section-types";
import type { CmsPageComposition } from "./cms-page-composition";
export type CmsTemplateContent =
  | { kind: "SECTION"; value: CmsSectionDocument }
  | { kind: "PAGE"; value: CmsPageComposition };
export type CmsTemplateDocument = { name: string; content: CmsTemplateContent };
export type CmsTemplateReceipt = {
  contractVersion: 1;
  resourceKind: "TEMPLATE";
  resourceId: string;
  revisionToken: string;
  status: "DRAFT" | "ARCHIVED";
  context: CmsSectionContext;
  document: CmsTemplateDocument;
};
export type CmsTemplateList = {
  items: CmsTemplateReceipt[];
  total: number;
  limit: number;
  offset: number;
};
export type CmsTemplateCommand = {
  contractVersion: 1;
  resourceKind: "TEMPLATE";
} & (
  | { operationId: string; document: CmsTemplateDocument }
  | { expectedRevision: string; document?: CmsTemplateDocument }
);
