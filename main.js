import { GeoLocation, feetToMeters, metersToFeet, moveAlongBearing, distanceBetweenLocations } from "./geo.js";
import { saveLandingScatter, saveFlightScatter, saveGroundPaths } from "./kml.js";
import { LaunchTimeData, LaunchPathPoint, LaunchSimulationData, DescentData } from "./launch.js";
import { WindAtAltitude, WindForecastData, WeathercockWindData } from "./wind.js";
import { getWindPredictionData, getWindBandPercentage, getAverageWindSpeed, getAverageWindDirection, driftWithWind } from "./wind.js";
import { getHourColor } from "./map_colors.js";

const googleMapApiKey = 'YOUR_API_KEY';


// Declare some ID strings so they do not have to be in-line everywhere
const waiverLatitudeId = 'waiver_latitude';
const waiverLongitudeId = 'waiver_longitude';
const waiverRadiusId = 'waiver_radius';
const waiverAltitudeId = 'waiver_altitude';

// Launch site input elements
const launchSiteNameElement = document.getElementById('launch_site_name');
const launchSiteLatitudeElement = document.getElementById('launch_site_latitude');
const launchSiteLongitudeElement = document.getElementById('launch_site_longitude');
const launchSiteElevationElement = document.getElementById('launch_site_elevation');
const waiverLatitudeElement = document.getElementById(waiverLatitudeId);
const waiverLongitudeElement = document.getElementById(waiverLongitudeId);
const waiverRadiusElement = document.getElementById(waiverRadiusId);
const waiverAltitudeElement = document.getElementById(waiverAltitudeId);

// Launch time input elements
const launchDateElement = document.getElementById('launch_date');
const startTimeElement = document.getElementById('start_time');
const endTimeElement = document.getElementById('end_time');
const apogeeAltitudeElement = document.getElementById('launch_apogee');
const dualDeployElement = document.getElementById('dual_deploy');
const mainDescentRateElement = document.getElementById('decent_rate_main');
const mainEventAltitudeElement = document.getElementById('main_event_altitude');
const drogueDecentRateElement = document.getElementById('decent_rate_drogue');

// IDs of the launch site buttons
const selLaunchSiteNameId = 'select_launch_site';
const btnLaunchSiteCancelId = 'btn_site_cancel';
const btnLaunchSiteSaveId = 'btn_site_save';
const btnLaunchSiteEditId = 'btn_site_edit';
const btnLaunchSiteNewId = 'btn_site_new';
const btnLaunchSiteDeleteId = 'btn_site_delete';

// IDs of the weathercock inputs
const applyWeathercockingId = 'apply_weathercocking';
const weathercockDataId = 'weathercock_data';

const btnCalculateDrift = 'btn_calculate_drift';
const btnSaveLandingPlots = 'btn_save_landing_plot';
const btnSaveFlightPlots = 'btn_save_flight_plot';
const btnSaveGroundPaths = 'btn_save_ground_paths';

// Drift result display IDs
const imgStaticMapId = 'img_static_map';
const driftResultDivId = 'drift_result_div';
const driftResultTableId = 'drift_result_table';
const statusDisplayId = 'status_display';

// Hold an instance of a db object for us to store the IndexedDB data in
let dbLaunchSites = null;

/** @type {Array.<LaunchSimulationData>} Stores the results of wind drift calculations for writing to a KML file later. */ 
let launchSimulationList = [];

var launchSiteNames = [];


const LaunchSiteStatus = Object.freeze({
    NOSAVES: 0,
    CREATING: 1,
    EDITING: 2,
    INACTIVE: 3
});
var currentLaunchSiteStatus = LaunchSiteStatus.NOSAVES;

/**
 * Update the value stored and displayed in the launch end time field.
 * @param {number} endHour - The new end hour for the launch.
 * @throws {TypeError} Invalid end hour value.
 */
function setEndTimeValue(endHour) {
    if (isNaN(endHour)) throw new TypeError(`Invalid end hour: ${endHour}.`);

    if (endHour > 23) {
        endTimeElement.value = '00:00';
    } else if (endHour < 10) {
        endTimeElement.value = `0${endHour}:00`;
    } else {
        endTimeElement.value = `${endHour}:00`;
    }
}

/**
 * Create an object containing a launch site location based on the current UI data.
 * @returns {GeoLocation} Coordinates of launch site if successful. Otherwise returns null.
 */
function getLaunchSiteLocation() {
    const latitude = parseFloat(launchSiteLatitudeElement.value);
    if (isNaN(latitude)) {
        return null;
    } else if ((latitude > 90.0) || (latitude < -90.0)) {
        return null;
    }

    const longitude = parseFloat(launchSiteLongitudeElement.value);
    if (isNaN(longitude)) {
        return null;
    } else if ((longitude > 180.0) || (longitude < -180.0)) {
        return null;
    }

    return new GeoLocation(latitude, longitude);
}

/**
 * Request an updated value from OpenElevation. Save to our database if successfull.
 * @param {string} latitude - String representation of the launch site's latitude coordinate.
 * @param {string} longitude - String representation of the launch site's lonititude coordinate.
 * @param {string} launchSiteName - Name of the launch site to be used for updating the database.
 * @returns {number} Elevation of the launch site.
 */
