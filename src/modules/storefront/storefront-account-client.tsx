"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Download, Eye, EyeOff, FileText, LifeBuoy, MapPin, PackageCheck, ShieldCheck, Star, Trash2, UserRound, X } from "lucide-react";
import type {
  StorefrontAccountData,
  StorefrontAvatarOption,
  StorefrontCustomerAddress,
  StorefrontInvoice,
  StorefrontPurchase,
  StorefrontPurchaseLine,
} from "./storefront-account";
import {
  logoutStorefrontCustomer,
  submitStorefrontAfterSalesCase,
  submitStorefrontAccountAddress,
  updateStorefrontAccountCredentials,
  updateStorefrontAccountProfile,
  type StorefrontAccountActionState,
} from "./storefront-account-actions";

const initialState: StorefrontAccountActionState = {
  status: "idle",
  message: "",
};

type AccountDrawer = "profile" | "credentials" | "addresses" | "afterSales" | "invoices" | null;

const avatarImagePath: Record<string, string> = {
  "human-01": "/storefront/avatars/human-01.jpg",
  "human-02": "/storefront/avatars/human-02.jpg",
  "human-03": "/storefront/avatars/human-03.jpg",
  "human-04": "/storefront/avatars/human-04.jpg",
  "human-05": "/storefront/avatars/human-05.jpg",
  "animal-cat": "/storefront/avatars/animal-cat.jpg",
  "animal-dog": "/storefront/avatars/animal-dog.jpg",
  "animal-fox": "/storefront/avatars/animal-fox.jpg",
  "animal-panda": "/storefront/avatars/animal-panda.jpg",
  "animal-owl": "/storefront/avatars/animal-owl.jpg",
};

