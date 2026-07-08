import { isGateConfigured } from "@/lib/site-gate"
import { GateForm } from "./gate-form"
import { Lock } from "lucide-react"

// The unlock screen. Rendered by middleware redirect for any locked route.
// Server component so it can read whether SITE_PASSWORD is configured
// without exposing the value to the client.
export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const configured = isGateConfigured()

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-foreground text-background flex items-center justify-center mb-4">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-balance">Postage Plus</h1>
          <p className="text-sm text-muted-foreground mt-1 text-pretty">
            This site is password protected. Enter the password to continue.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {configured ? (
            <GateForm next={next} />
          ) : (
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground">Password not configured</p>
              <p>
                Set the <code className="px-1 py-0.5 rounded bg-muted text-foreground text-[12px]">SITE_PASSWORD</code>{" "}
                environment variable, then reload this page to unlock access.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-muted-foreground/70 mt-4">
          Access is remembered on this device for 30 days.
        </p>
      </div>
    </main>
  )
}