function requestLaunchSiteElevation(latitude, longitude, launchSiteName) {
    if (null == launchSiteName) {
        console.debug('Cannot update elevation without a valid launch site name.');
        return 0;
    } else if (launchSiteName.length <= 0) {
        console.debug('Cannot update elevation with a blank launch site name.');
        return 0;
    }

    // Generate a query URL for the Open Elevation API.  Limiting the coordinate
    // floating resolution since some requests were timing out.
    let launchSiteLatitude = parseFloat(latitude);
    if (isNaN(launchSiteLatitude)) {
        return;
    }
    if (launchSiteLatitude < -90 || launchSiteLatitude > 90) {
        launchSiteLatitude = 0.0;
    } else {
        launchSiteLatitude = parseFloat(launchSiteLatitude.toFixed(5));
    }

    let launchSiteLongitude = parseFloat(longitude);
    if (isNaN(launchSiteLongitude)) {
        return;
    }
    if (launchSiteLongitude < -180 || launchSiteLongitude > 180) {
        launchSiteLongitude = 0.0;
    } else {
        launchSiteLongitude = parseFloat(launchSiteLongitude.toFixed(5));
    }

    const elevationPromise = fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${launchSiteLatitude},${launchSiteLongitude}`);

    elevationPromise
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Elevation response status: ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            if (data.results.length > 0) {
                launchSiteElevationElement.value = data.results[0].elevation;

                if (null != dbLaunchSites) {
                    // Begin the save process now that we have all the launch site's data
                    const objectStore = dbLaunchSites.transaction('DriftCast_Sites', 'readwrite').objectStore('DriftCast_Sites');
            
                    const launchSiteRequest = objectStore.get(launchSiteName);
            
                    launchSiteRequest.onsuccess = () => {
                        // Elevation is provided in meters, but all of our calculations expect feet
                        launchSiteRequest.result.elevation = metersToFeet(data.results[0].elevation);
            
                        const updateElevationRequest = objectStore.put(launchSiteRequest.result);
                        
                        updateElevationRequest.onsuccess = () => {
                            console.log(`Updated ${launchSiteName} elevation to ${launchSiteRequest.result.elevation}`);
                        };
            
                        updateElevationRequest.onerror = () => {
                            console.error(`An error occurred while saving elevation for ${launchSiteName}`);
                        }
                    };
                } else {
                    console.debug(`Obtained an elevation ${launchSiteElevationElement.value} for ${launchSiteName}, but the database has not been loaded.`);
                }
            }
        })
        .catch(error => {
            console.debug(`An error occurred while fetching elevation data. ${error.message}`);
        });

}

/* Helper to reset all elements associated with the launch site selector. */
function clearLaunchSiteSelector() {
    launchSiteNames = [];
    const selLaunchSiteNames = document.getElementById(selLaunchSiteNameId);

    while (selLaunchSiteNames.options.length > 0) {
        selLaunchSiteNames.remove(selLaunchSiteNames.options.length - 1);
    }
}

/**
 * Check if the provided string contains a valid numeric value.
 * @param {string} str - String to be tested.
 * @returns {boolean} True if the string can be converted into a number. False otherwise.
 */
function isNumeric(str) {
    if (typeof str != 'string') {
        return false;
    }

    // Use type coercion to parse the entire string (parseFloat does not do that)
    // and use parseFloat to ensure strings of pure whitespace fail
    return !isNaN(str) && !isNaN(parseFloat(str));
}

/**
 * Test the current values in all launch site input fields to see if they are valid.
 * Notify the user about any issues so they can be corrected.
 * @returns {boolean} True if launch site data is okay. False otherwise.
 */
function verifyLaunchSiteData() {
    var launchSiteName = launchSiteNameElement.value.trim();
    if (0 == launchSiteName.length) {
        launchSiteNameElement.focus();
        window.alert('A name is required to save a launch site.');
        return false;
    } else if (-1 != launchSiteNames.indexOf(launchSiteName)) {
        launchSiteNameElement.focus();
        window.alert('This name is already used for another launch site.');
        return false;
    }

    if (!isNumeric(launchSiteLatitudeElement.value)) {
        launchSiteLatitudeElement.focus();
        window.alert('The launch site latitude is not a number.');
        return false;
    } else {
        let launchSiteLatitude = parseFloat(launchSiteLatitudeElement.value);
        if (launchSiteLatitude < -90 || launchSiteLatitude > 90) {
            launchSiteLatitudeElement.focus();
            window.alert('The launch site latitude is not within the valid range.');
            return false;
        }
    }

    if (!isNumeric(launchSiteLongitudeElement.value)) {
        launchSiteLongitudeElement.focus();
        window.alert('The launch site longitude is not a number.');
        return false;
    } else {
        let launchSiteLongitude = parseFloat(launchSiteLongitudeElement.value);
        if (launchSiteLongitude < -180 || launchSiteLongitude > 180) {
            launchSiteLongitudeElement.focus();
            window.alert('The launch site longitude is not within the valid range.');
            return false;
        }
    }
    return true;
}

/**
 *  Store the launch site values currently in our UI into the database.
 *  @returns {boolean} True if the launch site was successfully saved.  False otherwise.
 */
function saveLaunchSiteToDb() {
    if (null == dbLaunchSites) {
        console.debug('Tried to add a new launch site to the database before it was loaded.')
        return false;
    }

    const launchSiteName = launchSiteNameElement.value;
    if (0 == launchSiteName.length) {
        console.debug(`Unable to save launch site with invalid name.`);
        return false;
    }

    const launchSiteLocation = getLaunchSiteLocation();
    if (null == launchSiteLocation) {
        console.debug(`Unable to save launch site with invalid location coordinates.`);
        return false;
    }

    // Change to a known invalid value for easier checks upon loading.
    let waiverLatitude = parseFloat(waiverLatitudeElement.value);
    if (isNaN(waiverLatitude) || waiverLatitude < -90.0 || waiverLatitude > 90.0) {
        waiverLatitude = 360.0;
    }

    let waiverLongitude = parseFloat(waiverLongitudeElement.value);
    if (isNaN(waiverLongitude) || waiverLongitude < -180.0 || waiverLongitude > 180.0) {
        waiverLongitude = 360.0;
    }

    let wavierRadius = parseFloat(waiverRadiusElement.value.replaceAll(',', ''));
    if (wavierRadius < 0.0) {
        wavierRadius = 0.0;
    }

    // Altitude and Elevation are hidden fields, so they should always have valid values
    const launchSiteElevation = parseInt(launchSiteElevationElement.value);
    const waiverAltitude = parseInt(waiverAltitudeElement.value.replaceAll(',', ''));

    // Begin the save process now that we have all the launch site's data
    const objectStore = dbLaunchSites.transaction('DriftCast_Sites', 'readwrite').objectStore('DriftCast_Sites');
    const addRequest = objectStore.add({
        name: launchSiteName,
        latitude: launchSiteLocation.latitude,
        longitude: launchSiteLocation.longitude,
        elevation: launchSiteElevation,
        waiver_latitude: waiverLatitude,
        waiver_longitude: waiverLongitude,
        waiver_altitude: waiverAltitude,
        waiver_radius: wavierRadius
    });

    addRequest.onerror = (event) => {
        console.error(`An error occurred while saving a new launch site: ${launchSiteName}`);
        return false;
    }

    addRequest.onsuccess = (event) => {
        console.log(`A new launch site was added to the database: ${launchSiteName}`);
    }
    return true;
}

/** Remove the currently selected launch site from our database. */
async function deleteCurrentLaunchSite() {
    if (null == dbLaunchSites) {
        window.alert(`Unable to access the database. Please try again later.`);
        return;
    }

    // Check the launch site selection input for the current launch site's name
    const launchSiteSelector = document.getElementById(selLaunchSiteNameId);
    const launchSiteName = launchSiteSelector.value;
    
    // Verify the user really meant to delete the launch site before proceeding
    if (!window.confirm(`Do you really want to delete your launch site ${launchSiteName}?`)) {
        return;
    }

    // Remove the selected launch site's details from our database
    const deleteRequest = dbLaunchSites.transaction('DriftCast_Sites', 'readwrite')
        .objectStore('DriftCast_Sites')
        .delete(launchSiteName);
    
    deleteRequest.onsuccess = () => {
        // Remove the deleted launch site's name from the selector element
        if (launchSiteSelector.options.length > 1) {
            // Remove the launch site's name from our array
            const index = launchSiteNames.indexOf(launchSiteName);
            if (index !== -1) {
                launchSiteNames.splice(index, 1);
            }

            // Remove the launch site from our selector
            launchSiteSelector.remove(launchSiteSelector.options.length - 1);

            // Switch to the first entry still available
            launchSiteSelector.selectedIndex = 0;

            // Retrieve the selected launch site's details from our database
            dbLaunchSites.transaction('DriftCast_Sites')
                .objectStore('DriftCast_Sites')
                .get(launchSiteSelector.value)
                .onsuccess = (dbEvent) => {
                    updateLaunchSiteDisplay(dbEvent.target.result);
                };
        } else {
            resetLaunchSiteDisplay();
            updateLaunchSiteUI(LaunchSiteStatus.NOSAVES);
        }
    };

    deleteRequest.onerror = (dbEvent) => {
        console.error(`Attempting to delete ${launchSiteName} from the database failed: ${dbEvent.error}`);
        window.alert(`Unable to access the database. Please try again later.`);
    };
}

/**
 * Enables or disable all launch site related UI fields.
 * @param {boolean} isDisabled - Value to set all launch site UI elements' disabled flags.
 */
function swapLaunchSiteInputDisabled(isDisabled) {
    launchSiteNameElement.disabled = isDisabled;
    launchSiteLatitudeElement.disabled = isDisabled;
    launchSiteLongitudeElement.disabled = isDisabled;
    waiverLatitudeElement.disabled = isDisabled;
    waiverLongitudeElement.disabled = isDisabled;
    waiverRadiusElement.disabled = isDisabled;
}

/**
 * Enables and/or disables specific launch site UI fields based on the new status.
 * @param {object} newStatus - Identifies which launch site UI status is being switched to.
 */
function updateLaunchSiteUI(newStatus) {
    if (LaunchSiteStatus.NOSAVES == newStatus) {
        swapLaunchSiteInputDisabled(false);

        // Disable the launch site selector since it is empty
        document.getElementById(selLaunchSiteNameId).disabled = true;

        // No need for any buttons other than Save to start
        document.getElementById(btnLaunchSiteCancelId).hidden = true;
        document.getElementById(btnLaunchSiteSaveId).hidden = false;
        document.getElementById(btnLaunchSiteEditId).hidden = true;
        document.getElementById(btnLaunchSiteDeleteId).hidden = true;
        document.getElementById(btnLaunchSiteNewId).hidden = true;
    } else if (LaunchSiteStatus.CREATING == newStatus) {
        swapLaunchSiteInputDisabled(false);

        // Do not allow selecting a different launch site while creating one
        document.getElementById(selLaunchSiteNameId).disabled = true;

        // Reset all the launch site inputs to initial values
        launchSiteNameElement.value = '';
        launchSiteLatitudeElement.value = '';
        launchSiteLongitudeElement.value = '';
        waiverLatitudeElement.value = '';
        waiverLongitudeElement.value = '';
        waiverRadiusElement.value = '';
        waiverAltitudeElement.value = '';
        launchSiteElevationElement.value = -1;

        // Allow the user to Save the new launch site or cancel out
        document.getElementById(btnLaunchSiteCancelId).hidden = false;
        document.getElementById(btnLaunchSiteSaveId).hidden = false;
        document.getElementById(btnLaunchSiteEditId).hidden = true;
        document.getElementById(btnLaunchSiteDeleteId).hidden = true;
        document.getElementById(btnLaunchSiteNewId).hidden = true;
    } else if (LaunchSiteStatus.EDITING == newStatus) {
        swapLaunchSiteInputDisabled(false);

        // Override the name field as locked since the user is editing the selected site
        launchSiteNameElement.disabled = true;

        // Do not allow selecting a different launch site while editing one
        document.getElementById(selLaunchSiteNameId).disabled = true;

        // Allow the user to Save the new launch site or cancel out
        document.getElementById(btnLaunchSiteCancelId).hidden = false;
        document.getElementById(btnLaunchSiteSaveId).hidden = false;
        document.getElementById(btnLaunchSiteEditId).hidden = true;
        document.getElementById(btnLaunchSiteDeleteId).hidden = true;
        document.getElementById(btnLaunchSiteNewId).hidden = true;
    } else { // Defaulting to LaunchSiteStatus.INACTIVE
        swapLaunchSiteInputDisabled(true);

        // Allow the user to select a different launch site
        document.getElementById(selLaunchSiteNameId).disabled = false;

        // Allow the user to Save the new launch site or cancel out
        document.getElementById(btnLaunchSiteCancelId).hidden = true;
        document.getElementById(btnLaunchSiteSaveId).hidden = true;
        document.getElementById(btnLaunchSiteEditId).hidden = false;
        document.getElementById(btnLaunchSiteDeleteId).hidden = false;
        document.getElementById(btnLaunchSiteNewId).hidden = false;
    }

    currentLaunchSiteStatus = newStatus;
}

/**
 * Copy values retrieved from the database into the UI fields.
 * @param {cursor} dbCursor - Cursor returned from the launch site database.
 */
function updateLaunchSiteDisplay(dbCursor) {
    launchSiteNameElement.value = dbCursor.name;
    launchSiteLatitudeElement.value = dbCursor.latitude;
    launchSiteLongitudeElement.value = dbCursor.longitude;
    launchSiteElevationElement.value = dbCursor.elevation;

    // Switch to default display if waiver data has not been saved.
    if (isNaN(dbCursor.waiver_latitude)) {
        waiverLatitudeElement.value = '';
    } else if (dbCursor.waiver_latitude < -90.0 || dbCursor.waiver_latitude > 90.0) {
        waiverLatitudeElement.value = '';
    } else {
        waiverLatitudeElement.value = dbCursor.waiver_latitude;
    }

    if (isNaN(dbCursor.waiver_longitude)) {
        waiverLongitudeElement.value = '';
    } else if (dbCursor.waiver_longitude < -180.0 || dbCursor.waiver_longitude > 180.0) {
        waiverLongitudeElement.value = '';
    } else {
        waiverLongitudeElement.value = dbCursor.waiver_longitude;
    }

    if (isNaN(dbCursor.waiver_altitude || dbCursor.waiver_altitude <= 0.0)) {
        waiverAltitudeElement.value = '';
    } else {
        waiverAltitudeElement.value = dbCursor.waiver_altitude;
    }
}

/** Return all launch site related UI fields back to their default display values. */
function resetLaunchSiteDisplay() {
    clearLaunchSiteSelector();
    launchSiteNameElement.value = '';
    launchSiteLatitudeElement.value = '';
    launchSiteLongitudeElement.value = '';
    waiverLatitudeElement.value = '';
    waiverLongitudeElement.value = '';
    waiverRadiusElement.value = '';
}

/**
 * Creates a table for display of drifting calucation results if one does not exist.
 * If one does exist, it clears all previous contents before adding the latest data.
 * @param {Array.<LaunchSimulationData>} launchList - A new table row will be added for each launch.
 */
function updateStaticLandingScatterImage(launchList) {
    const staticMapImage = document.getElementById(imgStaticMapId);
    staticMapImage.hidden = false;

    // The beginning of the URL does not change.
    let staticMapUrl = 'https://maps.googleapis.com/maps/api/staticmap';

    // Might want to change the resolution to match narrow screens in the future.
    staticMapUrl += '?size=640x640';

    if (launchList.length > 0) {
        // Assuming the launch location is identical for all simulations in the list.
        const launchPosition = launchList[0].getLaunchLocation();
        staticMapUrl += `&markers=color:red%7C${launchPosition.latitude.toFixed(6)},${launchPosition.longitude.toFixed(6)}`;
    }

    // Append a marker for each time slot.
    for (let i = 0; i < launchList.length; ++i) {
        // Remove the AM and PM designators from our time strings.
        const fullLaunchTime = launchList[i].getLaunchTime();

        // Standard markers only allow single digits, so use custom icons for 10, 11, and 12.
        if (3 == fullLaunchTime.length) {
            let hourNumber = parseInt(fullLaunchTime.slice(0, 1));
            if (null == hourNumber || isNaN(hourNumber)) {
                hourNumber = 0;
            }

            const markerColor = getHourColor(hourNumber);
            staticMapUrl += `&markers=color:${markerColor.name}%7Clabel:${fullLaunchTime.slice(0,1)}`;
        } else {
            let customIcon = '';
            const hourNumber = parseInt(fullLaunchTime.slice(0, 2));
            if (10 == hourNumber) {
                customIcon = 'https://gpsdriftcast.com/images/ten.png';
            } else if (11 == hourNumber) {
                customIcon = 'https://gpsdriftcast.com/images/eleven.png';
            } else if (12 == hourNumber) {
                customIcon = 'https://gpsdriftcast.com/images/twelve.png';
            }

            if (customIcon.length > 0) {
                staticMapUrl += `&markers=icon:${customIcon}`;
            } else {
                continue;
            }
        }

        const landingPosition = launchList[i].getLandingLocation();
        staticMapUrl += `%7C${landingPosition.latitude.toFixed(6)},${landingPosition.longitude.toFixed(6)}`;
    }

    // Final pieces are map type and Google Maps API Key
    staticMapUrl += `&maptype=hybrid&key=${googleMapApiKey}`;

    staticMapImage.src = staticMapUrl;
}

/**
 * Creates a table for display of drifting calucation results if one does not exist.
 * If one does exist, it clears all previous contents before adding the latest data.
 * @param {Array.<LaunchSimulationData>} launchList - A new table row will be added for each launch.
 */
function updateDriftResultTable(launchList) {
    const driftResultTable = document.getElementById(driftResultTableId);
    if (null == driftResultTable) {
        return;
    }

    // Remove any data on display from previous drift calculations.
    const previousDriftData = driftResultTable.querySelector('tbody');
    if (null != previousDriftData) {
        driftResultTable.removeChild(previousDriftData);
    }

    // Create a new tbody to hold our latest drift result data.
    const driftResultBody = document.createElement('tbody');

    // creating all cells
    for (let i = 0; i < launchList.length; ++i) {
        // Creates a new row for our table.
        const row = document.createElement('tr');

        // Launch window start time.
        const timeCell = document.createElement('td');
        timeCell.appendChild(document.createTextNode(`${launchList[i].getLaunchTime()}`));
        row.appendChild(timeCell);

        // Wind forecast model.
        const windModelCell = document.createElement('td');
        windModelCell.appendChild(document.createTextNode(`${launchList[i].getWindModelName()}`));
        row.appendChild(windModelCell);

        // Average wind speed at ground level.
        const groundWindSpeed = Math.round(Math.abs(launchList[i].groundWindSpeed));
        const windSpeedCell = document.createElement('td');

        // Indicate level of safety by transitioning background color from green to yellow to red.
        switch (groundWindSpeed) {
            case 0:
            case 1:
            case 2:
                windSpeedCell.style.background = '#32CD32';
                break;
            case 3:
            case 4:
                windSpeedCell.style.background = '#00FF00';
                break;
            case 5:
            case 6:
                windSpeedCell.style.background = '#40ff00';
                break;
            case 7:
            case 8:
                windSpeedCell.style.background = '#80ff00';
                break;
            case 9:
            case 10:
                windSpeedCell.style.background = '#bfff00';
                break;
            case 11:
            case 12:
                windSpeedCell.style.background = '#ffff00';
                break;
            case 13:
            case 14:
                windSpeedCell.style.background = '#ffbf00';
                break;
            case 15:
            case 16:
                windSpeedCell.style.background = '#ff8000';
                break;
            case 17:
            case 18:
            case 19:
                windSpeedCell.style.background = '#ff4000';
                break;
            default:
                windSpeedCell.style.background = '#ff0000';
                break;
        }
        windSpeedCell.appendChild(document.createTextNode(`${groundWindSpeed}`));
        row.appendChild(windSpeedCell);

        // Average wind direction at ground level.
        const windDirectionCell = document.createElement('td');
        windDirectionCell.appendChild(document.createTextNode(`${Math.round(launchList[i].groundWindDirection)}`));
        row.appendChild(windDirectionCell);

        // Apogee of the rocket.
        const apogeeCell = document.createElement('td');
        apogeeCell.appendChild(document.createTextNode(`${launchList[i].getApogee()}`));
        row.appendChild(apogeeCell);

        // Distance the rocket weathercocked.
        const weathercockDistanceCell = document.createElement('td');
        const launchPosition = launchList[i].getLaunchLocation();
        const apogeePosition = launchList[i].getApogeeLocation();
        let weathercockDist = 0;
        if (null != launchPosition && null != apogeePosition) {
            weathercockDist = Math.round(metersToFeet(distanceBetweenLocations(launchPosition, apogeePosition)));
        }
        weathercockDistanceCell.appendChild(document.createTextNode(`${weathercockDist}`));
        row.appendChild(weathercockDistanceCell);

        // Distance from the launch pad to where the rocket landed.
        const driftDistanceCell = document.createElement('td');
        const landingPosition = launchList[i].getLandingLocation();
        let driftDist = 0;
        if (null != launchPosition && null != landingPosition) {
            driftDist = Math.round(metersToFeet(distanceBetweenLocations(launchPosition, landingPosition)));
        }
        driftDistanceCell.appendChild(document.createTextNode(`${driftDist}`));
        row.appendChild(driftDistanceCell);

        driftResultBody.appendChild(row);
    }

    // Place our new body full of drift result data into the table.
    driftResultTable.appendChild(driftResultBody);

    // Switch the table to visible now that it has been filled out.
    document.getElementById(driftResultDivId).hidden = false;
}

/**
 * Fired when the whole page has loaded, including all dependent resources except
 * those that are loaded lazily.
 */
window.onload = () => {
    // Print a version into the log to help keep track between iterations.
    console.log('GPS DriftCast 1.0a');

    const currentDate = new Date();

    // Add leading zeros if the numbers are single digit
    let monthString;
    if (currentDate.getMonth() < 9) {
        monthString = '0' + (currentDate.getMonth() + 1).toString();
    } else {
        monthString = (currentDate.getMonth() + 1).toString();
    }

    let dayString;
    if (currentDate.getDate() < 10) {
        dayString = '0' + currentDate.getDate().toString();
    } else {
        dayString = currentDate.getDate().toString();
    }

    // Initialize the date element to today
    launchDateElement.value = `${currentDate.getFullYear()}-${monthString}-${dayString}`;

    // Prevent the user from selecting a date older than one day in the past
    const yesterday = new Date();
    yesterday.setDate(currentDate.getDate() - 1);
    if (yesterday.getMonth() < 9) {
        monthString = '0' + (yesterday.getMonth() + 1).toString();
    } else {
        monthString = (yesterday.getMonth() + 1).toString();
    }

    if (yesterday.getDate() < 10) {
        dayString = '0' + yesterday.getDate().toString();
    } else {
        dayString = yesterday.getDate().toString();
    }

    launchDateElement.min = `${yesterday.getFullYear()}-${monthString}-${dayString}`;

    // Cannot forecast more than 380 hours into the future. Using 15 days for now.
    const maxDate = new Date();
    maxDate.setDate(currentDate.getDate() + 15);
    
    if (maxDate.getMonth() < 9) {
        monthString = '0' + (maxDate.getMonth() + 1).toString();
    } else {
        monthString = (maxDate.getMonth() + 1).toString();
    }

    if (maxDate.getDate() < 10) {
        dayString = '0' + maxDate.getDate().toString();
    } else {
        dayString = maxDate.getDate().toString();
    }
    launchDateElement.max = `${maxDate.getFullYear()}-${monthString}-${dayString}`;

    // Initialize the time elements to the current hour plus a max offset
    const currentHour = currentDate.getHours();
    if (currentHour < 10) {
        startTimeElement.value = `0${currentHour}:00`;
    } else {
        startTimeElement.value = `${currentHour}:00`;
    }

    // Initialize the end time for six hours after the start time
    setEndTimeValue(currentHour + 6);

    // Open our database of launch sites
    const dbSitesOpenRequest = window.indexedDB.open('DriftCast_Sites', 1);

    // Event handlers to act on the database being opened successfully
    dbSitesOpenRequest.onsuccess = (event) => {
        // Store the result of opening the database in the db variable. This is used a lot below
        dbLaunchSites = dbSitesOpenRequest.result;

        const loadingObjectStore = dbLaunchSites.transaction('DriftCast_Sites').objectStore('DriftCast_Sites');

        const countRequest = loadingObjectStore.count();
        countRequest.onsuccess = () => {
            console.log(`Loading ${countRequest.result} launch sites from our database.`);
            if (countRequest.result > 0) {
                let copyDataToUi = true;
                const selLaunchSiteNames = document.getElementById(selLaunchSiteNameId);

                // Ensure we do not add duplicate entries
                clearLaunchSiteSelector();

                // Switch the UI elements into static displays
                updateLaunchSiteUI(LaunchSiteStatus.INACTIVE);

                loadingObjectStore.openCursor().onsuccess = (event) => {
                    const cursor = event.target.result;
                    // Check if the cursor still contains valid launch site data
                    if (cursor) {
                        const launchSiteOption = document.createElement('option');
                        launchSiteOption.value = cursor.value.name;
                        launchSiteOption.text = cursor.value.name;
                        selLaunchSiteNames.add(launchSiteOption);

                        // Update our cached data associated with the selector
                        launchSiteNames.push(cursor.value.name);

                        // Copy the first launch site's data into our UI elements
                        if (copyDataToUi) {
                            updateLaunchSiteDisplay(cursor.value);
                            copyDataToUi = false;
                        }
                        
                        // Continue on to the next item in the cursor
                        cursor.continue();
                    } else {
                        // There is no more data to load
                        return;
                    }
                };
            }
        }
    };

    // Handling any errors, though not really sure what a good response should be
    dbSitesOpenRequest.onerror = (event) => {
        console.error('Error loading launch site database.');
        console.error(event);
    };

    // Create our database since it does not currently exist
    dbSitesOpenRequest.onupgradeneeded = (event) => {
        dbLaunchSites = event.target.result;
        console.log('Creating our database.');

        dbLaunchSites.onerror = (event) => {
            console.error('Error loading database.');
        };

        // Create an objectStore for this database
        const objectStore = dbLaunchSites.createObjectStore('DriftCast_Sites', { keyPath: 'name' });

        // Define what data items the objectStore will contain
        objectStore.createIndex('latitude', 'latitude', { unique: false });
        objectStore.createIndex('longitude', 'longitude', { unique: false });
        objectStore.createIndex('elevation', 'elevation', { unique: false });
        objectStore.createIndex(waiverLatitudeId, waiverLatitudeId, { unique: false });
        objectStore.createIndex(waiverLongitudeId, waiverLongitudeId, { unique: false });
        objectStore.createIndex(waiverRadiusId, waiverRadiusId, { unique: false });
        objectStore.createIndex(waiverAltitudeId, waiverAltitudeId, { unique: false });
    };

    // Register to handle clicking the Save launch site button
    document.getElementById(btnLaunchSiteSaveId).addEventListener('click', (event) => {
        if (LaunchSiteStatus.CREATING == currentLaunchSiteStatus || LaunchSiteStatus.NOSAVES == currentLaunchSiteStatus) {
            // Verify all the required data fields contain valid values
            if (!verifyLaunchSiteData()) {
                return;
            }
            // If the saved launch site is new, add its name to the selector
            const launchSiteName = launchSiteNameElement.value;
            if (-1 == launchSiteNames.indexOf(launchSiteName)) {
                const selLaunchSiteNames = document.getElementById(selLaunchSiteNameId);
                const launchSiteOption = document.createElement('option');
                launchSiteOption.value = launchSiteName;
                launchSiteOption.text = launchSiteName;
                selLaunchSiteNames.add(launchSiteOption);

                // Update our cached data associated with the selector
                launchSiteNames.push(launchSiteName);
                selLaunchSiteNames.selectedIndex = selLaunchSiteNames.options.length - 1;
            }

            // Perform the actual save. Another will occur later if a new elevation is obtained
            if (saveLaunchSiteToDb()) {
                // Switch the UI to a static display now that the launch site was saved
                updateLaunchSiteUI(LaunchSiteStatus.INACTIVE);
            }

            let launchSiteElevation = parseInt(launchSiteElevationElement.value);

            // Request an elevation lookup when it is set to the default -1.0 value
            if (launchSiteElevation < 0) {
                const launchSiteLocation = getLaunchSiteLocation();
                if (null != launchSiteLocation) {
                    requestLaunchSiteElevation( launchSiteLatitudeElement.value,
                                                launchSiteLongitudeElement.value,
                                                launchSiteName);
                } else {
                    console.debug('Unable to request launch site elevation without valid coordinates.');
                }
            }
        } else {
            // The user is editing an existing launch site
            let launchSiteLatitude = parseFloat(launchSiteLatitudeElement.value);
            if (isNaN(launchSiteLatitude)) {
                launchSiteLatitudeElement.focus();
                window.alert(`Launch site latitude is a required field.`);
                return;
            }
            if (Math.abs(launchSiteLatitude) > 90) {
                launchSiteLatitudeElement.focus();
                window.alert(`Launch site latitude is not an expected value: ${launchSiteLatitude}`);
                return;
            }

            let launchSiteLongitude = parseFloat(launchSiteLongitudeElement.value);
            if (isNaN(launchSiteLongitude)) {
                launchSiteLatitudeElement.focus();
                window.alert(`Launch site longitude is a required field.`);
                return;
            }
            if (Math.abs(launchSiteLongitude) > 180) {
                launchSiteLatitudeElement.focus();
                window.alert(`Launch site longitude is not an expected value: ${launchSiteLongitude}`);
                return;
            }

            // Begin the save process
            const objectStore = dbLaunchSites.transaction('DriftCast_Sites', 'readwrite').objectStore('DriftCast_Sites');
            const launchSiteName = launchSiteNameElement.value;
            const launchSiteRequest = objectStore.get(launchSiteName);
    
            launchSiteRequest.onsuccess = () => {
                // Get the remaining launch site values from our UI
                let waiverRadius = parseFloat(waiverRadiusElement.value.replaceAll(',', ''));
                if (isNaN(waiverRadius) || (waiverRadius < 0.0)) {
                    console.debug(`Changing wavier radius to zero for save due to an invalid value: ${waiverRadius}`);
                    waiverRadius = 0.0;
                }
                let waiverLatitude = parseFloat(waiverLatitudeElement.value);
                if (isNaN(waiverLatitude) || (Math.abs(waiverLatitude) > 90)) {
                    console.debug(`Replacing wavier latitude for save due to an invalid value: ${waiverLatitude}`);
                    waiverLatitude = 360.0;
                }
                let waiverLongitude = parseFloat(waiverLongitudeElement.value);
                if (isNaN(waiverLongitude) || (Math.abs(waiverLongitude) > 180)) {
                    console.debug(`Replacing wavier longitude for save due to an invalid value: ${waiverLongitude}`);
                    waiverLongitude = 360.0;
                }

                // Update the database cursor's members
                launchSiteRequest.result.latitude = launchSiteLatitude;
                launchSiteRequest.result.longitude = launchSiteLongitude;
                launchSiteRequest.result.waiver_latitude = waiverLatitude;
                launchSiteRequest.result.waiver_longitude = waiverLongitude;
                launchSiteRequest.result.waiver_radius = waiverRadius;

                // Finally we can attempt the actual database save
                const updateRequest = objectStore.put(launchSiteRequest.result);
                
                updateRequest.onsuccess = () => {
                    // Switch the UI to a static display now that the launch site was saved
                    updateLaunchSiteUI(LaunchSiteStatus.INACTIVE);
                };
    
                updateRequest.onerror = () => {
                    console.error(`An error occurred while saving ${launchSiteName} - ${updateRequest.error}`);
                }
            };

            launchSiteRequest.onerror = () => {
                console.error(`Unable to find a database entry named ${launchSiteName} - ${launchSiteRequest.error}`);
            }
        }
    });

    // Register to handle clicking the New launch site button
    document.getElementById(btnLaunchSiteNewId).addEventListener('click', (event) => {
        updateLaunchSiteUI(LaunchSiteStatus.CREATING);
    });

    // Register to handle clicking the Cancel launch site button
    document.getElementById(btnLaunchSiteCancelId).addEventListener('click', (event) => {
        if (null != dbLaunchSites) {
            // Check the launch site selection input for what to display
            const previousLaunchSiteName = document.getElementById(selLaunchSiteNameId).value;

            if (previousLaunchSiteName.length > 0) {
                // Retrieve the selected launch site's details from our database
                dbLaunchSites.transaction('DriftCast_Sites')
                    .objectStore('DriftCast_Sites')
                    .get(previousLaunchSiteName)
                    .onsuccess = (dbEvent) => {
                        updateLaunchSiteDisplay(dbEvent.target.result);
                    };
            }
        }
        updateLaunchSiteUI(LaunchSiteStatus.INACTIVE);
    });

    // Register to handle clicking the Edit launch site button
    document.getElementById(btnLaunchSiteEditId).addEventListener('click', (event) => {
        updateLaunchSiteUI(LaunchSiteStatus.EDITING);
    });

    // Register to handle clicking the Delete launch site button
    document.getElementById(btnLaunchSiteDeleteId).addEventListener('click', async (event) => {
        await deleteCurrentLaunchSite();
    });

    // Handle selection of a different launch site from our list
    document.getElementById(selLaunchSiteNameId).addEventListener('change', (changeEvent) => {
        if (null != dbLaunchSites) {
            // Retrieve the selected launch site's details from our database
            dbLaunchSites.transaction('DriftCast_Sites')
                .objectStore('DriftCast_Sites')
                .get(changeEvent.target.value)
                .onsuccess = (dbEvent) => {
                    updateLaunchSiteDisplay(dbEvent.target.result);

                    // Check if the database contains a default value for this launch site's elevation
                    if (dbEvent.target.result.elevation < 0) {
                        const launchSiteLocation = getLaunchSiteLocation();
                        if (null != launchSiteLocation) {
                            requestLaunchSiteElevation( dbEvent.target.result.latitude,
                                                        dbEvent.target.result.longitude,
                                                        dbEvent.target.result.name);
                        } else {
                            console.debug('Unable to request launch site elevation without valid coordinates.');
                        }
                    }
                };
        }
    });

    // Ensure the launch date is within the range for which wind forecasts are available
    launchDateElement.addEventListener('change', (event) => {
        // Convert into just a date ignoring hours, minutes, and seconds
        let launchDay = new Date();
        let numYear = parseInt(event.target.value.substring(0, 4));
        let numMonth = parseInt(event.target.value.substring(5, 7));
        let numDay = parseInt(event.target.value.substring(8, 10));
        launchDay = new Date(numYear, numMonth - 1, numDay);

        let today = new Date();
        today = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        let deltaHours = (launchDay - today) / 3600000;
        if (deltaHours < -24) {
            console.debug('Too far in the past.');
        } else if (deltaHours > 380) {
            console.debug('Too far in the future.');
        }
    });

    // Try to keep the end time within a valid range of the start time
    startTimeElement.addEventListener('change', (event) => {
        // Get the current start and end times
        const startHour = parseInt(event.target.value.substring(0, 2));
        var endHour = parseInt(endTimeElement.value.substring(0, 2));

        if (endHour <= startHour) {
            // The end time cannot be earlier than our start time
            setEndTimeValue(startHour + 1);
        } else if ((endHour - startHour) > 11) {
            // Maximum launch duration is capped at 12 hours
            setEndTimeValue(startHour + 11);
        }
    });

    // Show/hide the weathercock data entry fields when "Apply Weathercocking" is changed
    document.getElementById(applyWeathercockingId).addEventListener('click', (event) => {
        document.getElementById(weathercockDataId).hidden = !event.target.checked;
    });

    // Update recovery related UI fields when the users switches between single and dual deployment
    document.querySelectorAll("input[name='deploy_mode']").forEach((input) => {
        input.addEventListener(
            'click',
            (event) => {
                if (event.target.value == 'single_deploy') {
                    drogueDecentRateElement.disabled = true;
                    mainEventAltitudeElement.disabled = true;
                } else {
                    if ('' == drogueDecentRateElement.value) {
                        drogueDecentRateElement.value = 75;
                    }
                    if ('' == mainEventAltitudeElement.value) {
                        mainEventAltitudeElement.value = 500;
                    }
                    drogueDecentRateElement.disabled = false;
                    mainEventAltitudeElement.disabled = false;
                }
            }
        );
    });

    document.getElementById(btnCalculateDrift).addEventListener('click', async () => {
        // Disable the user's ability to save until our data is refreshed.
        const saveLandingPlotsButton = document.getElementById(btnSaveLandingPlots);
        if (null != saveLandingPlotsButton) {
            saveLandingPlotsButton.disabled = true;
            saveLandingPlotsButton.hidden = true;
        }
        const saveFlightPlotsButton = document.getElementById(btnSaveFlightPlots);
        if (null != saveFlightPlotsButton) {
            saveFlightPlotsButton.disabled = true;
            saveFlightPlotsButton.hidden = true;
        }
        const saveGroundPathsButton = document.getElementById(btnSaveGroundPaths);
        if (null != saveGroundPathsButton) {
            saveGroundPathsButton.disabled = true;
            saveGroundPathsButton.hidden = true;
        }

        // Hide any previous drift results.
        document.getElementById(imgStaticMapId).hidden = true;
        document.getElementById(driftResultDivId).hidden = true;

        // Let the user know something is happening in the background.
        const statusDisplayElement = document.getElementById(statusDisplayId);
        if (null != statusDisplayElement) {
            statusDisplayElement.textContent = 'Calculating drift...';
            statusDisplayElement.hidden = false;
            statusDisplayElement.scrollIntoView({ behavior: "instant", block: "end" });
        }

        // Calculate new drift and landing results
        launchSimulationList = await calculateLandingPlots();
        if (launchSimulationList.length > 0) {
            // No need to continue showing our text feedback now that results are ready.
            if (null != statusDisplayElement) {
                statusDisplayElement.hidden = true;
            }

            // Allow the user to save now that valid drift and landing data is available.
            if (null != saveLandingPlotsButton) {
                saveLandingPlotsButton.disabled = false;
                saveLandingPlotsButton.hidden = false;
            }
            if (null != saveFlightPlotsButton) {
                saveFlightPlotsButton.disabled = false;
                saveFlightPlotsButton.hidden = false;
            }
            if (null != saveGroundPathsButton) {
                saveGroundPathsButton.disabled = false;
                saveGroundPathsButton.hidden = false;
            }
            updateStaticLandingScatterImage(launchSimulationList);
            updateDriftResultTable(launchSimulationList);

            // Try to bring everything into view now the elements are visible.
            document.getElementById(driftResultTableId).scrollIntoView({ behavior: "instant", block: "start" });
        } else {
            // Let the user know something bad happened.
            if (null != statusDisplayElement) {
                statusDisplayElement.textContent = 'An error occurred.'
            }
        }
    });

    // The user wants to save a KML file containing landing plots
    document.getElementById(btnSaveLandingPlots).addEventListener('click', async (event) => {
        if (null != launchSimulationList && launchSimulationList.length > 0) {
            const launchSiteLocation = getLaunchSiteLocation();
            let waiverLatitude = parseFloat(waiverLatitudeElement.value);
            if (isNaN(waiverLatitude)) {
                waiverLatitude = launchSiteLocation.latitude;
            } else if ((waiverLatitude > 90.0) || (waiverLatitude < -90.0)) {
                waiverLatitude = launchSiteLocation.latitude;
            }
        
            let waiverLongitude = parseFloat(waiverLongitudeElement.value);
            if (isNaN(waiverLongitude)) {
                waiverLongitude = launchSiteLocation.longitude;
            } else if ((waiverLongitude > 180.0) || (waiverLongitude < -180.0)) {
                waiverLongitude = launchSiteLocation.longitude;
            }
            const waiverLocation = new GeoLocation(waiverLatitude, waiverLongitude);

            let waiverRadius = parseFloat(waiverRadiusElement.value.replaceAll(',', ''));
            if (isNaN(waiverRadius)) {
                waiverRadius = 0;
            }

            await saveLandingScatter(launchSiteLocation, waiverLocation, waiverRadius, launchSimulationList);
        } else {
            console.debug(`Skipping writing a landing plot KML file since no simulation data was returned.`);
        }
    });

    // The user wants to save a KML file containing flight paths
    document.getElementById(btnSaveFlightPlots).addEventListener('click', async (event) => {
        if (null != launchSimulationList && launchSimulationList.length > 0) {
            const launchSiteLocation = getLaunchSiteLocation();
            let waiverLatitude = parseFloat(waiverLatitudeElement.value);
            if (isNaN(waiverLatitude)) {
                waiverLatitude = launchSiteLocation.latitude;
            } else if ((waiverLatitude > 90.0) || (waiverLatitude < -90.0)) {
                waiverLatitude = launchSiteLocation.latitude;
            }
        
            let waiverLongitude = parseFloat(waiverLongitudeElement.value);
            if (isNaN(waiverLongitude)) {
                waiverLongitude = launchSiteLocation.longitude;
            } else if ((waiverLongitude > 180.0) || (waiverLongitude < -180.0)) {
                waiverLongitude = launchSiteLocation.longitude;
            }
            const waiverLocation = new GeoLocation(waiverLatitude, waiverLongitude);

            let waiverRadius = parseFloat(waiverRadiusElement.value.replaceAll(',', ''));
            if (isNaN(waiverRadius)) {
                waiverRadius = 0;
            }

            await saveFlightScatter(launchSiteLocation, waiverLocation, waiverRadius, launchSimulationList);
        } else {
            console.debug(`Skipping writing a flight path KML file since no simulation data was returned.`);
        }
    });

    // The user wants to save a KML file containing flight paths projected as ground tracks.
    document.getElementById(btnSaveGroundPaths).addEventListener('click', async (event) => {
        if (null != launchSimulationList && launchSimulationList.length > 0) {
            const launchSiteLocation = getLaunchSiteLocation();
            let waiverLatitude = parseFloat(waiverLatitudeElement.value);
            if (isNaN(waiverLatitude)) {
                waiverLatitude = launchSiteLocation.latitude;
            } else if ((waiverLatitude > 90.0) || (waiverLatitude < -90.0)) {
                waiverLatitude = launchSiteLocation.latitude;
            }
        
            let waiverLongitude = parseFloat(waiverLongitudeElement.value);
            if (isNaN(waiverLongitude)) {
                waiverLongitude = launchSiteLocation.longitude;
            } else if ((waiverLongitude > 180.0) || (waiverLongitude < -180.0)) {
                waiverLongitude = launchSiteLocation.longitude;
            }
            const waiverLocation = new GeoLocation(waiverLatitude, waiverLongitude);

            let waiverRadius = parseFloat(waiverRadiusElement.value.replaceAll(',', ''));
            if (isNaN(waiverRadius)) {
                waiverRadius = 0;
            }

            await saveGroundPaths(launchSiteLocation, waiverLocation, waiverRadius, launchSimulationList);
        } else {
            console.debug(`Skipping writing a ground paths KML file since no simulation data was returned.`);
        }
    });
}

/**
 * Pull all the user supplied data from our UI ignoring any bad data.
 * @param {number} windSpeed - Speed (in MPH) of the wind at ground level.
 * @param {string} speedId - Written version of the speed used for looking up the relevant UI.
 * @returns {WeathercockWindData} A new object containing weathercock data if successful, or null if not.
 */
function getWeathercockInputValues(windSpeed, speedId) {
    const distanceInput = document.getElementById(`weathercock_distance_${speedId}`);
    if (null == distanceInput) {
        console.debug(`Weathercock distance not found for wind speed ${speedId}`);
        return null;
    }

    const apogeeInput = document.getElementById(`weathercock_apogee_${speedId}`);
    if (null == apogeeInput) {
        console.debug(`Weathercock apogee not found for wind speed ${speedId}`);
        return null;
    }
            
    const distanceValue = parseInt(distanceInput.value);
    if (isNaN(distanceValue)) {
        console.debug(`Weathercock distance is not a valid integer: ${distanceValue}`);
        return null;
    }

    const apogeeValue = parseInt(apogeeInput.value);
    if (isNaN(distanceValue)) {
        console.debug(`Weathercock apogee is not a valid integer: ${apogeeValue}`);
        return null;
    }

    return new WeathercockWindData(windSpeed, distanceValue, apogeeValue);
}

/**
 * Reads user supplied weathercock data from our UI elements and places everything into
 * an array of objects. Return value indicates if there is valid data to use.
 * @param {Array.<WeathercockWindData>} resultsData - Array of objects containing weathercock data.
 * @returns {boolean} True if the user has supplied valid weathercock data.
 */
function loadWeathercockData(resultsData) {
    let applyWeathercockAdjustment = document.getElementById(applyWeathercockingId).checked;
    if (applyWeathercockAdjustment) {
        // Zero wind uses the rocket's normal apogee with no drifting
        const rocketApogee = parseInt(apogeeAltitudeElement.value.replaceAll(',', ''));
        if (isNaN(rocketApogee)) {
            window.alert(`The rocket's apogee is not valid: ${rocketApogee}.`);
            apogeeAltitudeElement.focus();
            return;
        }
        if (rocketApogee <= 0) {
            window.alert(`The rocket's apogee cannot be a negative value: ${rocketApogee}.`);
            apogeeAltitudeElement.focus();
            return;
        }
        resultsData.push(new WeathercockWindData(0, 0, rocketApogee));
        
        let windSpeedData = getWeathercockInputValues(5, 'five');
        if (null != windSpeedData) {
            resultsData.push(windSpeedData);
        }
        
        windSpeedData = getWeathercockInputValues(10, 'ten');
        if (null != windSpeedData) {
            resultsData.push(windSpeedData);
        }
        
        windSpeedData = getWeathercockInputValues(15, 'fifteen');
        if (null != windSpeedData) {
            resultsData.push(windSpeedData);
        }
        
        windSpeedData = getWeathercockInputValues(20, 'twenty');
        if (null != windSpeedData) {
            resultsData.push(windSpeedData);
        }

        if (0 == resultsData.length) {
            console.debug('Disabling weathercocking since no data could be loaded.');
            applyWeathercockAdjustment = false;
        }
    }
    return applyWeathercockAdjustment;
}

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

