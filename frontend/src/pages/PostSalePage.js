import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './PostSalePage.css';

const AVAILABLE_TAGS = [
  'Furniture', 'Antiques', 'Jewelry', 'Art', 'Clothing', 'Collectibles',
  'Electronics', 'Tools', 'Books', 'Kitchen', 'Sports', 'Toys', 'Music', 'Décor',
];

export default function PostSalePage() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    tags: [],
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleTagToggle = (tag) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const geocodeAddress = async () => {
    const address = `${form.street}, ${form.city}, ${form.state} ${form.zip}`;
    const key = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!key) return null;

    setGeocoding(true);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
      );
      const data = await res.json();
      if (data.results?.[0]) {
        const { lat, lng } = data.results[0].geometry.location;
        return [lng, lat]; // GeoJSON: [lng, lat]
      }
      return null;
    } catch {
      return null;
    } finally {
      setGeocoding(false);
    }
  };

  const uploadImage = async () => {
    if (!imageFile) return null;
    const formData = new FormData();
    formData.append('image', imageFile);
    const res = await api.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.imageUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate dates
    if (new Date(form.startDate) > new Date(form.endDate)) {
      setError('End date must be on or after start date.');
      return;
    }

    setSubmitting(true);
    try {
      // Geocode
      const coordinates = await geocodeAddress();
      if (!coordinates) {
        setError('Could not locate that address. Please double-check and try again.');
        setSubmitting(false);
        return;
      }

      // Upload image if provided
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage();
      }

      const payload = {
        title: form.title,
        description: form.description,
        imageUrl,
        address: {
          street: form.street,
          city: form.city,
          state: form.state,
          zip: form.zip,
        },
        location: { type: 'Point', coordinates },
        startDate: form.startDate,
        endDate: form.endDate,
        startTime: form.startTime,
        endTime: form.endTime,
        tags: form.tags,
      };

      const res = await api.post('/sales', payload);
      navigate(`/sales/${res.data.sale._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="post-page">
      <div className="post-header">
        <div className="container">
          <h1>Post an Estate Sale</h1>
          <p>Fill in the details below to list your estate sale and reach local buyers.</p>
        </div>
      </div>

      <div className="post-body container">
        <form className="post-form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}

          {/* Image Upload */}
          <div className="post-section">
            <h2><span className="step-num">1</span> Sale Photo</h2>
            <div
              className={`image-drop-zone ${imagePreview ? 'has-image' : ''}`}
              onClick={() => fileRef.current?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="image-preview" />
              ) : (
                <div className="image-drop-placeholder">
                  <div className="drop-icon">📸</div>
                  <p>Click to upload a photo</p>
                  <span>JPEG, PNG, or WebP up to 10MB</span>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
            {imagePreview && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ marginTop: '8px' }}
                onClick={() => { setImageFile(null); setImagePreview(''); }}
              >
                Remove Photo
              </button>
            )}
          </div>

          {/* Basic Info */}
          <div className="post-section">
            <h2><span className="step-num">2</span> Sale Details</h2>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="title">Sale Title *</label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  placeholder="e.g. Johnson Family Estate Sale — 40 Years of Collectibles"
                  value={form.title}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="description">Description *</label>
                <textarea
                  id="description"
                  name="description"
                  placeholder="Describe what's being sold, condition of items, any special highlights..."
                  value={form.description}
                  onChange={handleChange}
                  rows={6}
                  required
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="post-section">
            <h2><span className="step-num">3</span> Location</h2>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="street">Street Address *</label>
                <input
                  id="street"
                  name="street"
                  type="text"
                  placeholder="123 Maple Street"
                  value={form.street}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="city">City *</label>
                <input id="city" name="city" type="text" placeholder="Springfield" value={form.city} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="state">State *</label>
                <input id="state" name="state" type="text" placeholder="IL" value={form.state} onChange={handleChange} required maxLength={2} />
              </div>
              <div className="form-group">
                <label htmlFor="zip">ZIP Code *</label>
                <input id="zip" name="zip" type="text" placeholder="62701" value={form.zip} onChange={handleChange} required />
              </div>
            </div>
            <p className="form-hint">We'll use this address to pin your sale on the map.</p>
          </div>

          {/* Date & Time */}
          <div className="post-section">
            <h2><span className="step-num">4</span> Date &amp; Time</h2>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="startDate">Start Date *</label>
                <input id="startDate" name="startDate" type="date" value={form.startDate} onChange={handleChange} required min={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="form-group">
                <label htmlFor="endDate">End Date *</label>
                <input id="endDate" name="endDate" type="date" value={form.endDate} onChange={handleChange} required min={form.startDate || new Date().toISOString().split('T')[0]} />
              </div>
              <div className="form-group">
                <label htmlFor="startTime">Opening Time *</label>
                <input id="startTime" name="startTime" type="time" value={form.startTime} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="endTime">Closing Time *</label>
                <input id="endTime" name="endTime" type="time" value={form.endTime} onChange={handleChange} required />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="post-section">
            <h2>Categories <span className="optional-label">(optional)</span></h2>
            <p className="form-hint">Select all that apply to help buyers find your sale.</p>
            <div className="tags-picker">
              {AVAILABLE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-toggle ${form.tags.includes(tag) ? 'selected' : ''}`}
                  onClick={() => handleTagToggle(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="post-submit">
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={submitting || geocoding}
            >
              {submitting ? 'Publishing…' : geocoding ? 'Locating address…' : 'Publish Estate Sale'}
            </button>
            <p className="post-disclaimer">
              By posting, you agree to our <a href="/terms">Terms & Conditions</a>.
            </p>
          </div>
        </form>

        {/* Sidebar tips */}
        <aside className="post-tips">
          <div className="tips-card">
            <h3>📋 Tips for a Great Listing</h3>
            <ul>
              <li>Use a clear, descriptive title</li>
              <li>Upload a high-quality photo of featured items</li>
              <li>List major categories in the description</li>
              <li>Include payment methods you accept</li>
              <li>Mention if items can be held or pre-purchased</li>
              <li>Add parking instructions if needed</li>
            </ul>
          </div>
          <div className="tips-card">
            <h3>🔒 Privacy Note</h3>
            <p>Your exact address will be visible to all visitors. We recommend confirming your listing is correct before publishing.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
