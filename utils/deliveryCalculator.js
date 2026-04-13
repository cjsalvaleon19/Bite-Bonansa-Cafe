export const STORE_LOCATION = {
  name: 'Bite Bonansa',
  address: 'Laconon-Salacafe Rd, Brgy. Poblacion, T\'boli, South Cotabato',
  latitude: 6.2178483,
  longitude: 124.8221226
};

export const calculateDeliveryFee = (distanceInMeters) => {
  const baseFee = 35;
  if (distanceInMeters <= 1000) return baseFee;
  const additionalDistance = distanceInMeters - 1000;
  const additionalFee = Math.ceil(additionalDistance / 200) * 10;
  return baseFee + additionalFee;
};

export const getDeliveryRates = () => [
  { range: '0 – 1,000 m', fee: '₱35' },
  { range: '1,001 – 1,200 m', fee: '₱45' },
  { range: '1,201 – 1,400 m', fee: '₱55' },
  { range: '1,401 – 1,600 m', fee: '₱65' },
];

export const getDistanceBetweenCoordinates = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000);
};

export const formatDistance = (meters) => meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(2)} km`;
