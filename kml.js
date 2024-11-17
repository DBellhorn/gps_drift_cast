import { GeoLocation, feetToMeters, moveAlongBearing } from "./geo.js";
import { LaunchSimulationData } from "./launch.js";
import { getHourColor } from "./map_colors.js";

/**
 * Formats the launch and landing plot data according to the KML standard for display
 * within Google Earth.
 * @param {GeoLocation} launchLocation - Coordinates from which rockets are launched.
 * @param {GeoLocation} waiverLocation - Coordinates upon which the FAA waiver is centered.
 * @param {number} waiverRadius - Radius (in nautical miles) the FAA waiver covers.
 * @param {Array.<LaunchSimulationData>} - A list of launch simulation data objects. 
 */
async function createLandingPlotBlob(launchLocation, waiverLocation, waiverRadius, launchSimulationList) {
    if (null == launchLocation) {
        console.debug('Cannot create a landing plot blob without a launch location.');
        return;
    }
    if (null == launchSimulationList || 0 == launchSimulationList.length) {
        console.debug('Cannot create a landing plot blob without launch simulation data.');
        return;
    }

    // Write KML header
    let stringArray = [`<?xml version="1.0" encoding="UTF-8"?>\n`];
    stringArray.push(`<kml xmlns="http://www.opengis.net/kml/2.2">\n`);
    stringArray.push(`  <Document>\n`);

    // Create a placemark for the launch site (red color)
    stringArray.push(`    <Placemark>\n`);
    stringArray.push(`      <name>Launch Site</name>\n`);
    stringArray.push(`      <Style id="redStyle">\n`);
    stringArray.push(`        <IconStyle>\n`);
    stringArray.push(`          <color>ff0000ff</color>\n`);
    stringArray.push(`        </IconStyle>\n`);
    stringArray.push(`      </Style>\n`);
    stringArray.push(`      <Point>\n`);
    stringArray.push(`        <altitudeMode>clampToGround</altitudeMode>\n`);
    stringArray.push(`        <coordinates>${launchLocation.longitude},${launchLocation.latitude},0</coordinates>\n`);
    stringArray.push(`      </Point>\n`);
    stringArray.push(`    </Placemark>\n`);

    // Loop through each point and write Placemark
    for (let index = 0; index < launchSimulationList.length; ++index) {
        // Only need the rocket's landing coordinates
        const landingLocation = launchSimulationList[index].getLandingLocation();
        if (null == landingLocation) {
            continue;
        }

        const markerColor = getHourColor(launchSimulationList[index].time);

        stringArray.push(`    <Placemark>\n`);
        stringArray.push(`      <name>${launchSimulationList[index].getLaunchTime()}</name>\n`);
        stringArray.push(`      <Style>\n`);
        stringArray.push(`        <IconStyle>\n`);
        stringArray.push(`          <color>${markerColor.earthHexadecimal}</color>\n`);
        stringArray.push(`        </IconStyle>\n`);
        stringArray.push(`      </Style>\n`);
        stringArray.push(`      <Point>\n`);
        stringArray.push(`        <coordinates>${landingLocation.longitude},${landingLocation.latitude},0</coordinates>\n`);
        stringArray.push(`      </Point>\n`);
        stringArray.push(`    </Placemark>\n`);
    }

    if ((null != waiverLocation) && (waiverRadius > 0)) {
        // Do not cover up the launch site marker with one for the waiver if at the same location
        if ((launchLocation.latitude != waiverLocation.latitude) || (launchLocation.longitude != waiverLocation)) {
            // Create a placemark for the Waiver Center
            stringArray.push(`    <Placemark>\n`);
            stringArray.push(`      <name>Waiver Center</name>\n`);
            stringArray.push(`      <Style>\n`);
            stringArray.push(`        <IconStyle>\n`);
            stringArray.push(`          <color>ff0000ff</color>\n`);
            stringArray.push(`        </IconStyle>\n`);
            stringArray.push(`      </Style>\n`);
            stringArray.push(`      <Point>\n`);
            stringArray.push(`        <altitudeMode>clampToGround</altitudeMode>\n`);
            stringArray.push(`        <coordinates>${waiverLocation.longitude},${waiverLocation.latitude},0</coordinates>\n`);
            stringArray.push(`      </Point>\n`);
            stringArray.push(`    </Placemark>\n`);
        }

        // Plot a circle clamped to the ground representing the waiver area.
        // Using aed color with some transparency.
        stringArray.push(`    <Placemark>\n`);
        stringArray.push(`      <name>Waiver Radius</name>\n`);
        stringArray.push(`      <Style>\n`);
        stringArray.push(`        <LineStyle>\n`);
        stringArray.push(`          <color>ff0000ff</color>\n`);
        stringArray.push(`          <width>2</width>\n`);
        stringArray.push(`        </LineStyle>\n`);
        stringArray.push(`        <PolyStyle>\n`);
        stringArray.push(`          <color>1aff0000</color>\n`);
        stringArray.push(`        </PolyStyle>\n`);
        stringArray.push(`      </Style>\n`);
        stringArray.push(`      <Polygon>\n`);
        stringArray.push(`        <extrude>0</extrude>\n`);
        stringArray.push(`        <altitudeMode>clampToGround</altitudeMode>\n`);
        stringArray.push(`        <outerBoundaryIs>\n`);
        stringArray.push(`          <LinearRing>\n`);
        stringArray.push(`            <coordinates>\n`);

        // Convert the radius from nautical miles to meters
        const waiverRadiusMeters = waiverRadius * 1852.0;

        // The first and last coordinates must be identical
        let northCoordinates = waiverLocation.getCopy();
        moveAlongBearing(northCoordinates, waiverRadiusMeters, 0);
        stringArray.push(`              ${northCoordinates.longitude},${northCoordinates.latitude},0\n`);

        // Add coordinates for points around the circle every 10 degrees
        for (let bearing = 10; bearing < 360; bearing += 10) {
            let ringCoordinates = waiverLocation.getCopy();
            moveAlongBearing(ringCoordinates, waiverRadiusMeters, bearing);
            stringArray.push(`              ${ringCoordinates.longitude},${ringCoordinates.latitude},0\n`);
        }

        stringArray.push(`              ${northCoordinates.longitude},${northCoordinates.latitude},0\n`);
        stringArray.push(`            </coordinates>\n`);
        stringArray.push(`          </LinearRing>\n`);
        stringArray.push(`        </outerBoundaryIs>\n`);
        stringArray.push(`      </Polygon>\n`);
        stringArray.push(`    </Placemark>\n`);
    }

    // Write KML footer
    stringArray.push(`  </Document>\n`);
    stringArray.push(`</kml>\n`);

    return new Blob(stringArray);
}

