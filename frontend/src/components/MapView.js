import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, InfoWindow } from '@react-google-maps/api';
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
const MAP_ID = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
const USER_PIN_OPTIONS = {
  background: '#636B2F',
  borderColor: '#ffffff',
  glyphColor: '#ffffff',
  scale: 1.1,
};
const SALE_PIN_OPTIONS = {
  background: '#3D4127',
  borderColor: '#D4DE95',
  glyphColor: '#D4DE95',
  scale: 1.1,
};

function AdvancedMarker({ map, position, title, onClick, pinOptions, zIndex }) {
  const markerRef = useRef(null);
  const listenerRef = useRef(null);

  useEffect(() => {
    if (!map || !position || !window.google?.maps?.marker?.AdvancedMarkerElement) {
      return undefined;
    }

    const { AdvancedMarkerElement, PinElement } = window.google.maps.marker;
    const pin = new PinElement(pinOptions);
    const marker = new AdvancedMarkerElement({
      map,
      position,
      title,
      content: pin.element,
      zIndex,
    });

    markerRef.current = marker;

    if (onClick) {
      listenerRef.current = marker.addListener('click', onClick);
    }

    return () => {
      if (listenerRef.current) {
        listenerRef.current.remove();
        listenerRef.current = null;
      }

      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
    };
  }, [map, onClick, pinOptions, position, title, zIndex]);

  return null;
}

export default function MapView({ sales, userLocation, onBoundsChange }) {
  const [selectedSale, setSelectedSale] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const mapRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places', 'marker'],
  });

  const center = userLocation
    ? { lat: userLocation.lat, lng: userLocation.lng }
    : DEFAULT_CENTER;

  const zoom = userLocation ? 11 : DEFAULT_ZOOM;

  const onLoad = useCallback((map) => {
    mapRef.current = map;
    setMapInstance(map);
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
        mapId: MAP_ID,
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
      {userLocation && mapInstance && (
        <AdvancedMarker
          map={mapInstance}
          position={{ lat: userLocation.lat, lng: userLocation.lng }}
          pinOptions={USER_PIN_OPTIONS}
          title="Your location"
          zIndex={1000}
        />
      )}

      {/* Sale markers */}
      {sales.map((sale) => {
        const [lng, lat] = sale.location.coordinates;
        return (
          mapInstance && (
            <AdvancedMarker
              key={sale._id}
              map={mapInstance}
              position={{ lat, lng }}
              onClick={() => setSelectedSale(sale)}
              pinOptions={SALE_PIN_OPTIONS}
              title={sale.title}
            />
          )
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
