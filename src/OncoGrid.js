'use strict';
import "d3";
import cloneDeep  from 'lodash.clonedeep'
import MainGrid  from './MainGrid'
import values  from 'lodash.values'
import EventEmitter  from 'eventemitter3'
import util  from 'util'

let OncoGrid = function(params) {
  let _self = this;
  _self.params = params;
  _self.inputWidth = params.width || 500;
  _self.inputHeight = params.height || 500;
  _self.prefix = params.prefix || 'og-';

  params.wrapper = '.' + _self.prefix + 'container';

  d3.select(params.element || 'body')
    .append('div')
    .attr('class', _self.prefix + 'container')
    .style('position', 'relative');

  _self.initCharts();

  EventEmitter.call(this);
};

util.inherits(OncoGrid, EventEmitter);

/**
 * Instantiate charts
 */
OncoGrid.prototype.initCharts = function() {
  let _self = this;

  _self.clonedParams = cloneDeep(_self.params);

  _self.donors = _self.clonedParams.donors || [];
  _self.genes = _self.clonedParams.genes || [];
  _self.observations = _self.clonedParams.observations || [];

  _self.createLookupTable();
  _self.computeDonorCounts();
  _self.computeGeneScoresAndCount();
  _self.genesSortbyScores();
  _self.computeScores();
  _self.sortByScores();

  _self.mainGrid = new MainGrid(_self.clonedParams, _self.lookupTable, _self.update(_self), function() {
    _self.resize(_self.inputWidth, _self.inputHeight, _self.fullscreen);
  }, _self.emit.bind(_self));

  _self.heatMapMode = _self.mainGrid.heatMap;
  _self.drawGridLines = _self.mainGrid.drawGridLines;
  _self.crosshairMode = _self.mainGrid.crosshair;

  _self.charts = [];
  _self.charts.push(_self.mainGrid);
};

/**
 * Creates a for constant time checks if an observation exists for a given donor, gene coordinate.
 */
OncoGrid.prototype.createLookupTable = function () {
  let _self = this;
  let lookupTable = {};

  for (let i = 0; i < _self.observations.length; i++) {
    let obs = _self.observations[i];
    let donorId = obs.donorId;
    let geneId = obs.geneId;

    if (lookupTable.hasOwnProperty(donorId)) {
      if (lookupTable[donorId].hasOwnProperty(geneId)) {
        lookupTable[donorId][geneId].push(obs.id);
      } else {
        lookupTable[donorId][geneId] = [obs.id];
      }
    } else {
      lookupTable[donorId] = {};
      lookupTable[donorId][geneId] = [obs.id];
    }

    _self.lookupTable = lookupTable;
  }
};

/**
 * Initializes and creates the main SVG with rows and columns. Does prelim sort on data
 */
OncoGrid.prototype.render = function() {
  let _self = this;

  _self.emit('render:all:start');
  setTimeout(function () {
    _self.charts.forEach(function(chart) {
        chart.render();
    });

    _self.emit('render:all:end');
  });
};

/**
 * Updates all charts
 */
OncoGrid.prototype.update = function(scope) {
  let _self = scope;

  return function(donorSort) {
    donorSort = (typeof donorSort === 'undefined' || donorSort === null) ? false: donorSort;

    if (donorSort) {
      _self.computeScores();
      _self.sortByScores();
    }

    _self.charts.forEach(function (chart) {
      chart.update();
    });
  };
};

/**
 * Triggers a resize of OncoGrid to desired width and height.
 */
OncoGrid.prototype.resize = function(width, height, fullscreen) {
  let _self = this;

  _self.fullscreen = fullscreen;
  _self.mainGrid.fullscreen = fullscreen;
  _self.charts.forEach(function (chart) {
    chart.fullscreen = fullscreen;
    chart.resize(Number(width), Number(height));
  });
};

/**
 * Sorts donors by score
 */
OncoGrid.prototype.sortByScores = function() {
  let _self = this;

  _self.donors.sort(_self.sortScore);
};

OncoGrid.prototype.genesSortbyScores = function() {
  let _self = this;

  _self.genes.sort(_self.sortScore);
};

/**
 * Helper for getting donor index position
 */
OncoGrid.prototype.getDonorIndex = function(donors, donorId) {
  for (let i = 0; i < donors.length; i++) {
    let donor = donors[i];
    if (donor.id === donorId) {
      return i;
    }
  }

  return -1;
};

/**
 * Sorts genes by scores and recomputes and sorts donors.
 * Clusters towards top left corner of grid.
 */
OncoGrid.prototype.cluster = function() {
  let _self = this;

  _self.genesSortbyScores();
  _self.computeScores();
  _self.sortByScores();
  _self.update(_self)();
};

OncoGrid.prototype.removeDonors = function(func) {
  let _self = this;

  let removedList = [];

  // Remove donors from data
  for (let i = 0; i < _self.donors.length; i++) {
    let donor = _self.donors[i];
    if (func(donor)) {
      removedList.push(donor.id);
      d3.selectAll('.' + _self.prefix + donor.id + '-cell').remove();
      d3.selectAll('.' + _self.prefix + donor.id + '-bar').remove();
      _self.donors.splice(i, 1);
      i--;
    }
  }

  for (let j = 0; j < _self.observations.length; j++) {
    let obs = _self.observations[j];
    if (_self.donors.indexOf(obs.id) >= 0) {
      _self.observations.splice(j, 1);
      j--;
    }
  }

  _self.computeGeneScoresAndCount();
  _self.update(_self)();
  _self.resize(_self.inputWidth, _self.inputHeight, false);
};

