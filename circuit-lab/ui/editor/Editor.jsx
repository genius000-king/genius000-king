import {history, defaultKeymap, historyKeymap, indentWithTab} from '@codemirror/commands';
import {cpp} from '@codemirror/lang-cpp';
import {indentOnInput, bracketMatching, syntaxHighlighting, HighlightStyle} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import {lintGutter, setDiagnostics} from '@codemirror/lint';
import {search, highlightSelectionMatches, searchKeymap} from '@codemirror/search';
import {EditorState, StateEffect, StateField, RangeSet} from '@codemirror/state';
import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  keymap,
  gutter,
  GutterMarker,
  Decoration,
} from '@codemirror/view';
import {useRef, useEffect} from 'react';

// Tokens get classes (tok-*); ui/styles.css colours them per theme so both stay readable.
const codeColours = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.controlKeyword, tags.modifier, tags.operatorKeyword, tags.definitionKeyword],
    class: 'tok-keyword',
  },
  {tag: [tags.typeName, tags.standard(tags.typeName)], class: 'tok-type'},
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.definition(tags.variableName)),
      tags.function(tags.propertyName),
    ],
    class: 'tok-function',
  },
  {tag: [tags.number, tags.bool, tags.atom, tags.null], class: 'tok-number'},
  {tag: [tags.string, tags.character, tags.special(tags.string)], class: 'tok-string'},
  {tag: [tags.comment, tags.lineComment, tags.blockComment], class: 'tok-comment'},
  {tag: [tags.processingInstruction, tags.meta, tags.special(tags.name)], class: 'tok-macro'},
  {tag: tags.invalid, class: 'tok-invalid'},
]);

// Debugger marks: breakpoint dots in their own gutter, and the line where the debugger halted.
const setMarks = StateEffect.define();
const marks = StateField.define({
  create: () => ({breakpoints: [], paused: null}),
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setMarks)) value = e.value;
    return value;
  },
});
class Mark extends GutterMarker {
  constructor(breakpoint, paused) {
    super();
    this.breakpoint = breakpoint;
    this.paused = paused;
  }
  eq(other) {
    return other.breakpoint === this.breakpoint && other.paused === this.paused;
  }
  toDOM() {
    const el = document.createElement('span');
    el.className = `cm-bp${this.breakpoint ? ' on' : ''}${this.paused ? ' here' : ''}`;
    return el;
  }
}
const spacer = new Mark(false, false);
const debugMarks = toggle => [
  marks,
  gutter({
    class: 'cm-bp-gutter',
    markers: view => {
      const {breakpoints, paused} = view.state.field(marks),
        doc = view.state.doc,
        lines = new Set([...breakpoints, ...(paused ? [paused] : [])]);
      return RangeSet.of(
        [...lines]
          .filter(n => n >= 1 && n <= doc.lines)
          .sort((a, b) => a - b)
          .map(n => new Mark(breakpoints.includes(n), n === paused).range(doc.line(n).from))
      );
    },
    initialSpacer: () => spacer,
    domEventHandlers: {
      mousedown(view, block) {
        toggle.current?.(view.state.doc.lineAt(block.from).number);
        return true;
      },
    },
  }),
  EditorView.decorations.compute([marks], state => {
    const {paused} = state.field(marks);
    if (!paused || paused > state.doc.lines) return Decoration.none;
    return Decoration.set([Decoration.line({class: 'cm-paused-line'}).range(state.doc.line(paused).from)]);
  }),
];

export default function Editor({
  value,
  onChange,
  error,
  file,
  breakpoints = [],
  pausedLine = null,
  onToggleBreakpoint,
}) {
  const root = useRef(null),
    view = useRef(null),
    change = useRef(onChange),
    toggle = useRef(onToggleBreakpoint);
  change.current = onChange;
  toggle.current = onToggleBreakpoint;
  useEffect(() => {
    const theme = EditorView.theme({
      '&': {height: '100%', background: 'transparent', fontSize: '12px'},
      '.cm-scroller': {
        fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
        lineHeight: '1.85',
      },
      '.cm-content': {padding: '18px 0 80px'},
      '.cm-line': {padding: '0 16px 0 6px'},
      '.cm-gutters': {background: 'transparent', border: 'none', color: '#a4aea1', paddingRight: '8px'},
      '.cm-activeLineGutter': {background: '#dce7d244'},
      '.cm-activeLine': {background: '#e4eadf66'},
      '.cm-cursor': {borderLeftColor: '#4c693d'},
      '.cm-selectionBackground': {background: '#d5e0cd !important'},
      '.cm-focused': {outline: 'none'},
      '.cm-panels': {background: '#edf1e9', borderColor: '#dfe4da'},
      '.cm-searchMatch': {background: '#e4dba0'},
    });
    view.current = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          debugMarks(toggle),
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          syntaxHighlighting(codeColours),
          cpp(),
          search({top: true}),
          highlightSelectionMatches(),
          lintGutter(),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
          theme,
          EditorView.updateListener.of(v => {
            if (v.docChanged) change.current(v.state.doc.toString());
          }),
        ],
      }),
      parent: root.current,
    });
    return () => view.current?.destroy();
  }, [file]);
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value)
      v.dispatch({changes: {from: 0, to: v.state.doc.length, insert: value}});
  }, [value]);
  useEffect(() => {
    const v = view.current;
    if (v) {
      let ds = [];
      if (error) {
        const line = v.state.doc.line(Math.max(1, Math.min(v.state.doc.lines, error.line ?? 1)));
        ds = [{from: line.from, to: line.to, severity: 'error', message: error.message}];
      }
      v.dispatch(setDiagnostics(v.state, ds));
    }
  }, [error]);
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const effects = [setMarks.of({breakpoints, paused: pausedLine})];
    if (pausedLine && pausedLine <= v.state.doc.lines)
      effects.push(EditorView.scrollIntoView(v.state.doc.line(pausedLine).from, {y: 'center'}));
    v.dispatch({effects});
  }, [breakpoints, pausedLine, file]);
  return <div className="code-mirror" ref={root} />;
}
