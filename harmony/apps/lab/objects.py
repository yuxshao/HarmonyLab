from django.conf import settings
from django.core.urlresolvers import reverse
import os
import os.path
import string
import json
import re
import pprint
pp = pprint.PrettyPrinter(indent=4)

class ExerciseFileError(Exception):
    pass

class ExerciseRepository(object):
    def __init__(self, *args, **kwargs):
        self.course_name = kwargs.get('course_name', None)
        self.groups = []
        self.exercises = []

    def getGroupList(self):
        raise Exception("subclass responsibility")

    def findGroup(self, group):
        raise Exception("subclass responsibility")

    def findExercise(self, exercise):
        raise Exception("subclass responsibility")

    def findExerciseByGroup(self, group, exercise):
        raise Exception("subclass responsibility")

    def reset(self):
        self.exercises = []
        self.groups = []

    def asDict(self):
        return {
            "course_name": self.course_name,
            "data": {
                "exercises": [e.asDict() for e in self.exercises],
                "groups": [g.asDict() for g in self.groups]
            }
        }

    def asJSON(self):
        return json.dumps(self.asDict())
        
    def __str__(self):
        return ', '.join([str(e) for e in self.exercises])

    def __repr__(self):
        return self.__str__()

class ExerciseFileRepository(ExerciseRepository):
    BASE_PATH = os.path.join(settings.ROOT_DIR, 'data', 'exercises', 'json')

    def __init__(self, *args, **kwargs):
        super(ExerciseFileRepository, self).__init__(*args, **kwargs)
        self.findFiles()

    @staticmethod
    def getBasePath(course_name):
        if course_name is None:
            return ExerciseFileRepository.BASE_PATH
        return os.path.join(ExerciseFileRepository.BASE_PATH, "course", course_name)

    def getGroupList(self):
        '''Returns a list of group names.'''
        path_to_exercises = ExerciseFileRepository.getBasePath(self.course_name)
        groups = []
        for root, dirs, files in os.walk(path_to_exercises):
            group_name = string.replace(root, path_to_exercises, '')
            groups.append(ExerciseGroup(group_name, course_name=self.course_name))
        return sorted([{
            "name": g.name,
            "url": g.url()} for g in groups if len(g.name) > 0
        ], key=lambda g:g['name'].lower())

    def findGroup(self, group_name):
        '''Returns a single group (group names should be distinct).'''
        for g in self.groups:
            if group_name == g.name:
                return g
        return None

    def findExercise(self, exercise_name):
        '''Returns an array of exercise matches (exercise names are not distinct).'''
        result = []
        for e in self.exercises:
            if exercise_name == e.name:
                result.append(e)
        return result

    def findExerciseByGroup(self, group_name, exercise_name):
        '''Returns a single exercise (group+exercise is unique).'''
        group = self.findGroup(group_name)
        if group is not None:
            return group.findExercise(exercise_name)
        return None

    def findFiles(self):
        self.reset()

        path_to_exercises = ExerciseFileRepository.getBasePath(self.course_name)

        for root, dirs, files in os.walk(path_to_exercises):
            group_name = string.replace(root, path_to_exercises, '')
            exercise_group = ExerciseGroup(group_name, course_name=self.course_name)
            exercises = []  

            sorted_files = sorted(files, key=lambda e: e.lower())
            for file_name in sorted_files:
                if file_name.endswith('.json'):
                    exercise_file = ExerciseFile(file_name, exercise_group, root)
                    exercises.append(exercise_file)

            if len(exercises) > 0:
                exercise_group.add(exercises)
                self.groups.append(exercise_group)
                self.exercises.extend(exercises)

class Exercise:
    def __init__(self, data, meta=None):
        self.data = {}
        self.meta = {}
        self.errors = []
        self.is_valid = True

        self.data.update(data)
        if meta is not None:
            self.meta.update(meta)
        
        self.processData()
        
    def processData(self):
        if not "type" in self.data:
            self.data['type'] = "matching"

        if "lilypond_chords" in self.data:
            self.lilypond = ExerciseLilyPond(self.data['lilypond_chords'])

        if self.lilypond.isValid():
            self.data['chord'] = self.lilypond.toMIDI()
        else:
            self.is_valid = False
            self.errors.extend(list(self.lilypond.errors))
        return self

    def isValid(self):
        return self.is_valid

    def getData(self):
        return self.data

    def asJSON(self):
        return json.dumps(self.getData(), sort_keys=True, indent=4, separators=(',', ': '))

    @classmethod
    def fromJSON(cls, data):
        return cls(json.loads(data))
   

