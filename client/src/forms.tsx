import { useEffect, useState, type FormEvent } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import type { Business, Category } from "../../shared/types";
import { api, post, RequestError, useApi, useApp } from "./api";
import {
  BackLink,
  ErrorState,
  Field,
  FormError,
  Hero,
  Icon,
  Loading,
  Submit,
  TextArea,
  formValues,
  useTitle,
} from "./components";
export function BusinessFormPage({ edit = false }: { edit?: boolean }) {
  const { id } = useParams(),
    [params] = useSearchParams(),
    location = useLocation(),
    navigate = useNavigate(),
    { session, loading: sessionLoading, sessionError, notify } = useApp();
  const categories = useApi<{ categories: Category[] }>("/api/categories"),
    existing = useApi<{ business: Business }>(
      edit ? `/api/account/businesses/${id}` : null,
    );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [duplicates, setDuplicates] = useState<Business[]>([]),
    [fileLabel, setFileLabel] = useState("Click to upload an image"),
    [uploadKey, setUploadKey] = useState<string | null>(null);
  useTitle(edit ? "Edit Business" : "Add Your Business");
  const scan = !edit && params.get("tab") === "scan";
  const draft = (location.state as { draft?: Partial<Business> } | null)?.draft;
  const initial = existing.data?.business || draft;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      values = formValues(form),
      file = (form.elements.namedItem("image") as HTMLInputElement)?.files?.[0];
    setBusy(true);
    setError(null);
    try {
      let image = uploadKey;
      if (file && !image) {
        const body = new FormData();
        body.append("image", file);
        const upload = await api<{ key: string }>("/api/uploads", {
          method: "POST",
          body,
        });
        image = upload.key;
        setUploadKey(image);
      }
      const payload = {
        ...values,
        category_id: Number(values.category_id),
        premium_interest: values.premium_interest === "on",
        ...(image ? { image } : {}),
        confirm_separate: duplicates.length > 0,
      };
      const result = await api<{ business: Business; message: string }>(
        edit ? `/api/account/businesses/${id}` : "/api/businesses",
        { method: edit ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      const destination = session?.user ? "/account/" : "/Home";
      notify(result.message, { destination });
      navigate(destination);
    } catch (error) {
      setError(error);
      if (error instanceof RequestError && error.detail.duplicates)
        setDuplicates(error.detail.duplicates);
    } finally {
      setBusy(false);
    }
  }
  if (edit && existing.loading) return <Loading />;
  if (edit && existing.error)
    return <ErrorState error={existing.error} retry={existing.reload} />;
  return (
    <>
      <Hero
        title={edit ? "Edit Your Business" : "Add Your Business"}
        subtitle={
          edit
            ? initial?.name
            : "Know a local business? Submit it for admin review."
        }
      />
      <div className="form-column">
        <BackLink to={edit ? "/account/" : "/Directory"}>
          {edit ? "Back to My Account" : "Back to Directory"}
        </BackLink>
        {!edit && (
          <nav className="form-tabs" aria-label="Submission method">
            <Link to="/SuggestBusiness" className={!scan ? "selected" : ""}>
              <Icon name="edit" />
              Manual Form
            </Link>
            {!sessionLoading &&
              !sessionError &&
              session?.features.ocr === true && (
                <Link
                  to="/SuggestBusiness?tab=scan"
                  className={scan ? "selected" : ""}
                >
                  <Icon name="camera" />
                  Scan Card
                </Link>
              )}
          </nav>
        )}
        {scan ? (
          <ScanPanel />
        ) : categories.loading ? (
          <Loading text="Loading categories…" />
        ) : categories.error ? (
          <ErrorState error={categories.error} retry={categories.reload} />
        ) : (
          <form
            key={initial?.id || "new"}
            className={`panel standard-form ${edit ? "edit-business" : ""}`}
            onSubmit={submit}
          >
            <FormError error={error} />
            {draft && (
              <p className="inline-success">
                Website details have been filled in as a draft. Please check
                every field before submitting.
              </p>
            )}
            {duplicates.length > 0 && (
              <section className="duplicate-notice">
                <h2>Possible duplicate found</h2>
                <p>
                  A listing with the same phone, email, or website may already
                  exist. Take a look before submitting.
                </p>
                {duplicates.map((b) => (
                  <div className="duplicate-card" key={b.id}>
                    <Link to={`/business/${b.slug}`} target="_blank">
                      <strong>{b.name}</strong>
                      <small>
                        {b.category.name} ·{" "}
                        {b.display_phone || b.email || b.website}
                      </small>
                    </Link>
                    <Link to={`/business/${b.slug}/merge`}>
                      It's the same — tell the admin
                    </Link>
                  </div>
                ))}
                <p className="help-text">
                  If this is a separate business, review the details below and
                  confirm your submission.
                </p>
              </section>
            )}
            <Field
              name="name"
              label="Business name"
              required
              maxLength={200}
              defaultValue={initial?.name || ""}
            />
            <Field name="category_id" label="Category" required>
              <select
                id="id_category_id"
                name="category_id"
                required
                defaultValue={initial?.category_id || ""}
              >
                <option value="">Select a category...</option>
                {categories.data?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              name="contact_person"
              label="Contact Person"
              maxLength={200}
              defaultValue={initial?.contact_person || ""}
            />
            <Field
              name="phones"
              label="Phone(s)"
              defaultValue={initial?.phones || ""}
            />
            <h3 className="address-heading">Location / Address</h3>
            <Field
              name="address_street"
              label="Street address"
              placeholder="123 Main St"
              defaultValue={initial?.address_street || ""}
            />
            <Field
              name="address_unit"
              label="Unit / Suite"
              placeholder="Suite B"
              defaultValue={initial?.address_unit || ""}
            />
            <Field
              name="city"
              label="City"
              placeholder="Cool"
              defaultValue={initial?.city || ""}
            />
            <Field
              name="address_state"
              label="State"
              placeholder="CA"
              defaultValue={initial?.address_state || ""}
            />
            <Field
              name="address_zip"
              label="ZIP code"
              placeholder="95614"
              defaultValue={initial?.address_zip || ""}
            />
            <Field
              name="license"
              label="License"
              defaultValue={initial?.license || ""}
            />
            <Field
              name="email"
              label="Email"
              type="email"
              defaultValue={initial?.email || ""}
            />
            <Field
              name="website"
              label="Website"
              type="url"
              placeholder="https://"
              defaultValue={initial?.website || ""}
            />
            <TextArea
              name="description"
              label="Services / Specialties"
              rows={3}
              defaultValue={initial?.description || ""}
            />
            <div className="form-field checkbox-field field-premium_interest">
              <input
                id="id_premium_interest"
                name="premium_interest"
                type="checkbox"
                defaultChecked={initial?.premium_interest || false}
              />
              <label htmlFor="id_premium_interest">
                ⭐ I'm interested in a Featured Listing
              </label>
              <small className="help-text">
                Featured listings appear prominently at the top of the directory
                with a highlighted border and star badge. An admin will contact
                you with pricing details.
              </small>
            </div>
            <div className="form-field field-image">
              <label htmlFor="id_image">Business Photo (optional)</label>
              {initial?.display_image_url && (
                <p className="help-text">
                  Current photo is kept unless you upload a replacement.
                </p>
              )}
              <label className="file-drop" htmlFor="id_image">
                <Icon name="upload" />
                <span className="file-preview-label">{fileLabel}</span>
                <input
                  type="file"
                  id="id_image"
                  name="image"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    setUploadKey(null);
                    setFileLabel(
                      event.target.files?.[0]?.name ||
                        "Click to upload an image",
                    );
                  }}
                />
              </label>
              <small className="help-text">
                JPEG, PNG or WebP; up to 5 MB.
              </small>
            </div>
            <Submit busy={busy}>
              {edit
                ? "Save Changes"
                : duplicates.length
                  ? "It's different — submit as new listing"
                  : "Request to Add Business"}
            </Submit>
          </form>
        )}
      </div>
    </>
  );
}
function ScanPanel() {
  const [preview, setPreview] = useState(""),
    [selected, setSelected] = useState<File | null>(null),
    [error, setError] = useState<unknown>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  return (
    <section className="panel scan-panel">
      <div className="standard-form">
        <label className="scan-upload" htmlFor="card-image">
          <span className="scan-icon">
            <Icon name="camera" />
          </span>
          <strong>Snap or upload a business card</strong>
          <small>Use your camera on mobile or browse on desktop.</small>
          <input
            type="file"
            id="card-image"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setError(null);
              if (file && file.size > 5 * 1024 * 1024) {
                setError(
                  new Error("Please choose an image smaller than 5 MB."),
                );
                return;
              }
              setSelected(file || null);
              setPreview(file ? URL.createObjectURL(file) : "");
            }}
          />
        </label>
        <FormError error={error} />
        {selected && preview && (
          <img
            className="scan-preview"
            src={preview}
            alt="Your selected business card"
          />
        )}
        <div className="manual-scan-note">
          <h2>Enter the card details manually</h2>
          <p>
            Automatic card recognition is not configured on this host. You can
            still add the business using the manual form and upload its photo.
          </p>
          <Link className="button full-width" to="/SuggestBusiness">
            Continue with Manual Form
          </Link>
        </div>
      </div>
    </section>
  );
}
export function LegacyEdit() {
  const [params] = useSearchParams();
  const sourceId = params.get("id") || params.get("businessId") || "missing";
  const { data, error, loading, reload } = useApi<{ business: Business }>(
    `/api/businesses/by-source/${encodeURIComponent(sourceId)}`,
  );
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;
  return data ? (
    <Navigate replace to={`/account/business/${data.business.id}/edit/`} />
  ) : null;
}
export function BusinessRequest({
  kind,
}: {
  kind: "claim" | "edit" | "remove" | "merge";
}) {
  const { slug } = useParams(),
    navigate = useNavigate(),
    { notify, session } = useApp();
  const { data, error, loading, reload } = useApi<{ business: Business }>(
    `/api/businesses/${encodeURIComponent(slug || "")}`,
  );
  const [busy, setBusy] = useState(false),
    [formError, setError] = useState<unknown>(null);
  const title = {
    claim: "Claim Your Business",
    edit: "Suggest an Edit",
    remove: "Request Removal",
    merge: "Report a Duplicate",
  }[kind];
  useTitle(title);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;
  if (!data) return null;
  const b = data.business;
  return (
    <>
      <Hero title={title} subtitle={b.name} />
      <div className="form-column">
        <BackLink to={`/business/${b.slug}`}>Back to listing</BackLink>
        {kind === "claim" && (
          <div className="panel">
            <p>
              An administrator will verify your connection to this business
              before granting editing access.
            </p>
          </div>
        )}
        <form
          className="panel standard-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const values = formValues(event.currentTarget);
              const result = await post<{ message: string }>(
                `/api/businesses/${b.slug}/${kind === "claim" ? "claims" : "suggestions"}`,
                { ...values, kind },
              );
              const destination =
                kind === "claim" ? "/account/" : `/business/${b.slug}`;
              notify(result.message, { destination });
              navigate(destination);
            } catch (error) {
              setError(error);
            } finally {
              setBusy(false);
            }
          }}
        >
          <FormError error={formError} />
          {kind === "claim" ? (
            <>
              <Field name="phone" label="Phone" type="tel" />
              <TextArea
                name="evidence"
                label="Evidence of ownership"
                required
              />
            </>
          ) : (
            <>
              <Field
                name="name"
                label="Name"
                required
                defaultValue={[
                  session?.user?.first_name,
                  session?.user?.last_name,
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
              <Field
                name="email"
                label="Email"
                type="email"
                required
                defaultValue={session?.user?.email || ""}
              />
              <TextArea
                name="message"
                label={
                  kind === "edit"
                    ? "What should we change?"
                    : kind === "remove"
                      ? "Why should this listing be removed?"
                      : "Tell us about the duplicate"
                }
                required
              />
              <Honeypot />
            </>
          )}
          <Submit busy={busy}>
            {kind === "claim" ? "Request Ownership" : "Submit for Review"}
          </Submit>
        </form>
      </div>
    </>
  );
}
export function Honeypot() {
  return (
    <div className="honeypot" aria-hidden="true">
      <label htmlFor="id_company_website">Leave this field empty</label>
      <input
        id="id_company_website"
        name="company_website"
        type="text"
        autoComplete="off"
        tabIndex={-1}
      />
    </div>
  );
}
export function AddByUrl() {
  useTitle("Add by Website");
  const { session, notify } = useApp(),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false),
    [extracting, setExtracting] = useState(false),
    [error, setError] = useState<unknown>(null),
    [extractError, setExtractError] = useState<unknown>(null);
  return (
    <>
      <Hero
        title="Add a Business by Website"
        subtitle="Submit a business website for review."
      />
      <div className="form-column">
        <BackLink />
        {session?.user?.is_staff && (
          <form
            className="panel standard-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setExtracting(true);
              setExtractError(null);
              try {
                const r = await post<{
                  draft: Partial<Business>;
                  message: string;
                }>("/api/account/extract-url", formValues(event.currentTarget));
                notify(r.message, { destination: "/SuggestBusiness" });
                navigate("/SuggestBusiness", { state: { draft: r.draft } });
              } catch (error) {
                setExtractError(error);
              } finally {
                setExtracting(false);
              }
            }}
          >
            <h2>Extract a Business Draft</h2>
            <p>
              Read the business details from its website, then review before
              submitting.
            </p>
            <FormError error={extractError} />
            <Field
              name="source_url"
              label="Business Website"
              type="url"
              required
              placeholder="https://"
            />
            <Submit busy={extracting}>Extract Draft</Submit>
          </form>
        )}
        <form
          className="panel standard-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const r = await post<{ message: string }>(
                "/api/suggestions/url",
                formValues(event.currentTarget),
              );
              notify(r.message, { destination: "/Home" });
              navigate("/Home");
            } catch (error) {
              setError(error);
            } finally {
              setBusy(false);
            }
          }}
        >
          <FormError error={error} />
          <Field
            name="source_url"
            label="Business Website"
            type="url"
            required
            placeholder="https://"
          />
          <Field name="name" label="Name" required />
          <Field name="email" label="Email" type="email" required />
          <TextArea
            name="message"
            label="Business name and anything else we should know"
            required
          />
          <Honeypot />
          <Submit busy={busy}>Submit Website</Submit>
        </form>
      </div>
    </>
  );
}
