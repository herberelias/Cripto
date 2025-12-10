-- Tabla para guardar resultados de señales
CREATE TABLE IF NOT EXISTS resultado_senales (
  id INT PRIMARY KEY AUTO_INCREMENT,
  senal_id INT NOT NULL,
  resultado ENUM('ganadora', 'perdedora', 'pendiente') DEFAULT 'pendiente',
  precio_alcanzado DECIMAL(15,2),
  tipo_cierre ENUM('take_profit', 'stop_loss', 'expiracion', 'manual') NOT NULL,
  fecha_verificacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (senal_id) REFERENCES senales(id) ON DELETE CASCADE,
  INDEX idx_senal_id (senal_id),
  INDEX idx_resultado (resultado),
  INDEX idx_fecha (fecha_verificacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla para estadísticas agregadas
CREATE TABLE IF NOT EXISTS estadisticas_senales (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rango_puntuacion VARCHAR(20) NOT NULL UNIQUE,
  puntuacion_min INT NOT NULL,
  puntuacion_max INT NOT NULL,
  total_senales INT DEFAULT 0,
  senales_ganadoras INT DEFAULT 0,
  senales_perdedoras INT DEFAULT 0,
  tasa_acierto DECIMAL(5,2) DEFAULT 0,
  probabilidad_ajustada DECIMAL(5,2) DEFAULT 0,
  ganancia_promedio DECIMAL(15,2) DEFAULT 0,
  perdida_promedio DECIMAL(15,2) DEFAULT 0,
  ratio_riesgo_beneficio DECIMAL(5,2) DEFAULT 0,
  ultima_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rango (rango_puntuacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insertar rangos iniciales
INSERT INTO estadisticas_senales (rango_puntuacion, puntuacion_min, puntuacion_max) VALUES
('30-40', 30, 40),
('40-50', 40, 50),
('50-60', 50, 60),
('60-70', 60, 70),
('70-100', 70, 100)
ON DUPLICATE KEY UPDATE puntuacion_min=VALUES(puntuacion_min), puntuacion_max=VALUES(puntuacion_max);

-- Tabla para histórico de rendimiento diario
CREATE TABLE IF NOT EXISTS rendimiento_diario (
  id INT PRIMARY KEY AUTO_INCREMENT,
  fecha DATE NOT NULL UNIQUE,
  total_senales INT DEFAULT 0,
  senales_ganadoras INT DEFAULT 0,
  senales_perdedoras INT DEFAULT 0,
  tasa_acierto DECIMAL(5,2) DEFAULT 0,
  ganancia_total DECIMAL(15,2) DEFAULT 0,
  mejor_senal_id INT,
  peor_senal_id INT,
  INDEX idx_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
