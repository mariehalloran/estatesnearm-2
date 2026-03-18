import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPages.css';

export default function RegisterPage() {
  const { register, confirmEmail } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('register'); // 'register' | 'confirm'
  const [pendingEmail, setPendingEmail] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [confirmCode, setConfirmCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const result = await register(form.name, form.email, form.password);
      if (result.requiresConfirmation) {
        setPendingEmail(form.email);
        setStep('confirm');
      } else {
        navigate('/post-sale');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await confirmEmail(pendingEmail, confirmCode);
      navigate('/login?confirmed=1');
    } catch (err) {
      setError(err.message || 'Invalid confirmation code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-split">
        <div className="auth-panel">
          <div className="auth-brand">
            <Link to="/">
              <span className="auth-logo-mark">⬡</span>
              <span>Estates<strong>NearMe</strong></span>
            </Link>
          </div>

          {step === 'register' ? (
            <div className="auth-card">
              <div className="auth-card-header">
                <h1>Create your account</h1>
                <p>Start posting estate sales and reach local buyers — free.</p>
              </div>
              {error && <div className="alert alert-error">{error}</div>}
              <form className="auth-form" onSubmit={handleRegister}>
                <div className="form-group">
                  <label htmlFor="name">Full Name</label>
                  <input id="name" name="name" type="text" placeholder="Jane Smith" value={form.name} onChange={handleChange} required autoComplete="name" />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input id="email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required autoComplete="email" />
                </div>
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input id="password" name="password" type="password" placeholder="Min 8 chars, 1 uppercase, 1 number" value={form.password} onChange={handleChange} required autoComplete="new-password" />
                </div>
                <div className="form-group">
                  <label htmlFor="confirm">Confirm Password</label>
                  <input id="confirm" name="confirm" type="password" placeholder="Re-enter your password" value={form.confirm} onChange={handleChange} required autoComplete="new-password" />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
              </form>
              <p className="auth-terms">
                By creating an account you agree to our <Link to="/terms">Terms &amp; Conditions</Link>.
              </p>
              <p className="auth-switch">
                Already have an account? <Link to="/login">Sign in</Link>
              </p>
            </div>
          ) : (
            <div className="auth-card">
              <div className="auth-card-header">
                <h1>Verify your email</h1>
                <p>We sent a 6-digit confirmation code to <strong>{pendingEmail}</strong>. Check your inbox.</p>
              </div>
              {error && <div className="alert alert-error">{error}</div>}
              <form className="auth-form" onSubmit={handleConfirm}>
                <div className="form-group">
                  <label htmlFor="code">Confirmation Code</label>
                  <input id="code" type="text" inputMode="numeric" placeholder="123456" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} required maxLength={6} style={{ fontSize: '1.4rem', letterSpacing: '0.2em', textAlign: 'center' }} />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Verifying…' : 'Verify Email'}
                </button>
              </form>
              <p className="auth-switch">
                <button className="btn btn-ghost btn-sm" onClick={() => setStep('register')}>← Back to registration</button>
              </p>
            </div>
          )}
        </div>

        <div className="auth-decorative">
          <div className="auth-deco-content">
            <div className="auth-deco-hex">⬡</div>
            <blockquote>"Every estate sale tells a story. Help yours find the right audience."</blockquote>
            <div className="auth-deco-features">
              {[
                { icon: '🗺️', title: 'Local Discovery', desc: 'Your sale appears on the map for buyers in your area' },
                { icon: '📸', title: 'Rich Listings', desc: 'Add photos, descriptions, and detailed schedules' },
                { icon: '✅', title: 'Free to Post', desc: 'No fees, no commissions — list as many sales as you want' },
              ].map((f) => (
                <div key={f.title} className="auth-deco-feature">
                  <span className="deco-feature-icon">{f.icon}</span>
                  <div><strong>{f.title}</strong><p>{f.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
