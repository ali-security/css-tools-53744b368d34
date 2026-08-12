import CssParseError from '../src/CssParseError';
import {parse} from '../src/index';
import {CssMediaAST, CssRuleAST} from '../src/type';

describe('parse(str)', () => {
  it('should save the filename and source', () => {
    const css = 'booty {\n  size: large;\n}\n';
    const ast = parse(css, {
      source: 'booty.css',
    });

    expect(ast.stylesheet.source).toBe('booty.css');

    const position = ast.stylesheet.rules[0].position;
    expect(position?.start).toBeDefined();
    expect(position?.end).toBeDefined();
    expect(position?.source).toBe('booty.css');
    // expect(position.content).toBe(css);
  });

  it('should throw when a selector is missing', () => {
    expect(() => {
      parse('{size: large}');
    }).toThrow();

    expect(() => {
      parse('b { color: red; }\n{ color: green; }\na { color: blue; }');
    }).toThrow();
  });

  it('should throw when a broken comment is found', () => {
    expect(() => {
      parse('thing { color: red; } /* b { color: blue; }');
    }).toThrow();

    expect(() => {
      parse('/*');
    }).toThrow();

    /* Nested comments should be fine */
    expect(() => {
      parse('/* /* */');
    }).not.toThrow();
  });

  it('should allow empty property value', () => {
    expect(() => {
      parse('p { color:; }');
    }).not.toThrow();
  });

  it('should not throw with silent option', () => {
    expect(() => {
      parse('thing { color: red; } /* b { color: blue; }', {silent: true});
    }).not.toThrow();
  });

  it('should list the parsing errors and continue parsing', () => {
    const result = parse(
      'foo { color= red; } bar { color: blue; } baz {}} boo { display: none}',
      {
        silent: true,
        source: 'foo.css',
      }
    );

    const rules = result.stylesheet.rules;
    expect(rules.length).toBeGreaterThan(2);

    const errors = result.stylesheet.parsingErrors;
    expect(errors).toBeDefined();
    expect(errors?.length).toBe(2);

    const firstError = (errors as unknown as Array<CssParseError>)[0];

    expect(firstError).toHaveProperty('message');
    expect(firstError).toHaveProperty('reason');
    expect(firstError).toHaveProperty('filename');
    expect(firstError.filename).toBe('foo.css');
    expect(firstError).toHaveProperty('line');
    expect(firstError).toHaveProperty('column');
    expect(firstError).toHaveProperty('source');
  });

  it('should set parent property', () => {
    const result = parse(
      'thing { test: value; }\n' +
        '@media (min-width: 100px) { thing { test: value; } }'
    );

    // expect(result).not.toHaveProperty('parent');

    const rules = result.stylesheet.rules;
    expect(rules.length).toBe(2);

    let rule = rules[0] as CssRuleAST;
    expect(rule.parent).toBe(result);
    expect(rule.declarations.length).toBe(1);

    let decl = rule.declarations[0];
    expect(decl.parent).toBe(rule);

    const media = rules[1] as CssMediaAST;
    expect(media.parent).toBe(result);
    expect(media.rules.length).toBe(1);

    rule = media.rules[0] as CssRuleAST;
    expect(rule.parent).toBe(media);

    expect(rule.declarations.length).toBe(1);
    decl = rule.declarations[0];
    expect(decl.parent).toBe(rule);
  });

  it('should keep the , of a nested functional pseudo-class', () => {
    const css = '.klass:is(:nth-child(1), :nth-child(2)) {margin: 0}';
    const result = parse(css);

    const rule = result.stylesheet.rules[0] as CssRuleAST;
    expect(rule.selectors.length).toBe(1);
    expect(rule.selectors[0]).toBe('.klass:is(:nth-child(1), :nth-child(2))');
  });

  it('should not hang on a selector with unclosed parentheses', () => {
    // The '\(.*?\)' alternative rescanned the rest of the selector from every
    // '(' it found, which is quadratic when the parenthesis is never closed.
    const unclosed = ':is('.repeat(200000);
    const start = Date.now();

    const result = parse('.a,' + unclosed + '{color: red}', {silent: true});

    expect(Date.now() - start).toBeLessThan(2000);
    expect(result.stylesheet.rules.length).toBe(1);
  });

  it('should not hang on an unterminated @custom-media rule', () => {
    // '\s*([^{;]+)' let both parts match the trailing whitespace, so a rule
    // missing its ';' backtracked quadratically.
    const css = '@custom-media --narrow-window' + ' '.repeat(200000);
    const start = Date.now();

    parse(css, {silent: true});

    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('should not overflow the stack on unbalanced parentheses', () => {
    const unbalanced = '.a,:is(:is(:is(.b) {color: red}';

    expect(() => parse(unbalanced, {silent: true})).not.toThrow();
  });

  it('should not overflow the stack on deeply nested parentheses', () => {
    const nested = ':is('.repeat(20000) + ')'.repeat(20000);
    const start = Date.now();

    expect(() => {
      parse('.a,' + nested + '{color: red}', {silent: true});
    }).not.toThrow();

    expect(Date.now() - start).toBeLessThan(2000);
  });
});
