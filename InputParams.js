// --------------------------------------
// Input Params for ModLand Burned Area 
// --------------------------------------
// Author: Gurjeetpal
// Last updated: July 5, 2021

// Buned Area Classification Thresholds
var preThresh = 0.668;
var postThresh = -0.049;

// Sentinal-MODIS NBR Difference
var preDiff = 0.05;
var postDiff = -0.012;

// Time Period
var sYear = 2016; // Starting Year
var eYear = 2016; // Ending Year

// Pre-fire and post-fire collection start and end dates
// 1. pre-fire start and 2. end month (day)
// 3. post-fire start and 4. end month (day)
var inMonths = ee.List([9,11,10,12]); 
var inDays = ee.List([1,1,1,1]);

// Global functions
// Select QA bits
var getQABits = function(image, start, end, newName) {
    var pattern = 0;
    for (var i = start; i <= end; i++) {
       pattern += Math.pow(2, i);
    }
    return image.select([0], [newName])
                  .bitwiseAnd(pattern)
                  .rightShift(start);
};

// Calculate NBR
// MODIS C6
var calcNBR_modis = function(image) {
  var QA = image.select('StateQA');
  var clear = getQABits(QA, 0, 1, 'clear').expression("b(0) == 0");
  var cloudMask = image.normalizedDifference(['sur_refl_b07','sur_refl_b01']);
  
  var nbr = image.normalizedDifference(['sur_refl_b02','sur_refl_b07']);
  var nbrMasked = nbr.updateMask(clear).updateMask(cloudMask.gt(0));
  return nbrMasked;
};

// Landsat
var calcNBR_l8 = function(image) {
  var QA = image.select('pixel_qa');
  var clear = getQABits(QA, 1, 1, 'clear');
  var cloudMask = image.normalizedDifference(['B7','B4']);
  
  var nbr = image.normalizedDifference(['B5','B7']);
  var nbrMasked = nbr.updateMask(clear).updateMask(cloudMask.gt(0));
  return nbrMasked;
};

var calcNBR_l5and7 = function(image) {
  var QA = image.select('pixel_qa');
  var clear = getQABits(QA, 1, 1, 'clear');
  var cloudMask = image.normalizedDifference(['B7','B3']);
  
  var nbr = image.normalizedDifference(['B4','B7']);
  var nbrMasked = nbr.updateMask(clear).updateMask(cloudMask.gt(0));
  return nbrMasked;
};

//Sentinal-2A
var calcNBR_s2 = function(image) {
    // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = ee.Number(2).pow(10).int();
  var cirrusBitMask = ee.Number(2).pow(11).int();
  // Get the pixel QA band.
  var qa = image.select('QA60');
  // All flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  // Return the masked image, scaled to TOA reflectance, without the QA bands.
  var nbr = image.normalizedDifference(['B8','B12']);
  var nbrMasked = nbr.updateMask(mask)
  return nbrMasked;
};

exports.preThresh = preThresh;
exports.postThresh = postThresh;
exports.preDiff = preDiff;
exports.postDiff = postDiff;

exports.sYear = sYear;
exports.eYear = eYear;
exports.inMonths = inMonths;
exports.inDays = inDays;

exports.getQABits = getQABits;
exports.calcNBR_modis = calcNBR_modis;
exports.calcNBR_l8 = calcNBR_l8;
exports.calcNBR_l5and7 = calcNBR_l5and7;
exports.calcNBR_s2 = calcNBR_s2;
