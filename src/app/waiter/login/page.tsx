import { redirect } from "next/navigation";

/** ログイン機能は廃止 */
export default function WaiterLoginPage() {
  redirect("/waiter");
}
