/**
 * @file
 *
 * Defines the {@link WaveformOverview} class.
 *
 * @module peaks/views/waveform.overview
 */

define([
  'peaks/views/playhead-layer',
  'peaks/views/points-layer',
  'peaks/views/segments-layer',
  'peaks/views/waveform-shape',
  'peaks/views/helpers/mousedraghandler',
  'peaks/waveform/waveform.axis',
  'peaks/waveform/waveform.utils',
  'konva'
], function(
  PlayheadLayer,
  PointsLayer,
  SegmentsLayer,
  WaveformShape,
  MouseDragHandler,
  WaveformAxis,
  Utils,
  Konva) {
  'use strict';

  /**
   * Creates the overview waveform view.
   *
   * @class
   * @alias WaveformOverview
   *
   * @param {WaveformData} waveformData
   * @param {HTMLElement} container
   * @param {Peaks} peaks
   */

  function WaveformOverview(waveformData, container, peaks) {
    var self = this;

    self.originalWaveformData = waveformData;
    self.container = container;
    self.peaks = peaks;

    self.options = peaks.options;
    self.width = container.clientWidth;
    self.height = container.clientHeight || self.options.height;

    self.data = waveformData.resample(self.width);

    self.stage = new Konva.Stage({
      container: container,
      width: self.width,
      height: self.height
    });

    self.waveformLayer = new Konva.FastLayer();

    self.createWaveform();

    self._segmentsLayer = new SegmentsLayer(peaks, self, false);
    self._segmentsLayer.addToStage(self.stage);

    self._pointsLayer = new PointsLayer(peaks, self, false, false);
    self._pointsLayer.addToStage(self.stage);

    self.createHighlightRect();

    self._playheadLayer = new PlayheadLayer(
      peaks,
      self,
      false, // showPlayheadTime
      self.options.mediaElement.currentTime
    );

    self._playheadLayer.addToStage(self.stage);

    self.mouseDragHandler = new MouseDragHandler(self.stage, {
      onMouseDown: function(mousePosX) {
        mousePosX = Utils.clamp(mousePosX, 0, self.width);

        var time = self.pixelsToTime(mousePosX);

        self._playheadLayer.updatePlayheadTime(time);

        self.peaks.emit('user_seek', time);
      },

      onMouseMove: function(mousePosX) {
        mousePosX = Utils.clamp(mousePosX, 0, self.width);

        var time = self.pixelsToTime(mousePosX);

        // Update the playhead position. This gives a smoother visual update
        // than if we only use the player_time_update event.
        self._playheadLayer.updatePlayheadTime(time);

        self.peaks.emit('user_seek', time);
      }
    });

    // Events

    self.peaks.on('player_play', function(time) {
      self._playheadLayer.updatePlayheadTime(time);
    });

    self.peaks.on('player_pause', function(time) {
      self._playheadLayer.stop(time);
    });

    peaks.on('player_time_update', function(time) {
      self._playheadLayer.updatePlayheadTime(time);
    });

    peaks.on('zoomview.displaying', function(startTime, endTime) {
      self.updateHighlightRect(startTime, endTime);
    });

    // peaks.on('window_resize', function() {
    //   self.container.hidden = true;
    // });

    // peaks.on('window_resize_complete', function(width) {
    //   self.width = width;
    //   self.data = self.originalWaveformData.resample(self.width);
    //   self.stage.setWidth(self.width);
    //   self.container.removeAttribute('hidden');

    //   self._playheadLayer.zoomLevelChanged();
    // });

    peaks.emit('waveform_ready.overview', this);
  }

  /**
   * Returns the pixel index for a given time, for the current zoom level.
   *
   * @param {Number} time Time, in seconds.
   * @returns {Number} Pixel index.
   */

  WaveformOverview.prototype.timeToPixels = function(time) {
    return Math.floor(time * this.data.adapter.sample_rate / this.data.adapter.scale);
  };

  /**
   * Returns the time for a given pixel index, for the current zoom level.
   *
   * @param {Number} pixels Pixel index.
   * @returns {Number} Time, in seconds.
   */

  WaveformOverview.prototype.pixelsToTime = function(pixels) {
    return pixels * this.data.adapter.scale / this.data.adapter.sample_rate;
  };

  /**
   * @returns {Number} The start position of the waveform shown in the view,
   *   in pixels.
   */

  WaveformOverview.prototype.getFrameOffset = function() {
    return 0;
  };

  /**
   * @returns {Number} The width of the view, in pixels.
   */

  WaveformOverview.prototype.getWidth = function() {
    return this.width;
  };

  /**
   * @returns {Number} The height of the view, in pixels.
   */

  WaveformOverview.prototype.getHeight = function() {
    return this.height;
  };

  /**
   * @returns {WaveformData} The view's waveform data.
   */

  WaveformOverview.prototype.getWaveformData = function() {
    return this.data;
  };

  /**
   * Creates a {WaveformShape} object that draws the waveform in the view,
   * and adds it to the wav
   */

  WaveformOverview.prototype.createWaveform = function() {
    this.waveformShape = new WaveformShape({
      color: this.options.overviewWaveformColor,
      view: this
    });

    this.waveformLayer.add(this.waveformShape);
    this.stage.add(this.waveformLayer);
  };

  WaveformOverview.prototype.createHighlightRect = function() {
    this.highlightLayer = new Konva.FastLayer();

    this.highlightRect = new Konva.Rect({
      x: 0,
      y: 11,
      width: 0,
      stroke: this.options.overviewHighlightRectangleColor,
      strokeWidth: 1,
      height: this.height - (11 * 2),
      fill: this.options.overviewHighlightRectangleColor,
      opacity: 0.3,
      cornerRadius: 2
    });

    this.highlightLayer.add(this.highlightRect);
    this.stage.add(this.highlightLayer);
  };

  /**
   * Updates the position of the highlight region.
   *
   * @param {Number} startTime The start of the highlight region, in seconds.
   * @param {Number} endTime The end of the highlight region, in seconds.
   */

  WaveformOverview.prototype.updateHighlightRect = function(startTime, endTime) {
    var startOffset = this.timeToPixels(startTime);
    var endOffset   = this.timeToPixels(endTime);

    this.highlightRect.setAttrs({
      x:     startOffset,
      width: endOffset - startOffset
    });

    this.highlightLayer.draw();
  };

  WaveformOverview.prototype.destroy = function() {
    if (this.stage) {
      this.stage.destroy();
      this.stage = null;
    }
  };

  return WaveformOverview;
});
