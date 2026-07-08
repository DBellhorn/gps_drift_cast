import { GeoLocation, feetToMeters, moveAlongBearing } from "./geo.js";
import { LaunchSimulationData } from "./launch.js";
import { getHourColor } from "./map_colors.js";

const styleName = 'Style';
const iconStyleName = 'IconStyle';
const colorName = 'color';
const coordinatesName = 'coordinates';
const scaleName = 'scale';
const altitudeModeName = 'altitudeMode';
const clampToGroundName = 'clampToGround';
const relativeToGroundName = 'relativeToGround';
const placemarkName = 'Placemark';

/**
 * Create a KML Element containing the name associated with the parent Element
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {string} name - Name to be assigned to the Element
 * @returns {Element}
 */
function createKmlName(kmlDoc, name) {
    const nameElem = kmlDoc.createElement('name');
    nameElem.innerHTML = name;
    return nameElem;
}

/**
 * Create a KML Element defining the style used to draw a line
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {string} color - Color to be used when drawing the associated line
 * @param {number} width - Identifies how wide the associated line should be drawn
 * @returns {Element}
 */
function createKmlLineStyle(kmlDoc, color, width) {
    const lineStyleElem = kmlDoc.createElement('LineStyle');
    const lineColorElem = kmlDoc.createElement(colorName);
    lineColorElem.innerHTML = color;
    lineStyleElem.appendChild(lineColorElem);

    const lineWidthElem = kmlDoc.createElement('width');
    lineWidthElem.innerHTML = `${width}`;
    lineStyleElem.appendChild(lineWidthElem);

    return lineStyleElem;
}

/**
 * Create a KML Element defining the style used to draw a polygon
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {string} color - Color to be used when drawing the associated polygon
 * @returns {Element}
 */
function createKmlPolyStyle(kmlDoc, color) {
    const styleElem = kmlDoc.createElement('PolyStyle');
    const colorElem = kmlDoc.createElement(colorName);
    colorElem.innerHTML = color;
    styleElem.appendChild(colorElem);
    return styleElem;
}

/**
 * Create a KML Element defining the style used to draw a shape
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {string} outlineColor - Color to be used when drawing the associated shape's outline
 * @param {string} fillColor - Color to be used when drawing the associated shape's fill
 * @returns {Element}
 */
function createKmlShapeStyle(kmlDoc, outlineColor, fillColor) {
    const styleElem = kmlDoc.createElement(styleName);
    styleElem.appendChild(createKmlLineStyle(kmlDoc, outlineColor, 2));
    styleElem.appendChild(createKmlPolyStyle(kmlDoc, fillColor));
    return styleElem;
}

/**
 * Create a KML Element containing a list of space separated geo-coordinates
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {Array.<GeoLocation>} coordinates - List of coordinates the Element will contain
 * @returns {Element}
 */
function createKmlCoordinates(kmlDoc, coordinates) {
    const coordinatesElem = kmlDoc.createElement(coordinatesName);
    coordinates.forEach((coord) => coordinatesElem.innerHTML += `${coord.longitude},${coord.latitude},0 `);
    return coordinatesElem;
}

/**
 * Create a KML Element containing a list of space separated geo-coordinates
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {Array.<LaunchPathPoint>} launchPath - List of points defining a flight path to be displayed
 * @param {boolean} clampToGround - Indicates if the lines should be clamped to the ground
 * @returns {Element}
 */
function createKmlLaunchPath(kmlDoc, launchPath, clampToGround) {
    const coordinatesElem = kmlDoc.createElement(coordinatesName);
    launchPath.forEach((pathPoint) => coordinatesElem.innerHTML += `${pathPoint.location.longitude},${pathPoint.location.latitude},${clampToGround ? 0 : feetToMeters(pathPoint.altitude)} `);
    return coordinatesElem;
}

/**
 * Create a KML Element defining a text label displayed without a marker icon
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {string} name - Name to be assigned to the Element
 * @param {GeoLocation} coordinate - The coordinates where this label should be placed
 * @returns {Element}
 */
