var mcd64a1 = ee.ImageCollection("MODIS/006/MCD64A1"),
    mcd12q1 = ee.ImageCollection("MODIS/006/MCD12Q1"),
    indiaShp = ee.FeatureCollection("users/gurjeetpalbawa1990/projects/GlobalFires/IndiaAgFires/IND_adm1"),
    mod2sat = ee.Image("users/gurjeetpalbawa1990/Mod2Sat_BA_2016");
/// -------------------------------------------------
// Download MODIS pre and post-fire NBR to estimate
// two-tailed burned area thresholds
// -------------------------------------------------
// Author: Gurjeetpal
// Last updated: July 30, 2021

// Input Parameters:
var params = require('users/tl2581/ModL2T_BA:InputParams.js');

// Time Period
var sYear = 2016; // Start Year
var eYear = params.eYear; // End Year

// State Boundaries

var haryana = indiaShp.filterMetadata('NAME_1','equals','Haryana');
var states = haryana.geometry();

var Shp = states;

// Pre-fire and post-fire Collection Dates
var inMonths = params.inMonths;
var inDays = params.inDays;

var modisScale = ee.Image(mcd12q1.first());

var bufferPts = function(feature) {
  return feature.buffer(375);
};

// ------------- START OF LOOP ---------------
var mod2sat_Commission = []; var mcd64a1_Commission = [];
var mod2sat_Omission = []; var mcd64a1_Omission = [];
for(var iYear = sYear; iYear <= eYear; iYear++) {
  
  var filterYr = ee.Filter.calendarRange(iYear,iYear,'year');
  var filterMon = ee.Filter.calendarRange(10,11,'month');
  
  // ModL2T BA
  var mod2satYr = ee.Image(mod2sat).gt(1).selfMask();

  // MCD12Q1 C6 agricultural mask
  var mcd12q1Yr = ee.Image(mcd12q1.filter(filterYr).first())
    .select('LC_Type2').eq(12);

  // MCD64A1 C6 Burned Area
  var mcd64a1Yr = ee.Image(mcd64a1.filter(filterYr).filter(filterMon).select('BurnDate').max())
    .gt(0).selfMask()
    .reproject({crs: modisScale.projection(), scale: modisScale.projection().nominalScale()});
  
  // VIIRS active fires
  var viirsOct = ee.FeatureCollection('projects/GlobalFires/VNP14IMGML/VNP14IMGML_' +
      iYear + '_10');
  var viirsNov = ee.FeatureCollection('projects/GlobalFires/VNP14IMGML/VNP14IMGML_' +
      iYear + '_11');
  
  var viirsPts = viirsOct.merge(viirsNov).filterMetadata('type','equals',0)
    .filterBounds(Shp).map(bufferPts);

  var mod2satYr_Omission = mod2satYr.reduceRegions({
    collection: viirsPts,
    reducer: ee.Reducer.count().unweighted(),
    crs: 'EPSG:4326',
    scale: 10
  });

  var mcd64a1Yr_Omission = mcd64a1Yr.reduceRegions({
    collection: viirsPts,
    reducer: ee.Reducer.count().unweighted(),
    crs: modisScale.projection(),
    scale: modisScale.projection().nominalScale()
  });
  
  var mod2satYr_Commission = mod2satYr.rename('Mod2Sat')
    .addBands(mod2satYr.clip(viirsPts).rename('Mod2Sat_Agree'))
    .reduceRegions({
      collection: Shp,
      reducer: ee.Reducer.count().unweighted(),
      crs: 'EPSG:4326',
      scale: 10
    }).toList(1,0).get(0);
    
  var mcd64a1Yr_Commission = mcd64a1Yr.rename('MCD64A1')
    .addBands(mcd64a1Yr.clip(viirsPts).rename('MCD64A1_Agree'))
    .reduceRegions({
      collection: Shp,
      reducer: ee.Reducer.count().unweighted(),
      crs: modisScale.projection(),
      scale: modisScale.projection().nominalScale()
    }).toList(1,0).get(0);
  
  mod2sat_Omission = ee.FeatureCollection(mod2satYr_Omission).merge(mod2satYr_Omission);
  mcd64a1_Omission = ee.FeatureCollection(mcd64a1_Omission).merge(mcd64a1Yr_Omission);
  
  mod2sat_Commission[(iYear-sYear)] = ee.Feature(mod2satYr_Commission).setGeometry(ee.Geometry.Point(iYear,0));
  mcd64a1_Commission[(iYear-sYear)] = ee.Feature(mcd64a1Yr_Commission).setGeometry(ee.Geometry.Point(iYear,0));
}

Export.table.toDrive({
  collection: ee.FeatureCollection(mod2sat_Commission),
  description: 'Mod2Sat_Commission',
});

Export.table.toDrive({
  collection: ee.FeatureCollection(mcd64a1_Commission),
  description: 'MCD64A1_Commission',
});

Export.table.toDrive({
  collection: ee.FeatureCollection(mod2sat_Omission),
  description: 'Mod2Sat_Omission',
  selectors: ['YYYYMMDD','HHMM','conf','count']
});

Export.table.toDrive({
  collection: ee.FeatureCollection(mcd64a1_Omission),
  description: 'MCD64A1_Omission',
  selectors: ['YYYYMMDD','HHMM','conf','count']
});
