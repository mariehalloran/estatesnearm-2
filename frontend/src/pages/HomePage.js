import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import MapView from '../components/MapView';
import SaleCard from '../components/SaleCard';
import './HomePage.css';

const TAGS = ['Furniture', 'Antiques', 'Jewelry', 'Art', 'Clothing', 'Collectibles', 'Electronics', 'Tools'];

export default function HomePage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [searchAddress, setSearchAddress] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const navigate = useNavigate();
  const salesSectionRef = useRef(null);

  // Fetch sales near user on load
  useEffect(() => {
    const fetchNearbySales = async (lat, lng) => {
      try {
        const res = await api.get('/sales', { params: { lat, lng, radius: 50, limit: 6 } });
        setSales(res.data.sales || []);
      } catch {
        // fallback: fetch all
        try {
          const res = await api.get('/sales', { params: { limit: 6 } });
          setSales(res.data.sales || []);
        } catch {}
      } finally {
        setLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setLocationLabel('your area');
          fetchNearbySales(latitude, longitude);
        },
        () => {
          // denied — fetch general list
          fetchNearbySales(null, null);
        }
      );
    } else {
      fetchNearbySales(null, null);
    }
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchAddress.trim()) {
      navigate(`/sales?address=${encodeURIComponent(searchAddress.trim())}`);
    }
  };

  const scrollToSales = () => {
    salesSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-shape hero-shape-1" />
          <div className="hero-shape hero-shape-2" />
          <div className="hero-shape hero-shape-3" />
          <div className="hero-dots" />
        </div>

        <div className="hero-content container">
          <div className="hero-text">
            <div className="hero-eyebrow">
              <span className="eyebrow-dot" />
              Local Estate Sales, Curated for You
            </div>
            <h1 className="hero-headline">
              Discover Hidden<br />
              <em>Treasures</em> in<br />
              Your Neighborhood
            </h1>
            <p className="hero-sub">
              Browse estate sales happening near you, or post your own sale and reach thousands of local buyers.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary btn-lg" onClick={scrollToSales}>
                Browse Nearby Sales
              </button>
              <Link to="/post-sale" className="btn btn-outline btn-lg">
                Post a Sale
              </Link>
            </div>
          </div>

          <div className="hero-search-card">
            <div className="search-card-header">
              <span className="search-card-icon">🔍</span>
              <h3>Find Estate Sales Near Me</h3>
              <p>Enter an address, city, or ZIP code</p>
            </div>
            <form className="search-form" onSubmit={handleSearch}>
              <div className="search-input-wrap">
                <svg className="search-pin-icon" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <input
                  type="text"
                  placeholder="123 Main St, Springfield, IL..."
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Search Sales
              </button>
            </form>
            {userLocation && (
              <button className="use-location-btn" onClick={scrollToSales}>
                ◎ Using your current location
              </button>
            )}
          </div>
        </div>

        <div className="hero-stats">
          <div className="container">
            <div className="stats-row">
              <div className="stat">
                <span className="stat-num">Find</span>
                <span className="stat-label">Estate Sales Near You</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-num">Post</span>
                <span className="stat-label">Your Own Sale Free</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-num">Connect</span>
                <span className="stat-label">With Local Buyers</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="map-section">
        <div className="map-section-header container">
          <div>
            <h2>Sales on the Map</h2>
            <p>{userLocation ? `Showing sales near ${locationLabel}` : 'Sales across the country'}</p>
          </div>
          <Link to="/sales" className="btn btn-outline btn-sm">View All Sales →</Link>
        </div>
        <div className="map-container">
          <MapView sales={sales} userLocation={userLocation} />
        </div>
      </section>

      {/* Sales Grid */}
      <section className="sales-section" ref={salesSectionRef}>
        <div className="container">
          <div className="sales-section-header">
            <div>
              <h2>
                {locationLabel ? `Sales Near ${locationLabel.charAt(0).toUpperCase() + locationLabel.slice(1)}` : 'Active & Upcoming Sales'}
              </h2>
              <p>Showing estates currently open or opening soon</p>
            </div>
            <Link to="/sales" className="btn btn-outline btn-sm">Browse All →</Link>
          </div>

          {loading ? (
            <div className="spinner" />
          ) : sales.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏡</div>
              <h3>No sales found nearby</h3>
              <p>Be the first to post an estate sale in your area!</p>
              <Link to="/post-sale" className="btn btn-primary" style={{ marginTop: '16px' }}>
                Post Your Sale
              </Link>
            </div>
          ) : (
            <div className="sales-grid">
              {sales.map((sale) => (
                <SaleCard key={sale._id} sale={sale} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Browse by category */}
      <section className="categories-section">
        <div className="container">
          <h2>Browse by Category</h2>
          <p>Find exactly what you're looking for</p>
          <div className="tags-grid">
            {TAGS.map((tag) => (
              <Link
                key={tag}
                to={`/sales?tag=${encodeURIComponent(tag.toLowerCase())}`}
                className="tag-pill"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-card">
            <div className="cta-text">
              <h2>Ready to Host Your Estate Sale?</h2>
              <p>
                Reach thousands of local buyers in minutes. Post your estate sale for free and connect with your community.
              </p>
              <div className="cta-actions">
                <Link to="/register" className="btn btn-primary btn-lg">Create Free Account</Link>
                <Link to="/about" className="btn btn-ghost btn-lg" style={{ color: 'var(--lime)' }}>Learn More</Link>
              </div>
            </div>
            <div className="cta-decoration">
              <div className="cta-hex cta-hex-1">⬡</div>
              <div className="cta-hex cta-hex-2">⬡</div>
              <div className="cta-hex cta-hex-3">⬡</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