function createKmlLabel(kmlDoc, name, coordinate, agl = 0) {
    const labelElem = kmlDoc.createElement(placemarkName);
    labelElem.setAttribute('xsi:type', 'KmlLabel');
    labelElem.appendChild(createKmlName(kmlDoc, name));

    const styleElem = kmlDoc.createElement(styleName);
    const iconStyleElem = kmlDoc.createElement(iconStyleName);
    const iconScaleElem = kmlDoc.createElement(scaleName);
    iconScaleElem.innerHTML = '0';
    iconStyleElem.appendChild(iconScaleElem);
    styleElem.appendChild(iconStyleElem);
    labelElem.appendChild(styleElem);

    const pointElem = kmlDoc.createElement('Point');
    const altModeElem = kmlDoc.createElement(altitudeModeName);
    altModeElem.innerHTML = (0 === agl) ? clampToGroundName : relativeToGroundName;
    pointElem.appendChild(altModeElem);

    const coordElem = kmlDoc.createElement(coordinatesName);
    coordElem.innerHTML = `${coordinate.longitude},${coordinate.latitude},${agl}`;
    pointElem.appendChild(coordElem);
    labelElem.appendChild(pointElem);

    return labelElem;
}

/**
 * Create a KML Element defining the display style for a marker
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {number} iconScale - Scale of the label's icon
 * @param {number} labelScale - Scale of the label's text
 * @param {string} color - Color to be used for displaying the marker's icon
 * @returns 
 */
function createKmlMarkerStyle(kmlDoc, iconScale, labelScale, color) {
    const styleElem = kmlDoc.createElement(styleName);
    const iconStyleElem = kmlDoc.createElement(iconStyleName);
    const iconStyleScaleElem = kmlDoc.createElement(scaleName);
    iconStyleScaleElem.innerHTML = iconScale;
    iconStyleElem.appendChild(iconStyleScaleElem);

    const iconElem = kmlDoc.createElement('Icon');
    const hrefElem = kmlDoc.createElement('href');
    hrefElem.innerHTML = `https://earth.google.com/earth/document/icon?color=${color}&amp;id=2000&amp;scale=4`;
    iconElem.appendChild(hrefElem);
    iconStyleElem.appendChild(iconElem);

    const hotSpotElem = kmlDoc.createElement('hotSpot');
    hotSpotElem.setAttribute('x', '64');
    hotSpotElem.setAttribute('y', '128');
    hotSpotElem.setAttribute('xunits', 'pixels');
    hotSpotElem.setAttribute('yunits', 'insetPixels');
    iconStyleElem.appendChild(hotSpotElem);

    const labelStyleElem = kmlDoc.createElement('labelStyle');
    const labelStyleScaleElem = kmlDoc.createElement(scaleName);
    labelStyleScaleElem.innerHTML = labelScale;
    labelStyleElem.appendChild(labelStyleScaleElem);
    iconStyleElem.appendChild(labelStyleElem);
    styleElem.appendChild(iconStyleElem);
    return styleElem;
}

/**
 * Create a KML Element defining a marker with an icon and text which reacts to being highlighted
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {string} name - Name to be assigned to the Element
 * @param {string} color - The color to be used when drawing this marker's icon
 * @param {GeoLocation} location - Coordinates identifying where this icon should be placed
 * @returns 
 */
function createKmlMarker(kmlDoc, name, color, location) {
    const placemarkElem = kmlDoc.createElement(placemarkName);
    placemarkElem.appendChild(createKmlName(kmlDoc, name));

    const styleMapElem = kmlDoc.createElement('StyleMap');
    const normalPairElem = kmlDoc.createElement('Pair');
    const normalKeyElem = kmlDoc.createElement('key');
    normalKeyElem.innerHTML = 'normal';
    normalPairElem.appendChild(normalKeyElem);
    normalPairElem.appendChild(createKmlMarkerStyle(kmlDoc, 0.75, 0.75, color));
    styleMapElem.appendChild(normalPairElem);

    const highlightPairElem = kmlDoc.createElement('Pair');
    const highlightKeyElem = kmlDoc.createElement('key');
    highlightKeyElem.innerHTML = 'highlight';
    highlightPairElem.appendChild(highlightKeyElem);
    highlightPairElem.appendChild(createKmlMarkerStyle(kmlDoc, 0.9, 0.75, color));
    styleMapElem.appendChild(highlightPairElem);
    placemarkElem.appendChild(styleMapElem);

    const pointElem = kmlDoc.createElement('Point');
    const altitudeModeElem = kmlDoc.createElement(altitudeModeName);
    altitudeModeElem.innerHTML = clampToGroundName;
    pointElem.appendChild(altitudeModeElem);

    const coordinatesElem = kmlDoc.createElement(coordinatesName);
    coordinatesElem.innerHTML = `${location.longitude},${location.latitude},0`;
    pointElem.appendChild(coordinatesElem);
    placemarkElem.appendChild(pointElem);
    return placemarkElem;
}

