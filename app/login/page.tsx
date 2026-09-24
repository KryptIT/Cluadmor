import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams;
  const error = params.error || "";

  const errorText =
    error === "google_not_configured"
      ? "Google OAuth is not configured on this deployment."
      : error === "discord_not_configured"
        ? "Discord OAuth is not configured on this deployment."
        : error
          ? "Sign-in failed. Check the OAuth redirect URL and provider credentials."
          : "";

  return (
    <main className="authPage">
      <section className="authPanel socialAuthPanel">
        <Link href="/" className="authBrand">
          <img src="/claudmor-mark.svg" alt="" />
          <div>
            <strong>Claudmor</strong>
            <span>workspace account</span>
          </div>
        </Link>

        <div className="authCopy socialAuthCopy">
          <h1>Sign in to Claudmor</h1>
          <p>Your services, keys, source files, protected builds, loaders, and telemetry stay in your own workspace.</p>
        </div>

        <div className="socialButtons">
          <a className="socialButton googleButton" href="/api/oauth/google/start">
            <span className="socialMark">G</span>
            <span>Continue with Google</span>
            <ArrowRight size={14}/>
          </a>

          <a className="socialButton discordButton" href="/api/oauth/discord/start">
            <span className="socialMark">D</span>
            <span>Continue with Discord</span>
            <ArrowRight size={14}/>
          </a>
        </div>

        {errorText && <div className="formError">{errorText}</div>}

        <div className="authSecurity">
          <ShieldCheck size={15}/>
          <span>No Claudmor password is stored. Authentication is handled by Google or Discord.</span>
        </div>

        <div className="authFoot">
          <Link href="/"><ArrowLeft size={13}/> Back to Claudmor</Link>
          <span>Owner bypass is enabled later from Settings.</span>
        </div>
      </section>
    </main>
  );
}
