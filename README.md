# GPS DriftCast
A website that esitmates rocket landing locations based on wind forecasts.

Users enter details about a planned launch such as location and expected altitude.  They also specify a date and times during which the launch may occur.
![Screenshot of the website](/images/ui.png)

The website fetches wind speed and direction forecasts for each hour.  The current forecast provider includes data for wind between ground level and 40,000 feet altitude.  Drift distance is calculated for each wind band the rocket descends through.  A map showing predicted landing locations is then displayed.
![Static map showing predicted landing locations](/images/staticmap.jpg)

KML files containing landing locations and flight paths are also availble to download.  These can be opened in 3D mapping software such as [Google Earth](https://earth.google.com/)
![Flight paths in Google Earth](/images/flight-path.jpg)

Wind forecasts are obtained through the [WindsAloft.us](https://windsaloft.us/) API.  The posted URL includes a referrer code allowing them to track usage statistics.  Please request a new code prior to running this code.  Just replace 'YOUR_REFERRER_CODE' at the top of get_wind_forecast.php with your unique code.

The embedded map is created through [Google Maps Static API](https://developers.google.com/maps/documentation/maps-static).  This service requires a unique user key.  Place your key into the googleMapApiKey variable at the top of main.js relplacing 'YOUR_API_KEY'.
