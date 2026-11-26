import type { CmsVisualModuleV2Props, CmsScopedStyleSheet } from "./cms-blocks";
export type CmsIndependentModule = {
  designSettings?: import('../../../packages/cms-blocks/src/design-settings').CmsDesignSettings;
  editableFields?: string[];
  instanceId: string;
  name: string;
  body:
    | { kind: "visual"; value: CmsVisualModuleV2Props }
    | { kind: "registered"; type: string; props: Record<string, unknown> };
  styleSheet?: CmsScopedStyleSheet;
};
export type CmsModuleReceipt = {
  contractVersion: 1;
  resourceKind: "MODULE";
  resourceId: string;
  revisionToken: string;
  status: "DRAFT" | "ARCHIVED";
  context: { organizationId: string; shopId: string };
  document: CmsIndependentModule;
};
export type CmsModuleList = {
  items: CmsModuleReceipt[];
  total: number;
  limit: number;
  offset: number;
};
export type CmsModuleCommand =
  | {
      contractVersion: 1;
      resourceKind: "MODULE";
      operationId: string;
      document: CmsIndependentModule;
    }
  | {
      contractVersion: 1;
      resourceKind: "MODULE";
      expectedRevision: string;
      document?: CmsIndependentModule;
    };
