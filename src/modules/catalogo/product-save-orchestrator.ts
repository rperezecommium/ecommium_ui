import type { AdminContext } from "../../shared/config/admin-context";
import type {
  ProductDraft,
  ProductDraftMediaItem,
  ProductGateway,
  ProductSaveBlocks,
  ProductSaveReport,
  ProductVariantRecord,
  StockDraft,
} from "./product-editor-types";
import {
  getProductPublicationChecklist,
  normalizeProductDraft,
  toCreateProductPayload,
  toUpdateProductPayload,
  validateProductPublicationReadiness,
  validateProductDraft,
} from "./product-editor-validation";

type ProductSaveInput = {
  draft: ProductDraft;
  context: AdminContext;
  gateway: ProductGateway;
  files?: File[];
};

function initialBlocks(): ProductSaveBlocks {
  return {
    catalog: "pending",
    variants: "pending",
    media: "pending",
    variantMedia: "pending",
    pricing: "pending",
    inventory: "pending",
  };
}

function failedReport(fieldErrors: Record<string, string>, messages: string[]): ProductSaveReport {
  return {
    ok: false,
    blocks: {
      ...initialBlocks(),
      catalog: "failed",
    },
    messages,
    fieldErrors,
    correlationIds: [],
  };
}

function pushCorrelation(target: string[], correlationId?: string) {
  if (correlationId) {
    target.push(correlationId);
  }
}

function findDefaultVariant(
  variants: ProductVariantRecord[],
  fallbackVariantId?: string,
): ProductVariantRecord | undefined {
  return (
    variants.find((variant) => variant.isDefault) ??
    variants.find((variant) => variant.variantId === fallbackVariantId) ??
    variants[0]
  );
}

function findVariantForDraft(
  variants: ProductVariantRecord[],
  variant: { variantId?: string; refId: string; localId: string },
): ProductVariantRecord | undefined {
  return (
    variants.find((item) => item.variantId === variant.variantId) ??
    variants.find((item) => item.refId.toLowerCase() === variant.refId.toLowerCase()) ??
    variants.find((item) => item.variantId === variant.localId)
  );
}

function hasPositivePrice(draft: ProductDraft) {
  return Boolean(
    draft.pricing.productPrice &&
      draft.pricing.productPrice.basePriceMinor > 0 &&
      !draft.pricing.productPrice.markedForDeletion,
  );
}

function unpersistedMediaItems(draft: ProductDraft) {
  return draft.media.items.filter((item) => !item.persisted && !item.mediaAssetId);
}

function filesForMediaItems(files: File[] | undefined, items: ProductDraftMediaItem[]) {
  if (!files?.length || !items.length) {
    return [];
  }

  return files.slice(0, items.length);
}

function mediaAssetIdForItem(item: ProductDraftMediaItem, uploadedByLocalId: Map<string, string>) {
  return item.mediaAssetId ?? uploadedByLocalId.get(item.localId);
}

function isUuid(value: string | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  );
}

function stockForVariant(draft: ProductDraft, localId: string, variantId?: string) {
  return (
    draft.inventory.stockByVariant[variantId ?? ""] ??
    draft.inventory.stockByVariant[localId] ??
    draft.inventory.stockByVariant.default
  );
}

function hasConfiguredStock(stock: StockDraft | undefined) {
  return Boolean(
    stock &&
      (stock.onHandQuantity > 0 ||
        stock.reservedQuantity > 0 ||
        stock.safetyStockQuantity > 0),
  );
}

async function syncVariantOptions(
  gateway: ProductGateway,
  variant: ProductDraft["variants"][number],
  variantId: string,
  correlationIds: string[],
) {
  for (const option of variant.options) {
    if (option.markedForDeletion) {
      if (!option.variantOptionId) {
        continue;
      }

      const deletedOption = await gateway.deleteVariantOption(variantId, option.variantOptionId);
      pushCorrelation(correlationIds, deletedOption.correlationId);
      if (!deletedOption.ok) {
        return deletedOption.error;
      }

      continue;
    }

    const payload = {
      attributeCode: option.attributeCode,
      valueCode: option.valueCode,
      isActive: option.isActive ?? true,
    };
    const shouldCreateOption = !variant.variantId || option.createdInDraft;

    if (!option.variantOptionId && !shouldCreateOption) {
      continue;
    }

    const optionResult = option.variantOptionId
      ? await gateway.updateVariantOption(variantId, option.variantOptionId, payload)
      : await gateway.createVariantOption(variantId, payload);
    pushCorrelation(correlationIds, optionResult.correlationId);

    if (!optionResult.ok) {
      return optionResult.error;
    }
  }

  return null;
}

