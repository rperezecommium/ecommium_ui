"use client";

import Link from "next/link";
import Image from "next/image";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ChevronLeft, ChevronRight, CloudUpload, Download, Eye, EyeOff, FileText, Headphones, LifeBuoy, LogOut, MapPin, MonitorSmartphone, PackageCheck, ShieldCheck, Star, Trash2, UserRound, X } from "lucide-react";
import type {
  StorefrontAccountData,
  StorefrontAvatarOption,
  StorefrontCustomerAddress,
  StorefrontDeviceSession,
  StorefrontInvoice,
  StorefrontAfterSalesCaseDetail,
  StorefrontPurchase,
  StorefrontPurchaseLine,
} from "./storefront-account";
import { AdminInfoTooltip } from "../../shared/ui/admin-info-tooltip";
import {
  closeStorefrontAccountSessions,
  confirmStorefrontAfterSalesCompletionAction,
  logoutStorefrontCustomer,
  submitStorefrontAfterSalesCase,
  replyToStorefrontAfterSalesCaseAction,
  respondToStorefrontAfterSalesSolutionProposalAction,
  uploadStorefrontAfterSalesEvidenceAction,
  submitStorefrontAccountAddress,
  updateStorefrontAccountCredentials,
  updateStorefrontAccountProfile,
  type StorefrontAccountActionState,
} from "./storefront-account-actions";

const initialState: StorefrontAccountActionState = {
  status: "idle",
  message: "",
};

const maximumOpeningEvidenceFiles = 15;
const maximumOpeningEvidenceFileBytes = 10 * 1024 * 1024;
const allowedOpeningEvidenceMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type AccountDrawer = "profile" | "credentials" | "sessions" | "addresses" | "afterSales" | "invoices" | null;

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

