import { LaunchPathPoint } from './launch.js';

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

export { RocketBase, RocketApogee };