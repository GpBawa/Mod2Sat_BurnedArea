var mcd12q1 = ee.ImageCollection("MODIS/006/MCD12Q1"),
    mcd64a1 = ee.ImageCollection("MODIS/006/MCD64A1"),
    indiaShp = ee.FeatureCollection("users/gurjeetpalbawa1990/projects/GlobalFires/IndiaAgFires/IND_adm1"),
    modisNBR = ee.Image("users/gurjeetpalbawa1990/projects/GlobalFires/IndiaAgFires/modisNBR/modisNBR_2016");
// -----------------------------------
// Cross Comparison of MCD64A1 BA and
// MODIS (MOD09A1)-only ModL2T BA
// -----------------------------------
// Author:Gurjeetpal Bawa
// Last updated: July 23, 2021

// Default visualization layer: Cross Comparison in 2016

// Input Parameters:
var params = require('users/gurjeetpalbawa1990/ModLand:InputParams.js');
var outputRegion = ee.Geometry.Rectangle([73.7,27.5,77.7,32.7],'EPSG:4326',false);

// Time Period
var sYear = params.sYear; // Start Year
var eYear = params.eYear; // End Year

// State Boundaries
var punjab = indiaShp.filterMetadata('NAME_1','equals','Punjab');
var haryana = indiaShp.filterMetadata('NAME_1','equals','Haryana');
var states = haryana.merge(punjab);

var Shp = states;


// Burned Area Classification Thresholds
var preThresh = params.preThresh;
var postThresh = params.postThresh;

// Pre-fire and post-fire Collection Dates
var inMonths = params.inMonths;
var inDays = params.inDays;

var modisScale = ee.Image(modisNBR);
  
// ------------- START OF LOOP ---------------
var modisCM = [];
for(var iYear = sYear; iYear <= eYear; iYear++) {

  // post-fire collection start and end dates
  var dateS_post = ee.Date.fromYMD(iYear, inMonths.get(2), inDays.get(2));
  var dateE_post = ee.Date.fromYMD(iYear, inMonths.get(3), inDays.get(3));

  // MCD12Q1 C6 agricultural mask
  var mcd12q1Yr = ee.Image(mcd12q1.filter(ee.Filter.calendarRange(iYear,iYear,'year')).first())
    .select('LC_Type2').eq(12);
    
  // MCD64A1 C6 Burned Area
  var mcd64a1Yr = ee.Image(mcd64a1.filterDate(dateS_post,dateE_post).select('BurnDate').min())
    .reproject({crs: modisScale.projection(), scale: modisScale.projection().nominalScale()})
    .gt(0).unmask(0);

  var modisNBRyr = modisNBR;
  var modis_NBRpre = modisNBRyr.select('preFire');
  var modis_NBRpost = modisNBRyr.select('postFire');
  
// ----------- Burned Area -------------
// MODIS-derived burned area
  var modisBA = modis_NBRpre.gt(preThresh)
    .multiply(modis_NBRpost.lt(postThresh))
    .gt(0).unmask(0)
    .reproject({crs: modisScale.projection(), scale: modisScale.projection().nominalScale()})
    .multiply(mcd12q1Yr);

  var CM = mcd64a1Yr.gt(0).add(modisBA.gt(0).multiply(2));
  var CMsep = CM.eq(0).rename('TrueNeg').addBands(CM.eq(1).rename('FalseNeg'))
    .addBands(CM.eq(2).rename('FalsePos')).addBands(CM.eq(3).rename('TruePos'));
  
  if (iYear == 2016) {var display = true;} else {var display = false;}
  // Visualize Burned Area & Print Stats
  Map.setCenter(75.8, 30.4, 7);
  // Layers are by default off, click on layers to visualize
  Map.addLayer(CM.clip(Shp), {palette: ['#FFFFFF','#FF0000','#87CEFA','#000000'], min: 0, max: 3},
    iYear.toString(), display);
  
  var CMyr = CMsep.reduceRegions({
      collection: Shp,
      reducer: ee.Reducer.sum().unweighted(),
    }).toList(1,0).get(0);

  modisCM[iYear-sYear] = ee.Feature(CMyr).setGeometry(ee.Geometry.Point(iYear,0));
}

// Run task, takes < 1 min to finish
Export.table.toDrive({
  collection: ee.FeatureCollection(modisCM),
  description: 'modisCM',
});

// -------- Legend --------------
// Create the panel for the legend items.
var makeLegend = function(pos) {
  var legend = ui.Panel({
    style: {
      position: pos,
      padding: '8px 15px'
    }
  });
  return legend;
};

// Create and add the legend title.
var makeTitle = function(title) {
var legendTitle = ui.Label({
  value: title,
  style: {
    fontWeight: 'bold',
    fontSize: '18px',
    margin: '0 0 6px 0',
    padding: '0'
  }
});
return legendTitle;
};

var legend = makeLegend('bottom-left');
legend.add(makeTitle('Confusion Matrix'));

// Creates and styles 1 row of the legend.
var makeRow = function(color, name) {
  // Create the label that is actually the colored box.
  var colorBox = ui.Label({
    style: {
      backgroundColor: '#' + color,
      // Use padding to give the box height and width.
      padding: '8px',
      margin: '0 0 4px 0'
    }
  });

  // Create the label filled with the description text.
  var description = ui.Label({
    value: name,
    style: {margin: '0 0 4px 6px'}
  });

  return ui.Panel({
    widgets: [colorBox, description],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
};

// List of palette colors and class names
var getRows = function(palette,names,legend) {
  for (var i = 0; i < names.length; i++) {
    legend.add(makeRow(palette[i], names[i]));
  }
  return legend;
};

var legend = getRows(['000000','FF0000','87CEFA','FFFFFF'],
  ['True Positive (Both)','False Negative (MCD64A1-only)','False Positive (MOD09A1-only)','True Negative (Neither)'],legend);

Map.add(legend);
