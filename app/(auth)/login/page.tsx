import { login } from "@/app/actions/auth";
import { AuthForm } from "@/components/AuthForm";
import { registrationAllowed } from "@/lib/auth";

// Zur Laufzeit rendern, damit ALLOW_REGISTRATION ohne neuen Build wirkt.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <AuthForm mode="login" action={login} registrationOpen={registrationAllowed()} />;
}
