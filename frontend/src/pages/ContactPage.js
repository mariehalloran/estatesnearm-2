import React, { useState } from 'react';
import './StaticPages.css';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate submission — wire to your backend or a service like Resend/SendGrid
    await new Promise((r) => setTimeout(r, 1000));
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="static-page">
      <section className="static-hero" style={{ paddingBottom: '60px' }}>
        <div className="container">
          <div className="static-hero-eyebrow">Get In Touch</div>
          <h1>Contact Us</h1>
          <p>Have a question, feedback, or need support? We'd love to hear from you.</p>
        </div>
      </section>

      <section className="contact-body">
        <div className="container contact-grid">
          {/* Form */}
          <div className="contact-form-wrap">
            {submitted ? (
              <div className="contact-success">
                <div className="contact-success-icon">✅</div>
                <h2>Message Sent!</h2>
                <p>Thanks for reaching out. We typically respond within 1–2 business days.</p>
              </div>
            ) : (
              <form className="contact-form" onSubmit={handleSubmit}>
                <h2>Send Us a Message</h2>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="c-name">Your Name</label>
                    <input id="c-name" name="name" type="text" placeholder="Jane Smith" value={form.name} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="c-email">Email Address</label>
                    <input id="c-email" name="email" type="email" placeholder="jane@example.com" value={form.email} onChange={handleChange} required />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="c-subject">Subject</label>
                  <select id="c-subject" name="subject" value={form.subject} onChange={handleChange} required>
                    <option value="">Select a topic…</option>
                    <option value="general">General Question</option>
                    <option value="listing">Listing Help</option>
                    <option value="technical">Technical Issue</option>
                    <option value="report">Report a Listing</option>
                    <option value="partnership">Partnership Inquiry</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="c-message">Message</label>
                  <textarea id="c-message" name="message" rows={6} placeholder="Tell us how we can help…" value={form.message} onChange={handleChange} required />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Sending…' : 'Send Message'}
                </button>
              </form>
            )}
          </div>

          {/* Info */}
          <aside className="contact-info">
            <div className="contact-info-card">
              <h3>Other Ways to Reach Us</h3>
              <div className="contact-info-item">
                <span className="contact-info-icon">📧</span>
                <div>
                  <strong>Email</strong>
                  <a href="mailto:hello@estatesnearm.com">hello@estatesnearm.com</a>
                </div>
              </div>
              <div className="contact-info-item">
                <span className="contact-info-icon">🕐</span>
                <div>
                  <strong>Response Time</strong>
                  <span>Within 1–2 business days</span>
                </div>
              </div>
            </div>

            <div className="contact-info-card">
              <h3>Frequently Asked</h3>
              <div className="contact-faq">
                {[
                  { q: 'Is it free to post a sale?', a: 'Yes — creating an account and posting estate sales is completely free.' },
                  { q: 'Can I edit my listing after posting?', a: 'Yes, you can edit or delete your listings at any time from My Sales.' },
                  { q: 'How long do listings stay up?', a: 'Listings are automatically hidden from the map once their end date has passed.' },
                ].map((item, i) => (
                  <div key={i} className="contact-faq-item">
                    <strong>{item.q}</strong>
                    <p>{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
