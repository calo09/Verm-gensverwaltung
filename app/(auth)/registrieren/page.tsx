import { redirect } from "next/navigation";
import { register } from "@/app/actions/auth";
import { AuthForm } from "@/components/AuthForm";
import { registrationAllowed } from "@/lib/auth";

// Zur Laufzeit rendern, damit ALLOW_REGISTRATION ohne neuen Build wirkt.
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  if (!registrationAllowed()) redirect("/login");
  return <AuthForm mode="register" action={register} />;
}
