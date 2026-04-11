// app/app/(auth)/login/page.tsx
// Login is now embedded in the landing page — redirect there.
import { redirect } from "next/navigation";

export default function LoginPage() {
  redirect("/");
}
