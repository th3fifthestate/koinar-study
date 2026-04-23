export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Brief 24: Next 16.2.x Turbopack cold-start does not reliably source .env
    // before server modules initialize, leaving ANTHROPIC_API_KEY empty at runtime.
    // instrumentation.ts runs before any route handler and before module evaluation.
    const { config } = await import("dotenv");
    config({ path: ".env" });
  }
}
