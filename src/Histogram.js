
'use strict';

import "d3";
let OncoHistogram = function (params, s, rotated) {
    let _self = this;

    let histogramBorderPadding = params.histogramBorderPadding || {};
    _self.lineWidthOffset = histogramBorderPadding.left || 10;
    _self.lineHeightOffset = histogramBorderPadding.bottom || 5;
    _self.padding = 20;
    _self.centerText = -6;

    _self.prefix = params.prefix || 'og-';

    _self.observations = params.observations;
    _self.svg = s;
    _self.rotated = rotated || false;

    _self.domain = (_self.rotated ? params.genes : params.donors) || [];
    _self.margin = params.margin || {top: 30, right: 15, bottom: 15, left: 80};

    _self.clickFunc = _self.rotated ? params.geneHistogramClick : params.donorHistogramClick;

    _self.width = params.width || 500;
    _self.height = params.height || 500;

    _self.histogramWidth = (_self.rotated ? _self.height : _self.width);
    _self.histogramHeight = 80;

    _self.numDomain = _self.domain.length;
    _self.barWidth = (_self.rotated ? _self.height : _self.width) / _self.domain.length;

    _self.totalHeight = _self.histogramHeight + _self.lineHeightOffset + _self.padding;
    _self.wrapper = d3.select(params.wrapper || 'body');
};

OncoHistogram.prototype.render = function (x, div) {
    let _self = this;
    _self.x = x;
    _self.div = div;

    /**
     * Want to find the maximum value so we can label the axis and scale the bars accordingly.
     * No need to make this function public.
     * @returns {number}
     */
    function getLargestCount() {
        let retVal = 1;

        for (let i = 0; i < _self.domain.length; i++) {
            let donor = _self.domain[i];
            retVal = Math.max(retVal, donor.count);
        }

        return retVal;
    }

    let topCount = getLargestCount();

    _self.container = _self.svg.append('g')
        .attr('class', _self.prefix + 'histogram')
        .attr('width', function () {
            if (_self.rotated) {
                return _self.height;
            } else {
                return _self.width + _self.margin.left + _self.margin.right;
            }
        })
        .attr('height', _self.histogramHeight)
        .style('margin-left', _self.margin.left + 'px')
        .attr('transform', function () {
            if (_self.rotated) {
                return 'rotate(90)translate(0,-' + (_self.width) + ')';
            } else {
                return '';
            }
        });

    _self.histogram = _self.container.append('g')
        .attr('transform', 'translate(0,-' + (_self.totalHeight + _self.centerText) + ')');

    _self.renderAxis(topCount);

    _self.histogram.selectAll('rect')
        .data(_self.domain)
        .join('rect')
        .on('mouseover', function (e,d) {
            let coordinates = d3.pointer(e,_self.wrapper.node());

            _self.div.transition()
                .duration(200)
                .style('opacity', 0.9);

            _self.div.html( function() {
                if (_self.rotated) {
                    return  d.symbol + '<br/> Count:' + d.count + '<br/>';
                } else {
                    return d.id + '<br/> Count:' + d.count + '<br/>';
                }
            })
                .style('left', (coordinates[0] + 10) + 'px')
                .style('top', (coordinates[1] - 28) + 'px');
        })
        .on('mouseout', function () {
            _self.div.transition()
                .duration(500)
                .style('opacity', 0);
        })
        .on('click', _self.clickFunc)
        .attr('class', function (d) {
            return _self.prefix + 'sortable-bar ' + _self.prefix + d.id + '-bar';
        })
        .attr('width', _self.barWidth - (_self.barWidth < 3 ? 0 : 1)) // If bars are small, do not use whitespace.
        .attr('height', function (d) {
            return _self.histogramHeight * d.count / topCount;
        })
        .attr('x', function (d) {
            return _self.x(_self.getIndex(_self.domain, d.id));
        })
        .attr('y', function (d) {
            return _self.histogramHeight - _self.histogramHeight * d.count / topCount;
        })
        .attr('fill', '#1693C0');
};

