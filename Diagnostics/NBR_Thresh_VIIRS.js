var mcd12q1 = ee.ImageCollection("MODIS/006/MCD12Q1"),
    indiaShp = ee.FeatureCollection("users/gurjeetpalbawa1990/projects/GlobalFires/IndiaAgFires/IND_adm1"),
    modisNBR = ee.Image("users/gurjeetpalbawa1990/projects/GlobalFires/IndiaAgFires/modisNBR/modisNBR_2016");
// -------------------------------------------------
// Download MODIS pre and post-fire NBR to estimate
// two-tailed burned area thresholds
// -------------------------------------------------
// Author:Gurjeetpal Bawa
// Last updated: July 23, 2021

// Default visualization layer: Cross Comparison in 2016

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

var modisScale = modisNBR;

// ------------- START OF LOOP ---------------
var nbr2T = [];
for(var iYear = sYear; iYear <= eYear; iYear++) {
  
  // post-fire collection start and end dates
  var dateS_post = ee.Date.fromYMD(iYear, inMonths.get(2), inDays.get(2));
  var dateE_post = ee.Date.fromYMD(iYear, inMonths.get(3), inDays.get(3));

  // MCD12Q1 C6 agricultural mask
  var mcd12q1Yr = ee.Image(mcd12q1.filter(ee.Filter.calendarRange(iYear,iYear,'year')).first())
    .select('LC_Type2').eq(12);
  
  // VIIRS active fires
  var viirsOct = ee.FeatureCollection('projects/GlobalFires/VNP14IMGML/VNP14IMGML_' +
      iYear + '_10');
  var viirsNov = ee.FeatureCollection('projects/GlobalFires/VNP14IMGML/VNP14IMGML_' +
      iYear + '_11');
  
  var viirsPts = viirsOct.merge(viirsNov).filterMetadata('type','equals',0);

  var totalFires = viirsPts.reduceToImage(['FRP'], 'mean').gt(0).unmask(0)
    .reproject({crs: modisScale.projection(), scale: modisScale.projection().nominalScale()});

  var modisNBRyr = modisNBR;
  var modis_NBRpre = modisNBRyr.select('preFire');
  var modis_NBRpost = modisNBRyr.select('postFire');
      
  // Threshold: pre-fire maximum NBR
  var maxThreshFire = modis_NBRpre.updateMask(mcd12q1Yr)
    .updateMask(totalFires.gt(0)).select([0],['TmaxFire']);
  var maxThreshNoFire = modis_NBRpre.updateMask(mcd12q1Yr)
    .updateMask(totalFires.eq(0)).select([0],['TmaxNoFire']);

  // Threshold: post-fire minimum NBR
  var minThreshFire = modis_NBRpost.updateMask(mcd12q1Yr)
    .updateMask(totalFires.gt(0)).select([0],['TminFire']);
  var minThreshNoFire = modis_NBRpost.updateMask(mcd12q1Yr)
    .updateMask(totalFires.eq(0)).select([0],['TminNoFire']);
  
  var nbrTall = maxThreshFire.addBands(maxThreshNoFire)
    .addBands(minThreshFire).addBands(minThreshNoFire);
  
  var nbrTQ = nbrTall.reduceRegions({
    collection: Shp,
    reducer: ee.Reducer.percentile(ee.List.sequence(0,100,1)),
    crs: modisScale.projection(),
    scale: modisScale.projection().nominalScale()
  }).toList(1,0).get(0);
  
  nbr2T[(iYear-sYear)] = ee.Feature(nbrTQ).setGeometry(ee.Geometry.Point(iYear,0));
}

print(nbr2T);

Export.table.toDrive({
  collection: ee.FeatureCollection(nbr2T),
  description: 'modisThresh_viirs',
});