/**
 * Formats the flight path data according to the KML standard for display within Google Earth.
 * @param {GeoLocation} launchLocation - Coordinates from which rockets are launched.
 * @param {GeoLocation} waiverLocation - Coordinates upon which the FAA waiver is centered.
 * @param {number} waiverRadius - Radius (in nautical miles) the FAA waiver covers.
 * @param {Array.<LaunchSimulationData>} - A list of launch simulation data objects. 
 */
function createFlightPathBlob(launchLocation, waiverLocation, waiverRadius, launchSimulationList) {
    if (null == launchLocation) {
        console.debug('Cannot create a flight path blob without a launch location.');
        return;
    }
    if (null == launchSimulationList || 0 == launchSimulationList.length) {
        console.debug('Cannot create a flight path blob without launch simulation data.');
        return;
    }

    // Write KML header
    let stringArray = [`<?xml version="1.0" encoding="UTF-8"?>\n`];
    stringArray.push(`<kml xmlns="http://www.opengis.net/kml/2.2">\n`);
    stringArray.push(`  <Document>\n`);

    // Create a placemark for the launch site (red color)
    stringArray.push(`    <Placemark>\n`);
    stringArray.push(`      <name>Launch Site</name>\n`);
    stringArray.push(`      <Style id="redStyle">\n`);
    stringArray.push(`        <IconStyle>\n`);
    stringArray.push(`          <color>ff0000ff</color>\n`);
    stringArray.push(`        </IconStyle>\n`);
    stringArray.push(`      </Style>\n`);
    stringArray.push(`      <Point>\n`);
    stringArray.push(`        <altitudeMode>clampToGround</altitudeMode>\n`);
    stringArray.push(`        <coordinates>${launchLocation.longitude},${launchLocation.latitude},0</coordinates>\n`);
    stringArray.push(`      </Point>\n`);
    stringArray.push(`    </Placemark>\n`);

    // Loop through each point and write Placemark
    for (let index = 0; index < launchSimulationList.length; ++index) {
        // Only need the rocket's landing coordinates
        const landingLocation = launchSimulationList[index].getLandingLocation();
        if (null == landingLocation) {
            continue;
        }

        // Write the flight path coordinates with altitude, tag, and color
        stringArray.push(`    <Placemark>\n`);
        stringArray.push(`      <name>Flight Path, ${launchSimulationList[index].getLaunchTime()}</name>\n`);
        
        // flight path track style
        const markerColor = getHourColor(launchSimulationList[index].time);
        stringArray.push(`      <Style>\n`);
        stringArray.push(`        <LineStyle>\n`);
        stringArray.push(`          <color>${markerColor.earthHexadecimal}</color>\n`);
        stringArray.push(`          <width>4</width>\n`);
        stringArray.push(`        </LineStyle>\n`);
        stringArray.push(`      </Style>\n`);
        
        // flight path coordinates
        stringArray.push(`      <LineString>\n`);
        stringArray.push(`        <altitudeMode>relativeToGround</altitudeMode>\n`);
        stringArray.push(`        <tessellate>1</tessellate>\n`);
        stringArray.push(`        <coordinates>\n`);
        for (let pathIndex = 0; pathIndex < launchSimulationList[index].launchPath.length; ++pathIndex) {
            const pathPoint = launchSimulationList[index].launchPath[pathIndex];
            const altitude = feetToMeters(pathPoint.altitude);
            stringArray.push(`          ${pathPoint.location.longitude},${pathPoint.location.latitude},${altitude.toFixed(2)}\n`);
        }
        stringArray.push(`        </coordinates>\n`);
        stringArray.push(`      </LineString>\n`);
        
        stringArray.push(`    </Placemark>\n`);
        
        // Write the ground path coordinates with altitude, tag, and color
        stringArray.push(`    <Placemark>\n`);
        stringArray.push(`      <name>Ground Track, ${launchSimulationList[index].getLaunchTime()}</name>\n`);
        
        // Ground track style (same color as main track, line width 1)
        stringArray.push(`      <Style>\n`);
        stringArray.push(`        <LineStyle>\n`);
        stringArray.push(`          <color>${markerColor.earthHexadecimal}</color>\n`);
        stringArray.push(`          <width>1</width>\n`);
        stringArray.push(`        </LineStyle>\n`);
        stringArray.push(`      </Style>\n`);
        
        // Ground path coordinates
        stringArray.push(`      <LineString>\n`);
        stringArray.push(`        <altitudeMode>clampToGround</altitudeMode>\n`);
        stringArray.push(`        <tessellate>1</tessellate>\n`);
        stringArray.push(`        <coordinates>\n`);
        for (let pathIndex = 0; pathIndex < launchSimulationList[index].launchPath.length; ++pathIndex) {
            const pathPoint = launchSimulationList[index].launchPath[pathIndex];
            stringArray.push(`          ${pathPoint.location.longitude},${pathPoint.location.latitude},0\n`);
        }
        stringArray.push(`        </coordinates>\n`);
        stringArray.push(`      </LineString>\n`);
        
        // Closing the ground track Placemark
        stringArray.push(`    </Placemark>\n`);
        
        // Write the placemark for the last coordinate of the ground track
        if (launchSimulationList[index].launchPath.length > 0) {
            const lastLocation = launchSimulationList[index].launchPath[launchSimulationList[index].launchPath.length - 1].location;
            stringArray.push(`    <Placemark>\n`);
            stringArray.push(`      <name>${launchSimulationList[index].getLaunchTime()}</name>\n`);
            stringArray.push(`      <Style>\n`);
            stringArray.push(`        <IconStyle>\n`);
            stringArray.push(`          <color>00FFFFFF</color>\n`);
            stringArray.push(`        </IconStyle>\n`);
            stringArray.push(`      </Style>\n`);
            stringArray.push(`      <Point>\n`);
            stringArray.push(`        <altitudeMode>clampToGround</altitudeMode>\n`);
            stringArray.push(`        <coordinates>${lastLocation.longitude},${lastLocation.latitude},0</coordinates>\n`);
            stringArray.push(`      </Point>\n`);
            stringArray.push(`    </Placemark>\n`);
        }
    }

    if ((null != waiverLocation) && (waiverRadius > 0)) {
        // Do not cover up the launch site marker with one for the waiver if at the same location
        if ((launchLocation.latitude != waiverLocation.latitude) || (launchLocation.longitude != waiverLocation)) {
            // Create a placemark for the Waiver Center
            stringArray.push(`    <Placemark>\n`);
            stringArray.push(`      <name>Waiver Center</name>\n`);
            stringArray.push(`      <Style>\n`);
            stringArray.push(`        <IconStyle>\n`);
            stringArray.push(`          <color>ff0000ff</color>\n`);
            stringArray.push(`        </IconStyle>\n`);
            stringArray.push(`      </Style>\n`);
            stringArray.push(`      <Point>\n`);
            stringArray.push(`        <altitudeMode>clampToGround</altitudeMode>\n`);
            stringArray.push(`        <coordinates>${waiverLocation.longitude},${waiverLocation.latitude},0</coordinates>\n`);
            stringArray.push(`      </Point>\n`);
            stringArray.push(`    </Placemark>\n`);
        }

        // Plot a circle clamped to the ground representing the waiver area.
        // Using aed color with some transparency.
        stringArray.push(`    <Placemark>\n`);
        stringArray.push(`      <name>Waiver Radius</name>\n`);
        stringArray.push(`      <Style>\n`);
        stringArray.push(`        <LineStyle>\n`);
        stringArray.push(`          <color>ff0000ff</color>\n`);
        stringArray.push(`          <width>2</width>\n`);
        stringArray.push(`        </LineStyle>\n`);
        stringArray.push(`        <PolyStyle>\n`);
        stringArray.push(`          <color>1aff0000</color>\n`);
        stringArray.push(`        </PolyStyle>\n`);
        stringArray.push(`      </Style>\n`);
        stringArray.push(`      <Polygon>\n`);
        stringArray.push(`        <extrude>0</extrude>\n`);
        stringArray.push(`        <altitudeMode>clampToGround</altitudeMode>\n`);
        stringArray.push(`        <outerBoundaryIs>\n`);
        stringArray.push(`          <LinearRing>\n`);
        stringArray.push(`            <coordinates>\n`);

        // Convert the radius from nautical miles to meters
        const waiverRadiusMeters = waiverRadius * 1852.0;

        // The first and last coordinates must be identical
        let northCoordinates = waiverLocation.getCopy();
        moveAlongBearing(northCoordinates, waiverRadiusMeters, 0);
        stringArray.push(`              ${northCoordinates.longitude},${northCoordinates.latitude},0\n`);

        // Add coordinates for points around the circle every 10 degrees
        for (let bearing = 10; bearing < 360; bearing += 10) {
            let ringCoordinates = waiverLocation.getCopy();
            moveAlongBearing(ringCoordinates, waiverRadiusMeters, bearing);
            stringArray.push(`              ${ringCoordinates.longitude},${ringCoordinates.latitude},0\n`);
        }

        stringArray.push(`              ${northCoordinates.longitude},${northCoordinates.latitude},0\n`);
        stringArray.push(`            </coordinates>\n`);
        stringArray.push(`          </LinearRing>\n`);
        stringArray.push(`        </outerBoundaryIs>\n`);
        stringArray.push(`      </Polygon>\n`);
        stringArray.push(`    </Placemark>\n`);
    }

    // Write KML footer
    stringArray.push(`  </Document>\n`);
    stringArray.push(`</kml>\n`);

    return new Blob(stringArray);
}

