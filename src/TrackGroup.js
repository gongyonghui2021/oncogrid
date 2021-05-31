'use strict';

import "d3";
import _uniq  from 'lodash.uniq'
import Mustache from 'mustache'

let OncoTrackGroup = function (params, name, rotated, opacityFunc, fillFunc, updateCallback, resizeCallback, isFullscreen) {
    let _self = this;

    _self.prefix = params.prefix || 'og-';
    _self.expandable = params.expandable;
    _self.name = name;
    _self.cellHeight = params.cellHeight || 20;
    _self.height = 0;
    _self.totalHeight = 0;
    _self.width = params.width;
    _self.tracks = [];
    _self.collapsedTracks = [];
    _self.length = 0;

    _self.nullSentinel =  params.nullSentinel || -777;

    _self.isFullscreen = isFullscreen;

    _self.rotated = rotated;
    _self.updateCallback = updateCallback;
    _self.resizeCallback = resizeCallback;
    _self.trackLegend = params.trackLegend;
    _self.trackLegendLabel = params.trackLegendLabel;

    _self.clickFunc = params.clickFunc;
    _self.opacityFunc = opacityFunc;
    _self.fillFunc = fillFunc;

    _self.addTrackFunc = params.addTrackFunc || function(tracks, callback) {
        callback(tracks[0]);
    };
    _self.drawGridLines = params.grid || false;
    _self.domain = params.domain;
    _self.numDomain = _self.domain.length;

    _self.trackData = [];
    _self.wrapper = d3.select(params.wrapper || 'body');
};

/**
 * Method for adding a track to the track group.
 */
OncoTrackGroup.prototype.addTrack = function (tracks) {
    let _self = this;
    tracks = Array.isArray(tracks) ? tracks : [tracks];

    for(var i = 0, track; i < tracks.length; i++) {
        track = tracks[i];

        if(!_self.rendered && track.collapsed && _self.expandable) {
            _self.collapsedTracks.push(track);
        } else {
            _self.tracks.push(track);
        }
    }

    _self.collapsedTracks = _self.collapsedTracks.filter(function(collapsedTrack) {
        return !_self.tracks.some(function(track) {
            return _.isEqual(collapsedTrack, track);
        });
    });

    _self.tracks = _uniq(_self.tracks, 'fieldName');

    _self.length = _self.tracks.length;
    _self.height = _self.cellHeight * _self.length;

    if(_self.rendered) {
        _self.refreshData();
        _self.resizeCallback();
    }
};

/**
 * Method for removing a track from the track group.
 */
OncoTrackGroup.prototype.removeTrack = function(i) {
    let _self = this;

    let removed = _self.tracks.splice(i, 1);
    _self.collapsedTracks = _self.collapsedTracks.concat(removed);
    _self.length = _self.tracks.length;

    _self.refreshData();
    _self.resizeCallback();
};

/**
 * Refreshes the data after adding a new track.
 */
OncoTrackGroup.prototype.refreshData = function () {
    let _self = this;

    _self.trackData = [];
    for (var i = 0, domain; i < _self.domain.length; i++) {
        domain = _self.domain[i];

        for (var j = 0, track, value; j < _self.length; j++) {
            track = _self.tracks[j];
            value = domain[track.fieldName];
            let isNullSentinel = value === _self.nullSentinel;
            _self.trackData.push({
                id: domain.id,
                displayId: _self.rotated ? domain.symbol : domain.id,
                value: value,
                displayValue: isNullSentinel ? 'Not Verified' : value,
                notNullSentinel: !isNullSentinel,
                displayName: track.name,
                fieldName: track.fieldName,
                type: track.type,
                template: track.template || '{{displayId}}<br>{{displayName}}: {{displayValue}}',
            });
        }
    }
};

/**
 * Initializes the container for the track groups.
 */
