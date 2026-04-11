// app/app/(auth)/welcome/[token]/page.tsx
import { notFound } from "next/navigation";
import { getWaitlistByApprovalToken } from "@/lib/db/queries";
import { RegisterForm } from "@/components/auth/register-form";

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const entry = getWaitlistByApprovalToken(token);

  if (!entry) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-stone-800">Welcome to Koinar</h2>
        <p className="text-stone-500 text-sm mt-1.5">Your request has been approved. Create your account to get started.</p>
      </div>
      <RegisterForm
        name={entry.name}
        email={entry.email}
        welcomeToken={token}
      />
    </div>
  );
}
