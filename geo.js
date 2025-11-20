/* Stores the latitude and longitude defining a geograpical location. */
class GeoLocation {
    /**
     * The latitude component of this location's coordinates.
     * @private
     * @type {number}
     */
    #latitude = 0.0;

    /**
     * The longitude component of this location's coordinates.
     * @private
     * @type {number}
     */
    #longitude = 0.0;

    /**
     * Initializes a location using the provided latitude and longitude coordinates.
     * @param {number} lat - The latitude component of this location.
     * @param {number} lon - The longitude component of this location.
     * @throws {TypeError} Invalid coordinate.
     */
    constructor(lat, lon) {
        if (isNaN(lat)) throw new TypeError(`Invalid latitude: ${lat}`);
        if (isNaN(lon)) throw new TypeError(`Invalid longitude: ${lon}`);

        this.#latitude = lat;
        this.#longitude = lon;
    }

    /**
     * Latitude component of this location's coordinates.
     * @type {number}
     */
    get latitude() { return this.#latitude; }
    set latitude(lat) { this.#latitude = lat; }

    /**
     * Longitude component of this location's coordinates.
     * @type {number}
     */
    get longitude() { return this.#longitude; }
    set longitude(lon) { this.#longitude = lon; }

    /**
     * Obtain a new object with duplicate data as this one.
     * @returns {GeoLocation} The duplicate object.
     */
    getCopy() {
        return new GeoLocation(this.#latitude, this.#longitude);
    }
}

/**
 * Convert a distance from feet into meters.
 * @param {number} distanceFeet - The original distance in feet.
 * @returns {number} Distance converted into meters.
 */
function feetToMeters(distanceFeet) {    
    return distanceFeet * 0.3048;
}

/**
 * Convert a distance from meters into feet.
 * @param {number} distanceMeters - The original distance in meters.
 * @returns {number} Distance converted into feet.
 */
function metersToFeet(distanceMeters) {    
    return distanceMeters / 0.3048;
}

/**
 * Returns the provided angle in radians after conversion from degrees
 * @param   {number} degrees - Angle in degrees to be converted
 * @returns {number} Angle converted to radians
 */
function degreesToRadians(degrees) {
    return degrees * Math.PI / 180.0;
}

/**
 * Returns the provided angle in radians after conversion from degrees
 * @param   {number} radians - Angle in radians to be converted
 * @returns {number} Angle converted to radians
 */
function radiansToDegrees(radians) {
    return radians * 180.0 / Math.PI;
}

/**
 * Updates a GeoLocation's data by moving the given distance along the given bearing.
 * @param   {GeoLocation} geoPosition - Initial location and to be updated as the destination.
 * @param   {number} distance - Distance (meters) to move.
 * @param   {number} bearing - Bearing (degrees from North) to move.
 */
function moveAlongBearing(geoPosition, distance, bearing) {
    // Dividing by the mean radius of Earth in meters
    const angularDistance = distance / 6371000;
    const bearingRadians = degreesToRadians(bearing);

    const latitudeRadians = degreesToRadians(geoPosition.latitude);
    const longitudeRadians = degreesToRadians(geoPosition.longitude);

    const sinPhi2 = Math.sin(latitudeRadians) * Math.cos(angularDistance) + Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearingRadians);
    const y = Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(latitudeRadians);
    const x = Math.cos(angularDistance) - Math.sin(latitudeRadians) * sinPhi2;

    // Update the values within the location object
    geoPosition.latitude = radiansToDegrees(Math.asin(sinPhi2));
    geoPosition.longitude = radiansToDegrees(longitudeRadians + Math.atan2(y, x));
}

/**
 * Updates a GeoLocation's data by moving the given distance along the given bearing.
 * @param   {GeoLocation} geoPosition - Initial location and to be updated as the destination.
 * @param   {number} distance - Distance (meters) to move.
 * @param   {number} bearing - Bearing (degrees from North) to move.
 */
function moveAlongBearingKilometers(geoPosition, distance, bearing) {
    // Convert the distance from meters to kilometers
    const distanceKM = distance / 1000.0;

    // Dividing by the mean radius of Earth in kilometers
    const angularDistance = distanceKM / 6371.0;
    const bearingRadians = degreesToRadians(bearing);

    const latitudeRadians = degreesToRadians(geoPosition.latitude);
    const longitudeRadians = degreesToRadians(geoPosition.longitude);

    const sinPhi2 = Math.sin(latitudeRadians) * Math.cos(angularDistance) + Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearingRadians);
    const y = Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(latitudeRadians);
    const x = Math.cos(angularDistance) - Math.sin(latitudeRadians) * sinPhi2;

    // Update the values within the location object
    geoPosition.latitude = radiansToDegrees(Math.asin(sinPhi2));
    geoPosition.longitude = radiansToDegrees(longitudeRadians + Math.atan2(y, x));
}

/**
 * Calculates the distance (meters) between two GeoLocations. The ‘haversine’ formula is used
 * to calculate the shortest distance over the earth’s spherical surface.
 * @param {GeoLocation} locationA - First location.
 * @param {GeoLocation} locationB - Second location.
 * @returns {number} - Distance (meters) between the two specified locations.
 */
function distanceBetweenLocations(locationA, locationB) {
    // Convert the coordinate components from degrees to radians
    const latitudeA = degreesToRadians(locationA.latitude);
    const longitudeA = degreesToRadians(locationA.longitude);
    const latitudeB = degreesToRadians(locationB.latitude);
    const longitudeB = degreesToRadians(locationB.longitude);

    const latitudeDelta= latitudeB - latitudeA;
    const longitudeDelta = longitudeB - longitudeA;

    // Calculate the square of half the chord length between the points.
    let a = Math.sin(latitudeDelta / 2.0);
    a *= a;
    a += (Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2.0)* Math.sin(longitudeDelta / 2.0));

    // Now we can calculate the angular distance in radians.
    const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));

    // Finally we multiply by the mean radius of earth in metres.
    return c * 6371000.0;
}

/**
 * Calculates the bearing (degrees from North) between two GeoLocations.
 * @param {GeoLocation} locationA - First location.
 * @param {GeoLocation} locationB - Second location.
 * @returns {number} - Bearing (degrees from North) from locationA toward locationB. NaN if both locations are identical.
 */
function bearingBetweenLocations(locationA, locationB) {
    if (locationA.latitude === locationB.latitude && locationB.longitude === locationB.longitude) {
        return NaN;
    }
    // Convert the coordinate components from degrees to radians
    const latitudeA = degreesToRadians(locationA.latitude);
    const latitudeB = degreesToRadians(locationB.latitude);
    const longitudeDelta = degreesToRadians(locationB.longitude - locationA.longitude);

    const x = Math.cos(latitudeA) * Math.sin(latitudeB) - Math.sin(latitudeA) * Math.cos(latitudeB) * Math.cos(longitudeDelta);
    const y = Math.sin(longitudeDelta) * Math.cos(latitudeB);
    const θ = Math.atan2(y, x);

    const bearing = radiansToDegrees(Math.atan2(y, x));

    // Ensure the resulting bearing is within the expected 0 -> 360 degree range.
    if (bearing < 0) {
        return bearing + 360;
    } else if (bearing > 360) {
        return brearing - 360;
    }
    return bearing;
}

export { GeoLocation };
export { feetToMeters, metersToFeet, moveAlongBearing, moveAlongBearingKilometers, distanceBetweenLocations, bearingBetweenLocations };