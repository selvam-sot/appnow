module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Type must be one of these
    'type-enum': [
      2,
      'always',
      [
        'feat',     // new feature
        'fix',      // bug fix
        'docs',     // documentation only
        'style',    // formatting, no code change
        'refactor', // code change that neither fixes a bug nor adds a feature
        'perf',     // performance improvement
        'test',     // adding or updating tests
        'build',    // build system or dependencies
        'ci',       // CI/CD changes
        'chore',    // maintenance tasks
        'revert',   // revert a previous commit
      ],
    ],
    // Type must be lowercase
    'type-case': [2, 'always', 'lower-case'],
    // Subject must be lowercase
    'subject-case': [2, 'always', 'lower-case'],
    // No period at end of subject
    'subject-full-stop': [2, 'never', '.'],
    // Subject max length
    'subject-max-length': [2, 'always', 72],
    // Subject cannot be empty
    'subject-empty': [2, 'never'],
    // Type cannot be empty
    'type-empty': [2, 'never'],
  },
};