/**
 * Create a KML Element defining a line displayed along the ground
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {string} name - Name to be assigned to the Element
 * @param {color} color - The color to be used when drawing this line
 * @param {boolean} clampToGround - Indicates if the lines should be clamped to the ground
 * @param {Array.<LaunchPathPoint>} flightPath - List of points defining the flight path to be drawn
 * @returns {Element}
 */
function createKmlLine(kmlDoc, name, color, clampToGround, flightPath) {
    const lineElem = kmlDoc.createElement(placemarkName);
    lineElem.setAttribute('xsi:type', 'KmlLine');

    lineElem.appendChild(createKmlName(kmlDoc, name));

    const styleElem = kmlDoc.createElement(styleName);
    styleElem.appendChild(createKmlLineStyle(kmlDoc, color, 1));
    lineElem.appendChild(styleElem);

    const lineStringElem = kmlDoc.createElement('LineString');
    const altModeElem = kmlDoc.createElement(altitudeModeName);
    altModeElem.innerHTML = clampToGround ? clampToGroundName : relativeToGroundName;
    lineStringElem.appendChild(altModeElem);

    const tessellateElem = kmlDoc.createElement('tessellate');
    tessellateElem.innerHTML = '1';
    lineStringElem.appendChild(tessellateElem);
    lineStringElem.appendChild(createKmlLaunchPath(kmlDoc, flightPath, clampToGround));
    lineElem.appendChild(lineStringElem);

    return lineElem;
}

/**
 * Create a KML Element which defines a polygon on the ground
 * @param {XMLDocument} kmlDoc - The XMLDocument parent to which the element will be appended
 * @param {Array.<GeoLocation>} coordinates - List of GeoLocations defining a convex polygon outline
 * @returns {Element} Polygon Element that was created
 */
function createKmlPolygon(kmlDoc, coordinates) {
    const polygonElem = kmlDoc.createElement('Polygon');

    const extrudeElem = kmlDoc.createElement('extrude');
    extrudeElem.innerHTML = 0;
    polygonElem.appendChild(extrudeElem);

    const altitudeModeElem = kmlDoc.createElement(altitudeModeName);
    altitudeModeElem.innerHTML = clampToGroundName;
    polygonElem.appendChild(altitudeModeElem);

    const outerBoundaryElem = kmlDoc.createElement('outerBoundaryIs');
    const linearRingElem = kmlDoc.createElement('LinearRing');
    linearRingElem.appendChild(createKmlCoordinates(kmlDoc, coordinates));

    outerBoundaryElem.appendChild(linearRingElem);
    polygonElem.appendChild(outerBoundaryElem);
    return polygonElem;
}

/**
 * Create a KML Element which draws a shape displayed on the ground
 * @param {XMLDocument} kmlDoc - The XMLDocument parent to which the element will be appended
 * @param {string} name - Name to be assigned to the Element
 * @param {string} outlineColor - Color to be used when displaying the shape's outline
 * @param {string} fillColor - Color to be used when displaying the shape's fill
 * @param {Array.<GeoLocation>} coordinates - List of coordinates defining the ellipse outline
 * @returns {Element} - Ellipse Element that was created
 */
function createKmlShape(kmlDoc, name, outlineColor, fillColor, coordinates) {
    const placemarkElem = kmlDoc.createElement(placemarkName);
    placemarkElem.setAttribute('xsi:type', 'KmlShape');

    placemarkElem.appendChild(createKmlName(kmlDoc, name));
    placemarkElem.appendChild(createKmlShapeStyle(kmlDoc, outlineColor, fillColor));
    placemarkElem.appendChild(createKmlPolygon(kmlDoc, coordinates));

    return placemarkElem;
}

/**
 * Create a KML Element which draws a shape displayed on the ground
 * @param {XMLDocument} kmlDoc - The XMLDocument parent to which the element will be appended
 * @param {string} name - Name to be assigned to the Element
 * @param {string} outlineColor - Color to be used when displaying the shape's outline
 * @param {string} fillColor - Color to be used when displaying the shape's fill
 * @param {GeoLocation} circleCenter - Coordinates of the circle's center.
 * @param {number} circleRadius - Radius (m) of the circle.
 * @returns {Element} - Ellipse Element that was created
 */
