#!/usr/bin/env node
import http from 'node:http';
const port = Number(process.argv[4]);
const server = http.createServer((_req, res) => res.end('ready'));
server.listen(port, '127.0.0.1');
for (;;) await new Promise((resolve) => setTimeout(resolve, 1000));
