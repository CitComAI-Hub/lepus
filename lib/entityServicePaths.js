// Mapa estático de tipos de entidad a ServicePath
// Si un tipo tiene varios ServicePath, se define como array
const ENTITY_SERVICE_PATHS = {
  WasteContainer: '/residuos_contenedores_vlc',
  TrafficFlowObserved: '/trafico_intensidad_vlc',
  AirQualityObserved: [
    '/calidad_aire_vlc',
    '/calidad_aire_emt_vlc'
  ]
};

module.exports = ENTITY_SERVICE_PATHS;