OncoHistogram.prototype.update = function (domain, x) {
    let _self = this;
    _self.x = x;
    _self.domain = domain;
    _self.barWidth = (_self.rotated ? _self.height : _self.width) / _self.domain.length;

    _self.histogram.selectAll('rect')
        .transition()
        .attr('width', _self.barWidth - (_self.barWidth < 3 ? 0 : 1)) // If bars are small, do not use whitespace.
        .attr('x', function (d) {
            return _self.x(_self.getIndex(_self.domain, d.id));
        });
};

OncoHistogram.prototype.resize = function (width, height) {
    let _self = this;

    _self.width = width;
    _self.height = height;

    _self.histogramWidth = (_self.rotated ? _self.height : _self.width);

    _self.container
        .attr('width', function () {
            if (_self.rotated) {
                return _self.height;
            } else {
                return _self.width + _self.margin.left + _self.margin.right;
            }
        })
        .attr('transform', function () {
            if (_self.rotated) {
                return 'rotate(90)translate(0,-' + (_self.width) + ')';
            } else {
                return '';
            }
        });

    _self.histogram
        .attr('transform', 'translate(0,-' + (_self.totalHeight + _self.centerText) + ')');

    _self.bottomAxis.attr('x2', _self.histogramWidth + 10);
};

/**
 * Draws Axis for Histogram
 * @param topCount Maximum value
 */
OncoHistogram.prototype.renderAxis = function (topCount) {
    let _self = this;

    _self.bottomAxis = _self.histogram.append('line')
        .attr('class', _self.prefix + 'histogram-axis')
        .attr('y1', _self.histogramHeight + _self.lineHeightOffset)
        .attr('y2', _self.histogramHeight + _self.lineHeightOffset)
        .attr('x2', _self.histogramWidth + _self.lineWidthOffset)

        .attr('transform', 'translate(-' + _self.lineHeightOffset + ',0)');

    _self.histogram.append('line')
        .attr('class', _self.prefix + 'histogram-axis')
        .attr('y1', 0)
        .attr('y2', _self.histogramHeight + _self.lineHeightOffset)
        .attr('transform', 'translate(-' + _self.lineHeightOffset + ',0)');

    _self.histogram.append('text')
        .attr('class', _self.prefix + 'label-text-font')
        .attr('x', _self.centerText)
        .attr('dy', '.32em')
        .attr('text-anchor', 'end')
        .text(topCount);

    // Round to a nice round number and then adjust position accordingly
    let halfInt = parseInt(topCount / 2);
    let secondHeight = _self.histogramHeight - _self.histogramHeight / (topCount / halfInt);

    _self.histogram.append('text')
        .attr('class', _self.prefix + 'label-text-font')
        .attr('x', _self.centerText)
        .attr('y', secondHeight)
        .attr('dy', '.32em')
        .attr('text-anchor', 'end')
        .text(halfInt);

    let label = _self.histogram.append('text')
        .attr('class', _self.prefix + 'label-text-font')
        .attr('dy', '.32em')
        .attr('text-anchor', 'end')
        .text("Mutation freq.");

    label.each(function() {
        let width = this.getBBox().width;

        label.attr('transform', 'rotate(-90)translate(' + (-(_self.histogramHeight - width)) + ',' + -(_self.lineHeightOffset + _self.padding) + ')');
    });
};

/**
 * Helper the gets the index of the current id.
 */
OncoHistogram.prototype.getIndex = function (list, id) {
    for (let i = 0; i < list.length; i++) {
        let obj = list[i];
        if (obj.id === id) {
            return i;
        }
    }

    return -1;
};

OncoHistogram.prototype.destroy = function() {
    let _self = this;
    _self.histogram.remove();
    _self.container.remove();
};

export default OncoHistogram;
