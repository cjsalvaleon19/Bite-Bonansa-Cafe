export const DELIVERY_LOCATION_OPTIONS = [
  { id: 'poblacion-tanco', barangay: 'Poblacion', landmark: 'Tanco', fee: 25 },
  { id: 'poblacion-blancia', barangay: 'Poblacion', landmark: 'Blancia', fee: 25 },
  { id: 'poblacion-saging', barangay: 'Poblacion', landmark: 'Saging', fee: 35 },
  { id: 'poblacion-narra', barangay: 'Poblacion', landmark: 'Narra', fee: 25 },
  { id: 'poblacion-tboli-national-high-school', barangay: 'Poblacion', landmark: 'Tboli National High School', fee: 25 },
  { id: 'edwards-chavez', barangay: 'Edwards', landmark: 'Chavez', fee: 35 },
  { id: 'edwards-pag-asa', barangay: 'Edwards', landmark: 'Pag-asa', fee: 40 },
  { id: 'edwards-elementary-school', barangay: 'Edwards', landmark: 'Elementary School', fee: 50 },
  { id: 'edwards-national-high-school', barangay: 'Edwards', landmark: 'National High School', fee: 55 },
  { id: 'kematu-ipil-ipil', barangay: 'Kematu', landmark: 'Ipil-Ipil', fee: 75 },
  { id: 'kematu-centro', barangay: 'Kematu', landmark: 'Centro', fee: 85 },
];

export const getDeliveryLocationById = (id) =>
  DELIVERY_LOCATION_OPTIONS.find((location) => location.id === id) || null;

export const formatDeliveryLocationLabel = (location) =>
  `${location.barangay} - ${location.landmark}`;

export const formatDeliveryLocationAddress = (location) =>
  `${location.landmark}, Brgy. ${location.barangay}, T'boli, South Cotabato`;
