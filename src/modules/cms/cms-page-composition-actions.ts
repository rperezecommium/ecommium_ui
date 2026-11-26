"use server";
import { validatePageContract } from "./cms-page-composition-validation";
import { getCurrentAdminSession } from "../auth/current-admin-session";
import { getAdminContext } from "../../shared/config/admin-context";
import { requestAdminBff } from "../../shared/bff/admin-client";
import {
  pageCompositionMatches,
  pageCompositionWithoutHydration,
  type CmsPageComposition,
} from "./cms-page-composition";
import type { CmsPageDetail } from "./cms-admin";
import type { CmsSectionContext } from "./cms-independent-section-types";
import { listIndependentSections } from "./cms-independent-sections";
import { waitForCmsReceiptVisibility } from "./cms-receipt-visibility";
function sameContext(a: CmsSectionContext, b: CmsSectionContext) {
  return (
    a.organizationId === b.organizationId &&
    a.shopId === b.shopId &&
    a.locale === b.locale
  );
}
export async function commandPageCompositionAction(
  operation: "create" | "update" | "publish",
  id: string | undefined,
  body: unknown,
  expectedContext: CmsSectionContext,
): Promise<
  | { ok: true; page: CmsPageDetail; readReady:boolean }
  | { ok: false; message: string; status?: number }
