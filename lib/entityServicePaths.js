// Mapa estático de tipos de entidad a ServicePath
// Si un tipo tiene varios ServicePath, se define como array
const ENTITY_SERVICE_PATHS = {
  WasteContainer: '/residuos_contenedores_vlc',
  TrafficFlowObserved: '/trafico_intensidad_vlc',
  // Only the servicePaths that may be offered in the data space: Lepus serves
  // nothing else (?scopeQ= cannot name other ones). /calidad_aire_emt_vlc (EMT
  // sensors) is internal research data and is deliberately left out.
  AirQualityObserved: '/calidad_aire_vlc'
};

module.exports = ENTITY_SERVICE_PATHS;
