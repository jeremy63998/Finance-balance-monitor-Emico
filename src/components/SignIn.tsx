import { useState } from "react";
import { useSession } from "@/lib/session-context";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ShieldCheck } from "lucide-react";

export function SignIn() {
  const { signInWithGoogle, signOut, status, session } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err?.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  const blocked = status === "forbidden";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Workspace sign-in
          </div>
          <CardTitle className="mt-2">Finance Balance Monitor</CardTitle>
          <CardDescription>
            Sign in with your <span className="font-medium">@{ALLOWED_EMAIL_DOMAIN}</span> Google Workspace
            account. Other accounts are not permitted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {blocked && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {session.email} does not have access to this app. It is either not an @
                {ALLOWED_EMAIL_DOMAIN} account, or its access has been revoked.
              </span>

            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {blocked ? (
            <Button variant="outline" className="w-full" onClick={() => signOut()}>
              Sign out
            </Button>
          ) : (
            <Button className="w-full" onClick={connect} disabled={busy}>
              {busy ? "Opening Google…" : "Continue with Google"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
