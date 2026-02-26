import { GeoLocation, feetToMeters, moveAlongBearing } from './geo.js'
import { LaunchPathPoint, LaunchLocationData } from './launch.js';
import { WeathercockWindData } from './wind.js';

/**
 * Calculates a value within a range based on a ratio from the provided source data.
 * @param   {number} sourceValue - The position of this value within the source range is mapped to the target range.
 * @param   {number} sourceLower - Lower limit of the source range.
 * @param   {number} sourceUpper - Upper limit of the source range.
 * @param   {number} targetLower - Lower limit of the target range.
 * @param   {number} targetUpper - Upper limit of the target range.
 * @returns {number} Value from the target range equivalent to the source data's position.
 */
function linearInterpolate(sourceValue, sourceLower, sourceUpper, targetLower, targetUpper) {
    if (0 == (sourceUpper - sourceLower)) {
        console.debug(`Invalid linear range ${sourceLower} to ${sourceUpper}. Defaulting to targetLower.`);
        return targetLower;
    }

    return targetLower + ((sourceValue - sourceLower) * (((targetUpper - targetLower) / (sourceUpper - sourceLower))));
}

class RocketBase {
    /**
     * Expected velocity (feet per second) while the rocket descends with it's main parachute deployed.
     * @private
     * @type {number}
     */
    #descentRateMain = 20;

    /**
     * Altitude at which the main parachute will be deployed in a dual deployment arrangement.  Assume
     * a single deployment event at apogee if this value is zero or less.
     * @private
     * @type {number}
     */
    #mainDeployAltitude = -1;

    /**
     * Expected velocity (feet per second) while the rocket descends with only it's drogue parachute deployed.
     * @private
     * @type {number}
     */
    #descentRateDrogue = 75;

    /**
     * Set this single deployment rocket's descent rate.
     * @param {number} descentRate Expected velocity (ft/s) while descending with it's main parachute.
     */
    setSingleDeployment(descentRate) {
        this.#descentRateMain = descentRate;

        // Ensure this rocket is not setup for dual deployment.
        this.#mainDeployAltitude = -1;
    }

    /**
     * Set this dual deployment rocket's descent rates and second ejection altitude.
     * @param {number} drogueDescentRate Expected velocity (ft/s) while descending with only a drogue parachute.
     * @param {number} mainDeployAlt Altitde (ft) at which the main ejection event is set to occur.
     * @param {number} mainDescentRate Expected velocity (ft/s) while descending with the main parachute.
     */
    setDualDeployment(drogueDecentRate, mainDeployAlt, mainDescentRate) {
        this.#descentRateDrogue = drogueDecentRate;
        this.#mainDeployAltitude = mainDeployAlt;
        this.#descentRateMain = mainDescentRate;
    }

    /**
     * Indicates if this rocket's recover system is setup for single or dual deployment mode.
     * @returns {boolean} True if setup for dual deployment events, False if for single deployment only.
     */
    usingDualDeployment() {
        return this.#mainDeployAltitude > 0;
    }

    /**
     * Provides the altitude (feet Above Ground Level) at which the main parachute will be deployed.
     * @returns {number} Altitude (ft AGL) where the main parachute event occurs.
     */
    getMainDeploymentAltitude() {
        return this.#mainDeployAltitude;
    }

    /**
     * Provided the expected descent rate (feet per second) while only the drogue parachute is deployed.
     * @returns {number} Speed (ft/s) of descent under drogue.
     */
    getDrogueDescentRate() {
        return this.#descentRateDrogue;
    }

    /**
     * Provided the expected descent rate (feet per second) while the main parachute is deployed.
     * @returns {number} Speed (ft/s) of descent under main.
     */
    getMainDescentRate() {
        return this.#descentRateMain;
    }

    /**
     * Calculate a sequence of LaunchPathPoint objects defining the rocket's simulated launch path.
     * @param {Date} launchTime The date and time when the rocket launch occurs.
     * @param {LaunchLocationData} launchLocation Details about where the launch occurs.
     * @param {WindForecastData} windData Provides data defining wind conditions at the time of this launch.
     * @returns {Array.<LaunchPathPoint>} List of locations identifying the rocket's launch path to apogee.
     */
    getLaunchPath(launchTime, launchLocation, windData) {
        const launchPad = new LaunchPathPoint(launchLocation.altitude, launchLocation.location);
        return [ launchPad ];
    }
}

class RocketApogee extends RocketBase {
    /**
     * Expected altitude Above Ground Level (in feet) at apogee
     * @private
     * @type {number}
     */
    #apogee = 0;

    /**
     * Initializes this rocket with it's expected altitude at apogee.
     * @param {number} apogee - Expected altitude Above Ground Level (in feet) at apogee.
     */
    constructor(apogee) {
        super();
        this.#apogee = apogee;
    }

