import {parse, stringify} from '../src/index';
import {CssImportAST, CssTypes} from '../src/type';

describe('non-block at-rule prelude', () => {
  const atRules = ['import', 'charset', 'namespace'];
  const BUDGET_MS = 2000;
  const backtrackBait = (name: string, colons = 50) =>
    `@${name} ${':'.repeat(colons)}"`;

  const timed = (fn: () => void) => {
    const start = Date.now();
    fn();
    return Date.now() - start;
  };

  it.each(atRules)(
    'does not backtrack on @%s with an unterminated quote',
    name => {
      const ms = timed(() => {
        expect(() => parse(backtrackBait(name))).toThrow("missing '{'");
      });

      expect(ms).toBeLessThan(BUDGET_MS);
    }
  );

  it.each(atRules)(
    'does not backtrack on @%s when the prelude is embedded in a stylesheet',
    name => {
      const css = `.a{color:red}\n${backtrackBait(name)}\n.b{color:blue}`;

      const ms = timed(() => {
        expect(parse(css).stylesheet.rules.length).toBe(2);
      });

      expect(ms).toBeLessThan(BUDGET_MS);
    }
  );

  it.each(atRules)('stays roughly linear in prelude length for @%s', name => {
    const small = timed(() => {
      expect(() => parse(backtrackBait(name, 40))).toThrow();
    });
    const large = timed(() => {
      expect(() => parse(backtrackBait(name, 60))).toThrow();
    });

    expect(large).toBeLessThan(BUDGET_MS);
    expect(small).toBeLessThan(BUDGET_MS);
  });

  describe('still parses the preludes it used to', () => {
    it('keeps a colon directly after the at-rule name', () => {
      const ast = parse('@import:aaa;');
      const rule = ast.stylesheet.rules[0] as CssImportAST;

      expect(rule.type).toBe(CssTypes.import);
      expect(rule.import).toBe(':aaa');
    });

    it('keeps a run of colons in the prelude', () => {
      const ast = parse('@import::::;');
      const rule = ast.stylesheet.rules[0] as CssImportAST;

      expect(rule.import).toBe('::::');
    });

    it('keeps quoted urls, including ones holding a semicolon', () => {
      const ast = parse('@import "foo;bar.css";');
      const rule = ast.stylesheet.rules[0] as CssImportAST;

      expect(rule.import).toBe('"foo;bar.css"');
    });

    it('keeps single-quoted preludes with escaped quotes', () => {
      const ast = parse("@import 'a\\'b.css';");
      const rule = ast.stylesheet.rules[0] as CssImportAST;

      expect(rule.import).toBe("'a\\'b.css'");
    });

    it('keeps media queries after the url', () => {
      const ast = parse('@import url("a.css") screen and (min-width:100px);');
      const rule = ast.stylesheet.rules[0] as CssImportAST;

      expect(rule.import).toBe('url("a.css") screen and (min-width:100px)');
    });

    it('keeps an unterminated prelude that runs to end of input', () => {
      const ast = parse('@import "a.css"');
      const rule = ast.stylesheet.rules[0] as CssImportAST;

      expect(rule.import).toBe('"a.css"');
    });

    it('round-trips through stringify', () => {
      const css = '@import url("a.css") screen;';

      expect(stringify(parse(css))).toBe(css);
    });
  });
});
