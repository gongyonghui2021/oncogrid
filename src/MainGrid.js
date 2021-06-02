'use strict';
import "d3"
import Mustache from 'mustache'

import OncoHistogram from './Histogram'
import OncoTrack from './Track'

let MainGrid = function (params, lookupTable, updateCallback, resizeCallback, emit) {
    let _self = this;

    _self.emit = emit;
    _self.lookupTable = lookupTable;
    _self.updateCallback = updateCallback;
    _self.resizeCallback = resizeCallback;
    _self.loadParams(params);
    _self.init();

    // Histograms and tracks.
    _self.donorHistogram = new OncoHistogram(params, _self.container, false);
    _self.histogramHeight = _self.donorHistogram.totalHeight;

    _self.donorTrack =
        new OncoTrack(params, _self.container, false, params.donorTracks, params.donorOpacityFunc,
            params.donorFillFunc, updateCallback, _self.height, _self.resizeCallback, _self.isFullscreen);
    _self.donorTrack.init();

    _self.geneHistogram = new OncoHistogram(params, _self.container, true);
    _self.geneTrack =
        new OncoTrack(params, _self.container, true, params.geneTracks, params.geneOpacityFunc,
            params.geneFillFunc, updateCallback, _self.width + _self.histogramHeight, _self.resizeCallback, _self.isFullscreen);
    _self.geneTrack.init();

};

/**
 * Responsible for initializing instance fields of MainGrid from the provided params object.
 * @param params
 */
MainGrid.prototype.loadParams = function (params) {
    let _self = this;
    _self.scaleToFit = typeof params.scaleToFit === 'boolean' ? params.scaleToFit : true;
    _self.leftTextWidth = params.leftTextWidth || 80;
    _self.prefix = params.prefix || 'og-';

    _self.minCellHeight = params.minCellHeight || 10;

    _self.donors = params.donors || [];
    _self.genes = params.genes || [];
    _self.observations = params.observations || [];
    _self.wrapper = d3.select(params.wrapper || 'body');

    _self.colorMap = params.colorMap || {
        'missense_variant': '#ff9b6c',
        'frameshift_variant': '#57dba4',
        'stop_gained': '#af57db',
        'start_lost': '#ff2323',
        'stop_lost': '#d3ec00',
        'initiator_codon_variant': '#5abaff'
    };

    _self.numDonors = _self.donors.length;
    _self.numGenes = _self.genes.length;

    _self.fullscreen = false;

    _self.isFullscreen = function () {
        return _self.fullscreen;
    };

    _self.width = params.width || 500;
    _self.height = params.height || 500;

    _self.inputWidth = params.width || 500;
    _self.inputHeight = params.height || 500;

    _self.cellWidth = _self.width / _self.donors.length;
    _self.cellHeight = _self.height / _self.genes.length;

    if (_self.cellHeight < _self.minCellHeight) {
        _self.cellHeight = _self.minCellHeight;
        params.height = _self.numGenes * _self.minCellHeight;
        _self.height = params.height;
    }

    _self.margin = params.margin || {top: 30, right: 100, bottom: 15, left: 80};
    _self.heatMap = params.heatMap;

    _self.drawGridLines = params.grid || false;
    _self.crosshair = false;

    _self.gridClick = params.gridClick;
    let templates = params.templates || {};
    _self.templates = {
        mainGrid: templates.mainGrid || '{{#observation}}' +
            '{{observation.id}}<br>{{observation.geneSymbol}}<br>' +
            '{{observation.donorId}}<br>{{observation.consequence}}<br>{{/observation}}',

        mainGridCrosshair: templates.mainGridCrosshair || '{{#donor}}Donor: {{donor.id}}<br>{{/donor}}' +
            '{{#gene}}Gene: {{gene.symbol}}<br>{{/gene}}' + '{{#obs}}Mutations: {{obs}}<br>{{/obs}}'
    };
};

/**
 * Creates main svg element, background, and tooltip.
 */
MainGrid.prototype.init = function () {
    let _self = this;

    _self.div = _self.wrapper.append('div')
        .attr('class', _self.prefix + 'tooltip-oncogrid')
        .style('opacity', 0)
        .style('z-index', 9999);

    _self.canvas = _self.wrapper.append('canvas') // forces size of container to prevent default height in IE
        .attr('class', _self.prefix + 'canvas');

    _self.svg = _self.wrapper.append('svg')
        .attr('class', _self.prefix + 'maingrid-svg')
        .attr('id', _self.prefix + 'maingrid-svg')
        .attr('width', '100%')
        .style('position', 'absolute')
        .style('top', 0)
        .style('left', 0);

    _self.container = _self.svg
        .append('g');

    _self.background = _self.container.append('rect')
        .attr('class', 'background')
        .attr('width', _self.width)
        .attr('height', _self.height);
};

