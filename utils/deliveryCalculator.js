export const STORE_LOCATION = {
  name: 'Bite Bonansa',
  address: 'Laconon-Salacafe Rd, Brgy. Poblacion, T\'boli, South Cotabato',
  latitude: 6.2178483,
  longitude: 124.8221226
};

export const calculateDeliveryFee = (distanceInMeters) => {
  const baseFee = 30;
  
  if (distanceInMeters <= 1000) return baseFee;
  else if (distanceInMeters <= 1500) return baseFee + 5;
  else if (distanceInMeters <= 2000) return baseFee + 10;
  else if (distanceInMeters <= 2500) return baseFee + 15;
  else if (distanceInMeters <= 3000) return baseFee + 20;
  else if (distanceInMeters <= 3500) return baseFee + 24;
  else if (distanceInMeters <= 4000) return baseFee + 28;
  else if (distanceInMeters <= 4500) return baseFee + 32;
  else if (distanceInMeters <= 5000) return baseFee + 36;
  else if (distanceInMeters <= 5500) return baseFee + 40;
  else if (distanceInMeters <= 6000) return baseFee + 44;
  else if (distanceInMeters <= 6500) return baseFee + 47;
  else if (distanceInMeters <= 7000) return baseFee + 50;
  else if (distanceInMeters <= 7500) return baseFee + 53;
  else if (distanceInMeters <= 8000) return baseFee + 56;
  else if (distanceInMeters <= 8500) return baseFee + 59;
  else if (distanceInMeters <= 9000) return baseFee + 62;
  else if (distanceInMeters <= 9500) return baseFee + 65;
  else return baseFee + 68; // Capped at ₱98 for 10km+
};

export const getDeliveryRates = () => [
  { range: '0 – 1,000 m', fee: '₱30' },
  { range: '1,001 – 1,500 m', fee: '₱35' },
  { range: '1,501 – 2,000 m', fee: '₱40' },
  { range: '2,001 – 2,500 m', fee: '₱45' },
  { range: '2,501 – 3,000 m', fee: '₱50' },
  { range: '3,001 – 3,500 m', fee: '₱54' },
  { range: '3,501 – 4,000 m', fee: '₱58' },
  { range: '4,001 – 4,500 m', fee: '₱62' },
  { range: '4,501 – 5,000 m', fee: '₱66' },
  { range: '5,001 – 5,500 m', fee: '₱70' },
  { range: '5,501 – 6,000 m', fee: '₱74' },
  { range: '6,001 – 6,500 m', fee: '₱77' },
  { range: '6,501 – 7,000 m', fee: '₱80' },
  { range: '7,001 – 7,500 m', fee: '₱83' },
  { range: '7,501 – 8,000 m', fee: '₱86' },
  { range: '8,001 – 8,500 m', fee: '₱89' },
  { range: '8,501 – 9,000 m', fee: '₱92' },
  { range: '9,001 – 9,500 m', fee: '₱95' },
  { range: '9,501 – 10,000 m', fee: '₱98' },
];

export const getDistanceBetweenCoordinates = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000);
};

export const formatDistance = (meters) => meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(2)} km`;
