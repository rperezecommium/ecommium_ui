import type { CmsIndependentModule } from "./cms-independent-module-types";
import type { CmsPresentation, CmsScopedStyleSheet } from "./cms-blocks";
export type CmsSpaceNode =
  | {
      nodeId: string;
      kind: "container";
      layout: "stack" | "flex" | "grid";
      presentation: CmsPresentation;
      children: CmsSpaceNode[];
    }
  | { nodeId: string; kind: "module"; module: CmsIndependentModule };
export type CmsSectionDocument = {
  placement?: import('./cms-admin').CmsModulePlacement;
  designSettings?: import('../../../packages/cms-blocks/src/design-settings').CmsDesignSettings;
  sectionId: string;
  name: string;
  root: CmsSpaceNode;
  styleSheet?: CmsScopedStyleSheet;
};
export type CmsSectionContext = {
  organizationId: string;
  shopId: string;
  locale: string;
};
export type CmsSectionReceipt = {
  contractVersion: 1;
  resourceKind: "SECTION";
  resourceId: string;
  revisionToken: string;
  context: CmsSectionContext;
  document: CmsSectionDocument;
};
export type CmsSectionList = {
  items: CmsSectionReceipt[];
  total: number;
  limit: number;
  offset: number;
};
export type CmsSectionCommand = {
  contractVersion: 1;
  resourceKind: "SECTION";
  document: CmsSectionDocument;
} & ({ operationId: string } | { expectedRevision: string });
