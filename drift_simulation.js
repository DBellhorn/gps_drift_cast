import { DescentData, LaunchSimulationData, LaunchLocationData } from './launch.js';
import { RocketBase } from './rocket.js';
import { WindForecastData } from './wind.js';

import { getWindBandPercentage, getAverageWindSpeed, getAverageWindDirection, driftWithWind } from "./wind.js";

/**
 * Simulate the rocket's descent path from apogee utilizing the provided winds at altitude.
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
    const apogeePathPoint = launchPath[launchPath.length - 1];

    // Default apogee location to the launch site assuming no weathercocking
    let rocketLocation = apogeePathPoint.location.getCopy();
    let rocketAltitude = apogeePathPoint.altitude;

    ////////////////////////////////////////////////////////////////////////////////
    // Drifting calulations begin.
    ////////////////////////////////////////////////////////////////////////////////

    // Identify the altitude range the rocket's apogee fits within
    let windIndex = 1;
    for (; windIndex < windForecast.windData.length; ++windIndex) {
        if (windForecast.windData[windIndex].altitude >= rocketAltitude) {
            break;
        }
    }

    if (windForecast.windData.length == windIndex) {
        console.debug(`Failed to find a match for altitude ${rocketAltitude} within the ${windIndex} forecast entries.`);
        return null;
    }

    // All following logic assumes our index refers to the current wind band's floor
    --windIndex;

    // Initialize the descent rate depending on whether dual deployment mode is enabled
    let currentDescentRate = rocketDetails.usingDualDeployment() ? rocketDetails.getDrogueDescentRate() : rocketDetails.getMainDescentRate();

    // Create a list describing each step of the rocket's descent.
    const descentList = [];

    // Start with apogee
    let windBandPercentage = getWindBandPercentage(rocketAltitude, windForecast.windData, windIndex);
    let windSpeed = getAverageWindSpeed(windBandPercentage, windForecast.windData, windIndex);
    let windDirection = getAverageWindDirection(windBandPercentage, windForecast.windData, windIndex);
    descentList.push(new DescentData(rocketAltitude, currentDescentRate, windSpeed, windDirection));
    
    // Now iterate backward through wind bands adding to our descent list for each
    for (; windIndex >= 0; --windIndex) {
        // Should never encounter inverted altitudes
        let descentDistance = windForecast.windData[windIndex + 1].altitude - windForecast.windData[windIndex].altitude;
        if (descentDistance <= 0) {
            console.debug(`Altitude ${windForecast.windData[windIndex].altitude} is not less than ${windForecast.windData[windIndex + 1].altitude}.`);
            rocketAltitude = windForecast.windData[windIndex].altitude;
            continue;
        }

        // Check if a second deployment should occur
        if (windForecast.windData[windIndex].altitude == rocketDetails.getMainDeploymentAltitude()) {
            // Replacing the wind band's definition with main parachute deployment
            descentList.push(new DescentData(   rocketDetails.getMainDeploymentAltitude(),
                                                rocketDetails.getMainDescentRate(),
                                                windForecast.windData[windIndex].windSpeed,
                                                windForecast.windData[windIndex].windDirection));
            currentDescentRate = rocketDetails.getMainDescentRate();
            continue;
        } else if (windForecast.windData[windIndex].altitude < rocketDetails.getMainDeploymentAltitude() && windForecast.windData[windIndex + 1].altitude > rocketDetails.getMainDeploymentAltitude()) {
            // Linearly interpolate wind values from this band
            windBandPercentage = getWindBandPercentage(rocketDetails.getMainDeploymentAltitude(), windForecast.windData, windIndex);
            windSpeed = getAverageWindSpeed(windBandPercentage, windForecast.windData, windIndex);
            windDirection = getAverageWindDirection(windBandPercentage, windForecast.windData, windIndex);
            descentList.push(new DescentData(rocketDetails.getMainDeploymentAltitude(), rocketDetails.getMainDescentRate(), windSpeed, windDirection));
            currentDescentRate = rocketDetails.getMainDescentRate();
        }

        descentList.push(new DescentData(   windForecast.windData[windIndex].altitude,
                                            currentDescentRate,
                                            windForecast.windData[windIndex].windSpeed,
                                            windForecast.windData[windIndex].windDirection));
    }

    if (descentList.length < 2) {
        // No need to continue if no descent data was generated
        console.debug(`List of descent data is too short.  ${descentList.length}`);
        return null;
    }

    // Reset our descent rate to the apogee's value
    currentDescentRate = descentList[0].descentRate;

    
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

    // Now append the descent path points.
    for (let x = 1; x < descentList.length; ++x) {
        // Get the average wind conditions between this and the previous altitude
        windSpeed = (descentList[x].windSpeed + descentList[x - 1].windSpeed) / 2.0;
        let descentDistance = descentList[x - 1].altitude - descentList[x].altitude;

        windDirection = descentList[x].windDirection + descentList[x - 1].windDirection;
        if (Math.abs(descentList[x - 1].windDirection - descentList[x].windDirection) < 180.0) {
            windDirection /= 2.0;;
        } else {
            // Ensure the average remains in a northerly direction
            windDirection = (windDirection - 360.0) / 2.0;
            if (windDirection < 0.0) {
                windDirection += 360.0;
            }
        }

        driftWithWind(rocketLocation, windSpeed, windDirection, currentDescentRate, descentDistance);

        // Add this to our simulation data before continuing the decent
        launchSimulation.addLaunchPathPoint(descentList[x].altitude, rocketLocation);

        // Update the descent rate with this altitude's value
        currentDescentRate = descentList[x].descentRate;
    }

    return launchSimulation;
}

export { driftSimulation };