/**
 * Returns the provided angle in radians after conversion from degrees
 * @param   {GeoLocation} apogeeLocation - Initial launch location and to be moved upwind.
 * @param   {number} windDirection - Bearing (degrees from North) the wind is blowing.
 * @param   {number} windSpeed - Speed (MPH) the wind is blowing.
 * @param   {Array.<WeathercockWindData>} weathercockData - Array of weathercock results.
 * @returns {number} Expected lower apogee due to weathercocking or -1 if an error occurs.
 */
function weathercockAdjustment(apogeeLocation, windDirection, windSpeed, weathercockData) {
    if (0 == weathercockData.length) {
        console.debug('Unable to adjust for weathercocking without valid data.');
        return -1;
    }

    // Check if the provided wind speed is outside the provided wind data.
    if (windSpeed <= weathercockData[0].windSpeed) {
        // This will likely never be true, but always nice to double check when possible.
        if (weathercockData[0].upwindDistance > 0.0) {
            moveAlongBearing(apogeeLocation, feetToMeters(weathercockData[0].upwindDistance), windDirection);
        }
        return weathercockData[0].apogee;
    } else if (windSpeed > weathercockData[weathercockData.length - 1].windSpeed) {
        moveAlongBearing(apogeeLocation, feetToMeters(weathercockData[weathercockData.length - 1].upwindDistance), windDirection);
        return weathercockData[0].apogee;
    }

    let apogeeAltitude = -1;

    // Expecting weathercock result data for wind speeds from 0 to 20MPH in 5MPH segments.
    // Find the first entry with a speed equal or greater than the expected ground wind,
    // and perform a linear interpolation from the previous entry.
    for (let index = 1; index < weathercockData.length; ++index) {
        if (windSpeed <= weathercockData[index].windSpeed) {            
            // Wind bearing indicates where the wind is blowing from. Since we want to
            // drift upwind anyway, just use the raw value provided.

            // Determine the distance by interpolating from user provided data
            let finalDistance = linearInterpolate(windSpeed,
                                                    weathercockData[index].windSpeed,
                                                    weathercockData[index - 1].windSpeed,
                                                    weathercockData[index].upwindDistance,
                                                    weathercockData[index - 1].upwindDistance);
            moveAlongBearing(apogeeLocation, feetToMeters(finalDistance), windDirection);

            // Determine the lower apogee by interpolating from user provided data
            apogeeAltitude = linearInterpolate(windSpeed,
                                                weathercockData[index].windSpeed,
                                                weathercockData[index - 1].windSpeed,
                                                weathercockData[index].apogee,
                                                weathercockData[index - 1].apogee);
            break;
        }
    }
    return apogeeAltitude;
}

