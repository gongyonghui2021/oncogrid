"use strict";

var donors = [
  {"id": "DO1", "age_diagnosis": 49, "alive": true, "foobar": true},
  {"id": "DO2", "age_diagnosis": 62, "alive": false, "foobar": true},
  {"id": "DO3", "age_diagnosis": 1, "alive": true, "foobar": true},
  {"id": "DO4", "age_diagnosis": 59, "alive": true, "foobar": true},
  {"id": "DO5", "age_diagnosis": 12, "alive": true, "foobar": true},
  {"id": "DO6", "age_diagnosis": 32, "alive": true, "foobar": true},
  {"id": "DO7", "age_diagnosis": 80, "alive": true, "foobar": true}
];


var genes = [
  {"id": "ENSG00000141510", "symbol": "TP53", "totalDonors": 40},
  {"id": "ENSG00000157764", "symbol": "BRAF", "totalDonors": 21},
  {"id": "ENSG00000155657", "symbol": "TTN", "totalDonors": 12},
  {"id": "ENSG00000164796", "symbol": "CSMD3", "totalDonors": 4}
];


var observations = [
  {"id": "MU1", "donorId": "DO1", "geneId": "ENSG00000157764","consequence":"missense_variant"},
  {"id": "MU11", "donorId": "DO1", "geneId": "ENSG00000157764","consequence":"frameshift_variant"},
  {"id": "MU2", "donorId": "DO1", "geneId": "ENSG00000141510","consequence":"stop_gained"},
  {"id": "MU3", "donorId": "DO2", "geneId": "ENSG00000141510","consequence":"start_lost"},
  {"id": "MU4", "donorId": "DO3", "geneId": "ENSG00000157764","consequence":"stop_lost"},
  {"id": "MU5", "donorId": "DO4", "geneId": "ENSG00000157764","consequence":"initiator_codon_variant"},
  {"id": "MU6", "donorId": "DO4", "geneId": "ENSG00000164796","consequence":"stop_lost"},
  {"id": "MU7", "donorId": "DO5", "geneId": "ENSG00000155657","consequence":"start_lost"},
  {"id": "MU8", "donorId": "DO5", "geneId": "ENSG00000157764","consequence":"stop_gained"},
  {"id": "MU9", "donorId": "DO6", "geneId": "ENSG00000157764","consequence":"frameshift_variant"}
];

var donorOpacity = function (d) {
  if (d.type === 'int') {
    return d.value / 100;
  } else {
    return 1;
  }
};

var donorFill = function (d) {
  if (d.type === 'bool') {
    if (d.value === true) {
      return '#abc';
    } else {
      return '#f00';
    }
  } else {
    return '#6d72c5';
  }
};

var geneOpacity = function (d) {
  return d.value / 40;
};

var geneTracks = [
  {'name': 'Total Donors Affected', 'fieldName': 'totalDonors', 'type': 'int', 'group': 'cbca'},
];

var sortBool = function(field) {
  return function(a, b) {
    if (a[field] && !b[field]) {
      return 1;
    } else if (!a[field] && b[field]) {
      return -1;
    } else {
      return 0;
    }
  };
};

var sortInt = function(field) {
  return function(a, b) {
    return a[field] - b[field];
  };
};

var donorTracks = [
  {'name': 'Age at Diagnosis', 'fieldName': 'age_diagnosis', 'group':'Clinical', 'type': 'int', 'sort': sortInt},
  {'name': 'Alive', 'fieldName': 'alive', 'type': 'bool', 'group':'Clinical','sort': sortBool},
  {'name': 'Foobar', 'fieldName': 'foobar', 'type': 'bool', 'group':'Data', 'sort': sortBool}
];

var params = {
  element: '#grid-div',
  donors: donors,
  genes: genes,
  observations: observations,
  height: 180,
  width: 300,
  heatMap: false,
  trackHeight: 10,
  trackLegendLabel: '<i>?</i>',
  donorTracks: donorTracks,
  donorOpacityFunc: donorOpacity,
  donorFillFunc: donorFill,
  geneTracks: geneTracks,
  geneOpacityFunc: geneOpacity,
  geneFillFunc: ()=>{ return '#6d72c5';},
  colorMap :{
    'missense_variant': '#ff9b6c',
    'frameshift_variant': '#57dba4',
    'stop_gained': '#af57db',
    'start_lost': '#ff2323',
    'stop_lost': '#d3ec00',
    'initiator_codon_variant': '#5abaff'
  },
  geneClick:(e,d)=>{console.log("clickGene",d)},
  donorClick:(e,d)=>{console.log("clickDonor",d)}
};

var grid = new OncoGrid(params);
grid.render();

function removeCleanDonors() {
  var criteria = function (d) {
    return d.score === 0;
  };

  grid.removeDonors(criteria);
}

function toggleCrosshair() {
  grid.toggleCrosshair();
}

function toggleGridLines() {
  grid.toggleGridLines();
}

function resize() {
  var width = document.getElementById('width-resize').value;
  var height = document.getElementById('height-resize').value;

  grid.resize(width, height);
}
