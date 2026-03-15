module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          'react-compiler': {
            compilationMode: 'all',
            panicThreshold: 'all_errors',
          },
        },
      ],
    ],
  };
};