/**
 * Only to be called the first time the OncoGrid is rendered. It creates the rects representing the
 * mutation occurrences.
 */
MainGrid.prototype.render = function () {
    let _self = this;

    _self.emit('render:mainGrid:start');
    _self.computeCoordinates();


    _self.container.selectAll('.' + _self.prefix + 'maingrid-svg')
        .data(_self.observations).enter()
        .append('rect')
        .on('mouseover', function (e, d) {
            let coord = d3.pointer(e);
            let xIndex = _self.rangeToDomain(_self.x, coord[0]);
            let yIndex = _self.rangeToDomain(_self.y, coord[1]);
            let template = _self.crosshair ? _self.templates.mainGridCrosshair : _self.templates.mainGrid;

            let html = Mustache.render(template || '', {
                observation: d,
                donor: _self.donors[xIndex],
                gene: _self.genes[yIndex]
            });
            if (html) {
                let tooltipCoord = d3.pointer(e, _self.wrapper.node());
                _self.div.transition()
                    .duration(200)
                    .style('opacity', 0.9);

                _self.div.html(html)
                    .style('left', (tooltipCoord[0] + 15) + 'px')
                    .style('top', (tooltipCoord[1] + 30) + 'px');
            }
        })
        .on('mouseout', function () {
            _self.div.transition()
                .duration(500)
                .style('opacity', 0);
        })
        .on('click', function (e, d) {
            if (typeof _self.gridClick !== 'undefined') {
                _self.gridClick(e, d);
            }
        })
        .attr('class', function (d) {
            return _self.prefix + 'sortable-rect ' + _self.prefix + d.donorId + '-cell ' + _self.prefix + d.geneId + '-cell';
        })
        .attr('cons', function (d) {
            return d.consequence;
        })
        .attr('x', function (d) {
            return _self.x(_self.getDonorIndex(_self.donors, d.donorId));
        })
        .attr('y', function (d) {
            return _self.getY(d);
        })
        .attr('width', _self.cellWidth)
        .attr('height', function (d) {
            return _self.getHeight(d);
        })
        .attr('fill', function (d) {
            return _self.getColor(d);
        })
        .attr('opacity', function (d) {
            return _self.getOpacity(d);
        })
        .attr('stroke-width', 2);

    _self.emit('render:mainGrid:end');

    _self.emit('render:donorHisogram:start');
    _self.donorHistogram.render(_self.x, _self.div);
    _self.emit('render:donorHisogram:end');

    _self.emit('render:donorTrack:start');
    _self.donorTrack.render(_self.x, _self.div);
    _self.emit('render:donorTrack:end');

    _self.emit('render:geneHistogram:start');
    _self.geneHistogram.render(_self.y, _self.div);
    _self.emit('render:geneHistogram:end');

    _self.emit('render:geneTrack:start');
    _self.geneTrack.render(_self.y, _self.div);
    _self.emit('render:geneTrack:end');

    _self.defineCrosshairBehaviour();

    _self.resizeSvg();
};

/**
 * Render function ensures presentation matches the data. Called after modifying data.
 */
MainGrid.prototype.update = function () {
    let _self = this;

    // Recalculate positions and dimensions of cells only on change in number of elements
    if (_self.numDonors !== _self.donors.length || _self.numGenes !== _self.genes.length) {
        _self.numDonors = _self.donors.length;
        _self.numGenes = _self.genes.length;
        _self.cellWidth = _self.width / _self.numDonors;
        _self.cellHeight = _self.height / _self.numGenes;
        _self.computeCoordinates();
    } else {
        _self.row.selectAll('text').attr('style', function () {
            if (_self.cellHeight < _self.minCellHeight) {
                return 'display: none;';
            } else {
                return '';
            }
        });
    }

    _self.row
        .transition()
        .attr('transform', function (d) {
            return 'translate( 0, ' + _self.y(_self.genes.indexOf(d)) + ')';
        });

    _self.container.selectAll('.' + _self.prefix + 'sortable-rect')
        .transition()
        .attr('width', _self.cellWidth)
        .attr('height', function (d) {
            return _self.getHeight(d);
        })
        .attr('y', function (d) {
            return _self.getY(d);
        })
        .attr('x', function (d) {
            return _self.x(_self.getDonorIndex(_self.donors, d.donorId));
        });

    _self.donorHistogram.update(_self.donors, _self.x);
    _self.donorTrack.update(_self.donors, _self.x);

    _self.geneHistogram.update(_self.genes, _self.y);
    _self.geneTrack.update(_self.genes, _self.y);
};

