import { GeoLocation, moveAlongBearingKilometers, feetToMeters } from "./geo.js";
//import { wind0900 } from "./hedley.js";

/* Class storing wind speed and direction at a specific altitude. */
class WindAtAltitude {
    /**
     * The altitude (in feet) where this wind is located.
     * @private
     * @type {number}
     */
    #altitude = 0;

    /**
     * The speed of the wind (in MPH).
     * @private
     * @type {number}
     */
    #windSpeed = 0;

    /**
     * Direction of the wind (degrees from 0 North).
     * @private
     * @type {number}
     */
    #windDirection = 0;

    /**
     * Initializes to the provided wind speed and direction at the specified altitude.
     * @param {number} alt - Altitude (in feet).
     * @param {number} speed - Wind speed (in knots).
     * @param {number} dir - Wind direction (in degrees from North).
     * @throws {TypeError} Invalid alt/speed/dir.
     */
    constructor(alt, speed, dir) {
        // Verify the provided values are all valid numbers
        if (isNaN(alt)) throw new TypeError(`Invalid wind altitude: ${alt}`);
        if (isNaN(speed)) throw new TypeError(`Invalid wind speed: ${speed}`);
        if (isNaN(dir)) throw new TypeError(`Invalid wind direction: ${dir}`);

        this.#altitude = alt;
        this.#windSpeed = speed;
        this.#windDirection = dir;
    }

    /**
     * Get the altitude where the described wind is located.
     * @type {number}
     */
    get altitude() {
        return this.#altitude;
    }

    /**
     * Get the wind's speed at this altitude.
     * @type {number}
     */
    get windSpeed() {
        return this.#windSpeed;
    }

    /**
     * Get the wind's direction at this altitude.
     * @type {number}
     */
    get windDirection() {
        return this.#windDirection;
    }
}

/* Class containing wind data at all available altitudes from a particular forecast model. */
class WindForecastData {
    /**
     * String identifying which model (RAP or Open-Meteo) was used for this forecast.
     * @private
     * @type {string}
     */
    #model = '';

    /**
     * List of wind data (speed/direction) at various altitudes.
     * @private
     * @type {Array.<WindAtAltitude>}
     */
    #windData = [];

    /**
     * Elevation at the location where this forecast was requested.
     * @private
     * @type {number}
     */
    #groundElevation = 0;

    /**
     * Wind speed (knots) at ground level.
     * @private
     * @type {number}
     */
    #groundWindSpeed = 0;

    /**
     * Wind direction (degrees from 0 north) at ground level.
     * @private
     * @type {number}
     */
    #groundWindDirection = 0;

    /**
     * Initializes to the provided wind speed and direction at the specified altitude.
     * @param {json} windJSON - A JSON formated object contaning raw data associated with a wind forecast.
     * @throws {TypeError} Invalid windForecast.
     */
    constructor(windJSON) {
        this.#model = windJSON.model;

        // References to different wind data objects based on the prediction model
        var altitudes;
        var windSpeeds;
        var windDirections;

        if ('RAP' == this.#model) {
            // Ignore duplicate altitude entries
            altitudes = new Set(windJSON.altFtRaw);
            windSpeeds = windJSON.speedRaw;
            windDirections = windJSON.directionRaw;
        } else {
            // Ignore duplicate altitude entries
            altitudes = new Set(windJSON.altFt);
            windSpeeds = windJSON.speed;
            windDirections = windJSON.direction;
        }

        // Convert the altitude set into an array so it can be sorted
        altitudes = Array.from(altitudes);
        altitudes.sort((a, b) => {
            if (a < b) {
                return -1;
            } else if (a > b) {
                return 1;
            }
            return 0;
        });

        // Add a new object to our array containing data for each altitude
        for (const currentAlt of altitudes) {
            let stringAlt = currentAlt.toString();

            // Verify wind speed and direction at this altitude are available
            if (stringAlt in windSpeeds && stringAlt in windDirections) {
                this.#windData.push(new WindAtAltitude(currentAlt, parseInt(windSpeeds[stringAlt]), parseInt(windDirections[stringAlt])));
            } else {
                console.debug(`Failed to find wind data for altitude ${currentAlt}`);
            }
        }

        if ('groundElev' in windJSON) {
            this.#groundElevation = windJSON['groundElev'];
        }
        if ('groundSpd' in windJSON) {
            this.#groundWindSpeed = windJSON['groundSpd'];
        }
        if ('groundSpd' in windJSON) {
            this.#groundWindDirection = windJSON['groundSpd'];
        }
    }

