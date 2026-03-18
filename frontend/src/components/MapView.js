import React, { useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Link } from 'react-router-dom';
import { formatShortDate } from '../utils/dateUtils';
import './MapView.css';

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#f5f3ec' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#3d4127' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#fafaf7' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#bac095' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#d9dec4' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d4de95' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#bac095' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c5d5e8' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#636b2f' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d4de95' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const MAP_CONTAINER = { width: '100%', height: '100%' };
const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 }; // USA center
const DEFAULT_ZOOM = 5;

export default function MapView({ sales, userLocation, onBoundsChange }) {
  const [selectedSale, setSelectedSale] = useState(null);
  const mapRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'],
  });

  const center = userLocation
    ? { lat: userLocation.lat, lng: userLocation.lng }
    : DEFAULT_CENTER;

  const zoom = userLocation ? 11 : DEFAULT_ZOOM;

  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const onIdle = useCallback(() => {
    if (mapRef.current && onBoundsChange) {
      const bounds = mapRef.current.getBounds();
      if (bounds) onBoundsChange(bounds);
    }
  }, [onBoundsChange]);

  if (loadError) {
    return (
      <div className="map-error">
        <p>⚠️ Map failed to load. Please check your Google Maps API key.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="map-loading">
        <div className="spinner" />
        <p>Loading map…</p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={MAP_CONTAINER}
      center={center}
      zoom={zoom}
      options={{
        styles: MAP_STYLES,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      }}
      onLoad={onLoad}
      onIdle={onIdle}
    >
      {/* User location marker */}
      {userLocation && (
        <Marker
          position={{ lat: userLocation.lat, lng: userLocation.lng }}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#636B2F',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          }}
          title="Your location"
          zIndex={1000}
        />
      )}

      {/* Sale markers */}
      {sales.map((sale) => {
        const [lng, lat] = sale.location.coordinates;
        return (
          <Marker
            key={sale._id}
            position={{ lat, lng }}
            onClick={() => setSelectedSale(sale)}
            icon={{
              path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
              fillColor: '#3D4127',
              fillOpacity: 1,
              strokeColor: '#D4DE95',
              strokeWeight: 1.5,
              scale: 1.6,
              anchor: new window.google.maps.Point(12, 22),
            }}
          />
        );
      })}

      {/* Info window */}
      {selectedSale && (
        <InfoWindow
          position={{
            lat: selectedSale.location.coordinates[1],
            lng: selectedSale.location.coordinates[0],
          }}
          onCloseClick={() => setSelectedSale(null)}
        >
          <div className="map-info-window">
            {selectedSale.imageUrl && (
              <img src={selectedSale.imageUrl} alt={selectedSale.title} className="map-iw-img" />
            )}
            <div className="map-iw-body">
              <h4>{selectedSale.title}</h4>
              <p className="map-iw-address">{selectedSale.address?.full}</p>
              <p className="map-iw-dates">
                {formatShortDate(selectedSale.startDate)} — {formatShortDate(selectedSale.endDate)}
              </p>
              <Link to={`/sales/${selectedSale._id}`} className="map-iw-link">
                View Details →
              </Link>
            </div>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}