/**
 * Updates coordinate system and renders the lines of the grid.
 */
MainGrid.prototype.computeCoordinates = function () {
    let _self = this;

    _self.x = d3.scaleBand()
        .domain(d3.range(_self.donors.length))
        .range([0, _self.width]);
    _self.cellWidth = _self.width / _self.donors.length;

    if (typeof _self.column !== 'undefined') {
        _self.column.remove();
    }

    _self.column = _self.container.selectAll('.' + _self.prefix + 'donor-column')
        .data(_self.donors)
        .enter().append('g')
        .attr('class', _self.prefix + 'donor-column')
        .attr('donor', function (d) {
            return d.id;
        })
        .attr('transform', function (d, i) {
            return 'translate(' + _self.x(i) + ')rotate(-90)';
        });

    if (_self.drawGridLines) {
        _self.column.append('line')
            .attr('x1', -_self.height);
    }

    _self.y = d3.scaleBand()
        .domain(d3.range(_self.genes.length))
        .range([0, _self.height]);
    _self.cellHeight = _self.height / _self.genes.length;

    if (typeof _self.row !== 'undefined') {
        _self.row.remove();
    }

    _self.row = _self.container.selectAll('.' + _self.prefix + 'gene-row')
        .data(_self.genes)
        .enter().append('g')
        .attr('class', _self.prefix + 'gene-row')
        .attr('transform', function (d, i) {
            return 'translate(0,' + _self.y(i) + ')';
        });

    if (_self.drawGridLines) {
        _self.row.append('line')
            .attr('x2', _self.width);
    }

    _self.row.append('text')
        .attr('class', function (g) {
            return _self.prefix + g.id + '-label ' + _self.prefix + 'gene-label ' + _self.prefix + 'label-text-font';
        })
        .attr('x', -8)
        .attr('y', _self.cellHeight / 2)
        .attr('dy', '.32em')
        .attr('text-anchor', 'end')
        .attr('style', function () {
            if (_self.cellHeight < _self.minCellHeight) {
                return 'display: none;';
            } else {
                return '';
            }
        })
        .text(function (d, i) {
            return _self.genes[i].symbol;
        });

    _self.defineRowDragBehaviour();
};

MainGrid.prototype.resize = function (width, height) {
    let _self = this;

    _self.width = width;
    _self.height = height;

    _self.cellWidth = _self.width / _self.donors.length;
    _self.cellHeight = _self.height / _self.genes.length;

    if (_self.cellHeight < _self.minCellHeight) {
        _self.cellHeight = _self.minCellHeight;
        _self.height = _self.genes.length * _self.minCellHeight;
    }

    _self.background
        .attr('width', _self.width)
        .attr('height', _self.height);

    _self.computeCoordinates();

    _self.donorHistogram.resize(width, _self.height);
    _self.donorTrack.resize(width, _self.height, _self.x, _self.height);

    _self.geneHistogram.resize(width, _self.height);
    _self.geneTrack.resize(width, _self.height, _self.y, _self.width + _self.histogramHeight);

    _self.resizeSvg();
    _self.update();

    let boundingBox = _self.container.node().getBBox();
    _self.verticalCross.attr('y2', boundingBox.height);
    _self.horizontalCross.attr('x2', boundingBox.width);

};

MainGrid.prototype.resizeSvg = function () {
    let _self = this;
    let width = _self.margin.left + _self.leftTextWidth + _self.width + _self.histogramHeight + _self.geneTrack.height + _self.margin.right;
    let height = _self.margin.top + _self.histogramHeight + _self.height + _self.donorTrack.height + _self.margin.bottom;

    _self.canvas
        .attr('width', width)
        .attr('height', height);

    if (_self.scaleToFit) {
        _self.canvas.style('width', '100%');
        _self.svg.attr('viewBox', '0 0 ' + width + ' ' + height);
    } else {
        _self.canvas.style('width', width + 'px');
        _self.svg.attr('width', width).attr('height', height);
    }

    _self.container
        .attr('transform', 'translate(' +
            (_self.margin.left + _self.leftTextWidth) + ',' +
            (_self.margin.top + _self.histogramHeight) +
            ')');
};

