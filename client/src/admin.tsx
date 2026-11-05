import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { post, useApi, useApp } from "./api";
import { ErrorState, FormError, Hero, Loading, useTitle } from "./components";
import { statusLabel } from "./account";
type Kind =
  "businesses" | "claims" | "reviews" | "suggestions" | "contacts" | "users";
interface RecordData {
  id: number;
  name?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  is_staff?: boolean;
  status?: string;
  resolved?: boolean;
  business?: { name: string; slug: string };
  category?: { name: string };
  user?: { email: string; first_name: string; last_name: string };
  [key: string]: unknown;
}
type AdminResponse = Record<Kind, RecordData[]> & {
  stats: Record<string, number>;
};
const labels: Record<Kind, string> = {
  businesses: "Listings",
  claims: "Ownership Requests",
  reviews: "Reviews",
  suggestions: "Suggestions",
  contacts: "Messages",
  users: "Accounts",
};
export function Admin() {
  useTitle("Manage Directory");
  const { data, error, loading, reload } = useApi<AdminResponse>("/api/admin"),
    { notify } = useApp();
  const [tab, setTab] = useState<Kind>("businesses"),
    [filter, setFilter] = useState("pending"),
    [search, setSearch] = useState(""),
    [importing, setImporting] = useState(false),
    [importFile, setImportFile] = useState<File | null>(null),
    [importError, setImportError] = useState<unknown>(null),
    [showImport, setShowImport] = useState(false);
  const items = useMemo(() => {
    return (data?.[tab] || []).filter((item) => {
      const status =
        tab === "contacts"
          ? item.resolved
            ? "approved"
            : "pending"
          : item.status;
      return (
        (tab === "users" || filter === "all" || status === filter) &&
        (!search ||
          JSON.stringify(item).toLowerCase().includes(search.toLowerCase()))
      );
    });
  }, [data, tab, filter, search]);
  return (
    <>
      <Hero
        title="Manage Directory"
        subtitle="Review submissions and keep the community directory up to date."
      />
      <div className="dashboard-column">
        <div className="account-tools">
          <Link to="/account/">My Account</Link>
          <Link to="/Directory">Browse Directory</Link>
          <Link to="/SuggestBusiness">Add Your Business</Link>
          <Link to="/AddByUrl">Add by Website</Link>
        </div>
        <div className="admin-tools">
          <a className="button button-light" href="/api/admin/export" download>
            Export directory data
          </a>
          <button
            className="button button-light"
            onClick={() => setShowImport(!showImport)}
            aria-expanded={showImport}
          >
            Import directory data
          </button>
        </div>
        {showImport && (
          <form
            className="panel standard-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!importFile) return;
              setImporting(true);
              setImportError(null);
              try {
                if (importFile.size > 25 * 1024 * 1024)
                  throw new Error("Choose a JSON export smaller than 25 MB.");
                const payload = JSON.parse(await importFile.text());
                const result = await post<{ message?: string }>(
                  "/api/admin/import",
                  { payload },
                );
                notify(result.message || "Directory import completed.");
                setShowImport(false);
                reload();
              } catch (error) {
                setImportError(error);
              } finally {
                setImporting(false);
              }
            }}
          >
            <h2>Import a directory export</h2>
            <p>
              Import a public seed or portable directory export. Source records
              are matched by their existing identifiers. Account access and
              ownership are not granted by imports.
            </p>
            <FormError error={importError} />
            <div className="form-field">
              <label htmlFor="import-file">Directory JSON file</label>
              <input
                id="import-file"
                type="file"
                accept="application/json,.json"
                required
                onChange={(event) =>
                  setImportFile(event.target.files?.[0] || null)
                }
              />
            </div>
            <button className="button" disabled={importing || !importFile}>
              {importing ? "Importing…" : "Import selected file"}
            </button>
          </form>
        )}
        {loading ? (
          <Loading text="Loading moderation queues…" />
        ) : error ? (
          <ErrorState error={error} retry={reload} />
        ) : (
          data && (
            <>
              <div
                className="admin-tabs"
                role="tablist"
                aria-label="Moderation queues"
              >
                {(Object.keys(labels) as Kind[]).map((kind) => (
                  <button
                    key={kind}
                    id={`tab-${kind}`}
                    role="tab"
                    aria-selected={tab === kind}
                    aria-controls="moderation-list"
                    onClick={() => {
                      setTab(kind);
                      setSearch("");
                      setFilter("pending");
                    }}
                  >
                    {labels[kind]} ({data[kind]?.length || 0})
                  </button>
                ))}
              </div>
              <div className="admin-filter">
                {tab !== "users" && (
                  <>
                    <label htmlFor="queue-status">Status</label>
                    <select
                      id="queue-status"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="pending">
                        {tab === "contacts" ? "Unresolved" : "Pending"}
                      </option>
                      <option value="approved">
                        {tab === "contacts" ? "Resolved" : "Approved"}
                      </option>
                      {tab !== "contacts" && (
                        <option value="rejected">Rejected</option>
                      )}
                      <option value="all">All</option>
                    </select>
                  </>
                )}
                <label className="sr-only" htmlFor="queue-search">
                  Search queue
                </label>
                <input
                  type="search"
                  id="queue-search"
                  placeholder="Search this queue…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span>
                  {items.length} {items.length === 1 ? "record" : "records"}
                </span>
              </div>
              <section
                className="panel"
                id="moderation-list"
                role="tabpanel"
                aria-labelledby={`tab-${tab}`}
              >
                <h2 className="admin-heading">{labels[tab]}</h2>
                {!items.length ? (
                  <p className="admin-empty">
                    No {filter === "pending" ? "pending " : ""}
                    {labels[tab].toLowerCase()} in this queue.
                  </p>
                ) : tab === "users" ? (
                  <div className="admin-users">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td>
                              {[item.first_name, item.last_name]
                                .filter(Boolean)
                                .join(" ") || "—"}
                            </td>
                            <td>{item.email}</td>
                            <td>
                              {item.is_staff ? "Administrator" : "Member"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  items.map((item) => (
                    <ModerationCard
                      key={`${tab}-${item.id}-${item.status}-${item.resolved}`}
                      kind={tab}
                      item={item}
                      onChange={reload}
                    />
                  ))
                )}
              </section>
            </>
          )
        )}
      </div>
    </>
  );
}
function ModerationCard({
  kind,
  item,
  onChange,
}: {
  kind: Exclude<Kind, "users">;
  item: RecordData;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notes, setNotes] = useState(
      typeof item.admin_notes === "string" ? item.admin_notes : "",
    ),
    [verified, setVerified] = useState(false),
    { notify } = useApp();
  const title = String(
    item.name ||
      item.business?.name ||
      item.subject ||
      item.source_url ||
      `${labels[kind]} #${item.id}`,
  );
  const currentStatus =
    kind === "contacts"
      ? item.resolved
        ? "approved"
        : "pending"
      : item.status || "pending";
  const fields =
    kind === "businesses"
      ? [
          "category",
          "contact_person",
          "phones",
          "email",
          "website",
          "address",
          "description",
          "premium_interest",
        ]
      : kind === "claims"
        ? ["user", "phone", "evidence"]
        : kind === "reviews"
          ? ["display_name", "rating", "body", "user"]
          : kind === "suggestions"
            ? ["kind", "name", "email", "source_url", "message"]
            : ["name", "email", "subject", "message"];
  async function moderate(status: "approved" | "rejected") {
    setBusy(true);
    setError(null);
    try {
      const response = await post<{ message?: string }>(
        `/api/admin/${kind}/${item.id}/moderate`,
        {
          status,
          admin_notes: notes,
          ...(kind === "claims" && status === "approved"
            ? { ownership_verified: verified }
            : {}),
          ...(kind === "contacts" ? { resolved: true } : {}),
        },
      );
      notify(
        response.message ||
          `${kind === "contacts" ? "Message resolved" : status === "approved" ? "Approved" : "Rejected"} successfully.`,
      );
      onChange();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="moderation-card">
      <div className="moderation-title">
        <h3>{title}</h3>
        <span className={`status-label status-${currentStatus}`}>
          {kind === "contacts"
            ? item.resolved
              ? "Resolved"
              : "Unresolved"
            : statusLabel(currentStatus)}
        </span>
      </div>
      {item.business && (
        <Link to={`/business/${item.business.slug}`}>View business →</Link>
      )}
      {kind === "businesses" && (
        <Link to={`/account/business/${item.id}/edit/`}>Edit Business →</Link>
      )}
      <dl className="moderation-fields">
        {fields.map((field) => {
          let value = item[field];
          if (field === "category") value = item.category?.name;
          if (field === "user") value = item.user?.email;
          if (value == null || value === "") return null;
          if (typeof value === "boolean") value = value ? "Yes" : "No";
          if (typeof value === "object") return null;
          return (
            <div className="moderation-field-pair" key={field}>
              <dt>{statusLabel(field.replaceAll("_", " "))}</dt>
              <dd>{String(value)}</dd>
            </div>
          );
        })}
      </dl>
      <FormError error={error} />
      <div className="standard-form moderation-note">
        <label htmlFor={`notes-${kind}-${item.id}`}>Administrator notes</label>
        <textarea
          id={`notes-${kind}-${item.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
      {kind === "claims" && currentStatus !== "approved" && (
        <label className="verify-checkbox">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
          />
          I have independently verified this person's ownership or authority to
          manage this business.
        </label>
      )}
      <div className="moderation-actions">
        {currentStatus !== "approved" && (
          <button
            className="button"
            disabled={busy || (kind === "claims" && !verified)}
            onClick={() => void moderate("approved")}
          >
            {kind === "contacts"
              ? "Mark resolved"
              : kind === "claims"
                ? "Approve ownership"
                : "Approve"}
          </button>
        )}
        {kind !== "contacts" && currentStatus !== "rejected" && (
          <button
            className="button button-light"
            disabled={busy}
            onClick={() => void moderate("rejected")}
          >
            Reject
          </button>
        )}
      </div>
    </article>
  );
}
