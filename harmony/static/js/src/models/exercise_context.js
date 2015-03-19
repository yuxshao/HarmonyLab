define([
	'lodash',
	'microevent',
	'./exercise_chord',
	'./exercise_chord_bank'
], function(
	_,
	MicroEvent,
	ExerciseChord,
	ExerciseChordBank
) {

	/**
	 * ExerciseContext object coordinates the display and grading of
	 * an exercise.
	 *
	 * @mixes MicroEvent
	 * @param settings {object}
	 * @param settings.definition ExerciseDefinition
	 * @param settings.grader ExerciseGrader
	 * @param settings.inputChords ChordBank
	 * @constructor
	 */
	var ExerciseContext = function(settings) {
		this.settings = settings || {};

		_.each(['definition','grader','inputChords'], function(attr) {
			if(!(attr in this.settings)) {
				throw new Error("missing settings."+attr+" constructor parameter");
			} 
		}, this);

		this.definition = this.settings.definition;
		this.grader = this.settings.grader;
		this.inputChords = this.settings.inputChords;

		this.state = ExerciseContext.STATE.READY;
		this.graded = false;
		this.displayChords = this.createDisplayChords();
		this.exerciseChords = this.createExerciseChords();

		_.bindAll(this, ['grade']);

		this.init();
	};

	/**
	 * Defines the possible states
	 * @type {object}
	 * @const
	 */
	ExerciseContext.STATE = {
		READY: "ready",
		WAITING: "waiting",
		INCORRECT: "incorrect",
		CORRECT: "correct" 
	};

	_.extend(ExerciseContext.prototype, {
		/**
		 * Make the STATE values accessible via instance.
		 */
		STATE: ExerciseContext.STATE,
		init: function() {
			this.initListeners();
		},
		/**
		 * Initializes listeners. 
		 *
		 * @return undefined
		 */
		initListeners: function() {
			this.inputChords.bind("change", this.grade);
		},
		/**
		 * Runs the grading process for the given exercise definition
		 * and input chords.
		 *
		 * @return undefined
		 * @fires graded
		 */
		grade: function() {
			var state, graded;

			graded = this.grader.grade(this.definition, this.inputChords);

			switch(graded.result) {
				case this.grader.STATE.CORRECT:
					state = ExerciseContext.STATE.CORRECT;
					this.done = true;
					this.triggerNextExercise();
					break;
				case this.grader.STATE.INCORRECT:
					state = ExerciseContext.STATE.INCORRECT;
					this.done = false;
					break;
				case this.grader.STATE.PARTIAL:
				default:
					state = ExerciseContext.STATE.WAITING;
					this.done = false;
			}

			this.graded = graded;
			this.state = state;

			this.updateDisplayChords();
			this.inputChords.goTo(graded.activeIndex);

			this.trigger("graded");
		},
		/**
		 * Returns chords for display on screen.
		 *
		 * @return {object}
		 */
		getDisplayChords: function() {
			return this.displayChords;
		},
		/**
		 * Returns chords for exercise analysis on screen.
		 *
		 * @return {object}
		 */
		getExerciseChords: function() {
			return this.exerciseChords;
		},
		/**
		 * Returns the chords being used for input to the exercise.
		 *
		 * @return {object}
		 */
		getInputChords: function() {
			return this.inputChords;
		},
		/**
		 * Returns the state of the exercise context.
		 *
		 * @return {string}
		 */
		getState: function() {
			return this.state;
		},
		/**
		 * Returns a graded object for the exercise, or false
		 * if the exercise hasn't been graded yet.
		 *
		 * @return {boolean|object}
		 */
		getGraded: function() {
			return this.graded;
		},
		/**
		 * Returns the exercise definition object.
		 *
		 * @return {object}
		 */
		getDefinition: function() {
			return this.definition;
		},
		/**
		 * Advances to the next exercise.
		 *
		 * @return undefined
		 */
		goToNextExercise: function() {
			var nextUrl = this.definition.getNextExercise();
			if(nextUrl) {
				window.location = nextUrl;
			}
		},
		/**
		 * Checks if the next exercise can be loaded.
		 *
		 * Returns true if any two "B" and "C" notes are played together on the
		 * keyboard.
		 *
		 * @param {object} chord a Chord object
		 * @return {boolean} true if "B" and "C" are played together, false otherwise.
		 */
		canGoToNextExercise: function(chord) {
			var is_exercise_done = (this.done === true);
			var trigger_notes = [83,84]; // the "B" and "C" above middle "C"
			var wanted_notes = {};
			var count_notes = 0;
			var can_trigger_next = false;
			var note_nums, i, len, note;

			if(is_exercise_done) {
				note_nums = chord.getSortedNotes();
				for(i = 0, len = note_nums.length; i < len; i++) {
					note_num = note_nums[i];
					if(_.contains(trigger_notes, note_num) && !(note_num in wanted_notes)) {
						wanted_notes[note_num] = true;
						++count_notes;
					}
					if(count_notes == trigger_notes.length) {
						can_trigger_next = true;
						break;
					}
				}
			}
			console.log("can go to next", can_trigger_next, note_nums);

			return can_trigger_next;
		},
		/**
		 * This will trigger the application to automatically advance
		 * to the next exercise in the sequence if the user
		 * has played a special combination of keys on the piano.
		 *
		 * This is intended as a shortcut for hitting the "next"
		 * button on the UI.
		 *
		 * @return undefined
		 */
		triggerNextExercise: function() {
			if(this.canGoToNextExercise(this.inputChords.current())) {
				this.goToNextExercise();
			}
		},
		/**
		 * Creates a new set of display chords.
		 * Called for its side effects.
		 *
		 * @return this
		 */
		updateDisplayChords: function() {
			this.displayChords = this.createDisplayChords();
			return this;
		},
		/**
		 * Helper function that creates the display chords.
		 *
		 * @return {object}
		 */
		createDisplayChords: function() {
			var notes = [];
			var exercise_chords = [];
			var problems = this.definition.getProblems();
			var CORRECT = this.grader.STATE.CORRECT;
			var g_problem, chord, chords; 

			for(var i = 0, len = problems.length; i < len; i++) {
				notes = problems[i].visible;
				g_problem = false;
				if(this.graded !== false && this.graded.problems[i]) {
					g_problem = this.graded.problems[i];
				}

				if(g_problem) {
					notes = notes.concat(g_problem.notes);
					notes = _.uniq(notes);
				}

				chord = new ExerciseChord({ notes: notes });

				if(g_problem) {
					_.each(g_problem.count, function(notes, correctness) {
						var is_correct = (correctness === CORRECT);
						if(notes.length > 0) {
							chord.grade(notes, is_correct);
						}
					}, this);
				}

				exercise_chords.push(chord);
			}

			chords = new ExerciseChordBank({chords: exercise_chords});

			return chords;
		},
		/**
		 * Helper function that creates the exercise chords.
		 *
		 * @return {object}
		 */
		createExerciseChords: function() {
			var problems = this.definition.getProblems();
			var notes = [];
			var exercise_chords = []; 
			var chords;

			for(var i = 0, len = problems.length; i < len; i++) {
				notes = problems[i].notes;
				chord = new ExerciseChord({ notes: notes });
				exercise_chords.push(chord);
			}

			chords = new ExerciseChordBank({chords: exercise_chords});

			return chords;
		}
	});

	MicroEvent.mixin(ExerciseContext);

	return ExerciseContext;
});