MainGrid.prototype.defineCrosshairBehaviour = function () {
    let _self = this;

    let moveCrossHair = function (eventType, event) {
        if (_self.crosshair) {
            let coord = d3.pointer(event);

            _self.verticalCross.attr('x1', coord[0]).attr('opacity', 1);
            _self.verticalCross.attr('x2', coord[0]).attr('opacity', 1);
            _self.horizontalCross.attr('y1', coord[1]).attr('opacity', 1);
            _self.horizontalCross.attr('y2', coord[1]).attr('opacity', 1);

            if (eventType === 'mousemove' && typeof _self.selectionRegion !== 'undefined') {
                _self.changeSelection(coord);
            }

            let xIndex = _self.width < coord[0] ? -1 : _self.rangeToDomain(_self.x, coord[0]);
            let yIndex = _self.height < coord[1] ? -1 : _self.rangeToDomain(_self.y, coord[1]);

            let donor = _self.donors[xIndex];
            let gene = _self.genes[yIndex];
            let obsArray = _self.nullableObsLookup(donor, gene);

            let html = Mustache.render(_self.templates.mainGridCrosshair, {
                donor: donor,
                gene: gene,
                obs: obsArray
            });

            if (html) {
                let tooltipCoord = d3.pointer(event, _self.wrapper.node());

                _self.div.transition()
                    .duration(200)
                    .style('opacity', 0.9);

                _self.div.html(html)
                    .style('left', (tooltipCoord[0] + 15) + 'px')
                    .style('top', (tooltipCoord[1] + 30) + 'px');
            }
        }
    };

    _self.verticalCross = _self.container.append('line')
        .attr('class', _self.prefix + 'vertical-cross')
        .attr('y1', -_self.histogramHeight)
        .attr('y2', _self.height + _self.donorTrack.height)
        .attr('opacity', 0)
        .attr('style', 'pointer-events: none');

    _self.horizontalCross = _self.container.append('line')
        .attr('class', _self.prefix + 'horizontal-cross')
        .attr('x1', 0)
        .attr('x2', _self.width + _self.histogramHeight + _self.geneTrack.height)
        .attr('opacity', 0)
        .attr('style', 'pointer-events: none');

    _self.container
        .on('mousedown', function () {
            _self.startSelection(this);
        })
        .on('mouseover', function (e) {
            moveCrossHair('mouseover', e);
        })
        .on('mousemove', function (e) {
            moveCrossHair('mousemove', e);
        })
        .on('mouseout', function () {
            if (_self.crosshair) {
                _self.verticalCross.attr('opacity', 0);
                _self.horizontalCross.attr('opacity', 0);
            }
        })
        .on('mouseup', function (e) {
            _self.finishSelection(e);
        });
};

/**
 * Event behavior when pressing down on the mouse to make a selection
 */
MainGrid.prototype.startSelection = function (e) {
    let _self = this;

    if (_self.crosshair && typeof _self.selectionRegion === 'undefined') {
        e.stopPropagation();
        let coord = d3.pointer(e);

        _self.selectionRegion = _self.container.append('rect')
            .attr('x', coord[0])
            .attr('y', coord[1])
            .attr('width', 1)
            .attr('height', 1)
            .attr('class', _self.prefix + 'selection-region')
            .attr('stroke', 'black')
            .attr('stroke-width', '2')
            .attr('opacity', 0.2);
    }
};

/**
 * Event behavior as you drag selected region around
 */
MainGrid.prototype.changeSelection = function (coord) {
    let _self = this;

    let rect = {
        x: parseInt(_self.selectionRegion.attr('x'), 10),
        y: parseInt(_self.selectionRegion.attr('y'), 10),
        width: parseInt(_self.selectionRegion.attr('width'), 10),
        height: parseInt(_self.selectionRegion.attr('height'), 10)
    };

    let move = {
        x: coord[0] - Number(_self.selectionRegion.attr('x')),
        y: coord[1] - Number(_self.selectionRegion.attr('y'))
    };

    if (move.x < 1 || (move.x * 2 < rect.width)) {
        rect.x = coord[0];
        rect.width -= move.x;
    } else {
        rect.width = move.x;
    }

    if (move.y < 1 || (move.y * 2 < rect.height)) {
        rect.y = coord[1];
        rect.height -= move.y;
    } else {
        rect.height = move.y;
    }

    _self.selectionRegion.attr(rect);
};

