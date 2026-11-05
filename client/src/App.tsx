import { Component, useEffect, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useApp } from "./api";
import { Footer, Icon, Navigation, RequireAuth } from "./components";
import { BusinessDetail, Directory, Home, LegacyDetail } from "./public";
import {
  AddByUrl,
  BusinessFormPage,
  BusinessRequest,
  LegacyEdit,
} from "./forms";
import {
  Account,
  Login,
  PasswordChange,
  PasswordConfirm,
  PasswordReset,
  Signup,
} from "./account";
import { Admin } from "./admin";
import { About, Contact, ContactMessage, Privacy } from "./info";
class RenderBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="error-recovery">
        <h1>Something went wrong</h1>
        <p>
          Please reload this page to try again. Any submitted changes are kept
          on the server.
        </p>
        <a
          className="button"
          href={window.location.pathname + window.location.search}
        >
          Reload page
        </a>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const location = useLocation(),
    { flash, dismissFlash, sessionError, reloadSession } = useApp();
  const auth =
    /^\/(accounts\/(login|signup|password_reset|password_change|reset)|login|signup)(\/|$)/i.test(
      location.pathname,
    );
  useEffect(() => {
    document.body.classList.toggle("auth-page", auth);
    document.body.classList.toggle(
      "directory-page",
      /^\/(Directory|MyFaves)/i.test(location.pathname),
    );
    window.scrollTo(0, 0);
  }, [location.pathname, auth]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {!auth && <Navigation />}
      <main id="main">
        {!auth && flash && (
          <div className="messages" aria-live="polite">
            <div className={`message ${flash.error ? "error" : ""}`}>
              <span>{flash.text}</span>
              <button aria-label="Dismiss message" onClick={dismissFlash}>
                <Icon name="close" />
              </button>
            </div>
          </div>
        )}
        {sessionError && (
          <div className="messages">
            <div className="message error" role="alert">
              <span>
                We couldn't connect your session.{" "}
                <button onClick={() => void reloadSession()}>Try again</button>
              </span>
            </div>
          </div>
        )}
        <RenderBoundary key={location.pathname}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/Home" element={<Home />} />
            <Route path="/Directory" element={<Directory />} />
            <Route
              path="/MyFaves"
              element={
                <RequireAuth>
                  <Directory favorites />
                </RequireAuth>
              }
            />
            <Route path="/business/:slug" element={<BusinessDetail />} />
            <Route path="/BusinessDetails" element={<LegacyDetail />} />
            <Route path="/SuggestBusiness" element={<BusinessFormPage />} />
            <Route
              path="/scan-card"
              element={<Navigate replace to="/SuggestBusiness?tab=scan" />}
            />
            <Route path="/AddByUrl" element={<AddByUrl />} />
            <Route
              path="/business/:slug/claim"
              element={
                <RequireAuth>
                  <BusinessRequest kind="claim" />
                </RequireAuth>
              }
            />
            <Route
              path="/business/:slug/suggest"
              element={<BusinessRequest kind="edit" />}
            />
            <Route
              path="/business/:slug/remove"
              element={<BusinessRequest kind="remove" />}
            />
            <Route
              path="/business/:slug/merge"
              element={<BusinessRequest kind="merge" />}
            />
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <Account />
                </RequireAuth>
              }
            />
            <Route
              path="/account/business/:id/edit"
              element={
                <RequireAuth>
                  <BusinessFormPage edit />
                </RequireAuth>
              }
            />
            <Route
              path="/EditBusiness"
              element={
                <RequireAuth>
                  <LegacyEdit />
                </RequireAuth>
              }
            />
            <Route
              path="/edit-business"
              element={
                <RequireAuth>
                  <LegacyEdit />
                </RequireAuth>
              }
            />
            <Route path="/accounts/login" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/accounts/signup" element={<Signup />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/accounts/password_reset"
              element={<PasswordReset />}
            />
            <Route
              path="/accounts/reset/:token"
              element={<PasswordConfirm />}
            />
            <Route
              path="/accounts/password_change"
              element={
                <RequireAuth>
                  <PasswordChange />
                </RequireAuth>
              }
            />
            <Route
              path="/AdminDashboard"
              element={
                <RequireAuth staff>
                  <Admin />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/*"
              element={
                <RequireAuth staff>
                  <Admin />
                </RequireAuth>
              }
            />
            <Route
              path="/ScanCards"
              element={
                <RequireAuth staff>
                  <Admin />
                </RequireAuth>
              }
            />
            <Route path="/About" element={<About />} />
            <Route path="/Contact" element={<Contact />} />
            <Route path="/contact/message" element={<ContactMessage />} />
            <Route path="/Privacy" element={<Privacy />} />
            <Route
              path="*"
              element={
                <div className="page-state">
                  <h1>Page not found</h1>
                  <p>That page isn't in the directory.</p>
                  <Link className="button" to="/Directory">
                    Browse the Directory
                  </Link>
                </div>
              }
            />
          </Routes>
        </RenderBoundary>
      </main>
      {!auth && <Footer />}
    </>
  );
}
