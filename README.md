# Mod2Sat Burned Area

Mod2Sat: hybrid MODIS and Sentinel algorithm for estimating post-monsoon burned area from agricultural fires in northwestern India

This algorithm is based in Google Earth Engine (EE) and R.

## EE Repository

Clone EE Git Repository in Terminal:
```
git clone https://github.com/GpBawa/Mod2Sat_BurnedArea.git
```

## Input Datasets
We use the following datasets:

#### MODIS, Collection 6:
* MCD64A1 Burned Area, 500m
* MOD09A1 8-Day Composite Surface Reflectance, 500m
* MxD14A1 Active Fires, 1km

#### Sentinel 2A:
* Surface Reflectance, 10m

#### Esri Global Land cover 10:
* 10-class global land cover for 2021, 10m

## ModL2T Burned Area in EE
The output dataset, Mod2Sat burned area, is annual and at 10-m spatial resolution.

Example script:
```

```

## Known Issues
* MODIS and Sentinel NBR composites were projected to geographic projection (lat/lon, EPSG:4326) and exported as assets to speed up calculations in GEE and prevent computational timeouts

