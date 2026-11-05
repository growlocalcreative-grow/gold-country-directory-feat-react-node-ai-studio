import { useState, type ReactNode } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import type { Business, Review, Session } from "../../shared/types";
import { post, useApi, useApp } from "./api";
import {
  BusinessCard,
  ErrorState,
  Field,
  FormError,
  Hero,
  Icon,
  Loading,
  Submit,
  formValues,
  safeNext,
  useTitle,
} from "./components";
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="auth-card">
      <Link to="/Home" aria-label="Gold Country Directory home">
        <img
          className="auth-logo"
          src="/static/images/logo.png"
          alt="Gold Country Directory"
        />
      </Link>
      {children}
    </div>
  );
}
function GoogleButton({ link = false }: { link?: boolean }) {
  const { session } = useApp(),
    [params] = useSearchParams(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  return (
    <div className="google-signin">
      <button
        className="google-button"
        type="button"
        disabled={!session?.features.google || busy}
        aria-describedby={
          !session?.features.google ? "google-status" : undefined
        }
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const result = await post<{ url: string }>(
              "/api/auth/google/start",
              { next: safeNext(params.get("next")), link },
            );
            window.location.assign(result.url);
          } catch (error) {
            setError(error);
            setBusy(false);
          }
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.04.97-3.38.97-2.6 0-4.81-1.76-5.6-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
          />
          <path
            fill="#FBBC05"
            d="M6.4 13.93A6 6 0 0 1 6.09 12c0-.67.12-1.32.31-1.93V7.48H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.52l3.33-2.59Z"
          />
          <path
            fill="#EA4335"
            d="M12 5.95c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.48l3.33 2.59C7.19 7.71 9.4 5.95 12 5.95Z"
          />
        </svg>
        {busy
          ? "Connecting…"
          : link
            ? "Link Google account"
            : "Continue with Google"}
      </button>
      {!session?.features.google && (
        <small id="google-status">
          Google sign-in is not configured on this host yet. You can sign in
          with email below.
        </small>
      )}
      <FormError error={error} />
    </div>
  );
}
export function Login() {
  useTitle("Sign In");
  const { session, setSession, loading, notify } = useApp(),
    navigate = useNavigate(),
    [params] = useSearchParams(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  if (session?.user)
    return <Navigate replace to={safeNext(params.get("next"))} />;
  return (
    <AuthFrame>
      <h1>
        Welcome to Gold
        <br />
        Country Directory
      </h1>
      <p className="auth-subtitle">Sign in to continue</p>
      {params.get("error") && (
        <p className="form-errors" role="alert">
          Google sign-in could not be completed. Please sign in with email or
          try again.
        </p>
      )}
      <GoogleButton />
      <div className="auth-divider">
        <span>OR</span>
      </div>
      <form
        className="standard-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const s = await post<Session>(
              "/api/auth/login",
              formValues(event.currentTarget),
            );
            setSession(s);
            const destination = safeNext(params.get("next"));
            notify("You are signed in.", { destination });
            navigate(destination, { replace: true });
          } catch (error) {
            setError(error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <FormError error={error} />
        <Field name="email" label="Email" required>
          <div className="auth-input">
            <Icon name="mail" />
            <input
              type="email"
              id="id_email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              maxLength={254}
            />
          </div>
        </Field>
        <Field name="password" label="Password" required>
          <div className="auth-input">
            <Icon name="lock" />
            <input
              type="password"
              id="id_password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>
        </Field>
        <Submit busy={busy || loading}>Sign in</Submit>
      </form>
      <div className="auth-links">
        <Link to="/accounts/password_reset/">Forgot password?</Link>
        <Link to="/accounts/signup/">Need an account? Sign up</Link>
      </div>
    </AuthFrame>
  );
}
export function Signup() {
  useTitle("Sign Up");
  const { session, setSession, loading, notify } = useApp(),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  if (session?.user) return <Navigate replace to="/account/" />;
  return (
    <AuthFrame>
      <h1>Create your account</h1>
      <p className="auth-subtitle">Join Gold Country Directory</p>
      <form
        className="standard-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const s = await post<Session>(
              "/api/auth/signup",
              formValues(event.currentTarget),
            );
            setSession(s);
            notify("Your account is ready.", { destination: "/account/" });
            navigate("/account/", { replace: true });
          } catch (error) {
            setError(error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <FormError error={error} />
        <Field name="first_name" label="First name" autoComplete="given-name" />
        <Field name="last_name" label="Last name" autoComplete="family-name" />
        <Field
          name="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
        />
        <Field
          name="password"
          label="Password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          help="Use at least 12 characters. Avoid common passwords and personal information."
        />
        <Field
          name="password_confirm"
          label="Password confirmation"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
        />
        <Submit busy={busy || loading}>Sign up</Submit>
      </form>
      <Link className="auth-back" to="/accounts/login/">
        Already have an account? Sign in
      </Link>
    </AuthFrame>
  );
}
export function PasswordReset() {
  useTitle("Reset Password");
  const { loading } = useApp(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [sent, setSent] = useState("");
  return (
    <AuthFrame>
      <h1>Reset your password</h1>
      <p className="auth-subtitle">Enter the email address for your account.</p>
      {sent ? (
        <div className="inline-success" role="status">
          {sent}
        </div>
      ) : (
        <form
          className="standard-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const r = await post<{ message: string }>(
                "/api/auth/password-reset",
                formValues(event.currentTarget),
              );
              setSent(r.message);
            } catch (error) {
              setError(error);
            } finally {
              setBusy(false);
            }
          }}
        >
          <FormError error={error} />
          <Field
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
          />
          <Submit busy={busy || loading}>Send reset link</Submit>
        </form>
      )}
      <Link className="auth-back" to="/accounts/login/">
        Back to sign in
      </Link>
    </AuthFrame>
  );
}
export function PasswordConfirm() {
  useTitle("Choose a New Password");
  const { token } = useParams(),
    { loading, reloadSession } = useApp(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [sent, setSent] = useState("");
  return (
    <AuthFrame>
      <h1>Choose a new password</h1>
      <p className="auth-subtitle">Enter your new password below.</p>
      {sent ? (
        <div className="inline-success" role="status">
          {sent}
        </div>
      ) : (
        <form
          className="standard-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const r = await post<{ message: string }>(
                "/api/auth/password-reset/confirm",
                { ...formValues(event.currentTarget), token },
              );
              await reloadSession();
              setSent(r.message);
            } catch (error) {
              setError(error);
            } finally {
              setBusy(false);
            }
          }}
        >
          <FormError error={error} />
          <Field
            name="password"
            label="New password"
            type="password"
            minLength={12}
            required
            autoComplete="new-password"
          />
          <Field
            name="password_confirm"
            label="New password confirmation"
            type="password"
            minLength={12}
            required
            autoComplete="new-password"
          />
          <Submit busy={busy || loading}>Set new password</Submit>
        </form>
      )}
      <Link className="auth-back" to="/accounts/login/">
        Back to sign in
      </Link>
    </AuthFrame>
  );
}
export function PasswordChange() {
  useTitle("Change Password");
  const { setSession, notify } = useApp(),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  return (
    <AuthFrame>
      <h1>Change your password</h1>
      <p className="auth-subtitle">Keep your account secure.</p>
      <form
        className="standard-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const s = await post<Session>(
              "/api/auth/password-change",
              formValues(event.currentTarget),
            );
            setSession(s);
            notify("Your password has been changed.", {
              destination: "/account/",
            });
            navigate("/account/");
          } catch (error) {
            setError(error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <FormError error={error} />
        <Field
          name="current_password"
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Field
          name="password"
          label="New password"
          type="password"
          minLength={12}
          required
          autoComplete="new-password"
        />
        <Field
          name="password_confirm"
          label="New password confirmation"
          type="password"
          minLength={12}
          required
          autoComplete="new-password"
        />
        <Submit busy={busy}>Change password</Submit>
      </form>
      <Link className="auth-back" to="/account/">
        Back to My Account
      </Link>
    </AuthFrame>
  );
}
interface Claim {
  id: number;
  business: Business;
  status: string;
  evidence: string;
}
interface Submission {
  id: number;
  source_url: string;
  message: string;
  kind: string;
  status: string;
  business?: Business;
}
interface AccountResponse {
  businesses: Business[];
  pending_claims: Claim[];
  favorites: Business[];
  my_reviews: Review[];
  submissions: Submission[];
}
export function Account() {
  useTitle("My Account");
  const { session, setSession, notify } = useApp(),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const account = useApi<AccountResponse>("/api/account");
  const user = session?.user;
  return (
    <>
      <Hero
        title="My Account"
        subtitle={
          [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
          user?.email
        }
      />
      <div className="dashboard-column">
        <div className="account-tools">
          <Link to="/MyFaves">My Faves</Link>
          <Link to="/accounts/password_change/">Change password</Link>
          {user?.is_staff && <Link to="/AdminDashboard">Manage directory</Link>}
          <form
            className="inline-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const s = await post<Session>("/api/auth/logout");
                setSession(s);
                notify("You are signed out.", { destination: "/Home" });
                navigate("/Home");
              } catch (error) {
                setError(error);
              } finally {
                setBusy(false);
              }
            }}
          >
            <button disabled={busy}>Sign out</button>
          </form>
        </div>
        <FormError error={error} />
        {session?.features.google && (
          <section className="panel">
            <h2>Google sign-in</h2>
            <p>Connect your Google account to this signed-in account.</p>
            <GoogleButton link />
          </section>
        )}
        {account.loading ? (
          <Loading />
        ) : account.error ? (
          <ErrorState error={account.error} retry={account.reload} />
        ) : (
          account.data && (
            <>
              <section className="panel">
                <div className="dashboard-heading">
                  <h2>My Businesses</h2>
                  <Link className="button" to="/SuggestBusiness">
                    + Add Your Business
                  </Link>
                </div>
                {account.data.businesses.map((b) => (
                  <div className="dashboard-row" key={b.id}>
                    <div>
                      <strong>{b.name}</strong>
                      <small>{statusLabel(b.status)}</small>
                      {b.status === "approved" && (
                        <Link to={`/business/${b.slug}`}>View listing →</Link>
                      )}
                    </div>
                    {(b.can_edit ||
                      user?.is_staff ||
                      b.owner_id === user?.id ||
                      (b.status === "pending" &&
                        b.submitted_by === user?.id)) && (
                      <Link
                        className="button button-light"
                        to={`/account/business/${b.id}/edit/`}
                      >
                        {b.status === "pending" &&
                        b.owner_id !== user?.id &&
                        !user?.is_staff
                          ? "Edit Submission"
                          : "Edit Business"}
                      </Link>
                    )}
                  </div>
                ))}
                {!account.data.businesses.length && (
                  <p>
                    You haven't added or claimed a business yet. Find your
                    business in the directory to request ownership.
                  </p>
                )}
              </section>
              <section className="panel">
                <h2>My Ownership Requests</h2>
                {account.data.pending_claims.map((c) => (
                  <div className="dashboard-row" key={c.id}>
                    <Link to={`/business/${c.business.slug}`}>
                      {c.business.name}
                    </Link>
                    <span>{statusLabel(c.status)}</span>
                  </div>
                ))}
                {!account.data.pending_claims.length && (
                  <p>No ownership requests yet.</p>
                )}
              </section>
              <section className="panel">
                <h2>My Reviews</h2>
                {account.data.my_reviews.map((r) => (
                  <div className="dashboard-row" key={r.id}>
                    <div>
                      {r.business && (
                        <Link to={`/business/${r.business.slug}`}>
                          {r.business.name}
                        </Link>
                      )}
                      <p>{r.body}</p>
                    </div>
                    <span>{statusLabel(r.status)}</span>
                  </div>
                ))}
                {!account.data.my_reviews.length && (
                  <p>You haven't left a review yet.</p>
                )}
              </section>
              {account.data.submissions.length > 0 && (
                <section className="panel">
                  <h2>My Suggestions</h2>
                  {account.data.submissions.map((s) => (
                    <div className="dashboard-row" key={s.id}>
                      <div>
                        <strong>
                          {s.business?.name ||
                            s.source_url ||
                            statusLabel(s.kind)}
                        </strong>
                        <p>{s.message}</p>
                      </div>
                      <span>{statusLabel(s.status)}</span>
                    </div>
                  ))}
                </section>
              )}
              <section className="panel">
                <h2>My Faves</h2>
                <div className="business-grid">
                  {account.data.favorites
                    .filter((b) => session?.favorites.includes(b.id))
                    .map((b) => (
                      <BusinessCard key={b.id} business={b} />
                    ))}
                </div>
                {!account.data.favorites.filter((b) =>
                  session?.favorites.includes(b.id),
                ).length && <p>Your saved businesses will appear here.</p>}
              </section>
            </>
          )
        )}
      </div>
    </>
  );
}
export function statusLabel(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : "";
}
