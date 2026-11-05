import { useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import type {
  Business,
  Category,
  DirectoryResponse,
  Review,
} from "../../shared/types";
import { post, useApi, useApp } from "./api";
import {
  BackLink,
  BusinessCard,
  ErrorState,
  Favorite,
  Field,
  FormError,
  Hero,
  Icon,
  Loading,
  SearchForm,
  ShareButton,
  Submit,
  TextArea,
  formValues,
  mapsUrl,
  useTitle,
} from "./components";
interface HomeResponse {
  stats: { businesses: number; categories: number };
  categories: Category[];
  popular_categories: Category[];
  recent_businesses: Business[];
  featured_businesses: Business[];
  recent_reviews: Review[];
}
export function Home() {
  useTitle("");
  const { data, error, loading, reload } = useApi<HomeResponse>("/api/home");
  return (
    <>
      <section className="hero home-hero">
        <h1>
          Find Local Pros
          <br />
          in the Divide
        </h1>
        <p>Your community business directory</p>
        <SearchForm
          className="hero-search"
          placeholder="Plumbers, restaurants, auto shops..."
          label="Search businesses, services"
        />
      </section>
      <nav className="home-shortcuts" aria-label="Popular searches">
        {[
          ["emergency", "bolt", "Emergency"],
          ["dining", "utensils", "Dining"],
          ["home", "hammer", "Home Pros"],
          ["makers", "bag", "Local Makers"],
        ].map(([q, icon, label]) => (
          <Link key={q} to={`/Directory?q=${q}`}>
            <span>
              <Icon name={icon} />
            </span>
            {label}
          </Link>
        ))}
      </nav>
      {loading ? (
        <Loading text="Finding local businesses…" />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : (
        data && (
          <>
            <section className="new-businesses">
              <div className="section-heading">
                <h2>
                  <Icon name="sparkles" className="gold" />
                  New to the Divide
                </h2>
                <Link to="/Directory">
                  See all <Icon name="arrow" />
                </Link>
              </div>
              <div
                className="recent-track"
                tabIndex={0}
                aria-label="New businesses, scroll to browse"
              >
                {data.recent_businesses.map((b) => (
                  <BusinessCard key={b.id} business={b} />
                ))}
                {!data.recent_businesses.length && (
                  <p className="empty-note">
                    New local businesses will appear here.
                  </p>
                )}
              </div>
            </section>
            <div className="home-bottom">
              <section className="recent-reviews">
                <div className="section-heading">
                  <h2>
                    <Icon name="star" className="star" />
                    Recently Reviewed
                  </h2>
                  <Link to="/Directory">
                    See all <Icon name="arrow" />
                  </Link>
                </div>
                {data.recent_reviews.map(
                  (review) =>
                    review.business && (
                      <Link
                        key={review.id}
                        className="review-preview"
                        to={`/business/${review.business.slug}`}
                      >
                        {review.business.display_image_url && (
                          <img
                            src={review.business.display_image_url}
                            alt={review.business.name}
                          />
                        )}
                        <div className="review-preview-body">
                          <div className="review-preview-heading">
                            <strong>{review.business.name}</strong>
                            <span className="rating">
                              ★ {Number(review.rating).toFixed(1)}
                            </span>
                          </div>
                          <small>{review.business.category.name}</small>
                          <blockquote>
                            <span>“{review.body}”</span>
                          </blockquote>
                          <p>— {review.display_name}</p>
                        </div>
                      </Link>
                    ),
                )}
                {!data.recent_reviews.length && (
                  <p className="empty-note">No reviews yet. Be the first!</p>
                )}
              </section>
              <Link className="button browse-all" to="/Directory">
                Browse All {data.stats.businesses} Businesses{" "}
                <Icon name="arrow" />
              </Link>
              <p className="home-suggest">
                Know a great local business we're missing?{" "}
                <Link to="/SuggestBusiness">Add it here</Link>
              </p>
            </div>
          </>
        )
      )}
    </>
  );
}
function CategoryGroup({
  group,
}: {
  group: DirectoryResponse["category_groups"][number];
}) {
  const [page, setPage] = useState(0),
    pages = Math.ceil(group.businesses.length / 3);
  return (
    <section className="category-group" data-category-group>
      <div className="section-heading">
        <h2>{group.name}</h2>
        {pages > 1 && (
          <div className="category-paging">
            <button
              onClick={() => setPage((v) => v - 1)}
              disabled={page === 0}
              aria-label={`Previous ${group.name} businesses`}
            >
              <Icon name="chevron" className="flip" />
            </button>
            <span>{page + 1}</span> / <span>{pages}</span>
            <button
              onClick={() => setPage((v) => v + 1)}
              disabled={page + 1 >= pages}
              aria-label={`Next ${group.name} businesses`}
            >
              <Icon name="chevron" />
            </button>
          </div>
        )}
      </div>
      <div className="business-grid">
        {group.businesses.slice(page * 3, page * 3 + 3).map((b) => (
          <BusinessCard key={b.id} business={b} />
        ))}
      </div>
      {pages > 1 && (
        <p className="category-range" aria-live="polite">
          Showing {page * 3 + 1}–
          {Math.min(page * 3 + 3, group.businesses.length)} of{" "}
          {group.businesses.length}
        </p>
      )}
    </section>
  );
}
export function Directory({ favorites = false }: { favorites?: boolean }) {
  useTitle(favorites ? "My Faves" : "Directory");
  const [params, setParams] = useSearchParams(),
    { session } = useApp();
  const query = new URLSearchParams(params);
  query.set("page_size", "all");
  const favoriteKey = favorites ? session?.favorites.join(",") : "";
  const { data, error, loading, reload } = useApi<DirectoryResponse>(
    `${favorites ? "/api/favorites" : "/api/businesses"}?${query.toString()}${favorites ? "&saved=" + encodeURIComponent(favoriteKey || "") : ""}`,
  );
  const category = params.get("category") || "";
  return (
    <>
      <section className="hero directory-hero">
        <h1>{favorites ? "My Faves" : "Explore the Divide"}</h1>
        <SearchForm
          className="hero-search"
          placeholder="Search businesses, services..."
          label="Search businesses, services"
        />
      </section>
      {data && (
        <nav className="category-shortcuts" aria-label="Popular categories">
          {data.popular_categories.map((c) => (
            <Link
              key={c.id}
              to={`/Directory?category=${encodeURIComponent(c.slug)}`}
              className={category === c.slug ? "selected" : ""}
            >
              <span>
                <Icon name={c.popular_icon || "bag"} />
              </span>
              {c.name}
            </Link>
          ))}
        </nav>
      )}
      <div className="directory-content">
        {loading ? (
          <Loading text="Loading the directory…" />
        ) : error ? (
          <ErrorState error={error} retry={reload} />
        ) : (
          data && (
            <>
              <div className="directory-toolbar">
                <p>
                  <strong>{data.total_count}</strong> listings found
                  {(category || params.get("q")) && (
                    <Link
                      className="clear-filter"
                      to={favorites ? "/MyFaves" : "/Directory"}
                    >
                      Clear filter ×
                    </Link>
                  )}
                </p>
                <div className="toolbar-actions">
                  <ShareButton className="button button-outline" />
                  <div className="sort-form">
                    <label htmlFor="sort">
                      ↕ <span className="sr-only">Sort listings</span>
                    </label>
                    <select
                      id="sort"
                      name="sort"
                      value={params.get("sort") || "name"}
                      onChange={(e) => {
                        const next = new URLSearchParams(params);
                        next.set("sort", e.target.value);
                        setParams(next);
                      }}
                    >
                      <option value="name">Alphabetical (A–Z)</option>
                      <option value="newest">Recently Added</option>
                      <option value="category">Category</option>
                    </select>
                  </div>
                  <Link to="/SuggestBusiness">+ Add Your Business</Link>
                </div>
              </div>
              {data.category_groups.length ? (
                data.category_groups.map((group) => (
                  <CategoryGroup
                    key={`${group.category.id}-${params.toString()}-${favoriteKey}`}
                    group={group}
                  />
                ))
              ) : (
                <div className="empty-state">
                  <span className="empty-leaf">🌿</span>
                  <p>
                    {favorites
                      ? "Your saved businesses will appear here."
                      : "No listings found in this gathering yet."}
                  </p>
                  <Link className="button" to="/Directory">
                    View All Businesses
                  </Link>
                </div>
              )}
            </>
          )
        )}
      </div>
    </>
  );
}
interface DetailResponse {
  business: Business;
  reviews: Review[];
  related_businesses: Business[];
  is_favorite: boolean;
  can_edit: boolean;
}
export function LegacyDetail() {
  const [params] = useSearchParams();
  const { data, error, loading, reload } = useApi<{ business: Business }>(
    `/api/businesses/by-source/${encodeURIComponent(params.get("id") || "missing")}`,
  );
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;
  return data ? (
    <Navigate replace to={`/business/${data.business.slug}`} />
  ) : null;
}
export function BusinessDetail() {
  const { slug } = useParams();
  const { data, error, loading, reload } = useApi<DetailResponse>(
    `/api/businesses/${encodeURIComponent(slug || "")}`,
  );
  useTitle(
    data?.business.name || "Business Details",
    data
      ? `Contact details, services, and community reviews for ${data.business.name} in the Sierra Nevada Divide.`
      : undefined,
  );
  const { session } = useApp();
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;
  if (!data) return null;
  const b = data.business;
  return (
    <>
      <section className="hero detail-hero">
        <Link to="/Directory">
          <Icon name="back" />
          Back to Directory
        </Link>
        <div className="detail-title">
          <h1>{b.name}</h1>
          {b.verified && (
            <span className="badge verified-badge">
              <Icon name="shield" />
              Verified
            </span>
          )}
        </div>
        <span className="category-badge">{b.category.name}</span>
        {b.average_rating != null && (
          <span className="detail-rating">
            ★ <strong>{Number(b.average_rating).toFixed(1)}</strong> (
            {data.reviews.length})
          </span>
        )}
      </section>
      <div className="detail-column">
        <article className={`detail-panel ${b.is_premium ? "premium" : ""}`}>
          {b.display_image_url && (
            <div className="detail-image">
              <img src={b.display_image_url} alt={b.name} />
            </div>
          )}
          <div className="detail-body">
            {b.contact_person && (
              <div className="detail-contact">
                <Icon name="user" />
                <div>
                  <small>Contact</small>
                  <p>{b.contact_person}</p>
                </div>
              </div>
            )}
            <div className="contact-actions">
              {b.phones && (
                <>
                  <a className="button" href={`tel:${b.primary_phone}`}>
                    <Icon name="phone" />
                    Call
                  </a>
                  <a
                    className="button button-light"
                    href={`sms:${b.primary_phone}`}
                  >
                    <Icon name="message" />
                    Text
                  </a>
                </>
              )}
              {b.email && (
                <a className="button button-light" href={`mailto:${b.email}`}>
                  <Icon name="mail" />
                  Email
                </a>
              )}
              {b.website && (
                <a
                  className="button button-light"
                  href={b.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="globe" />
                  Website
                </a>
              )}
              {(b.address || b.city) && (
                <a
                  className="button button-light"
                  href={mapsUrl(b)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="pin" />
                  Directions
                </a>
              )}
              <ShareButton />
            </div>
            {(b.address || b.city) && (
              <>
                <div className="detail-contact">
                  <Icon name="pin" />
                  <div>
                    <small>Location</small>
                    <p>{b.address || b.city}</p>
                  </div>
                </div>
                <div className="map-link-panel">
                  <a
                    href={mapsUrl(b)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="pin" />
                    View location in Google Maps <Icon name="arrow" />
                  </a>
                </div>
              </>
            )}
            {b.license && <p className="license">License: {b.license}</p>}
            {b.description && (
              <section className="detail-section">
                <h2>Services / Specialties</h2>
                <p>{b.description}</p>
              </section>
            )}
            {b.special_offers && (
              <section className="offers-panel">
                <h2>
                  <Icon name="sparkles" />
                  Exclusive Offers &amp; Promotions
                </h2>
                <p>{b.special_offers.replace(/<[^>]*>/g, "")}</p>
                {b.premium_image_url && (
                  <img src={b.premium_image_url} alt={`${b.name} promotion`} />
                )}
              </section>
            )}
            <div className="owner-link">
              {data.can_edit ? (
                <Link to={`/account/business/${b.id}/edit/`}>
                  <Icon name="edit" />
                  Edit Your Business
                </Link>
              ) : (
                <Link to={`/business/${b.slug}/claim`}>
                  <Icon name="shield" />
                  {session?.user
                    ? "Claim this business"
                    : "Log in as owner to edit"}
                </Link>
              )}
            </div>
          </div>
        </article>
        <p className="removal-link">
          <Link to={`/business/${b.slug}/remove`}>
            Request removal of this listing
          </Link>
        </p>
        <div className="panel detail-action-panel">
          <Link to={`/business/${b.slug}/suggest`}>
            <Icon name="edit" />
            Suggest Edit
          </Link>
          <Favorite business={b} detail />
          <ShareButton className="" />
        </div>
        <section className="panel detail-reviews">
          <h2>Reviews</h2>
          {data.reviews.map((review) => (
            <article className="public-review" key={review.id}>
              <div>
                <span
                  className="rating"
                  aria-label={`${review.rating} out of 5 stars`}
                >
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                </span>{" "}
                <span>{review.display_name}</span>
              </div>
              <p>{review.body}</p>
              <small>
                {new Date(review.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </small>
            </article>
          ))}
          {!data.reviews.length && (
            <p className="muted">No reviews yet. Be the first!</p>
          )}
        </section>
        <section className="panel leave-review">
          <h2>Leave a Review</h2>
          {session?.user ? (
            <ReviewForm business={b} />
          ) : (
            <p>
              <Link
                to={`/accounts/login/?next=${encodeURIComponent("/business/" + b.slug)}`}
              >
                Log in
              </Link>{" "}
              to leave a review.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
function ReviewForm({ business }: { business: Business }) {
  const { session, notify } = useApp(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [sent, setSent] = useState(false);
  return (
    <form
      className="standard-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const values = formValues(event.currentTarget);
        setBusy(true);
        setError(null);
        try {
          const r = await post<{ message: string }>(
            `/api/businesses/${business.slug}/reviews`,
            { ...values, rating: Number(values.rating) },
          );
          setSent(true);
          notify(r.message);
        } catch (error) {
          setError(error);
        } finally {
          setBusy(false);
        }
      }}
    >
      <FormError error={error} />
      {sent && (
        <p className="inline-success" role="status">
          Your review has been submitted for moderation. It will appear after
          approval.
        </p>
      )}
      <Field
        name="display_name"
        label="Display name"
        required
        defaultValue={[session?.user?.first_name, session?.user?.last_name]
          .filter(Boolean)
          .join(" ")}
      />
      <Field name="rating" label="Rating" required>
        <select name="rating" id="id_rating" defaultValue="5">
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "star" : "stars"}
            </option>
          ))}
        </select>
      </Field>
      <TextArea name="body" label="Review" required />
      <Submit busy={busy}>Submit Review</Submit>
    </form>
  );
}
