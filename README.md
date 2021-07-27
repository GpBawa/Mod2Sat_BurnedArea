# Mod2Sat Burned Area

Mod2Sat: hybrid MODIS and Sentinel algorithm for estimating post-monsoon burned area from agricultural fires in northwestern India

This algorithm is based in Google Earth Engine (EE).

## EE Repository

Clone EE Git Repository in Terminal:
```
git clone https://github.com/GpBawa/Mod2Sat_BurnedArea.git
```

## Input Datasets
We use the following datasets:

#### MODIS, Collection 6:
Dataset will be accessed directly from EarthEngine. 
* MCD64A1 Burned Area, 500m
* MOD09A1 8-Day Composite Surface Reflectance, 500m
* MxD14A1 Active Fires, 1km

#### Sentinel 2A:
Dataset will be accessed directly from EarthEngine. 
* Surface Reflectance, 10m

#### Esri Global Land cover 10:
You need to download data from website(link below) and upload in EarthEngine Asset tab.
https://www.arcgis.com/apps/instant/media/index.html?appid=fc92d38533d440078f17678ebc20e8e2
* 10-class global land cover for 2020, 10m

## ModL2T Burned Area in EE
The output dataset, Mod2Sat burned area, is annual and at 10-m spatial resolution.

Example script:(Upload downloaded scripts in EarthEngine Script tab)
```
In EarthEngine Script tab. Run Script in order
0-NBR_Composite.js
1-NBR_Diff
2-NBR_Thresh.js
3-Mod2Sat.js
```

## Known Issues
* MODIS and Sentinel NBR composites were projected to geographic projection (lat/lon, EPSG:4326) and exported as assets to speed up calculations in GEE and prevent computational timeouts

