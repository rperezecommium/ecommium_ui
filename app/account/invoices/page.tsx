import { redirect } from "next/navigation";

export default function AccountInvoicesPage() {
  redirect("/account?section=invoices");
}
