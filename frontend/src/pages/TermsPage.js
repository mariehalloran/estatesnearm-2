import React from 'react';
import './StaticPages.css';

const LAST_UPDATED = 'January 1, 2025';

export default function TermsPage() {
  return (
    <div className="static-page">
      <section className="static-hero" style={{ paddingBottom: '48px' }}>
        <div className="container">
          <div className="static-hero-eyebrow">Legal</div>
          <h1>Terms &amp; Conditions</h1>
          <p>Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      <section className="terms-body">
        <div className="container terms-layout">
          {/* TOC */}
          <nav className="terms-toc">
            <h3>Contents</h3>
            <ol>
              {['Acceptance of Terms', 'Description of Service', 'User Accounts', 'User Content', 'Prohibited Conduct', 'Privacy', 'Disclaimers', 'Limitation of Liability', 'Indemnification', 'Changes to Terms', 'Contact'].map((item, i) => (
                <li key={i}>
                  <a href={`#section-${i + 1}`}>{item}</a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Content */}
          <div className="terms-content">
            <p className="terms-intro">
              Please read these Terms and Conditions carefully before using EstatesNearMe. By accessing or using our platform, you agree to be bound by these terms.
            </p>

            <div id="section-1" className="terms-section">
              <h2>1. Acceptance of Terms</h2>
              <p>By accessing and using EstatesNearMe ("the Platform," "we," "us," or "our"), you accept and agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree to these terms, please do not use our platform.</p>
            </div>

            <div id="section-2" className="terms-section">
              <h2>2. Description of Service</h2>
              <p>EstatesNearMe is an online platform that allows users to discover and post local estate sales. The Platform provides:</p>
              <ul>
                <li>A public map and directory of estate sales</li>
                <li>Tools for registered users to create and manage estate sale listings</li>
                <li>Search and filtering functionality for finding nearby sales</li>
              </ul>
              <p>We are a listing platform only. EstatesNearMe is not a party to any transaction between buyers and sellers and takes no responsibility for the conduct of any user or the accuracy of any listing.</p>
            </div>

            <div id="section-3" className="terms-section">
              <h2>3. User Accounts</h2>
              <p>To post estate sales, you must create an account. You agree to:</p>
              <ul>
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
                <li>Be responsible for all activities that occur under your account</li>
              </ul>
              <p>You must be at least 18 years of age to create an account and post listings. We reserve the right to terminate accounts that violate these terms.</p>
            </div>

            <div id="section-4" className="terms-section">
              <h2>4. User Content</h2>
              <p>By posting a listing, you represent and warrant that:</p>
              <ul>
                <li>You have the right to sell the items described</li>
                <li>All information in your listing is accurate and not misleading</li>
                <li>Your listing does not violate any applicable laws or regulations</li>
                <li>Any images you upload are owned by you or you have permission to use them</li>
              </ul>
              <p>You grant EstatesNearMe a non-exclusive, royalty-free license to display your listing content on the Platform for the purpose of operating the service.</p>
            </div>

            <div id="section-5" className="terms-section">
              <h2>5. Prohibited Conduct</h2>
              <p>You agree not to use the Platform to:</p>
              <ul>
                <li>Post false, misleading, or deceptive listings</li>
                <li>List items that are illegal to sell under applicable law</li>
                <li>Harass, threaten, or harm other users</li>
                <li>Scrape, crawl, or otherwise extract data from the Platform without permission</li>
                <li>Interfere with or disrupt the Platform's infrastructure</li>
                <li>Impersonate another person or entity</li>
                <li>Violate any applicable local, state, national, or international law</li>
              </ul>
            </div>

            <div id="section-6" className="terms-section">
              <h2>6. Privacy</h2>
              <p>Your use of the Platform is also governed by our Privacy Policy, which is incorporated herein by reference. By using EstatesNearMe, you consent to our collection and use of personal data as described in the Privacy Policy. Please note that your listing address will be publicly visible.</p>
            </div>

            <div id="section-7" className="terms-section">
              <h2>7. Disclaimers</h2>
              <p>The Platform is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied. EstatesNearMe does not warrant that:</p>
              <ul>
                <li>The Platform will be uninterrupted or error-free</li>
                <li>Any listing information is accurate, complete, or current</li>
                <li>The Platform is free of viruses or other harmful components</li>
              </ul>
              <p>EstatesNearMe is not responsible for any transactions between users, the quality or legality of items listed, or any disputes that arise between buyers and sellers.</p>
            </div>

            <div id="section-8" className="terms-section">
              <h2>8. Limitation of Liability</h2>
              <p>To the fullest extent permitted by applicable law, EstatesNearMe shall not be liable for any indirect, incidental, special, consequential, or punitive damages — including loss of profits, data, or goodwill — arising out of or in connection with your use of the Platform, even if advised of the possibility of such damages. Our total liability shall not exceed $100.</p>
            </div>

            <div id="section-9" className="terms-section">
              <h2>9. Indemnification</h2>
              <p>You agree to indemnify and hold harmless EstatesNearMe and its officers, directors, employees, and agents from any claims, losses, liabilities, damages, costs, or expenses (including attorneys' fees) arising from your use of the Platform, your listings, or your violation of these Terms.</p>
            </div>

            <div id="section-10" className="terms-section">
              <h2>10. Changes to Terms</h2>
              <p>We may update these Terms from time to time. We will notify you of significant changes by updating the "Last Updated" date at the top of this page. Your continued use of the Platform after any changes constitutes your acceptance of the new terms.</p>
            </div>

            <div id="section-11" className="terms-section">
              <h2>11. Contact</h2>
              <p>If you have questions about these Terms and Conditions, please contact us at:</p>
              <p><strong>EstatesNearMe</strong><br />
              Email: <a href="mailto:legal@estatesnearm.com" style={{ color: 'var(--forest)' }}>legal@estatesnearm.com</a></p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