export function StorefrontAccountClient({
  data,
  initialDrawer,
  initialAfterSalesView,
}: {
  data: StorefrontAccountData;
  initialDrawer?: Exclude<AccountDrawer, null>;
  initialAfterSalesView?: "cases" | "new";
}) {
  const [profileState, profileAction, profilePending] = useActionState(updateStorefrontAccountProfile, initialState);
  const [credentialsState, credentialsAction, credentialsPending] = useActionState(updateStorefrontAccountCredentials, initialState);
  const [addressState, addressAction, addressPending] = useActionState(submitStorefrontAccountAddress, initialState);
  const [afterSalesState, afterSalesAction, afterSalesPending] = useActionState(submitStorefrontAfterSalesCase, initialState);
  const [afterSalesReplyState, afterSalesReplyAction, afterSalesReplyPending] = useActionState(replyToStorefrontAfterSalesCaseAction, initialState);
  const [afterSalesProposalState, afterSalesProposalAction, afterSalesProposalPending] = useActionState(respondToStorefrontAfterSalesSolutionProposalAction, initialState);
  const [afterSalesEvidenceState, afterSalesEvidenceAction, afterSalesEvidencePending] = useActionState(uploadStorefrontAfterSalesEvidenceAction, initialState);
  const [afterSalesCompletionState, afterSalesCompletionAction, afterSalesCompletionPending] = useActionState(confirmStorefrontAfterSalesCompletionAction, initialState);
  const [sessionsState, sessionsAction, sessionsPending] = useActionState(closeStorefrontAccountSessions, initialState);
  const [drawer, setDrawer] = useState<AccountDrawer>(initialDrawer ?? null);
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
          <button onClick={() => setDrawer("sessions")} type="button">Sesiones y dispositivos</button>
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
          {drawer === "sessions" ? (
            <>
              <div className="storefrontAccountPanelHeader">
                <MonitorSmartphone aria-hidden="true" size={20} />
                <div>
                  <h2>Sesiones y dispositivos</h2>
                  <p>Revisa donde esta abierta tu cuenta y cierra accesos que ya no uses.</p>
                </div>
              </div>
              <ActionNotice state={sessionsState} />
              <SessionsPanel action={sessionsAction} pending={sessionsPending} sessions={data.sessions} />
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
              {afterSalesState.caseId ? null : <ActionNotice state={afterSalesState} />}
              <ActionNotice state={afterSalesReplyState} />
              <ActionNotice state={afterSalesProposalState} />
              <ActionNotice state={afterSalesEvidenceState} />
              <ActionNotice state={afterSalesCompletionState} />
              <AfterSalesPanel
                action={afterSalesAction}
                caseDetail={data.selectedAfterSalesCase?.ok ? data.selectedAfterSalesCase.data : null}
                cases={data.afterSales}
                completionAction={afterSalesCompletionAction}
                completionPending={afterSalesCompletionPending}
                evidenceAction={afterSalesEvidenceAction}
                evidencePending={afterSalesEvidencePending}
                initialView={initialAfterSalesView}
                pending={afterSalesPending}
                purchases={data.purchases}
                replyAction={afterSalesReplyAction}
                replyPending={afterSalesReplyPending}
                proposalAction={afterSalesProposalAction}
                proposalPending={afterSalesProposalPending}
                state={afterSalesState}
              />
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
  if (drawer === "sessions") {
    return "Sesiones y dispositivos";
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

function SessionsPanel({
  action,
  pending,
  sessions,
}: {
  action: (payload: FormData) => void;
  pending: boolean;
  sessions: StorefrontAccountData["sessions"];
}) {
  if (!sessions.ok) {
    return (
      <div className="storefrontAccountEmpty">
        <strong>No pudimos cargar tus sesiones</strong>
        <p>{sessions.status === 401 ? "Vuelve a iniciar sesion para revisar tus dispositivos." : sessions.error}</p>
      </div>
    );
  }

  const activeSessions = sessions.data.sessions;
  const hasOtherSessions = activeSessions.some((session) => !session.isCurrent);

  if (activeSessions.length === 0) {
    return (
      <div className="storefrontAccountEmpty">
        <strong>Sin sesiones activas</strong>
        <p>Cuando inicies sesion en esta tienda, tus dispositivos apareceran aqui.</p>
      </div>
    );
  }

  return (
    <div className="storefrontSessionsPanel">
      <div className="storefrontSessionsSummary">
        <span>Sesiones activas</span>
        <strong>{sessions.data.total}</strong>
      </div>
      <div className="storefrontSessionsList">
        {activeSessions.map((session) => (
          <SessionCard action={action} key={session.sessionId} pending={pending} session={session} />
        ))}
      </div>
      <div className="storefrontSessionsActions">
        <form
          action={action}
          onSubmit={(event) => {
            if (!window.confirm("Cerrar las otras sesiones activas de tu cuenta?")) {
              event.preventDefault();
            }
          }}
        >
          <input name="operation" type="hidden" value="others" />
          <button className="storefrontAccountGhostButton" disabled={pending || !hasOtherSessions} type="submit">
            Cerrar otros dispositivos
          </button>
        </form>
        <form
          action={action}
          onSubmit={(event) => {
            if (!window.confirm("Cerrar todas las sesiones, incluida esta?")) {
              event.preventDefault();
            }
          }}
        >
          <input name="operation" type="hidden" value="all" />
          <button className="storefrontAccountDangerButton" disabled={pending} type="submit">
            <LogOut aria-hidden="true" size={16} />
            Cerrar todas
          </button>
        </form>
      </div>
    </div>
  );
}

function SessionCard({
  action,
  pending,
  session,
}: {
  action: (payload: FormData) => void;
  pending: boolean;
  session: StorefrontDeviceSession;
}) {
  return (
    <article className={session.isCurrent ? "storefrontSessionCard storefrontSessionCardCurrent" : "storefrontSessionCard"}>
      <div className="storefrontSessionCardHeader">
        <span className="storefrontSessionIcon">
          <MonitorSmartphone aria-hidden="true" size={18} />
        </span>
        <div>
          <h3>{sessionDeviceLabel(session)}</h3>
          <p>{session.isCurrent ? "Este dispositivo" : "Sesion activa"}</p>
        </div>
        {session.isCurrent ? <span className="storefrontSessionBadge">Actual</span> : null}
      </div>
      <dl>
        <div><dt>Ultima actividad</dt><dd>{dateTimeText(session.lastSeenAt)}</dd></div>
        <div><dt>Inicio</dt><dd>{dateTimeText(session.createdAt)}</dd></div>
        <div><dt>IP</dt><dd>{session.device.ipAddress || "No disponible"}</dd></div>
      </dl>
      {session.isCurrent ? (
        <form
          action={action}
          onSubmit={(event) => {
            if (!window.confirm("Cerrar esta sesion ahora?")) {
              event.preventDefault();
            }
          }}
        >
          <input name="operation" type="hidden" value="current" />
          <button className="storefrontAccountDangerButton" disabled={pending} type="submit">
            <LogOut aria-hidden="true" size={16} />
            Cerrar esta sesion
          </button>
        </form>
      ) : null}
    </article>
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

function storefrontAfterSalesReasonLabel(value: string) {
  const labels: Record<string, string> = {
    RETURN: "Devolución",
    EXCHANGE: "Cambio",
    WARRANTY: "Garantía",
    DAMAGED: "Producto dañado",
    OTHER: "Otro motivo",
  };
  return labels[value] ?? value;
}

function AfterSalesPanel({
  action,
  caseDetail,
  cases,
  completionAction,
  completionPending,
  evidenceAction,
  evidencePending,
  initialView,
  pending,
  purchases,
  replyAction,
  replyPending,
  proposalAction,
  proposalPending,
  state,
}: {
  action: (payload: FormData) => void;
  caseDetail: StorefrontAfterSalesCaseDetail | null;
  cases: StorefrontAccountData["afterSales"];
  completionAction: (payload: FormData) => void;
  completionPending: boolean;
  evidenceAction: (payload: FormData) => void;
  evidencePending: boolean;
  initialView?: "cases" | "new";
  pending: boolean;
  purchases: StorefrontAccountData["purchases"];
  replyAction: (payload: FormData) => void;
  replyPending: boolean;
  proposalAction: (payload: FormData) => void;
  proposalPending: boolean;
  state: StorefrontAccountActionState;
}) {
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [selectedLineQuantities, setSelectedLineQuantities] = useState<Record<string, number>>({});
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardDirection, setWizardDirection] = useState<"forward" | "backward">("forward");
  const [reasonCode, setReasonCode] = useState("");
  const [requestedResolution, setRequestedResolution] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [selectedEvidenceFiles, setSelectedEvidenceFiles] = useState<File[]>([]);
  const [evidenceSelectionMessage, setEvidenceSelectionMessage] = useState("");
  const selectedPurchase = purchases.ok
    ? purchases.data.items.find((purchase) => purchase.orderId === selectedOrderId) ?? null
    : null;
  const selectedItems = selectedPurchase?.items.flatMap((item) => selectedLineIds.includes(item.lineId)
    ? [{ orderLineId: item.lineId, quantityRequested: selectedLineQuantities[item.lineId] ?? 1 }]
    : []) ?? [];
  const selectedProductSummary = selectedPurchase?.items.flatMap((item) => {
    if (!selectedLineIds.includes(item.lineId)) return [];
    const quantityRequested = selectedLineQuantities[item.lineId] ?? 1;
    return [`${item.name} · ${quantityRequested} ${quantityRequested === 1 ? "unidad" : "unidades"}`];
  }) ?? [];
  const canContinueFromPurchase = Boolean(selectedPurchase) && selectedItems.length > 0;
  const canContinueFromDetails = Boolean(reasonCode && requestedResolution && customerMessage.trim().length >= 20);
  const wizardPanelClassName = `storefrontAfterSalesWizardPanel${wizardDirection === "backward" ? " is-moving-backward" : ""}`;

  const changeSelectedOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setSelectedLineIds([]);
    setSelectedLineQuantities({});
  };

  const toggleSelectedLine = (lineId: string) => {
    setSelectedLineIds((current) => current.includes(lineId)
      ? current.filter((currentLineId) => currentLineId !== lineId)
      : [...current, lineId]);
    setSelectedLineQuantities((current) => ({
      ...current,
      [lineId]: current[lineId] ?? 1,
    }));
  };

  const changeSelectedLineQuantity = (lineId: string, quantity: number, maximum: number) => {
    const normalizedQuantity = Number.isInteger(quantity)
      ? Math.min(Math.max(quantity, 1), maximum)
      : 1;
    setSelectedLineQuantities((current) => ({
      ...current,
      [lineId]: normalizedQuantity,
    }));
  };

  const moveWizardStep = (nextStep: 1 | 2 | 3) => {
    setWizardDirection(nextStep > wizardStep ? "forward" : "backward");
    setWizardStep(nextStep);
  };

  const addEvidenceFiles = (files: FileList | null) => {
    if (!files?.length) return;

    const remainingCapacity = maximumOpeningEvidenceFiles - selectedEvidenceFiles.length;
    const validFiles = Array.from(files).filter((file) => (
      allowedOpeningEvidenceMimeTypes.has(file.type) && file.size > 0 && file.size <= maximumOpeningEvidenceFileBytes
    ));
    const selectedFiles = validFiles.slice(0, Math.max(remainingCapacity, 0));
    const rejectedCount = files.length - selectedFiles.length;

    if (selectedFiles.length > 0) {
      setSelectedEvidenceFiles((current) => [...current, ...selectedFiles]);
    }

    if (rejectedCount > 0) {
      setEvidenceSelectionMessage(`No añadimos ${rejectedCount} ${rejectedCount === 1 ? "archivo" : "archivos"}. Usa JPG, PNG o WebP de hasta 10 MB y un máximo de 15 imágenes.`);
    } else {
      setEvidenceSelectionMessage("");
    }
  };

  const removeEvidenceFile = (index: number) => {
    setSelectedEvidenceFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setEvidenceSelectionMessage("");
  };

  const submitCaseWithPreparedEvidence = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    selectedEvidenceFiles.forEach((file) => formData.append("evidences", file, file.name));
    startTransition(() => action(formData));
  };

  if (caseDetail) {
    return <AfterSalesCaseHistory
      backToCasesHref={afterSalesListHref(cases)}
      caseDetail={caseDetail}
      completionAction={completionAction}
      completionPending={completionPending}
      evidenceAction={evidenceAction}
      evidencePending={evidencePending}
      replyAction={replyAction}
      replyPending={replyPending}
      proposalAction={proposalAction}
      proposalPending={proposalPending}
    />;
  }

  if (initialView === "cases") {
    return <AfterSalesCaseList cases={cases} />;
  }

  if (initialView !== "new") {
    return <AfterSalesHome cases={cases} />;
  }

  if (state.status === "success" && state.caseId) {
    return <AfterSalesOpeningComplete caseId={state.caseId} message={state.message} />;
  }

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
    <section className="storefrontAfterSalesWizard" aria-labelledby="after-sales-wizard-heading">
      <div className="storefrontAfterSalesWizardHeader">
        <Link className="storefrontAccountGhostButton" href="/account?section=afterSales">
          Volver a postventa
        </Link>
        <div>
          <h3 id="after-sales-wizard-heading">Abrir un nuevo caso</h3>
          <p>Te guiaremos paso a paso. Solo necesitaremos la información imprescindible.</p>
        </div>
      </div>

      <ol aria-label="Proceso para abrir un caso" className="storefrontAfterSalesWizardProgress">
        {[
          [1, "Compra y productos"],
          [2, "Cuéntanos"],
          [3, "Evidencias y revisión"],
        ].map(([step, label]) => {
          const stepNumber = step as 1 | 2 | 3;
          const isCurrent = wizardStep === stepNumber;
          const isComplete = wizardStep > stepNumber;

          return (
            <li className={isCurrent ? "is-current" : isComplete ? "is-complete" : ""} key={stepNumber}>
              <button
                aria-current={isCurrent ? "step" : undefined}
                disabled={pending || !isComplete}
                onClick={() => moveWizardStep(stepNumber)}
                type="button"
              >
                <span aria-hidden="true">{isComplete ? "✓" : stepNumber}</span>
                <strong>{label}</strong>
              </button>
            </li>
          );
        })}
      </ol>

      <form aria-busy={pending} className="storefrontAccountForm storefrontAfterSalesForm storefrontAfterSalesWizardForm" onSubmit={submitCaseWithPreparedEvidence}>
        <input name="orderId" type="hidden" value={selectedOrderId} />
        <input name="items" type="hidden" value={JSON.stringify(selectedItems)} />
        {wizardStep !== 2 ? (
          <>
            <input name="reasonCode" type="hidden" value={reasonCode} />
            <input name="requestedResolution" type="hidden" value={requestedResolution} />
            <input name="customerMessage" type="hidden" value={customerMessage} />
          </>
        ) : null}

        {wizardStep === 1 ? (
          <section className={wizardPanelClassName} key="purchase" aria-labelledby="after-sales-wizard-purchase-heading">
            <div className="storefrontAfterSalesWizardPanelHeading">
              <span>Paso 1 de 3</span>
              <h4 id="after-sales-wizard-purchase-heading">¿En qué compra ocurrió?</h4>
              <p>Elige el pedido y los productos afectados para que el equipo revise exactamente lo necesario.</p>
            </div>
            <label className="storefrontAuthField">
              <span>Compra</span>
              <select onChange={(event) => changeSelectedOrder(event.target.value)} required value={selectedOrderId}>
                <option value="">Selecciona una compra</option>
                {purchases.data.items.map((purchase) => (
                  <option key={purchase.purchaseId} value={purchase.orderId}>
                    {purchase.orderId} · {dateText(purchase.placedAt)} · {moneyText(purchase.totalAmountMinor, purchase.currency)}
                  </option>
                ))}
              </select>
              <small>
                {selectedPurchase
                  ? `Pedido elegido: ${selectedPurchase.itemsCount} ${selectedPurchase.itemsCount === 1 ? "producto" : "productos"}.`
                  : "Elige primero la compra para identificar los productos afectados."}
              </small>
            </label>
            {selectedPurchase ? (
              <fieldset className="storefrontAfterSalesItemSelector">
                <legend>¿Qué productos tienen el problema?</legend>
                <p>Selecciona uno o varios productos afectados.</p>
                <div className="storefrontAfterSalesItemChoices">
                  {selectedPurchase.items.map((item) => {
                    const itemId = `after-sales-${selectedPurchase.purchaseId}-${item.lineId}`;
                    const selected = selectedLineIds.includes(item.lineId);

                    return (
                      <div className="storefrontAfterSalesItemChoice" key={item.lineId}>
                        <label htmlFor={itemId}>
                          <input
                            checked={selected}
                            id={itemId}
                            onChange={() => toggleSelectedLine(item.lineId)}
                            type="checkbox"
                          />
                          <span>
                            <strong>{item.name}</strong>
                            <small>Cantidad comprada: {item.quantity}</small>
                          </span>
                        </label>
                        {selected ? (
                          <label className="storefrontAfterSalesItemQuantity">
                            <span>Cantidad afectada</span>
                            <input
                              max={item.quantity}
                              min={1}
                              onChange={(event) => changeSelectedLineQuantity(item.lineId, Number(event.target.value), item.quantity)}
                              type="number"
                              value={selectedLineQuantities[item.lineId] ?? 1}
                            />
                          </label>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <small className="storefrontAfterSalesItemSelection">
                  {selectedLineIds.length === 0
                    ? "Aún no has seleccionado ningún producto."
                    : `${selectedLineIds.length} ${selectedLineIds.length === 1 ? "producto seleccionado" : "productos seleccionados"}.`}
                </small>
              </fieldset>
            ) : null}
            <div className="storefrontAfterSalesWizardActions storefrontAfterSalesWizardActionsEnd">
              <button className="storefrontAuthSubmit" disabled={!canContinueFromPurchase} onClick={() => moveWizardStep(2)} type="button">
                Siguiente
              </button>
            </div>
          </section>
        ) : null}

        {wizardStep === 2 ? (
          <section className={wizardPanelClassName} key="details" aria-labelledby="after-sales-wizard-details-heading">
            <div className="storefrontAfterSalesWizardPanelHeading">
              <span>Paso 2 de 3</span>
              <h4 id="after-sales-wizard-details-heading">Cuéntanos qué ha ocurrido</h4>
              <p>Esta información será el mensaje inicial que verá el equipo de Postventa.</p>
            </div>
            <div className="storefrontAuthGrid">
              <label className="storefrontAuthField">
                <span>Motivo</span>
                <select name="reasonCode" onChange={(event) => setReasonCode(event.target.value)} required value={reasonCode}>
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
                <select name="requestedResolution" onChange={(event) => setRequestedResolution(event.target.value)} required value={requestedResolution}>
                  <option value="">Selecciona solucion</option>
                  <option value="REFUND">Reembolso</option>
                  <option value="REPLACEMENT">Reemplazo</option>
                  <option value="REPAIR">Reparacion</option>
                  <option value="STORE_CREDIT">Credito tienda</option>
                </select>
              </label>
            </div>
            <label className="storefrontAuthField">
              <span>Cuéntanos qué ha ocurrido</span>
              <textarea
                minLength={20}
                name="customerMessage"
                onChange={(event) => setCustomerMessage(event.target.value)}
                placeholder="Es obligatorio. Describe el problema, los productos afectados y el estado del paquete."
                required
                rows={4}
                value={customerMessage}
              />
              <small>Necesitamos al menos 20 caracteres para dar contexto a la solicitud.</small>
            </label>
            <div className="storefrontAfterSalesWizardActions">
              <button className="storefrontAccountGhostButton" onClick={() => moveWizardStep(1)} type="button">Atrás</button>
              <button className="storefrontAuthSubmit" disabled={!canContinueFromDetails} onClick={() => moveWizardStep(3)} type="button">Siguiente</button>
            </div>
          </section>
        ) : null}

        {wizardStep === 3 ? (
          <section className={wizardPanelClassName} key="review" aria-labelledby="after-sales-wizard-review-heading">
            <div className="storefrontAfterSalesWizardPanelHeading">
              <span>Paso 3 de 3</span>
              <h4 id="after-sales-wizard-review-heading">¿Deseas aportar evidencias?</h4>
              <p>Es opcional. Las fotos se preparan ahora y solo se analizan después de crear el caso.</p>
            </div>
            <label className="storefrontAfterSalesEvidencePicker">
              <span>Añadir fotos</span>
              <span className="storefrontAfterSalesFileTrigger"><CloudUpload aria-hidden="true" size={17} />Seleccionar imágenes</span>
              <input
                accept="image/png,image/jpeg,image/webp"
                className="storefrontAfterSalesFileInput"
                disabled={pending}
                multiple
                onChange={(event) => {
                  addEvidenceFiles(event.target.files);
                  event.target.value = "";
                }}
                type="file"
              />
              <small>PNG, JPG o WebP, hasta 10 MB por imagen. Puedes continuar sin adjuntar ninguna.</small>
            </label>
            {evidenceSelectionMessage ? <p aria-live="polite" className="storefrontAfterSalesEvidenceSelectionMessage">{evidenceSelectionMessage}</p> : null}
            {selectedEvidenceFiles.length > 0 ? (
              <ul aria-label="Imágenes preparadas" className="storefrontAfterSalesPreparedEvidence">
                {selectedEvidenceFiles.map((file, index) => (
                  <li key={`${file.name}-${file.lastModified}-${index}`}>
                    <span><strong>{file.name}</strong><small>{Math.ceil(file.size / 1024)} KB</small></span>
                    <button aria-label={`Quitar ${file.name}`} className="storefrontAccountGhostButton" disabled={pending} onClick={() => removeEvidenceFile(index)} type="button">Quitar</button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="storefrontAfterSalesWizardReviewHeading">
              <h5>Revisa antes de abrir el caso</h5>
              <p>{selectedEvidenceFiles.length === 0 ? "No añadirás evidencias ahora." : `${selectedEvidenceFiles.length} ${selectedEvidenceFiles.length === 1 ? "imagen preparada" : "imágenes preparadas"} para su análisis.`}</p>
            </div>
            <ul className="storefrontAfterSalesWizardSummary">
              <li><span>Compra</span><strong>{selectedPurchase ? `${selectedPurchase.orderId} · ${dateText(selectedPurchase.placedAt)}` : selectedOrderId}</strong></li>
              <li><span>Productos afectados</span><strong>{selectedProductSummary.join(", ")}</strong></li>
              <li><span>Motivo</span><strong>{storefrontAfterSalesReasonLabel(reasonCode)}</strong></li>
              <li><span>Solución solicitada</span><strong>{storefrontResolutionOutcomeLabel(requestedResolution)}</strong></li>
            </ul>
            {pending ? (
              <p aria-live="polite" className="storefrontAfterSalesWizardSubmitting" role="status">
                {selectedEvidenceFiles.length > 0
                  ? "Estamos abriendo el caso y preparando las imágenes. No cierres esta ventana."
                  : "Estamos abriendo el caso. No cierres esta ventana."}
              </p>
            ) : null}
            <div className="storefrontAfterSalesWizardActions">
              <button className="storefrontAccountGhostButton" disabled={pending} onClick={() => moveWizardStep(2)} type="button">Atrás</button>
              <button className="storefrontAuthSubmit" disabled={pending} type="submit">
                {pending ? selectedEvidenceFiles.length > 0 ? "Abriendo caso y preparando imágenes..." : "Abriendo caso..." : "Abrir caso"}
              </button>
            </div>
          </section>
        ) : null}
      </form>
    </section>
  );
}

function AfterSalesOpeningComplete({ caseId, message }: { caseId: string; message: string }) {
  const caseHref = `/account?section=afterSales&afterSalesView=cases&caseId=${encodeURIComponent(caseId)}`;

  return (
    <section aria-labelledby="after-sales-opening-complete-heading" className="storefrontAfterSalesOpeningComplete">
      <div>
        <span aria-hidden="true">✓</span>
        <h3 id="after-sales-opening-complete-heading">Tu caso ya está abierto</h3>
      </div>
      <p>{message}</p>
      <p>El equipo recibirá la solicitud para revisarla. Podrás seguir cualquier respuesta desde el historial del caso.</p>
      <div className="storefrontAfterSalesWizardActions">
        <Link className="storefrontAccountGhostButton" href="/account?section=afterSales&afterSalesView=cases">Mis casos</Link>
        <Link className="storefrontAuthSubmit storefrontAfterSalesOpeningCompleteLink" href={caseHref}>Ver caso</Link>
      </div>
    </section>
  );
}

function AfterSalesHome({ cases }: { cases: StorefrontAccountData["afterSales"] }) {
  const caseCount = cases.ok ? cases.data.total : null;

  return (
    <section className="storefrontAfterSalesHome" aria-labelledby="after-sales-home-heading">
      <div>
        <h3 id="after-sales-home-heading">¿Qué necesitas hacer?</h3>
        <p>Consulta una solicitud que ya has abierto o inicia una nueva cuando la necesites.</p>
      </div>
      <div className="storefrontAfterSalesHomeChoices">
        <div className="storefrontAfterSalesHomeChoice">
          <Link className="storefrontAfterSalesHomeChoiceLink" href="/account?section=afterSales&afterSalesView=cases">
            <strong>Mis casos{caseCount === null ? "" : ` (${caseCount})`}</strong>
          </Link>
          <AdminInfoTooltip
            description="Revisa el estado, los mensajes y las propuestas de solución de los casos que ya has abierto."
            label="Más información sobre Mis casos"
          />
        </div>
        <div className="storefrontAfterSalesHomeChoice">
          <Link className="storefrontAfterSalesHomeChoiceLink" href="/account?section=afterSales&afterSalesView=new">
            <strong>Abrir un caso nuevo</strong>
          </Link>
          <AdminInfoTooltip
            description="Inicia una solicitud por un problema con uno o varios productos de una compra. Te guiaremos paso a paso."
            label="Más información sobre Abrir un caso nuevo"
          />
        </div>
      </div>
    </section>
  );
}

function afterSalesListHref(cases: StorefrontAccountData["afterSales"]) {
  if (!cases.ok) {
    return "/account?section=afterSales&afterSalesView=cases";
  }

  const { limit, offset } = cases.data;
  return `/account?section=afterSales&afterSalesView=cases&afterSalesLimit=${encodeURIComponent(String(limit))}&afterSalesOffset=${encodeURIComponent(String(offset))}`;
}

function AfterSalesCaseList({ cases }: { cases: StorefrontAccountData["afterSales"] }) {
  if (!cases.ok) {
    return (
      <div className="storefrontAccountEmpty">
        <strong>No pudimos cargar tus casos</strong>
        <p>{cases.status === 401 ? "Vuelve a iniciar sesión para consultar postventa." : cases.error}</p>
        <Link className="storefrontAccountGhostButton" href="/account?section=afterSales">Volver a postventa</Link>
      </div>
    );
  }

  const { items, limit, offset, total } = cases.data;
  const previousOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;
  const hasPrevious = offset > 0;
  const hasNext = nextOffset < total;
  const listHref = (nextListOffset: number) => `/account?section=afterSales&afterSalesView=cases&afterSalesLimit=${encodeURIComponent(String(limit))}&afterSalesOffset=${encodeURIComponent(String(nextListOffset))}`;

  return (
    <section className="storefrontAfterSalesCaseList" aria-labelledby="my-cases-heading">
      <div className="storefrontAfterSalesCaseListHeader">
        <div>
          <h3 id="my-cases-heading">Mis casos</h3>
          <p>{total === 1 ? "1 caso registrado" : `${total} casos registrados`}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="storefrontAccountEmpty">
          <strong>Aún no tienes casos abiertos</strong>
          <p>Cuando abras una devolución, cambio o garantía, podrás seguirla desde aquí.</p>
        </div>
      ) : (
        <div className="storefrontAfterSalesCaseItems">
          {items.map((caseItem) => (
            <Link
              className="storefrontAfterSalesCaseLink"
              href={`/account?section=afterSales&afterSalesView=cases&afterSalesLimit=${encodeURIComponent(String(limit))}&afterSalesOffset=${encodeURIComponent(String(offset))}&caseId=${encodeURIComponent(caseItem.caseId)}`}
              key={caseItem.caseId}
            >
              <span className="storefrontAfterSalesCaseLinkTitle">{caseItem.caseType}</span>
              <span className="storefrontPurchaseBadge">{storefrontLifecycleLabel(caseItem.lifecycleStatus)}</span>
              {caseItem.lifecycleStatus === "RESOLVED" && caseItem.autoCloseAt ? <small>Confirmación abierta hasta {dateText(caseItem.autoCloseAt)}</small> : null}
              <small>{caseItem.lastMessagePreview ?? "Sin mensajes todavía"}</small>
              <time dateTime={caseItem.lastActivityAt ?? caseItem.updatedAt}>Actualizado {dateText(caseItem.lastActivityAt ?? caseItem.updatedAt)}</time>
            </Link>
          ))}
        </div>
      )}
      {total > limit ? (
        <nav aria-label="Paginación de casos" className="storefrontPurchasesPager">
          <Link
            aria-disabled={!hasPrevious}
            className={hasPrevious ? "storefrontAccountGhostButton" : "storefrontAccountGhostButton storefrontAccountGhostButtonDisabled"}
            href={listHref(previousOffset)}
          >
            Anterior
          </Link>
          <span>{offset + 1}-{Math.min(offset + items.length, total)} de {total}</span>
          <Link
            aria-disabled={!hasNext}
            className={hasNext ? "storefrontAccountGhostButton" : "storefrontAccountGhostButton storefrontAccountGhostButtonDisabled"}
            href={listHref(nextOffset)}
          >
            Siguiente
          </Link>
        </nav>
      ) : null}
      <div className="storefrontAfterSalesCaseListActions">
        <Link className="storefrontAccountGhostButton" href="/account?section=afterSales&afterSalesView=new">Abrir un caso nuevo</Link>
        <Link className="storefrontAccountGhostButton" href="/account?section=afterSales">Volver a postventa</Link>
      </div>
    </section>
  );
}

function AfterSalesCaseHistory({
  backToCasesHref,
  caseDetail,
  completionAction,
  completionPending,
  evidenceAction,
  evidencePending,
  replyAction,
  replyPending,
  proposalAction,
  proposalPending,
}: {
  backToCasesHref: string;
  caseDetail: StorefrontAfterSalesCaseDetail;
  completionAction: (payload: FormData) => void;
  completionPending: boolean;
  evidenceAction: (payload: FormData) => void;
  evidencePending: boolean;
  replyAction: (payload: FormData) => void;
  replyPending: boolean;
  proposalAction: (payload: FormData) => void;
  proposalPending: boolean;
}) {
  const evidenceCount = caseDetail.attachments.length;
  const evidenceQuotaReached = evidenceCount >= 15;
  const isResolved = caseDetail.lifecycleStatus === "RESOLVED";
  const isClosed = caseDetail.lifecycleStatus === "CLOSED";
  const canConfirmCompletion = isResolved && ["REFUND", "STORE_CREDIT", "EXCHANGE", "REPAIR", "REPLACEMENT"].includes(caseDetail.resolutionOutcome ?? "");
  const [activeEvidenceIndex, setActiveEvidenceIndex] = useState<number | null>(null);
  const [selectedEvidenceName, setSelectedEvidenceName] = useState("");
  const [isReportingSolutionProblem, setIsReportingSolutionProblem] = useState(false);
  const requiresExplicitSolutionProblem = canConfirmCompletion;
  const canContinueCase = caseDetail.canReply && (!requiresExplicitSolutionProblem || isReportingSolutionProblem);
  const conversationRef = useRef<HTMLDivElement>(null);
  const activeEvidence = activeEvidenceIndex === null ? null : caseDetail.attachments[activeEvidenceIndex];
  const solutionProposals = caseDetail.solutionProposals ?? [];
  const pendingProposal = solutionProposals.find((proposal) => proposal.status === "PENDING_CUSTOMER") ?? null;
  const hibernatingProposal = solutionProposals.find((proposal) => proposal.status === "EXPIRED") ?? null;

  useEffect(() => {
    if (activeEvidenceIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveEvidenceIndex(null);
      if (event.key === "ArrowLeft") setActiveEvidenceIndex((current) => current === null ? null : (current - 1 + evidenceCount) % evidenceCount);
      if (event.key === "ArrowRight") setActiveEvidenceIndex((current) => current === null ? null : (current + 1) % evidenceCount);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeEvidenceIndex, evidenceCount]);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) {
      conversation.scrollTop = conversation.scrollHeight;
    }
  }, [caseDetail.caseId, caseDetail.messages.length]);

  const evidenceGallery = evidenceCount ? (
    <section aria-label="Imágenes aportadas" className="storefrontAfterSalesEvidenceSection">
      <div><strong>Imágenes aportadas</strong><span>{evidenceCount} de 15</span></div>
      <div className="storefrontAfterSalesEvidenceGrid">
        {caseDetail.attachments.map((attachment, index) => {
          const source = `/account/after-sales/cases/${encodeURIComponent(caseDetail.caseId)}/evidences/${encodeURIComponent(attachment.privateEvidenceId)}/content`;
          return (
            <button aria-label={`Abrir imagen ${index + 1} de ${evidenceCount}`} className="storefrontAfterSalesEvidenceThumbnail" key={attachment.privateEvidenceId} onClick={() => setActiveEvidenceIndex(index)} type="button">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`Evidencia aportada ${index + 1}`} loading="lazy" src={source} />
            </button>
          );
        })}
      </div>
    </section>
  ) : null;

  return (
    <div className="storefrontAfterSalesHistory">
      <Link className="storefrontAccountGhostButton" href={backToCasesHref}>Volver a mis casos</Link>
      <div className="storefrontAfterSalesCaseHeader">
        <strong>{caseDetail.caseType}</strong>
        <span className="storefrontPurchaseBadge">{storefrontLifecycleLabel(caseDetail.lifecycleStatus)}</span>
      </div>
      {canConfirmCompletion ? (
        <section aria-label="Confirmación de la solución" className="storefrontAfterSalesCompletionCard">
          <div>
            <span>Solución finalizada</span>
            <h3>¿Has recibido la solución?</h3>
          </div>
          <dl>
            <div><dt>Resultado</dt><dd>{storefrontResolutionOutcomeLabel(caseDetail.resolutionOutcome ?? "NO_ACTION")}</dd></div>
            {caseDetail.autoCloseAt ? <div><dt>Confirmación hasta</dt><dd>{dateTimeText(caseDetail.autoCloseAt)}</dd></div> : null}
          </dl>
          {caseDetail.resolutionReason ? <p>{caseDetail.resolutionReason}</p> : null}
          <p className="storefrontAfterSalesCompletionHint">Confirma solo cuando hayas recibido el reembolso, producto o servicio acordado. Si no respondes, el caso se cerrará automáticamente{caseDetail.autoCloseAt ? ` el ${dateTimeText(caseDetail.autoCloseAt)}` : " cuando finalice el plazo informado por el equipo"}.</p>
          <div className="storefrontAfterSalesCompletionActions">
            <form action={completionAction}>
              <input name="caseId" type="hidden" value={caseDetail.caseId} />
              <button className="storefrontAuthSubmit" disabled={completionPending} type="submit">{completionPending ? "Confirmando cierre..." : "Confirmar que he recibido la solución y cerrar caso"}</button>
            </form>
            {caseDetail.canReply && !isReportingSolutionProblem ? (
              <button className="storefrontAccountGhostButton" onClick={() => setIsReportingSolutionProblem(true)} type="button">
                Tengo un problema con la solución
              </button>
            ) : null}
          </div>
          {isReportingSolutionProblem ? (
            <div className="storefrontAfterSalesCompletionProblem">
              <p className="storefrontAfterSalesCompletionHint">
                Cuéntanos qué ha fallado o adjunta una prueba. Retomaremos la revisión del caso.
              </p>
              <button className="storefrontAccountGhostButton" onClick={() => setIsReportingSolutionProblem(false)} type="button">
                Cancelar
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="storefrontAccountEmpty storefrontAfterSalesResolutionSummary">
          <strong>{isClosed ? "Caso cerrado" : isResolved ? "Caso resuelto" : "Caso en gestión"}</strong>
          {caseDetail.resolutionOutcome ? <p>Resultado: {storefrontResolutionOutcomeLabel(caseDetail.resolutionOutcome)}.</p> : null}
          {caseDetail.resolutionReason ? <p>{caseDetail.resolutionReason}</p> : null}
          {isResolved ? <p>Puedes responder o aportar una imagen hasta {dateText(caseDetail.autoCloseAt ?? "")}. Si aportas información nueva, volveremos a revisarlo.</p> : null}
          {isClosed ? <p>El expediente, sus mensajes y sus imágenes permanecen disponibles como historial, pero ya no admite cambios.</p> : null}
        </section>
      )}
      {pendingProposal ? (
        <section className="storefrontAccountEmpty storefrontAfterSalesResolutionSummary" aria-label="Propuesta de solución">
          <strong>Propuesta de solución</strong>
          <p>{pendingProposal.customerMessage}</p>
          <p>{storefrontResolutionOutcomeLabel(pendingProposal.solutionType)}{pendingProposal.amountMinor !== null && pendingProposal.currency ? ` · ${moneyText(pendingProposal.amountMinor, pendingProposal.currency)}` : ""}.</p>
          <p>{pendingProposal.returnRequired ? `Devolución requerida${pendingProposal.returnShippingPaidBy === "STORE" ? "; el transporte lo asume la tienda." : "."}` : "No requiere devolución."} Responde antes del {dateText(pendingProposal.expiresAt)}.</p>
          <div className="storefrontAfterSalesHomeActions">
            <form action={proposalAction}><input name="caseId" type="hidden" value={caseDetail.caseId} /><input name="proposalId" type="hidden" value={pendingProposal.proposalId} /><input name="decision" type="hidden" value="ACCEPT" /><button className="storefrontAuthSubmit" disabled={proposalPending} type="submit">{proposalPending ? "Guardando..." : "Aceptar propuesta"}</button></form>
            <form action={proposalAction}><input name="caseId" type="hidden" value={caseDetail.caseId} /><input name="proposalId" type="hidden" value={pendingProposal.proposalId} /><input name="decision" type="hidden" value="REJECT" /><button className="storefrontAccountGhostButton" disabled={proposalPending} type="submit">Rechazar</button></form>
          </div>
        </section>
      ) : hibernatingProposal ? (
        <section className="storefrontAccountEmpty storefrontAfterSalesResolutionSummary" aria-label="Propuesta invernando"><strong>Propuesta en espera</strong><p>La propuesta anterior venció sin respuesta. Puedes escribirnos para retomar la revisión.</p></section>
      ) : null}
      <div className="afterSalesConversationThread storefrontAfterSalesConversationThread" aria-label="Historial de conversación" ref={conversationRef}>
        {[...caseDetail.messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt)).map((message) => {
          const isCustomer = message.author === "CUSTOMER";

          return (
            <article className={`afterSalesConversationMessage ${isCustomer ? "afterSalesConversationMessageCustomer" : "afterSalesConversationMessageTeam"}`} key={message.messageId}>
              <div className="afterSalesConversationMeta">
                <span aria-hidden="true" className="afterSalesConversationAvatar">
                  {isCustomer ? <UserRound size={12} /> : <Headphones size={12} />}
                </span>
                <div className="afterSalesConversationIdentity">
                  <strong>{isCustomer ? "Cliente" : "Equipo"}</strong>
                  {message.kind === "OPENING" ? <span>Mensaje inicial</span> : null}
                </div>
                <time dateTime={message.createdAt}>{dateTimeText(message.createdAt)}</time>
              </div>
              <p className="afterSalesConversationBubble">{message.body}</p>
            </article>
          );
        })}
      </div>
      {evidenceGallery}
      {canContinueCase ? (
        <>
          <form action={replyAction} className="storefrontAccountForm">
            <input name="caseId" type="hidden" value={caseDetail.caseId} />
            <label className="storefrontAuthField">
              <span>{requiresExplicitSolutionProblem ? "Cuéntanos qué ha fallado" : "Continuar el caso"}</span>
              <textarea minLength={2} name="body" placeholder={requiresExplicitSolutionProblem ? "Describe el problema para que podamos revisarlo." : "Añade una respuesta o información adicional."} required rows={3} />
            </label>
            <button className="storefrontAuthSubmit" disabled={replyPending} type="submit">{replyPending ? "Enviando..." : requiresExplicitSolutionProblem ? "Enviar problema" : "Enviar mensaje"}</button>
          </form>
          <form action={evidenceAction} className="storefrontAccountForm">
            <input name="caseId" type="hidden" value={caseDetail.caseId} />
            <label className="storefrontAuthField storefrontAfterSalesEvidenceUpload">
              <span>{requiresExplicitSolutionProblem ? "Adjuntar prueba del problema" : "Aportar imagen"}</span>
              <span className="storefrontAfterSalesFileTrigger"><CloudUpload aria-hidden="true" size={17} />{requiresExplicitSolutionProblem ? "Seleccionar prueba" : "Seleccionar imagen"}</span>
              <input
                accept="image/png,image/jpeg,image/webp"
                className="storefrontAfterSalesFileInput"
                disabled={evidenceQuotaReached}
                name="evidence"
                onChange={(event) => setSelectedEvidenceName(event.target.files?.[0]?.name ?? "")}
                required
                type="file"
              />
              {selectedEvidenceName ? <span className="storefrontAfterSalesSelectedFile">{selectedEvidenceName}</span> : null}
              <small>{evidenceCount} de 15 imágenes adjuntas al caso. PNG, JPG o WebP, máximo 10 MB; el servidor valida formato, cuota y seguridad antes de guardarla.</small>
            </label>
            <button className="storefrontAccountGhostButton" disabled={evidencePending || evidenceQuotaReached} type="submit">{evidenceQuotaReached ? "Límite de caso alcanzado" : evidencePending ? "Analizando imagen..." : "Adjuntar imagen"}</button>
          </form>
        </>
      ) : !caseDetail.canReply ? <p className="storefrontAccountEmpty">{isClosed ? "Este caso está cerrado y ya no admite mensajes ni evidencias." : "Este caso ya no admite más mensajes."}</p> : null}
      {activeEvidence ? (
        <div aria-label="Visor de imágenes aportadas" aria-modal="true" className="storefrontAfterSalesEvidenceLightbox" role="dialog">
          <button aria-label="Cerrar visor" className="storefrontAfterSalesEvidenceClose" onClick={() => setActiveEvidenceIndex(null)} type="button"><X aria-hidden="true" size={24} /></button>
          {evidenceCount > 1 ? <button aria-label="Ver imagen anterior" className="storefrontAfterSalesEvidencePrevious" onClick={() => setActiveEvidenceIndex((current) => current === null ? null : (current - 1 + evidenceCount) % evidenceCount)} type="button"><ChevronLeft aria-hidden="true" size={32} /></button> : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={`Evidencia aportada ${(activeEvidenceIndex ?? 0) + 1} de ${evidenceCount}`} className="storefrontAfterSalesEvidenceLightboxImage" src={`/account/after-sales/cases/${encodeURIComponent(caseDetail.caseId)}/evidences/${encodeURIComponent(activeEvidence.privateEvidenceId)}/content`} />
          {evidenceCount > 1 ? <button aria-label="Ver imagen siguiente" className="storefrontAfterSalesEvidenceNext" onClick={() => setActiveEvidenceIndex((current) => current === null ? null : (current + 1) % evidenceCount)} type="button"><ChevronRight aria-hidden="true" size={32} /></button> : null}
          <p>{(activeEvidenceIndex ?? 0) + 1} de {evidenceCount}</p>
        </div>
      ) : null}
    </div>
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

function sessionDeviceLabel(session: StorefrontDeviceSession) {
  if (session.device.deviceName?.trim()) {
    return session.device.deviceName.trim();
  }

  if (session.device.userAgent?.trim()) {
    return session.device.userAgent.trim().slice(0, 80);
  }

  return session.sessionId.length > 18
    ? `${session.sessionId.slice(0, 8)}...${session.sessionId.slice(-6)}`
    : session.sessionId;
}

function dateTimeText(value: string) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return "Fecha pendiente";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

function storefrontLifecycleLabel(status: StorefrontAfterSalesCaseDetail["lifecycleStatus"]) {
  if (status === "OPEN") return "Abierto";
  if (status === "IN_PROGRESS") return "En curso";
  if (status === "RESOLVED") return "Resuelto";
  return "Cerrado";
}

function storefrontResolutionOutcomeLabel(value: string) {
  const labels: Record<string, string> = {
    REFUND: "Reembolso",
    EXCHANGE: "Cambio",
    REPAIR: "Reparación",
    REPLACEMENT: "Reemplazo",
    STORE_CREDIT: "Crédito en tienda",
    REJECTED: "Solicitud rechazada",
    NO_ACTION: "Sin acción adicional",
    MIXED: "Resolución mixta",
  };
  return labels[value] ?? value;
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