    /**
     * Calculate a sequence of LaunchPathPoint objects defining the rocket's simulated launch path.
     * @param {Date} launchTime The date and time when the rocket launch occurs.
     * @param {LaunchLocationData} launchLocation Details about where the launch occurs.
     * @param {WindForecastData} windData Provides data defining wind conditions at the time of this launch.
     * @returns {Array.<LaunchPathPoint>} List of locations identifying the rocket's launch path to apogee.
     */
    getLaunchPath(launchTime, launchLocation, windData) {
        const launchPath = [];

        // The initial flight path is the launch pad at ground level.
        launchPath.push(new LaunchPathPoint(0, launchLocation.location));

        // This simple rocket model can only provide an apogee location directly above the launch pad.
        launchPath.push(new LaunchPathPoint(this.#apogee, launchLocation.location));
        return launchPath;
    }
}

class RocketWeathercocking extends RocketBase {
    /**
     * Expected altitude Above Ground Level (in feet) at apogee
     * @private
     * @type {number}
     */
    #apogee = 0;

    /**
     * Effects of weathercocking across different ranges of wind speed
     * @private
     * @type {Array.<WeathercockWindData>}
     */
    #weathercockData = []

    /**
     * Initializes this rocket with it's expected altitude at apogee.
     * @param {number} apogee - Expected altitude Above Ground Level (in feet) at apogee.
     * @param {Array.<WeathercockWindData>} weathercockData - Array of objects containing weathercock data.
     */
    constructor(apogee, weathercockData) {
        super();
        this.#apogee = apogee;
        this.#weathercockData = weathercockData;
    }

    /**
     * Calculate a sequence of LaunchPathPoint objects defining the rocket's simulated launch path.
     * @param {Date} launchTime The date and time when the rocket launch occurs.
     * @param {LaunchLocationData} launchLocation Details about where the launch occurs.
     * @param {WindForecastData} windData Provides data defining wind conditions at the time of this launch.
     * @returns {Array.<LaunchPathPoint>} List of locations identifying the rocket's launch path to apogee.
     */
    getLaunchPath(launchTime, launchLocation, windData) {
        const launchPath = [];

        // The initial flight path is the launch pad at ground level.
        launchPath.push(new LaunchPathPoint(0, launchLocation.location));
        console.log('Calculating weathercocking...');

        // Adjust our apogee location according to the provided weathercocking data
        launchPath.push(this.weathercockAdjustment(launchLocation.location, windData));
        return launchPath;
    }

    /**
     * Returns the provided angle in radians after conversion from degrees
     * @param   {GeoLocation} rocketLocation - Initial launch location to be moved upwind.
     * @param   {WindForecastData} windData Provides data defining wind conditions at the time of this launch.
     * @returns {LaunchPathPoint} Final geolocation and altitude after applying weathercocking.
     */
    weathercockAdjustment(rocketLocation, windData) {
        if (0 == this.#weathercockData.length) {
            console.debug('Unable to adjust for weathercocking without valid data.');
            return new LaunchPathPoint(this.#apogee, rocketLocation);
        }
        
        // Convert wind speed to MPH for comparison with user supplied values
        const windSpeed = 1.15078 * windData.groundWindSpeed;

        //let apogeeLocation = new GeoLocation(rocketLocation.latitude, rocketLocation.longitude);
        let apogeeLocation = rocketLocation.getCopy();

        // Check if the provided wind speed is outside the provided wind data.
        if (windSpeed <= this.#weathercockData[0].windSpeed) {
            // This will likely never be true, but always nice to double check when possible.
            if (this.#weathercockData[0].upwindDistance > 0.0) {
                moveAlongBearing(apogeeLocation, feetToMeters(this.#weathercockData[0].upwindDistance), windData.groundWindDirection);
            }
            return new LaunchPathPoint(this.#weathercockData[0].apogee, apogeeLocation);
        } else if (windSpeed > this.#weathercockData[this.#weathercockData.length - 1].windSpeed) {
            moveAlongBearing(apogeeLocation, feetToMeters(this.#weathercockData[this.#weathercockData.length - 1].upwindDistance), windData.groundWindDirection);
            return new LaunchPathPoint(this.#weathercockData[this.#weathercockData.length - 1].apogee, apogeeLocation);
        }

        let apogeeAltitude = -1;

        // Expecting weathercock result data for wind speeds from 0 to 20MPH in 5MPH segments.
        // Find the first entry with a speed equal or greater than the expected ground wind,
        // and perform a linear interpolation from the previous entry.
        for (let index = 1; index < this.#weathercockData.length; ++index) {
            if (windSpeed <= this.#weathercockData[index].windSpeed) {            
                // Wind bearing indicates where the wind is blowing from. Since we want to
                // drift upwind anyway, just use the raw value provided.

                // Determine the distance by interpolating from user provided data
                let finalDistance = linearInterpolate(windSpeed,
                                                        this.#weathercockData[index].windSpeed,
                                                        this.#weathercockData[index - 1].windSpeed,
                                                        this.#weathercockData[index].upwindDistance,
                                                        this.#weathercockData[index - 1].upwindDistance);
                moveAlongBearing(apogeeLocation, feetToMeters(finalDistance), windData.groundWindDirection);

                // Determine the lower apogee by interpolating from user provided data
                apogeeAltitude = linearInterpolate(windSpeed,
                                                    this.#weathercockData[index].windSpeed,
                                                    this.#weathercockData[index - 1].windSpeed,
                                                    this.#weathercockData[index].apogee,
                                                    this.#weathercockData[index - 1].apogee);
                break;
            }
        }
        return new LaunchPathPoint(apogeeAltitude, apogeeLocation);
    }
}

export { RocketBase, RocketApogee, RocketWeathercocking };