    /**
     * Get the latitude component of this location's coordinates.
     * @type {string}
     */
    get model() { return this.#model; }

    /**
     * Get the list of wind data (speed/direction) at various altitudes.
     * @type {Array.<WindAtAltitude>}
     */
    get windData() { return this.#windData; }

    /**
     * The ground's elevation at location of this forecast.
     * @type {number}
     */
    get groundElevation() { return this.#groundElevation; }

    /**
     * The wind speed (knots) at ground level.
     * @type {number}
     */
    get groundWindSpeed() { return this.#groundWindSpeed; }

    /**
     * The wind direction (degrees from 0 north) at ground level.
     * @type {number}
     */
    get groundWindDirection() { return this.#groundWindDirection; }
}

/* Class storing expected results of weathercocking at a particular wind speed. */
class WeathercockWindData {
    /**
     * Initializes to the provided weathercocking results at the specified wind speed.
     * @param {number} speed - Wind speed (in MPH) at ground level.
     * @param {number} dist - Distance (in feet) the rocket travels up wind.
     * @param {number} alt - Altitude (in feet) the rocket is expected to reach.
     * @throws {TypeError} Invalid alt/speed/dir.
     */
    constructor(speed, dist, alt) {
        // Verify the provided values are all valid numbers
        if (isNaN(speed)) throw new TypeError(`Invalid weathercock wind speed: ${speed}`);
        if (isNaN(dist)) throw new TypeError(`Invalid weathercock distance: ${dist}`);
        if (isNaN(alt)) throw new TypeError(`Invalid weathercock altitude: ${alt}`);

        /**
         * The wind speed (in MPH) at ground level.
         * @type {number}
         */
        this.windSpeed = speed;

        /**
         * The distance (in feet) the rocket travels up wind.
         * @type {number}
         */
        this.upwindDistance = dist;

        /**
         * The altitude (in feet) the rocket is expected to reach.
         * @type {number}
         */
        this.apogee = alt;
    }
}

/**
 * Requests wind forecast data from WindsAloft server to be provided as a JSON object.
 * @param {GeoLocation} launchLocation - Coordinates of the launch location.
 * @param {number} hourOffset - Offset (in hours) from the current time of the desired forecast.
 * @returns {WindForecastData} Wind forecast data at the specified location and time. 'null' if an error occurred.
 */
async function getWindPredictionData(launchLocation, hourOffset) {
    let windForecast = null;

    const timeAndPlace = {
        "latitude": launchLocation.latitude,
        "longitude": launchLocation.longitude,
        "hour_offset": hourOffset
    };

    const fetchOptions = {
        "method": "POST",
        "headers": {
            "Content-Type": "application/json; charset=utf-8"
        },
        "body": JSON.stringify(timeAndPlace)
    };

    await fetch('get_wind_forecast.php', fetchOptions)
        .then((response) => {
            if (response.ok) {
                return response.json();
            } else {
                console.debug(`Request failed for winds for lat ${launchLocation.latitude}, lon ${launchLocation.longitude}, and hour offset ${hourOffset}`);
                return null;
            }
        })
        .then((windJSON) => {
            if (null != windJSON) {
                windForecast = new WindForecastData(windJSON);
            }
        })
        .catch(error => {
            console.debug(`An error was caught while fetching a wind forecast. ${error.message}`);
        });

    return windForecast;

    // return new WindForecastData(wind0900);
}

/**
 * Calculates where a rocket's altitude is located within a wind band.
 * @param   {number} rocketAltitude - Current altitude (feet) of the rocket.
 * @param   {Array.<WindAtAltitude>} windData - Array of data defining available wind bands including altitudes (feet).
 * @param   {number} floorIndex - Index into windData identifying the floor of this wind band.
 * @returns {number} Percentage of this wind band above the floor where the rocket is located. -1 if outside the range.
 */
function getWindBandPercentage(rocketAltitude, windData, floorIndex) {
    // Run a safety check to avoid a potential out of bounds error.
    if (floorIndex < 0 || (floorIndex + 1) >= windData.length) {
        console.debug(`Provided index ${floorIndex} will exceed the bounds of the wind data array ${windData.length}`);
        return -1;
    }
    // Also cannot proceed if rocket is outside this wind band's altitude range.
    const altitudeFloor = windData[floorIndex].altitude;
    const altitudeCeiling = windData[floorIndex + 1].altitude;
    if (rocketAltitude < altitudeFloor || rocketAltitude > altitudeCeiling) {
        console.debug(`Rocket altitude ${rocketAltitude} is outside the provided range between ${altitudeFloor} and ${altitudeCeiling}`);
        return -1.0;
    }
    const rangeHeight = Math.abs(altitudeCeiling - altitudeFloor);
    if (0 == rangeHeight) {
        console.debug(`Attempting linear interpolation with values resulting in a range of zero.  ${altitudeFloor} and ${altitudeCeiling}`);
        return -1.0;
    }
    return Math.abs(rocketAltitude - altitudeFloor) / rangeHeight;
}

/**
 * Obtain the average wind speed (knots) across a portion of the wind band between its floor and the rocket.
 * @param   {number} bandPercentage - Percentage of this wind band the rocket is located above its floor.
 * @param   {Array.<WindAtAltitude>} windData - Array of data defining available wind bands including speeds (knots).
 * @param   {number} floorIndex - Index into windData identifying the floor of this wind band.
 * @returns {number} Averaged wind speed (knots). -1 if outside the range.
 */
function getAverageWindSpeed(bandPercentage, windData, floorIndex) {
    // Verify the percentage is an expected value just in case.
    if (bandPercentage < 0.0 || bandPercentage > 1.0) {
        console.debug(`Wind band percentage ${bandPercentage} is outside the expected value range.`);
        return -1;
    }
    // Check the wind data index while we are being careful.
    if (floorIndex < 0 || (floorIndex + 1) >= windData.length) {
        console.debug(`Wind band index ${floorIndex} is outside the expected value range ${windData.length}`);
        return -1;
    }
    const speedFloor = windData[floorIndex].windSpeed;
    const speedRange = windData[floorIndex + 1].windSpeed - speedFloor;
    const speedAtAltitude = speedFloor + (bandPercentage * speedRange);
    return (speedFloor + speedAtAltitude) / 2.0;
}

/**
 * Obtain the average wind direction (degrees from 0 north) across a portion of the wind band between its floor and the rocket.
 * @param   {number} bandPercentage - Percentage of this wind band the rocket is located above its floor.
 * @param   {Array.<WindAtAltitude>} windData - Array of data defining available wind bands including speeds (knots).
 * @param   {number} floorIndex - Index into windData identifying the floor of this wind band.
 * @returns {number} Averaged wind direction (degrees from 0 north). -1 if outside the range.
 */
function getAverageWindDirection(bandPercentage, windData, floorIndex) {
    // Verify the percentage is an expected value just in case.
    if (bandPercentage < 0.0 || bandPercentage > 1.0) {
        console.debug(`Wind band percentage ${bandPercentage} is outside the expected value range.`);
        return -1;
    }
    // Check the wind data index while we are being careful.
    if (floorIndex < 0 || (floorIndex + 1) >= windData.length) {
        console.debug(`Wind band index ${floorIndex} is outside the expected value range ${windData.length}`);
        return -1;
    }
    const directionA = windData[floorIndex].windDirection;
    const targetDirection = directionA + (bandPercentage * (windData[floorIndex + 1].windDirection - directionA));
    let averageDirection = directionA + targetDirection;
    if (Math.abs(directionA - targetDirection) < 180.0) {
        averageDirection /= 2.0;
    } else {
        // Maintain a northerly direction as the bearing oscillates around zero degrees
        averageDirection = (averageDirection - 360.0) / 2.0;
        if (averageDirection < 0.0) {
            averageDirection += 360.0;
        }
    }
    return averageDirection;
}

/**
 * Calculates a drift distance and applies it to the rocket's location.
 * @param {GeoLocation} rocketLocation - Initial location and to be updated as the destination.
 * @param {number} windSpeed - Velocity (knots) the wind is blowing.
 * @param {number} windDirection - Bearing (degrees from North) to move.
 * @param {number} decentRate - Velocity (ft/s) the rocket is currently falling.
 * @param {number} descentDistance - Distance (feet)
 */
function driftWithWind(rocketLocation, windSpeed, windDirection, decentRate, descentDistance) {
    // Ensure the decent rate is valid
    if (isNaN(decentRate) || 0 == decentRate) {
        console.debug(`Cannot use the current decent rate: ${decentRate}`);
        return;
    }
    decentRate = Math.abs(decentRate);

    // Use the average of wind speed and direction within this range to calculate drift
    const decentDuration = descentDistance / decentRate;

    // The movement function expects a distance in meters, so convert the wind speed
    // from knots into ft/s before multiplying by the decent rate.
    const driftDistance = decentDuration * (windSpeed * 1.68781);

    // Wind bearing indicates where the wind is blowing from, but we want to drift
    // downwind here.  Therefore the direction is inverted before applying movement.
    if (windDirection < 180) {
        windDirection += 180;
    } else {
        windDirection -= 180;
    }

    // Now a decent position can be calculated
    moveAlongBearingKilometers(rocketLocation, feetToMeters(driftDistance), windDirection);

    return driftDistance;
}

// Export our class definitions
export { WindAtAltitude, WindForecastData, WeathercockWindData };

// Export our functions
export { getWindPredictionData, getWindBandPercentage, getAverageWindSpeed, getAverageWindDirection, driftWithWind };