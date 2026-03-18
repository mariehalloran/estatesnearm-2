import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner container">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            <span className="footer-logo-mark">⬡</span>
            <span>Estates<strong>NearMe</strong></span>
          </Link>
          <p className="footer-tagline">
            Connecting communities through local estate sales. Find hidden gems and give treasures a second life.
          </p>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <h4>Explore</h4>
            <Link to="/sales">Find Sales</Link>
            <Link to="/post-sale">Post a Sale</Link>
            <Link to="/my-sales">My Listings</Link>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <Link to="/about">About Us</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/terms">Terms & Conditions</Link>
          </div>
          <div className="footer-col">
            <h4>Account</h4>
            <Link to="/login">Sign In</Link>
            <Link to="/register">Create Account</Link>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container">
          <span>© {new Date().getFullYear()} EstatesNearMe. All rights reserved.</span>
          <span>Made with care for local communities.</span>
        </div>
      </div>
    </footer>
  );
}