/**
 * Removes genes and updates OncoGrid rendering.
 * @param func function describing the criteria for removing a gene.
 */
OncoGrid.prototype.removeGenes = function(func) {
  let _self = this
  let removedList = [];

  // Remove genes from data
  for (let i = 0; i < _self.genes.length; i++) {
    let gene = _self.genes[i];
    if (func(gene)) {
      removedList.push(gene.id);
      d3.selectAll('.' + _self.prefix + gene.id + '-cell').remove();
      d3.selectAll('.' + _self.prefix + gene.id + '-bar').remove();
      _self.genes.splice(i, 1);
      i--;
    }
  }

  _self.update(_self)();
  _self.resize(_self.inputWidth, _self.inputHeight, false);
};

/**
 * Sorts donors
 * @param func a comparator function.
 */
OncoGrid.prototype.sortDonors = function(func) {
  let _self = this;

  _self.donors.sort(func);
  _self.update(_self)();
};

/**
 * Sorts genes
 * @param func a comparator function.
 */
OncoGrid.prototype.sortGenes= function(func) {
  let _self = this;

  _self.computeScores();
  _self.sortByScores();
  _self.genes.sort(func);
  _self.update(_self)();
};

/**
 * Toggles oncogrid between heatmap mode and regular mode showing individual consequence types.
 */
OncoGrid.prototype.toggleHeatmap = function() {
  let _self = this;

  _self.heatMapMode = _self.mainGrid.toggleHeatmap();
};

OncoGrid.prototype.toggleGridLines = function() {
  let _self = this;

  _self.drawGridLines = _self.mainGrid.toggleGridLines();
};

OncoGrid.prototype.toggleCrosshair = function() {
  let _self = this;

  _self.crosshairMode = _self.mainGrid.toggleCrosshair();
};

/**
 * Returns 1 if at least one mutation, 0 otherwise.
 */
OncoGrid.prototype.mutationScore = function(donor, gene) {
  let _self = this;

  if (_self.lookupTable.hasOwnProperty(donor) && _self.lookupTable[donor].hasOwnProperty(gene)) {
    return 1;
  } else {
    return 0;
  }
};

/**
 * Returns # of mutations a gene has as it's score
 */
OncoGrid.prototype.mutationGeneScore = function(donor, gene) {
  let _self = this;

  if (_self.lookupTable.hasOwnProperty(donor) && _self.lookupTable[donor].hasOwnProperty(gene)) {
    return _self.lookupTable[donor][gene].length;
  } else {
    return 0;
  }
};

/**
 * Computes scores for donor sorting.
 */
OncoGrid.prototype.computeScores = function() {
  let _self = this;

  for (let  i = 0; i < _self.donors.length; i++) {
    let donor = _self.donors[i];
    donor.score = 0;
    for (let  j = 0; j < _self.genes.length; j++) {
      let gene = _self.genes[j];
      donor.score += (_self.mutationScore(donor.id, gene.id) * Math.pow(2, _self.genes.length + 1 - j));
    }
  }

};

/**
 * Computes scores for gene sorting.
 */
OncoGrid.prototype.computeGeneScoresAndCount = function() {
  let _self = this;

  for (let  i = 0; i < _self.genes.length; i++) {
    let gene = _self.genes[i];
    gene.score = 0;
    for (let  j = 0; j < _self.donors.length; j++) {
      let donor = _self.donors[j];
      gene.score += _self.mutationGeneScore(donor.id, gene.id);
    }
    gene.count = gene.score;
  }
};

/**
 * Computes the number of observations for a given donor.
 */
OncoGrid.prototype.computeDonorCounts = function() {
  let _self = this;
  for (let  i = 0; i < _self.donors.length; i++) {
    let donor = _self.donors[i];
    let genes = values(_self.lookupTable[donor.id] || {});
    donor.count = 0;
    for(let  j = 0; j < genes.length; j++) {
      donor.count += genes[j].length;
    }
  }
};

/**
 * Computes the number of observations for a given gene.
 */
OncoGrid.prototype.computeGeneCounts = function() {
  let _self = this;

  for (let  i = 0; i < _self.genes.length; i++) {
    let gene = _self.genes[i];
    gene.count = 0;

    for (let  j = 0; j < _self.observations.length; j++) {
      let obs = _self.observations[j];
      if (gene.id === obs.geneId) {
        gene.count+= 1;
      }
    }

  }
};

/**
 * Comparator for scores
 */
OncoGrid.prototype.sortScore = function(a, b) {
  if (a.score < b.score) {
    return 1;
  } else if (a.score > b.score) {
    return -1;
  } else {
    return a.id >= b.id ? 1: -1;
  }
};

/**
 *  Cleanup function to ensure the svg and any bindings are removed from the dom.
 */
OncoGrid.prototype.destroy = function() {
  let _self = this;

  _self.charts.forEach(function (chart) {
    chart.destroy();
  });
};

OncoGrid.prototype.reload = function() {
  let _self = this;

  _self.destroy();
  _self.initCharts();
  _self.render();
};

export default OncoGrid;
