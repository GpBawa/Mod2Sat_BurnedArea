var mcd64a1 = ee.ImageCollection("MODIS/006/MCD64A1"),
    mcd12q1 = ee.ImageCollection("MODIS/006/MCD12Q1"),
    glc30 = ee.Image("users/gurjeetpalbawa1990/projects/GlobalFires/IndiaAgFires/glc30"),
    indiaShp = ee.FeatureCollection("users/gurjeetpalbawa1990/projects/GlobalFires/IndiaAgFires/IND_adm1"),
    modisNBR = ee.Image("users/gurjeetpalbawa1990/projects/GlobalFires/IndiaAgFires/modisNBR/modisNBR_2016"),
    sentinalNBR = ee.Image("users/gurjeetpalbawa1990/projects/GlobalFires/IndiaAgFires/sentinalNBR/sentinalNBR_2016");
// --------------------------------------------------------------------
// MODIS + Sentinal Two-Tailed Normalized Burn Ratio (Mod2Sat NBR)
// burned area estimation in Punjab and Haryana, India
// for the post-monsoon burning season from October to November
// Datasets: MODIS\Terra C6 MOD09A1 (8-day composite) & Sentinal 2A
// --------------------------------------------------------------------
// Author: Gurjeetpal
// Last Updated: July 15, 2021

// Default visualization layer: Mod2Sat BA in 2016

// Input Parameters:
var params = require('users/gurjeetpalbawa1990/ModLand:InputParams.js');
// var outputRegion = ee.Geometry.Rectangle([74.5,27.5,77.7,30.6],'EPSG:4326',false);//Haryana Region
var outputRegion = ee.Geometry.Rectangle([73.7,27.5,77.7,32.7],'EPSG:4326',false);
var exportToAssets = false;

// Time Period
var sYear = params.sYear; // Start Year
var eYear = params.eYear; // End Year

// State Boundaries
var punjab = indiaShp.filterMetadata('NAME_1','equals','Punjab');
var haryana = indiaShp.filterMetadata('NAME_1','equals','Haryana');
var states = haryana.merge(punjab);

var Shp = states;

// Params: NBR Thresholds, MODIS-Sentinal NBR Difference Compensation
var preThresh = params.preThresh;
var postThresh = params.postThresh;
var preDiff = params.preDiff;
var postDiff = params.postDiff;

// Pre-fire and post-fire Collection Dates
var inMonths = params.inMonths;
var inDays = params.inDays;

// Simplify featureCollection with the year as a point
var getPtYr = function(feature) {
  return feature.setGeometry(ee.Geometry.Point(iYear,0));
};

//if MCD64A1 BA matches computed features then add to Feature Collection 
var joinBA = function(feature) {
  var subBA = ee.Feature(ee.Join.simple().apply(mcd64a1BAyr,feature,joinFilter).first())
    .select(['sum'],['MCD64A1']);
  return feature.copyProperties(subBA,['MCD64A1']);
};

var joinFilter = ee.Filter.equals({
  leftField: 'STATE',
  rightField: 'NAME_1'
});

var modisScale = ee.Image(modisNBR);
var sentinalScale = ee.Image(sentinalNBR);
var glc30Re = glc30.reproject({crs: sentinalScale.projection()});

