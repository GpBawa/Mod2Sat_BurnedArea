var modisTerraSR = ee.ImageCollection("MODIS/006/MOD09A1"),
    sentinal2 = ee.ImageCollection("COPERNICUS/S2");
// --------------------------------------------------------------------
// MODIS + Landsat Two-Tailed Normalized Burn Ratio (Mod2Sat NBR)
// burned area estimation in Haryana, India
// for the post-monsoon burning season from October to November
// Datasets: MODIS\Terra C6 MOD09A1 (8-day composite) & Landsat 5,7,8
// --------------------------------------------------------------------
// Author: Gurjeetpal Bawa
// Last updated: July 20, 2021

// Input Parameters:
var params = require('users/gurjeetpalbawa1990/ModLand:InputParams.js');
var assetFolder = 'users/gurjeetpalbawa1990/projects/GlobalFires/IndiaAgFires/';
var outputRegion = ee.Geometry.Rectangle([73.7,27.5,77.7,32.7],'EPSG:4326',false);//Punjab and Haryana
// var outputRegion = ee.Geometry.Rectangle([74.4,27.5,77.7,30.7],'EPSG:4326',false);//Haryana

// Time Period
var sYear = params.sYear; // Start Year
var eYear = params.eYear; // End Year

var export_modis = true;
var export_sentinal = true;

// Pre-fire and post-fire Collection Dates
var inMonths = params.inMonths;
var inDays = params.inDays;

// Global functions
var getQABits = params.getQABits;
var calcNBR_modis = params.calcNBR_modis;
var calcNBR_s2 = params.calcNBR_s2;

// ------------- START OF LOOP ---------------
for(var iYear = sYear; iYear <= eYear; iYear++) {

  // pre-fire collection start and end dates
  var dateS_pre = ee.Date.fromYMD(iYear, inMonths.get(0), inDays.get(0));
  var dateE_pre = ee.Date.fromYMD(iYear, inMonths.get(1), inDays.get(1));
  
  // post-fire collection start and end dates
  var dateS_post = ee.Date.fromYMD(iYear, inMonths.get(2), inDays.get(2));
  var dateE_post = ee.Date.fromYMD(iYear, inMonths.get(3), inDays.get(3));

  var modisScale = ee.Image(modisTerraSR.select('sur_refl_b02').first());
  var sentinalScale = ee.Image(sentinal2.first());

  var modisCol_pre = modisTerraSR.filterDate(dateS_pre,dateE_pre);
  var modisCol_post = modisTerraSR.filterDate(dateS_post,dateE_post);

  var modis_NBRpre = ee.ImageCollection(modisCol_pre.map(calcNBR_modis)).max();
  var modis_NBRpost = ee.ImageCollection(modisCol_post.map(calcNBR_modis)).min();
  Map.addLayer(modis_NBRpre,{},'modis_NBRpre');
  Map.addLayer(modis_NBRpost,{},'modis_NBRpost');

  // Sentinal Collections
  if (iYear >= 2015) {
    var s2Col_pre = sentinal2.filterDate(dateS_pre,dateE_pre);
    var s2Col_post = sentinal2.filterDate(dateS_post,dateE_post);

    var s2_NBRpre = s2Col_pre.map(calcNBR_s2).max();
    var s2_NBRpost = s2Col_post.map(calcNBR_s2).min();
    Map.addLayer(s2_NBRpre,{},'s2_NBRpre')
    Map.addLayer(s2_NBRpost,{},'s2_NBRpost')
   
  }
  
  var sentinalMaxRe = s2_NBRpre
    .reproject({crs: modisScale.projection(), scale: sentinalScale.projection().nominalScale()})
    .reduceResolution({
      reducer: ee.Reducer.mean(),
      maxPixels: 2048
    }).reproject({crs: modisScale.projection()});

  var sentinalMinRe = s2_NBRpost
    .reproject({crs: modisScale.projection(), scale: sentinalScale.projection().nominalScale()})
    .reduceResolution({
      reducer: ee.Reducer.mean(),
      maxPixels: 2048
    }).reproject({crs: modisScale.projection()});

  var sentinalMask = modis_NBRpost.subtract(sentinalMinRe).abs().lt(0.1)
    .updateMask(modis_NBRpre.subtract(sentinalMaxRe).abs().lt(0.1))
    .gt(0).unmask(0);  

  
  // Prepare bands for export
  var sentinalNBRyr = s2_NBRpre.addBands(s2_NBRpost).rename(['preFire','postFire'])
    .set('system:time_start',ee.Date.fromYMD(iYear,10,1).millis());

  var modisNBRyr = modis_NBRpre.addBands(modis_NBRpost).rename(['preFire','postFire'])
    .set('system:time_start',ee.Date.fromYMD(iYear,10,1).millis());

  // Export NBR
    if (export_sentinal === true) {
    Export.image.toAsset({
      image: sentinalNBRyr,
      assetId: assetFolder + 'sentinalNBR/sentinalNBR_' + iYear,
      description: 'sentinalNBR_' + iYear,
      region: outputRegion,
      crs: 'EPSG:4326',
      scale: 10,
      maxPixels: 1e13
    });
  }
  
  if (export_modis === true) {
    Export.image.toAsset({
      image: modisNBRyr,
      assetId: assetFolder + 'modisNBR/modisNBR_' + iYear,
      description: 'modisNBR_' + iYear,
      region: outputRegion,
      crs: 'SR-ORG:6974',
      crsTransform: [463.312716528,0,-20015109.354,0,-463.312716527,10007554.677],
      maxPixels: 1e13
    });
  }
}
