import { useState } from "react";
import { Link } from "react-router-dom";
import { post } from "./api";
import {
  Field,
  FormError,
  Icon,
  Submit,
  TextArea,
  formValues,
  useTitle,
} from "./components";
import { Honeypot } from "./forms";
import privacyHtml from "../content/privacy.html?raw";
export function About() {
  useTitle("About");
  return (
    <>
      <section className="hero page-hero">
        <span className="hero-icon">
          <Icon name="pin" />
        </span>
        <h1>About Gold Country Directory</h1>
        <p>
          A community-built resource connecting neighbors with the local
          businesses that
          <br className="desktop-break" /> serve them.
        </p>
      </section>
      <div className="prose-column">
        <section className="panel">
          <h2 className="panel-heading">
            <span className="small-circle">
              <Icon name="pin" />
            </span>
            What We Do
          </h2>
          <p>
            Gold Country Directory is a free, community-driven business
            directory built specifically for the communities along the Sierra
            Nevada Divide — including Georgetown, Garden Valley, Cool, Pilot
            Hill, Coloma, Lotus, and the surrounding foothills. Our goal is
            simple: make it easy for residents and visitors to discover,
            contact, and support the talented local businesses that make this
            region so special. From plumbers and electricians to boutique shops,
            pet groomers, and everything in between, you'll find genuine, vetted
            listings here — not algorithm-ranked ads. Every entry is reviewed
            and approved by a real person before it goes live.
          </p>
        </section>
        <section className="panel">
          <h2 className="panel-heading">
            <span className="small-circle">
              <Icon name="users" />
            </span>
            Who It's For
          </h2>
          <p>
            This directory is for{" "}
            <strong>everyone in the foothills community.</strong> If you're a
            long-time resident looking for a trusted handyman, a newcomer trying
            to find a reliable veterinarian, or a weekend visitor searching for
            a local café — this is your guide. It's also for the business owners
            themselves: listing your business here puts you directly in front of
            people who are already looking for exactly what you offer, without
            the cost or complexity of big-city advertising platforms.
          </p>
        </section>
        <section className="panel">
          <h2 className="panel-heading">
            <span className="small-circle">
              <Icon name="heart" />
            </span>
            Who Builds It
          </h2>
          <p>
            Gold Country Directory is created and maintained by{" "}
            <strong>Grow Local Creative</strong>, a small team passionate about
            supporting rural communities and local economies. We live here too —
            and we believe that when local businesses thrive, the whole
            community benefits. We keep this directory free to browse and
            affordable for business owners to list in. Donations from community
            members help us keep the lights on and the listings growing.
          </p>
        </section>
        <div className="center">
          <Link className="button" to="/Directory">
            Browse the Directory <Icon name="arrow" />
          </Link>
        </div>
      </div>
    </>
  );
}
export function Contact() {
  useTitle("Contact");
  return (
    <>
      <section className="hero page-hero">
        <span className="hero-icon">
          <Icon name="message" />
        </span>
        <h1>Contact Us</h1>
        <p>
          Questions, corrections, listing suggestions, or partnership inquiries
          —<br className="desktop-break" /> we'd love to hear from you.
        </p>
      </section>
      <div className="contact-column">
        <section className="panel contact-panel">
          <span className="small-circle">
            <Icon name="mail" />
          </span>
          <div>
            <h2>Email Us</h2>
            <p>
              For general questions, listing edits, or partnership inquiries:
            </p>
            <a href="mailto:growlocalcreative@gmail.com">
              growlocalcreative@gmail.com
            </a>
          </div>
        </section>
        <section className="panel contact-panel">
          <span className="small-circle gold-circle">
            <Icon name="mail" />
          </span>
          <div>
            <h2>Featured Listing Inquiries</h2>
            <p>
              Interested in a spotlight or enhanced listing for your business?
            </p>
            <a
              className="gold"
              href="mailto:growlocalcreative@gmail.com?subject=Featured%20Listing%20Interest"
            >
              Send us a note →
            </a>
          </div>
        </section>
        <section className="panel contact-panel">
          <span className="small-circle">
            <Icon name="camera" />
          </span>
          <div>
            <h2>Follow Along</h2>
            <p>Stay connected with community updates and new listings:</p>
            <a
              href="https://instagram.com/growlocalcreative"
              target="_blank"
              rel="noopener noreferrer"
            >
              @growlocalcreative on Instagram
            </a>
          </div>
        </section>
        <section className="donate-panel">
          <p>💚 Support the Directory</p>
          <small>
            Small donations keep this community resource free and growing.
          </small>
          <a
            className="button button-white"
            href="https://venmo.com/growlocalcreative"
            target="_blank"
            rel="noopener noreferrer"
          >
            Donate via Venmo
          </a>
        </section>
      </div>
    </>
  );
}
export function ContactMessage() {
  useTitle("Send a Message");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [sent, setSent] = useState("");
  return (
    <div className="form-column">
      <form
        className="panel standard-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const r = await post<{ message: string }>(
              "/api/contact",
              formValues(e.currentTarget),
            );
            setSent(r.message);
          } catch (error) {
            setError(error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1>Send a Message</h1>
        <FormError error={error} />
        {sent ? (
          <p className="inline-success">{sent}</p>
        ) : (
          <>
            <Field name="name" label="Name" required />
            <Field name="email" label="Email" type="email" required />
            <Field name="subject" label="Subject" required />
            <TextArea name="message" label="Message" required />
            <Honeypot />
            <Submit busy={busy}>Submit Message</Submit>
          </>
        )}
      </form>
      <Link to="/Contact">Back to Contact</Link>
    </div>
  );
}
export function Privacy() {
  useTitle("Privacy");
  return <div dangerouslySetInnerHTML={{ __html: privacyHtml }} />;
}
