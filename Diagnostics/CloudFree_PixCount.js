var modisTerraSR = ee.ImageCollection("MODIS/006/MOD09A1"),
    sentinel2 = ee.ImageCollection("COPERNICUS/S2"),
    indiaShp = ee.FeatureCollection("users/gurjeetpalbawa1990/projects/GlobalFires/IndiaAgFires/IND_adm1");
// ------------------------------------------------------------
// MODIS and Sentinel usable cloud-free pixels
// in the study region (NW India) and study period (2016)
// ------------------------------------------------------------
// Author: Gurjeetpal Bawa
// Last updated: July 20, 2021

// Input Parameters:
var params = require('users/gurjeetpalbawa1990/ModLand:InputParams.js');


// Time Period
var sYear = params.sYear; // Start Year
var eYear = params.eYear; // End Year

// State Boundaries
var punjab = indiaShp.filterMetadata('NAME_1','equals','Punjab');
var haryana = indiaShp.filterMetadata('NAME_1','equals','Haryana');
var states = haryana.merge(punjab);

var Shp = states;

// Pre-fire and post-fire Collection Dates
var inMonths = params.inMonths;
var inDays = params.inDays;

// Global functions
var getQABits = params.getQABits;
var calcNBR_modis = params.calcNBR_modis;
var calcNBR_s2 = params.calcNBR_s2;

// Simplify featureCollection with the year as a point
var getPtYr = function(feature) {
  return feature.setGeometry(ee.Geometry.Point(iYear,0));
};

// Return valid NBR pixels
var getValidPix = function(image) {
  return image.gt(-1);
};

// ------------- START OF LOOP ---------------
var totalPix = [];
for(var iYear = sYear; iYear <= eYear; iYear++) {

  // pre-fire collection start and end dates
  var dateS_pre = ee.Date.fromYMD(iYear, inMonths.get(0), inDays.get(0));
  var dateE_pre = ee.Date.fromYMD(iYear, inMonths.get(1), inDays.get(1));
  
  // post-fire collection start and end dates
  var dateS_post = ee.Date.fromYMD(iYear, inMonths.get(2), inDays.get(2));
  var dateE_post = ee.Date.fromYMD(iYear, inMonths.get(3), inDays.get(3));

  var modisScale = ee.Image(modisTerraSR.select('sur_refl_b02').first());
  var sentinalScale = ee.Image(sentinel2.first());

  var modisCol_pre = modisTerraSR.filterDate(dateS_pre,dateE_pre);
  var modisCol_post = modisTerraSR.filterDate(dateS_post,dateE_post);

  var modis_NBRpre = ee.ImageCollection(modisCol_pre.map(calcNBR_modis)).max();
  var modis_NBRpost = ee.ImageCollection(modisCol_post.map(calcNBR_modis)).min();
  Map.addLayer(modis_NBRpre,{},'modis_NBRpre');
  Map.addLayer(modis_NBRpost,{},'modis_NBRpost');

  // Sentinal Collections
  if (iYear >= 2015) {
    var s2Col_pre = sentinel2.filterDate(dateS_pre,dateE_pre);
    var s2Col_post = sentinel2.filterDate(dateS_post,dateE_post);

    var s2_NBRpre = s2Col_pre.map(calcNBR_s2).max();
    var s2_NBRpost = s2Col_post.map(calcNBR_s2).min();
    Map.addLayer(s2_NBRpre,{},'s2_NBRpre')
    Map.addLayer(s2_NBRpost,{},'s2_NBRpost')
   
  }

  var pix = modis_NBRpre.rename('MODIS_pre')
    .addBands(modis_NBRpost.rename('MODIS_post'))
    .addBands(s2_NBRpre.rename('Sentinel_pre'))
    .addBands(s2_NBRpost.rename('Sentinel_post'))
    .reduceRegions({
      collection: Shp.geometry(),
      reducer: ee.Reducer.mean().unweighted(),
      crs: modisScale.projection(),
      scale: modisScale.projection().nominalScale()
    }).toList(500,0);

  var totalPix = ee.FeatureCollection(totalPix)
  .merge(ee.FeatureCollection(pix).map(getPtYr));
}

print(totalPix);

// Run tasks, takes 1 min to finish
Export.table.toDrive({
  collection: totalPix,
  description: 'totalPix',
  selectors: ['MODIS_pre','MODIS_post','Sentinel_pre','Sentinel_post','.geo']
});
