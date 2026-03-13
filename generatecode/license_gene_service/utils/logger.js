module.exports = {
  info: function info() {
    console.log.apply(console, ['[INFO]'].concat(Array.prototype.slice.call(arguments)));
  },
  error: function error() {
    console.error.apply(console, ['[ERROR]'].concat(Array.prototype.slice.call(arguments)));
  },
  debug: function debug() {
    if (process.env.DEBUG === '1' || process.env.DEBUG === 'true') {
      console.log.apply(console, ['[DEBUG]'].concat(Array.prototype.slice.call(arguments)));
    }
  }
};