> {
  const session = await getCurrentAdminSession(),
    context = await getAdminContext();
  const permission =
    operation === "publish" ? "cms.pages.publish" : "cms.pages.write";
  if (
    session?.scope !== "admin" ||
    !session.permissions.some((p) =>
      ["*", "admin:*", "system.admin", permission].includes(p),
    )
  )
    return {
      ok: false,
      status: 403,
      message: "No tienes permiso para esta acción.",
    };
  if (!sameContext(context, expectedContext))
    return {
      ok: false,
      status: 409,
      message:
        "El contexto ha cambiado. Conserva el borrador y vuelve a abrir la página.",
    };
  if (
    !["create", "update", "publish"].includes(operation) ||
    (operation !== "create" && !id)
  )
    return {
      ok: false,
      status: 400,
      message: "Operación de página no válida.",
    };
  try {
    validatePageContract(
      operation === "create"
        ? "pageCreate"
        : operation === "update"
          ? "pageUpdate"
          : "publishRequest",
      body,
    );
    const input = body as {
      title?: string;
      path?: string;
      seo?: { title: string; description: string };
      versionId?: string;
      composition?: { document: CmsPageComposition; expectedRevision?: string };
    };
    const query = new URLSearchParams({
      organizationId: context.organizationId,
      shopId: context.shopId,
      locale: context.locale,
    });
    const parse = (value: unknown): CmsPageDetail => {
      const page = value as CmsPageDetail;
      validatePageContract("receipt", page?.composition);
      const receipt = page.composition!;
      if (
        page.contractVersion !== 1 ||
        !sameContext(receipt.context, context) ||
        !sameContext(page, context) ||
        receipt.resourceId !== page.pageId ||
        (id && page.pageId !== id) ||
        receipt.revisionToken !== page.revisionToken ||
        !page.latestVersion
      )
        throw Error(
          "El recibo no corresponde a la página y contexto enviados.",
        );
      if (operation === "publish") {
        if (
          page.status !== "PUBLISHED" ||
          !page.publishedVersion ||
          page.publishedVersion.versionId !== input.versionId ||
          receipt.state !== "PUBLISHED" ||
          page.latestVersion.versionId !== input.versionId ||
          !page.publishedVersion.composition ||
          !pageCompositionMatches(
            receipt.document,
            page.publishedVersion.composition,
          )
        )
          throw Error("El recibo no confirma la publicación solicitada.");
      } else {
        if (
          !input.composition ||
          !pageCompositionMatches(
            input.composition.document,
            receipt.document,
            operation === "create",
          ) ||
          !page.latestVersion.composition ||
          !pageCompositionMatches(
            receipt.document,
            page.latestVersion.composition,
          ) ||
          (input.path !== undefined && page.path !== input.path.trim()) ||
          (input.title !== undefined &&
            page.latestVersion.title !== input.title.trim()) ||
          (input.seo &&
            (page.latestVersion.seo.title !== input.seo.title.trim() ||
              page.latestVersion.seo.description !==
                input.seo.description.trim())) ||
          (operation === "update" &&
            page.revisionToken === input.composition.expectedRevision)
        )
          throw Error("El recibo no confirma el borrador enviado.");
      }
      return page;
    };
    const suffix =
      operation === "create"
        ? ""
        : `/${encodeURIComponent(id!)}/${operation === "publish" ? "publish" : "draft"}`;
    const result = await requestAdminBff<CmsPageDetail>(
      `/admin/cms/pages${suffix}?${query}`,
      {
        context,
        init: {
          method: operation === "update" ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
        parse,
      },
    );
    if (result.ok) return { ok: true, page: result.data, readReady:await waitForCmsReceiptVisibility(()=>requestAdminBff<CmsPageDetail>(`/admin/cms/pages/${encodeURIComponent(result.data.pageId)}?${query}`,{context,parse}),result.data.revisionToken!) };
    if (operation === "update" && (!result.status || result.status >= 500)) {
      const confirmed = await requestAdminBff<CmsPageDetail>(
        `/admin/cms/pages/${encodeURIComponent(id!)}?${query}`,
        { context, parse },
      );
      if (confirmed.ok) return { ok: true, page: confirmed.data, readReady:true };
    }
    if (operation === "publish" && !result.ok) {
      const current = await requestAdminBff<CmsPageDetail>(
        `/admin/cms/pages/${encodeURIComponent(id!)}?${query}`,
        { context, parse: (value) => value as CmsPageDetail },
      );
      if (
        current.ok &&
        current.data.pendingOperation?.command.operationId ===
          (body as { operationId: string }).operationId
      ) {
        return {
          ok: false,
          status: 503,
          message:
            current.data.pendingOperation.state === "RUNNING"
              ? "Routing está en curso o su resultado es incierto. La operación sigue reservada; reintentar no enviará otra petición a Routing."
              : "La operación sigue pendiente. Reintenta para consultar o completar su resultado confirmado.",
        };
      }
    }
    return { ok: false, status: result.status, message: result.error };
  } catch (error) {
    return {
      ok: false,
      status: 400,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo validar la página.",
    };
  }
}
export async function loadPageSectionsAction(
  expectedContext: CmsSectionContext,
  offset: number,
) {
  const session = await getCurrentAdminSession(),
    context = await getAdminContext();
  if (
    session?.scope !== "admin" ||
    !session.permissions.some((p) =>
      [
        "*",
        "admin:*",
        "system.admin",
        "cms.pages.read",
        "cms.pages.write",
      ].includes(p),
    )
  )
    return {
      ok: false as const,
      message: "No tienes permiso para leer secciones.",
    };
  if (
    !sameContext(context, expectedContext) ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  )
    return { ok: false as const, message: "Contexto o página no válidos." };
  const result = await listIndependentSections(context, offset);
  return result.ok
    ? { ok: true as const, data: result.data }
    : { ok: false as const, message: result.error };
}

export async function previewPageCompositionAction(
  document: CmsPageComposition,
  expectedContext: CmsSectionContext,
): Promise<
  { ok: true; document: CmsPageComposition } | { ok: false; message: string }
> {
  const session = await getCurrentAdminSession(),
    context = await getAdminContext();
  if (
    session?.scope !== "admin" ||
    !session.permissions.some((p) =>
      ["*", "admin:*", "system.admin", "cms.pages.read"].includes(p),
    )
  )
    return {
      ok: false,
      message: "No tienes permiso para previsualizar páginas.",
    };
  if (!sameContext(context, expectedContext))
    return {
      ok: false,
      message: "El contexto ha cambiado. Vuelve a abrir la página.",
    };
  try {
    validatePageContract("composition", document);
    const query = new URLSearchParams({
      organizationId: context.organizationId,
      shopId: context.shopId,
      locale: context.locale,
    });
    const result = await requestAdminBff<{ document: CmsPageComposition }>(
      `/admin/cms/pages/preview?${query}`,
      {
        context,
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(document),
        },
        parse: (value) => {
          const response = value as {
            context: CmsSectionContext;
            document: CmsPageComposition;
          };
          const clean = pageCompositionWithoutHydration(response.document);
          validatePageContract("composition", clean);
          if (
            !sameContext(response.context, context) ||
            !pageCompositionMatches(document, clean)
          )
            throw Error(
              "La previsualización no corresponde al documento y contexto enviados.",
            );
          return { document: response.document };
        },
      },
    );
    return result.ok
      ? { ok: true, document: result.data.document }
      : { ok: false, message: result.error };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo validar la previsualización.",
    };
  }
}