// ------------- START OF LOOP ---------------
var totalBA = [];
for(var iYear = sYear; iYear <= eYear; iYear++) {

  // post-fire collection start and end dates
  var dateS_post = ee.Date.fromYMD(iYear, inMonths.get(2), inDays.get(2));
  var dateE_post = ee.Date.fromYMD(iYear, inMonths.get(3), inDays.get(3));
  
  // MCD12Q1 C6 agricultural mask
  var mcd12q1Yr = ee.Image(mcd12q1.filter(ee.Filter.calendarRange(iYear,iYear,'year')).first())
    .select('LC_Type2').eq(12);

  // MCD64A1 C6 Burned Area
  var mcd64a1Yr = ee.Image(mcd64a1.filterDate(dateS_post,dateE_post).select('BurnDate').max())
    .gt(0).unmask(0)
    .reproject({crs: modisScale.projection(), scale: modisScale.projection().nominalScale()});
  
  // var modisNBRyr = modisNBR.filter(ee.Filter.calendarRange(iYear,iYear,'year')).first();
  var modis_NBRpre = modisNBR.select('preFire');
  var modis_NBRpost = modisNBR.select('postFire');

  // var sentinalNBRyr = sentinalNBR.filter(ee.Filter.calendarRange(iYear,iYear,'year')).first();
  var sentinal_NBRpre = sentinalNBR.select('preFire');
  var sentinal_NBRpost = sentinalNBR.select('postFire');

// ----------- Burned Area -------------
// MODIS & Sentinal-derived burned area
  var modisBA = modis_NBRpre.gt(preThresh)
    .multiply(modis_NBRpost.lt(postThresh))
    .gt(0).unmask(0)
    .reproject({crs: modisScale.projection(), scale: modisScale.projection().nominalScale()});

  var sentinalBA = sentinal_NBRpre.add(preDiff)
    .gt(preThresh)
    .multiply(sentinal_NBRpost.add(postDiff))
    .lt(postThresh).gt(0).unmask(0)
   .reproject({crs: sentinalScale.projection(), scale: sentinalScale.projection().nominalScale()});

    
  // Merge MODIS and Sentinal-derived burned area  
  var sentinalPreRe = sentinal_NBRpre
    .reduceResolution({
      reducer: ee.Reducer.mean(),
      maxPixels: 2600
    }).reproject({crs: modisScale.projection(), scale: modisScale.projection().nominalScale()});

  var sentinalPostRe = sentinal_NBRpost
    .reduceResolution({
      reducer: ee.Reducer.mean(),
      maxPixels: 2600
    }).reproject({crs: modisScale.projection(), scale: modisScale.projection().nominalScale()});
  
  var mergeThresh = 0.1;
  // Replace MODIS pixels with Sentinal pixels where the merging criteria is met
  // Mask pixel the don not belong to Sentinal
  var sentinalMask = modis_NBRpre.subtract(sentinalPreRe).abs().lt(mergeThresh)
    .multiply(modis_NBRpost.subtract(sentinalPostRe).abs().lt(mergeThresh)).unmask(0);

  // Mask pixel that belong to Sentinal
  var sentinalRevMask = sentinalMask.eq(0);
      
  var burnAll = sentinalBA.multiply(sentinalMask)
    .add(modisBA.add(mcd64a1Yr).multiply(mcd12q1Yr).gt(0).multiply(sentinalRevMask))
    .updateMask(glc30Re.eq(5).or(glc30Re.eq(4))).gt(0)
    .reproject({crs: sentinalScale.projection(), scale: sentinalScale.projection().nominalScale()});

  // Confidence Scores: MODIS = 1, Sentinal = 2, MCD64A1 = 3
  var burnConf = sentinalBA.multiply(sentinalMask).multiply(2).add(modisBA)
    .add(mcd64a1Yr.multiply(3)).rename('confidence')
    .updateMask(burnAll)
    .reproject({crs: sentinalScale.projection(), scale: sentinalScale.projection().nominalScale()})
    .set('system:time_start',ee.Date.fromYMD(iYear,10,1));

  if (iYear == 2016) {var display = true;} else {var display = false;}
  // Visualize Burned Area & Print Stats
 Map.setCenter(75.8, 30.8, 12);
  // Layers are by default off, click on layers to visualize
  Map.addLayer(burnConf.updateMask(burnConf).clip(Shp),
    {palette:["#FFFFB2","#FED976","#FEB24C","#FD8D3C","#F03B20","#BD0026"]}, iYear.toString(), display);

  var mod2satBAyr = burnAll.multiply(burnConf.gt(1)).rename('Mod2Sat')
    .addBands(burnConf.eq(1).rename('Mod2Sat_C1'))
    .addBands(burnConf.eq(2).rename('Mod2Sat_C2'))
    .addBands(burnConf.eq(3).rename('Mod2Sat_C3'))
    .addBands(burnConf.eq(4).rename('Mod2Sat_C4'))
    .addBands(burnConf.eq(5).rename('Mod2Sat_C5'))
    .addBands(burnConf.eq(6).rename('Mod2Sat_C6'))
    .multiply(ee.Image.pixelArea()).multiply(1/1000/1000)
    .reduceRegions({
      collection: Shp,
      reducer: ee.Reducer.sum(),
    });
  
  var mcd64a1BAyr = mcd64a1Yr.multiply(mcd12q1Yr).rename('MCD64A1')
    .multiply(ee.Image.pixelArea()).multiply(1/1000/1000)
    .reduceRegions({
      collection: Shp,
      reducer: ee.Reducer.sum(),
      crs: modisScale.projection(),
      scale: modisScale.projection().nominalScale()
    });

  var combinedBAyr = mod2satBAyr.map(joinBA); //Add Confidence Sum as attribut to feature
  var totalBA = ee.FeatureCollection(totalBA).merge(combinedBAyr.map(getPtYr));//Add computed feature with year to feature table

  var mod2satBA = mod2satBAyr.reduceColumns({
    reducer: ee.Reducer.sum(),
    selectors: ['Mod2Sat']
  }).toArray().round().toList().get(0);
  
  print(iYear.toString() + ' Mod2Sat BA (km^2):');
  print(mod2satBA);

  var mcd64a1BA = mcd64a1BAyr.reduceColumns({
    reducer: ee.Reducer.sum(),
    selectors: ['sum']
  }).toArray().round().toList().get(0);

  // May reach memory limit; run export.table task
  print(iYear.toString() + ' MCD64A1 BA (km^2):');
  print(mcd64a1BA);
  print('----------------------');
  
  if (exportToAssets === true) {
    Export.image.toAsset({
      image: burnConf.clip(Shp),
      region: outputRegion,
      description: 'Mod2Sat_BA_' + iYear,
      assetId: 'users/gurjeetpalbawa1990/projects/GlobalFires/IndiaAgFires/' + 'Mod2Sat_BA_' + iYear,
      crs: 'EPSG:4326',
      scale: 10,
      maxPixels: 1e12
    });
  }
  
  if (iYear == 2016) {
    Export.image.toDrive({
      image: burnConf.clip(Shp),
      region: outputRegion,
      description: 'Mod2Sat_BA_' + iYear,
      crs: 'EPSG:4326',
      scale: 10,
      maxPixels: 1e12
    });
  }
}

// Run task, can take a couple minutes to finish
Export.table.toDrive({
  collection: totalBA,
  description: 'totalBA_States',
  selectors: ['MCD64A1','Mod2Sat','Mod2Sat_C1','Mod2Sat_C2'
  ,'Mod2Sat_C3','Mod2Sat_C4','Mod2Sat_C5','Mod2Sat_C6',
  'STATE','.geo']
});
