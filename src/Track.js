'use strict';

import OncoTrackGroup from './TrackGroup'
let OncoTrack = function (params, s, rotated, tracks, opacityFunc, fillFunc, updateCallback, offset, resizeCallback, isFullscreen) {
  let _self = this;
  _self.padding = params.trackPadding || 20;
  _self.offset = offset;
  _self.params = params;
  _self.prefix = params.prefix || 'og-';
  _self.svg = s;
  _self.rotated = rotated || false;
  _self.updateCallback = updateCallback;
  _self.resizeCallback = resizeCallback;
  _self.expandableGroups = params.expandableGroups || [];
  _self.addTrackFunc = params.addTrackFunc;

  _self.isFullscreen = isFullscreen;

  _self.trackLegends = params.trackLegends || {};
  _self.trackLegendLabel = params.trackLegendLabel;

  _self.clickFunc = _self.rotated ? params.geneClick : params.donorClick;

  _self.margin = params.margin || { top: 30, right: 15, bottom: 15, left: 80 };

  _self.domain = (_self.rotated ? params.genes : params.donors) || [];
  _self.width = (_self.rotated ? params.height : params.width) || 500;

  _self.cellHeight = params.trackHeight || 10;
  _self.numDomain = _self.domain.length;
  _self.cellWidth = _self.width / _self.numDomain;

  _self.availableTracks = tracks || [];
  _self.opacityFunc = opacityFunc;
  _self.fillFunc = fillFunc;
  _self.drawGridLines = params.grid || false;

  _self.nullSentinel = params.nullSentinel || -777;

  _self.parseGroups();
};

/**
 * Parses track groups out of input.
 */
OncoTrack.prototype.parseGroups = function () {
  let _self = this;

  _self.groupMap = {}; // Nice for lookups and existence checks
  _self.groups = []; // Nice for direct iteration
  _self.availableTracks.forEach(function (track) {
    let group = track.group || 'Tracks';
    if (_self.groupMap.hasOwnProperty(group)) {
      _self.groupMap[group].addTrack(track);
    } else {
      let trackGroup = new OncoTrackGroup({
        cellHeight: _self.cellHeight,
        width: _self.width,
        clickFunc: _self.clickFunc,
        grid: _self.drawGridLines,
        nullSentinel: _self.nullSentinel,
        domain: _self.domain,
        trackLegend: _self.trackLegends[group] || '',
        trackLegendLabel: _self.trackLegendLabel,
        expandable: _self.expandableGroups.indexOf(group) >= 0,
        addTrackFunc: _self.addTrackFunc,
        wrapper: _self.params.wrapper,
      }, group, _self.rotated, _self.opacityFunc, _self.fillFunc, _self.updateCallback, _self.resizeCallback, _self.isFullscreen);
      trackGroup.addTrack(track);
      _self.groupMap[group] = trackGroup;
      _self.groups.push(trackGroup);
    }
  });
};

/**
 * Initializes the track group data and places container for each group in spaced
 * intervals.
 */
OncoTrack.prototype.init = function () {
  let _self = this;
  _self.container = _self.svg.append('g');

  let labelHeight = 0;
  _self.height = 0;
  for (let  k = 0; k < _self.groups.length; k++) {
    let g = _self.groups[k];
    let trackContainer = _self.container.append('g')
        .attr('transform', 'translate(0,' + _self.height + ')');
    g.init(trackContainer);
    _self.height += Number(g.totalHeight) + _self.padding;

    if(_self.rotated) {
      g.label.each(function() {
        labelHeight = Math.max(labelHeight, this.getBBox().height);
      });
    }
  }

  let translateDown = _self.rotated ? -(_self.offset + _self.height) : (_self.padding + _self.offset);

  _self.container
      .attr('width', _self.width)
      .attr('height', _self.height)
      .attr('class', _self.prefix + 'track')
      .attr('transform', function () {
        return (_self.rotated ? 'rotate(90)' : '') + 'translate(0,' + translateDown + ')'
      });

  _self.height += labelHeight;
};

/** Calls render on all track groups */
OncoTrack.prototype.render = function (x, div) {
  let _self = this;

  for (let  i = 0; i < _self.groups.length; i++) {
    let g = _self.groups[i];
    g.render(x, div);
  }
};

/** Resizes all the track groups */
OncoTrack.prototype.resize = function (width, height, x, offset) {
  let _self = this;

  _self.offset = offset || _self.offset;
  _self.width = _self.rotated ? height : width;
  _self.height = 0;
  let labelHeight = 0;

  for (let  k = 0; k < _self.groups.length; k++) {
    let g = _self.groups[k];
    g.container.attr('transform', 'translate(0,' + _self.height + ')');
    g.resize(_self.width, x);
    _self.height += Number(g.totalHeight) + _self.padding;

    if(_self.rotated) {
      g.label.each(function() {
        labelHeight = Math.max(labelHeight, this.getBBox().height);
      });
    }
  }

  let translateDown = _self.rotated ? -(_self.offset + _self.height) : (_self.padding + _self.offset);

  _self.container
      .attr('width', _self.width)
      .attr('height', _self.height)
      .attr('transform', function () {
        return (_self.rotated ? 'rotate(90)' : '') + 'translate(0,' + translateDown + ')'
      });

  _self.height += labelHeight;
};

/**
 * Updates the rendering of the tracks.
 */
OncoTrack.prototype.update = function (domain, x) {
  let _self = this;

  _self.domain = domain;
  _self.x = x;

  for (let  i = 0; i < _self.groups.length; i++) {
    let g = _self.groups[i];
    g.update(domain, x);
  }
};

OncoTrack.prototype.toggleGridLines = function () {
  let _self = this;

  for (let  i = 0; i < _self.groups.length; i++) {
    let g = _self.groups[i];
    g.toggleGridLines();
  }
};

export default OncoTrack;