OncoTrackGroup.prototype.init = function (container) {
    let _self = this;

    _self.container = container;

    _self.label = _self.container.append('text')
        .attr('x', -6)
        .attr('y', -11)
        .attr('dy', '.32em')
        .attr('text-anchor', 'end')
        .attr('class', _self.prefix + 'track-group-label')
        .text(_self.name);

    _self.legendObject = _self.container.append('svg:foreignObject')
        .attr('width', 20)
        .attr('height', 20);

    _self.legend = _self.legendObject
      .attr('x', 0)
      .attr('y', -22)
      .append("xhtml:div")
      .html(_self.trackLegendLabel);

    _self.background = _self.container.append('rect')
        .attr('class', 'background')
        .attr('width', _self.width)
        .attr('height', _self.height);

    _self.refreshData();

    _self.totalHeight = _self.height + (_self.collapsedTracks.length ? _self.cellHeight : 0);
};

/**
 * Renders the track group. Takes the x axis range, and the div for tooltips.
 */
OncoTrackGroup.prototype.render = function (x, div) {
    let _self = this;
    _self.rendered = true;
    _self.x = x;
    _self.div = div;
    _self.computeCoordinates();

    _self.cellWidth = _self.width / _self.domain.length;

    _self.renderData();

    _self.legend
        .on('mouseover', function (e) {
            let coordinates = d3.pointer(e,_self.wrapper.node());

            _self.div.transition()
                .duration(200)
                .style('opacity', 0.9);

            _self.div
                .html(function () {return _self.trackLegend;})
                .style('left', (coordinates[0] + 15) + 'px')
                .style('top', (coordinates[1] + 30) + 'px');
        })
        .on('mouseout', function() {
            _self.div.transition()
                .duration(500)
                .style('opacity', 0);
        });

};

/**
 * Updates the track group rendering based on the given domain and range for axis.
 */
OncoTrackGroup.prototype.update = function(domain, x) {
    let _self = this;

    _self.domain = domain;
    _self.x = x;

    if (_self.domain.length !== _self.numDomain) {
        _self.numDomain = _self.domain.length;
        _self.cellWidth = _self.width / _self.numDomain;
        _self.computeCoordinates();
    }

    _self.container.selectAll('.' + _self.prefix + 'track-data')
        .transition()
        .attr('x', function (d) { return _self.getX(d); })
        .attr('width', _self.cellWidth);

};

/**
 * Resizes to the given width.
 */
OncoTrackGroup.prototype.resize = function (width, x) {
    let _self = this;

    _self.width = width;
    _self.x = x;
    _self.height = _self.cellHeight * _self.length;
    if(_self.collapsedTracks.length) _self.totalHeight = _self.height + _self.cellHeight;

    _self.cellWidth = _self.width / _self.domain.length;

    _self.background
        .attr('class', 'background')
        .attr('width', _self.width)
        .attr('height', _self.height);

    _self.computeCoordinates();

    _self.totalHeight = _self.height + (_self.collapsedTracks.length ? _self.cellHeight : 0);

    _self.renderData();
};

/**
 * Updates coordinate system
 */