/**
 * Attempts to write a Blob's contents into a file designated by the user.
 * @param {Blob} kmlBlob - Text formated in the KML standard to be saved.
 * @param {string} defaultName - Name to be suggested when the user selects a destination file.
 */
async function saveKmlFile(kmlBlob, defaultName) {
    // Feature detection. The API needs to be supported
    // and the app not run in an iframe.
    const supportsFileSystemAccess = 'showSaveFilePicker' in window && (() => {
        try {
            return window.self === window.top;
        } catch {
            return false;
        }
    })();

    // If the File System Access API is supported
    if (supportsFileSystemAccess) {
        try {
            const filePickerOptions = {
                types: [
                    {
                        description: "Google Earth file",
                        accept: { "application/vnd.google-earth.kml+xml": [".kml"] },
                    },
                ],
                excludeAcceptAllOption: true,
                multiple: false,
                suggestedName: defaultName,
            };

            // Create a file save dialog for the user to select a location and name
            const saveFileHandle = await showSaveFilePicker(filePickerOptions);

            // Create a FileSystemWritableFileStream we can write to
            const writableFile = await saveFileHandle.createWritable();
            
            // Write our blob's contents to the file
            await writableFile.write(kmlBlob);

            // Close the file and write the contents to disk
            await writableFile.close();
        } catch (err) {
            // Fail silently if the user has simply canceled the dialog.
            if (err.name !== 'AbortError') {
                console.error(err.name, err.message);
            }
        }
    } else {
        // Fallback if the File System Access API is not supported
        // Create the blob URL
        const blobURL = URL.createObjectURL(kmlBlob);

        // Create the `<a download>` element and append it invisibly.
        const a = document.createElement('a');
        a.href = blobURL;
        a.download = defaultName;
        a.style.display = 'none';
        document.body.append(a);

        // Programmatically click the element.
        a.click();

        // Revoke the blob URL and remove the element.
        setTimeout(() => {
            URL.revokeObjectURL(blobURL);
            a.remove();
        }, 1000);
    }
};


