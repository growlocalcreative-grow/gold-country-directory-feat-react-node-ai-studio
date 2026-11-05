import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
} from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  MapPin,
  Search,
  Camera,
  Menu,
  X,
  Zap,
  Utensils,
  Hammer,
  ShoppingBag,
  Sparkles,
  Star,
  Heart,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Phone,
  Mail,
  Globe,
  MessageCircle,
  ShieldCheck,
  Pencil,
  Upload,
  User,
  Users,
  PawPrint,
  House,
  Wrench,
  Truck,
  Leaf,
  Share2,
  LockKeyhole,
  Scissors,
  TreePine,
  Flower2,
  Car,
  BriefcaseBusiness,
  Droplets,
  BadgeCheck,
  type LucideIcon,
} from "lucide-react";
import type { Business } from "../../shared/types";
import { errorMessage, RequestError, useApp } from "./api";
const icons: Record<string, LucideIcon> = {
  pin: MapPin,
  search: Search,
  camera: Camera,
  menu: Menu,
  close: X,
  bolt: Zap,
  utensils: Utensils,
  hammer: Hammer,
  bag: ShoppingBag,
  sparkles: Sparkles,
  star: Star,
  heart: Heart,
  arrow: ArrowRight,
  back: ArrowLeft,
  chevron: ChevronRight,
  phone: Phone,
  mail: Mail,
  globe: Globe,
  message: MessageCircle,
  shield: ShieldCheck,
  edit: Pencil,
  upload: Upload,
  user: User,
  users: Users,
  paw: PawPrint,
  house: House,
  wrench: Wrench,
  truck: Truck,
  leaf: Leaf,
  share: Share2,
  lock: LockKeyhole,
  scissors: Scissors,
  tree: TreePine,
  flower: Flower2,
  car: Car,
  briefcase: BriefcaseBusiness,
  Hammer,
  PawPrint,
  Car,
  Wrench,
  Truck,
  Droplets,
  Camera,
  Home: House,
  Leaf,
  Flower2,
  BadgeCheck,
};
export function Icon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const Glyph = icons[name] || ShoppingBag;
  return <Glyph className={`icon ${className}`} aria-hidden="true" />;
}
export function SearchForm({
  className = "",
  placeholder = "Search businesses...",
  label = "Search businesses",
}: {
  className?: string;
  placeholder?: string;
  label?: string;
}) {
  const [params] = useSearchParams(),
    navigate = useNavigate();
  return (
    <form
      className={`search-form ${className}`}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const q =
          new FormData(event.currentTarget).get("q")?.toString().trim() || "";
        navigate(`/Directory${q ? "?q=" + encodeURIComponent(q) : ""}`);
      }}
    >
      <Icon name="search" />
      <input
        key={params.get("q") || ""}
        type="search"
        name="q"
        defaultValue={params.get("q") || ""}
        placeholder={placeholder}
        aria-label={label}
      />
    </form>
  );
}
const primaryNavigation = [
  { to: "/Directory", label: "Browse" },
  { to: "/SuggestBusiness", label: "Add Your Business" },
  {
    to: "/SuggestBusiness?tab=scan",
    label: "Scan Card",
    feature: "ocr",
    icon: "camera",
  },
] as const;

function PrimaryNavigationLinks({ desktop = false }: { desktop?: boolean }) {
  const { session, loading, sessionError } = useApp(),
    location = useLocation();
  return primaryNavigation.map((item) => {
    // Only advertise optional capabilities confirmed by the current server session.
    if (
      "feature" in item &&
      (loading || sessionError || session?.features[item.feature] !== true)
    )
      return null;
    return (
      <Link
        key={item.to}
        to={item.to}
        className={
          desktop && item.to === "/Directory" && location.pathname === item.to
            ? "active"
            : undefined
        }
      >
        {desktop && "icon" in item && (
          <>
            <Icon name={item.icon} />{" "}
          </>
        )}
        {item.label}
      </Link>
    );
  });
}

