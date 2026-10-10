import path from 'node:path';
import express, { type Express } from 'express';

/** Serves the built client (`client/dist`) when CLIENT_DIST is set (PLAN.md "Studio Network",
 * decision 1). Any GET that isn't `/api` or `/audio` gets `index.html`, so a reload on a
 * client route still loads the app; an unknown `/api` or `/audio` path still 404s. Mount it after
 * the routers. */
export function mountClient(app: Express, dist: string): void {
  const root = path.resolve(dist);
  app.use(express.static(root, { index: 'index.html' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (/^\/(api|audio)(\/|$)/.test(req.path)) return next();
    res.sendFile(path.join(root, 'index.html'));
  });
}
