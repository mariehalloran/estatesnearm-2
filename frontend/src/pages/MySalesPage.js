import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { formatShortDate, getSaleStatus } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import './MySalesPage.css';

const STATUS_LABELS = { active: 'Active', upcoming: 'Upcoming', ended: 'Ended' };

export default function MySalesPage() {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMySales = async () => {
      try {
        const res = await api.get('/sales/user/my-sales');
        setSales(res.data.sales || []);
      } catch {
        setSales([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMySales();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this estate sale?')) return;
    try {
      await api.delete(`/sales/${id}`);
      setSales((prev) => prev.filter((s) => s._id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="my-sales-page page-wrapper">
      <div className="container">
        <div className="my-sales-header">
          <div>
            <h1>My Estate Sales</h1>
            <p>Welcome back, <strong>{user?.name}</strong>. Manage your posted sales below.</p>
          </div>
          <Link to="/post-sale" className="btn btn-primary">
            + Post New Sale
          </Link>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : sales.length === 0 ? (
          <div className="my-sales-empty">
            <div className="empty-icon">🏡</div>
            <h2>You haven't posted any sales yet</h2>
            <p>Create your first estate sale listing and reach local buyers today.</p>
            <Link to="/post-sale" className="btn btn-primary btn-lg" style={{ marginTop: '24px' }}>
              Post Your First Sale
            </Link>
          </div>
        ) : (
          <div className="my-sales-table">
            <div className="my-sales-table-header">
              <span>Sale</span>
              <span>Location</span>
              <span>Dates</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {sales.map((sale) => {
              const status = getSaleStatus(sale.startDate, sale.endDate);
              return (
                <div key={sale._id} className="my-sales-row">
                  <div className="my-sale-title-col">
                    {sale.imageUrl && (
                      <img src={sale.imageUrl} alt={sale.title} className="my-sale-thumb" />
                    )}
                    <div>
                      <Link to={`/sales/${sale._id}`} className="my-sale-title">{sale.title}</Link>
                      <p className="my-sale-desc">{sale.description.substring(0, 80)}…</p>
                    </div>
                  </div>
                  <span className="my-sale-location">{sale.address?.city}, {sale.address?.state}</span>
                  <span className="my-sale-dates">
                    {formatShortDate(sale.startDate)}<br />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>– {formatShortDate(sale.endDate)}</span>
                  </span>
                  <span>
                    <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>
                  </span>
                  <div className="my-sale-actions">
                    <Link to={`/sales/${sale._id}`} className="btn btn-ghost btn-sm">View</Link>
                    <button
                      className="btn btn-sm"
                      style={{ color: '#c0392b', borderColor: '#c0392b' }}
                      onClick={() => handleDelete(sale._id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