export function Navigation() {
  const { session } = useApp(),
    location = useLocation(),
    [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location]);
  return (
    <nav className="site-nav" aria-label="Main navigation">
      <div className="nav-inner">
        <Link className="brand" to="/Directory">
          <Icon name="pin" />
          Gold Country Directory
        </Link>
        <SearchForm className="nav-search" />
        <div className="desktop-links">
          <PrimaryNavigationLinks desktop />
          {session?.user ? (
            <>
              <Link to="/MyFaves">My Faves</Link>
              <Link to="/account/">My Account</Link>
            </>
          ) : (
            <Link className="button nav-signin" to="/accounts/login/">
              Sign In
            </Link>
          )}
        </div>
        <button
          className="menu-button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
      </div>
      <div className="mobile-menu" id="mobile-menu" hidden={!open}>
        <SearchForm />
        <PrimaryNavigationLinks />
        <Link to="/About">About</Link>
        <Link to="/Contact">Contact</Link>
        {session?.user ? (
          <>
            <Link to="/MyFaves">My Faves</Link>
            <Link to="/account/">My Account</Link>
          </>
        ) : (
          <Link to="/accounts/login/">Sign In</Link>
        )}
      </div>
    </nav>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-band" />
      <div className="footer-copy">
        © {new Date().getFullYear()} Gold Country Directory · Built with care
        for the local community <span>·</span> <Link to="/About">About</Link>{" "}
        <span>·</span> <Link to="/Contact">Contact</Link> <span>·</span>{" "}
        <a href="mailto:growlocalcreative@gmail.com">Suggest an Edit</a>{" "}
        <span>·</span> <Link to="/Privacy">Privacy Policy</Link>
      </div>
    </footer>
  );
}
export function Hero({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <section className="hero form-hero">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      {children}
    </section>
  );
}
export function Loading({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="page-state" role="status">
      <span className="loading-mark" aria-hidden="true" />
      {text}
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="page-state panel" role="alert">
      <h2>We couldn't load this page</h2>
      <p>{errorMessage(error)}</p>
      {retry && (
        <button className="button" onClick={retry}>
          Try again
        </button>
      )}
      <Link to="/Directory">Back to Directory</Link>
    </div>
  );
}
export function FormError({ error }: { error: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) ref.current?.focus();
  }, [error]);
  if (!error) return null;
  const fields =
    error instanceof RequestError ? error.detail.error.fields : null;
  return (
    <div className="form-errors" role="alert" tabIndex={-1} ref={ref}>
      <p>{errorMessage(error)}</p>
      {fields && (
        <ul>
          {Object.entries(fields).map(([name, message]) => (
            <li key={name}>
              {name.replaceAll("_", " ")}: {message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export function Field({
  name,
  label,
  help,
  children,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  help?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`form-field field-${name}`}>
      <label htmlFor={`id_${name}`}>
        {label}
        {props.required ? "*" : ""}
      </label>
      {children || (
        <input
          id={`id_${name}`}
          name={name}
          aria-describedby={help ? `help_${name}` : undefined}
          {...props}
        />
      )}
      {help && (
        <small className="help-text" id={`help_${name}`}>
          {help}
        </small>
      )}
    </div>
  );
}
export function TextArea({
  name,
  label,
  required = false,
  defaultValue = "",
  rows = 5,
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <Field name={name} label={label} required={required}>
      <textarea
        name={name}
        id={`id_${name}`}
        required={required}
        defaultValue={defaultValue}
        rows={rows}
      />
    </Field>
  );
}
export function Submit({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <button className="button full-width" type="submit" disabled={busy}>
      {busy ? "Please wait…" : children}
    </button>
  );
}
export function RequireAuth({
  children,
  staff = false,
}: {
  children: ReactNode;
  staff?: boolean;
}) {
  const { session, loading, sessionError, reloadSession } = useApp(),
    location = useLocation();
  if (loading) return <Loading />;
  if (sessionError)
    return (
      <ErrorState error={sessionError} retry={() => void reloadSession()} />
    );
  if (!session?.user)
    return (
      <Navigate
        replace
        to={`/accounts/login/?next=${encodeURIComponent(location.pathname + location.search)}`}
      />
    );
  if (staff && !session.user.is_staff)
    return (
      <ErrorState error={new Error("Administrator access is required.")} />
    );
  return <>{children}</>;
}
export function Favorite({
  business,
  detail = false,
}: {
  business: Business;
  detail?: boolean;
}) {
  const { session, favorite, notify } = useApp(),
    location = useLocation(),
    [busy, setBusy] = useState(false);
  const saved = session?.favorites.includes(business.id) || false;
  if (!session?.user)
    return (
      <Link
        className={detail ? "" : "favorite-button"}
        to={`/accounts/login/?next=${encodeURIComponent(location.pathname + location.search)}`}
        aria-label={detail ? undefined : `Sign in to save ${business.name}`}
      >
        <Icon name="heart" />
        {detail ? "Save" : null}
      </Link>
    );
  return (
    <button
      className={`${detail ? "" : "favorite-button"} ${saved ? "saved" : ""}`}
      type="button"
      disabled={busy}
      aria-pressed={saved}
      aria-label={
        detail ? undefined : `${saved ? "Unsave" : "Save"} ${business.name}`
      }
      onClick={async () => {
        setBusy(true);
        try {
          await favorite(business.slug, business.id);
        } catch (error) {
          notify(errorMessage(error), { error: true });
        } finally {
          setBusy(false);
        }
      }}
    >
      <Icon name="heart" />
      {detail ? (saved ? "Saved" : "Save") : null}
    </button>
  );
}
export function BusinessCard({ business: b }: { business: Business }) {
  return (
    <article
      className={`business-card ${b.is_premium ? "premium" : b.verified ? "verified" : ""}`}
      data-business-card
    >
      <div className="card-top">
        <span className="category-badge">{b.category.name}</span>
        <Favorite business={b} />
      </div>
      <div className="card-title-line">
        <h3>
          <Link to={`/business/${b.slug}`}>{b.name}</Link>
        </h3>
        {b.verified && (
          <span className="badge verified-badge">
            <Icon name="shield" />
            Verified
          </span>
        )}
        {b.is_premium && (
          <span className="badge premium-badge">
            <Icon name="sparkles" />
            Premium
          </span>
        )}
      </div>
      {b.contact_person && <p className="card-contact">{b.contact_person}</p>}
      <div className="card-contact-links">
        {b.phones && (
          <a className="card-phone" href={`tel:${b.primary_phone}`}>
            <Icon name="phone" />
            <span>{b.display_phone || b.phones}</span>
          </a>
        )}
        {(b.address || b.city) && (
          <a
            className="card-location"
            href={mapsUrl(b)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="pin" />
            <span>{b.address || b.city}</span>
          </a>
        )}
      </div>
      <Link className="card-detail" to={`/business/${b.slug}`}>
        View Details <Icon name="arrow" />
      </Link>
    </article>
  );
}
export function mapsUrl(b: Business) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.name + " " + (b.address || b.city))}`;
}
export function ShareButton({
  className = "button button-light",
  children = "Share",
}: {
  className?: string;
  children?: ReactNode;
}) {
  const { notify } = useApp();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          if (navigator.share)
            await navigator.share({
              title: document.title,
              url: window.location.href,
            });
          else if (navigator.clipboard) {
            await navigator.clipboard.writeText(window.location.href);
            notify("Link copied to clipboard");
          } else window.prompt("Copy this link to share", window.location.href);
        } catch (error) {
          if ((error as Error).name !== "AbortError")
            window.prompt("Copy this link to share", window.location.href);
        }
      }}
    >
      <Icon name="share" />
      {children}
    </button>
  );
}
export function BackLink({
  to = "/Directory",
  children = "Back to Directory",
}: {
  to?: string;
  children?: ReactNode;
}) {
  return (
    <Link className="back-link" to={to}>
      <Icon name="back" />
      {children}
    </Link>
  );
}
/** Keep browser and client-rendered page metadata in sync with route changes. */
export function useTitle(title: string, description?: string) {
  useEffect(() => {
    document.title = `${title ? title + " | " : ""}Gold Country Directory`;
    const descriptions: Record<string, string> = {
      Directory:
        "Find local businesses, services, and trusted professionals in the Sierra Nevada Divide.",
      "My Faves": "Your saved local businesses in Gold Country Directory.",
      About:
        "Learn about the community-built Gold Country Directory for the Sierra Nevada Divide.",
      Contact:
        "Contact Gold Country Directory with questions, listing corrections, or partnership inquiries.",
      Privacy:
        "How Gold Country Directory collects, uses, and protects personal information.",
      "Add Your Business":
        "Suggest a local business for administrator review in Gold Country Directory.",
    };
    const content =
      description ||
      descriptions[title] ||
      "Your community business directory for the Sierra Nevada Divide. Find and support local businesses.";
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", content);
  }, [title, description]);
}

export function formValues(form: HTMLFormElement) {
  return Object.fromEntries(
    [...new FormData(form).entries()].filter(
      ([, value]) => typeof value === "string",
    ),
  ) as Record<string, string>;
}
export function safeNext(next: string | null) {
  return next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.includes("\\")
    ? next
    : "/account/";
}