/**
 * Formats the launch and landing plot data according to the KML standard and saves it
 * to a file for later importation into Google Earth.
 * @param {GeoLocation} launchLocation - Coordinates from which rockets are launched.
 * @param {GeoLocation} waiverLocation - Coordinates upon which the FAA waiver is centered.
 * @param {number} waiverRadius - Radius (in nautical miles) the FAA waiver covers.
 * @param {Array.<LaunchSimulationData>} - A list of launch simulation data objects. 
 */
async function saveLandingScatter(launchLocation, waiverLocation, waiverRadius, launchSimulationList) {
    const kmlBlob = await createLandingPlotBlob(launchLocation, waiverLocation, waiverRadius, launchSimulationList);
    await saveKmlFile(kmlBlob, 'LandingScatter.kml');
}


/**
 * Formats the flight path data according to the KML standard and saves it to a file for
 * later importation into Google Earth.
 * @param {GeoLocation} launchLocation - Coordinates from which rockets are launched.
 * @param {GeoLocation} waiverLocation - Coordinates upon which the FAA waiver is centered.
 * @param {number} waiverRadius - Radius (in nautical miles) the FAA waiver covers.
 * @param {Array.<LaunchSimulationData>} - A list of launch simulation data objects. 
 */
async function saveFlightScatter(launchLocation, waiverLocation, waiverRadius, launchSimulationList) {
    const kmlBlob = await createFlightPathBlob(launchLocation, waiverLocation, waiverRadius, launchSimulationList);
    await saveKmlFile(kmlBlob, 'FlightScatter.kml');
}

export { saveLandingScatter, saveFlightScatter };