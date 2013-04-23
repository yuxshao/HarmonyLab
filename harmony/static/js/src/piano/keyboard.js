// NOTE: this module also requires "raphael.js" (loaded synchronously - AMD issues)
define([
	'jquery', 
	'lodash', 
	'microevent',
	'jazzmidibridge',
	'./keygenerator', 
	'./key'
], function($, _, MicroEvent, JMB, PianoKeyGenerator, PianoKey) {

	/**
	 * Piano Keyboard class.
	 *
	 * @constructor
	 * @this {PianoKeyboard}
	 * @param {integer} numberOfKeys The total number of keys on the keyboard.
	 * 
	 * Example:
	 *   var keyboard = new PianoKeyboard(88);
	 *   keyboard.render();
	 *    $('#piano').append(keyboard.el);
	 */
	var PianoKeyboard = function(numberOfKeys) {
		this.init(numberOfKeys);
	};

	_.extend(PianoKeyboard.prototype, {
		/**
		 * Size of the keyboard on screen.
		 *
		 * @property {integer} width
		 * @property {integer} height
		 */
		width: 800,
		height: 150,

		/**
		 * Defines the number of keys on the keyboard.
		 *
		 * @property {integer} numberOfKeys
		 */
		numberOfKeys: 49,

		/**
		 * Initializes the keyboard.
		 *
		 * @param {integer} numberOfKeys The total number of keys on the keyboard.
		 */
		init: function(numberOfKeys) {
			if(!_.isUndefined(numberOfKeys) && _.isNumber(parseInt(numberOfKeys,10))) {
				this.numberOfKeys = parseInt(numberOfKeys, 10);
			}

			this.el = $('<div class="keyboard"></div>');
			this.paper = Raphael(this.el.get(0), this.width, this.height);
			this.keys = this.getKeys();

			this.initEvents();
		},

		/**
		 * Initializes keyboard events.
		 */
		initEvents: function() {
			var that = this;
			JMB.init(function(MIDIAccess) {
				var output = MIDIAccess.getOutput(0);
				var onKeyPress = function(MIDIDevice, MIDICommand) {
					return function(key) {
						MIDIDevice.sendMIDIMessage(MIDIAccess.createMIDIMessage(MIDICommand, key.noteNumber(), 100));
					}
				};
				that.bind('key:press', onKeyPress(output, JMB.NOTE_ON)); 
				that.bind('key:release', onKeyPress(output, JMB.NOTE_OFF));
			});
		},

		/**
		 * Returns a sequence of piano keys for the current keyboard size.
		 *
		 * @return {array} of PianoKey objects.
		 */
		getKeys: function() {
			var notes = PianoKeyGenerator.generateNotes(this.numberOfKeys);
			var keyboard = this;
			return _.map(notes, function(noteConfig) {
				return PianoKey.create(keyboard, noteConfig);
			});
		},

		/**
		 * Returns the total number of white keys on the keyboard.
		 *
		 * @return {integer}
		 */
		getNumWhiteKeys: function() {
			return _.filter(this.keys, function(pianoKey) {
				return pianoKey.isWhite;
			}).length;
		},

		/**
		 * Renders the keyboard.
		 */
		render: function() { 
			this._render();
			return this;
		},

		// Helper function for rendering.
		_render: function() {
			var paper = this.paper;
			var width = this.width;
			var height = this.height;
			var keys = this.keys;
			var numWhiteKeys = this.getNumWhiteKeys();

			// render keyboard
			var keyboardEl = paper.rect(0, 0, width, height);
			keyboardEl.attr('stroke-width', 2);

			// render piano keys 
			var whiteKeyIndex = 0;
			_.each(this.keys, function(pianoKey, index) {
				pianoKey.render(paper, whiteKeyIndex, numWhiteKeys, width, height);
				if(pianoKey.isWhite) {
					whiteKeyIndex++;
				}
			});
		}
	});

	/**
	 * This adds "observable" behavior to the keyboard (i.e. bind/trigger events).
	 */
	MicroEvent.mixin(PianoKeyboard);

	return PianoKeyboard;
});