OncoTrackGroup.prototype.computeCoordinates = function () {
    let _self = this;

    _self.y = d3.scaleBand()
        .domain(d3.range(_self.length))
        .range([0, _self.height]);

    // append columns
    if (typeof _self.column !== 'undefined') {
        _self.column.remove();
    }

    _self.column = _self.container.selectAll('.' + _self.prefix + 'column')
        .data(_self.domain)
        .enter().append('g')
        .attr('class', _self.prefix + 'column')
        .attr('donor', function (d) { return d.id; })
        .attr('transform', function (d, i) { return 'translate(' + _self.x(i) + ')rotate(-90)'; });

    if (_self.drawGridLines) {
        _self.column.append('line')
            .attr('x1', -_self.height);
    }

    // append rows
    if (typeof _self.row !== 'undefined') {
        _self.row.remove();
    }

    _self.row = _self.container.selectAll('.' + _self.prefix + 'row')
        .data(_self.tracks)
        .enter().append('g')
        .attr('class', _self.prefix + 'row')
        .attr('transform', function (d, i) { return 'translate(0,' + _self.y(i) + ')'; });

    if (_self.drawGridLines) {
        _self.row.append('line')
            .attr('x2', _self.width);
    }

    let labels = _self.row.append('text');

    labels.attr('class', _self.prefix + 'track-label ' + _self.prefix + 'label-text-font')
        .on('click', function (e,d) {
            _self.domain.sort(d.sort(d.fieldName));
            _self.updateCallback(false);
        })
        .transition()
        .attr('x', -6)
        .attr('y', _self.cellHeight / 2)
        .attr('dy', '.32em')
        .attr('text-anchor', 'end')
        .text(function (d, i) {
            return _self.tracks[i].name;
        });

    _self.container.selectAll('.' + _self.prefix + 'remove-track').remove();
    if(_self.expandable) {
         setTimeout(function() {
            let textLengths = {};
            labels.each(function(d) {
                textLengths[d.name] = this.getComputedTextLength();
            });

            _self.row
                .append('text')
                .attr('class', 'remove-track')
                .text('-')
                .attr('y', _self.cellHeight / 2)
                .attr('dy', '.32em')
                .on('click', function(e,d, i) { _self.removeTrack(i); })
                .attr('x', function(d) { return -(textLengths[d.name] + 12 + this.getComputedTextLength()) });
        });
    }

    // append or remove add track button
    let addButton = _self.container.selectAll('.' + _self.prefix + 'add-track');

    if(_self.collapsedTracks.length && _self.expandable) {
        if(addButton.empty()) {
            addButton = _self.container.append('text')
                .text('+')
                .attr('class', '' + _self.prefix + 'add-track')
                .attr('x', -6)
                .attr('dy', '.32em')
                .attr('text-anchor', 'end')
                .on('click', function() {
                    _self.addTrackFunc(_self.collapsedTracks.slice(), _self.addTrack.bind(_self))
                });
        }

        addButton.attr('y', (_self.cellHeight / 2) + (_self.length && _self.cellHeight + _self.y(_self.length - 1)))
    } else {
        addButton.remove();
    }
};

OncoTrackGroup.prototype.getX = function (obj) {
    let _self = this;

    let index = _self.domain.map(function (d) {
        return d.id;
    });

    return _self.x(index.indexOf(obj.id));
};

OncoTrackGroup.prototype.getY = function (obj) {
    let _self = this;

    let index = _self.tracks.map(function (d) {
        return d.fieldName;
    });

    return _self.y(index.indexOf(obj.fieldName));
};

OncoTrackGroup.prototype.toggleGridLines = function () {
    let _self = this;
    _self.drawGridLines = !_self.drawGridLines;
    _self.computeCoordinates();
};

OncoTrackGroup.prototype.renderData = function(x, div) {
    let _self = this;

    let selection = _self.container.selectAll('.' + _self.prefix + 'track-data')
        .data(_self.trackData);

    selection.enter()
        .append('rect')

    selection
        .attr('x', function (d) { return _self.getX(d); })
        .attr('y', function (d) { return _self.getY(d); })
        .attr('width', _self.cellWidth)
        .attr('height', _self.cellHeight)
        .attr('fill', _self.fillFunc)
        .attr('opacity', _self.opacityFunc)
        .attr('class', function (d) {
            return _self.prefix + 'track-data ' +
                _self.prefix + 'track-' + d.fieldName + ' ' +
                _self.prefix + 'track-' + d.value + ' ' +
                _self.prefix + d.id + '-cell';
        })
        .on('click', function (e,d) { _self.clickFunc(e,d); })
        .on('mouseover', function (e,d) {
            let coordinates = d3.pointer(e, _self.wrapper.node());

            _self.div.transition()
                .duration(200)
                .style('opacity', 0.9);

            _self.div.html(Mustache.render(d.template, d))
                .style('left', (coordinates[0] + 15) + 'px')
                .style('top', (coordinates[1] + 30) + 'px');
        })
        .on('mouseout', function () {
            _self.div.transition()
                .duration(500)
                .style('opacity', 0);
        });

    selection.exit().remove();
};

export default OncoTrackGroup;