/**
 * Pulls all launch and rocket data provided though our UI elements. Wind forecasts
 * are obtained for each hour of the launch's duration. Rocket landing locations are
 * calculated utilizing all of the previously described information.
 * @returns {Array.<LaunchSimulationData>} A list of launch simulation data objects.
 */
async function calculateLandingPlots() {
    // Start with an empty array to be filled with simulation data objects later
    const simulationList = [];

    const launchTimes = new LaunchTimeData( launchDateElement.value,
                                            startTimeElement.value,
                                            endTimeElement.value);

    // Verify the launch hour offsets are within our expectations
    if ((launchTimes.endHour < launchTimes.startHour) && (launchTimes.endHour > 0)) {
        window.alert('The launch cannot end before it starts.');
        return simulationList;
    }
    if (launchTimes.startHourOffset < -24) {
        window.alert('Wind speeds older than 24 hours are not available.');
        return simulationList;
    }
    if (launchTimes.endHourOffset > 380) {
        window.alert('Cannot forecast more than 380 hours into the future.');
        return simulationList;
    }

    // Verify expected rocket altitudes are valid numbers
    const rocketApogee = parseInt(apogeeAltitudeElement.value.replaceAll(',', ''));
    if (isNaN(rocketApogee)) {
        window.alert(`Apogee is not a valid number: ${rocketApogee}.`);
        return simulationList;
    }
    if (rocketApogee <= 0) {
        window.alert(`Apogee is not a valid height above ground: ${rocketApogee}.`);
    }

    let weathercockData = [];
    const applyWeathercockAdjustment = loadWeathercockData(weathercockData);

    // Default to using the launch site's location for our apogee position
    const launchLocation = getLaunchSiteLocation();
    if (null == launchLocation) {
        window.alert('Unable to get wind forecast without valid launch site coordinates.');
        return simulationList;
    }

    // Get the rocket's decent rate under the main parachute
    const mainDescentRate = parseFloat(mainDescentRateElement.value);
    if (isNaN(mainDescentRate) || mainDescentRate <= 0.0) {
        console.debug(`Unable to calculate drift distance with an invalid main decent rate: ${mainDescentRate}`);
        return simulationList;
    }

    // Load the rocket's recovery data
    let usingDualDeployoment = dualDeployElement.checked;
    let mainDeployAltitude = -1;
    let drogueDecentRate = mainDescentRate;

    if (usingDualDeployoment) {
        // Ensure the values are positive
        mainDeployAltitude = Math.abs(parseInt(mainEventAltitudeElement.value.replaceAll(',', '')));
        drogueDecentRate = Math.abs(parseInt(drogueDecentRateElement.value));

        if (isNaN(mainDeployAltitude)) {
            window.alert(`Secondary deployment altitude is invalid: ${mainDeployAltitude}`);
            usingDualDeployoment = false;
        } else if (isNaN(drogueDecentRate)) {
            window.alert(`Defaulting to single deployment due to an invalid drogue decent rate: ${drogueDecentRate}`);
            usingDualDeployoment = false;
        }

        if (mainDeployAltitude > rocketApogee) {
            window.alert(`Defaulting to single deployment since second deployment ${mainDeployAltitude} is higher than apogee ${rocketApogee}`);
            usingDualDeployoment = false;
        } else if (0 == mainDeployAltitude) {
            window.alert(`Defaulting to single deployment since second deployment is set at ground level.`);
            usingDualDeployoment = false;
        } else if (0 == drogueDecentRate) {
            window.alert(`Defaulting to single deployment since drogue decent rate is 0.`);
            usingDualDeployoment = false;
        }

        if (!usingDualDeployoment) {
            // Reset to default values ensuring only single deployment is utilized
            mainDeployAltitude = -1;
            drogueDecentRate = mainDescentRate;
        }
    }

    for (let currentOffset = launchTimes.startHourOffset; currentOffset <= launchTimes.endHourOffset; ++currentOffset ) {
        // // Obtain a wind prediction for the current time
        let windForecast = await getWindPredictionData(launchLocation, currentOffset);
        if (null == windForecast || 0 == windForecast.length) {
            console.debug(`Failed to obtain a wind forecast for hour offset ${currentOffset} at ${launchLocation.latitude}, ${launchLocation.longitude}`);
            continue;
        }

        // Default apogee location to the launch site assuming no weathercocking
        let rocketLocation = launchLocation.getCopy();

        // Grab the most accurate launch site elevation currently available
        let launchSiteElevation = parseInt(launchSiteElevationElement.value);
        if (isNaN(launchSiteElevation) || launchSiteElevation < 0) {
            launchSiteElevation = windForecast.groundElevation;
        }

        ////////////////////////////////////////////////////////////////////////////////
        // TO-DO: I'm really confused about the wind averaging logic used here.  Not
        //        sure why it is set to a limited range of array entries rather than
        //        iterating up to the anticipated apogee.
        ////////////////////////////////////////////////////////////////////////////////
        let groundWindDirection = 0.0;
        let groundWindSpeed = 0.0;

        // Defaulting to one for Open-Meteo model
        let altitudeCount = 1;
        if ('RAP' == windForecast.model) {
            if (rocketApogee <= 1000) {
                altitudeCount = 2;
            } else {
                altitudeCount = 4;
            }
        }

        if (altitudeCount >= windForecast.windData.length) {
            console.debug(`Weathercocking expected ${altitudeCount} entries but only found ${windForecast.windData.length}.`);
            altitudeCount = windForecast.windData.length;
        }

        for (let windIndex = 0; windIndex < altitudeCount; ++windIndex) {
            groundWindDirection += windForecast.windData[windIndex].windDirection;
            groundWindSpeed += windForecast.windData[windIndex].windSpeed;
        }

        // Average the wind direction
        groundWindDirection = groundWindDirection / altitudeCount;

        // Average the wind speeds and convert to MPH to compare with user supplied values
        groundWindSpeed = Math.round((groundWindSpeed / altitudeCount) * 1.15078);

        ////////////////////////////////////////////////////////////////////////////////
        // TO-DO: The original GPS DriftCast presents this value to the user. We do not
        //        have anywhere to put it right now. Might be useful information.
        ////////////////////////////////////////////////////////////////////////////////
        //averageSurfaceWindDir = averageWeathercockDirection
        
        ////////////////////////////////////////////////////////////////////////////////
        // TO-DO: Also need to add some sort of warning indicator when predicted wind
        //        speed at ground level exceeds safetly limits.
        ////////////////////////////////////////////////////////////////////////////////

        let rocketAltitude = rocketApogee;
        if (applyWeathercockAdjustment) {
            // Adjust our apogee location according to the provided weathercocking data
            rocketAltitude = weathercockAdjustment(rocketLocation, groundWindDirection, groundWindSpeed, weathercockData);
            
            // Default to the user supplied apogee if not obtained from weathercock data
            if (rocketAltitude <= 0) {
                rocketAltitude = rocketApogee;
            }
        }

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
            continue;
        }

        // All following logic assumes our index refers to the current wind band's floor
        --windIndex;

        // Initialize the descent rate depending on whether dual deployment mode is enabled
        let currentDescentRate = usingDualDeployoment ? drogueDecentRate : mainDescentRate;

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
            if (windForecast.windData[windIndex].altitude == mainDeployAltitude) {
                // Replacing the wind band's definition with main parachute deployment
                descentList.push(new DescentData(   mainDeployAltitude,
                                                    mainDescentRate,
                                                    windForecast.windData[windIndex].windSpeed,
                                                    windForecast.windData[windIndex].windDirection));
                currentDescentRate = mainDescentRate;
                continue;
            } else if (windForecast.windData[windIndex].altitude < mainDeployAltitude && windForecast.windData[windIndex + 1].altitude > mainDeployAltitude) {
                // Linearly interpolate wind values from this band
                windBandPercentage = getWindBandPercentage(mainDeployAltitude, windForecast.windData, windIndex);
                windSpeed = getAverageWindSpeed(windBandPercentage, windForecast.windData, windIndex);
                windDirection = getAverageWindDirection(windBandPercentage, windForecast.windData, windIndex);
                descentList.push(new DescentData(mainDeployAltitude, mainDescentRate, windSpeed, windDirection));
                currentDescentRate = mainDescentRate;
            }

            descentList.push(new DescentData(   windForecast.windData[windIndex].altitude,
                                                currentDescentRate,
                                                windForecast.windData[windIndex].windSpeed,
                                                windForecast.windData[windIndex].windDirection));
        }

        if (descentList.length < 2) {
            // No need to continue if no descent data was generated
            console.debug(`List of descent data is too short.  ${descentList.length}`);
            continue;
        }

        // Reset our descent rate to the apogee's value
        currentDescentRate = descentList[0].descentRate;

        // Create an object to hold this simulation's results now that we have some data
        const launchSimulation = new LaunchSimulationData(launchSiteElevation,
                                                    launchTimes.launchDate.getHours() + currentOffset - launchTimes.startHourOffset,
                                                    groundWindSpeed,
                                                    groundWindDirection,
                                                    'RAP' == windForecast.model);

        // Begin by adding the launch site and apogee
        launchSimulation.addLaunchPathPoint(0, launchLocation);
        launchSimulation.addLaunchPathPoint(rocketAltitude, rocketLocation);

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

        // Add this completed simulation to the list
        simulationList.push(launchSimulation);
    }
    return simulationList;
}