export function StorefrontAccountClient({ data }: { data: StorefrontAccountData }) {
  const [profileState, profileAction, profilePending] = useActionState(updateStorefrontAccountProfile, initialState);
  const [credentialsState, credentialsAction, credentialsPending] = useActionState(updateStorefrontAccountCredentials, initialState);
  const [addressState, addressAction, addressPending] = useActionState(submitStorefrontAccountAddress, initialState);
  const [afterSalesState, afterSalesAction, afterSalesPending] = useActionState(submitStorefrontAfterSalesCase, initialState);
  const [drawer, setDrawer] = useState<AccountDrawer>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const profile = data.profile;
  const preferences = profile.clientPreferencesData ?? {};

  return (
    <div className="storefrontAccountLayout">
      <aside className="storefrontAccountSummary">
        <AvatarPreview avatarId={profile.avatarId} options={data.avatarOptions} />
        <div className="storefrontAccountIdentity">
          <span>Mi cuenta</span>
          <h1>{profile.firstName} {profile.lastName}</h1>
          <p>{profile.email}</p>
        </div>
        <nav aria-label="Gestion de cuenta" className="storefrontAccountMenu">
          <button onClick={() => setDrawer("profile")} type="button">Editar datos</button>
          <button onClick={() => setDrawer("credentials")} type="button">Cambiar Contrasena</button>
          <button onClick={() => setDrawer("addresses")} type="button">Direcciones</button>
          <button onClick={() => setDrawer("afterSales")} type="button">Postventa</button>
          <button onClick={() => setDrawer("invoices")} type="button">Mis Facturas</button>
        </nav>
        <Link className="storefrontAccountGhostButton" href="/">
          Volver a tienda
        </Link>
        <form action={logoutStorefrontCustomer} className="storefrontAccountLogoutForm">
          <button className="storefrontAccountLogoutLink" type="submit">
            Cerrar sesion
          </button>
        </form>
      </aside>

      <section className="storefrontAccountPanel storefrontPurchasesPanel">
        <div className="storefrontAccountPanelHeader">
          <PackageCheck aria-hidden="true" size={20} />
          <div>
            <h2>Mis compras</h2>
            <p>Historial de productos comprados con importes y fechas historicas.</p>
          </div>
        </div>
        <PurchasesPanel purchases={data.purchases} />
      </section>

      {drawer ? (
        <AccountSideDrawer onClose={() => setDrawer(null)} title={drawerTitle(drawer)}>
          {drawer === "profile" ? (
            <>
              <div className="storefrontAccountPanelHeader">
                <UserRound aria-hidden="true" size={20} />
                <div>
                  <h2>Datos personales</h2>
                  <p>Nombre, contacto, preferencias y avatar visible en la tienda.</p>
                </div>
              </div>
              <ActionNotice state={profileState} />
              <form action={profileAction} className="storefrontAccountForm">
                <div className="storefrontAuthGrid">
                  <AccountField defaultValue={profile.firstName} label="Nombre" name="firstName" type="text" />
                  <AccountField defaultValue={profile.lastName} label="Apellido" name="lastName" type="text" />
                </div>
                <AccountField defaultValue={profile.phone ?? ""} label="Telefono" name="phone" required={false} type="tel" />
                <label className="storefrontAuthField">
                  <span>Idioma</span>
                  <select defaultValue={preferences.locale ?? "es-ES"} name="locale">
                    <option value="es-ES">Espanol</option>
                    <option value="en-US">English</option>
                    <option value="pt-BR">Portugues</option>
                  </select>
                </label>
                <label className="storefrontAccountToggle">
                  <input defaultChecked={Boolean(preferences.optinNewsLetter)} name="optinNewsLetter" type="checkbox" />
                  <span>Recibir novedades y ofertas por email</span>
                </label>
                <AvatarPicker currentAvatarId={profile.avatarId} options={data.avatarOptions} />
                <button className="storefrontAuthSubmit" disabled={profilePending} type="submit">
                  {profilePending ? "Guardando..." : "Guardar perfil"}
                </button>
              </form>
            </>
          ) : null}
          {drawer === "credentials" ? (
            <>
              <div className="storefrontAccountPanelHeader">
                <ShieldCheck aria-hidden="true" size={20} />
                <div>
                  <h2>Seguridad</h2>
                  <p>Cambia email o password confirmando tu password actual.</p>
                </div>
              </div>
              <ActionNotice state={credentialsState} />
              <form action={credentialsAction} className="storefrontAccountForm">
                <AccountField defaultValue={profile.email} label="Email" name="email" type="email" />
                <PasswordField
                  label="Password actual"
                  name="currentPassword"
                  show={showCurrentPassword}
                  toggle={() => setShowCurrentPassword(!showCurrentPassword)}
                />
                <PasswordField
                  label="Nueva password"
                  name="newPassword"
                  required={false}
                  show={showNewPassword}
                  toggle={() => setShowNewPassword(!showNewPassword)}
                />
                <button className="storefrontAuthSubmit" disabled={credentialsPending} type="submit">
                  {credentialsPending ? "Actualizando..." : "Actualizar credenciales"}
                </button>
              </form>
            </>
          ) : null}
          {drawer === "addresses" ? (
            <>
              <div className="storefrontAccountPanelHeader">
                <MapPin aria-hidden="true" size={20} />
                <div>
                  <h2>Direcciones</h2>
                  <p>Alias, destino y preferencias de envio/facturacion.</p>
                </div>
              </div>
              <ActionNotice state={addressState} />
              <AddressBookPanel action={addressAction} addresses={data.addresses} pending={addressPending} />
            </>
          ) : null}
          {drawer === "afterSales" ? (
            <>
              <div className="storefrontAccountPanelHeader">
                <LifeBuoy aria-hidden="true" size={20} />
                <div>
                  <h2>Postventa</h2>
                  <p>Abre un caso de devolucion, cambio o garantia vinculado a una compra.</p>
                </div>
              </div>
              <ActionNotice state={afterSalesState} />
              <AfterSalesPanel action={afterSalesAction} pending={afterSalesPending} purchases={data.purchases} />
            </>
          ) : null}
          {drawer === "invoices" ? (
            <>
              <div className="storefrontAccountPanelHeader">
                <FileText aria-hidden="true" size={20} />
                <div>
                  <h2>Mis facturas</h2>
                  <p>Documentos fiscales emitidos por tus compras con descarga segura.</p>
                </div>
              </div>
              <InvoicesPanel invoices={data.invoices} />
            </>
          ) : null}
        </AccountSideDrawer>
      ) : null}
    </div>
  );
}

