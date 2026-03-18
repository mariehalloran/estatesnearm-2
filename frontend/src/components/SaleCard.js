import React from 'react';
import { Link } from 'react-router-dom';
import { formatShortDate, getSaleStatus } from '../utils/dateUtils';
import './SaleCard.css';

const STATUS_LABELS = { active: 'Happening Now', upcoming: 'Upcoming', ended: 'Ended' };

export default function SaleCard({ sale }) {
  const status = getSaleStatus(sale.startDate, sale.endDate);
  const hasImage = sale.imageUrl;

  return (
    <Link to={`/sales/${sale._id}`} className="sale-card card">
      <div className="sale-card-image">
        {hasImage ? (
          <img src={sale.imageUrl} alt={sale.title} loading="lazy" />
        ) : (
          <div className="sale-card-placeholder">
            <span>🏡</span>
          </div>
        )}
        <span className={`badge badge-${status} sale-card-badge`}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="sale-card-body">
        <h3 className="sale-card-title">{sale.title}</h3>

        <div className="sale-card-meta">
          <div className="sale-card-meta-row">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{sale.address?.city}, {sale.address?.state}</span>
          </div>
          <div className="sale-card-meta-row">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>
              {formatShortDate(sale.startDate)}
              {sale.startDate !== sale.endDate && ` – ${formatShortDate(sale.endDate)}`}
            </span>
          </div>
          <div className="sale-card-meta-row">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{sale.startTime} – {sale.endTime}</span>
          </div>
        </div>

        <p className="sale-card-desc">{sale.description}</p>

        {sale.tags?.length > 0 && (
          <div className="sale-card-tags">
            {sale.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="sale-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
