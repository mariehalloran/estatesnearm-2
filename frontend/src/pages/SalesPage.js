import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import MapView from '../components/MapView';
import SaleCard from '../components/SaleCard';
import './SalesPage.css';

const RADIUS_OPTIONS = [10, 25, 50, 100];

export default function SalesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [userLocation, setUserLocation] = useState(null);
  const [searchInput, setSearchInput] = useState(searchParams.get('address') || '');
  const [radius, setRadius] = useState(50);
  const [view, setView] = useState('split'); // 'map' | 'list' | 'split'
  const [page, setPage] = useState(1);

  const fetchSales = useCallback(async (lat, lng, r = radius, p = 1) => {
    setLoading(true);
    try {
      const params = { radius: r, page: p, limit: 12 };
      if (lat && lng) { params.lat = lat; params.lng = lng; }
      const res = await api.get('/sales', { params });
      if (p === 1) {
        setSales(res.data.sales || []);
      } else {
        setSales((prev) => [...prev, ...(res.data.sales || [])]);
      }
      setTotal(res.data.total || 0);
    } catch {
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [radius]);

  // Geocode address via Google Maps Geocoding API and search
  const geocodeAndSearch = useCallback(async (address) => {
    const key = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!key) {
      // No Maps key — just search without location
      fetchSales(null, null);
      return;
    }
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
      );
      const data = await res.json();
      if (data.results?.[0]) {
        const { lat, lng } = data.results[0].geometry.location;
        setUserLocation({ lat, lng });
        fetchSales(lat, lng);
      } else {
        fetchSales(null, null);
      }
    } catch {
      fetchSales(null, null);
    }
  }, [fetchSales]);

  // On mount: try geolocation or address from query
  useEffect(() => {
    const address = searchParams.get('address');
    if (address) {
      geocodeAndSearch(address);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          fetchSales(latitude, longitude);
        },
        () => fetchSales(null, null)
      );
    } else {
      fetchSales(null, null);
    }
  }, []); // eslint-disable-line

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchParams({ address: searchInput.trim() });
      geocodeAndSearch(searchInput.trim());
      setPage(1);
    }
  };

  const handleRadiusChange = (r) => {
    setRadius(r);
    setPage(1);
    if (userLocation) fetchSales(userLocation.lat, userLocation.lng, r, 1);
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchSales(userLocation?.lat, userLocation?.lng, radius, nextPage);
  };

  return (
    <div className="sales-page">
      {/* Search Bar */}
      <div className="sales-search-bar">
        <div className="container">
          <form className="sales-search-form" onSubmit={handleSearch}>
            <div className="sales-search-input-wrap">
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <input
                type="text"
                placeholder="Search by address, city, or ZIP..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary">Search</button>
          </form>

          <div className="sales-controls">
            <div className="radius-picker">
              <span>Radius:</span>
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  className={`radius-btn ${radius === r ? 'active' : ''}`}
                  onClick={() => handleRadiusChange(r)}
                >
                  {r} mi
                </button>
              ))}
            </div>

            <div className="view-toggle">
              <button
                className={`view-btn ${view === 'list' ? 'active' : ''}`}
                onClick={() => setView('list')}
                title="List view"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                List
              </button>
              <button
                className={`view-btn ${view === 'split' ? 'active' : ''}`}
                onClick={() => setView('split')}
                title="Split view"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="8" height="18" rx="1"/><rect x="13" y="3" width="8" height="18" rx="1"/>
                </svg>
                Split
              </button>
              <button
                className={`view-btn ${view === 'map' ? 'active' : ''}`}
                onClick={() => setView('map')}
                title="Map view"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
                </svg>
                Map
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="sales-results-bar container">
        <span className="results-count">
          {loading ? 'Searching…' : `${total} sale${total !== 1 ? 's' : ''} found`}
        </span>
      </div>

      {/* Main content */}
      <div className={`sales-main ${view}`}>
        {/* Map pane */}
        {(view === 'map' || view === 'split') && (
          <div className="sales-map-pane">
            <MapView sales={sales} userLocation={userLocation} />
          </div>
        )}

        {/* List pane */}
        {(view === 'list' || view === 'split') && (
          <div className="sales-list-pane">
            {loading && sales.length === 0 ? (
              <div className="spinner" style={{ marginTop: '60px' }} />
            ) : sales.length === 0 ? (
              <div className="empty-state" style={{ padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏡</div>
                <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--dark)', marginBottom: '8px' }}>No sales found</h3>
                <p style={{ color: 'var(--text-muted)' }}>Try expanding your search radius or searching in a different area.</p>
              </div>
            ) : (
              <>
                <div className={`sales-list-grid ${view === 'split' ? 'single-col' : 'multi-col'}`}>
                  {sales.map((sale) => (
                    <SaleCard key={sale._id} sale={sale} />
                  ))}
                </div>
                {sales.length < total && (
                  <div style={{ textAlign: 'center', padding: '32px' }}>
                    <button
                      className="btn btn-outline"
                      onClick={loadMore}
                      disabled={loading}
                    >
                      {loading ? 'Loading…' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