function drawerTitle(drawer: Exclude<AccountDrawer, null>) {
  if (drawer === "profile") {
    return "Editar datos";
  }
  if (drawer === "credentials") {
    return "Cambiar Contrasena";
  }
  if (drawer === "addresses") {
    return "Direcciones";
  }
  return drawer === "afterSales" ? "Postventa" : "Mis Facturas";
}

function AccountSideDrawer({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="storefrontAccountDrawerLayer">
      <button aria-label="Cerrar ventana lateral" className="storefrontAccountDrawerBackdrop" onClick={onClose} type="button" />
      <aside aria-label={title} aria-modal="true" className="storefrontAccountSideDrawer" role="dialog">
        <div className="storefrontAccountDrawerHeader">
          <span>{title}</span>
          <button aria-label="Cerrar" onClick={onClose} type="button">
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <div className="storefrontAccountDrawerBody">
          {children}
        </div>
      </aside>
    </div>
  );
}

function AddressBookPanel({
  action,
  addresses,
  pending,
}: {
  action: (payload: FormData) => void;
  addresses: StorefrontAccountData["addresses"];
  pending: boolean;
}) {
  const newAddressEditorRef = useRef<HTMLDetailsElement | null>(null);

  if (!addresses.ok) {
    return (
      <div className="storefrontAccountEmpty">
        <strong>No pudimos cargar direcciones</strong>
        <p>{addresses.status === 401 ? "Vuelve a iniciar sesion para gestionar tu libreta." : addresses.error}</p>
      </div>
    );
  }

  const isFull = addresses.data.count >= addresses.data.maxAddresses;

  return (
    <div className="storefrontAddressBookPanel">
      <div className="storefrontAddressBookMeter">
        <span>Guardadas</span>
        <strong>{addresses.data.count}/{addresses.data.maxAddresses}</strong>
      </div>
      {addresses.data.items.length > 0 ? (
        <div className="storefrontAddressBookList">
          {addresses.data.items.map((address) => (
            <AddressBookCard
              action={action}
              address={address}
              defaultBillingAddressId={addresses.data.defaultBillingAddressId}
              defaultShippingAddressId={addresses.data.defaultShippingAddressId}
              key={address.addressId}
              pending={pending}
            />
          ))}
        </div>
      ) : (
        <div className="storefrontAccountEmpty">
          <strong>Sin direcciones guardadas</strong>
          <p>Puedes guardar hasta {addresses.data.maxAddresses} direcciones.</p>
        </div>
      )}
      {!isFull ? (
        <details
          className="storefrontAddressBookEditor"
          onToggle={(event) => {
            if (event.currentTarget.open) {
              window.setTimeout(() => {
                newAddressEditorRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }, 0);
            }
          }}
          ref={newAddressEditorRef}
        >
          <summary>Nueva direccion</summary>
          <form action={action} className="storefrontAccountForm">
            <input name="operation" type="hidden" value="create" />
            <AddressFields />
            <button className="storefrontAuthSubmit" disabled={pending} type="submit">
              {pending ? "Guardando..." : "Guardar direccion"}
            </button>
          </form>
        </details>
      ) : (
        <p className="storefrontAddressBookNotice">Limite de direcciones alcanzado.</p>
      )}
    </div>
  );
}

