import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatDate, getSaleStatus } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import './SaleDetailPage.css';

const STATUS_LABELS = { active: 'Happening Now', upcoming: 'Upcoming', ended: 'Sale Ended' };

export default function SaleDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchSale = async () => {
      try {
        const res = await api.get(`/sales/${id}`);
        setSale(res.data.sale);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSale();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this estate sale?')) return;
    setDeleting(true);
    try {
      await api.delete(`/sales/${id}`);
      navigate('/my-sales');
    } catch (err) {
      alert(err.message);
      setDeleting(false);
    }
  };

  if (loading) return <div className="spinner" style={{ marginTop: '100px' }} />;
  if (error || !sale) return (
    <div className="page-wrapper container" style={{ textAlign: 'center' }}>
      <h2>Sale not found</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{error}</p>
      <Link to="/sales" className="btn btn-primary">Browse All Sales</Link>
    </div>
  );

  const status = getSaleStatus(sale.startDate, sale.endDate);
  const isOwner = user && sale.postedBy === user.id;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sale.address?.full || '')}`;

  return (
    <div className="detail-page">
      {/* Hero image */}
      <div className="detail-hero">
        {sale.imageUrl ? (
          <img src={sale.imageUrl} alt={sale.title} className="detail-hero-img" />
        ) : (
          <div className="detail-hero-placeholder">🏡</div>
        )}
        <div className="detail-hero-overlay" />
        <div className="detail-hero-content container">
          <div className="detail-breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <Link to="/sales">Sales</Link>
            <span>/</span>
            <span>{sale.title}</span>
          </div>
          <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>
          <h1 className="detail-title">{sale.title}</h1>
        </div>
      </div>

      <div className="detail-body container">
        <div className="detail-main">
          {/* Description */}
          <div className="detail-section">
            <h2>About This Sale</h2>
            <p className="detail-description">{sale.description}</p>
          </div>

          {/* Tags */}
          {sale.tags?.length > 0 && (
            <div className="detail-section">
              <h2>What's Being Sold</h2>
              <div className="detail-tags">
                {sale.tags.map((tag) => (
                  <span key={tag} className="sale-tag" style={{ padding: '6px 16px', fontSize: '0.85rem' }}>{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Map embed */}
          <div className="detail-section">
            <h2>Location</h2>
            <div className="detail-map-embed">
              <iframe
                title="Sale location"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(sale.address?.full || '')}&output=embed`}
                width="100%"
                height="320"
                style={{ border: 0, borderRadius: 'var(--radius-lg)' }}
                allowFullScreen
                loading="lazy"
              />
            </div>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ marginTop: '12px' }}>
              Open in Google Maps ↗
            </a>
          </div>

          {/* Posted by */}
          <div className="detail-posted-by">
            <span>Posted by <strong>{sale.postedByName}</strong></span>
          </div>

          {/* Owner controls */}
          {isOwner && (
            <div className="detail-owner-actions">
              <h3>Manage Your Sale</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => navigate(`/post-sale?edit=${id}`)}
                >
                  Edit Sale
                </button>
                <button
                  className="btn btn-sm"
                  style={{ borderColor: '#c0392b', color: '#c0392b' }}
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Delete Sale'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="detail-sidebar">
          <div className="detail-card">
            <h3>Sale Details</h3>

            <div className="detail-info-row">
              <div className="detail-info-icon">📍</div>
              <div>
                <div className="detail-info-label">Location</div>
                <div className="detail-info-value">{sale.address?.full}</div>
              </div>
            </div>

            <div className="detail-info-row">
              <div className="detail-info-icon">📅</div>
              <div>
                <div className="detail-info-label">Dates</div>
                <div className="detail-info-value">
                  {formatDate(sale.startDate)}
                  {sale.startDate !== sale.endDate && (
                    <>
                      <br />— {formatDate(sale.endDate)}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="detail-info-row">
              <div className="detail-info-icon">🕐</div>
              <div>
                <div className="detail-info-label">Hours</div>
                <div className="detail-info-value">{sale.startTime} – {sale.endTime}</div>
              </div>
            </div>

            <div className="detail-divider" />

            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            >
              Get Directions
            </a>
          </div>

          <div className="detail-share-card">
            <h3>Share This Sale</h3>
            <div className="share-buttons">
              <button
                className="share-btn"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  alert('Link copied!');
                }}
              >
                📋 Copy Link
              </button>
              <a
                className="share-btn"
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Facebook
              </a>
              <a
                className="share-btn"
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(sale.title)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Twitter / X
              </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
