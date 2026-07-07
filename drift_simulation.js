import { DescentData, LaunchSimulationData, LaunchLocationData } from './launch.js';
import { RocketBase } from './rocket.js';
import { WindForecastData, AtmosphericDrift } from './wind.js';

import { getWindBandPercentage, getAverageWindSpeed, getAverageWindDirection, driftWithWind } from "./wind.js";

/**
 * Simulate the rocket's descent path from apogee along a spline defined by the provided winds at altitude.
 * @param   {LaunchLocationData} launchDetails - Provides all data related to the launch site.
 * @param   {Date} launchTime - Date including the hour when this launch occurs.
 * @param   {RocketBase} rocketDetails - Provides all data related to the rocket vehicle.
 * @param   {WindForecastData} windForecast - List of wind values at ascending altitudes.
 * @returns {LaunchSimulationData} A launch simulation data object, or null if an error is encountered.
 */
function driftSimulation(launchDetails, launchTime, rocketDetails, windForecast) {
     // Initialize this simulation list with the rocket's launch path.
    const launchPath = rocketDetails.getLaunchPath(launchTime, launchDetails, windForecast);

    if (0 === launchPath.length) {
        console.debug('Simulated rocket launch path contains no entries.');
        return null;
    }

    // The final launch path entry identifies the rocket's location at apogee.
    const apogeePathPoint = launchPath.at(-1);

    // Default apogee location to the launch site assuming no weathercocking
    let rocketLocation = apogeePathPoint.location.getCopy();
    let rocketAltitude = apogeePathPoint.altitude;
    
    // Convert wind speed to MPH for comparison with user supplied values
    const groundWindSpeed = Math.round(windForecast.windData[0].windSpeed * 1.15078);

    // Create an object to hold this simulation's results now that we have some data
    const launchSimulation = new LaunchSimulationData(launchDetails.altitude,
                                                launchTime.getHours(),
                                                groundWindSpeed,
                                                windForecast.windData[0].windDirection,
                                                windForecast.model);

    // Begin with all points generated during the rocket's launch simulation.
    launchPath.forEach((launchPathPoint) => launchSimulation.addLaunchPathPoint(launchPathPoint.altitude, launchPathPoint.location));

    // Prepare to use cubic spline interpolation for atmospheric conditions during descent.
    const atmosphericModel = new AtmosphericDrift(windForecast);

    // Initialize the descent rate depending on whether dual deployment mode is enabled
    let currentDescentRate = rocketDetails.usingDualDeployment() ? rocketDetails.getDrogueDescentRate() : rocketDetails.getMainDescentRate();

    while (rocketAltitude > 0.0) {
        if (rocketAltitude < rocketDetails.getMainDeploymentAltitude()) {
            currentDescentRate = rocketDetails.getMainDescentRate();
        }

        rocketAltitude -= atmosphericModel.descendAndDrift(rocketAltitude,
            currentDescentRate,
            1.0,
            rocketLocation);
        
        if (rocketAltitude <= 0.0) {
            launchSimulation.addLaunchPathPoint(0.0, rocketLocation);
            break;
        } else {
            launchSimulation.addLaunchPathPoint(rocketAltitude, rocketLocation);
        }
    }

    return launchSimulation;
}

export { driftSimulation };
