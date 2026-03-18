import React from 'react';
import { Link } from 'react-router-dom';
import './StaticPages.css';

export default function AboutPage() {
  return (
    <div className="static-page">
      {/* Hero */}
      <section className="static-hero">
        <div className="container">
          <div className="static-hero-eyebrow">Our Story</div>
          <h1>Connecting Communities<br />Through Estate Sales</h1>
          <p>EstatesNearMe was built on a simple belief: every object has a story, and every story deserves a new chapter.</p>
        </div>
      </section>

      {/* Mission */}
      <section className="about-mission">
        <div className="container about-mission-grid">
          <div className="about-mission-text">
            <h2>Our Mission</h2>
            <p>
              Estate sales are more than just transactions — they're community events that bring neighbors together, help families transition through major life changes, and give meaningful objects a second life. Yet discovering local estate sales has always been a scattered, frustrating experience.
            </p>
            <p>
              EstatesNearMe was created to change that. We built a simple, beautiful platform that makes it easy to find estate sales near you and equally simple to host your own. No fees, no hidden costs — just a community connecting buyers and sellers in real time, on a map.
            </p>
            <Link to="/register" className="btn btn-primary" style={{ marginTop: '16px' }}>
              Join the Community
            </Link>
          </div>
          <div className="about-mission-visual">
            <div className="about-hex-grid">
              <div className="about-hex" style={{ '--delay': '0s' }}>🏡</div>
              <div className="about-hex" style={{ '--delay': '0.3s' }}>🗺️</div>
              <div className="about-hex" style={{ '--delay': '0.6s' }}>🤝</div>
              <div className="about-hex" style={{ '--delay': '0.9s' }}>💎</div>
              <div className="about-hex" style={{ '--delay': '1.2s' }}>📸</div>
              <div className="about-hex" style={{ '--delay': '1.5s' }}>✨</div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="about-values">
        <div className="container">
          <div className="section-label">What We Stand For</div>
          <h2>Our Core Values</h2>
          <div className="values-grid">
            {[
              { icon: '🌍', title: 'Community First', desc: 'Everything we build is designed to strengthen local neighborhoods and foster genuine human connection.' },
              { icon: '♻️', title: 'Sustainability', desc: 'Every item that finds a new home is one less thing headed to a landfill. We believe in giving objects a second life.' },
              { icon: '🔓', title: 'Accessibility', desc: 'Browsing local estate sales should always be free. We never charge buyers to discover sales in their area.' },
              { icon: '🔒', title: 'Trust & Safety', desc: 'We\'re committed to creating a platform where both buyers and sellers feel safe and respected.' },
            ].map((v) => (
              <div key={v.title} className="value-card">
                <div className="value-icon">{v.icon}</div>
                <h3>{v.title}</h3>
                <p>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="about-how">
        <div className="container">
          <div className="section-label">Simple by Design</div>
          <h2>How It Works</h2>
          <div className="how-steps">
            <div className="how-step">
              <div className="how-num">01</div>
              <h3>Browse the Map</h3>
              <p>Land on the homepage and instantly see estate sales near you, pinned on an interactive map. No account required.</p>
            </div>
            <div className="how-arrow">→</div>
            <div className="how-step">
              <div className="how-num">02</div>
              <h3>Discover Sales</h3>
              <p>Filter by distance and date. Click any marker to see photos, descriptions, hours, and directions.</p>
            </div>
            <div className="how-arrow">→</div>
            <div className="how-step">
              <div className="how-num">03</div>
              <h3>Post Your Sale</h3>
              <p>Create a free account and list your estate sale in minutes. Add photos, set your dates, and go live on the map.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="static-cta">
        <div className="container">
          <h2>Ready to Get Started?</h2>
          <p>Whether you're looking for hidden gems or hosting your own sale, EstatesNearMe is your local community hub.</p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '32px' }}>
            <Link to="/sales" className="btn btn-primary btn-lg">Browse Sales Near Me</Link>
            <Link to="/register" className="btn btn-outline btn-lg" style={{ borderColor: 'var(--lime)', color: 'var(--lime)' }}>Post a Sale Free</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
