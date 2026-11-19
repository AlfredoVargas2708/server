/**
 * Cache Manager - Gestor de caché generalizado para todos los controllers
 * Proporciona métodos reutilizables para almacenar, recuperar y gestionar caché
 */

class CacheManager {
  constructor(ttl = 10 * 60 * 1000) {
    this.cache = new Map();
    this.defaultTTL = ttl;
  }

  /**
   * Obtener un valor del caché
   * @param {any} key - Clave de caché
   * @returns {any} Valor en caché o null si está expirado o no existe
   */
  get(key) {
    return this.has(key) ? this.cache.get(key).data : null;
  }

  /**
   * Guardar un valor en caché
   * @param {any} key - Clave de caché
   * @param {any} data - Datos a almacenar
   * @param {number} ttl - Tiempo de vida en milisegundos (opcional, usa default si no se proporciona)
   */
  set(key, data, ttl = this.defaultTTL) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Verificar si una clave existe y está vigente en caché
   * @param {any} key - Clave de caché
   * @returns {boolean} true si existe y es válida, false en caso contrario
   */
  has(key) {
    const cached = this.cache.get(key);
    if (!cached) return false;
    if (Date.now() - cached.timestamp >= cached.ttl) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Eliminar una clave del caché
   * @param {any} key - Clave de caché
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Limpiar todo el caché
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Obtener caché o ejecutar una función si no existe
   * Útil para evitar repetir lógica de verificación de caché
   * @param {any} key - Clave de caché
   * @param {Function} asyncFn - Función asíncrona a ejecutar si no hay caché
   * @param {number} ttl - Tiempo de vida en milisegundos (opcional)
   * @returns {Promise<any>} Valor en caché o resultado de la función
   */
  async getOrSet(key, asyncFn, ttl = this.defaultTTL) {
    // Verificar si existe en caché
    if (this.has(key)) {
      return this.cache.get(key).data;
    }

    // Ejecutar la función y guardar resultado
    const result = await asyncFn();
    this.set(key, result, ttl);

    return result;
  }

  /**
   * Obtener estadísticas del caché
   * @returns {object} Información del caché actual
   */
  getStats() {
    let validCount = 0;
    let expiredCount = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (Date.now() - cached.timestamp >= cached.ttl) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries: validCount,
      expiredEntries: expiredCount,
    };
  }

  /**
   * Limpiar entradas expiradas
   * @returns {number} Cantidad de entradas eliminadas
   */
  cleanup() {
    let deleted = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (Date.now() - cached.timestamp >= cached.ttl) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }
}

export default CacheManager;