function activationBlockedMessage(draft: ProductDraft) {
  const missing = getProductPublicationChecklist(draft).filter((item) => !item.ok);

  return missing.length > 0
    ? `Producto guardado fuera de linea. No se puede activar todavia: ${missing.map((item) => item.message).join(" ")}`
    : "Producto guardado fuera de linea.";
}

function applyActivationState(draft: ProductDraft, isActive: boolean): ProductDraft {
  return {
    ...draft,
    basic: {
      ...draft.basic,
      isActive,
    },
  };
}

export async function saveProductDraft({
  draft,
  context,
  gateway,
  files,
}: ProductSaveInput): Promise<ProductSaveReport> {
  if (!context.organizationId || !context.shopId) {
    return failedReport(
      { context: "Selecciona Organization y Shop antes de guardar productos." },
      ["Falta contexto Admin canonico."],
    );
  }

  const validation = validateProductDraft(draft);
  if (!validation.ok) {
    return failedReport(validation.fieldErrors, ["Revisa los campos marcados antes de guardar."]);
  }

  const normalizedDraft = normalizeProductDraft(draft);
  const activationRequested = normalizedDraft.basic.isActive;
  const publicationReadyBeforeSave = validateProductPublicationReadiness(normalizedDraft).ok;
  const blocks = initialBlocks();
  const messages: string[] = [];
  const fieldErrors: Record<string, string> = {};
  const correlationIds: string[] = [];
  let productId = normalizedDraft.productId;
  let defaultVariantId = normalizedDraft.defaultVariantId;
  let mediaCollectionId = normalizedDraft.mediaCollectionId ?? null;
  let variants: ProductVariantRecord[] = [];
  const uploadedMediaByLocalId = new Map<string, string>();
  let nextProductPrice = normalizedDraft.pricing.productPrice;
  const nextVariantPrices = { ...normalizedDraft.pricing.variantPrices };
  const nextStockByVariant = { ...normalizedDraft.inventory.stockByVariant };

  blocks.catalog = "running";
  const productPayloadDraft = activationRequested && !publicationReadyBeforeSave
    ? applyActivationState(normalizedDraft, false)
    : normalizedDraft;
  const catalogResult = productId
    ? await gateway.updateProduct(productId, toUpdateProductPayload(productPayloadDraft))
    : await gateway.createProduct(toCreateProductPayload(productPayloadDraft, context.locale));
  pushCorrelation(correlationIds, catalogResult.correlationId);

  if (!catalogResult.ok) {
    blocks.catalog = "failed";
    messages.push(`No se pudo guardar Catalog Product. ${catalogResult.error}`);
    return {
      ok: false,
      productId,
      defaultVariantId,
      mediaCollectionId,
      blocks,
      messages,
      fieldErrors,
      correlationIds,
    };
  }

  productId = catalogResult.data.productId;
  mediaCollectionId = catalogResult.data.mediaCollectionId ?? mediaCollectionId;
  blocks.catalog = "success";
  messages.push(normalizedDraft.productId ? "Producto actualizado." : "Producto creado.");

  const variantsResult = await gateway.listVariants(productId);
  pushCorrelation(correlationIds, variantsResult.correlationId);
  if (variantsResult.ok) {
    variants = variantsResult.data;
    defaultVariantId = findDefaultVariant(variants, catalogResult.data.defaultVariantId)?.variantId ?? defaultVariantId;
  }

  const variantsToCreate = normalizedDraft.mode === "variants"
    ? normalizedDraft.variants.filter((variant) => !variant.variantId)
    : [];
  const variantsToUpdate = normalizedDraft.mode === "variants"
    ? normalizedDraft.variants.filter((variant) => variant.variantId)
    : [];
  const shouldUpdateDefaultVariant = Boolean(normalizedDraft.productId && defaultVariantId);

  if (shouldUpdateDefaultVariant || variantsToUpdate.length > 0 || variantsToCreate.length > 0) {
    blocks.variants = "running";

    if (shouldUpdateDefaultVariant && defaultVariantId) {
      const updatedDefaultVariant = await gateway.updateVariant(defaultVariantId, {
        locale: context.locale,
        name: normalizedDraft.defaultVariant.name || normalizedDraft.basic.name,
        refId: normalizedDraft.defaultVariant.refId,
        ean: normalizedDraft.defaultVariant.ean ?? null,
        isVisible: productPayloadDraft.basic.isVisible,
        isActive: productPayloadDraft.basic.isActive,
      });
      pushCorrelation(correlationIds, updatedDefaultVariant.correlationId);

      if (!updatedDefaultVariant.ok) {
        blocks.variants = "failed";
        fieldErrors.refId = updatedDefaultVariant.error;
        messages.push("Producto guardado, pero fallo la combinacion predeterminada.");
      }
    }

    if (blocks.variants !== "failed") {
      for (const variant of variantsToUpdate) {
        if (!variant.variantId) {
          continue;
        }

        const updatedVariant = await gateway.updateVariant(variant.variantId, {
          locale: context.locale,
          name: variant.name || `${normalizedDraft.basic.name} / ${variant.refId}`,
          refId: variant.refId,
          ean: variant.ean ?? null,
          isVisible: variant.isVisible,
          isActive: variant.isActive,
        });
        pushCorrelation(correlationIds, updatedVariant.correlationId);

        if (!updatedVariant.ok) {
          blocks.variants = "failed";
          fieldErrors[`variant:${variant.localId}`] = updatedVariant.error;
          messages.push(`Producto guardado, pero fallo la variante ${variant.refId}.`);
          break;
        }

        const optionError = await syncVariantOptions(gateway, variant, variant.variantId, correlationIds);
        if (optionError) {
          blocks.variants = "failed";
          fieldErrors[`variant:${variant.localId}:options`] = optionError;
          messages.push(`Variante ${variant.refId} actualizada, pero fallaron sus opciones.`);
          break;
        }
      }
    }

    for (const variant of variantsToCreate) {
      if (blocks.variants === "failed") {
        break;
      }

      const createdVariant = await gateway.createVariant(productId, {
        locale: context.locale,
        name: variant.name || `${normalizedDraft.basic.name} / ${variant.refId}`,
        refId: variant.refId,
        ean: variant.ean ?? null,
        isVisible: variant.isVisible,
        isActive: variant.isActive,
      });
      pushCorrelation(correlationIds, createdVariant.correlationId);

      if (!createdVariant.ok) {
        blocks.variants = "failed";
        fieldErrors[`variant:${variant.localId}`] = createdVariant.error;
        messages.push(`Producto guardado, pero fallo la variante ${variant.refId}.`);
        break;
      }

      const optionError = await syncVariantOptions(gateway, variant, createdVariant.data.variantId, correlationIds);
      if (optionError) {
        blocks.variants = "failed";
        fieldErrors[`variant:${variant.localId}:options`] = optionError;
        messages.push(`Variante ${variant.refId} creada, pero fallaron sus opciones.`);
        break;
      }
    }

    if (blocks.variants !== "failed") {
      blocks.variants = "success";
      messages.push("Variantes guardadas.");
    }

    const refreshedVariants = await gateway.listVariants(productId);
    pushCorrelation(correlationIds, refreshedVariants.correlationId);
    if (refreshedVariants.ok) {
      variants = refreshedVariants.data;
      defaultVariantId = findDefaultVariant(variants, defaultVariantId)?.variantId ?? defaultVariantId;
    }
  } else {
    blocks.variants = normalizedDraft.mode === "variants" ? "success" : "skipped";
  }

  const nextDraftVariants = normalizedDraft.variants.map((variant) => {
    const persisted = findVariantForDraft(variants, variant);
    return persisted
      ? {
          ...variant,
          variantId: persisted.variantId,
        }
      : variant;
  });

  const pendingMediaItems = unpersistedMediaItems(normalizedDraft);
  const mediaFiles = filesForMediaItems(files, pendingMediaItems);

  if (pendingMediaItems.length > 0) {
    if (mediaFiles.length === 0) {
      blocks.media = "skipped";
      blocks.variantMedia = "skipped";
      messages.push("Imagenes pendientes en el borrador; selecciona los archivos de nuevo para subirlas.");
    } else {
      blocks.media = "running";
      const mediaResult = mediaCollectionId
        ? await gateway.appendMediaItems({
            mediaCollectionId,
            defaultLocale: context.locale,
            files: mediaFiles,
            metadata: pendingMediaItems,
          })
        : await gateway.createMediaCollection({
            productId,
            shopId: context.shopId,
            title: normalizedDraft.basic.name,
            defaultLocale: context.locale,
            files: mediaFiles,
            metadata: pendingMediaItems,
          });
      pushCorrelation(correlationIds, mediaResult.correlationId);

      if (!mediaResult.ok) {
        blocks.media = "failed";
        blocks.variantMedia = "skipped";
        messages.push(`Producto guardado, pero no se pudieron subir imagenes. ${mediaResult.error}`);
      } else {
        blocks.media = "success";
        mediaCollectionId = mediaResult.data.mediaCollectionId;
        pendingMediaItems.forEach((item, index) => {
          const mediaAssetId = mediaResult.data.mediaAssetIds[index];
          if (mediaAssetId) {
            uploadedMediaByLocalId.set(item.localId, mediaAssetId);
          }
        });
        messages.push("Imagenes subidas.");

        const defaultVariant = defaultVariantId
          ? { variantId: defaultVariantId }
          : findDefaultVariant(variants, defaultVariantId);
        if (defaultVariant?.variantId && mediaResult.data.mediaAssetIds.length > 0) {
          blocks.variantMedia = "running";
          const mainIndex = Math.max(0, pendingMediaItems.findIndex((item) => item.isMain));
          const assignResult = await gateway.assignVariantMedia({
            variantId: defaultVariant.variantId,
            mediaAssetIds: mediaResult.data.mediaAssetIds,
            mainMediaAssetId: mediaResult.data.mediaAssetIds[mainIndex],
          });
          pushCorrelation(correlationIds, assignResult.correlationId);

          if (!assignResult.ok) {
            blocks.variantMedia = "failed";
            messages.push(`Imagenes subidas, pero no se pudieron asignar a la variante default. ${assignResult.error}`);
          } else {
            blocks.variantMedia = "success";
            messages.push("Imagen principal asignada a la variante default.");
          }
        } else {
          blocks.variantMedia = "skipped";
          messages.push("Imagenes subidas; la asignacion a variante queda pendiente hasta conocer defaultVariantId.");
        }
      }
    }
  } else {
    blocks.media = "skipped";
    blocks.variantMedia = "skipped";
  }

  const assignmentEntries = Object.entries(normalizedDraft.media.assignments);
  if (assignmentEntries.length > 0) {
    blocks.variantMedia = blocks.variantMedia === "failed" ? "failed" : "running";

    for (const [variantKey, localMediaIds] of assignmentEntries) {
      const draftVariant = nextDraftVariants.find((variant) =>
        variant.localId === variantKey || variant.variantId === variantKey,
      );
      const variantId = draftVariant?.variantId ?? (variantKey === "default" ? defaultVariantId : variantKey);
      if (!variantId) {
        continue;
      }

      const mediaAssetIds = localMediaIds
        .map((localId) => {
          const item = normalizedDraft.media.items.find((mediaItem) => mediaItem.localId === localId);
          return item ? mediaAssetIdForItem(item, uploadedMediaByLocalId) : uploadedMediaByLocalId.get(localId) ?? localId;
        })
        .filter(isUuid);
      const unresolvedMediaIds = localMediaIds.filter((localId) => {
        const item = normalizedDraft.media.items.find((mediaItem) => mediaItem.localId === localId);
        const mediaAssetId = item ? mediaAssetIdForItem(item, uploadedMediaByLocalId) : uploadedMediaByLocalId.get(localId) ?? localId;
        return !isUuid(mediaAssetId);
      });
      const mainLocalId = normalizedDraft.media.mainByVariant[variantKey];
      const mainItem = normalizedDraft.media.items.find((item) => item.localId === mainLocalId);
      const mainMediaAssetId = mainItem ? mediaAssetIdForItem(mainItem, uploadedMediaByLocalId) : undefined;

      if (unresolvedMediaIds.length > 0) {
        blocks.variantMedia = "failed";
        fieldErrors[`media:${variantKey}`] = "Hay imagenes asignadas a la variante que aun no tienen mediaAssetId valido. Vuelve a seleccionar/subir el archivo y guarda de nuevo.";
        messages.push(`No se pudieron guardar imagenes de variante ${draftVariant?.refId ?? variantId}: hay assets sin mediaAssetId valido.`);
        break;
      }

      const assignResult = mediaAssetIds.length > 0
        ? await gateway.assignVariantMedia({
            variantId,
            mediaAssetIds,
            mainMediaAssetId: isUuid(mainMediaAssetId) ? mainMediaAssetId : mediaAssetIds[0],
          })
        : await gateway.clearVariantMedia({ variantId });
      pushCorrelation(correlationIds, assignResult.correlationId);

      if (!assignResult.ok) {
        blocks.variantMedia = "failed";
        messages.push(`No se pudieron guardar imagenes de variante ${draftVariant?.refId ?? variantId}. ${assignResult.error}`);
        break;
      }
    }

    if (blocks.variantMedia !== "failed") {
      blocks.variantMedia = "success";
      messages.push("Imagenes por variante guardadas.");
    }
  }

  if (hasPositivePrice(normalizedDraft)) {
    blocks.pricing = "running";
    const productPrice = normalizedDraft.pricing.productPrice!;
    const priceResult = productPrice.pricingId
      ? await gateway.updatePrice({ pricingId: productPrice.pricingId, price: productPrice })
      : await gateway.createProductPrice({
          productId,
          price: productPrice,
        });
    pushCorrelation(correlationIds, priceResult.correlationId);

    if (!priceResult.ok) {
      blocks.pricing = "failed";
      messages.push(`Precio pendiente de guardar. ${priceResult.error}`);
    } else {
      nextProductPrice = {
        ...productPrice,
        pricingId: priceResult.data.pricingId ?? productPrice.pricingId,
      };
      blocks.pricing = "success";
      messages.push("Precio base guardado.");
    }
  } else {
    blocks.pricing = "skipped";
  }

  const variantPriceEntries = Object.entries(normalizedDraft.pricing.variantPrices);
  if (variantPriceEntries.length > 0) {
    blocks.pricing = blocks.pricing === "failed" ? "failed" : "running";

    for (const [variantKey, price] of variantPriceEntries) {
      const draftVariant = nextDraftVariants.find((variant) =>
        variant.localId === variantKey || variant.variantId === variantKey,
      );
      const variantId = draftVariant?.variantId ?? variantKey;
      if (!variantId) {
        continue;
      }

      const priceResult = price.markedForDeletion && price.pricingId
        ? await gateway.deletePrice({ pricingId: price.pricingId })
        : price.basePriceMinor > 0 && price.pricingId
          ? await gateway.updatePrice({ pricingId: price.pricingId, price })
          : price.basePriceMinor > 0
            ? await gateway.createVariantPrice({ productId, variantId, price })
            : { ok: true as const, data: {}, status: 200 };

      if ("correlationId" in priceResult) {
        pushCorrelation(correlationIds, priceResult.correlationId);
      }

      if (!priceResult.ok) {
        blocks.pricing = "failed";
        messages.push(`Precio de variante ${draftVariant?.refId ?? variantId} pendiente de guardar. ${priceResult.error}`);
        break;
      }

      const priceResultData = "data" in priceResult ? priceResult.data as { pricingId?: string } : {};

      if (price.markedForDeletion && price.pricingId) {
        delete nextVariantPrices[variantKey];
      } else if (priceResultData.pricingId) {
        nextVariantPrices[variantKey] = {
          ...price,
          pricingId: priceResultData.pricingId,
          markedForDeletion: false,
        };
      }
    }

    if (blocks.pricing !== "failed") {
      blocks.pricing = "success";
      messages.push("Precios de variantes guardados.");
    }
  }

  const stockEntries = normalizedDraft.mode === "variants"
    ? [
        ...(defaultVariantId
          ? [["default", stockForVariant(normalizedDraft, "default", defaultVariantId), defaultVariantId] as const]
          : []),
        ...nextDraftVariants.map((variant) => [variant.localId, stockForVariant(normalizedDraft, variant.localId, variant.variantId), variant.variantId] as const),
      ]
    : defaultVariantId
      ? [["default", stockForVariant(normalizedDraft, "default", defaultVariantId), defaultVariantId] as const]
      : [];

  const configuredStockEntries = stockEntries.filter(([, stock]) => hasConfiguredStock(stock));

  if (configuredStockEntries.length > 0) {
    blocks.inventory = "running";
    for (const [variantKey, stock, variantId] of configuredStockEntries) {
      if (!stock || !variantId) {
        continue;
      }

      const stockResult = await gateway.putStockLevel({
        variantId,
        stock,
      });
      pushCorrelation(correlationIds, stockResult.correlationId);

      if (!stockResult.ok) {
        blocks.inventory = "failed";
        messages.push(`Stock pendiente de guardar. ${stockResult.error}`);
        break;
      }

      nextStockByVariant[variantKey] = {
        ...stock,
        ...stockResult.data,
      };
    }

    if (blocks.inventory !== "failed") {
      blocks.inventory = "success";
      messages.push("Stock guardado.");
    }
  } else {
    blocks.inventory = "skipped";
  }

  const hasFailure = Object.values(blocks).some((status) => status === "failed");
  let finalBasicIsActive = activationRequested && publicationReadyBeforeSave && !hasFailure;

  if (activationRequested && !finalBasicIsActive && productId) {
    const mediaItemsAfterSave = normalizedDraft.media.items.map((item) => ({
      ...item,
      mediaAssetId: mediaAssetIdForItem(item, uploadedMediaByLocalId),
      persisted: Boolean(item.persisted || mediaAssetIdForItem(item, uploadedMediaByLocalId)),
    }));
    const publicationDraft = applyActivationState({
      ...normalizedDraft,
      variants: nextDraftVariants,
      media: {
        ...normalizedDraft.media,
        items: mediaItemsAfterSave,
      },
      pricing: {
        productPrice: nextProductPrice,
        variantPrices: nextVariantPrices,
      },
      inventory: {
        stockByVariant: nextStockByVariant,
      },
    }, true);
    const publicationValidation = validateProductPublicationReadiness(publicationDraft);

    if (publicationValidation.ok && !hasFailure) {
      let defaultVariantActivationOk = true;
      if (defaultVariantId) {
        const activatedDefaultVariant = await gateway.updateVariant(defaultVariantId, {
          locale: context.locale,
          name: publicationDraft.defaultVariant.name || publicationDraft.basic.name,
          refId: publicationDraft.defaultVariant.refId,
          ean: publicationDraft.defaultVariant.ean ?? null,
          isVisible: publicationDraft.basic.isVisible,
          isActive: true,
        });
        pushCorrelation(correlationIds, activatedDefaultVariant.correlationId);

        if (!activatedDefaultVariant.ok) {
          defaultVariantActivationOk = false;
          finalBasicIsActive = false;
          fieldErrors.publication = activatedDefaultVariant.error;
          messages.push(`Producto guardado fuera de linea. No se pudo activar la combinacion default. ${activatedDefaultVariant.error}`);
        }
      }

      if (defaultVariantActivationOk) {
        const activationResult = await gateway.updateProduct(productId, {
          ...toUpdateProductPayload(publicationDraft),
          isActive: true,
        });
        pushCorrelation(correlationIds, activationResult.correlationId);

        if (activationResult.ok) {
          finalBasicIsActive = true;
          messages.push("Producto activado.");
        } else {
          finalBasicIsActive = false;
          fieldErrors.publication = activationResult.error;
          messages.push(`Producto guardado fuera de linea. No se pudo activar. ${activationResult.error}`);
        }
      }
    } else {
      finalBasicIsActive = false;
      Object.assign(fieldErrors, publicationValidation.fieldErrors);
      messages.push(activationBlockedMessage(publicationDraft));
    }
  }

  return {
    ok: !hasFailure && (activationRequested ? finalBasicIsActive || !fieldErrors.publication : true),
    productId,
    defaultVariantId,
    mediaCollectionId,
    blocks,
    messages,
    fieldErrors,
    correlationIds,
    draftPatch: {
      productId,
      defaultVariantId,
      mediaCollectionId,
      basic: {
        ...normalizedDraft.basic,
        isActive: finalBasicIsActive,
      },
      variants: nextDraftVariants,
      media: {
        ...normalizedDraft.media,
        items: normalizedDraft.media.items.map((item) => ({
          ...item,
          mediaAssetId: mediaAssetIdForItem(item, uploadedMediaByLocalId),
          persisted: Boolean(item.persisted || mediaAssetIdForItem(item, uploadedMediaByLocalId)),
        })),
      },
      pricing: {
        productPrice: nextProductPrice,
        variantPrices: nextVariantPrices,
      },
      inventory: {
        stockByVariant: nextStockByVariant,
      },
      saveState: blocks,
    },
  };
}
