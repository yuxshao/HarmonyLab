/* global define: false */ 
define([
	'lodash', 
	'vexflow'
], function(_, Vex) {
	"use strict";

	// Knows how to render a single bar of a treble or bass staff.
	// 
	// A treble stave bar is typically connected to a "bass" stave and
	// so a stave also knows how to render the stave it is connected to.
	//
	// This object typically collaborates with KeySignature, StaveNotater, and
	// StaveNoteFactory.
	//
	var Stave = function(clef, position) {
		this.init(clef, position);
	};

	_.extend(Stave.prototype, {
		clef: '',
		start_x: 0,
		start_y: 0,
		maxWidth: null,
		maxBarCount: 4,
		firstBarWidth: 90,
		defaultWidth: 120,
		margin: { 
			left: 30, 
			right: 4 
		},
		position: {
			index: 0,
			count: 0
		},
		init: function(clef, position) {
			if(!clef || !position) {
				throw new Error("missing stave clef or position");
			}
			if(!this.validatePosition(position)) {
				throw new Error("missing or invalid stave position");
			}

			this.clef = clef;
			this.position = position;
		},
		validatePosition: function(position) {
			var numRe = /^\d+$/;

			// Note: 
			// - position.index is the index of this stave in the collection 
			// - position.count is the size of the collection
			// - position.maxCount is the maximum number of stave bars that may
			//    be displayed
			if(!position.hasOwnProperty('index') ||
				!position.hasOwnProperty('count') ||
				!position.hasOwnProperty('maxCount') || 
				!numRe.test(position.index) || 
				!numRe.test(position.count) || 
				!numRe.test(position.maxCount)) {
				return false;
			}

			// ensure the maximum number of bars is nonzero
			// since we must display at least one stave bar
			if(position.maxCount === 0) {
				return false;
			}

			return true;
		},
		render: function() {
			this.createStaveBar();
			this.createStaveVoice();
			this.formatStaveVoice();

			this.drawStaveVoice();
			this.drawStaveBar();

			if(this.isConnected()) {
				this.renderConnected();
				this.renderStaveConnector();
			}

			this.notate();

			return this;
		},
		renderConnected: function() {
			this.doConnected('render');
		},
		renderStaveConnector: function() {
			if(this.isFirstBar()) {
				this.drawBeginStaveConnector();
			} else if(this.isLastBar()) {
				this.drawEndStaveConnector();
			}
		},
		drawBeginStaveConnector: function() {
			var SINGLE = Vex.Flow.StaveConnector.type.SINGLE;
			var BRACE = Vex.Flow.StaveConnector.type.BRACE;
			var bar1 = this.getStaveBar();
			var bar2 = this.connectedStave.getStaveBar();
			this.drawStaveConnector(bar1, bar2, SINGLE); 
			this.drawStaveConnector(bar1, bar2, BRACE); 
		},
		drawEndStaveConnector: function() {
			var SINGLE = Vex.Flow.StaveConnector.type.SINGLE;
			var ctx = this.getContext();
			var next_x = this.start_x + this.width;
			var width = 3; // width of stave connector
			var bar1 = new Vex.Flow.Stave(next_x, this.getYForClef('treble'), width);
			var bar2 = new Vex.Flow.Stave(next_x, this.getYForClef('bass'), width);

			bar1.setContext(ctx);
			bar2.setContext(ctx);

			this.drawStaveConnector(bar1, bar2, SINGLE);
		},
		drawStaveConnector: function(bar1, bar2, connectorType) {
			var ctx = this.getContext();
			var connector = new Vex.Flow.StaveConnector(bar1, bar2);
			connector.setContext(ctx).setType(connectorType).draw();
		},
		createStaveBar: function() {
			var x = this.start_x;
			var y = this.start_y; 
			var width = this.width;
			var staveBar = new Vex.Flow.Stave(x, y, width);
			staveBar.clef = this.clef;

			if(this.isFirstBar()) {
				staveBar.setBegBarType(Vex.Flow.Barline.type.SINGLE);
				staveBar.setEndBarType(Vex.Flow.Barline.type.NONE);
			} else if(this.isLastBar()) {
				staveBar.setBegBarType(Vex.Flow.Barline.type.NONE);
				staveBar.setEndBarType(Vex.Flow.Barline.type.SINGLE);
			} else {
				staveBar.setBegBarType(Vex.Flow.Barline.type.NONE);
				staveBar.setEndBarType(Vex.Flow.Barline.type.NONE);
			}

			staveBar.setContext(this.getContext());

			if(this.isFirstBar()) {
				staveBar.addClef(this.clef);
				staveBar.addKeySignature(this.keySignature.getVexKey());
			} 

			this.staveBar = staveBar;
		},
		createStaveVoice: function() {
			var voice, formatter;
			if(this.hasStaveNotes()) {
				voice = new Vex.Flow.Voice(Vex.Flow.TIME4_4);
				voice.addTickables(this.createStaveNotes());
			}
			this.staveVoice = voice;
		},
		formatStaveVoice: function() {
			var formatter, voice = this.staveVoice;
			if(voice) {
				formatter = new Vex.Flow.Formatter();
				formatter.joinVoices([voice]).formatToStave([voice], this.staveBar);
			}
		},
		drawStaveVoice: function() {
			if(this.staveVoice) {
				this.staveVoice.draw(this.getContext(), this.staveBar);
			}
		},
		drawStaveBar: function() {
			var ctx = this.getContext();
			this.staveBar.draw(ctx);
		},
		notate: function() {
			if(this.notater) {
				this.notater.notate();
			}
		},
		setMaxBars: function(n) {
			this.maxBars = n;
		},
		setStartX: function(x) {
			this.start_x = x;
			this.doConnected('setStartX', x);
		},
		setMaxWidth: function(w) {
			this.maxWidth = w;
			this.doConnected('setMaxWidth', w);
		},
		setWidth: function(w) {
			this.width = w;
			this.doConnected('setWidth', w);
		},
		setNoteFactory: function(noteFactory) {
			this.noteFactory = noteFactory;
		},
		setNotater: function(notater) {
			this.notater = notater;
		},
		connect: function(stave) {
			this.connectedStave = stave;
		},
		isConnected: function() {
			return this.connectedStave ? true : false;
		},
		doConnected: function(method) {
			var args = Array.prototype.slice.call(arguments, 1);
			if(this.isConnected()) {
				this.connectedStave[method].apply(this.connectedStave, args);
			}
		},
		getConnected: function() {
			return this.connectedStave;
		},
		getWidth: function() {
			return this.width;
		},
		getHeight: function() {
			return this.height;
		},
		getStaveBar: function() {
			return this.staveBar;
		},
		getStartX: function() {
			return this.start_x;
		},
		getClef: function() {
			return this.clef;
		},
		getTopY: function() {
			return this.staveBar.getYForTopText();
		},
		getBottomY: function() {
			return this.staveBar.getBottomY();
		},
		getContext: function() {
			return this.vexRenderer.getContext();
		},
		createStaveNotes: function() {
			return this.noteFactory.createStaveNotes();
		},
		hasStaveNotes: function() {
			if(this.noteFactory) {
				return this.noteFactory.hasStaveNotes();
			}
			return false;
		},
		setKeySignature: function(keySignature) {
			this.keySignature = keySignature;
		},
		setRenderer: function(renderer) {
			this.vexRenderer = renderer;
		},
		updatePosition: function() {
			var start_x, width;

			if(this.isFirstBar()) {
				this.start_x = this.margin.left;
				this.width = this.firstBarWidth;
			} else {
				start_x = (this.margin.left + this.firstBarWidth);
				width = Math.floor((this.maxWidth - start_x) / this.position.maxCount);
				start_x += ((this.position.index - 1) * width);

				this.start_x = start_x;

				if(this.isLastBar()) {
					// stretch to fill remaining area
					this.width = this.maxWidth - this.start_x - this.margin.right;
				} else {
					this.width = width;
				}
			}

			this.start_y = this.getYForClef(this.clef);
		},
		getYForClef: function(clef) {
			var y = 64;
			y += (clef === 'treble' ? 0 : 75);
			return y;
		},
		isFirstBar: function() {
			return this.position.index === 0;
		},
		isLastBar: function() {
			return this.position.index === this.position.count;
		}
	});

	return Stave;
});