class ExerciseLilyPond:
    def __init__(self, lilypondString, *args, **kwargs):
        self.lpstring = lilypondString
        self.errors = []
        self.is_valid = True
        self.midi = self.parse()

    def parseChords(self, lpstring):
        chords = re.findall('<([^>]+)>', lpstring.strip())
        # re.findall('<([^>]+)>', "<e c' g' bf'>1\n<f \xNote c' \xNote f' a'>1")
        # print chords
        return chords
    
    def parseChord(self, chordstring, start_octave=4):
        # constants for parsing
        note_tuples = [('c',0),('d',2),('e',4),('f',5),('g',7),('a',9),('b',11)]
        notes = [n[0] for n in note_tuples]
        note_pitch = dict(note_tuples)
        up, down = ("'", ",")
        sharp, flat = ("s", "f")
        hidden_note_symbol = r"x"

        # normalize the chord string 
        chordstring = re.sub(r'\\xNote\s*', hidden_note_symbol, chordstring) # replace '\xNote' with just 'x'
        chordstring = chordstring.lower() # normalize to lower case

        # mutable variables used during parsing
        saved_octaves = [start_octave]
        midi_chord = {"visible": [], "hidden": []}
        previous_note = None
        
        # parse each pitch entry in the chord and translate to MIDI
        pitch_entries = re.split('\s+', chordstring)
        for idx, pitch_entry in enumerate(pitch_entries):
            tokens = list(pitch_entry) # convert entry to sequence of characters

            # check if this is a "hidden" note
            midi_entry = midi_chord['visible']
            if tokens[0] == hidden_note_symbol:
                midi_entry = midi_chord['hidden']
                tokens = tokens[1:]

            # check if the first character is a valid note name,
            # otherwise record an error and skip the rest of the parsing
            if len(tokens) == 0 or not (tokens[0] in notes):
                self.is_valid = False
                self.errors.append("Pitch [%s] in chord [%s] is invalid: missing or invalid note name" % (pitch_entry, chordstring))
                break
            
            note_name = tokens[0]
            tokens = tokens[1:]
            
            # check that all subsequent characters are either octave changing marks, or accidentals
            check_rest = re.sub('|'.join([up,down,sharp,flat,'\d']), '', ''.join(tokens))
            if len(check_rest) > 0:
                self.is_valid = False
                self.errors.append("Pitch entry [%s] in chord [%s] contains unrecognized symbols: %s" % (pitch_entry, chordstring, check_rest))
                break

            # calculate the octave so the note is within an interval of a fifth
            # before any octave changing mark (relative or absolute)
            # this is per-lilypond's documentation:
            # http://www.lilypond.org/doc/v2.18/Documentation/notation/writing-pitches
            octave_change = 0
            distance = None
            if previous_note is not None:
                distance = notes.index(previous_note) - notes.index(note_name)
                if distance < 0:
                    distance -= 1
                else:
                    distance += 1
                if abs(distance) > 5:
                    if distance < 0:
                        octave_change -= 1
                    else:
                        octave_change += 1

            # now look for octave changing marks
            # remember: changing one note's octave will effect all subsequent notes
            octaves = re.findall('('+up+'|'+down+'|\d)', ''.join(tokens))
            if octaves is not None:
                for o in octaves:
                    if o == up:
                        octave_change += 1
                    elif o == down:
                        octave_change -= 1
                    else:
                        octave = int(o)
                        octave_change = 0
                        break
            
            # now look for change in the pitch by accidentals
            pitch_change = 0  
            accidentals = re.findall('('+sharp+'|'+flat+')', ''.join(tokens))
            if accidentals is not None:
                for acc in accidentals:
                    if acc == sharp:
                        pitch_change += 1
                    elif acc == flat:
                        pitch_change -= 1

            # now calculate the midi note number and add to the midi entry
            octave = saved_octaves[0] + octave_change
            saved_octaves.append(octave)
            midi_pitch = (octave * 12) + note_pitch[note_name] + pitch_change
            midi_entry.append(midi_pitch)
            debug_data = {
                "chordstring": chordstring,
                "pitchentry": pitch_entry,
                "octave": octave,
                "octave_change": octave_change,
                "octaves": octaves,
                "saved_octaves": saved_octaves,
                "accidentals": accidentals,
                "pitch_change": pitch_change,
                "midi_pitch": midi_pitch,
                "midi_entry": midi_entry,
                "previous_note": previous_note,
                "distance": distance,
            }
            #pp.pprint(debug_data)
            previous_note = note_name
        
        if len(saved_octaves) == 1:
            return (midi_chord, saved_octaves[0])
        return (midi_chord, saved_octaves[1])

    def parse(self):
        octave = 4
        midi_chords = []
        for chordstring in self.parseChords(self.lpstring):
            midi_chord, octave = self.parseChord(chordstring, octave)
            midi_chords.append(midi_chord)
        return midi_chords
  
    def isValid(self):
        return self.is_valid
    
    def toMIDI(self):
        return self.midi