function AddressBookCard({
  action,
  address,
  defaultBillingAddressId,
  defaultShippingAddressId,
  pending,
}: {
  action: (payload: FormData) => void;
  address: StorefrontCustomerAddress;
  defaultBillingAddressId?: string | null;
  defaultShippingAddressId?: string | null;
  pending: boolean;
}) {
  const isDefaultShipping = defaultShippingAddressId === address.addressId;
  const isDefaultBilling = defaultBillingAddressId === address.addressId;

  return (
    <article className="storefrontAddressBookCard">
      <div className="storefrontAddressBookCardHeader">
        <div>
          <h3>{address.alias}</h3>
          <p>{addressLine(address)}</p>
        </div>
        <div className="storefrontAddressBookBadges">
          {isDefaultShipping ? <span>Envio</span> : null}
          {isDefaultBilling ? <span>Fiscal</span> : null}
        </div>
      </div>
      <dl>
        <div><dt>Recibe</dt><dd>{address.receiverName}</dd></div>
        <div><dt>Ciudad</dt><dd>{address.city}</dd></div>
        <div><dt>Codigo postal</dt><dd>{address.postalCode}</dd></div>
        <div><dt>Rol</dt><dd>{addressRoleLabel(address.addressRole)}</dd></div>
      </dl>
      <div className="storefrontAddressBookActions">
        {!isDefaultShipping ? (
          <form action={action}>
            <input name="operation" type="hidden" value="default-shipping" />
            <input name="addressId" type="hidden" value={address.addressId} />
            <button disabled={pending} type="submit">
              <Star aria-hidden="true" size={15} />
              Envio
            </button>
          </form>
        ) : null}
        {!isDefaultBilling ? (
          <form action={action}>
            <input name="operation" type="hidden" value="default-billing" />
            <input name="addressId" type="hidden" value={address.addressId} />
            <button disabled={pending} type="submit">
              <Star aria-hidden="true" size={15} />
              Fiscal
            </button>
          </form>
        ) : null}
        <form action={action}>
          <input name="operation" type="hidden" value="delete" />
          <input name="addressId" type="hidden" value={address.addressId} />
          <button className="storefrontAddressBookDanger" disabled={pending} type="submit">
            <Trash2 aria-hidden="true" size={15} />
            Eliminar
          </button>
        </form>
      </div>
      <details className="storefrontAddressBookEditor">
        <summary>Editar</summary>
        <form action={action} className="storefrontAccountForm">
          <input name="operation" type="hidden" value="update" />
          <input name="addressId" type="hidden" value={address.addressId} />
          <AddressFields address={address} />
          <button className="storefrontAuthSubmit" disabled={pending} type="submit">
            {pending ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </details>
    </article>
  );
}

function AddressFields({ address }: { address?: StorefrontCustomerAddress }) {
  return (
    <>
      <div className="storefrontAuthGrid">
        <AccountField defaultValue={address?.alias ?? ""} label="Alias" name="alias" type="text" />
        <AccountField defaultValue={address?.receiverName ?? ""} label="Recibe" name="receiverName" type="text" />
      </div>
      <div className="storefrontAuthGrid">
        <AccountField defaultValue={address?.street ?? ""} label="Calle" name="street" type="text" />
        <AccountField defaultValue={address?.number ?? ""} label="Numero" name="number" type="text" />
      </div>
      <div className="storefrontAuthGrid">
        <AccountField defaultValue={address?.city ?? ""} label="Ciudad" name="city" type="text" />
        <AccountField defaultValue={address?.state ?? ""} label="Provincia" name="state" type="text" />
      </div>
      <div className="storefrontAuthGrid">
        <AccountField defaultValue={address?.postalCode ?? ""} label="Codigo postal" name="postalCode" type="text" />
        <AccountField defaultValue={address?.country ?? "ES"} label="Pais" name="country" type="text" />
      </div>
      <div className="storefrontAuthGrid">
        <AccountField defaultValue={address?.neighborhood ?? ""} label="Barrio" name="neighborhood" required={false} type="text" />
        <AccountField defaultValue={address?.complement ?? ""} label="Complemento" name="complement" required={false} type="text" />
      </div>
      <AccountField defaultValue={address?.reference ?? ""} label="Referencia" name="reference" required={false} type="text" />
      <label className="storefrontAuthField">
        <span>Uso</span>
        <select defaultValue={address?.addressRole ?? "BOTH"} name="addressRole">
          <option value="BOTH">Envio y fiscal</option>
          <option value="SHIPPING">Solo envio</option>
          <option value="BILLING">Solo fiscal</option>
        </select>
      </label>
      <input name="addressType" type="hidden" value={address?.addressType ?? "residential"} />
    </>
  );
}

function addressLine(address: StorefrontCustomerAddress) {
  return [address.street, address.number, address.city, address.postalCode].filter(Boolean).join(", ") || "-";
}

function addressRoleLabel(value: string | undefined) {
  if (value === "SHIPPING") {
    return "Envio";
  }
  if (value === "BILLING") {
    return "Fiscal";
  }
  return "Ambas";
}

function AfterSalesPanel({
  action,
  pending,
  purchases,
}: {
  action: (payload: FormData) => void;
  pending: boolean;
  purchases: StorefrontAccountData["purchases"];
}) {
  if (!purchases.ok) {
    return (
      <div className="storefrontAccountEmpty">
        <strong>No pudimos preparar postventa</strong>
        <p>Necesitamos cargar tus compras para vincular el caso al pedido correcto.</p>
      </div>
    );
  }

  if (purchases.data.items.length === 0) {
    return (
      <div className="storefrontAccountEmpty">
        <strong>No hay compras para reclamar</strong>
        <p>Cuando tengas una compra registrada, podras abrir un caso desde aqui.</p>
      </div>
    );
  }

  return (
    <form action={action} className="storefrontAccountForm storefrontAfterSalesForm">
      <label className="storefrontAuthField">
        <span>Compra</span>
        <select name="orderId" required>
          <option value="">Selecciona pedido</option>
          {purchases.data.items.map((purchase) => (
            <option key={purchase.purchaseId} value={purchase.orderId}>
              {purchase.orderId} · {dateText(purchase.placedAt)} · {moneyText(purchase.totalAmountMinor, purchase.currency)}
            </option>
          ))}
        </select>
      </label>
      <div className="storefrontAuthGrid">
        <label className="storefrontAuthField">
          <span>Motivo</span>
          <select name="reasonCode" required>
            <option value="">Selecciona motivo</option>
            <option value="RETURN">Devolucion</option>
            <option value="EXCHANGE">Cambio</option>
            <option value="WARRANTY">Garantia</option>
            <option value="DAMAGED">Producto danado</option>
            <option value="OTHER">Otro</option>
          </select>
        </label>
        <label className="storefrontAuthField">
          <span>Solucion solicitada</span>
          <select name="requestedResolution" required>
            <option value="">Selecciona solucion</option>
            <option value="REFUND">Reembolso</option>
            <option value="REPLACEMENT">Reemplazo</option>
            <option value="REPAIR">Reparacion</option>
            <option value="STORE_CREDIT">Credito tienda</option>
          </select>
        </label>
      </div>
      <label className="storefrontAuthField">
        <span>Detalle</span>
        <textarea
          minLength={20}
          name="customerMessage"
          placeholder="Describe que ocurrio, productos afectados y condicion del paquete."
          required
          rows={4}
        />
      </label>
      <button className="storefrontAuthSubmit" disabled={pending} type="submit">
        {pending ? "Enviando..." : "Abrir caso"}
      </button>
    </form>
  );
}

function InvoicesPanel({ invoices }: { invoices: StorefrontAccountData["invoices"] }) {
  if (!invoices.ok) {
    return (
      <div className="storefrontAccountEmpty">
        <strong>No pudimos cargar tus facturas</strong>
        <p>{invoices.status === 401 ? "Vuelve a iniciar sesion para consultar documentos fiscales." : invoices.error}</p>
      </div>
    );
  }

  if (invoices.data.items.length === 0) {
    return (
      <div className="storefrontAccountEmpty">
        <strong>Aun no hay facturas</strong>
        <p>Cuando se emita una factura, aparecera aqui con su documento descargable.</p>
      </div>
    );
  }

  const previousOffset = Math.max(0, invoices.data.offset - invoices.data.limit);
  const nextOffset = invoices.data.offset + invoices.data.limit;
  const hasPrevious = invoices.data.offset > 0;
  const hasNext = nextOffset < invoices.data.total;

  return (
    <div className="storefrontInvoicesList">
      {invoices.data.items.map((invoice) => (
        <InvoiceCard key={invoice.invoiceId} invoice={invoice} />
      ))}
      <div className="storefrontPurchasesPager">
        <Link
          aria-disabled={!hasPrevious}
          className={hasPrevious ? "storefrontAccountGhostButton" : "storefrontAccountGhostButton storefrontAccountGhostButtonDisabled"}
          href={`/account?invoicesLimit=${invoices.data.limit}&invoicesOffset=${previousOffset}`}
        >
          Anterior
        </Link>
        <span>
          {invoices.data.offset + 1}-{Math.min(nextOffset, invoices.data.total)} de {invoices.data.total}
        </span>
        <Link
          aria-disabled={!hasNext}
          className={hasNext ? "storefrontAccountGhostButton" : "storefrontAccountGhostButton storefrontAccountGhostButtonDisabled"}
          href={`/account?invoicesLimit=${invoices.data.limit}&invoicesOffset=${nextOffset}`}
        >
          Siguiente
        </Link>
      </div>
    </div>
  );
}

function InvoiceCard({ invoice }: { invoice: StorefrontInvoice }) {
  return (
    <article className="storefrontInvoiceCard">
      <div className="storefrontInvoiceMain">
        <span>{dateText(invoice.issuedAt)}</span>
        <h3>{invoice.invoiceNumber || invoice.invoiceId}</h3>
        <p className="storefrontInvoiceOrder">{invoice.orderId ? `Pedido ${invoice.orderId}` : "Pedido no vinculado"}</p>
      </div>
      <div className="storefrontInvoiceFooter">
        <div>
          <strong>{moneyText(invoice.totalAmountMinor, invoice.currency)}</strong>
          <span className="storefrontPurchaseBadge">{invoice.status}</span>
        </div>
        <Link
          className="storefrontInvoiceDownload"
          href={`/account/invoices/${encodeURIComponent(invoice.invoiceId)}/document`}
          rel="noreferrer"
          target="_blank"
        >
          <Download aria-hidden="true" size={16} />
          Descargar
        </Link>
      </div>
    </article>
  );
}

function PurchasesPanel({ purchases }: { purchases: StorefrontAccountData["purchases"] }) {
  if (!purchases.ok) {
    return (
      <div className="storefrontAccountEmpty">
        <strong>No pudimos cargar tus compras</strong>
        <p>{purchases.status === 401 ? "Vuelve a iniciar sesion para consultar tu historial." : purchases.error}</p>
      </div>
    );
  }

  if (purchases.data.items.length === 0) {
    return (
      <div className="storefrontAccountEmpty">
        <strong>Aun no hay compras</strong>
        <p>Cuando completes un pedido, tus productos apareceran aqui como historial.</p>
      </div>
    );
  }

  const previousOffset = Math.max(0, purchases.data.offset - purchases.data.limit);
  const nextOffset = purchases.data.offset + purchases.data.limit;
  const hasPrevious = purchases.data.offset > 0;
  const hasNext = nextOffset < purchases.data.total;

  return (
    <div className="storefrontPurchasesList">
      {purchases.data.items.map((purchase) => (
        <PurchaseCard key={purchase.purchaseId} purchase={purchase} />
      ))}
      <div className="storefrontPurchasesPager">
        <Link
          aria-disabled={!hasPrevious}
          className={hasPrevious ? "storefrontAccountGhostButton" : "storefrontAccountGhostButton storefrontAccountGhostButtonDisabled"}
          href={`/account?purchasesLimit=${purchases.data.limit}&purchasesOffset=${previousOffset}`}
        >
          Anterior
        </Link>
        <span>
          {purchases.data.offset + 1}-{Math.min(nextOffset, purchases.data.total)} de {purchases.data.total}
        </span>
        <Link
          aria-disabled={!hasNext}
          className={hasNext ? "storefrontAccountGhostButton" : "storefrontAccountGhostButton storefrontAccountGhostButtonDisabled"}
          href={`/account?purchasesLimit=${purchases.data.limit}&purchasesOffset=${nextOffset}`}
        >
          Siguiente
        </Link>
      </div>
    </div>
  );
}

function PurchaseCard({ purchase }: { purchase: StorefrontPurchase }) {
  const orderReference = purchase.orderReference ?? purchase.orderId;

  return (
    <article className="storefrontPurchaseCard">
      <div className="storefrontPurchaseHeader">
        <div>
          <span>{dateText(purchase.placedAt)}</span>
          <h3>Pedido #{orderReference}</h3>
          <p>{purchase.itemsCount} item(s)</p>
        </div>
        <div>
          <strong>{moneyText(purchase.totalAmountMinor, purchase.currency)}</strong>
          <span className={purchase.isPaid ? "storefrontPurchaseBadge storefrontPurchaseBadgeOk" : "storefrontPurchaseBadge"}>
            {purchase.status}
          </span>
        </div>
      </div>
      <div className="storefrontPurchaseItems">
        {purchase.items.map((item) => (
          <PurchaseItem key={item.lineId} item={item} currency={purchase.currency} />
        ))}
      </div>
      <div className="storefrontPurchaseActions">
        <Link href={`/pedido/${encodeURIComponent(orderReference)}/seguimiento`}>
          Ver seguimiento del pedido
        </Link>
      </div>
    </article>
  );
}

function PurchaseItem({ currency, item }: { currency: string; item: StorefrontPurchaseLine }) {
  const href = purchaseItemHref(item);
  const content = (
    <>
      <span className="storefrontPurchaseThumb">
        {item.imageUrl ? (
          <Image alt={item.name} height={54} src={item.imageUrl} unoptimized width={54} />
        ) : (
          <span aria-hidden="true">IMG</span>
        )}
      </span>
      <span>
        <strong>{item.name}</strong>
        <small>{item.quantity} x {moneyText(item.unitPriceMinor, currency)}</small>
      </span>
    </>
  );

  return href ? (
    <Link className="storefrontPurchaseItem" href={href}>
      {content}
    </Link>
  ) : (
    <div className="storefrontPurchaseItem">{content}</div>
  );
}

function purchaseItemHref(item: StorefrontPurchaseLine) {
  if (item.productUrlPath?.startsWith("/") && !item.productUrlPath.startsWith("//")) {
    return item.productUrlPath;
  }

  return item.productSlug ? `/pdp/${encodeURIComponent(item.productSlug)}` : null;
}

function moneyText(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
  }).format(amountMinor / 100);
}

