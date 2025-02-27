export const options = [
  {
    name: 'help',
    alias: 'h',
    type: Boolean,
    description: 'Display this help message',
  },
  {
    name: 'watch',
    alias: 'w',
    type: Boolean,
    description: 'Rebuild when files change',
  },
  {
    name: 'load-biblio',
    type: String,
    lazyMultiple: true,
    typeLabel: '{underline path}',
    description:
      'An external biblio.json to load; either a path prefixed with "." or "./", or package name, of an installed eslint compatible formatter',
  },
  {
    name: 'write-biblio',
    type: String,
    typeLabel: '{underline file}',
    description: 'Path to where the biblio.json should be written',
  },
  {
    name: 'assets',
    type: String,
    typeLabel: 'none|inline|external', // TODO I don't think we actually distinguish between inline and external
    description: 'Link to css and js assets (default: inline, unless --multipage)',
    defaultValue: 'inline',
  },
  {
    name: 'css-out',
    type: String,
    typeLabel: '{underline file}',
    description: 'Path to a file where the CSS assets should be written',
  },
  {
    name: 'js-out',
    type: String,
    typeLabel: '{underline file}',
    description: 'Path to a file where the JS assets should be written',
  },
  {
    name: 'no-toc',
    type: Boolean,
    description: "Don't include the table of contents",
  },
  {
    name: 'old-toc',
    type: Boolean,
    description: 'Use the old table of contents styling',
  },
  {
    name: 'mark-effects',
    type: Boolean,
    description: 'Render markers for effects like "user code" [UC]',
  },
  {
    name: 'lint-spec',
    type: Boolean,
    description: 'Enforce some style and correctness checks',
  },
  {
    name: 'error-formatter',
    type: String,
    typeLabel: '{underline formatter}',
    defaultValue: 'eslint-formatter-codeframe',
    description:
      'The formatter for warnings and errors; either a path prefixed with "." or "./", or package name, of an installed eslint compatible formatter (default: eslint-formatter-codeframe)',
  },
  {
    name: 'multipage',
    type: Boolean,
    description:
      'Generate a multipage version of the spec. Cannot be used with --js-out or --css-out.',
  },
  {
    name: 'strict',
    type: Boolean,
    description: 'Exit with an error if there are warnings. Cannot be used with --watch.',
  },
  {
    name: 'verbose',
    type: Boolean,
    description: 'Display document build progress',
  },
  {
    name: 'version',
    alias: 'v',
    type: Boolean,
    description: 'Display version info',
  },
  {
    name: 'files',
    type: String,
    multiple: true,
    defaultOption: true,
  },
] as const;
