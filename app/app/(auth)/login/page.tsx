// app/app/(auth)/login/page.tsx
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <>
      <h2 className="text-xl font-medium text-stone-800 mb-6">Welcome back</h2>
      <LoginForm />
    </>
  );
}