function dateText(value: string) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return "Fecha pendiente";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function AccountField({
  defaultValue,
  label,
  name,
  required = true,
  type,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  required?: boolean;
  type: string;
}) {
  return (
    <label className="storefrontAuthField">
      <span>{label}</span>
      <input defaultValue={defaultValue} name={name} required={required} type={type} />
    </label>
  );
}

function PasswordField({
  label,
  name,
  required = true,
  show,
  toggle,
}: {
  label: string;
  name: string;
  required?: boolean;
  show: boolean;
  toggle: () => void;
}) {
  return (
    <label className="storefrontAuthField">
      <span>{label}</span>
      <span className="storefrontAuthPasswordControl">
        <input minLength={required ? 8 : undefined} name={name} required={required} type={show ? "text" : "password"} />
        <button aria-label={show ? "Ocultar password" : "Mostrar password"} onClick={toggle} type="button">
          {show ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
        </button>
      </span>
    </label>
  );
}

function AvatarPicker({
  currentAvatarId,
  options,
}: {
  currentAvatarId: string | null;
  options: StorefrontAvatarOption[];
}) {
  return (
    <fieldset className="storefrontAvatarPicker">
      <legend>Avatar</legend>
      <div>
        {options.map((option) => (
          <label aria-label={option.label} className="storefrontAvatarOption" key={option.avatarId}>
            <input
              defaultChecked={option.avatarId === currentAvatarId}
              name="avatarId"
              type="radio"
              value={option.avatarId}
            />
            <AvatarThumb option={option} size={52} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function AvatarPreview({
  avatarId,
  options,
}: {
  avatarId: string | null;
  options: StorefrontAvatarOption[];
}) {
  const option = options.find((item) => item.avatarId === avatarId) ?? options[0];

  return (
    <div className="storefrontAccountAvatar" aria-hidden="true">
      {option ? <AvatarImage option={option} size={76} /> : <span>ME</span>}
    </div>
  );
}

function AvatarThumb({ option, size }: { option: StorefrontAvatarOption; size: number }) {
  return (
    <span className="storefrontAvatarThumb" aria-hidden="true">
      <AvatarImage option={option} size={size} />
    </span>
  );
}

function AvatarImage({ option, size }: { option: StorefrontAvatarOption; size: number }) {
  const src = avatarImagePath[option.avatarId];

  if (!src) {
    return <span>{option.label.slice(0, 3).toUpperCase()}</span>;
  }

  return (
    <Image
      alt=""
      height={size}
      src={src}
      unoptimized
      width={size}
    />
  );
}

function ActionNotice({ state }: { state: StorefrontAccountActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p className={state.status === "error" ? "storefrontAuthNotice storefrontAuthNoticeError" : "storefrontAuthNotice storefrontAuthNoticeSuccess"}>
      {state.message}
    </p>
  );
}
