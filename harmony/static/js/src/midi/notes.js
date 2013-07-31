define(['lodash', 'microevent'], function(_, MicroEvent) {

	// This object is responsible for tracking the MIDI notes that are "on" or
	// currently active.  It also must know how to partition notes by clef and
	// convert MIDI note numbers to their associated pitch classes and octaves.
	//
	// This object is observable and fires "note:change" events when a note is
	// turned on or off.
	
	var MidiNotes = function() {
		this._notes = {};
	};

	_.extend(MidiNotes.prototype, {
		// Command to turn on a note. Fires a change event if the note status has changed.
		noteOn: function(number) {
			var changed = (this._notes[number] !== true); 
			this._notes[number] = true;
			if(changed) {
				this.trigger('note:change', 'on', number);
			}
			return changed;
		},
		// Command to turn off a note. Fires a change event if the note status has changed.
		noteOff: function(number) {
			var changed = (this._notes[number] === true);
			delete this._notes[number];
			if(changed) {
				this.trigger('note:change', 'off', number);
			}
			return changed;
		},
		// Returns true if the note is on, false otherwise
		isNoteOn: function(number) {
			return this._notes[number] ? true : false;
		},
		// Returns a list of notes for the given clef.
		getNotes: function(clef) {
			return this.getNoteNumbers(clef);
		},
		// Returns a list that is the result of executing a callback on each
		// note. If no clef is specified, all notes are mapped, otherwise
		// notes are filtered by clef.
		mapNotes: function(callback, clef) {
			var notes = [], _notes = this._notes;
			var note_num, wanted = true;
			for(note_num in _notes) {
				if(_notes.hasOwnProperty(note_num)) {
					if(clef) {
						wanted = this.noteNumBelongsToClef(note_num, clef);
					}
					if(wanted) {
						notes.push(callback.call(this, note_num));
					}
				}
			}
			return notes;
		},
		// Returns true if the clef has any notes, or if no clef is specified,
		// if any notes exist on any clefs.
		hasNotes: function(clef) {
			var note_num, _notes = this._notes;
			for(note_num in _notes) {
				if(_notes.hasOwnProperty(note_num)) {
					if(clef) {
						if(this.noteNumBelongsToClef(note_num, clef)) {
							return true;
						}
					} else {
						return true;
					}
				}
			}
			return false;
		},
		// Returns all note numbers on the given clef.
		getNoteNumbers: function(clef) {
			return this.mapNotes(function(noteNum) {
				return noteNum;
			}, clef);
		},
		// Returns all note pitches and octaves on the given clef.
		getNotePitches: function(clef) {
			return this.mapNotes(function(noteNum) {
				return {
					pitchClass: (noteNum % 12),
					octave: (Math.floor(noteNum / 12) -1)
				};
			}, clef);
		},
		// Returns true if the note belongs to the clef, false otherwise.
		noteNumBelongsToClef: function(noteNum, clef) {
			switch(clef) {
				case 'treble':
					if(noteNum >= 60) {
						return true;
					}
					break;
				case 'bass':
					if(noteNum < 60) {
						return true;
					}
					break;
				default:
					throw new Error("invalid clef");
			}
			return false;
		}
	});

	MicroEvent.mixin(MidiNotes); // make object observable

	return MidiNotes;
});