function createKmlCircle(kmlDoc, name, outlineColor, fillColor, circleCenter, circleRadius) {
    const circleCoordinates = [];

    // The first and last coordinates must be identical
    let northCoordinates = circleCenter.getCopy();
    moveAlongBearing(northCoordinates, circleRadius, 0);
    circleCoordinates.push(northCoordinates.getCopy());

    // Add coordinates for points around the circle every 10 degrees
    for (let bearing = 10; bearing < 360; bearing += 10) {
        let ringCoordinates = circleCenter.getCopy();
        moveAlongBearing(ringCoordinates, circleRadius, bearing);
        circleCoordinates.push(ringCoordinates);
    }

    circleCoordinates.push(northCoordinates);

    return createKmlShape(kmlDoc, name, outlineColor, fillColor, circleCoordinates);
}

/**
 * Create an XmlDocument with KML attributes and append the provided element.
 * @param {XMLDocument} kmlDoc - The XMLDocument parent to which the element will be appended
 * @returns {HTMLElement} - A KML root element all other data can be appended onto.
 */
function createKmlElement(kmlDoc) {
    const kmlElem = kmlDoc.createElement('kml');
    kmlElem.setAttribute('xmlns', 'http://www.opengis.net/kml/2.2');
    kmlElem.setAttribute('xmlns:gx', 'http://www.google.com/kml/ext/2.2');
    kmlElem.setAttribute('xmlns:kml', 'http://www.opengis.net/kml/2.2');
    kmlElem.setAttribute('xmlns:atom', 'http://www.w3.org/2005/Atom');
    kmlElem.setAttribute('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
    kmlElem.setAttribute('xmlns:xsd', 'http://www.w3.org/2001/XMLSchema');
    return kmlElem;
}

/**
 * Formats the flight path data according to the KML standard for display within Google Earth.
 * @param {GeoLocation} launchLocation - Coordinates from which rockets are launched.
 * @param {GeoLocation} waiverLocation - Coordinates upon which the FAA waiver is centered.
 * @param {number} waiverRadius - Radius (in nautical miles) the FAA waiver covers.
 * @param {Array.<LaunchSimulationData>} launchSimulationList - A list of launch simulation data objects.
 * @returns {XMLDocument} - KML document containing all flight path data for display in Google Earth.
 */
function createFlightPathDocument(launchLocation, waiverLocation, waiverRadius, launchSimulationList) {
    if (null == launchLocation) {
        console.debug('Cannot create a flight path blob without a launch location.');
        return;
    }
    if (null == launchSimulationList || 0 == launchSimulationList.length) {
        console.debug('Cannot create a flight path blob without launch simulation data.');
        return;
    }

    const kmlDoc = document.implementation.createDocument(null, null);
    const documentElem = kmlDoc.createElement('Document');

    // Create a placemark for the launch site (red color)
    const redMarkerColor = getHourColor(-1);
    documentElem.appendChild(createKmlMarker(kmlDoc, 'Launch Site', redMarkerColor.webHexadecimal, launchLocation));

    // Loop through each point and write Placemark
    launchSimulationList.forEach(element => {
        const markerColor = getHourColor(element.time);
        
        documentElem.appendChild(createKmlLine(kmlDoc,
                `Flight Path, ${element.getLaunchTime()}`,
                markerColor.earthHexadecimal,
                false,
                element.launchPath));
        
        documentElem.appendChild(createKmlLine(kmlDoc,
                `Ground Track, ${element.getLaunchTime()}`,
                markerColor.earthHexadecimal,
                true,
                element.launchPath));

        // Write the placemark for the rocket's landing coordinates
        const landingLocation = element.getLandingLocation();
        if (null != landingLocation) {
            documentElem.appendChild(createKmlMarker(kmlDoc, element.getLaunchTime(), markerColor.webHexadecimal, landingLocation));
        }
    });

    if ((null != waiverLocation) && (waiverRadius > 0)) {
        // Do not cover up the launch site marker with one for the waiver if at the same location
        if ((launchLocation.latitude != waiverLocation.latitude) || (launchLocation.longitude != waiverLocation)) {
            // Create a placemark for the Waiver Center
            documentElem.appendChild(createKmlMarker(kmlDoc, 'Waiver Center', redMarkerColor.webHexadecimal, waiverLocation));
        }

        // Plot a transparent blue circle with red outline clamped to the ground representing
        // the waiver area. Convert the radius from nautical miles to meters.
        documentElem.appendChild(createKmlCircle(kmlDoc, 'Wavier Radius', `ff${kmlShapeColors[kmlColorIndex]}`, `00${kmlShapeColors[kmlColorIndex]}`, waiverLocation, waiverRadius * 1852.0));
    }

    const kmlElem = createKmlElement(kmlDoc);
    kmlElem.appendChild(documentElem);
    kmlDoc.appendChild(kmlElem);

    return kmlDoc;
}

/**
 * Formats the flight path data according to the KML standard for display within Google Earth.
 * @param {GeoLocation} launchLocation - Coordinates from which rockets are launched.
 * @param {GeoLocation} waiverLocation - Coordinates upon which the FAA waiver is centered.
 * @param {number} waiverRadius - Radius (in nautical miles) the FAA waiver covers.
 * @param {Array.<LaunchSimulationData>} launchSimulationList - A list of launch simulation data objects generated with linear interpolation.
 * @returns {XMLDocument} - KML document containing all ground path data for display in Google Earth.
 */
function createGroundPathDocument(launchLocation, waiverLocation, waiverRadius, launchSimulationList) {
    if (null == launchLocation) {
        console.debug('Cannot create a flight path blob without a launch location.');
        return;
    }
    if (null == launchSimulationList || 0 == launchSimulationList.length) {
        console.debug('Cannot create a flight path blob without launch simulation data.');
        return;
    }

    const kmlDoc = document.implementation.createDocument(null, null);
    const documentElem = kmlDoc.createElement('Document');

    // Create a placemark for the launch site (red color)
    const redMarkerColor = getHourColor(-1);
    documentElem.appendChild(createKmlMarker(kmlDoc, 'Launch Site', redMarkerColor.webHexadecimal, launchLocation));

    // Loop through each point and write Placemark
    launchSimulationList.forEach(element => {
        const markerColor = getHourColor(element.time);
        
        documentElem.appendChild(createKmlLine(kmlDoc,
                `Ground Track, ${element.getLaunchTime()}`,
                markerColor.earthHexadecimal,
                true,
                element.launchPath));

        // Write the placemark for the rocket's landing coordinates
        const landingLocation = element.getLandingLocation();
        if (null != landingLocation) {
            documentElem.appendChild(createKmlMarker(kmlDoc, element.getLaunchTime(), markerColor.webHexadecimal, landingLocation));
        }
    });

    if ((null != waiverLocation) && (waiverRadius > 0)) {
        // Do not cover up the launch site marker with one for the waiver if at the same location
        if ((launchLocation.latitude != waiverLocation.latitude) || (launchLocation.longitude != waiverLocation)) {
            // Create a placemark for the Waiver Center
            documentElem.appendChild(createKmlMarker(kmlDoc, 'Waiver Center', redMarkerColor.webHexadecimal, waiverLocation));
        }

        // Plot a transparent blue circle with red outline clamped to the ground representing
        // the waiver area. Convert the radius from nautical miles to meters.
        documentElem.appendChild(createKmlCircle(kmlDoc, 'Wavier Radius', `ff${kmlShapeColors[kmlColorIndex]}`, `00${kmlShapeColors[kmlColorIndex]}`, waiverLocation, waiverRadius * 1852.0));
    }

    const kmlElem = createKmlElement(kmlDoc);
    kmlElem.appendChild(documentElem);
    kmlDoc.appendChild(kmlElem);

    return kmlDoc;
}

/**
 * Formats the launch and landing plot data according to the KML standard for display within Google Earth.
 * @param {GeoLocation} launchLocation - Coordinates from which rockets are launched.
 * @param {GeoLocation} waiverLocation - Coordinates upon which the FAA waiver is centered.
 * @param {number} waiverRadius - Radius (in nautical miles) the FAA waiver covers.
 * @param {Array.<LaunchSimulationData>} - A list of launch simulation data objects.
 * @returns {XMLDocument} - KML document containing all landing locations for display in Google Earth.
 */
async function createLandingPlotDocument(launchLocation, waiverLocation, waiverRadius, launchSimulationList) {
    if (null == launchLocation) {
        console.debug('Cannot create a landing plot blob without a launch location.');
        return;
    }
    if (null == launchSimulationList || 0 == launchSimulationList.length) {
        console.debug('Cannot create a landing plot blob without launch simulation data.');
        return;
    }

    const kmlDoc = document.implementation.createDocument(null, null);
    const documentElem = kmlDoc.createElement('Document');

    // Create a placemark for the launch site (red color)
    const redMarkerColor = getHourColor(-1);
    documentElem.appendChild(createKmlMarker(kmlDoc, 'Launch Site', redMarkerColor.webHexadecimal, launchLocation));

    // Loop through each point and write Placemark
    launchSimulationList.forEach(element => {
        // Only need the rocket's landing coordinates
        const landingLocation = element.getLandingLocation();
        if (null != landingLocation) {
            // Write the placemark for the rocket's landing coordinates
            const markerColor = getHourColor(element.time);
            documentElem.appendChild(createKmlMarker(kmlDoc, element.getLaunchTime(), markerColor.webHexadecimal, landingLocation));
        }
    });

    if ((null != waiverLocation) && (waiverRadius > 0)) {
        // Do not cover up the launch site marker with one for the waiver if at the same location
        if ((launchLocation.latitude != waiverLocation.latitude) || (launchLocation.longitude != waiverLocation)) {
            // Create a placemark for the Waiver Center
            documentElem.appendChild(createKmlMarker(kmlDoc, 'Waiver Center', redMarkerColor.webHexadecimal, waiverLocation));
        }

        // Plot a transparent blue circle with red outline clamped to the ground representing
        // the waiver area. Convert the radius from nautical miles to meters.
        documentElem.appendChild(createKmlCircle(kmlDoc, 'Wavier Radius', `ff${kmlShapeColors[kmlColorIndex]}`, `00${kmlShapeColors[kmlColorIndex]}`, waiverLocation, waiverRadius * 1852.0));
    }

    const kmlElem = createKmlElement(kmlDoc);
    kmlElem.appendChild(documentElem);
    kmlDoc.appendChild(kmlElem);

    return kmlDoc;
}

/**
 * Extract individual KML strings from the provided document and place them into a Blob.
 * @param {XMLDocument} kmlDoc - XMLDocument in KML format to be converted.
 * @return {Blob} - A Blob containing all the KML strings from the provided document.
 */
function createBlobFromDocument(kmlDoc) {
    // DOM does not consider this line valid XML, so add it directly as a string.
    let xmlStrings = ['<?xml version="1.0" encoding="utf-8"?>'];

    const serializer = new XMLSerializer();
    xmlStrings.push(serializer.serializeToString(kmlDoc));

    return new Blob(xmlStrings, { type: 'application/vnd.google-earth.kml+xml', });
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
    const kmlDoc = await createLandingPlotDocument(launchLocation, waiverLocation, waiverRadius, launchSimulationList);
    const kmlBlob = createBlobFromDocument(kmlDoc);
    await saveKmlFile(kmlBlob, 'LandingScatter.kml');
}

/**
 * Formats the flight path data according to the KML standard and saves it to a file for
 * later importation into Google Earth.
 * @param {GeoLocation} launchLocation - Coordinates from which rockets are launched.
 * @param {GeoLocation} waiverLocation - Coordinates upon which the FAA waiver is centered.
 * @param {number} waiverRadius - Radius (in nautical miles) the FAA waiver covers.
 * @param {Array.<LaunchSimulationData>} launchSimulationList - A list of launch simulation data objects.
 */
async function saveFlightScatter(launchLocation, waiverLocation, waiverRadius, launchSimulationList) {
    const kmlDoc = await createFlightPathDocument(launchLocation, waiverLocation, waiverRadius, launchSimulationList);
    const kmlBlob = createBlobFromDocument(kmlDoc);
    await saveKmlFile(kmlBlob, 'FlightPaths.kml');
}

/**
 * Formats the flight path data projected onto the ground according to the KML standard
 * and saves it to a file for later importation into Google Earth.
 * @param {GeoLocation} launchLocation - Coordinates from which rockets are launched.
 * @param {GeoLocation} waiverLocation - Coordinates upon which the FAA waiver is centered.
 * @param {number} waiverRadius - Radius (in nautical miles) the FAA waiver covers.
 * @param {Array.<LaunchSimulationData>} launchSimulationList - A list of launch simulation data objects.
 */
async function saveGroundPaths(launchLocation, waiverLocation, waiverRadius, launchSimulationList) {
    const kmlDoc = await createGroundPathDocument(launchLocation, waiverLocation, waiverRadius, launchSimulationList);
    const kmlBlob = createBlobFromDocument(kmlDoc);
    await saveKmlFile(kmlBlob, 'GroundPaths.kml');
}

export { saveLandingScatter, saveFlightScatter, saveGroundPaths };
