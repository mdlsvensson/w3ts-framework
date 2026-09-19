// Custom Deno lint plugin for Warcraft III TypeScript projects.
// Note: Deno requires plugin names to match /^[a-z-]+$/ (lowercase letters and hyphens only).

interface AstNode {
  type: string;
  callee?: {
    type: string;
    name?: string;
  };
  arguments?: Array<{
    type: string;
    value?: unknown;
  }>;
}

interface LintContext {
  report(descriptor: {
    node: unknown;
    message: string;
    hint?: string;
  }): void;
}

export const plugin = {
  name: "wcraft-rules",
  rules: {
    "valid-fourcc": {
      create(context: LintContext) {
        return {
          CallExpression(node: AstNode) {
            if (
              node.callee?.type === "Identifier" &&
              node.callee.name === "FourCC" &&
              node.arguments &&
              node.arguments.length > 0
            ) {
              const arg = node.arguments[0];
              if (arg.type === "Literal" && typeof arg.value === "string") {
                const val = arg.value;
                if (val.length !== 4) {
                  context.report({
                    node: arg,
                    message: `FourCC string literal must be exactly 4 characters, received ${val.length} ("${val}")`,
                    hint: "Warcraft III object rawcodes (e.g. 'hfoo', 'A000') must always have a length of 4.",
                  });
                } else if (!/^[\x20-\x7E]{4}$/.test(val)) {
                  context.report({
                    node: arg,
                    message: `FourCC string literal must contain printable ASCII characters only ("${val}")`,
                    hint: "Warcraft III object rawcodes must consist of printable ASCII characters.",
                  });
                }
              }
            }
          },
        };
      },
    },
  },
};

export default plugin;