/**
 * Event behavior when releasing mouse when finishing with a selection
 */
MainGrid.prototype.finishSelection = function (event) {
    let _self = this;

    if (_self.crosshair && typeof _self.selectionRegion !== 'undefined') {
        event.stopPropagation();

        let x1 = Number(_self.selectionRegion.attr('x'));
        let x2 = x1 + Number(_self.selectionRegion.attr('width'));

        let y1 = Number(_self.selectionRegion.attr('y'));
        let y2 = y1 + Number(_self.selectionRegion.attr('height'));

        let xStart = _self.rangeToDomain(_self.x, x1);
        let xStop = _self.rangeToDomain(_self.x, x2);

        let yStart = _self.rangeToDomain(_self.y, y1);
        let yStop = _self.rangeToDomain(_self.y, y2);

        _self.sliceDonors(xStart, xStop);
        _self.sliceGenes(yStart, yStop);

        _self.selectionRegion.remove();
        delete _self.selectionRegion;

        // The order here is really import, first resize then update.
        // Otherwise weird things happen with grids.
        if (!_self.fullscreen) {
            _self.resize(_self.inputWidth, _self.inputHeight);
        }
        _self.updateCallback(true);
    }
};

/**
 * Used when resizing grid
 * @param start - start index of the selection
 * @param stop - end index of the selection
 */
MainGrid.prototype.sliceGenes = function (start, stop) {
    let _self = this;

    for (let i = 0; i < _self.genes.length; i++) {
        let gene = _self.genes[i];
        if (i < start || i > stop) {
            d3.selectAll('.' + _self.prefix + gene.id + '-cell').remove();
            d3.selectAll('.' + _self.prefix + gene.id + '-bar').remove();
            _self.genes.splice(i, 1);
            i--;
            start--;
            stop--;
        }
    }
};

/**
 * Used when resizing grid
 * @param start - start index of the selection
 * @param stop - end index of the selection
 */
MainGrid.prototype.sliceDonors = function (start, stop) {
    let _self = this;

    for (let i = 0; i < _self.donors.length; i++) {
        let donor = _self.donors[i];
        if (i < start || i > stop) {
            d3.selectAll('.' + _self.prefix + donor.id + '-cell').remove();
            d3.selectAll('.' + _self.prefix + donor.id + '-bar').remove();
            _self.donors.splice(i, 1);
            i--;
            start--;
            stop--;
        }
    }
};

/**
 * Defines the row drag behaviour for moving genes and binds it to the row elements.
 */
MainGrid.prototype.defineRowDragBehaviour = function () {
    let _self = this;

    let drag = d3.drag();
    drag.on('start', function (e) {
        e.sourceEvent.stopPropagation(); // silence other listeners
    });
    drag.on('drag', function (e) {
        let selection = d3.select(this)
        let result = selection.attr("transform").match(/.*translate\(\s*\d+,\s*([\.0-9]+)\).*/)
        if (result && result[1]) {
            d3.select(this).attr("transform", 'translate( 0, ' + (Number(result[1]) + Number(e.dy)) + ')')
        }
    });

    drag.on('end', function (e, d) {
        let coord = d3.pointer(e, _self.container.node());
        let dragged = _self.genes.indexOf(d);
        let yIndex = _self.rangeToDomain(_self.y, coord[1]);

        _self.genes.splice(dragged, 1);
        _self.genes.splice(yIndex, 0, d);

        _self.updateCallback(true);
    });

    let dragSelection = _self.row.call(drag);
    dragSelection.on('click', function (e) {
        if (e.defaultPrevented) {
        }
    });

    _self.row.on('mouseover', function () {
        let curElement = this;
        if (typeof curElement.timeout !== 'undefined') {
            clearTimeout(curElement.timeout);
        }

        d3.select(this)
            .select('.' + _self.prefix + 'remove-gene')
            .attr('style', 'display: block');
    });

    _self.row.on('mouseout', function () {
        let curElement = this;
        curElement.timeout = setTimeout(function () {
            d3.select(curElement).select('.' + _self.prefix + 'remove-gene')
                .attr('style', 'display: none');
        }, 500);
    });
};

/**
 * Function that determines the y position of a mutation within a cell
 */
