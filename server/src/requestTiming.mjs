/**
 * 慢请求日志（Phase 5）：/api/data bundle 等可观测
 */
export function attachRequestTiming(app, opts) {
  opts = opts || {};
  var thresholdMs = opts.slowMs != null ? opts.slowMs : 2000;
  app.use(function(req, res, next) {
    var start = Date.now();
    res.on('finish', function() {
      var ms = Date.now() - start;
      if (ms < thresholdMs) return;
      var path = req.originalUrl || req.url || '';
      console.warn('[api][slow]', ms + 'ms', req.method, path, 'status=' + res.statusCode);
    });
    next();
  });
}