class ExerciseFile:
    def __init__(self, file_name, group, group_path):
        self.file_name = file_name
        self.group_path = group_path
        self.name = file_name.replace('.json', '')
        self.group = group
        self.exercise = None
        self.selected = False
        
    def getPathToFile(self, ):
        return os.path.join(self.group_path, self.file_name)
    
    def load(self):
        try:
            with open(self.getPathToFile()) as f:
                data = f.read().strip()
                self.exercise = Exercise.fromJSON(data) 
        except IOError as e:
            raise ExerciseFileError("Error loading exercise file: {0} => {1}".format(e.errno, e.strerror))
        return True

    def save(self):
        if self.exercise is None:
            raise ExerciseFileError("No exercise attached to file.")

        if not self.exercise.isValid():
            return False

        try:
            if not os.path.exists(self.group_path):
                os.makedirs(self.group_path)
            with open(self.getPathToFile(), 'w') as f:
                f.write(self.exercise.asJSON())
        except IOError as e:
            raise ExerciseFileError("Error loading exercise file: {0} => {1}".format(e.errno, e.strerror))

        return True

    def next(self):
        return self.group.next(self)

    def nextUrl(self):
        if self.next():
            return self.next().url()
        return None

    def previousUrl(self):
        if self.previous():
            return self.previous().url()
        return None

    def previous(self):
        return self.group.previous(self)

    def url(self):
        return reverse('lab:exercise', kwargs={
            "course_name": self.group.course_name,
            "group_name": self.group.name, 
            "exercise_name": self.name
        })

    def asJSON(self):
        return json.dumps(self.asDict())

    def asDict(self):
        d = {}
        if self.exercise is not None:
            d.update(self.exercise.getData())
        d.update({
            "id": os.path.join(self.group.name, self.name),
            "name": self.name, 
            "url": self.url(),
            "group_name": self.group.name,
            "selected": self.selected,
        })
        return d

    def __str__(self):
        return self.group.name + '::' + self.name

    def __repr__(self):
        return self.__str__()

    @staticmethod
    def getNextFileName(group_path, group_size):
        max_tries = 99
        n = group_size + 1
        file_name = "%s.json" % str(n).zfill(2)

        while os.path.exists(os.path.join(group_path, file_name)):
            n += 1
            if n > max_tries:
                raise Exception("unable to get next exercise file name after %d tries" % max_tries)
            file_name = "%s.json" % str(n).zfill(2)

        return file_name
    
    @staticmethod
    def create(data, **kwargs):
        group_name = data['group_name']
        course_name = kwargs.get("course_name", None)
        exercise = kwargs.get("exercise", None)
        file_name = kwargs.get('file_name', None)
        
        er = ExerciseFileRepository(course_name=course_name)
        group = er.findGroup(group_name)
        if group is None:
            group = ExerciseGroup(group_name, course_name=course_name)

        group_size = group.size()
        group_path = os.path.join(ExerciseFileRepository.getBasePath(course_name), group_name)

        if file_name is None:
            file_name = ExerciseFile.getNextFileName(group_path, group_size)
        
        ef = ExerciseFile(file_name, group, group_path)
        ef.exercise = exercise
        print course_name, file_name, group_path, ef.getPathToFile()
        ef.save()

        return ef

class ExerciseGroup:
    def __init__(self, group_name, *args, **kwargs):
        self.name = group_name
        self.course_name = kwargs.get("course_name", None)
        if self.name.startswith('/'):
            self.name = self.name[1:]
        self.exercises = []
        
    def size(self):
        return len(self.exercises)    

    def add(self, exercises):
        self.exercises.extend(exercises)
        return self

    def url(self):
        return reverse('lab:exercise-group', kwargs={"group_name": self.name, "course_name": self.course_name})

    def first(self):
        if len(self.exercises) > 0:
            return self.exercises[0]
        return None

    def last(self):
        if len(self.exercises) > 0:
            return self.exercises[-1]
        return None

    def next(self, exercise):
        if exercise in self.exercises:
            index = self.exercises.index(exercise)
            if index < len(self.exercises) - 1:
                return self.exercises[index + 1]
        return None

    def previous(self, exercise):
        if exercise in self.exercises:
            index = self.exercises.index(exercise)
            if index > 0:
                return self.exercises[index - 1]
        return None

    def findExercise(self, exercise_name):
        for e in self.exercises:
            if exercise_name == e.name:
                return e
        return None

    def getList(self):
        exercise_list = []
        for e in self.exercises:
            d = e.asDict()
            exercise_list.append({
                "id": d['id'],
                "name": d['name'], 
                "url": d['url'],
                "selected": d['selected']
            })
        return exercise_list

    def asJSON(self):
        return json.dumps(self.asDict())

    def asDict(self):
        return {
            "name": self.name,
            "url": self.url(),
            "data": {
                "exercises": [e.asDict() for e in self.exercises]
            }
        }

    def __str__(self):
        return '[' + ', '.join([str(e) for e in self.exercises]) + ']'

    def __repr__(self):
        return self.__str__()
