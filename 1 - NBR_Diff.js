var indiaShp = ee.FeatureCollection("users/gurjeetpalbawa1990/projects/GlobalFires/IndiaAgFires/IND_adm1"),
    igbpLandCoverVis = {"min":1,"max":17,"palette":["05450a","086a10","54a708","78d203","009900","c6b044","dcd159","dade48","fbff13","b6ff05","27ff87","c24f44","a5a5a5","ff6d4c","69fff8","f9ffa4","1c0dff"]},
    glc30 = ee.Image("users/gurjeetpalbawa1990/projects/GlobalFires/IndiaAgFires/glc30"),
    modisNBR = ee.Image("users/gurjeetpalbawa1990/projects/GlobalFires/IndiaAgFires/modisNBR/modisNBR_2016"),
    sentinalNBR = ee.Image("users/gurjeetpalbawa1990/projects/GlobalFires/IndiaAgFires/sentinalNBR/sentinalNBR_2016");


// ---------------------------------------------
// Download MODIS-Sentinal pre and post-fire NBR
// regionally averaged differences
// ---------------------------------------------
// Author: Gurjeetpal
// Last updated: July 07, 2021

// Input Parameters:
var params = require('users/gurjeetpalbawa1990/ModLand:InputParams.js');

// Time Period
var sYear = params.sYear; // Start Year
var eYear = params.eYear; // End Year

// State Boundaries

var states = indiaShp.filterMetadata('NAME_1','equals','Haryana');
var Shp = states;

// Pre-fire and post-fire Collection Dates
var inMonths = params.inMonths;
var inDays = params.inDays;

// Function to simplify featureCollection with the year as a point
var getPtYr = function(feature) {
  return feature.setGeometry(ee.Geometry.Point(iYear,0));
};

var modisScale = modisNBR;
var sentinalScale = sentinalNBR;

var glc30Re = glc30.clip(Shp);
Map.addLayer(Shp,{},'Haryana');

var nbrDiff = [];

var modis_NBRpre = modisNBR.select('preFire');
var modis_NBRpost = modisNBR.select('postFire');

var sentinal_NBRpre = sentinalNBR.select('preFire');
var sentinal_NBRpost = sentinalNBR.select('postFire');

var pre_diff = modis_NBRpre.subtract(sentinal_NBRpre).updateMask(glc30Re.eq(5));
var post_diff = modis_NBRpost.subtract(sentinal_NBRpost).updateMask(glc30Re.eq(5));

Map.addLayer(pre_diff,{},"Pre_Diff");
Map.addLayer(post_diff,{},"Post_Diff");


var pre_regionDiff = pre_diff.reduceRegion({
  geometry: Shp.geometry(),
  reducer: ee.Reducer.mean(),
  crs: modisScale.projection(),
  scale: modisScale.projection().nominalScale(),
  maxPixels: 1e12
}).toArray().multiply(1000).round().divide(1000).toList().get(0);

var post_regionDiff = post_diff.reduceRegion({
  geometry: Shp.geometry(),
  reducer: ee.Reducer.mean(),
  crs: modisScale.projection(),
  scale: modisScale.projection().nominalScale(),
  maxPixels: 1e12
}).toArray().multiply(1000).round().divide(1000).toList().get(0);

var nbrDiffYr = pre_diff.rename('preDiff')
.addBands(post_diff.rename('postDiff')).reduceRegions({
  collection: Shp.geometry(),
  reducer: ee.Reducer.mean(),
  crs: modisScale.projection(),
  scale: modisScale.projection().nominalScale(),
}).toList(500,0);

var nbrDiff = ee.FeatureCollection(nbrDiff)
  .merge(ee.FeatureCollection(nbrDiffYr));

// print(iYear.toString() + ' preCol & postCol diff:');
print(pre_regionDiff);
print(post_regionDiff);


// Run tasks
Export.table.toDrive({
  collection: nbrDiff,
  description: 'nbrDiff',
  selectors: ['preDiff','postDiff','.geo']
});