MainGrid.prototype.getY = function (d) {
    let _self = this;

    let pseudoGenes = _self.genes.map(function (g) {
        return g.id;
    });

    if (_self.heatMap === true) {
        return _self.y(pseudoGenes.indexOf(d.geneId));
    }

    let obsArray = _self.lookupTable[d.donorId][d.geneId];
    return _self.y(pseudoGenes.indexOf(d.geneId)) + (_self.cellHeight / obsArray.length) *
        (obsArray.indexOf(d.id));
};

/**
 * Returns the color for the given observation.
 * @param d observation.
 */
MainGrid.prototype.getColor = function (d) {
    let _self = this;

    if (_self.heatMap === true) {
        return '#D33682';
    } else {
        return _self.colorMap[d.consequence];
    }
};

/**
 * Returns the desired opacity of observation rects. This changes between heatmap and regular mode.
 * @returns {number}
 */
MainGrid.prototype.getOpacity = function (d) {
    let _self = this;

    if (_self.heatMap === true) {
        return 0.25;
    } else {
        return 1;
    }
};

/**
 * Returns the height of an observation cell. This changes between heatmap and regular mode.
 * @returns {number}
 */
MainGrid.prototype.getHeight = function (d) {
    let _self = this;

    if (typeof d !== 'undefined') {
        if (_self.heatMap === true) {
            return _self.cellHeight;
        } else {
            let count = _self.lookupTable[d.donorId][d.geneId].length;
            return _self.cellHeight / count;
        }
    } else {
        return 0;
    }
};

/**
 * Toggles the observation rects between heatmap and regular mode.
 */
MainGrid.prototype.toggleHeatmap = function () {
    let _self = this;

    _self.heatMap = _self.heatMap !== true;

    d3.selectAll('.' + _self.prefix + 'sortable-rect')
        .transition()
        .attr('y', function (d) {
            return _self.getY(d);
        })
        .attr('height', function (d) {
            return _self.getHeight(d);
        })
        .attr('fill', function (d) {
            return _self.getColor(d);
        })
        .attr('opacity', function (d) {
            return _self.getOpacity(d);
        });

    return _self.heatMap;
};

MainGrid.prototype.toggleGridLines = function () {
    let _self = this;

    _self.drawGridLines = !_self.drawGridLines;

    _self.geneTrack.toggleGridLines();
    _self.donorTrack.toggleGridLines();

    _self.computeCoordinates();

    return _self.drawGridLines;
};

MainGrid.prototype.toggleCrosshair = function () {
    let _self = this;
    _self.crosshair = !_self.crosshair;

    return _self.crosshair;
};

/**
 * Helper for getting donor index position
 */
MainGrid.prototype.getDonorIndex = function (donors, donorId) {
    for (let i = 0; i < donors.length; i++) {
        let donor = donors[i];
        if (donor.id === donorId) {
            return i;
        }
    }

    return -1;
};

/**
 * Removes all elements corresponding to the given gene and then removes it from the gene list.
 * @param i index of the gene to remove.
 */
MainGrid.prototype.removeGene = function (i) {
    let _self = this;

    let gene = _self.genes[i];
    if (gene) {
        d3.selectAll('.' + _self.prefix + gene.id + '-cell').remove();
        d3.selectAll('.' + _self.prefix + gene.id + '-bar').remove();
        _self.genes.splice(i, 1);
    }

    _self.updateCallback(true);
};


MainGrid.prototype.rangeToDomain = function (scale, value) {
    return scale.domain()[d3.bisect(d3.range(scale.range()[0],scale.range()[1],scale.step()), value) - 1];
};


MainGrid.prototype.nullableObsLookup = function (donor, gene) {
    let _self = this;

    if (!donor || typeof donor !== 'object') return null;
    if (!gene || typeof gene !== 'object') return null;

    if (_self.lookupTable.hasOwnProperty(donor.id) && _self.lookupTable[donor.id].hasOwnProperty(gene.id)) {
        return _self.lookupTable[donor.id][gene.id].join(', '); // Table stores arrays and we want to return a string;
    } else {
        return null;
    }
};

/**
 * Removes all svg elements for this grid.
 */
MainGrid.prototype.destroy = function () {
    let _self = this;

    _self.wrapper.select('.' + _self.prefix + 'maingrid-svg').remove();
    _self.wrapper.select('.' + _self.prefix + 'canvas').remove();
    _self.wrapper.select('.' + _self.prefix + 'tooltip-oncogrid').remove();
};

export default MainGrid;
